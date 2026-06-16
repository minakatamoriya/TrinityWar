import { Inject, Injectable } from '@nestjs/common';
import {
  APP_NAME,
  type ClientCodexState,
  type ClientRaidBattleEvent,
  type ClientRaidBattleReplayResponse,
  type ClientRaidRewardItem,
  type ClientRaidActionResponse,
  type ClientRaidDeepIntelResponse,
  type ClientRaidMessageTemplate,
  type ClientRaidOrderMessageResponse,
  type ClientRaidSpiritPreview,
  type ClientRaidTargetDetailResponse,
  type ClientSceneVisibility,
} from '@trinitywar/shared';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { ClientReadService } from '../client-read/client-read.service.js';
import { getLocalDateKey } from '../lib/date-key.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RaidSettlementQueueService } from './raid-settlement-queue.service.js';
import { RaidSettlementService } from './raid-settlement.service.js';
import { buildRaidBattleReplay, parseRaidBattleReplay } from './raid-battle-replay.js';
import { RaidRepository } from './raid.repository.js';

const RAID_INTEL_FREE_LIMIT = 3;
const RAID_INTEL_TALISMAN_LIMIT = 3;
const RAID_WALLET_EXPOSURE_RATIO = 0.05;

@Injectable()
export class RaidTargetService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RaidRepository) private readonly raidRepository: RaidRepository,
    @Inject(ClientReadService) private readonly clientReadService: ClientReadService,
    @Inject(RaidSettlementQueueService) private readonly raidSettlementQueueService: RaidSettlementQueueService,
    @Inject(RaidSettlementService) private readonly raidSettlementService: RaidSettlementService,
  ) {}

  async getRaidTargetDetail(playerId: string, targetId: string): Promise<ClientRaidTargetDetailResponse> {
    // 查目标和情报额度
    const [target, intelQuota, codex] = await Promise.all([
      this.raidRepository.findVisibleTargetPoolEntry({
        ownerPlayerId: playerId,
        targetPoolId: targetId,
      }),
      this.getIntelQuota(playerId),
      this.prisma.db.playerSpiritCodex.findMany({
        where: { playerId },
        select: {
          spiritDefinition: { select: { spiritId: true } },
          shardCount: true,
          readyToCompose: true,
          ownedCurrent: true,
          ownedEver: true,
        },
      }),
    ]);

    if (!target) {
      throw new BusinessError({
        code: ErrorCode.RaidTargetNotFound,
        message: 'Raid target not found or expired.',
        statusCode: 404,
      });
    }

    // 取主宠 spiritId
    const mainSlot = target?.targetPlayer.spiritSlots[0] ?? null;
    let sceneVisibility: ClientSceneVisibility = 'masked';
    const spiritId = mainSlot?.spiritDefinition?.spiritId;
    if (spiritId) {
      const entry = codex.find(e => e.spiritDefinition?.spiritId === spiritId);
      sceneVisibility = resolveSpiritSceneVisibility(entry);
    }

    return buildRaidTargetDetailResponse(target, targetId, intelQuota, sceneVisibility);
  }

  async getRaidTargetDeepIntel(playerId: string, targetId: string): Promise<ClientRaidDeepIntelResponse> {
    return this.prisma.transaction(async (client) => {
      const [target, resource, codex] = await Promise.all([
        this.raidRepository.findVisibleTargetPoolEntry({
          ownerPlayerId: playerId,
          targetPoolId: targetId,
        }, client),
        client.playerSpiritResource.findUnique({
          where: { playerId },
          select: {
            tianjiTalisman: true,
            dailyIntelFreeUsed: true,
            dailyIntelTalismanUsed: true,
            dailyIntelDateKey: true,
          },
        }),
        client.playerSpiritCodex.findMany({
          where: { playerId },
          select: {
            spiritDefinition: { select: { spiritId: true } },
            shardCount: true,
            readyToCompose: true,
            ownedCurrent: true,
            ownedEver: true,
          },
        }),
      ]);

      if (!target) {
        throw new BusinessError({
          code: ErrorCode.RaidTargetNotFound,
          message: 'Raid target not found or expired.',
          statusCode: 404,
        });
      }

      if (!resource) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Player spirit resource not found.',
          statusCode: 404,
        });
      }

      const dateKey = getLocalDateKey();
      const freeUsed = resource.dailyIntelDateKey === dateKey ? resource.dailyIntelFreeUsed : 0;
      const talismanUsed = resource.dailyIntelDateKey === dateKey ? resource.dailyIntelTalismanUsed : 0;
      let nextFreeUsed = freeUsed;
      let nextTalismanUsed = talismanUsed;
      let shouldConsumeTalisman = false;

      if (freeUsed < RAID_INTEL_FREE_LIMIT) {
        nextFreeUsed += 1;
      } else {
        if (talismanUsed >= RAID_INTEL_TALISMAN_LIMIT) {
          throw new BusinessError({
            code: ErrorCode.Conflict,
            message: 'Daily deep intel limit reached.',
            statusCode: 409,
          });
        }

        if (resource.tianjiTalisman <= 0) {
          throw new BusinessError({
            code: ErrorCode.Conflict,
            message: 'Insufficient Tianji talisman.',
            statusCode: 409,
          });
        }

        nextTalismanUsed += 1;
        shouldConsumeTalisman = true;
      }

      await client.playerSpiritResource.update({
        where: { playerId },
        data: {
          dailyIntelFreeUsed: nextFreeUsed,
          dailyIntelTalismanUsed: nextTalismanUsed,
          dailyIntelDateKey: dateKey,
          tianjiTalisman: shouldConsumeTalisman ? { decrement: 1 } : undefined,
          resourceVersion: { increment: 1 },
        },
      });

      const mainSlot = target?.targetPlayer.spiritSlots[0] ?? null;
      let sceneVisibility: ClientSceneVisibility = 'masked';
      const spiritId = mainSlot?.spiritDefinition?.spiritId;
      if (spiritId) {
        const entry = codex.find(e => e.spiritDefinition?.spiritId === spiritId);
        sceneVisibility = resolveSpiritSceneVisibility(entry);
      }

      return buildRaidDeepIntelResponse(target, targetId, {
        remainingFreeIntel: Math.max(RAID_INTEL_FREE_LIMIT - nextFreeUsed, 0),
        remainingTalismanIntel: Math.max(RAID_INTEL_TALISMAN_LIMIT - nextTalismanUsed, 0),
      }, sceneVisibility);
    });
  }

  private async getIntelQuota(playerId: string): Promise<{ remainingFreeIntel: number; remainingTalismanIntel: number }> {
    const resource = await this.prisma.db.playerSpiritResource.findUnique({
      where: { playerId },
      select: {
        dailyIntelFreeUsed: true,
        dailyIntelTalismanUsed: true,
        dailyIntelDateKey: true,
      },
    });

    const dateKey = getLocalDateKey();
    const freeUsed = resource?.dailyIntelDateKey === dateKey ? resource.dailyIntelFreeUsed : 0;
    const talismanUsed = resource?.dailyIntelDateKey === dateKey ? resource.dailyIntelTalismanUsed : 0;

    return {
      remainingFreeIntel: Math.max(RAID_INTEL_FREE_LIMIT - freeUsed, 0),
      remainingTalismanIntel: Math.max(RAID_INTEL_TALISMAN_LIMIT - talismanUsed, 0),
    };
  }

  async createRaidOrder(input: {
    playerId: string;
    targetId: string;
    requestIdempotencyKey?: string;
    armyVersion?: number;
    skipReadModel?: boolean;
    skipQueue?: boolean;
    now?: Date;
  }): Promise<ClientRaidActionResponse> {
    const requestIdempotencyKey = input.requestIdempotencyKey?.trim();
    const now = input.now ?? new Date();

    if (!requestIdempotencyKey) {
      throw new BusinessError({
        code: ErrorCode.BadRequest,
        message: 'requestIdempotencyKey is required for raid-target.',
        statusCode: 400,
      });
    }

    let target = await this.raidRepository.findVisibleTargetPoolEntry({
      ownerPlayerId: input.playerId,
      targetPoolId: input.targetId,
      now,
    });

    if (!target) {
      throw new BusinessError({
        code: ErrorCode.RaidTargetNotFound,
        message: 'Raid target not found or expired.',
        statusCode: 404,
      });
    }

    if (target.targetPlayer.protectedUntil && target.targetPlayer.protectedUntil.getTime() > now.getTime()) {
      throw new BusinessError({
        code: ErrorCode.RaidNotAllowed,
        message: 'Target is under raid protection.',
        statusCode: 409,
      });
    }

    const response = await this.prisma.transaction(async (client) => {
      const currentArmy = await client.playerArmy.findUnique({
        where: { playerId: input.playerId },
        select: {
          availableCount: true,
          frozenCount: true,
          armyVersion: true,
        },
      });

      if (currentArmy && typeof input.armyVersion === 'number' && input.armyVersion !== currentArmy.armyVersion) {
        throw new BusinessError({
          code: ErrorCode.StateVersionConflict,
          message: 'armyVersion conflict.',
          statusCode: 409,
          details: { expected: input.armyVersion, actual: currentArmy.armyVersion },
        });
      }

      const existingOrder = await client.raidOrder.findUnique({
        where: { requestIdempotencyKey },
        include: {
          settlement: true,
        },
      });

      if (existingOrder) {
        const [home, scenes] = input.skipReadModel
          ? [undefined, undefined]
          : await Promise.all([
            this.clientReadService.getHomeSummary(input.playerId, client),
            this.clientReadService.getSceneContent(input.playerId, client),
          ]);

        return buildRaidActionResponse(existingOrder.id, existingOrder.settleAt, target, existingOrder.status, home, scenes);
      }

      const targetInTransaction = await this.raidRepository.findVisibleTargetPoolEntry({
        ownerPlayerId: input.playerId,
        targetPoolId: input.targetId,
        now,
      }, client);

      if (!targetInTransaction) {
        throw new BusinessError({
          code: ErrorCode.RaidTargetNotFound,
          message: 'Raid target not found or expired.',
          statusCode: 404,
        });
      }

      const defenderProtectedUntil = new Date(now.getTime() + 60 * 60 * 1000);
      const protectionClaim = await client.player.updateMany({
        where: {
          id: targetInTransaction.targetPlayerId,
          OR: [
            { protectedUntil: null },
            { protectedUntil: { lte: now } },
          ],
        },
        data: { protectedUntil: defenderProtectedUntil },
      });

      if (protectionClaim.count !== 1) {
        throw new BusinessError({
          code: ErrorCode.RaidNotAllowed,
          message: 'Target is under raid protection.',
          statusCode: 409,
        });
      }

      target = targetInTransaction;

      const primaryField = pickPrimaryRaidField(target);
      const attackerMainSpirit = await client.playerSpiritSlot.findFirst({
        where: {
          playerId: input.playerId,
          isMain: true,
          spiritDefinitionId: { not: null },
        },
        select: {
          id: true,
          slotIndex: true,
          level: true,
          element: true,
          currentHp: true,
          maxHp: true,
          status: true,
          spiritDefinition: {
            select: {
              id: true,
              spiritId: true,
              label: true,
              rarity: true,
              factionAffinity: true,
              role: true,
              baseAttack: true,
              baseHp: true,
              growthAttack: true,
              growthHp: true,
            },
          },
          traits: {
            select: {
              traitCode: true,
              traitValue: true,
            },
          },
        },
      });

      if (!attackerMainSpirit?.spiritDefinition) {
        throw new BusinessError({
          code: ErrorCode.RaidNotAllowed,
          message: '当前没有可出战的主位灵宠。请先设置主位灵宠后再发起掠夺。',
          statusCode: 409,
        });
      }

      if (false) {
        throw new BusinessError({
          code: ErrorCode.RaidNotAllowed,
          message: '主位灵宠当前 0 血，无法出战。请先恢复血量，或更换主位灵宠后再发起掠夺。',
          statusCode: 409,
        });
      }

      const defenderMainSpirit = target.targetPlayer.spiritSlots[0] ?? null;
      const [attackerVisibilityForDefender, defenderVisibilityForAttacker] = await Promise.all([
        attackerMainSpirit.spiritDefinition.spiritId
          ? client.playerSpiritCodex.findFirst({
            where: {
              playerId: target.targetPlayerId,
              spiritDefinition: {
                spiritId: attackerMainSpirit.spiritDefinition.spiritId,
              },
            },
            select: {
              shardCount: true,
              readyToCompose: true,
              ownedCurrent: true,
              ownedEver: true,
            },
          })
          : null,
        defenderMainSpirit?.spiritDefinition?.spiritId
          ? client.playerSpiritCodex.findFirst({
            where: {
              playerId: input.playerId,
              spiritDefinition: {
                spiritId: defenderMainSpirit.spiritDefinition.spiritId,
              },
            },
            select: {
              shardCount: true,
              readyToCompose: true,
              ownedCurrent: true,
              ownedEver: true,
            },
          })
          : null,
      ]);

      const nextDispatchedCount = 1;
      const settleAt = now;
      const frozenUnitSnapshot = { dispatchedCount: nextDispatchedCount };
      const lockedGold = resolveLockedGold(target, primaryField);
      const raidOrder = await this.raidRepository.createRaidOrder({
        attacker: { connect: { id: input.playerId } },
        defender: { connect: { id: target.targetPlayerId } },
        defenderFieldSlot: primaryField
          ? { connect: { id: primaryField.id } }
          : undefined,
        mode: 'SINGLE',
        status: 'LOCKED',
        dispatchedUnitCount: nextDispatchedCount,
        frozenUnitSnapshot,
        transportCapacitySnapshot: nextDispatchedCount * 10,
        attackerSnapshotJson: {
          playerId: input.playerId,
          availableCount: currentArmy?.availableCount ?? 0,
          frozenCount: currentArmy?.frozenCount ?? 0,
          mainSpirit: buildSpiritBattleSnapshot(attackerMainSpirit),
          mainSpiritSceneVisibilityForDefender: resolveSpiritSceneVisibility(attackerVisibilityForDefender),
        },
        defenderSnapshotJson: {
          targetId: target.id,
          targetPlayerId: target.targetPlayerId,
          targetSnapshotJson: target.targetSnapshotJson,
          fieldSnapshotJson: target.fieldSnapshotJson,
          riskSnapshotJson: target.riskSnapshotJson,
          mainSpirit: buildSpiritBattleSnapshot(defenderMainSpirit),
          mainSpiritSceneVisibilityForAttacker: resolveSpiritSceneVisibility(defenderVisibilityForAttacker),
        },
        dispatchedAt: now,
        settleAt,
        requestIdempotencyKey,
        sourceTargetPool: { connect: { id: target.id } },
      }, client);

      if (currentArmy) {
        await client.playerArmy.update({
          where: { playerId: input.playerId },
          data: {
            armyVersion: { increment: 1 },
          },
        });
      }

      await this.raidRepository.createRaidAssetLock({
        raidOrder: { connect: { id: raidOrder.id } },
        defenderPlayer: { connect: { id: target.targetPlayerId } },
        sourceFieldSlot: primaryField
          ? { connect: { id: primaryField.id } }
          : undefined,
        assetType: 'gold',
        sourceEntityId: primaryField?.id ?? target.id,
        lockedGold,
        lockedItemJson: target.fieldSnapshotJson ?? undefined,
        lockMode: 'HARD',
        status: 'ACTIVE',
        expiresAt: target.expiresAt,
      }, client);

      const [home, scenes] = input.skipReadModel
        ? [undefined, undefined]
        : await Promise.all([
          this.clientReadService.getHomeSummary(input.playerId, client, now),
          this.clientReadService.getSceneContent(input.playerId, client, now),
        ]);

      return buildRaidActionResponse(raidOrder.id, settleAt, target, raidOrder.status, home, scenes);
    });

    if (!input.skipQueue) {
      try {
        await this.raidSettlementQueueService.enqueueRaidSettlement({
          raidOrderId: response.result.orderId ?? '',
          settleAt: response.result.settleAt ? new Date(response.result.settleAt) : new Date(),
        });
      } catch {
        // The durable order remains queryable by settleAt/status; TW-BE-017 worker can scan and backfill.
      }
    }

    if (response.result.orderId) {
      try {
        const settlement = await this.raidSettlementService.settleRaidOrder(response.result.orderId, now);
        await this.prisma.db.raidTargetPool.updateMany({
          where: {
            id: input.targetId,
            ownerPlayerId: input.playerId,
          },
          data: {
            expiresAt: now,
          },
        });
        const orderPromise = this.prisma.db.raidOrder.findUnique({
            where: { id: response.result.orderId },
            select: {
              id: true,
              attackerSnapshotJson: true,
              defenderSnapshotJson: true,
              attacker: { select: { nickname: true } },
              defender: {
                select: {
                  nickname: true,
                  protectedUntil: true,
                },
              },
            },
          });

        if (input.skipReadModel) {
          const order = await orderPromise;
          const home = {} as Awaited<ReturnType<ClientReadService['getHomeSummary']>>;
          const scenes = {} as Awaited<ReturnType<ClientReadService['getSceneContent']>>;
          return buildSettledRaidActionResponse(response.result.orderId, settlement, order, order?.defender.nickname ?? response.result.targetName, order?.defender.protectedUntil ?? null, home, scenes);
        }

        const [home, scenes, order] = await Promise.all([
          this.clientReadService.getHomeSummary(input.playerId, undefined, now),
          this.clientReadService.getSceneContent(input.playerId, undefined, now),
          orderPromise,
        ]);

        return buildSettledRaidActionResponse(response.result.orderId, settlement, order, order?.defender.nickname ?? response.result.targetName, order?.defender.protectedUntil ?? null, home, scenes);
      } catch (error) {
        if (error instanceof BusinessError) {
          throw error;
        }

        throw new BusinessError({
          code: ErrorCode.Conflict,
          message: 'Raid settlement failed. Please try again after refreshing raid targets.',
          statusCode: 409,
        });
      }
    }

    return response;
  }

  async createRaidOrderMessage(input: {
    playerId: string;
    raidOrderId: string;
    messageTemplateId: string;
  }): Promise<ClientRaidOrderMessageResponse> {
    const templateId = input.messageTemplateId.trim();

    if (!templateId) {
      throw new BusinessError({
        code: ErrorCode.BadRequest,
        message: 'messageTemplateId is required.',
        statusCode: 400,
      });
    }

    const result = await this.prisma.transaction(async (client) => {
      const [raidOrder, template] = await Promise.all([
        client.raidOrder.findUnique({
          where: { id: input.raidOrderId },
          select: {
            id: true,
            attackerPlayerId: true,
            defenderPlayerId: true,
            status: true,
            raidMessage: true,
          },
        }),
        client.raidMessageTemplate.findUnique({
          where: { templateId },
          select: {
            templateId: true,
            text: true,
            isActive: true,
          },
        }),
      ]);

      if (!raidOrder) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Raid order not found.',
          statusCode: 404,
        });
      }

      if (raidOrder.attackerPlayerId !== input.playerId) {
        throw new BusinessError({
          code: ErrorCode.RaidNotAllowed,
          message: 'Only the attacker can leave a raid message.',
          statusCode: 403,
        });
      }

      if (raidOrder.status !== 'SETTLED') {
        throw new BusinessError({
          code: ErrorCode.RaidNotAllowed,
          message: 'Raid message can only be added after settlement.',
          statusCode: 409,
        });
      }

      if (raidOrder.raidMessage) {
        throw new BusinessError({
          code: ErrorCode.RaidNotAllowed,
          message: 'Raid order message already exists.',
          statusCode: 409,
        });
      }

      if (!template || !template.isActive) {
        throw new BusinessError({
          code: ErrorCode.BadRequest,
          message: 'Raid message template is not available.',
          statusCode: 400,
        });
      }

      return client.raidOrderMessage.create({
        data: {
          raidOrderId: raidOrder.id,
          authorPlayerId: raidOrder.attackerPlayerId,
          receiverPlayerId: raidOrder.defenderPlayerId,
          templateId: template.templateId,
          textSnapshot: template.text,
        },
      });
    });

    return {
      app: APP_NAME,
      summary: 'Raid message saved.',
      raidMessage: {
        messageTemplateId: result.templateId,
        messageEmojiId: null,
        messageTextSnapshot: result.textSnapshot,
      },
      templates: await this.getRaidMessageTemplates(),
    };
  }

  async getRaidMessageTemplates(): Promise<ClientRaidMessageTemplate[]> {
    return this.prisma.db.raidMessageTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      take: 5,
      select: {
        templateId: true,
        text: true,
      },
    });
  }

  async getRaidBattleReplay(input: {
    playerId: string;
    raidOrderId: string;
  }): Promise<ClientRaidBattleReplayResponse> {
    const raidOrderId = input.raidOrderId.trim();
    if (!raidOrderId) {
      throw new BusinessError({
        code: ErrorCode.BadRequest,
        message: 'raidOrderId is required.',
        statusCode: 400,
      });
    }

    const order = await this.prisma.db.raidOrder.findFirst({
      where: {
        id: raidOrderId,
        OR: [
          { attackerPlayerId: input.playerId },
          { defenderPlayerId: input.playerId },
        ],
      },
      select: {
        attackerPlayerId: true,
        defenderPlayerId: true,
        attackerSnapshotJson: true,
        defenderSnapshotJson: true,
        attacker: {
          select: {
            nickname: true,
          },
        },
        defender: {
          select: {
            nickname: true,
          },
        },
        settlement: {
          select: {
            battleReplayJson: true,
            result: true,
            lootGold: true,
            attackerLoss: true,
            defenderLoss: true,
            reportSummary: true,
            rewardItemsJson: true,
          },
        },
      },
    });

    const replay = order?.settlement
      ? buildRaidBattleReplay(
        raidOrderId,
        {
          result: order.settlement.result,
          lootGold: order.settlement.lootGold,
          attackerLoss: order.settlement.attackerLoss,
          defenderLoss: order.settlement.defenderLoss,
          reportSummary: order.settlement.reportSummary,
          rewardItemsJson: order.settlement.rewardItemsJson,
        },
        {
          attackerSnapshotJson: order.attackerSnapshotJson,
          defenderSnapshotJson: order.defenderSnapshotJson,
          attacker: { nickname: order.attacker.nickname },
          defender: { nickname: order.defender.nickname },
        },
        order.attackerPlayerId === input.playerId ? 'attacker' : 'defender',
      )
      : parseRaidBattleReplay(order?.settlement?.battleReplayJson);
    if (!order || !replay) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Raid battle replay not found.',
        statusCode: 404,
      });
    }

    return {
      app: APP_NAME,
      replay,
    };
  }
}

