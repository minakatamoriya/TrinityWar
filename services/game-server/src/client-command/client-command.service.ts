import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { APP_NAME, type ClientStateMutationResponse } from '@trinitywar/shared';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';
import { getPopulationCapacityGain, getVaultCapacityGain } from '../lib/game-balance.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClientReadService } from '../client-read/client-read.service.js';
import {
  BuildingUpgradeRuleService,
  type BuildingUpgradeTarget,
  type PlayerBuildingStateForUpgrade,
} from './building-upgrade-rule.service.js';
import type { UpgradeBuildingRequestDto } from './dto.js';

interface UpgradeBuildingCommandInput {
  playerId: string;
  request: UpgradeBuildingRequestDto;
  idempotencyKey?: string;
}

@Injectable()
export class ClientCommandService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(IdempotencyService) private readonly idempotencyService: IdempotencyService,
    @Inject(BuildingUpgradeRuleService) private readonly buildingUpgradeRuleService: BuildingUpgradeRuleService,
    @Inject(ClientReadService) private readonly clientReadService: ClientReadService,
  ) {}

  async upgradeBuilding(input: UpgradeBuildingCommandInput): Promise<ClientStateMutationResponse> {
    const endpointKey = 'client.actions.upgrade-building';
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey ?? input.request.requestIdempotencyKey);
    const requestHash = hashRequest(input.request);

    return this.prisma.transaction<ClientStateMutationResponse>(async (client) => {
      const idempotencyRecord = idempotencyKey
        ? await this.prepareIdempotencyRecord(client, input.playerId, endpointKey, idempotencyKey, requestHash)
        : null;

      if (idempotencyRecord?.status === 'completed') {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientStateMutationResponse;
      }

      const playerState = await client.player.findUnique({
        where: { id: input.playerId },
        select: {
          id: true,
          buildings: true,
          wallet: true,
        },
      });

      if (!playerState?.buildings || !playerState.wallet) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Player building or wallet state not found.',
          statusCode: 404,
        });
      }

      assertVersion('buildingVersion', input.request.buildingVersion, playerState.buildings.buildingVersion);
      assertVersion('walletVersion', input.request.walletVersion, playerState.wallet.balanceVersion);

      const target = this.resolveTarget(playerState.buildings, input.request);

      if (playerState.buildings.castleLevel < target.requiredCastleLevel) {
        throw new BusinessError({
          code: ErrorCode.Forbidden,
          message: `Castle level ${target.requiredCastleLevel} is required.`,
          statusCode: 403,
        });
      }

      if (playerState.wallet.vaultGold < target.costGold) {
        throw new BusinessError({
          code: ErrorCode.InsufficientVaultGold,
          message: 'Insufficient vault gold.',
          statusCode: 409,
        });
      }

      const nextVaultGold = playerState.wallet.vaultGold - target.costGold;
      await client.playerBuilding.update({
        where: { playerId: input.playerId },
        data: buildBuildingUpdateData(target),
      });
      await client.playerWallet.update({
        where: { playerId: input.playerId },
        data: {
          vaultGold: nextVaultGold,
          vaultCapacity: target.key === 'vault'
            ? playerState.wallet.vaultCapacity + getVaultCapacityGain(target.currentLevel)
            : playerState.wallet.vaultCapacity,
          balanceVersion: { increment: 1 },
        },
      });

      if (target.key === 'castle') {
        await client.player.update({
          where: { id: input.playerId },
          data: { castleLevelCache: target.nextLevel },
        });
      }

      if (target.key === 'population') {
        await client.playerArmy.update({
          where: { playerId: input.playerId },
          data: {
            capacity: { increment: getPopulationCapacityGain(target.currentLevel) },
            armyVersion: { increment: 1 },
          },
        });
      }

      await this.auditService.createWalletChangeLog(client, {
        playerId: input.playerId,
        walletBucket: 'vault',
        changeType: 'upgrade-building',
        deltaGold: -target.costGold,
        beforeGold: playerState.wallet.vaultGold,
        afterGold: nextVaultGold,
        relatedEntityType: target.isExtension ? 'castle-extension' : 'building',
        relatedEntityId: target.key,
        requestIdempotencyKey: idempotencyKey,
        note: `Upgrade ${target.key} from Lv.${target.currentLevel} to Lv.${target.nextLevel}.`,
      });
      await this.auditService.createBuildingUpgradeLog(client, {
        playerId: input.playerId,
        buildingKey: target.key,
        oldLevel: target.currentLevel,
        newLevel: target.nextLevel,
        costGold: target.costGold,
        requestIdempotencyKey: idempotencyKey,
      });

      const responseSnapshot: ClientStateMutationResponse = {
        app: APP_NAME,
        summary: `已升级 ${target.key}：Lv.${target.currentLevel} -> Lv.${target.nextLevel}`,
        home: await this.clientReadService.getHomeSummary(input.playerId, client),
        scenes: await this.clientReadService.getSceneContent(input.playerId, client),
      };

      if (idempotencyRecord?.id) {
        await this.idempotencyService.markCompleted(client, {
          id: idempotencyRecord.id,
          responseSnapshotJson: responseSnapshot as unknown as Prisma.InputJsonValue,
          businessEntityType: target.isExtension ? 'castle-extension' : 'building',
          businessEntityId: target.key,
        });
      }

      return responseSnapshot;
    });
  }

  private async prepareIdempotencyRecord(
    client: Prisma.TransactionClient,
    playerId: string,
    endpointKey: string,
    idempotencyKey: string,
    requestHash: string,
  ) {
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

  private resolveTarget(
    buildings: PlayerBuildingStateForUpgrade,
    request: UpgradeBuildingRequestDto,
  ): BuildingUpgradeTarget {
    if (request.targetType === 'building') {
      if (!request.buildingId) {
        throwBadRequest('buildingId is required.');
      }

      const buildingId = request.buildingId;
      return this.wrapRuleError(() => this.buildingUpgradeRuleService.resolveBuildingTarget(buildings, buildingId));
    }

    if (request.targetType === 'castle-extension') {
      if (!request.extensionId) {
        throwBadRequest('extensionId is required.');
      }

      const extensionId = request.extensionId;
      return this.wrapRuleError(() => this.buildingUpgradeRuleService.resolveExtensionTarget(buildings, extensionId));
    }

    throwBadRequest('targetType must be building or castle-extension.');
  }

  private wrapRuleError(handler: () => BuildingUpgradeTarget): BuildingUpgradeTarget {
    try {
      return handler();
    } catch (error) {
      if (error instanceof Error && error.message === 'FIELD_SLOT_AUTO_UNLOCK') {
        throw new BusinessError({
          code: ErrorCode.BadRequest,
          message: 'Field slots are unlocked automatically by castle level.',
          statusCode: 400,
        });
      }

      if (error instanceof Error && error.message === 'BUILDING_MAX_LEVEL') {
        throw new BusinessError({
          code: ErrorCode.BadRequest,
          message: 'Building target has reached the configured max level.',
          statusCode: 400,
        });
      }

      throw error;
    }
  }
}

