import { Inject, Injectable } from '@nestjs/common';
import {
  APP_NAME,
  type ClientRaidBattleEvent,
  type ClientRaidBattleFloatingTone,
  type ClientRaidBattleReplay,
  type ClientRaidBattleReplayResponse,
  type ClientRaidRewardItem,
  type ClientRaidActionResponse,
  type ClientRaidDeepIntelResponse,
  type ClientRaidMessageTemplate,
  type ClientRaidOrderMessageResponse,
  type ClientRaidSpiritPreview,
  type ClientRaidTargetDetailResponse,
  type ClientSpiritElement,
} from '@trinitywar/shared';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { ClientReadService } from '../client-read/client-read.service.js';
import { getLocalDateKey } from '../lib/date-key.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RaidSettlementQueueService } from './raid-settlement-queue.service.js';
import { RaidSettlementService } from './raid-settlement.service.js';
import { parseRaidBattleReplay } from './raid-battle-replay.js';
import { RaidRepository } from './raid.repository.js';

const RAID_INTEL_FREE_LIMIT = 3;
const RAID_INTEL_TALISMAN_LIMIT = 3;

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
        select: { spiritDefinition: { select: { spiritId: true } }, hasSeen: true },
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
    let hasSeen = false;
    const spiritId = mainSlot?.spiritDefinition?.spiritId;
    if (spiritId) {
      const entry = codex.find(e => e.spiritDefinition?.spiritId === spiritId);
      hasSeen = !!entry?.hasSeen;
    }

    return buildRaidTargetDetailResponse(target, targetId, intelQuota, hasSeen);
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
          select: { spiritDefinition: { select: { spiritId: true } }, hasSeen: true },
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

      // 确保窥探后 hasSeen=true
      const mainSlot = target?.targetPlayer.spiritSlots[0] ?? null;
      const spiritId = mainSlot?.spiritDefinition?.spiritId;
      if (spiritId) {
        const entry = codex.find(e => e.spiritDefinition?.spiritId === spiritId);
        if (entry && !entry.hasSeen) {
          await client.playerSpiritCodex.updateMany({
            where: {
              playerId,
              spiritDefinition: { spiritId },
            },
            data: { hasSeen: true, firstSeenAt: new Date() },
          });
        }
      }

      // deepIntel 一定返回真名
      return buildRaidDeepIntelResponse(target, targetId, {
        remainingFreeIntel: Math.max(RAID_INTEL_FREE_LIMIT - nextFreeUsed, 0),
        remainingTalismanIntel: Math.max(RAID_INTEL_TALISMAN_LIMIT - nextTalismanUsed, 0),
      }, true);
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
  }): Promise<ClientRaidActionResponse> {
    const requestIdempotencyKey = input.requestIdempotencyKey?.trim();

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
    });

    if (!target) {
      throw new BusinessError({
        code: ErrorCode.RaidTargetNotFound,
        message: 'Raid target not found or expired.',
        statusCode: 404,
      });
    }

    if (target.targetPlayer.protectedUntil && target.targetPlayer.protectedUntil.getTime() > Date.now()) {
      throw new BusinessError({
        code: ErrorCode.RaidNotAllowed,
        message: 'Target is under raid protection.',
        statusCode: 409,
      });
    }

    const response = await this.prisma.transaction(async (client) => {
      const now = new Date();
      const currentArmy = await client.playerArmy.findUnique({
        where: { playerId: input.playerId },
        select: {
          availableCount: true,
          frozenCount: true,
          armyVersion: true,
        },
      });

      if (!currentArmy) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Player army state not found.',
          statusCode: 404,
        });
      }

      if (typeof input.armyVersion === 'number' && input.armyVersion !== currentArmy.armyVersion) {
        throw new BusinessError({
          code: ErrorCode.StateVersionConflict,
          message: 'armyVersion conflict.',
          statusCode: 409,
          details: { expected: input.armyVersion, actual: currentArmy.armyVersion },
        });
      }

      if (currentArmy.availableCount <= 0) {
        throw new BusinessError({
          code: ErrorCode.InsufficientArmy,
          message: 'Insufficient army for raid.',
          statusCode: 409,
        });
      }

      const existingOrder = await client.raidOrder.findUnique({
        where: { requestIdempotencyKey },
        include: {
          settlement: true,
        },
      });

      if (existingOrder) {
        const home = await this.clientReadService.getHomeSummary(input.playerId, client);
        const scenes = await this.clientReadService.getSceneContent(input.playerId, client);

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

      if (attackerMainSpirit.currentHp <= 0) {
        throw new BusinessError({
          code: ErrorCode.RaidNotAllowed,
          message: '主位灵宠当前 0 血，无法出战。请先恢复血量，或更换主位灵宠后再发起掠夺。',
          statusCode: 409,
        });
      }

      const nextDispatchedCount = Math.max(1, Math.min(currentArmy.availableCount, 10));
      const settleAt = new Date();
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
          availableCount: currentArmy.availableCount,
          frozenCount: currentArmy.frozenCount,
          mainSpirit: buildSpiritBattleSnapshot(attackerMainSpirit),
        },
        defenderSnapshotJson: {
          targetId: target.id,
          targetPlayerId: target.targetPlayerId,
          targetSnapshotJson: target.targetSnapshotJson,
          fieldSnapshotJson: target.fieldSnapshotJson,
          riskSnapshotJson: target.riskSnapshotJson,
          mainSpirit: buildSpiritBattleSnapshot(target.targetPlayer.spiritSlots[0] ?? null),
        },
        dispatchedAt: now,
        settleAt,
        requestIdempotencyKey,
        sourceTargetPool: { connect: { id: target.id } },
      }, client);

      await client.playerArmy.update({
        where: { playerId: input.playerId },
        data: {
          availableCount: { decrement: nextDispatchedCount },
          frozenCount: { increment: nextDispatchedCount },
          armyVersion: { increment: 1 },
        },
      });

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

      const home = await this.clientReadService.getHomeSummary(input.playerId, client);
      const scenes = await this.clientReadService.getSceneContent(input.playerId, client);

      return buildRaidActionResponse(raidOrder.id, settleAt, target, raidOrder.status, home, scenes);
    });

    try {
      await this.raidSettlementQueueService.enqueueRaidSettlement({
        raidOrderId: response.result.orderId ?? '',
        settleAt: response.result.settleAt ? new Date(response.result.settleAt) : new Date(),
      });
    } catch {
      // The durable order remains queryable by settleAt/status; TW-BE-017 worker can scan and backfill.
    }

    if (response.result.orderId) {
      try {
        const settlement = await this.raidSettlementService.settleRaidOrder(response.result.orderId);
        const [home, scenes, order] = await Promise.all([
          this.clientReadService.getHomeSummary(input.playerId),
          this.clientReadService.getSceneContent(input.playerId),
          this.prisma.db.raidOrder.findUnique({
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
          }),
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
        settlement: {
          select: {
            battleReplayJson: true,
          },
        },
      },
    });

    const replay = parseRaidBattleReplay(order?.settlement?.battleReplayJson);
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
  hasSeen: boolean = false,
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
  } | null;
  const mainPetPreview = buildRaidSpiritPreview(target?.targetPlayer.spiritSlots[0] ?? null, hasSeen);
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
    combatPower: String(targetSnapshot?.combatPower ?? 0),
    fieldPreviewTone: 'seeded',
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
  hasSeen: boolean = true,
): ClientRaidDeepIntelResponse {
  const mainSlot = target?.targetPlayer.spiritSlots[0] ?? null;

  return {
    app: APP_NAME,
    targetId,
    mainPetPreview: buildRaidSpiritPreview(mainSlot, hasSeen),
    intel: {
      element: mapSpiritElement(mainSlot?.element ?? null),
      attackRating: buildAttackRating(mainSlot),
      healthStatus: buildHealthStatus(mainSlot),
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
  const battleReplay = parseRaidBattleReplay(settlement.battleReplayJson)
    ?? (order ? buildRaidBattleReplay(orderId, settlement, order, rewards, battleEvents) : undefined);

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

function buildRaidBattleReplay(
  orderId: string,
  settlement: {
    result: string;
    lootGold: number;
    attackerLoss: number;
    defenderLoss: number;
    reportSummary: string;
  },
  order: {
    attackerSnapshotJson: unknown;
    defenderSnapshotJson: unknown;
    attacker: { nickname: string };
    defender: { nickname: string };
  },
  rewards: ClientRaidRewardItem[],
  battleEvents: ClientRaidBattleEvent[],
): ClientRaidBattleReplay {
  const attackerSpirit = readSpiritSnapshot(order.attackerSnapshotJson);
  const defenderSpirit = readSpiritSnapshot(order.defenderSnapshotJson);
  const attacker = buildBattleUnit('attacker', order.attacker.nickname, attackerSpirit, settlement.attackerLoss);
  const defender = buildBattleUnit('defender', order.defender.nickname, defenderSpirit, settlement.defenderLoss);
  const floatingSteps = battleEvents.slice(0, 4).map((event, index) => ({
    type: 'floatingText' as const,
    side: resolveBattleEventSide(event, index),
    text: event.label,
    tone: resolveBattleEventTone(event),
    durationMs: 520,
  }));

  return {
    orderId,
    result: normalizeBattleResult(settlement.result),
    title: settlement.result === 'WIN' ? '掠夺成功' : settlement.result === 'LOSS' ? '掠夺失利' : '双方相持',
    summary: settlement.reportSummary,
    attacker,
    defender,
    events: battleEvents,
    steps: [
      { type: 'enter', durationMs: 520 },
      { type: 'clash', durationMs: 360 },
      ...floatingSteps,
      { type: 'hpChange', side: 'attacker', from: attacker.hpBefore, to: attacker.hpAfter, max: attacker.maxHp, durationMs: 520 },
      { type: 'hpChange', side: 'defender', from: defender.hpBefore, to: defender.hpAfter, max: defender.maxHp, durationMs: 520 },
      { type: 'return', durationMs: 480 },
      { type: 'result', title: settlement.result === 'WIN' ? '胜利' : settlement.result === 'LOSS' ? '失败' : '平局', summary: settlement.reportSummary, durationMs: 1 },
    ],
    rewardsPreview: {
      goldLoot: settlement.lootGold,
      items: rewards,
    },
  };
}

function readSpiritSnapshot(value: unknown): ReturnType<typeof buildSpiritBattleSnapshot> {
  const snapshot = value as { mainSpirit?: unknown } | null;
  const mainSpirit = snapshot?.mainSpirit as ReturnType<typeof buildSpiritBattleSnapshot>;
  return mainSpirit && typeof mainSpirit === 'object' ? mainSpirit : null;
}

function buildBattleUnit(
  side: 'attacker' | 'defender',
  playerName: string,
  spirit: ReturnType<typeof buildSpiritBattleSnapshot>,
  lossPercent: number,
): ClientRaidBattleReplay['attacker'] {
  const maxHp = Math.max(Math.floor(spirit?.maxHp ?? 120), 1);
  const hpBefore = Math.min(Math.max(Math.floor(spirit?.currentHp ?? maxHp), 0), maxHp);
  const hpAfter = Math.min(Math.max(Math.round(maxHp * (1 - Math.max(lossPercent, 0) / 100)), 0), maxHp);
  const stats = buildBattleStats(spirit);
  const healthStatus = resolveBattleHealthStatus(hpBefore, maxHp);

  return {
    side,
    playerName,
    spiritId: spirit?.spiritDefinition.spiritId ?? null,
    spiritName: spirit?.spiritDefinition.label ?? '守备灵宠',
    rarity: spirit?.spiritDefinition.rarity ?? null,
    element: mapBattleElement(spirit?.element ?? null),
    level: Math.max(Math.floor(spirit?.level ?? 1), 1),
    hpBefore,
    hpAfter,
    maxHp,
    attack: stats.attack,
    healthStatus: healthStatus.code,
    healthStatusLabel: healthStatus.label,
    attackCoefficient: healthStatus.attackCoefficient,
  };
}

function buildBattleStats(spirit: ReturnType<typeof buildSpiritBattleSnapshot>): { attack: number } {
  if (!spirit?.spiritDefinition) {
    return { attack: 50 };
  }

  const levelDelta = Math.max(spirit.level - 1, 0);
  const rarityMultiplier = getRarityGrowthMultiplier(spirit.spiritDefinition.rarity, spirit.level);
  const healthStatus = resolveBattleHealthStatus(spirit.currentHp, spirit.maxHp);
  return {
    attack: Math.round((spirit.spiritDefinition.baseAttack + levelDelta * spirit.spiritDefinition.growthAttack * rarityMultiplier) * healthStatus.attackCoefficient),
  };
}

function resolveBattleHealthStatus(currentHp: number, maxHp: number): {
  code: NonNullable<ClientRaidBattleReplay['attacker']['healthStatus']>;
  label: string;
  attackCoefficient: number;
} {
  const ratio = maxHp > 0 ? currentHp / maxHp : 0;
  if (currentHp <= 0 || ratio <= 0) {
    return { code: 'down', label: '不可出战', attackCoefficient: 0 };
  }
  if (ratio < 0.3) {
    return { code: 'injured', label: '重伤：攻击 30%', attackCoefficient: 0.3 };
  }
  if (ratio < 0.7) {
    return { code: 'low', label: '低迷：攻击 70%', attackCoefficient: 0.7 };
  }
  return { code: 'normal', label: '正常：攻击 100%', attackCoefficient: 1 };
}

function getRarityGrowthMultiplier(rarity: string, level: number): number {
  if (rarity === 'LEGENDARY') return level <= 10 ? 0.9 : level <= 30 ? 1.02 : 1.18;
  if (rarity === 'RARE') return level <= 10 ? 0.96 : level <= 30 ? 1.06 : 1.08;
  return level <= 30 ? 1 : 0.92;
}

function mapBattleElement(element: string | null): ClientSpiritElement | null {
  if (element === 'METAL') return 'metal';
  if (element === 'WOOD') return 'wood';
  if (element === 'WATER') return 'water';
  if (element === 'FIRE') return 'fire';
  if (element === 'EARTH') return 'earth';
  return null;
}

function normalizeBattleResult(result: string): ClientRaidBattleReplay['result'] {
  if (result === 'WIN' || result === 'LOSS' || result === 'DRAW') {
    return result;
  }

  return 'DRAW';
}

function resolveBattleEventTone(event: ClientRaidBattleEvent): ClientRaidBattleFloatingTone {
  if (event.type === 'dodge') return 'miss';
  if (event.type === 'critical') return 'crit';
  if (event.type === 'element' || event.type === 'lifesteal' || event.type === 'counter' || event.type === 'status') return 'buff';
  return 'damage';
}

function resolveBattleEventSide(event: ClientRaidBattleEvent, index: number): 'attacker' | 'defender' {
  if (event.description.includes('防守方') || event.label.includes('防守')) {
    return 'defender';
  }
  if (event.description.includes('进攻方') || event.label.includes('进攻')) {
    return 'attacker';
  }
  return index % 2 === 0 ? 'defender' : 'attacker';
}

function mapFieldStatusBadge(status: string): string {
  if (status === 'LOCKED') {
    return '锁定';
  }

  if (status === 'EMPTY') {
    return '空闲';
  }

  if (status === 'SEEDED') {
    return '播种';
  }

  if (status === 'GROWING') {
    return '成长';
  }

  if (status === 'MATURE') {
    return '成熟';
  }

  return '枯萎';
}

function mapFieldStatusTone(status: string): 'seeded' | 'growing' | 'mature' | 'withered' | 'empty' | 'locked' {
  if (status === 'LOCKED') {
    return 'locked';
  }

  if (status === 'EMPTY') {
    return 'empty';
  }

  if (status === 'SEEDED') {
    return 'seeded';
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
  hasSeen: boolean = false,
): ClientRaidSpiritPreview | null {
  if (!slot?.spiritDefinition) {
    return null;
  }
  if (!hasSeen) {
    return {
      spiritId: null,
      label: '？？',
      level: Math.max(slot.level, 1),
      rarity: null,
      avatarGlyph: 'unknown',
    };
  }
  return {
    spiritId: slot.spiritDefinition.spiritId,
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
    currentHp: slot.currentHp,
    maxHp: slot.maxHp,
    status: slot.status,
    spiritDefinition: slot.spiritDefinition,
    traits: slot.traits ?? [],
  };
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

  return Math.max(Math.floor(fieldGold || snapshotGold || totalFieldGold), 0);
}