function buildRaidTargetDetailResponse(
  target: Awaited<ReturnType<RaidRepository['findVisibleTargetPoolEntry']>>,
  targetId: string,
  intelQuota: {
    remainingFreeIntel: number;
    remainingTalismanIntel: number;
  },
  sceneVisibility: ClientSceneVisibility = 'masked',
): ClientRaidTargetDetailResponse {
  const targetSnapshot = target?.targetSnapshotJson as {
    name?: string;
    faction?: string;
    level?: number;
    combatPower?: number;
    raidableGold?: number;
    exposedFruit?: string;
    raidRule?: string;
    defenseStatus?: string;
    protectionStatus?: string;
    detail?: string;
    tutorialTarget?: boolean;
  } | null;
  const mainPetPreview = buildRaidSpiritPreview(target?.targetPlayer.spiritSlots[0] ?? null, sceneVisibility);
  const fields = target?.targetPlayer.fieldSlots.map((field) => ({
    id: field.id,
    fieldVersion: undefined,
    code: `田地 ${String(field.slotIndex).padStart(2, '0')}`,
    title: field.seedDefinition?.label ?? (field.status === 'EMPTY' ? '空地' : '未解锁'),
    badge: mapFieldStatusBadge(field.status),
    cropName: field.seedDefinition?.label,
    tone: mapFieldStatusTone(field.status),
    progressRemainingSeconds: 0,
    progressTotalSeconds: 1,
    yieldGold: field.currentClaimableGold,
    description: `${mapFieldStatusBadge(field.status)} · 当前暴露 ${field.currentClaimableGold} 金币`,
    actions: [],
  })) ?? [];

  return {
    app: APP_NAME,
    targetId,
    name: targetSnapshot?.name ?? '未知目标',
    faction: targetSnapshot?.faction ?? target?.targetPlayer.faction?.name ?? '未知阵营',
    level: targetSnapshot?.level ?? target?.targetPlayer.castleLevelCache ?? 1,
    tutorialTarget: targetSnapshot?.tutorialTarget === true,
    combatPower: String(targetSnapshot?.combatPower ?? 0),
    fieldPreviewTone: 'growing',
    fieldStatus: '目标已接入真实目标池',
    fields,
    targetFarmBoardMessage: target?.targetPlayer.farmBoard?.hiddenAt ? '' : target?.targetPlayer.farmBoard?.message ?? '',
    raidableGold: `${targetSnapshot?.raidableGold ?? 0} 金币`,
    exposedFruit: targetSnapshot?.exposedFruit ?? '暂无',
    raidRule: targetSnapshot?.raidRule ?? '已接入真实目标池。',
    defenseStatus: targetSnapshot?.defenseStatus ?? '等待结算',
    protectionStatus: targetSnapshot?.protectionStatus ?? '可发起掠夺',
    mainPetPreview,
    remainingFreeIntel: intelQuota.remainingFreeIntel,
    remainingTalismanIntel: intelQuota.remainingTalismanIntel,
    detail: targetSnapshot?.detail ?? '真实 raid 目标详情。',
    actions: [{ label: '发起掠夺', target: 'report', tone: 'primary' }],
  };
}