function normalizeIdempotencyKey(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function hashRequest(request: UpgradeBuildingRequestDto): string {
  return createHash('sha256')
    .update(JSON.stringify({
      targetType: request.targetType,
      buildingId: request.buildingId ?? null,
      extensionId: request.extensionId ?? null,
      buildingVersion: request.buildingVersion ?? null,
      walletVersion: request.walletVersion ?? null,
    }))
    .digest('hex');
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

function buildBuildingUpdateData(target: BuildingUpgradeTarget): Prisma.PlayerBuildingUpdateInput {
  const data: Prisma.PlayerBuildingUpdateInput = {
    buildingVersion: { increment: 1 },
  };

  if (target.key === 'castle') {
    data.castleLevel = target.nextLevel;
  } else if (target.key === 'vault') {
    data.vaultLevel = target.nextLevel;
  } else if (target.key === 'population') {
    data.populationLevel = target.nextLevel;
  } else if (target.key === 'watchtower') {
    data.watchtowerLevel = target.nextLevel;
  } else if (target.key === 'protectionTech') {
    data.protectionTechLevel = target.nextLevel;
  } else if (target.key === 'farmYieldTech') {
    data.farmYieldTechLevel = target.nextLevel;
  } else if (target.key === 'ripeWindowTech') {
    data.ripeWindowTechLevel = target.nextLevel;
  } else if (target.key === 'pendingClaimTech') {
    data.pendingClaimTechLevel = target.nextLevel;
  }

  return data;
}
