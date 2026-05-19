import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { PlayerSpiritStatus, Prisma, PrismaClient, SpiritElement, SpiritRarity, SpiritRole } from '@prisma/client';
import { APP_NAME, type ClientBuySpiritSoulRequest, type ClientComposeSpiritRequest, type ClientDissolveSpiritRequest, type ClientRecoverSpiritRequest, type ClientSetMainSpiritRequest, type ClientSpiritCodexEntry, type ClientSpiritElement, type ClientSpiritMutationResponse, type ClientSpiritState, type ClientSpiritStateResponse, type ClientSpiritStatus, type ClientSpiritSlot, type ClientSpiritDefinition, type ClientUpgradeSpiritRequest } from '@trinitywar/shared';
import { AuditService } from '../audit/audit.service.js';
import { ClientReadService } from '../client-read/client-read.service.js';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';
import { getLocalDateKey } from '../lib/date-key.js';
import { PrismaService } from '../prisma/prisma.service.js';

const SPIRIT_SOUL_GOLD_PRICE = 100;
const SPIRIT_MAX_LEVEL = 50;
const SPIRIT_DAILY_RECOVERY_LIMIT = 3;
const SPIRIT_DISSOLVE_REFUND_RATIO = 0.35;

type SpiritReadResource = {
  playerId: string;
  spiritSoul: number;
  dailyRecoveryUsed: number;
  resourceVersion: number;
  updatedAt: Date;
};