function buildRaidDeepIntelResponse(
  target: Awaited<ReturnType<RaidRepository['findVisibleTargetPoolEntry']>>,
  targetId: string,
  remaining: {
    remainingFreeIntel: number;
    remainingTalismanIntel: number;
  },
  sceneVisibility: ClientSceneVisibility = 'masked',
): ClientRaidDeepIntelResponse {
  const mainSlot = target?.targetPlayer.spiritSlots[0] ?? null;

  return {
    app: APP_NAME,
    targetId,
    mainPetPreview: buildRaidSpiritPreview(mainSlot, sceneVisibility),
    intel: {
      element: mapSpiritElement(mainSlot?.element ?? null),
      attackRating: buildAttackRating(mainSlot),
      healthStatus: mainSlot ? '状态良好' : '未知',
      remainingFreeIntel: remaining.remainingFreeIntel,
      remainingTalismanIntel: remaining.remainingTalismanIntel,
    },
  };
}

function buildRaidActionResponse(
  orderId: string,
  settleAt: Date,
  target: Awaited<ReturnType<RaidRepository['findVisibleTargetPoolEntry']>>,
  status: string,
  home?: Awaited<ReturnType<ClientReadService['getHomeSummary']>>,
  scenes?: Awaited<ReturnType<ClientReadService['getSceneContent']>>,
): ClientRaidActionResponse {
  const targetSnapshot = target?.targetSnapshotJson as { name?: string; raidableGold?: number } | null;

  return {
    app: APP_NAME,
    summary: '掠夺订单已创建，等待异步结算。',
    home: home ?? ({} as Awaited<ReturnType<ClientReadService['getHomeSummary']>>),
    scenes: scenes ?? ({} as Awaited<ReturnType<ClientReadService['getSceneContent']>>),
    result: {
      orderId,
      settlementStatus: mapRaidOrderStatus(status),
      settleAt: settleAt.toISOString(),
      targetId: target?.id ?? '',
      targetName: targetSnapshot?.name ?? '未知目标',
      goldLoot: 0,
      depositedGold: 0,
      overflowGold: 0,
      temporaryClaimExpiresAt: null,
      casualties: 0,
      rewards: [],
      codexPrompts: [],
      protectedUntil: target?.expiresAt.toISOString() ?? new Date().toISOString(),
      reportSummary: '已进入异步结算队列。',
    },
  };
}

