import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RaidRepository } from './raid.repository.js';
import { RaidSettlementRuleService } from './raid-settlement-rule.service.js';

@Injectable()
export class RaidSettlementService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RaidRepository) private readonly raidRepository: RaidRepository,
    @Inject(RaidSettlementRuleService) private readonly raidSettlementRuleService: RaidSettlementRuleService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  settleRaidOrder(raidOrderId: string) {
    return this.prisma.transaction(async (client) => {
      const raidOrder = await this.raidRepository.findRaidOrderForSettlement(raidOrderId, client);

      if (!raidOrder) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Raid order not found.',
          statusCode: 404,
        });
      }

      if (raidOrder.settlement) {
        return raidOrder.settlement;
      }

      if (raidOrder.status === 'SETTLED') {
        const existingSettlement = await client.raidSettlement.findUnique({
          where: { raidOrderId: raidOrder.id },
        });

        if (existingSettlement) {
          return existingSettlement;
        }
      }

      if (raidOrder.status !== 'LOCKED' && raidOrder.status !== 'SETTLING') {
        throw new BusinessError({
          code: ErrorCode.RaidNotAllowed,
          message: `Raid order cannot be settled from status ${raidOrder.status}.`,
          statusCode: 409,
        });
      }

      if (!raidOrder.attacker.wallet || !raidOrder.attacker.army) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Attacker wallet or army state not found.',
          statusCode: 404,
        });
      }

      await client.raidOrder.update({
        where: { id: raidOrder.id },
        data: { status: 'SETTLING' },
      });

      const lockedGold = raidOrder.assetLocks.reduce((sum, lock) => sum + lock.lockedGold, 0);
      const defenderPower = readDefenderPower(raidOrder.defenderSnapshotJson);
      const attackerAvailableAtDispatch = readAttackerAvailableAtDispatch(raidOrder.attackerSnapshotJson);
      const settlementResult = this.raidSettlementRuleService.calculate({
        lockedGold,
        dispatchedUnitCount: raidOrder.dispatchedUnitCount,
        attackerAvailableAtDispatch,
        defenderSnapshotPower: defenderPower,
        vaultGold: raidOrder.attacker.wallet.vaultGold,
        vaultCapacity: raidOrder.attacker.wallet.vaultCapacity,
      });
      const now = new Date();
      const pendingRaidOverflowExpiresAt = settlementResult.overflowGold > 0
        ? new Date(now.getTime() + 5 * 60 * 1000)
        : raidOrder.attacker.wallet.pendingRaidOverflowExpiresAt;
      const nextVaultGold = raidOrder.attacker.wallet.vaultGold + settlementResult.depositedGold;
      const nextPendingRaidOverflowGold = raidOrder.attacker.wallet.pendingRaidOverflowGold + settlementResult.overflowGold;
      const attackerLoss = Math.min(settlementResult.attackerLoss, raidOrder.dispatchedUnitCount);
      const unitsReturned = Math.max(raidOrder.dispatchedUnitCount - attackerLoss, 0);

      await this.applyDefenderLootConsumption(client, raidOrder, settlementResult.lootGold, now);

      const settlement = await this.raidRepository.createRaidSettlement({
        raidOrder: { connect: { id: raidOrder.id } },
        result: settlementResult.result,
        lootGold: settlementResult.lootGold,
        depositedGold: settlementResult.depositedGold,
        overflowGold: settlementResult.overflowGold,
        temporaryClaimExpiresAt: settlementResult.overflowGold > 0 ? pendingRaidOverflowExpiresAt : null,
        attackerLoss,
        defenderLoss: settlementResult.defenderLoss,
        rewardItemsJson: [],
        reportSummary: settlementResult.reportSummary,
      }, client);

      await client.playerArmy.update({
        where: { playerId: raidOrder.attackerPlayerId },
        data: {
          totalCount: { decrement: attackerLoss },
          availableCount: { increment: unitsReturned },
          frozenCount: { decrement: raidOrder.dispatchedUnitCount },
          armyVersion: { increment: 1 },
        },
      });

      if (settlementResult.depositedGold > 0 || settlementResult.overflowGold > 0) {
        await client.playerWallet.update({
          where: { playerId: raidOrder.attackerPlayerId },
          data: {
            vaultGold: nextVaultGold,
            pendingRaidOverflowGold: nextPendingRaidOverflowGold,
            pendingRaidOverflowExpiresAt,
            balanceVersion: { increment: 1 },
          },
        });
      }

      if (settlementResult.depositedGold > 0) {
        await this.auditService.createWalletChangeLog(client, {
          playerId: raidOrder.attackerPlayerId,
          walletBucket: 'vault',
          changeType: 'raid-settlement',
          deltaGold: settlementResult.depositedGold,
          beforeGold: raidOrder.attacker.wallet.vaultGold,
          afterGold: nextVaultGold,
          relatedEntityType: 'raid-order',
          relatedEntityId: raidOrder.id,
          requestIdempotencyKey: raidOrder.requestIdempotencyKey,
          note: 'Raid settlement deposited loot gold.',
        });
      }

      await client.raidAssetLock.updateMany({
        where: { raidOrderId: raidOrder.id, status: 'ACTIVE' },
        data: { status: settlementResult.lootGold > 0 ? 'CONSUMED' : 'RELEASED' },
      });

      await this.raidRepository.createBattleReports([
        {
          raidOrderId: raidOrder.id,
          ownerPlayerId: raidOrder.attackerPlayerId,
          opponentPlayerId: raidOrder.defenderPlayerId,
          reportType: 'ATTACK',
          result: settlementResult.result,
          title: '掠夺结算',
          summary: settlementResult.reportSummary,
          revengeAvailable: false,
        },
        {
          raidOrderId: raidOrder.id,
          ownerPlayerId: raidOrder.defenderPlayerId,
          opponentPlayerId: raidOrder.attackerPlayerId,
          reportType: 'DEFENSE',
          result: settlementResult.result === 'WIN' ? 'LOSS' : 'WIN',
          title: '遭遇掠夺',
          summary: `${raidOrder.attacker.nickname} 对你发起掠夺，结算结果已生成。`,
          revengeAvailable: true,
        },
      ], client);

      await client.raidOrder.update({
        where: { id: raidOrder.id },
        data: {
          status: 'SETTLED',
          settledAt: now,
        },
      });

      return settlement;
    });
  }

  async settleDueRaidOrders(input: { take?: number } = {}): Promise<{ settled: number; failed: number }> {
    const failedOrders = await this.raidRepository.findDueRaidOrders({
      statuses: ['SETTLEMENT_FAILED'],
      take: input.take ?? 50,
    });

    for (const failedOrder of failedOrders) {
      await this.compensateFailedRaidOrder(failedOrder.id).catch(() => undefined);
    }

    const dueOrders = await this.raidRepository.findDueRaidOrders({
      statuses: ['LOCKED', 'SETTLING'],
      take: input.take ?? 50,
    });
    let settled = 0;
    let failed = 0;

    for (const order of dueOrders) {
      try {
        await this.settleRaidOrder(order.id);
        settled += 1;
      } catch {
        failed += 1;
        await this.prisma.db.raidOrder.update({
          where: { id: order.id },
          data: { status: 'SETTLEMENT_FAILED' },
        }).catch(() => undefined);
        await this.compensateFailedRaidOrder(order.id).catch(() => undefined);
      }
    }

    return { settled, failed };
  }

  private async applyDefenderLootConsumption(
    client: Prisma.TransactionClient,
    raidOrder: NonNullable<Awaited<ReturnType<RaidRepository['findRaidOrderForSettlement']>>>,
    lootGold: number,
    now: Date,
  ): Promise<void> {
    let remainingLoot = Math.max(Math.floor(lootGold), 0);

    if (remainingLoot <= 0) {
      return;
    }

    const deductionPlan = buildDefenderFieldDeductionPlan(raidOrder);
    if (deductionPlan.length <= 0) {
      return;
    }

    const fieldStateMap = new Map(
      (await client.playerFieldSlot.findMany({
        where: {
          playerId: raidOrder.defenderPlayerId,
          id: { in: deductionPlan.map((entry) => entry.fieldId) },
        },
        select: {
          id: true,
          currentClaimableGold: true,
        },
      })).map((field) => [field.id, field]),
    );

    for (const entry of deductionPlan) {
      if (remainingLoot <= 0) {
        break;
      }

      const field = fieldStateMap.get(entry.fieldId);
      if (!field) {
        continue;
      }

      const actualDeduction = Math.min(field.currentClaimableGold, entry.requestedGold, remainingLoot);
      if (actualDeduction <= 0) {
        continue;
      }

      await client.playerFieldSlot.update({
        where: { id: entry.fieldId },
        data: {
          currentClaimableGold: { decrement: actualDeduction },
          raidedGoldTotal: { increment: actualDeduction },
          lastCalculatedAt: now,
        },
      });

      field.currentClaimableGold -= actualDeduction;
      remainingLoot -= actualDeduction;
    }
  }

  private async compensateFailedRaidOrder(raidOrderId: string): Promise<void> {
    await this.prisma.transaction(async (client) => {
      const raidOrder = await this.raidRepository.findRaidOrderForSettlement(raidOrderId, client);

      if (!raidOrder || raidOrder.settlement || !raidOrder.attacker.army) {
        return;
      }

      const activeLocks = raidOrder.assetLocks.filter((lock) => lock.status === 'ACTIVE');
      if (activeLocks.length > 0) {
        await client.raidAssetLock.updateMany({
          where: { raidOrderId: raidOrder.id, status: 'ACTIVE' },
          data: { status: 'RELEASED' },
        });
      }

      const releasableUnits = Math.min(raidOrder.attacker.army.frozenCount, raidOrder.dispatchedUnitCount);
      if (releasableUnits > 0) {
        await client.playerArmy.update({
          where: { playerId: raidOrder.attackerPlayerId },
          data: {
            availableCount: { increment: releasableUnits },
            frozenCount: { decrement: releasableUnits },
            armyVersion: { increment: 1 },
          },
        });
      }
    });
  }
}