@Injectable()
export class SpiritService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ClientReadService) private readonly clientReadService: ClientReadService,
    @Inject(IdempotencyService) private readonly idempotencyService: IdempotencyService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async getSpiritStateResponse(playerId: string): Promise<ClientSpiritStateResponse> {
    return {
      app: APP_NAME,
      spirit: await this.getSpiritState(playerId),
    };
  }

  async getSpiritState(
    playerId: string,
    client?: Prisma.TransactionClient | PrismaClient,
  ): Promise<ClientSpiritState> {
    if (!client) {
      return this.prisma.transaction(async (transactionClient) => this.getSpiritState(playerId, transactionClient));
    }

    const readModel = await this.findSpiritReadModel(playerId, client);
    return buildSpiritState(readModel.resource, readModel.slots, readModel.codex);
  }

  async buySpiritSoul(
    playerId: string,
    request: ClientBuySpiritSoulRequest,
    headerIdempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    const idempotencyKey = normalizeIdempotencyKey(headerIdempotencyKey ?? request.requestIdempotencyKey);

    return this.prisma.transaction(async (client) => {
      const goldAmount = Math.max(Math.floor(request.goldAmount / SPIRIT_SOUL_GOLD_PRICE) * SPIRIT_SOUL_GOLD_PRICE, 0);
      if (goldAmount <= 0) {
        throwBadRequest(`goldAmount must be at least ${SPIRIT_SOUL_GOLD_PRICE}.`);
      }

      const soulGain = Math.floor(goldAmount / SPIRIT_SOUL_GOLD_PRICE);
      const requestHash = hashRequest({
        endpoint: 'buy-soul',
        goldAmount,
        walletVersion: request.walletVersion ?? null,
        resourceVersion: request.resourceVersion ?? null,
      });
      const idempotencyRecord = await this.prepareIdempotencyRecord(client, playerId, 'spirit-buy-soul', idempotencyKey, requestHash);
      if (idempotencyRecord?.status === 'completed' && idempotencyRecord.responseSnapshotJson) {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientSpiritMutationResponse;
      }

      const [wallet, resource] = await Promise.all([
        client.playerWallet.findUnique({
          where: { playerId },
          select: {
            vaultGold: true,
            balanceVersion: true,
          },
        }),
        client.playerSpiritResource.findUnique({
          where: { playerId },
          select: {
            spiritSoul: true,
            dailyRecoveryUsed: true,
            resourceVersion: true,
            updatedAt: true,
          },
        }),
      ]);

      if (!wallet || !resource) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Player spirit or wallet state not found.',
          statusCode: 404,
        });
      }

      assertVersion('walletVersion', request.walletVersion, wallet.balanceVersion);
      assertVersion('resourceVersion', request.resourceVersion, resource.resourceVersion);

      if (wallet.vaultGold < goldAmount) {
        throw new BusinessError({
          code: ErrorCode.InsufficientVaultGold,
          message: 'Insufficient vault gold.',
          statusCode: 409,
        });
      }

      await client.playerWallet.update({
        where: { playerId },
        data: {
          vaultGold: { decrement: goldAmount },
          balanceVersion: { increment: 1 },
        },
      });
      await client.playerSpiritResource.update({
        where: { playerId },
        data: {
          spiritSoul: { increment: soulGain },
          resourceVersion: { increment: 1 },
        },
      });
      await this.auditService.createWalletChangeLog(client, {
        playerId,
        walletBucket: 'vault',
        changeType: 'spirit-buy-soul',
        deltaGold: -goldAmount,
        beforeGold: wallet.vaultGold,
        afterGold: wallet.vaultGold - goldAmount,
        relatedEntityType: 'spirit-resource',
        relatedEntityId: playerId,
        requestIdempotencyKey: idempotencyKey ?? null,
        note: `Buy ${soulGain} spirit soul.`,
      });

      const response = await this.buildSpiritMutationResponse(client, playerId, `已消耗 ${goldAmount} 金币，购入 ${soulGain} 点兽魂。`);
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-resource', playerId);
      return response;
    });
  }

  async upgradeSpirit(
    playerId: string,
    request: ClientUpgradeSpiritRequest,
    headerIdempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    const idempotencyKey = normalizeIdempotencyKey(headerIdempotencyKey ?? request.requestIdempotencyKey);

    return this.prisma.transaction(async (client) => {
      const requestHash = hashRequest({
        endpoint: 'upgrade',
        slotIndex: request.slotIndex,
        slotVersion: request.slotVersion ?? null,
        resourceVersion: request.resourceVersion ?? null,
      });
      const idempotencyRecord = await this.prepareIdempotencyRecord(client, playerId, 'spirit-upgrade', idempotencyKey, requestHash);
      if (idempotencyRecord?.status === 'completed' && idempotencyRecord.responseSnapshotJson) {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientSpiritMutationResponse;
      }

      const [resource, slot] = await Promise.all([
        client.playerSpiritResource.findUnique({
          where: { playerId },
          select: {
            spiritSoul: true,
            resourceVersion: true,
            updatedAt: true,
            dailyRecoveryUsed: true,
          },
        }),
        client.playerSpiritSlot.findUnique({
          where: {
            playerId_slotIndex: {
              playerId,
              slotIndex: request.slotIndex,
            },
          },
          select: {
            id: true,
            slotIndex: true,
            spiritDefinitionId: true,
            level: true,
            currentHp: true,
            maxHp: true,
            slotVersion: true,
            spiritDefinition: {
              select: {
                baseHp: true,
                growthHp: true,
                label: true,
              },
            },
          },
        }),
      ]);

      if (!resource || !slot || !slot.spiritDefinitionId || !slot.spiritDefinition) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Spirit slot not found.',
          statusCode: 404,
        });
      }

      assertVersion('resourceVersion', request.resourceVersion, resource.resourceVersion);
      assertVersion('slotVersion', request.slotVersion, slot.slotVersion);

      const upgradeCost = getSpiritUpgradeCost(slot.level);
      if (upgradeCost === null) {
        throw new BusinessError({
          code: ErrorCode.BadRequest,
          message: 'Spirit has reached max level.',
          statusCode: 400,
        });
      }

      if (resource.spiritSoul < upgradeCost) {
        throw new BusinessError({
          code: ErrorCode.Conflict,
          message: 'Insufficient spirit soul.',
          statusCode: 409,
        });
      }

      const nextLevel = slot.level + 1;
      const nextMaxHp = calculateSpiritMaxHp(slot.spiritDefinition.baseHp, slot.spiritDefinition.growthHp, nextLevel);
      const currentHp = Math.min(nextMaxHp, slot.currentHp + (nextMaxHp - slot.maxHp));

      await client.playerSpiritResource.update({
        where: { playerId },
        data: {
          spiritSoul: { decrement: upgradeCost },
          resourceVersion: { increment: 1 },
        },
      });
      await client.playerSpiritSlot.update({
        where: { id: slot.id },
        data: {
          level: nextLevel,
          maxHp: nextMaxHp,
          currentHp,
          slotVersion: { increment: 1 },
        },
      });

      const response = await this.buildSpiritMutationResponse(client, playerId, `${slot.spiritDefinition.label} 已升至 Lv.${nextLevel}。`);
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-slot', slot.id);
      return response;
    });
  }

  async setMainSpirit(
    playerId: string,
    request: ClientSetMainSpiritRequest,
    headerIdempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    const idempotencyKey = normalizeIdempotencyKey(headerIdempotencyKey ?? request.requestIdempotencyKey);

    return this.prisma.transaction(async (client) => {
      const requestHash = hashRequest({
        endpoint: 'set-main',
        slotIndex: request.slotIndex,
        slotVersion: request.slotVersion ?? null,
      });
      const idempotencyRecord = await this.prepareIdempotencyRecord(client, playerId, 'spirit-set-main', idempotencyKey, requestHash);
      if (idempotencyRecord?.status === 'completed' && idempotencyRecord.responseSnapshotJson) {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientSpiritMutationResponse;
      }

      const slots = await client.playerSpiritSlot.findMany({
        where: { playerId },
        select: {
          id: true,
          slotIndex: true,
          spiritDefinitionId: true,
          isMain: true,
          slotVersion: true,
          spiritDefinition: {
            select: {
              label: true,
            },
          },
        },
        orderBy: { slotIndex: 'asc' },
      });

      const targetSlot = slots.find((slot) => slot.slotIndex === request.slotIndex);
      if (!targetSlot || !targetSlot.spiritDefinitionId) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Spirit slot not found.',
          statusCode: 404,
        });
      }

      assertVersion('slotVersion', request.slotVersion, targetSlot.slotVersion);

      for (const slot of slots) {
        const nextIsMain = slot.id === targetSlot.id;
        if (slot.isMain === nextIsMain) {
          continue;
        }

        await client.playerSpiritSlot.update({
          where: { id: slot.id },
          data: {
            isMain: nextIsMain,
            slotVersion: { increment: 1 },
          },
        });
      }

      const response = await this.buildSpiritMutationResponse(client, playerId, `${targetSlot.spiritDefinition?.label ?? '灵宠'} 已设为主位。`);
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-slot', targetSlot.id);
      return response;
    });
  }

  async recoverSpirit(
    playerId: string,
    request: ClientRecoverSpiritRequest,
    headerIdempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    const idempotencyKey = normalizeIdempotencyKey(headerIdempotencyKey ?? request.requestIdempotencyKey);

    return this.prisma.transaction(async (client) => {
      const requestHash = hashRequest({
        endpoint: 'recover',
        slotIndex: request.slotIndex,
        slotVersion: request.slotVersion ?? null,
        resourceVersion: request.resourceVersion ?? null,
      });
      const idempotencyRecord = await this.prepareIdempotencyRecord(client, playerId, 'spirit-recover', idempotencyKey, requestHash);
      if (idempotencyRecord?.status === 'completed' && idempotencyRecord.responseSnapshotJson) {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientSpiritMutationResponse;
      }

      const [resource, slot] = await Promise.all([
        client.playerSpiritResource.findUnique({
          where: { playerId },
          select: {
            playerId: true,
            spiritSoul: true,
            dailyRecoveryUsed: true,
            resourceVersion: true,
            updatedAt: true,
          },
        }),
        client.playerSpiritSlot.findUnique({
          where: {
            playerId_slotIndex: {
              playerId,
              slotIndex: request.slotIndex,
            },
          },
          select: {
            id: true,
            spiritDefinitionId: true,
            currentHp: true,
            maxHp: true,
            slotVersion: true,
            spiritDefinition: {
              select: { label: true },
            },
          },
        }),
      ]);

      if (!resource || !slot || !slot.spiritDefinitionId) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Spirit slot not found.',
          statusCode: 404,
        });
      }

      assertVersion('resourceVersion', request.resourceVersion, resource.resourceVersion);
      assertVersion('slotVersion', request.slotVersion, slot.slotVersion);

      if (slot.currentHp >= slot.maxHp) {
        throw new BusinessError({
          code: ErrorCode.BadRequest,
          message: 'Spirit is already at full health.',
          statusCode: 400,
        });
      }

      const nextRecoveryUsed = getNextDailyRecoveryUsed(resource);
      if (nextRecoveryUsed > SPIRIT_DAILY_RECOVERY_LIMIT) {
        throw new BusinessError({
          code: ErrorCode.Conflict,
          message: 'Daily spirit recovery limit reached.',
          statusCode: 409,
        });
      }

      await client.playerSpiritResource.update({
        where: { playerId },
        data: {
          dailyRecoveryUsed: nextRecoveryUsed,
          resourceVersion: { increment: 1 },
        },
      });
      await client.playerSpiritSlot.update({
        where: { id: slot.id },
        data: {
          currentHp: slot.maxHp,
          status: 'ACTIVE',
          slotVersion: { increment: 1 },
        },
      });

      const response = await this.buildSpiritMutationResponse(client, playerId, `${slot.spiritDefinition?.label ?? '灵宠'} 已恢复至满血。`);
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-slot', slot.id);
      return response;
    });
  }

  async dissolveSpirit(
    playerId: string,
    request: ClientDissolveSpiritRequest,
    headerIdempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    const idempotencyKey = normalizeIdempotencyKey(headerIdempotencyKey ?? request.requestIdempotencyKey);

    return this.prisma.transaction(async (client) => {
      const requestHash = hashRequest({
        endpoint: 'dissolve',
        slotIndex: request.slotIndex,
        slotVersion: request.slotVersion ?? null,
      });
      const idempotencyRecord = await this.prepareIdempotencyRecord(client, playerId, 'spirit-dissolve', idempotencyKey, requestHash);
      if (idempotencyRecord?.status === 'completed' && idempotencyRecord.responseSnapshotJson) {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientSpiritMutationResponse;
      }

      const slot = await client.playerSpiritSlot.findUnique({
        where: {
          playerId_slotIndex: {
            playerId,
            slotIndex: request.slotIndex,
          },
        },
        select: {
          id: true,
          slotIndex: true,
          spiritDefinitionId: true,
          isMain: true,
          level: true,
          slotVersion: true,
          spiritDefinition: {
            select: {
              id: true,
              label: true,
            },
          },
        },
      });

      if (!slot || !slot.spiritDefinitionId || !slot.spiritDefinition) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Spirit slot not found.',
          statusCode: 404,
        });
      }

      if (slot.isMain) {
        throw new BusinessError({
          code: ErrorCode.BadRequest,
          message: 'Main spirit cannot be dissolved directly.',
          statusCode: 400,
        });
      }

      assertVersion('slotVersion', request.slotVersion, slot.slotVersion);

      const refundSoul = Math.floor(getSpiritRefundSoul(slot.level) * SPIRIT_DISSOLVE_REFUND_RATIO);
      await client.playerSpiritResource.update({
        where: { playerId },
        data: {
          spiritSoul: { increment: refundSoul },
          resourceVersion: { increment: 1 },
        },
      });
      await client.playerSpiritSlot.update({
        where: { id: slot.id },
        data: {
          spiritDefinitionId: null,
          isMain: false,
          level: 1,
          exp: 0,
          element: null,
          currentHp: 0,
          maxHp: 0,
          status: 'DISSOLVED',
          dissolvedAt: new Date(),
          slotVersion: { increment: 1 },
        },
      });
      await client.playerSpiritCodex.update({
        where: {
          playerId_spiritDefinitionId: {
            playerId,
            spiritDefinitionId: slot.spiritDefinition.id,
          },
        },
        data: {
          ownedCurrent: false,
          ownedEver: true,
          codexVersion: { increment: 1 },
        },
      });

      const response = await this.buildSpiritMutationResponse(client, playerId, `${slot.spiritDefinition.label} 已解散，返还 ${refundSoul} 点兽魂。`);
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-slot', slot.id);
      return response;
    });
  }

  async composeSpirit(
    playerId: string,
    request: ClientComposeSpiritRequest,
    headerIdempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    const idempotencyKey = normalizeIdempotencyKey(headerIdempotencyKey ?? request.requestIdempotencyKey);

    return this.prisma.transaction(async (client) => {
      const requestHash = hashRequest({
        endpoint: 'compose',
        spiritId: request.spiritId,
        slotIndex: request.slotIndex,
        element: request.element,
      });
      const idempotencyRecord = await this.prepareIdempotencyRecord(client, playerId, 'spirit-compose', idempotencyKey, requestHash);
      if (idempotencyRecord?.status === 'completed' && idempotencyRecord.responseSnapshotJson) {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientSpiritMutationResponse;
      }

      const [targetSlot, codexEntry] = await Promise.all([
        client.playerSpiritSlot.findUnique({
          where: {
            playerId_slotIndex: {
              playerId,
              slotIndex: request.slotIndex,
            },
          },
          select: {
            id: true,
            spiritDefinitionId: true,
            slotVersion: true,
          },
        }),
        client.playerSpiritCodex.findFirst({
          where: {
            playerId,
            spiritDefinition: {
              spiritId: request.spiritId,
            },
          },
          select: {
            id: true,
            shardCount: true,
            readyToCompose: true,
            spiritDefinitionId: true,
            spiritDefinition: {
              select: {
                spiritId: true,
                label: true,
                shardUnlockRequired: true,
                baseHp: true,
                growthHp: true,
              },
            },
          },
        }),
      ]);

      if (!targetSlot) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Spirit slot not found.',
          statusCode: 404,
        });
      }

      if (targetSlot.spiritDefinitionId) {
        throw new BusinessError({
          code: ErrorCode.Conflict,
          message: 'Spirit slot is already occupied.',
          statusCode: 409,
        });
      }

      if (!codexEntry || !codexEntry.spiritDefinition) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Spirit codex entry not found.',
          statusCode: 404,
        });
      }

      if (!codexEntry.readyToCompose && codexEntry.shardCount < codexEntry.spiritDefinition.shardUnlockRequired) {
        throw new BusinessError({
          code: ErrorCode.Conflict,
          message: 'Spirit shards are not ready to compose.',
          statusCode: 409,
        });
      }

      const maxHp = calculateSpiritMaxHp(codexEntry.spiritDefinition.baseHp, codexEntry.spiritDefinition.growthHp, 1);

      await client.playerSpiritSlot.update({
        where: { id: targetSlot.id },
        data: {
          spiritDefinitionId: codexEntry.spiritDefinitionId,
          isMain: false,
          level: 1,
          exp: 0,
          element: toPrismaElement(request.element),
          currentHp: maxHp,
          maxHp,
          status: 'ACTIVE',
          acquiredAt: new Date(),
          dissolvedAt: null,
          slotVersion: { increment: 1 },
        },
      });
      await client.playerSpiritCodex.update({
        where: { id: codexEntry.id },
        data: {
          shardCount: Math.max(codexEntry.shardCount - codexEntry.spiritDefinition.shardUnlockRequired, 0),
          readyToCompose: false,
          ownedCurrent: true,
          ownedEver: true,
          hasSeen: true,
          readyAt: null,
          lastOwnedAt: new Date(),
          codexVersion: { increment: 1 },
        },
      });

      const response = await this.buildSpiritMutationResponse(client, playerId, `${codexEntry.spiritDefinition.label} 已合成入栏。`);
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-slot', targetSlot.id);
      return response;
    });
  }

  private async buildSpiritMutationResponse(
    client: Prisma.TransactionClient,
    playerId: string,
    summary: string,
  ): Promise<ClientSpiritMutationResponse> {
    return {
      app: APP_NAME,
      summary,
      spirit: await this.getSpiritState(playerId, client),
      home: await this.clientReadService.getHomeSummary(playerId, client),
      scenes: await this.clientReadService.getSceneContent(playerId, client),
    };
  }

  private async findSpiritReadModel(
    playerId: string,
    client: Prisma.TransactionClient | PrismaClient,
  ) {
    const [resource, slots, codex] = await Promise.all([
      client.playerSpiritResource.findUnique({
        where: { playerId },
        select: {
          playerId: true,
          spiritSoul: true,
          dailyRecoveryUsed: true,
          resourceVersion: true,
          updatedAt: true,
        },
      }),
      client.playerSpiritSlot.findMany({
        where: { playerId },
        orderBy: { slotIndex: 'asc' },
        select: {
          slotIndex: true,
          isMain: true,
          level: true,
          exp: true,
          element: true,
          currentHp: true,
          maxHp: true,
          status: true,
          slotVersion: true,
          spiritDefinition: {
            select: {
              spiritId: true,
            },
          },
        },
      }),
      client.playerSpiritCodex.findMany({
        where: { playerId },
        select: {
          hasSeen: true,
          shardCount: true,
          readyToCompose: true,
          ownedCurrent: true,
          ownedEver: true,
          spiritDefinition: {
            select: {
              spiritId: true,
              label: true,
              rarity: true,
              factionAffinity: true,
              role: true,
              shardName: true,
              shardUnlockRequired: true,
              lore: true,
              sortOrder: true,
            },
          },
        },
      }),
    ]);

    if (!resource) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Spirit state not found.',
        statusCode: 404,
      });
    }

    return { resource, slots, codex };
  }

  private async prepareIdempotencyRecord(
    client: Prisma.TransactionClient,
    playerId: string,
    endpointKey: string,
    idempotencyKey: string | undefined,
    requestHash: string,
  ) {
    if (!idempotencyKey) {
      return null;
    }

    const existingRecord = await this.idempotencyService.findByKey(client, playerId, endpointKey, idempotencyKey);
    if (existingRecord) {
      if (existingRecord.requestHash !== requestHash) {
        throw new BusinessError({
          code: ErrorCode.Conflict,
          message: 'Idempotency key was already used with a different request.',
          statusCode: 409,
        });
      }

      if (existingRecord.status === 'completed') {
        return existingRecord;
      }

      throw new BusinessError({
        code: ErrorCode.Conflict,
        message: 'Idempotency request is still processing.',
        statusCode: 409,
      });
    }

    return this.idempotencyService.createProcessing(client, {
      playerId,
      endpointKey,
      idempotencyKey,
      requestHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  }

  private async markIdempotencyCompleted(
    client: Prisma.TransactionClient,
    id: string | undefined,
    response: ClientSpiritMutationResponse,
    businessEntityType: string,
    businessEntityId: string,
  ): Promise<void> {
    if (!id) {
      return;
    }

    await this.idempotencyService.markCompleted(client, {
      id,
      responseSnapshotJson: response as unknown as Prisma.InputJsonValue,
      businessEntityType,
      businessEntityId,
    });
  }
}

function buildSpiritState(
  resource: SpiritReadResource,
  slots: Array<{
    slotIndex: number;
    isMain: boolean;
    level: number;
    exp: number;
    element: SpiritElement | null;
    currentHp: number;
    maxHp: number;
    status: PlayerSpiritStatus;
    slotVersion: number;
    spiritDefinition: {
      spiritId: string;
    } | null;
  }>,
  codexEntries: Array<{
    hasSeen: boolean;
    shardCount: number;
    readyToCompose: boolean;
    ownedCurrent: boolean;
    ownedEver: boolean;
    spiritDefinition: {
      spiritId: string;
      label: string;
      rarity: SpiritRarity;
      factionAffinity: string;
      role: SpiritRole;
      shardName: string;
      shardUnlockRequired: number;
      lore: string | null;
      sortOrder: number;
    };
  }>,
): ClientSpiritState {
  const mappedSlots: ClientSpiritSlot[] = slots.map((slot) => ({
    slotIndex: slot.slotIndex,
    spiritId: slot.spiritDefinition?.spiritId ?? null,
    isMain: slot.isMain,
    level: slot.level,
    exp: slot.exp,
    element: slot.element ? toClientElement(slot.element) : null,
    currentHp: slot.currentHp,
    maxHp: slot.maxHp,
    status: toClientStatus(slot.status),
    slotVersion: slot.slotVersion,
  }));
  const mappedCodex: ClientSpiritCodexEntry[] = codexEntries
    .sort((left, right) => left.spiritDefinition.sortOrder - right.spiritDefinition.sortOrder)
    .map((entry) => ({
      spiritId: entry.spiritDefinition.spiritId,
      hasSeen: entry.hasSeen,
      shardCount: entry.shardCount,
      readyToCompose: entry.readyToCompose,
      ownedCurrent: entry.ownedCurrent,
      ownedEver: entry.ownedEver,
      definition: toClientDefinition(entry.spiritDefinition),
    }));

  return {
    spiritSoul: resource.spiritSoul,
    dailyRecoveryUsed: getEffectiveDailyRecoveryUsed(resource),
    resourceVersion: resource.resourceVersion,
    mainSlot: mappedSlots.find((slot) => slot.isMain && slot.spiritId !== null) ?? null,
    slots: mappedSlots,
    codex: mappedCodex,
    readyToCompose: mappedCodex.filter((entry) => entry.readyToCompose),
  };
}

function toClientDefinition(definition: {
  spiritId: string;
  label: string;
  rarity: SpiritRarity;
  factionAffinity: string;
  role: SpiritRole;
  shardName: string;
  shardUnlockRequired: number;
  lore: string | null;
}): ClientSpiritDefinition {
  return {
    spiritId: definition.spiritId,
    label: definition.label,
    rarity: definition.rarity.toLowerCase() as ClientSpiritDefinition['rarity'],
    factionAffinity: definition.factionAffinity as ClientSpiritDefinition['factionAffinity'],
    role: definition.role.toLowerCase() as ClientSpiritDefinition['role'],
    shardName: definition.shardName,
    shardUnlockRequired: definition.shardUnlockRequired,
    lore: definition.lore,
  };
}

function toClientElement(element: SpiritElement): ClientSpiritElement {
  return element.toLowerCase() as ClientSpiritElement;
}

function toPrismaElement(element: ClientSpiritElement): SpiritElement {
  return element.toUpperCase() as SpiritElement;
}

function toClientStatus(status: PlayerSpiritStatus): ClientSpiritStatus {
  return status.toLowerCase() as ClientSpiritStatus;
}

function calculateSpiritMaxHp(baseHp: number, growthHp: number, level: number): number {
  return baseHp + Math.max(level - 1, 0) * growthHp;
}

function normalizeIdempotencyKey(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function hashRequest(payload: Record<string, unknown>): string {
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

function getSpiritUpgradeCost(level: number): number | null {
  if (level >= SPIRIT_MAX_LEVEL) {
    return null;
  }

  const fixedCosts: Record<number, number> = {
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 8,
    8: 10,
    9: 12,
    10: 15,
    41: 290,
    42: 300,
    43: 320,
    44: 340,
    45: 360,
    46: 390,
    47: 420,
    48: 450,
    49: 490,
  };

  if (fixedCosts[level]) {
    return fixedCosts[level];
  }
  if (level >= 11 && level <= 15) {
    return 18 + (level - 11) * 3;
  }
  if (level >= 16 && level <= 20) {
    return 35 + (level - 16) * 5;
  }
  if (level >= 21 && level <= 25) {
    return 63 + (level - 21) * 8;
  }
  if (level >= 26 && level <= 30) {
    return 105 + (level - 26) * 10;
  }
  if (level >= 31 && level <= 35) {
    return 160 + (level - 31) * 15;
  }
  if (level >= 36 && level <= 40) {
    return 240 + (level - 36) * 20;
  }

  return 1;
}

function getSpiritRefundSoul(level: number): number {
  let total = 0;

  for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
    total += getSpiritUpgradeCost(currentLevel) ?? 0;
  }

  return total;
}

function getEffectiveDailyRecoveryUsed(resource: SpiritReadResource): number {
  return getLocalDateKey(resource.updatedAt) === getLocalDateKey() ? resource.dailyRecoveryUsed : 0;
}

function getNextDailyRecoveryUsed(resource: SpiritReadResource): number {
  const currentUsed = getEffectiveDailyRecoveryUsed(resource);
  return currentUsed + 1;
}

function assertVersion(label: string, expected: number | undefined, actual: number): void {
  if (typeof expected !== 'number') {
    return;
  }

  if (expected !== actual) {
    throw new BusinessError({
      code: ErrorCode.StateVersionConflict,
      message: `${label} conflict.`,
      statusCode: 409,
      details: { expected, actual },
    });
  }
}

function throwBadRequest(message: string): never {
  throw new BusinessError({
    code: ErrorCode.BadRequest,
    message,
    statusCode: 400,
  });
}