function buildSettledRaidActionResponse(
  orderId: string,
  settlement: {
    result: string;
    lootGold: number;
    depositedGold: number;
    overflowGold: number;
    temporaryClaimExpiresAt: Date | null;
    rewardItemsJson: unknown;
    attackerLoss: number;
    defenderLoss: number;
    reportSummary: string;
    battleReplayJson?: unknown;
  },
  order: {
    attackerSnapshotJson: unknown;
    defenderSnapshotJson: unknown;
    attacker: { nickname: string };
    defender: { nickname: string };
  } | null,
  targetName: string,
  protectedUntil: Date | null,
  home: Awaited<ReturnType<ClientReadService['getHomeSummary']>>,
  scenes: Awaited<ReturnType<ClientReadService['getSceneContent']>>,
): ClientRaidActionResponse {
  const rewards = normalizeRaidRewards(settlement.rewardItemsJson);
  const battleEvents = normalizeRaidBattleEvents(settlement.rewardItemsJson);
  const codexPrompts = normalizeCodexPrompts(settlement.rewardItemsJson);
  const battleReplay = order
    ? buildRaidBattleReplay(orderId, {
      result: settlement.result,
      lootGold: settlement.lootGold,
      attackerLoss: settlement.attackerLoss,
      defenderLoss: settlement.defenderLoss,
      reportSummary: settlement.reportSummary,
      rewardItemsJson: settlement.rewardItemsJson,
    }, {
      attackerSnapshotJson: order.attackerSnapshotJson,
      defenderSnapshotJson: order.defenderSnapshotJson,
      attacker: { nickname: order.attacker.nickname },
      defender: { nickname: order.defender.nickname },
    }, 'attacker')
    : parseRaidBattleReplay(settlement.battleReplayJson);

  return {
    app: APP_NAME,
    summary: settlement.reportSummary,
    home,
    scenes,
    result: {
      orderId,
      settlementStatus: 'settled',
      settleAt: new Date().toISOString(),
      targetId: '',
      targetName,
      goldLoot: settlement.lootGold,
      depositedGold: settlement.depositedGold,
      overflowGold: settlement.overflowGold,
      temporaryClaimExpiresAt: settlement.temporaryClaimExpiresAt?.toISOString() ?? null,
      casualties: 0,
      rewards,
      codexPrompts,
      battleEvents,
      battleReplay,
      protectedUntil: protectedUntil?.toISOString() ?? new Date().toISOString(),
      reportSummary: settlement.reportSummary,
    },
  };
}