interface DefenderFieldDeductionPlanEntry {
  fieldId: string;
  requestedGold: number;
}

function readDefenderPower(value: Prisma.JsonValue): number {
  const snapshot = value as {
    targetSnapshotJson?: {
      combatPower?: number;
    };
  };

  return Number(snapshot.targetSnapshotJson?.combatPower ?? 100);
}

function readAttackerAvailableAtDispatch(value: Prisma.JsonValue): number {
  const snapshot = value as {
    availableCount?: number;
  };

  return Number(snapshot.availableCount ?? 0);
}

function buildDefenderFieldDeductionPlan(
  raidOrder: NonNullable<Awaited<ReturnType<RaidRepository['findRaidOrderForSettlement']>>>,
): DefenderFieldDeductionPlanEntry[] {
  const plan = new Map<string, number>();

  for (const lock of raidOrder.assetLocks) {
    const fallbackFieldId = lock.sourceFieldSlotId ?? raidOrder.defenderFieldSlotId ?? null;
    if (fallbackFieldId) {
      appendFieldDeduction(plan, fallbackFieldId, lock.lockedGold);
      continue;
    }

    const lockedFields = readLockedFieldSnapshots(lock.lockedItemJson);
    let remainingGold = lock.lockedGold;

    for (const field of lockedFields) {
      if (remainingGold <= 0) {
        break;
      }

      const requestedGold = Math.min(field.currentClaimableGold, remainingGold);
      appendFieldDeduction(plan, field.id, requestedGold);
      remainingGold -= requestedGold;
    }
  }

  return Array.from(plan.entries()).map(([fieldId, requestedGold]) => ({ fieldId, requestedGold }));
}

function readLockedFieldSnapshots(value: Prisma.JsonValue | null): Array<{ id: string; currentClaimableGold: number }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => entry as { id?: string; currentClaimableGold?: number })
    .filter((entry): entry is { id: string; currentClaimableGold?: number } => typeof entry.id === 'string' && entry.id.length > 0)
    .map((entry) => ({
      id: entry.id,
      currentClaimableGold: Math.max(Number(entry.currentClaimableGold ?? 0), 0),
    }))
    .sort((left, right) => right.currentClaimableGold - left.currentClaimableGold);
}

function appendFieldDeduction(plan: Map<string, number>, fieldId: string, requestedGold: number): void {
  const normalizedGold = Math.max(Math.floor(requestedGold), 0);
  if (!fieldId || normalizedGold <= 0) {
    return;
  }

  plan.set(fieldId, (plan.get(fieldId) ?? 0) + normalizedGold);
}
