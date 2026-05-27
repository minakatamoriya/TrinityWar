import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { LandDeedService } from '../land-deed/land-deed.service.js';
import { getLocalDateKey } from '../lib/date-key.js';
import { getFactionAdvantageConfig } from '../lib/game-balance.js';
import { applyFactionBattlePostRecovery } from '../lib/faction-advantage-formulas.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildRaidBattleReplay } from './raid-battle-replay.js';
import { RaidRepository } from './raid.repository.js';
import { RaidSettlementRuleService, type SpiritBattleSnapshot } from './raid-settlement-rule.service.js';

const ESSENCE_LOOT_RATIO = 0.08;
const ESSENCE_LOOT_MAX_PER_TYPE = 8;
const ESSENCE_LOOT_PROTECTED_QUANTITY = 10;

@Injectable()
export class RaidSettlementService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RaidRepository) private readonly raidRepository: RaidRepository,
    @Inject(RaidSettlementRuleService) private readonly raidSettlementRuleService: RaidSettlementRuleService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(LandDeedService) private readonly landDeedService: LandDeedService,
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
      const settlementResult = this.raidSettlementRuleService.calculate({
        lockedGold,
        vaultGold: raidOrder.attacker.wallet.vaultGold,
        attackerFactionName: raidOrder.attacker.faction?.name ?? readFactionName(raidOrder.attackerSnapshotJson) ?? null,
        defenderFactionName: raidOrder.defender.faction?.name ?? readFactionName(raidOrder.defenderSnapshotJson) ?? null,
        attackerSpirit: readSpiritSnapshot(raidOrder.attackerSnapshotJson) ?? buildSpiritSnapshotFromSlot(raidOrder.attacker.spiritSlots[0] ?? null),
        defenderSpirit: readSpiritSnapshot(raidOrder.defenderSnapshotJson) ?? buildSpiritSnapshotFromSlot(raidOrder.defender.spiritSlots[0] ?? null),
        guaranteedOrdinarySoul: readGuaranteedOrdinarySoul(raidOrder.defenderSnapshotJson),
      });
      const now = new Date();
      const nextVaultGold = raidOrder.attacker.wallet.vaultGold + settlementResult.depositedGold;
      const attackerUnitLoss = 0;
      const unitsReturned = raidOrder.dispatchedUnitCount;

      await this.applyDefenderLootConsumption(client, raidOrder, settlementResult.lootGold, now);
      const defenderProtectedUntil = new Date(now.getTime() + 60 * 60 * 1000);

      const rewardItemsJson = [
        ...settlementResult.rewardItems,
        ...settlementResult.battleEvents.map((event) => ({ ...event, type: 'battleEvent' })),
      ];
      const essenceLoot = settlementResult.result === 'WIN'
        ? await this.applyEssenceLoot(client, raidOrder)
        : [];
      const contributionGain = settlementResult.result === 'WIN' ? 15 : 0;
      if (contributionGain > 0 && raidOrder.attacker.faction) {
        await grantFactionContribution(client, {
          playerId: raidOrder.attackerPlayerId,
          factionId: raidOrder.attacker.faction.id,
          contribution: contributionGain,
          sourceType: 'raid-success',
          sourceId: raidOrder.id,
          metadata: { lootGold: settlementResult.lootGold },
        });
        await this.completeConflictFactionTasks(client, raidOrder.attackerPlayerId, raidOrder.attacker.faction.id);
      }
      rewardItemsJson.push(
        ...essenceLoot,
        ...(contributionGain > 0 ? [{ kind: 'contribution', label: '阵营贡献', quantity: contributionGain }] : []),
      );
      const battleReplay = buildRaidBattleReplay(raidOrder.id, {
        result: settlementResult.result,
        lootGold: settlementResult.lootGold,
        attackerLoss: settlementResult.attackerHpLossPercent,
        defenderLoss: settlementResult.defenderHpLossPercent,
        reportSummary: settlementResult.reportSummary,
        rewardItemsJson,
      }, {
        attackerSnapshotJson: raidOrder.attackerSnapshotJson,
        defenderSnapshotJson: raidOrder.defenderSnapshotJson,
        attacker: { nickname: raidOrder.attacker.nickname },
        defender: { nickname: raidOrder.defender.nickname },
      });

      const settlement = await this.raidRepository.createRaidSettlement({
        raidOrder: { connect: { id: raidOrder.id } },
        result: settlementResult.result,
        lootGold: settlementResult.lootGold,
        depositedGold: settlementResult.depositedGold,
        overflowGold: 0,
        temporaryClaimExpiresAt: null,
        attackerLoss: settlementResult.attackerHpLossPercent,
        defenderLoss: settlementResult.defenderHpLossPercent,
        rewardItemsJson: rewardItemsJson as Prisma.InputJsonValue,
        battleReplayJson: battleReplay as unknown as Prisma.InputJsonValue,
        reportSummary: settlementResult.reportSummary,
      }, client);

      await this.applySpiritSettlement(client, raidOrder, settlementResult);

      await client.player.update({
        where: { id: raidOrder.defenderPlayerId },
        data: { protectedUntil: defenderProtectedUntil },
      });

      await client.playerArmy.update({
        where: { playerId: raidOrder.attackerPlayerId },
        data: {
          totalCount: { decrement: attackerUnitLoss },
          availableCount: { increment: unitsReturned },
          frozenCount: { decrement: raidOrder.dispatchedUnitCount },
          armyVersion: { increment: 1 },
        },
      });

      if (settlementResult.depositedGold > 0) {
        await client.playerWallet.update({
          where: { playerId: raidOrder.attackerPlayerId },
          data: {
            vaultGold: nextVaultGold,
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
          title: `${settlementResult.title} · ${raidOrder.defender.nickname}`,
          summary: buildAttackReportSummary(raidOrder.defender.nickname, now, settlementResult),
          revengeAvailable: false,
        },
        {
          raidOrderId: raidOrder.id,
          ownerPlayerId: raidOrder.defenderPlayerId,
          opponentPlayerId: raidOrder.attackerPlayerId,
          reportType: 'DEFENSE',
          result: settlementResult.result === 'WIN' ? 'LOSS' : 'WIN',
          title: `${invertSettlementTitle(settlementResult.title)} · ${raidOrder.attacker.nickname}`,
          summary: buildDefenseReportSummary(raidOrder.attacker.nickname, now, settlementResult),
          revengeAvailable: true,
        },
      ], client);
      await client.battleReport.updateMany({
        where: {
          raidOrderId: raidOrder.id,
          ownerPlayerId: raidOrder.defenderPlayerId,
          reportType: 'DEFENSE',
        },
        data: {
          summary: buildDefenseReportSummary(raidOrder.attacker.nickname, now, settlementResult),
        },
      });

      await client.raidOrder.update({
        where: { id: raidOrder.id },
        data: {
          status: 'SETTLED',
          settledAt: now,
        },
      });

      if (settlementResult.result === 'WIN') {
        await this.landDeedService.reconcilePlayerLandDeeds(client, raidOrder.attackerPlayerId, now);
      }

      return settlement;
    });
  }

  private async applyEssenceLoot(
    client: Prisma.TransactionClient,
    raidOrder: NonNullable<Awaited<ReturnType<RaidRepository['findRaidOrderForSettlement']>>>,
  ): Promise<Array<{ kind: 'essence'; seedId: string; essenceType: string; label: string; quantity: number }>> {
    const defenderInventory = raidOrder.defender.seedInventory
      .filter((inventory) => inventory.quantity > ESSENCE_LOOT_PROTECTED_QUANTITY)
      .sort((left, right) => {
        const rarityDelta = getRarityWeight(right.seedDefinition.rarity) - getRarityWeight(left.seedDefinition.rarity);
        if (rarityDelta !== 0) {
          return rarityDelta;
        }

        return right.quantity - left.quantity;
      })
      .slice(0, 2);

    const rewards: Array<{ kind: 'essence'; seedId: string; essenceType: string; label: string; quantity: number }> = [];

    for (const inventory of defenderInventory) {
      const available = Math.max(inventory.quantity - ESSENCE_LOOT_PROTECTED_QUANTITY, 0);
      const quantity = Math.min(Math.max(Math.floor(available * ESSENCE_LOOT_RATIO), 1), ESSENCE_LOOT_MAX_PER_TYPE, available);

      if (quantity <= 0) {
        continue;
      }

      const defenderNextQuantity = inventory.quantity - quantity;
      await client.playerSeedInventory.update({
        where: { id: inventory.id },
        data: {
          quantity: { decrement: quantity },
          inventoryVersion: { increment: 1 },
        },
      });
      await createEssenceTransaction(client, {
        playerId: raidOrder.defenderPlayerId,
        essenceType: inventory.seedDefinition.seedId,
        delta: -quantity,
        reason: 'raid-looted',
        sourceId: raidOrder.id,
        balanceAfter: defenderNextQuantity,
      });

      const attackerInventory = await client.playerSeedInventory.upsert({
        where: {
          playerId_seedDefinitionId: {
            playerId: raidOrder.attackerPlayerId,
            seedDefinitionId: inventory.seedDefinition.id,
          },
        },
        create: {
          playerId: raidOrder.attackerPlayerId,
          seedDefinitionId: inventory.seedDefinition.id,
          quantity,
        },
        update: {
          quantity: { increment: quantity },
          inventoryVersion: { increment: 1 },
        },
        select: { quantity: true },
      });
      await discoverPlant(client, {
        playerId: raidOrder.attackerPlayerId,
        seedDefinitionId: inventory.seedDefinition.id,
      });
      await createEssenceTransaction(client, {
        playerId: raidOrder.attackerPlayerId,
        essenceType: inventory.seedDefinition.seedId,
        delta: quantity,
        reason: 'raid-loot',
        sourceId: raidOrder.id,
        balanceAfter: attackerInventory.quantity,
      });

      rewards.push({
        kind: 'essence',
        seedId: inventory.seedDefinition.seedId,
        essenceType: inventory.seedDefinition.seedId,
        label: `${inventory.seedDefinition.label}精华`,
        quantity,
      });
    }

    return rewards;
  }

  private async completeConflictFactionTasks(
    client: Prisma.TransactionClient,
    playerId: string,
    factionId: string,
  ): Promise<void> {
    const dateKey = getLocalDateKey();
    const tasks = await client.dailyFactionTask.findMany({
      where: {
        playerId,
        factionId,
        taskDate: dateKey,
        taskType: 'CONFLICT_RAID',
        status: 'IN_PROGRESS',
      },
      select: {
        id: true,
        requiredAmount: true,
        progressAmount: true,
        rewardContribution: true,
      },
    });

    for (const task of tasks) {
      const nextProgress = Math.min(task.progressAmount + 1, task.requiredAmount);
      const completed = nextProgress >= task.requiredAmount;
      await client.dailyFactionTask.update({
        where: { id: task.id },
        data: {
          progressAmount: nextProgress,
          status: completed ? 'CLAIMED' : 'IN_PROGRESS',
          completedAt: completed ? new Date() : null,
        },
      });

      if (completed) {
        await grantFactionContribution(client, {
          playerId,
          factionId,
          contribution: task.rewardContribution,
          sourceType: 'faction-task-conflict',
          sourceId: task.id,
          metadata: { raidOrderId: task.id },
        });
      }
    }
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

  private async applySpiritSettlement(
    client: Prisma.TransactionClient,
    raidOrder: NonNullable<Awaited<ReturnType<RaidRepository['findRaidOrderForSettlement']>>>,
    settlementResult: ReturnType<RaidSettlementRuleService['calculate']>,
  ): Promise<void> {
    const attackerFactionCode = normalizeFactionCode(raidOrder.attacker.faction?.code ?? readFactionName(raidOrder.attackerSnapshotJson));

    if (settlementResult.attackerSpiritSlotId && settlementResult.attackerNextHp !== null) {
      const attackerMaxHp = settlementResult.attackerSpiritSlotId
        ? (readSpiritSnapshot(raidOrder.attackerSnapshotJson)?.maxHp ?? buildSpiritSnapshotFromSlot(raidOrder.attacker.spiritSlots[0] ?? null)?.maxHp ?? settlementResult.attackerNextHp)
        : settlementResult.attackerNextHp;
      const recoveredAttackerHp = applyFactionBattlePostRecovery(settlementResult.attackerNextHp, attackerMaxHp, attackerFactionCode);
      await client.playerSpiritSlot.update({
        where: { id: settlementResult.attackerSpiritSlotId },
        data: {
          currentHp: recoveredAttackerHp,
          status: recoveredAttackerHp <= 0 ? 'WOUNDED' : recoveredAttackerHp < 30 ? 'RESTING' : 'ACTIVE',
          slotVersion: { increment: 1 },
        },
      });
    }

    if (settlementResult.defenderSpiritSlotId && settlementResult.defenderNextHp !== null) {
      await client.playerSpiritSlot.update({
        where: { id: settlementResult.defenderSpiritSlotId },
        data: {
          currentHp: settlementResult.defenderNextHp,
          status: settlementResult.defenderNextHp <= 0 ? 'WOUNDED' : settlementResult.defenderNextHp < 30 ? 'RESTING' : 'ACTIVE',
          slotVersion: { increment: 1 },
        },
      });
    }

    if (settlementResult.soulRewards.ordinary > 0 || settlementResult.soulRewards.rare > 0 || settlementResult.soulRewards.legendary > 0) {
      await client.playerSpiritResource.update({
        where: { playerId: raidOrder.attackerPlayerId },
        data: {
          ordinarySoul: settlementResult.soulRewards.ordinary > 0 ? { increment: settlementResult.soulRewards.ordinary } : undefined,
          rareSoul: settlementResult.soulRewards.rare > 0 ? { increment: settlementResult.soulRewards.rare } : undefined,
          legendarySoul: settlementResult.soulRewards.legendary > 0 ? { increment: settlementResult.soulRewards.legendary } : undefined,
          resourceVersion: { increment: 1 },
        },
      });
    }

    if (settlementResult.shardDrop) {
      const now = new Date();
      const existingCodex = await client.playerSpiritCodex.findUnique({
        where: {
          playerId_spiritDefinitionId: {
            playerId: raidOrder.attackerPlayerId,
            spiritDefinitionId: settlementResult.shardDrop.spiritDefinitionId,
          },
        },
        select: {
          id: true,
          shardCount: true,
        },
      });

      if (existingCodex) {
        const nextShardCount = Math.min(existingCodex.shardCount + settlementResult.shardDrop.quantity, 100);
        await client.playerSpiritCodex.update({
          where: { id: existingCodex.id },
          data: {
            hasSeen: true,
            shardCount: nextShardCount,
            readyToCompose: nextShardCount >= 100,
            firstSeenAt: existingCodex.shardCount > 0 ? undefined : now,
            readyAt: nextShardCount >= 100 ? now : null,
            codexVersion: { increment: 1 },
          },
        });
      } else {
        const nextShardCount = Math.min(settlementResult.shardDrop.quantity, 100);
        await client.playerSpiritCodex.create({
          data: {
            playerId: raidOrder.attackerPlayerId,
            spiritDefinitionId: settlementResult.shardDrop.spiritDefinitionId,
            hasSeen: true,
            shardCount: nextShardCount,
            readyToCompose: nextShardCount >= 100,
            ownedCurrent: false,
            ownedEver: false,
            firstSeenAt: now,
            readyAt: nextShardCount >= 100 ? now : null,
            lastOwnedAt: null,
            codexVersion: 1,
          },
        });
      }
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

function normalizeFactionCode(value: string | null | undefined): 'human' | 'immortal' | 'demon' | null {
  if (!value) {
    return null;
  }

  if (value === 'human' || value === '人界') {
    return 'human';
  }
  if (value === 'immortal' || value === '仙界') {
    return 'immortal';
  }
  if (value === 'demon' || value === '魔界') {
    return 'demon';
  }

  return null;
}

interface DefenderFieldDeductionPlanEntry {
  fieldId: string;
  requestedGold: number;
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

function readFactionName(value: Prisma.JsonValue): string | null {
  const snapshot = value as { factionName?: string; faction?: string };
  return snapshot.factionName ?? snapshot.faction ?? null;
}

function readSpiritSnapshot(value: Prisma.JsonValue): SpiritBattleSnapshot | null {
  const snapshot = value as { mainSpirit?: unknown };
  return isSpiritBattleSnapshot(snapshot.mainSpirit) ? snapshot.mainSpirit : null;
}

function readGuaranteedOrdinarySoul(value: Prisma.JsonValue): number {
  const snapshot = value as { targetSnapshotJson?: { guaranteedOrdinarySoul?: unknown } };
  const rawValue = snapshot.targetSnapshotJson?.guaranteedOrdinarySoul;
  return typeof rawValue === 'number' ? Math.max(Math.floor(rawValue), 0) : 0;
}

function buildSpiritSnapshotFromSlot(slot: {
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
} | null): SpiritBattleSnapshot | null {
  if (!slot?.spiritDefinition) {
    return null;
  }

  return {
    slotId: slot.id,
    slotIndex: slot.slotIndex,
    level: slot.level,
    element: isSpiritElement(slot.element) ? slot.element : null,
    currentHp: slot.currentHp,
    maxHp: slot.maxHp,
    status: slot.status,
    spiritDefinition: slot.spiritDefinition,
    traits: slot.traits ?? [],
  };
}

function isSpiritBattleSnapshot(value: unknown): value is SpiritBattleSnapshot {
  const candidate = value as Partial<SpiritBattleSnapshot> | null;
  return Boolean(
    candidate
    && typeof candidate.slotId === 'string'
    && typeof candidate.level === 'number'
    && typeof candidate.currentHp === 'number'
    && typeof candidate.maxHp === 'number'
    && candidate.spiritDefinition
    && typeof candidate.spiritDefinition.id === 'string',
  );
}

function isSpiritElement(value: string | null): value is SpiritBattleSnapshot['element'] {
  return value === 'METAL' || value === 'WOOD' || value === 'WATER' || value === 'FIRE' || value === 'EARTH';
}

function buildAttackReportSummary(
  defenderName: string,
  happenedAt: Date,
  settlementResult: ReturnType<RaidSettlementRuleService['calculate']>,
): string {
  return `${formatBattleReportTime(happenedAt)}，你对 ${defenderName} 发起掠夺：${settlementResult.title} · ${settlementResult.subtitle}，带回 ${settlementResult.lootGold} 金币、${formatRewardSummary(settlementResult)}。己方灵宠受到 ${settlementResult.attackerHpLossPercent}% 伤害，对方灵宠受到 ${settlementResult.defenderHpLossPercent}% 伤害。`;
}

function buildDefenseReportSummary(
  attackerName: string,
  happenedAt: Date,
  settlementResult: ReturnType<RaidSettlementRuleService['calculate']>,
): string {
  return `${formatBattleReportTime(happenedAt)}，${attackerName} 对你发起掠夺：${invertSettlementTitle(settlementResult.title)} · ${settlementResult.subtitle}，损失 ${settlementResult.lootGold} 金币。己方灵宠受到 ${settlementResult.defenderHpLossPercent}% 伤害，对方灵宠受到 ${settlementResult.attackerHpLossPercent}% 伤害。`;
}

function formatRewardSummary(settlementResult: ReturnType<RaidSettlementRuleService['calculate']>): string {
  const rewardParts = [
    settlementResult.soulRewards.ordinary > 0 ? `普通兽魂 x${settlementResult.soulRewards.ordinary}` : '',
    settlementResult.soulRewards.rare > 0 ? `稀有兽魂 x${settlementResult.soulRewards.rare}` : '',
    settlementResult.soulRewards.legendary > 0 ? `传说兽魂 x${settlementResult.soulRewards.legendary}` : '',
  ].filter(Boolean);

  if (settlementResult.shardDrop) {
    rewardParts.push(`${settlementResult.shardDrop.label}精魄 x${settlementResult.shardDrop.quantity}`);
  }

  return rewardParts.join('、') || '无额外掉落';
}

function formatBattleReportTime(value: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(value);
}

function invertSettlementTitle(title: string): string {
  if (title === '完胜') {
    return '完败';
  }
  if (title === '大胜') {
    return '大败';
  }
  if (title === '小胜') {
    return '小败';
  }
  if (title === '小败') {
    return '小胜';
  }
  if (title === '大败') {
    return '大胜';
  }
  if (title === '完败') {
    return '完胜';
  }
  return '相持';
}

function getRarityWeight(rarity: string): number {
  if (rarity === 'legendary') {
    return 3;
  }

  if (rarity === 'rare') {
    return 2;
  }

  return 1;
}

async function createEssenceTransaction(
  client: Prisma.TransactionClient,
  data: {
    playerId: string;
    essenceType: string;
    delta: number;
    reason: string;
    sourceId?: string | null;
    balanceAfter: number;
  },
): Promise<void> {
  await client.essenceTransactionLog.create({
    data: {
      playerId: data.playerId,
      essenceType: data.essenceType,
      delta: data.delta,
      reason: data.reason,
      sourceId: data.sourceId,
      balanceAfter: data.balanceAfter,
    },
  });
}

async function discoverPlant(
  client: Prisma.TransactionClient,
  input: {
    playerId: string;
    seedDefinitionId: string;
  },
): Promise<void> {
  await client.playerPlantResearch.upsert({
    where: {
      playerId_seedDefinitionId: {
        playerId: input.playerId,
        seedDefinitionId: input.seedDefinitionId,
      },
    },
    create: {
      playerId: input.playerId,
      seedDefinitionId: input.seedDefinitionId,
      discoveredAt: new Date(),
    },
    update: {
      researchVersion: { increment: 1 },
    },
  });
}

async function grantFactionContribution(
  client: Prisma.TransactionClient,
  input: {
    playerId: string;
    factionId: string;
    contribution: number;
    sourceType: string;
    sourceId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  const contribution = Math.max(Math.floor(input.contribution), 0);
  if (contribution <= 0) {
    return;
  }

  await client.faction.update({
    where: { id: input.factionId },
    data: { contributionScore: { increment: contribution } },
  });

  await client.factionMember.updateMany({
    where: {
      playerId: input.playerId,
      factionId: input.factionId,
    },
    data: { contributionScore: { increment: contribution } },
  });

  await client.factionContributionLog.create({
    data: {
      factionId: input.factionId,
      playerId: input.playerId,
      donatedGold: 0,
      contributionDelta: contribution,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadataJson: input.metadata,
    },
  });
}