function normalizeRaidRewards(value: unknown): ClientRaidRewardItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => item as { type?: string; seedId?: string; spiritId?: string; label?: string; quantity?: number })
    .filter((item) => item.type !== 'battleEvent' && typeof item.label === 'string' && typeof item.quantity === 'number')
    .map((item) => ({
      seedId: item.seedId ?? item.spiritId ?? item.type ?? 'raid-reward',
      label: item.label ?? '奖励',
      quantity: Math.max(Math.floor(item.quantity ?? 0), 0),
    }))
    .filter((item) => item.quantity > 0);
}

function normalizeCodexPrompts(value: unknown): NonNullable<ClientRaidActionResponse['result']['codexPrompts']> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => item as {
      type?: string;
      promptType?: string;
      subjectId?: string;
      label?: string;
      message?: string;
      current?: number;
      required?: number;
    })
    .filter((item) => (
      item.type === 'codexPrompt'
      && (
        item.promptType === 'spirit-codex-visible'
        || item.promptType === 'spirit-compose-ready'
        || item.promptType === 'plant-discovered'
        || item.promptType === 'plant-unlocked'
      )
    ))
    .filter((item) => typeof item.subjectId === 'string' && typeof item.label === 'string' && typeof item.message === 'string')
    .map((item) => ({
      type: item.promptType as NonNullable<ClientRaidActionResponse['result']['codexPrompts']>[number]['type'],
      subjectId: item.subjectId ?? '',
      label: item.label ?? '',
      message: item.message ?? '',
      current: typeof item.current === 'number' ? item.current : undefined,
      required: typeof item.required === 'number' ? item.required : undefined,
    }));
}

