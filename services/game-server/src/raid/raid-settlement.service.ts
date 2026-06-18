import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { ClientCodexPrompt } from '@trinitywar/shared';
import { AuditService } from '../audit/audit.service.js';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { grantFactionContribution } from '../faction/contribution.service.js';
import { getLocalDateKey } from '../lib/date-key.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildRaidBattleReplay } from './raid-battle-replay.js';
import { RaidRepository } from './raid.repository.js';
import { RaidSettlementRuleService, type SpiritBattleSnapshot } from './raid-settlement-rule.service.js';

const RAID_WIN_CONTRIBUTION = 5;

@Injectable()
export class RaidSettlementService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RaidRepository) private readonly raidRepository: RaidRepository,
    @Inject(RaidSettlementRuleService) private readonly raidSettlementRuleService: RaidSettlementRuleService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  settleRaidOrder(raidOrderId: string, now: Date = new Date()) {
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

      if (!raidOrder.attacker.wallet) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Attacker wallet state not found.',
          statusCode: 404,
        });
      }

      await client.raidOrder.update({
        where: { id: raidOrder.id },
        data: { status: 'SETTLING' },
      });

      const lockedGold = raidOrder.assetLocks.reduce((sum, lock) => sum + lock.lockedGold, 0);
      const attackerSpirit = readSpiritSnapshot(raidOrder.attackerSnapshotJson) ?? buildSpiritSnapshotFromSlot(raidOrder.attacker.spiritSlots[0] ?? null);
      const defenderSpirit = readSpiritSnapshot(raidOrder.defenderSnapshotJson) ?? buildSpiritSnapshotFromSlot(raidOrder.defender.spiritSlots[0] ?? null);
      const defenderCodex = defenderSpirit
        ? await client.playerSpiritCodex.findUnique({
          where: {
            playerId_spiritDefinitionId: {
              playerId: raidOrder.attackerPlayerId,
              spiritDefinitionId: defenderSpirit.spiritDefinition.id,
            },
          },
          select: {
            shardCount: true,
            readyToCompose: true,
            ownedCurrent: true,
            ownedEver: true,
          },
        })
        : null;
      const shardDropDisplayLabel = isSpiritCodexRevealed(defenderCodex) && defenderSpirit
        ? defenderSpirit.spiritDefinition.label
        : '？？';
      const settlementResult = this.raidSettlementRuleService.calculate({
        lockedGold,
        vaultGold: raidOrder.attacker.wallet.vaultGold,
        attackerFactionName: raidOrder.attacker.faction?.name ?? readFactionName(raidOrder.attackerSnapshotJson) ?? null,
        defenderFactionName: raidOrder.defender.faction?.name ?? readFactionName(raidOrder.defenderSnapshotJson) ?? null,
        attackerSpirit,
        defenderSpirit,
        guaranteedOrdinarySoul: readGuaranteedOrdinarySoul(raidOrder.defenderSnapshotJson),
        suppressRandomRewards: readTutorialTarget(raidOrder.defenderSnapshotJson),
        shardDropDisplayLabel,
      });
      const nextVaultGold = raidOrder.attacker.wallet.vaultGold + settlementResult.depositedGold;
      const codexPrompts = await this.applySpiritSettlement(client, raidOrder, settlementResult);

      const rewardItemsJson = [
        ...settlementResult.rewardItems,
        ...codexPrompts.map((prompt) => ({ ...prompt, type: 'codexPrompt', promptType: prompt.type })),
        ...settlementResult.battleEvents.map((event) => ({ ...event, type: 'battleEvent' })),
      ];
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
      }, 'attacker');

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
        data: { status: 'RELEASED' },
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

      const dateKey = getLocalDateKey(now);
      await client.playerRaidPairDailyState.upsert({
        where: {
          attackerPlayerId_defenderPlayerId_dateKey: {
            attackerPlayerId: raidOrder.attackerPlayerId,
            defenderPlayerId: raidOrder.defenderPlayerId,
            dateKey,
          },
        },
        create: {
          attackerPlayerId: raidOrder.attackerPlayerId,
          defenderPlayerId: raidOrder.defenderPlayerId,
          dateKey,
          settledCount: 1,
        },
        update: {
          settledCount: { increment: 1 },
        },
      });

      if (settlementResult.result === 'WIN') {
        await client.playerRaidDailyState.upsert({
          where: {
            playerId_dateKey: {
              playerId: raidOrder.defenderPlayerId,
              dateKey,
            },
          },
          create: {
            playerId: raidOrder.defenderPlayerId,
            dateKey,
            successfulDefenseRaidCount: 1,
          },
          update: {
            successfulDefenseRaidCount: { increment: 1 },
          },
        });
      }

      await client.raidOrder.update({
        where: { id: raidOrder.id },
        data: {
          status: 'SETTLED',
          settledAt: now,
        },
      });

      if (settlementResult.result === 'WIN') {
        await grantFactionContribution(client, {
          playerId: raidOrder.attackerPlayerId,
          contribution: RAID_WIN_CONTRIBUTION,
          sourceType: 'raid-win',
          sourceId: raidOrder.id,
            metadata: {
              defenderPlayerId: raidOrder.defenderPlayerId,
              lootGold: settlementResult.lootGold,
            },
        });
      }

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

  private async applySpiritSettlement(
    client: Prisma.TransactionClient,
    raidOrder: NonNullable<Awaited<ReturnType<RaidRepository['findRaidOrderForSettlement']>>>,
    settlementResult: ReturnType<RaidSettlementRuleService['calculate']>,
  ): Promise<ClientCodexPrompt[]> {
    const codexPrompts: ClientCodexPrompt[] = [];

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
      const spiritDefinition = await client.spiritDefinition.findUnique({
        where: { id: settlementResult.shardDrop.spiritDefinitionId },
        select: { shardUnlockRequired: true },
      });
      const shardUnlockRequired = spiritDefinition?.shardUnlockRequired ?? 100;
      const existingCodex = await client.playerSpiritCodex.findUnique({
        where: {
          playerId_spiritDefinitionId: {
            playerId: raidOrder.attackerPlayerId,
            spiritDefinitionId: settlementResult.shardDrop.spiritDefinitionId,
          },
        },
        select: {
          id: true,
          hasSeen: true,
          shardCount: true,
          readyToCompose: true,
          ownedCurrent: true,
          ownedEver: true,
        },
      });

      if (existingCodex) {
        const nextShardCount = Math.min(existingCodex.shardCount + settlementResult.shardDrop.quantity, shardUnlockRequired);
        const nextReadyToCompose = nextShardCount >= shardUnlockRequired;
        codexPrompts.push(...buildSpiritCodexPrompts({
          spiritId: settlementResult.shardDrop.spiritId,
          label: settlementResult.shardDrop.label,
          previousShardCount: existingCodex.shardCount,
          nextShardCount,
          wasHasSeen: existingCodex.hasSeen,
          wasReadyToCompose: existingCodex.readyToCompose,
          wasOwnedCurrent: existingCodex.ownedCurrent,
          wasOwnedEver: existingCodex.ownedEver,
          nextReadyToCompose,
          shardUnlockRequired,
        }));
        await client.playerSpiritCodex.update({
          where: { id: existingCodex.id },
          data: {
            hasSeen: true,
            shardCount: nextShardCount,
            readyToCompose: nextReadyToCompose,
            firstSeenAt: existingCodex.shardCount > 0 || existingCodex.ownedCurrent || existingCodex.ownedEver || existingCodex.readyToCompose ? undefined : now,
            readyAt: nextReadyToCompose ? now : null,
            codexVersion: { increment: 1 },
          },
        });
      } else {
        const nextShardCount = Math.min(settlementResult.shardDrop.quantity, shardUnlockRequired);
        const nextReadyToCompose = nextShardCount >= shardUnlockRequired;
        codexPrompts.push(...buildSpiritCodexPrompts({
          spiritId: settlementResult.shardDrop.spiritId,
          label: settlementResult.shardDrop.label,
          previousShardCount: 0,
          nextShardCount,
          wasHasSeen: false,
          wasReadyToCompose: false,
          wasOwnedCurrent: false,
          wasOwnedEver: false,
          nextReadyToCompose,
          shardUnlockRequired,
        }));
        await client.playerSpiritCodex.create({
          data: {
            playerId: raidOrder.attackerPlayerId,
            spiritDefinitionId: settlementResult.shardDrop.spiritDefinitionId,
            hasSeen: true,
            shardCount: nextShardCount,
            readyToCompose: nextReadyToCompose,
            ownedCurrent: false,
            ownedEver: false,
            firstSeenAt: now,
            readyAt: nextReadyToCompose ? now : null,
            lastOwnedAt: null,
            codexVersion: 1,
          },
        });
      }
    }

    return codexPrompts;
  }

  private async compensateFailedRaidOrder(raidOrderId: string): Promise<void> {
    await this.prisma.transaction(async (client) => {
      const raidOrder = await this.raidRepository.findRaidOrderForSettlement(raidOrderId, client);

      if (!raidOrder || raidOrder.settlement) {
        return;
      }

      const activeLocks = raidOrder.assetLocks.filter((lock) => lock.status === 'ACTIVE');
      if (activeLocks.length > 0) {
        await client.raidAssetLock.updateMany({
          where: { raidOrderId: raidOrder.id, status: 'ACTIVE' },
          data: { status: 'RELEASED' },
        });
      }

      const releasableUnits = Math.min(raidOrder.attacker.army?.frozenCount ?? 0, raidOrder.dispatchedUnitCount);
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

function readTutorialTarget(value: Prisma.JsonValue): boolean {
  const snapshot = value as { targetSnapshotJson?: { tutorialTarget?: unknown } };
  return snapshot.targetSnapshotJson?.tutorialTarget === true;
}

function buildSpiritSnapshotFromSlot(slot: {
  id: string;
  slotIndex: number;
  level: number;
  element: string | null;
  maxHp: number;
  currentHp?: number;
  status?: string;
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
    currentHp: slot.currentHp ?? slot.maxHp,
    maxHp: slot.maxHp,
    status: slot.status ?? 'ACTIVE',
    spiritDefinition: slot.spiritDefinition,
    traits: slot.traits ?? [],
  };
}

function isSpiritCodexRevealed(entry: {
  shardCount: number;
  readyToCompose: boolean;
  ownedCurrent: boolean;
  ownedEver: boolean;
} | null): boolean {
  if (!entry) {
    return false;
  }

  return entry.shardCount > 0 || entry.readyToCompose || entry.ownedCurrent || entry.ownedEver;
}

function buildSpiritCodexPrompts(input: {
  spiritId: string;
  label: string;
  previousShardCount: number;
  nextShardCount: number;
  wasHasSeen: boolean;
  wasReadyToCompose: boolean;
  wasOwnedCurrent: boolean;
  wasOwnedEver: boolean;
  nextReadyToCompose: boolean;
  shardUnlockRequired: number;
}): ClientCodexPrompt[] {
  const prompts: ClientCodexPrompt[] = [];

  if (
    input.previousShardCount <= 0
    && !input.wasHasSeen
    && !input.wasReadyToCompose
    && !input.wasOwnedCurrent
    && !input.wasOwnedEver
    && input.nextShardCount > 0
  ) {
    prompts.push({
      type: 'spirit-codex-visible',
      subjectId: input.spiritId,
      label: input.label,
      message: `获得 ${input.label} 精魄，灵宠图鉴已可见。`,
      current: input.nextShardCount,
      required: input.shardUnlockRequired,
    });
  }

  if (!input.wasReadyToCompose && input.nextReadyToCompose) {
    prompts.push({
      type: 'spirit-compose-ready',
      subjectId: input.spiritId,
      label: input.label,
      message: `${input.label} 已达到合成条件。`,
      current: input.nextShardCount,
      required: input.shardUnlockRequired,
    });
  }

  return prompts;
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
  return `${formatBattleReportTime(happenedAt)}，${attackerName} 对你发起掠夺：${invertSettlementTitle(settlementResult.title)} · ${settlementResult.subtitle}。本次挑战奖励由系统发放，你未损失金币。己方灵宠受到 ${settlementResult.defenderHpLossPercent}% 伤害，对方灵宠受到 ${settlementResult.attackerHpLossPercent}% 伤害。`;
}

function formatRewardSummary(settlementResult: ReturnType<RaidSettlementRuleService['calculate']>): string {
  const rewardParts = [
    settlementResult.soulRewards.ordinary > 0 ? `普通兽魂 x${settlementResult.soulRewards.ordinary}` : '',
    settlementResult.soulRewards.rare > 0 ? `稀有兽魂 x${settlementResult.soulRewards.rare}` : '',
    settlementResult.soulRewards.legendary > 0 ? `传说兽魂 x${settlementResult.soulRewards.legendary}` : '',
  ].filter(Boolean);

  if (settlementResult.shardDrop) {
    rewardParts.push(`${settlementResult.shardDrop.displayLabel}精魄 x${settlementResult.shardDrop.quantity}`);
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

