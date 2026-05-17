import { Inject, Injectable } from '@nestjs/common';
import { APP_NAME, type ClientRaidActionResponse, type ClientRaidTargetDetailResponse } from '@trinitywar/shared';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { ClientReadService } from '../client-read/client-read.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RaidSettlementQueueService } from './raid-settlement-queue.service.js';
import { RaidRepository } from './raid.repository.js';

@Injectable()
export class RaidTargetService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RaidRepository) private readonly raidRepository: RaidRepository,
    @Inject(ClientReadService) private readonly clientReadService: ClientReadService,
    @Inject(RaidSettlementQueueService) private readonly raidSettlementQueueService: RaidSettlementQueueService,
  ) {}

  async getRaidTargetDetail(playerId: string, targetId: string): Promise<ClientRaidTargetDetailResponse> {
    const target = await this.raidRepository.findVisibleTargetPoolEntry({
      ownerPlayerId: playerId,
      targetPoolId: targetId,
    });

    if (!target) {
      throw new BusinessError({
        code: ErrorCode.RaidTargetNotFound,
        message: 'Raid target not found or expired.',
        statusCode: 404,
      });
    }

    return buildRaidTargetDetailResponse(target, targetId);
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

    const target = await this.raidRepository.findVisibleTargetPoolEntry({
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

    const response = await this.prisma.transaction(async (client) => {
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

      const primaryField = pickPrimaryRaidField(target);
      const nextDispatchedCount = Math.max(1, Math.min(currentArmy.availableCount, 10));
      const settleAt = new Date(Date.now() + 2 * 60 * 1000);
      const frozenUnitSnapshot = { dispatchedCount: nextDispatchedCount };
      const lockedGold = Math.max(
        primaryField?.currentClaimableGold
          ?? Number((target.targetSnapshotJson as { raidableGold?: number }).raidableGold ?? 0),
        0,
      );
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
        },
        defenderSnapshotJson: {
          targetId: target.id,
          targetPlayerId: target.targetPlayerId,
          targetSnapshotJson: target.targetSnapshotJson,
          fieldSnapshotJson: target.fieldSnapshotJson,
          riskSnapshotJson: target.riskSnapshotJson,
        },
        dispatchedAt: new Date(),
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

    return response;
  }
}

function buildRaidTargetDetailResponse(
  target: Awaited<ReturnType<RaidRepository['findVisibleTargetPoolEntry']>>,
  targetId: string,
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
    raidableGold: `${targetSnapshot?.raidableGold ?? 0} 金币`,
    exposedFruit: targetSnapshot?.exposedFruit ?? '暂无',
    raidRule: targetSnapshot?.raidRule ?? '已接入真实目标池。',
    defenseStatus: targetSnapshot?.defenseStatus ?? '等待结算',
    protectionStatus: targetSnapshot?.protectionStatus ?? '可发起掠夺',
    detail: targetSnapshot?.detail ?? '真实 raid 目标详情。',
    actions: [{ label: '发起掠夺', target: 'report', tone: 'primary' }],
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