function normalizeRaidBattleEvents(value: unknown): NonNullable<ClientRaidActionResponse['result']['battleEvents']> {
  if (!Array.isArray(value)) {
    return [];
  }

  const supportedTypes = new Set<ClientRaidBattleEvent['type']>(['dodge', 'execute', 'element', 'critical', 'lifesteal', 'counter', 'damage', 'soul-drop', 'status']);

  return value
    .map((item) => item as { type?: string; label?: string; description?: string })
    .filter((item) => item.type === 'battleEvent' && typeof item.label === 'string' && typeof item.description === 'string')
    .map((item) => ({
      type: supportedTypes.has(item.type as ClientRaidBattleEvent['type']) ? item.type as ClientRaidBattleEvent['type'] : 'damage',
      label: item.label ?? '',
      description: item.description ?? '',
    }));
}

function mapFieldStatusBadge(status: string): string {
  if (status === 'LOCKED') {
    return '锁定';
  }

  if (status === 'EMPTY') {
    return '空闲';
  }

  if (status === 'GROWING') {
    return '成长';
  }

  if (status === 'MATURE') {
    return '成熟';
  }

  return '枯萎';
}

function mapFieldStatusTone(status: string): 'growing' | 'mature' | 'withered' | 'empty' | 'locked' {
  if (status === 'LOCKED') {
    return 'locked';
  }

  if (status === 'EMPTY') {
    return 'empty';
  }

  if (status === 'GROWING') {
    return 'growing';
  }

  if (status === 'MATURE') {
    return 'mature';
  }

  return 'withered';
}

function mapRaidOrderStatus(status: string): 'queued' | 'settling' | 'settled' | 'failed' {
  if (status === 'SETTLED') {
    return 'settled';
  }

  if (status === 'SETTLEMENT_FAILED') {
    return 'failed';
  }

  if (status === 'LOCKED' || status === 'SETTLING') {
    return 'settling';
  }

  return 'queued';
}

function buildRaidSpiritPreview(
  slot: {
    level: number;
    spiritDefinition: {
      spiritId: string;
      label: string;
      rarity: string;
    } | null;
  } | null,
  sceneVisibility: ClientSceneVisibility = 'masked',
): ClientRaidSpiritPreview | null {
  if (!slot?.spiritDefinition) {
    return null;
  }
  if (sceneVisibility === 'masked') {
    return {
      spiritId: null,
      sceneVisibility,
      displayName: '？？',
      label: '？？',
      level: Math.max(slot.level, 1),
      rarity: null,
      avatarGlyph: 'unknown',
    };
  }
  return {
    spiritId: slot.spiritDefinition.spiritId,
    sceneVisibility,
    displayName: slot.spiritDefinition.label,
    label: slot.spiritDefinition.label,
    level: Math.max(slot.level, 1),
    rarity: mapSpiritRarity(slot.spiritDefinition.rarity),
    avatarGlyph: getSpiritGlyph(slot.spiritDefinition.label),
  };
}

function buildSpiritBattleSnapshot(
  slot: {
    id: string;
    slotIndex: number;
    level: number;
    element: string | null;
    currentHp: number;
    maxHp: number;
    status: string;
    spiritDefinition: {
      id: string;
      spiritId: string;
      label: string;
      rarity: string;
      factionAffinity: string;
      role: string;
      baseAttack: number;
      baseHp: number;
      growthAttack: number;
      growthHp: number;
    } | null;
    traits?: Array<{
      traitCode: string;
      traitValue: number;
    }>;
  } | null,
) {
  if (!slot?.spiritDefinition) {
    return null;
  }

  return {
    slotId: slot.id,
    slotIndex: slot.slotIndex,
    level: slot.level,
    element: slot.element,
    currentHp: slot.maxHp,
    maxHp: slot.maxHp,
    status: 'ACTIVE',
    spiritDefinition: slot.spiritDefinition,
    traits: slot.traits ?? [],
  };
}

function resolveSpiritSceneVisibility(entry: {
  shardCount: number;
  readyToCompose: boolean;
  ownedCurrent: boolean;
  ownedEver: boolean;
} | null | undefined): ClientSceneVisibility {
  return resolveSpiritCodexState(entry) === 'hidden' ? 'masked' : 'named';
}

function resolveSpiritCodexState(entry: {
  shardCount: number;
  readyToCompose: boolean;
  ownedCurrent: boolean;
  ownedEver: boolean;
} | null | undefined): ClientCodexState {
  if (!entry) {
    return 'hidden';
  }

  if (entry.ownedCurrent || entry.ownedEver || entry.readyToCompose) {
    return 'unlocked';
  }

  if (entry.shardCount > 0) {
    return 'visible-progress';
  }

  return 'hidden';
}

function mapSpiritRarity(rarity: string): ClientRaidSpiritPreview['rarity'] {
  if (rarity === 'RARE') {
    return 'rare';
  }

  if (rarity === 'LEGENDARY') {
    return 'legendary';
  }

  if (rarity === 'COMMON') {
    return 'common';
  }

  return null;
}

function mapSpiritElement(element: string | null): ClientRaidDeepIntelResponse['intel']['element'] {
  if (element === 'METAL') {
    return 'metal';
  }

  if (element === 'WOOD') {
    return 'wood';
  }

  if (element === 'WATER') {
    return 'water';
  }

  if (element === 'FIRE') {
    return 'fire';
  }

  if (element === 'EARTH') {
    return 'earth';
  }

  return null;
}

function getSpiritGlyph(label: string): string {
  const firstCharacter = Array.from(label.trim())[0];
  return firstCharacter ?? '灵';
}

function buildAttackRating(
  slot: {
    level: number;
    spiritDefinition: {
      baseAttack: number;
      growthAttack: number;
    } | null;
  } | null,
): string {
  const score = slot?.spiritDefinition
    ? slot.spiritDefinition.baseAttack + Math.max(slot.level - 1, 0) * slot.spiritDefinition.growthAttack
    : 0;

  return mapScoreRating(score);
}

function mapScoreRating(score: number): string {
  if (score >= 170) {
    return 'S';
  }

  if (score >= 130) {
    return 'A';
  }

  if (score >= 90) {
    return 'B';
  }

  if (score > 0) {
    return 'C';
  }

  return '未知';
}

function buildHealthStatus(slot: { currentHp: number; maxHp: number; status: string } | null): string {
  if (!slot || slot.maxHp <= 0) {
    return '未知';
  }

  if (slot.status === 'WOUNDED') {
    return '受伤';
  }

  if (slot.status === 'RESTING') {
    return '休整';
  }

  const ratio = slot.currentHp / slot.maxHp;

  if (ratio >= 0.8) {
    return '状态良好';
  }

  if (ratio >= 0.45) {
    return '轻伤';
  }

  return '重伤';
}

function pickPrimaryRaidField(target: NonNullable<Awaited<ReturnType<RaidRepository['findVisibleTargetPoolEntry']>>>) {
  const candidateFields = target.targetPlayer.fieldSlots.filter(
    (field) => field.isUnlocked && field.currentClaimableGold > 0,
  );

  if (candidateFields.length <= 0) {
    return null;
  }

  candidateFields.sort((left, right) => {
    if (right.currentClaimableGold !== left.currentClaimableGold) {
      return right.currentClaimableGold - left.currentClaimableGold;
    }

    return left.slotIndex - right.slotIndex;
  });

  return candidateFields[0] ?? null;
}

function resolveLockedGold(
  target: NonNullable<Awaited<ReturnType<RaidRepository['findVisibleTargetPoolEntry']>>>,
  primaryField: ReturnType<typeof pickPrimaryRaidField>,
): number {
  const snapshotGold = Number((target.targetSnapshotJson as { raidableGold?: number }).raidableGold ?? 0);
  const fieldGold = primaryField?.currentClaimableGold ?? 0;
  const totalFieldGold = target.targetPlayer.fieldSlots.reduce((sum, field) => sum + Math.max(field.currentClaimableGold, 0), 0);
  const vaultGold = Math.max(Number(target.targetPlayer.wallet?.vaultGold ?? 0), 0);
  const walletExposureGold = Math.floor(vaultGold * RAID_WALLET_EXPOSURE_RATIO);

  return Math.max(Math.floor(fieldGold || snapshotGold || totalFieldGold), walletExposureGold, 0);
}
