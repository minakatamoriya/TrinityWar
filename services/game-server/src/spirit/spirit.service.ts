import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient, SpiritElement, SpiritRarity, SpiritRole } from '@prisma/client';
import { APP_NAME, getBasicSpiritTraitRollGoldCost, type ClientBreakthroughSpiritRequest, type ClientBuySpiritShopItemRequest, type ClientBuySpiritSoulRequest, type ClientClaimSpiritAdRewardRequest, type ClientCodexState, type ClientComposeSpiritRequest, type ClientDissolveSpiritRequest, type ClientFeedSpiritRequest, type ClientResolveSpiritTraitRollRequest, type ClientRollSpiritTraitsRequest, type ClientRollSpiritTraitsResponse, type ClientSceneVisibility, type ClientSetMainSpiritRequest, type ClientSpiritActiveRollMode, type ClientSpiritCodexEntry, type ClientSpiritDefinition, type ClientSpiritElement, type ClientSpiritMutationResponse, type ClientSpiritShopItem, type ClientSpiritSlot, type ClientSpiritState, type ClientSpiritStateResponse, type ClientSpiritTrait, type ClientSpiritTraitCode, type ClientSpiritTraitRollMaterial, type ClientUpgradeSpiritRequest } from '@trinitywar/shared';
import { AuditService } from '../audit/audit.service.js';
import { DailyTaskLifecycleService } from '../client-read/daily-task-lifecycle.service.js';
import { ClientReadService } from '../client-read/client-read.service.js';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';
import { getLocalDateKey } from '../lib/date-key.js';
import { grantFactionContribution } from '../faction/contribution.service.js';
import { DAILY_TASK_CONFIG, SPIRIT_BALANCE_CONFIG, SPIRIT_ROOT_ECONOMY_CONFIG } from '../lib/game-balance.js';
import {
  applyFactionSpiritBreakthroughSoulCost,
  applyFactionSpiritPassiveExpBonus,
  applyFactionSpiritTraitRollGoldCost,
  getCurrentFactionAdvantageConfig,
  getFactionSpiritFeedDurationSeconds,
  type FactionAdvantageCode,
} from '../lib/faction-advantage-formulas.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { STARTER_SPIRIT_IDS } from '../seed/seed-data/spirits.js';
import { TaskConfigService } from '../task-config/task-config.service.js';
import { getTraitDefinition, isActiveTraitRollMode, rollTraitCandidates, SPIRIT_TRAIT_DEFINITIONS, SPIRIT_TRAIT_ROLL_RULES, toTraitRollCandidate } from './spirit-trait-roll-rules.js';

const SPIRIT_SOUL_GOLD_PRICE = 100;
const SPIRIT_MAX_LEVEL = 50;
const SPIRIT_DISSOLVE_REFUND_RATIO = 0.35;
const SPIRIT_LEVEL_EXP_REQUIRED = 10_000;
const SPIRIT_AD_DAILY_LIMIT = 3;
const SPIRIT_AD_TALISMAN_REWARD = 5;
const MAX_SPIRIT_TRAIT_LOCKED_SLOTS = 3;
const SPIRIT_SHOP_ITEMS: ClientSpiritShopItem[] = [
  { itemId: 'spirit-root-100', label: '灵根 x100', description: '日常补给', priceTianjiTalisman: 10, limitLabel: '不限购', remainingPurchases: null, rewards: [{ kind: 'spirit-root', label: '灵根', quantity: 100 }] },
  { itemId: 'spirit-marrow-5', label: '灵髓 x5', description: '洗练基础材料', priceTianjiTalisman: 20, limitLabel: '每日 5 次', remainingPurchases: 5, rewards: [{ kind: 'spirit-marrow', label: '灵髓', quantity: 5 }] },
  { itemId: 'spirit-jade-1', label: '灵玉 x1', description: '高级洗练材料', priceTianjiTalisman: 80, limitLabel: '每周 1 次', remainingPurchases: 1, rewards: [{ kind: 'spirit-jade', label: '灵玉', quantity: 1 }] },
  { itemId: 'ordinary-soul-10', label: '普通兽魂 x10', description: '低段突破', priceTianjiTalisman: 5, limitLabel: '每日 3 次', remainingPurchases: 3, rewards: [{ kind: 'ordinary-soul', label: '普通兽魂', quantity: 10 }] },
  { itemId: 'rare-soul-1', label: '稀有兽魂 x1', description: '中段突破', priceTianjiTalisman: 30, limitLabel: '每日 2 次', remainingPurchases: 2, rewards: [{ kind: 'rare-soul', label: '稀有兽魂', quantity: 1 }] },
  { itemId: 'legendary-soul-1', label: '传说兽魂 x1', description: '高段突破', priceTianjiTalisman: 150, limitLabel: '每周 1 次', remainingPurchases: 1, rewards: [{ kind: 'legendary-soul', label: '传说兽魂', quantity: 1 }] },
];

const SPIRIT_BREAKTHROUGH_COSTS: Record<number, { quality: 'ordinary' | 'rare' | 'legendary'; count: number }> = {
  1: { quality: 'ordinary', count: 5 },
  2: { quality: 'ordinary', count: 12 },
  3: { quality: 'rare', count: 10 },
  4: { quality: 'rare', count: 20 },
  5: { quality: 'legendary', count: 8 },
};

type SpiritReadResource = {
  playerId: string;
  factionCode?: string | null;
  spiritSoul: number;
  spiritRoot: number;
  spiritMarrow: number;
  spiritJade: number;
  ordinarySoul: number;
  rareSoul: number;
  legendarySoul: number;
  tianjiTalisman: number;
  dailyIntelFreeUsed: number;
  dailyIntelTalismanUsed: number;
  dailyIntelDateKey: string | null;
  resourceVersion: number;
  updatedAt: Date;
};

type SpiritReadTrait = {
  slotIndex: number;
  traitCode: string;
  traitValue: number;
  sourceType: string;
};

@Injectable()
export class SpiritService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ClientReadService) private readonly clientReadService: ClientReadService,
    @Inject(IdempotencyService) private readonly idempotencyService: IdempotencyService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(DailyTaskLifecycleService) private readonly dailyTaskLifecycleService: DailyTaskLifecycleService,
    @Inject(TaskConfigService) private readonly taskConfigService: TaskConfigService,
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
    now: Date = new Date(),
  ): Promise<ClientSpiritState> {
    if (!client) {
      return this.prisma.transaction(async (transactionClient) => this.getSpiritState(playerId, transactionClient, now));
    }

    const readModel = await this.findSpiritReadModel(playerId, client);
    return buildSpiritState(readModel.resource, readModel.slots, readModel.codex, readModel.shopPurchases, readModel.adRewardUsedToday, now);
  }

  async buySpiritSoul(
    playerId: string,
    request: ClientBuySpiritSoulRequest,
    headerIdempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    validateBuySpiritSoulRequest(request);
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
            tianjiTalisman: true,
            dailyIntelFreeUsed: true,
            dailyIntelTalismanUsed: true,
            dailyIntelDateKey: true,
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
    validateSlotRequest(request, 'slotIndex');
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
            tianjiTalisman: true,
            resourceVersion: true,
            updatedAt: true,
            dailyIntelFreeUsed: true,
            dailyIntelTalismanUsed: true,
            dailyIntelDateKey: true,
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
          slotVersion: { increment: 1 },
        },
      });

      const response = await this.buildSpiritMutationResponse(client, playerId, slot.spiritDefinition.label + ' 已升至 Lv.' + nextLevel + '。');
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-slot', slot.id);
      return response;
    });
  }

  async feedSpirit(
    playerId: string,
    request: ClientFeedSpiritRequest,
    headerIdempotencyKey?: string,
    now: Date = new Date(),
  ): Promise<ClientSpiritMutationResponse> {
    validateFeedSpiritRequest(request);
    const idempotencyKey = normalizeIdempotencyKey(headerIdempotencyKey ?? request.requestIdempotencyKey);

    return this.prisma.transaction(async (client) => {
      const requestHash = hashRequest({
        endpoint: 'feed',
        slotIndex: request.slotIndex,
        actionType: request.actionType,
        slotVersion: request.slotVersion ?? null,
        resourceVersion: request.resourceVersion ?? null,
      });
      const idempotencyRecord = await this.prepareIdempotencyRecord(client, playerId, 'spirit-feed', idempotencyKey, requestHash);
      if (idempotencyRecord?.status === 'completed' && idempotencyRecord.responseSnapshotJson) {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientSpiritMutationResponse;
      }

      const [resource, slot] = await Promise.all([
        client.playerSpiritResource.findUnique({
          where: { playerId },
          select: {
            spiritRoot: true,
            resourceVersion: true,
            player: {
              select: {
                faction: {
                  select: {
                    code: true,
                  },
                },
              },
            },
          },
        }),
        client.playerSpiritSlot.findUnique({
          where: { playerId_slotIndex: { playerId, slotIndex: request.slotIndex } },
          select: {
            id: true,
            level: true,
            exp: true,
            breakthroughStage: true,
            satiatedUntil: true,
            lastExpSettledAt: true,
            slotVersion: true,
            spiritDefinitionId: true,
            spiritDefinition: { select: { label: true } },
          },
        }),
      ]);

      if (!resource || !slot || !slot.spiritDefinitionId) {
        throw new BusinessError({ code: ErrorCode.NotFound, message: 'Spirit slot not found.', statusCode: 404 });
      }

      assertVersion('resourceVersion', request.resourceVersion, resource.resourceVersion);
      assertVersion('slotVersion', request.slotVersion, slot.slotVersion);

      const factionCode = toFactionAdvantageCode(resource.player?.faction?.code);
      const settled = settleSpiritProgress(slot, now, factionCode);
      const satiatedRemainingSeconds = Math.max(Math.floor(((settled.satiatedUntil?.getTime() ?? now.getTime()) - now.getTime()) / 1000), 0);
      const satiatedSecondsAdded = getFactionSpiritFeedDurationSeconds(SPIRIT_ROOT_ECONOMY_CONFIG.feed.accelerateSecondsPerFeed, factionCode);
      const feedCount = SPIRIT_ROOT_ECONOMY_CONFIG.feed.rootCostPerFeed;

      if (resource.spiritRoot < feedCount) {
        throw new BusinessError({ code: ErrorCode.Conflict, message: 'Insufficient spirit root.', statusCode: 409 });
      }

      const nextSatiatedUntil = new Date(now.getTime() + (satiatedRemainingSeconds + satiatedSecondsAdded) * 1000);

      await client.playerSpiritResource.update({
        where: { playerId },
        data: {
          spiritRoot: { decrement: feedCount },
          resourceVersion: { increment: 1 },
        },
      });
      await client.playerSpiritSlot.update({
        where: { id: slot.id },
        data: {
          level: settled.level,
          exp: settled.exp,
          breakthroughStage: settled.breakthroughStage,
          satiatedUntil: nextSatiatedUntil,
          lastExpSettledAt: now,
          slotVersion: { increment: 1 },
        },
      });
      await client.spiritFeedLog.create({
        data: {
          playerId,
          spiritSlotId: slot.id,
          actionType: request.actionType,
          feedCount,
          satiatedSecondsAdded,
          immediateExpGain: 0,
          beforeSatiatedUntil: slot.satiatedUntil,
          afterSatiatedUntil: nextSatiatedUntil,
          requestIdempotencyKey: idempotencyKey ?? null,
        },
      });
      await this.recordDailyTaskProgress(client, playerId, 'feed-spirit', 1, now);

      const response = await this.buildSpiritMutationResponse(client, playerId, (slot.spiritDefinition?.label ?? '灵宠') + ` 已安排 ${formatAccelerateDuration(satiatedSecondsAdded)}自动加速。`, now);
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-slot', slot.id);
      return response;
    });
  }

  async breakthroughSpirit(
    playerId: string,
    request: ClientBreakthroughSpiritRequest,
    headerIdempotencyKey?: string,
    now: Date = new Date(),
  ): Promise<ClientSpiritMutationResponse> {
    validateBreakthroughSpiritRequest(request);
    const idempotencyKey = normalizeIdempotencyKey(headerIdempotencyKey ?? request.requestIdempotencyKey);

    return this.prisma.transaction(async (client) => {
      const requestHash = hashRequest({
        endpoint: 'breakthrough',
        slotIndex: request.slotIndex,
        targetStage: request.targetStage ?? null,
        slotVersion: request.slotVersion ?? null,
        resourceVersion: request.resourceVersion ?? null,
      });
      const idempotencyRecord = await this.prepareIdempotencyRecord(client, playerId, 'spirit-breakthrough', idempotencyKey, requestHash);
      if (idempotencyRecord?.status === 'completed' && idempotencyRecord.responseSnapshotJson) {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientSpiritMutationResponse;
      }

      const [resource, slot] = await Promise.all([
        client.playerSpiritResource.findUnique({
          where: { playerId },
          select: {
            ordinarySoul: true,
            rareSoul: true,
            legendarySoul: true,
            resourceVersion: true,
            player: {
              select: {
                faction: {
                  select: {
                    code: true,
                  },
                },
              },
            },
          },
        }),
        client.playerSpiritSlot.findUnique({
          where: { playerId_slotIndex: { playerId, slotIndex: request.slotIndex } },
          select: {
            id: true,
            level: true,
            exp: true,
            breakthroughStage: true,
            satiatedUntil: true,
            lastExpSettledAt: true,
            slotVersion: true,
            spiritDefinitionId: true,
            spiritDefinition: { select: { label: true } },
          },
        }),
      ]);

      if (!resource || !slot || !slot.spiritDefinitionId) {
        throw new BusinessError({ code: ErrorCode.NotFound, message: 'Spirit slot not found.', statusCode: 404 });
      }

      assertVersion('resourceVersion', request.resourceVersion, resource.resourceVersion);
      assertVersion('slotVersion', request.slotVersion, slot.slotVersion);

      const factionCode = toFactionAdvantageCode(resource.player?.faction?.code);
      const settled = settleSpiritProgress(slot, now, factionCode);
      const targetStage = request.targetStage ?? getBreakthroughStageForLevel(settled.level);
      const expectedStage = getBreakthroughStageForLevel(settled.level);
      if (expectedStage === null || targetStage !== expectedStage || settled.breakthroughStage >= expectedStage) {
        throw new BusinessError({ code: ErrorCode.BadRequest, message: 'Spirit is not at a pending breakthrough node.', statusCode: 400 });
      }

      const cost = SPIRIT_BREAKTHROUGH_COSTS[expectedStage];
      if (!cost) {
        throw new BusinessError({ code: ErrorCode.BadRequest, message: 'Unsupported breakthrough stage.', statusCode: 400 });
      }

      const soulCost = applyFactionSpiritBreakthroughSoulCost(cost.count, factionCode);
      const currentSoul = getSoulCount(resource, cost.quality);
      if (currentSoul < soulCost) {
        throw new BusinessError({ code: ErrorCode.Conflict, message: 'Insufficient spirit soul for breakthrough.', statusCode: 409 });
      }

      await client.playerSpiritResource.update({
        where: { playerId },
        data: {
          [getSoulField(cost.quality)]: { decrement: soulCost },
          resourceVersion: { increment: 1 },
        },
      });
      await client.playerSpiritSlot.update({
        where: { id: slot.id },
        data: {
          level: Math.min(settled.level + 1, SPIRIT_MAX_LEVEL),
          exp: 0,
          breakthroughStage: expectedStage,
          satiatedUntil: settled.satiatedUntil,
          lastExpSettledAt: now,
          slotVersion: { increment: 1 },
        },
      });
      await client.spiritBreakthroughLog.create({
        data: {
          playerId,
          spiritSlotId: slot.id,
          fromStage: slot.breakthroughStage,
          toStage: expectedStage,
          consumedSoulQuality: cost.quality,
          consumedSoulCount: soulCost,
          requestIdempotencyKey: idempotencyKey ?? null,
        },
      });

      await this.ensureNaturalTraitSlots(client, slot.id, expectedStage);
      const response = await this.buildSpiritMutationResponse(client, playerId, (slot.spiritDefinition?.label ?? '灵宠') + ' 已突破。', now);
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-slot', slot.id);
      return response;
    });
  }

  async rollSpiritTraits(
    playerId: string,
    request: ClientRollSpiritTraitsRequest,
    headerIdempotencyKey?: string,
  ): Promise<ClientRollSpiritTraitsResponse> {
    validateRollSpiritTraitsRequest(request);
    const idempotencyKey = normalizeIdempotencyKey(headerIdempotencyKey ?? request.requestIdempotencyKey);
    const lockedTraitSlotIndexes = normalizeLockedTraitSlotIndexes(request.lockedTraitSlotIndexes);
    const excludeCandidateIds = normalizeExcludeCandidateIds(request.excludeCandidateIds);
    const material = getTraitRollMaterial(request.mode);

    return this.prisma.transaction(async (client) => {
      if (!isActiveTraitRollMode(request.mode)) {
        throwBadRequest('mode must be basic, normal, or advanced.');
      }
      const requestHash = hashRequest({
        endpoint: 'roll-traits',
        slotIndex: request.slotIndex,
        mode: request.mode,
        material,
        targetSlotIndex: request.targetSlotIndex ?? null,
        candidateCount: request.candidateCount ?? null,
        lockedTraitSlotIndexes,
        excludeCandidateIds,
        slotVersion: request.slotVersion ?? null,
        walletVersion: request.walletVersion ?? null,
        resourceVersion: request.resourceVersion ?? null,
      });
      const idempotencyRecord = await this.prepareIdempotencyRecord(client, playerId, 'spirit-roll-traits', idempotencyKey, requestHash);
      if (idempotencyRecord?.status === 'completed' && idempotencyRecord.responseSnapshotJson) {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientRollSpiritTraitsResponse;
      }

      const [resource, wallet, slot] = await Promise.all([
        client.playerSpiritResource.findUnique({
          where: { playerId },
          select: {
            spiritMarrow: true,
            spiritJade: true,
            tianjiTalisman: true,
            resourceVersion: true,
            player: {
              select: {
                faction: {
                  select: {
                    code: true,
                  },
                },
              },
            },
          },
        }),
        client.playerWallet.findUnique({
          where: { playerId },
          select: {
            vaultGold: true,
            balanceVersion: true,
          },
        }),
        client.playerSpiritSlot.findUnique({
          where: { playerId_slotIndex: { playerId, slotIndex: request.slotIndex } },
          select: {
            id: true,
            level: true,
            breakthroughStage: true,
            slotVersion: true,
            spiritDefinitionId: true,
            spiritDefinition: { select: { label: true } },
            traits: {
              select: {
                slotIndex: true,
                traitCode: true,
                traitValue: true,
                sourceType: true,
              },
              orderBy: { slotIndex: 'asc' },
            },
          },
        }),
      ]);

      if (!resource || !wallet || !slot || !slot.spiritDefinitionId) {
        throw new BusinessError({ code: ErrorCode.NotFound, message: 'Spirit slot not found.', statusCode: 404 });
      }

      assertVersion('resourceVersion', request.resourceVersion, resource.resourceVersion);
      assertVersion('walletVersion', request.walletVersion, wallet.balanceVersion);
      assertVersion('slotVersion', request.slotVersion, slot.slotVersion);

      const unlockedSlots = getUnlockedTraitSlots(slot.breakthroughStage);
      if (unlockedSlots <= 0) {
        throw new BusinessError({ code: ErrorCode.BadRequest, message: 'No unlocked trait slots.', statusCode: 400 });
      }
      const beforeTraits = normalizeTraitRows(slot.traits);
      if (request.mode === 'basic') {
        validateLockedTraitSlots(lockedTraitSlotIndexes, unlockedSlots, beforeTraits);
      }
      if (request.mode !== 'basic' && (typeof request.targetSlotIndex !== 'number' || request.targetSlotIndex < 1 || request.targetSlotIndex > unlockedSlots)) {
        throwBadRequest('targetSlotIndex must refer to an unlocked trait slot.');
      }

      const factionCode = toFactionAdvantageCode(resource.player?.faction?.code);
      const rollRule = SPIRIT_TRAIT_ROLL_RULES[request.mode];
      if (slot.breakthroughStage < rollRule.unlockBreakthroughStage) {
        throw new BusinessError({ code: ErrorCode.BadRequest, message: 'Trait roll mode is not unlocked.', statusCode: 400 });
      }
      if (request.mode === 'basic' && lockedTraitSlotIndexes.length > 0 && slot.level < 50) {
        throw new BusinessError({ code: ErrorCode.BadRequest, message: 'Trait slot locking unlocks at level 50.', statusCode: 400 });
      }
      const baseCost = request.mode === 'basic'
        ? { ...rollRule.cost, gold: getBasicSpiritTraitRollGoldCost(slot.level) }
        : rollRule.cost;
      const cost = {
        ...baseCost,
        gold: applyFactionSpiritTraitRollGoldCost(baseCost.gold, factionCode),
        tianjiTalisman: request.mode === 'basic' ? lockedTraitSlotIndexes.length : 0,
      };
      if (resource.spiritMarrow < cost.marrow || resource.spiritJade < cost.jade || resource.tianjiTalisman < cost.tianjiTalisman) {
        throw new BusinessError({ code: ErrorCode.Conflict, message: 'Insufficient trait roll materials.', statusCode: 409 });
      }
      if (wallet.vaultGold < cost.gold) {
        throw new BusinessError({ code: ErrorCode.InsufficientVaultGold, message: 'Insufficient vault gold.', statusCode: 409 });
      }

      const consumed = {
        material,
        gold: cost.gold,
        marrow: cost.marrow,
        jade: cost.jade,
        tianjiTalisman: cost.tianjiTalisman,
        lockedTraitSlotIndexes,
        excludeCandidateIds,
      };

      await client.playerSpiritResource.update({
        where: { playerId },
        data: {
          spiritMarrow: { decrement: cost.marrow },
          spiritJade: { decrement: cost.jade },
          tianjiTalisman: { decrement: cost.tianjiTalisman },
          resourceVersion: { increment: 1 },
        },
      });
      if (cost.gold > 0) {
        await client.playerWallet.update({
          where: { playerId },
          data: {
            vaultGold: { decrement: cost.gold },
            balanceVersion: { increment: 1 },
          },
        });
        await this.auditService.createWalletChangeLog(client, {
          playerId,
          walletBucket: 'vault',
          changeType: 'spirit-roll-traits',
          deltaGold: -cost.gold,
          beforeGold: wallet.vaultGold,
          afterGold: wallet.vaultGold - cost.gold,
          relatedEntityType: 'spirit-slot',
          relatedEntityId: slot.id,
          requestIdempotencyKey: idempotencyKey ?? null,
          note: `Roll spirit traits in ${request.mode} mode with ${material}.`,
        });
      }
      if (request.mode === 'basic') {
        const lockedSlotSet = new Set(lockedTraitSlotIndexes);
        const resultTraits = rollFullRandomTraitsWithLocks(unlockedSlots, beforeTraits, lockedSlotSet);
        const refreshedSlotIndexes = resultTraits
          .map((trait) => trait.slotIndex)
          .filter((slotIndex) => !lockedSlotSet.has(slotIndex));
        if (refreshedSlotIndexes.length > 0) {
          await client.playerSpiritTrait.deleteMany({
            where: {
              spiritSlotId: slot.id,
              slotIndex: { in: refreshedSlotIndexes },
            },
          });
        }
        for (const trait of resultTraits.filter((item) => !lockedSlotSet.has(item.slotIndex))) {
          const definition = getTraitDefinition(trait.traitCode);
          await client.playerSpiritTrait.create({
            data: {
              spiritSlotId: slot.id,
              slotIndex: trait.slotIndex,
              traitCode: definition.code,
              traitValue: definition.value,
              sourceType: 'roll',
            },
          });
        }
        await client.playerSpiritSlot.update({
          where: { id: slot.id },
          data: { slotVersion: { increment: 1 } },
        });
        await client.spiritTraitRollLog.create({
          data: {
            playerId,
            spiritSlotId: slot.id,
            mode: request.mode,
            lockedSlotIndex: lockedTraitSlotIndexes.length === 1 ? lockedTraitSlotIndexes[0] : null,
            targetSlotIndex: null,
            targetTraitCode: null,
            consumedJson: consumed as unknown as Prisma.InputJsonValue,
            beforeTraitsJson: beforeTraits as unknown as Prisma.InputJsonValue,
            resultTraitsJson: resultTraits as unknown as Prisma.InputJsonValue,
            candidateResultsJson: resultTraits as unknown as Prisma.InputJsonValue,
            status: 'APPLIED',
            selectedTraitCode: null,
            resolvedAt: new Date(),
            requestIdempotencyKey: idempotencyKey ?? null,
          },
        });
        const contributionConfig = await this.taskConfigService.getDailyFactionTaskConfig('spirit-roll-traits', client);
        if (contributionConfig?.isEnabled && contributionConfig.rewardContribution > 0) {
          await grantFactionContribution(client, {
            playerId,
            contribution: contributionConfig.rewardContribution,
            sourceType: 'spirit-roll-traits',
            sourceId: slot.id,
            metadata: {
              mode: request.mode,
            },
          });
        }
        const lockedSummary = lockedTraitSlotIndexes.length > 0 ? `，已锁定 ${lockedTraitSlotIndexes.length} 条词条` : '';
        const response = await this.buildSpiritMutationResponse(client, playerId, (slot.spiritDefinition?.label ?? '灵宠') + ` 金币重铸已完成${lockedSummary}。`);
        await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-slot', slot.id);
        return response;
      }

      const targetSlotIndex = request.targetSlotIndex;
      if (typeof targetSlotIndex !== 'number') {
        throwBadRequest('targetSlotIndex must refer to an unlocked trait slot.');
      }
      const currentTrait = beforeTraits.find((trait) => trait.slotIndex === targetSlotIndex) ?? null;
      if (request.mode === 'advanced' && excludeCandidateIds.length > 0) {
        await client.spiritTraitRollLog.updateMany({
          where: {
            playerId,
            spiritSlotId: slot.id,
            mode: request.mode,
            targetSlotIndex,
            status: 'PENDING',
          },
          data: {
            status: 'KEPT',
            selectedTraitCode: null,
            resolvedAt: new Date(),
          },
        });
      }
      const candidates = rollTraitCandidates(request.mode, currentTrait?.traitCode ?? null, excludeCandidateIds);
      if (candidates.length <= 0) {
        throwBadRequest('No available trait roll candidates.');
      }
      const rollLog = await client.spiritTraitRollLog.create({
        data: {
          playerId,
          spiritSlotId: slot.id,
          mode: request.mode,
          lockedSlotIndex: null,
          targetSlotIndex,
          targetTraitCode: null,
          consumedJson: consumed as unknown as Prisma.InputJsonValue,
          beforeTraitsJson: beforeTraits as unknown as Prisma.InputJsonValue,
          resultTraitsJson: beforeTraits as unknown as Prisma.InputJsonValue,
          candidateResultsJson: candidates as unknown as Prisma.InputJsonValue,
          status: 'PENDING',
          requestIdempotencyKey: idempotencyKey ?? null,
        },
      });
      const contributionConfig = await this.taskConfigService.getDailyFactionTaskConfig('spirit-roll-traits', client);
      if (contributionConfig?.isEnabled && contributionConfig.rewardContribution > 0) {
        await grantFactionContribution(client, {
          playerId,
          contribution: contributionConfig.rewardContribution,
          sourceType: 'spirit-roll-traits',
          sourceId: slot.id,
          metadata: {
            mode: request.mode,
          },
        });
      }

      const mutationResponse = await this.buildSpiritMutationResponse(client, playerId, (slot.spiritDefinition?.label ?? '灵宠') + ' 洗练候选已生成。');
      const response: ClientRollSpiritTraitsResponse = {
        ...mutationResponse,
        traitRoll: {
          rollLogId: rollLog.id,
          slotIndex: request.slotIndex,
          targetSlotIndex,
          mode: request.mode,
          material,
          currentTrait: currentTrait ? toTraitRollCandidate(currentTrait.traitCode) : null,
          candidates,
          excludeCandidateIds: [...excludeCandidateIds, ...candidates.map((candidate) => candidate.candidateId)],
        },
      };
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-slot', slot.id);
      return response;
    });
  }

  async resolveSpiritTraitRoll(
    playerId: string,
    request: ClientResolveSpiritTraitRollRequest,
    headerIdempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    validateResolveSpiritTraitRollRequest(request);
    const idempotencyKey = normalizeIdempotencyKey(headerIdempotencyKey ?? request.requestIdempotencyKey);

    return this.prisma.transaction(async (client) => {
      const requestHash = hashRequest({
        endpoint: 'resolve-trait-roll',
        rollLogId: request.rollLogId,
        selectedTraitCode: request.selectedTraitCode ?? null,
        slotVersion: request.slotVersion ?? null,
      });
      const idempotencyRecord = await this.prepareIdempotencyRecord(client, playerId, 'spirit-resolve-trait-roll', idempotencyKey, requestHash);
      if (idempotencyRecord?.status === 'completed' && idempotencyRecord.responseSnapshotJson) {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientSpiritMutationResponse;
      }

      const rollLog = await client.spiritTraitRollLog.findUnique({
        where: { id: request.rollLogId },
        select: {
          id: true,
          playerId: true,
          spiritSlotId: true,
          mode: true,
          targetSlotIndex: true,
          beforeTraitsJson: true,
          candidateResultsJson: true,
          status: true,
          spiritSlot: {
            select: {
              id: true,
              slotIndex: true,
              slotVersion: true,
              spiritDefinition: { select: { label: true } },
            },
          },
        },
      });
      if (!rollLog || rollLog.playerId !== playerId) {
        throw new BusinessError({ code: ErrorCode.NotFound, message: 'Trait roll not found.', statusCode: 404 });
      }
      if (rollLog.status !== 'PENDING') {
        throw new BusinessError({ code: ErrorCode.Conflict, message: 'Trait roll has already been resolved.', statusCode: 409 });
      }
      if (!rollLog.targetSlotIndex || !rollLog.spiritSlot) {
        throwBadRequest('Invalid trait roll log.');
      }

      assertVersion('slotVersion', request.slotVersion, rollLog.spiritSlot.slotVersion);
      const candidates = parseTraitRollCandidates(rollLog.candidateResultsJson);
      const selectedTraitCode = request.selectedTraitCode ?? null;
      if (selectedTraitCode) {
        if (!candidates.some((candidate) => candidate.traitCode === selectedTraitCode)) {
          throwBadRequest('selectedTraitCode must be one of the roll candidates.');
        }
      }

      const beforeTraits = parseTraitRows(rollLog.beforeTraitsJson);
      let resultTraits = beforeTraits;
      if (selectedTraitCode) {
        const definition = getTraitDefinition(selectedTraitCode);
        await client.playerSpiritTrait.upsert({
          where: {
            spiritSlotId_slotIndex: {
              spiritSlotId: rollLog.spiritSlotId,
              slotIndex: rollLog.targetSlotIndex,
            },
          },
          create: {
            spiritSlotId: rollLog.spiritSlotId,
            slotIndex: rollLog.targetSlotIndex,
            traitCode: definition.code,
            traitValue: definition.value,
            sourceType: 'roll',
          },
          update: {
            traitCode: definition.code,
            traitValue: definition.value,
            sourceType: 'roll',
          },
        });
        await client.playerSpiritSlot.update({
          where: { id: rollLog.spiritSlotId },
          data: { slotVersion: { increment: 1 } },
        });
        resultTraits = mergeTraitRows(beforeTraits, { slotIndex: rollLog.targetSlotIndex, traitCode: definition.code });
      }

      await client.spiritTraitRollLog.update({
        where: { id: rollLog.id },
        data: {
          status: selectedTraitCode ? 'APPLIED' : 'KEPT',
          selectedTraitCode,
          resolvedAt: new Date(),
          resultTraitsJson: resultTraits as unknown as Prisma.InputJsonValue,
        },
      });

      const summary = selectedTraitCode
        ? (rollLog.spiritSlot.spiritDefinition?.label ?? '灵宠') + ' 词条已替换。'
        : (rollLog.spiritSlot.spiritDefinition?.label ?? '灵宠') + ' 已保留原词条。';
      const response = await this.buildSpiritMutationResponse(client, playerId, summary);
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-slot', rollLog.spiritSlotId);
      return response;
    });
  }

  async buyShopItem(
    playerId: string,
    request: ClientBuySpiritShopItemRequest,
    headerIdempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    validateBuyShopItemRequest(request);
    const idempotencyKey = normalizeIdempotencyKey(headerIdempotencyKey ?? request.requestIdempotencyKey);
    const item = SPIRIT_SHOP_ITEMS.find((entry) => entry.itemId === request.itemId);
    if (!item) {
      throwBadRequest('Unknown shop item.');
    }

    return this.prisma.transaction(async (client) => {
      const requestHash = hashRequest({
        endpoint: 'shop-buy',
        itemId: request.itemId,
        resourceVersion: request.resourceVersion ?? null,
      });
      const idempotencyRecord = await this.prepareIdempotencyRecord(client, playerId, 'spirit-shop-buy', idempotencyKey, requestHash);
      if (idempotencyRecord?.status === 'completed' && idempotencyRecord.responseSnapshotJson) {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientSpiritMutationResponse;
      }

      const resource = await client.playerSpiritResource.findUnique({
        where: { playerId },
        select: {
          tianjiTalisman: true,
          resourceVersion: true,
        },
      });

      if (!resource) {
        throw new BusinessError({ code: ErrorCode.NotFound, message: 'Player spirit resource not found.', statusCode: 404 });
      }

      assertVersion('resourceVersion', request.resourceVersion, resource.resourceVersion);

      if (resource.tianjiTalisman < item.priceTianjiTalisman) {
        throw new BusinessError({ code: ErrorCode.Conflict, message: 'Insufficient Tianji talisman.', statusCode: 409 });
      }

      const periodKey = getShopLimitPeriodKey(item.itemId);
      const limit = getShopLimit(item.itemId);
      if (limit !== null && periodKey) {
        const used = await client.spiritShopPurchaseLog.count({
          where: { playerId, itemId: item.itemId, periodKey },
        });
        if (used >= limit) {
          throw new BusinessError({ code: ErrorCode.Conflict, message: 'Shop item purchase limit reached.', statusCode: 409 });
        }
      }

      await client.playerSpiritResource.update({
        where: { playerId },
        data: {
          tianjiTalisman: { decrement: item.priceTianjiTalisman },
          ...buildSpiritRewardUpdateData(item.rewards),
          resourceVersion: { increment: 1 },
        },
      });
      await client.spiritShopPurchaseLog.create({
        data: {
          playerId,
          itemId: item.itemId,
          periodKey,
          consumedTianjiTalisman: item.priceTianjiTalisman,
          rewardJson: item.rewards as unknown as Prisma.InputJsonValue,
          requestIdempotencyKey: idempotencyKey ?? null,
        },
      });

      const response = await this.buildSpiritMutationResponse(client, playerId, `已兑换 ${item.label}。`);
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-shop-item', item.itemId);
      return response;
    });
  }

  async claimAdReward(
    playerId: string,
    request: ClientClaimSpiritAdRewardRequest,
    headerIdempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    validateClaimAdRewardRequest(request);
    const idempotencyKey = normalizeIdempotencyKey(headerIdempotencyKey ?? request.requestIdempotencyKey);

    return this.prisma.transaction(async (client) => {
      const requestHash = hashRequest({
        endpoint: 'shop-ad-reward',
        resourceVersion: request.resourceVersion ?? null,
      });
      const idempotencyRecord = await this.prepareIdempotencyRecord(client, playerId, 'spirit-shop-ad-reward', idempotencyKey, requestHash);
      if (idempotencyRecord?.status === 'completed' && idempotencyRecord.responseSnapshotJson) {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientSpiritMutationResponse;
      }

      const resource = await client.playerSpiritResource.findUnique({
        where: { playerId },
        select: { resourceVersion: true },
      });

      if (!resource) {
        throw new BusinessError({ code: ErrorCode.NotFound, message: 'Player spirit resource not found.', statusCode: 404 });
      }

      assertVersion('resourceVersion', request.resourceVersion, resource.resourceVersion);

      const dateKey = getLocalDateKey();
      const usedToday = await client.spiritAdRewardLog.count({ where: { playerId, dateKey } });
      if (usedToday >= SPIRIT_AD_DAILY_LIMIT) {
        throw new BusinessError({ code: ErrorCode.Conflict, message: 'Daily ad reward limit reached.', statusCode: 409 });
      }

      await client.playerSpiritResource.update({
        where: { playerId },
        data: {
          tianjiTalisman: { increment: SPIRIT_AD_TALISMAN_REWARD },
          resourceVersion: { increment: 1 },
        },
      });
      await client.spiritAdRewardLog.create({
        data: {
          playerId,
          dateKey,
          tianjiTalismanReward: SPIRIT_AD_TALISMAN_REWARD,
          bonusRewardJson: [] as unknown as Prisma.InputJsonValue,
          requestIdempotencyKey: idempotencyKey ?? null,
        },
      });

      const response = await this.buildSpiritMutationResponse(client, playerId, `已获得天机符 x${SPIRIT_AD_TALISMAN_REWARD}。`);
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-ad-reward', dateKey);
      return response;
    });
  }

  async setMainSpirit(
    playerId: string,
    request: ClientSetMainSpiritRequest,
    headerIdempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    validateSlotRequest(request, 'slotIndex');
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

      const response = await this.buildSpiritMutationResponse(client, playerId, (targetSlot.spiritDefinition?.label ?? '灵宠') + ' 已设为主位。');
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-slot', targetSlot.id);
      return response;
    });
  }

  async dissolveSpirit(
    playerId: string,
    request: ClientDissolveSpiritRequest,
    headerIdempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    validateSlotRequest(request, 'slotIndex');
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
          maxHp: 0,
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

      const response = await this.buildSpiritMutationResponse(client, playerId, `${slot.spiritDefinition.label} 已解散。`);
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-slot', slot.id);
      return response;
    });
  }

  async composeSpirit(
    playerId: string,
    request: ClientComposeSpiritRequest,
    headerIdempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    validateComposeSpiritRequest(request);
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

      const [targetSlot, codexEntry, existingMainSlot, starterOwnedEverEntry] = await Promise.all([
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
            isMain: true,
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
            hasSeen: true,
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
        client.playerSpiritSlot.findFirst({
          where: {
            playerId,
            isMain: true,
            spiritDefinitionId: { not: null },
          },
          select: { id: true },
        }),
        client.playerSpiritCodex.findFirst({
          where: {
            playerId,
            ownedEver: true,
            spiritDefinition: {
              spiritId: { in: [...STARTER_SPIRIT_IDS] },
            },
          },
          select: { id: true },
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

      const isStarterComposeGift = !existingMainSlot
        && !starterOwnedEverEntry
        && codexEntry.hasSeen
        && STARTER_SPIRIT_IDS.includes(codexEntry.spiritDefinition.spiritId as typeof STARTER_SPIRIT_IDS[number]);
      if (!isStarterComposeGift && !codexEntry.readyToCompose && codexEntry.shardCount < codexEntry.spiritDefinition.shardUnlockRequired) {
        throw new BusinessError({
          code: ErrorCode.Conflict,
          message: 'Spirit shards are not ready to compose.',
          statusCode: 409,
        });
      }

      const maxHp = calculateSpiritMaxHp(codexEntry.spiritDefinition.baseHp, codexEntry.spiritDefinition.growthHp, 1);
      const now = new Date();

      await client.playerSpiritSlot.update({
        where: { id: targetSlot.id },
        data: {
          spiritDefinitionId: codexEntry.spiritDefinitionId,
          isMain: targetSlot.isMain || !existingMainSlot,
          level: 1,
          exp: 0,
          element: toPrismaElement(request.element),
          maxHp,
          acquiredAt: now,
          lastExpSettledAt: now,
          dissolvedAt: null,
          slotVersion: { increment: 1 },
        },
      });
      await client.playerSpiritCodex.update({
        where: { id: codexEntry.id },
        data: {
          shardCount: isStarterComposeGift
            ? 0
            : Math.max(codexEntry.shardCount - codexEntry.spiritDefinition.shardUnlockRequired, 0),
          readyToCompose: false,
          ownedCurrent: true,
          ownedEver: true,
          hasSeen: true,
          readyAt: null,
          lastOwnedAt: now,
          codexVersion: { increment: 1 },
        },
      });

      const response = await this.buildSpiritMutationResponse(client, playerId, codexEntry.spiritDefinition.label + ' 已合成入栏。');
      if (isStarterComposeGift) {
        await client.playerSpiritCodex.updateMany({
          where: {
            playerId,
            id: { not: codexEntry.id },
            ownedCurrent: false,
            ownedEver: false,
            spiritDefinition: {
              spiritId: { in: [...STARTER_SPIRIT_IDS] },
            },
          },
          data: {
            shardCount: 0,
            readyToCompose: false,
            readyAt: null,
            codexVersion: { increment: 1 },
          },
        });
        response.spirit.codex = response.spirit.codex.map((entry) => (
          STARTER_SPIRIT_IDS.includes(entry.spiritId as typeof STARTER_SPIRIT_IDS[number]) && entry.spiritId !== codexEntry.spiritDefinition.spiritId
            ? { ...entry, shardCount: 0, readyToCompose: false }
            : entry
        ));
        response.spirit.readyToCompose = response.spirit.readyToCompose.filter((entry) => (
          !STARTER_SPIRIT_IDS.includes(entry.spiritId as typeof STARTER_SPIRIT_IDS[number])
          || entry.spiritId === codexEntry.spiritDefinition.spiritId
        ));
      }

      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-slot', targetSlot.id);
      return response;
    });
  }

  private async buildSpiritMutationResponse(
    client: Prisma.TransactionClient,
    playerId: string,
    summary: string,
    now: Date = new Date(),
  ): Promise<ClientSpiritMutationResponse> {
    return {
      app: APP_NAME,
      summary,
      spirit: await this.getSpiritState(playerId, client, now),
      home: await this.clientReadService.getHomeSummary(playerId, client, now),
      scenes: await this.clientReadService.getSceneContent(playerId, client, now),
    };
  }

  private async findSpiritReadModel(
    playerId: string,
    client: Prisma.TransactionClient | PrismaClient,
  ) {
    const dateKey = getLocalDateKey();
    const weekKey = getWeekPeriodKey();
    const [resource, slots, codex, shopPurchases, adRewardUsedToday] = await Promise.all([
      client.playerSpiritResource.findUnique({
        where: { playerId },
        select: {
          player: {
            select: {
              faction: {
                select: {
                  code: true,
                },
              },
            },
          },
          playerId: true,
          spiritSoul: true,
          spiritRoot: true,
          spiritMarrow: true,
          spiritJade: true,
          ordinarySoul: true,
          rareSoul: true,
          legendarySoul: true,
          tianjiTalisman: true,
          dailyIntelFreeUsed: true,
          dailyIntelTalismanUsed: true,
          dailyIntelDateKey: true,
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
          breakthroughStage: true,
          satiatedUntil: true,
          lastExpSettledAt: true,
          element: true,
          maxHp: true,
          slotVersion: true,
          spiritDefinition: {
            select: {
              spiritId: true,
            },
          },
          traits: {
            select: {
              slotIndex: true,
              traitCode: true,
              traitValue: true,
              sourceType: true,
            },
            orderBy: { slotIndex: 'asc' },
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
              baseAttack: true,
              baseHp: true,
              growthAttack: true,
              growthHp: true,
              lore: true,
              sortOrder: true,
            },
          },
        },
      }),
      client.spiritShopPurchaseLog.findMany({
        where: {
          playerId,
          OR: [
            { periodKey: dateKey },
            { periodKey: weekKey },
          ],
        },
        select: {
          itemId: true,
          periodKey: true,
        },
      }),
      client.spiritAdRewardLog.count({
        where: {
          playerId,
          dateKey,
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

    return {
      resource: {
        ...resource,
        factionCode: resource.player?.faction?.code ?? null,
      },
      slots,
      codex,
      shopPurchases,
      adRewardUsedToday,
    };
  }

  private async ensureNaturalTraitSlots(client: Prisma.TransactionClient, spiritSlotId: string, breakthroughStage: number): Promise<void> {
    const unlockedSlots = getUnlockedTraitSlots(breakthroughStage);
    if (unlockedSlots <= 0) {
      return;
    }

    const existingTraits = await client.playerSpiritTrait.findMany({
      where: { spiritSlotId },
      select: { slotIndex: true, traitCode: true },
      orderBy: { slotIndex: 'asc' },
    });
    const usedCodes = new Set(existingTraits.map((trait) => trait.traitCode));

    for (let slotIndex = 1; slotIndex <= unlockedSlots; slotIndex += 1) {
      if (existingTraits.some((trait) => trait.slotIndex === slotIndex)) {
        continue;
      }
      const definition = randomTraitDefinition(false, usedCodes);
      usedCodes.add(definition.code);
      await client.playerSpiritTrait.create({
        data: {
          spiritSlotId,
          slotIndex,
          traitCode: definition.code,
          traitValue: definition.value,
          sourceType: 'natural',
        },
      });
    }
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

  private async recordDailyTaskProgress(
    client: Prisma.TransactionClient,
    playerId: string,
    objectiveType: string,
    amount = 1,
    now: Date = new Date(),
  ): Promise<void> {
    if (amount <= 0) {
      return;
    }

    const taskIds = [
      ...DAILY_TASK_CONFIG.fixedTasks,
      ...DAILY_TASK_CONFIG.randomTasks,
      ...DAILY_TASK_CONFIG.catchupTasks,
    ]
      .filter((task) => task.objective.type === objectiveType)
      .map((task) => task.id);

    if (taskIds.length <= 0) {
      return;
    }

    const dateKey = getLocalDateKey(now);
    await this.dailyTaskLifecycleService.ensurePlayerDailyTasks(client, playerId, dateKey);

    const taskStates = await client.playerDailyTaskState.findMany({
      where: {
        playerId,
        dateKey,
        taskId: { in: taskIds },
        status: 'IN_PROGRESS',
      },
      select: {
        id: true,
        progress: true,
        target: true,
      },
    });

    for (const taskState of taskStates) {
      const nextProgress = Math.min(taskState.progress + amount, taskState.target);
      await client.playerDailyTaskState.update({
        where: { id: taskState.id },
        data: {
          progress: nextProgress,
          status: nextProgress >= taskState.target ? 'COMPLETED' : 'IN_PROGRESS',
        },
      });
    }
  }
}

function buildSpiritState(
  resource: SpiritReadResource,
  slots: Array<{
    slotIndex: number;
    isMain: boolean;
    level: number;
    exp: number;
    breakthroughStage: number;
    satiatedUntil: Date | null;
    lastExpSettledAt: Date | null;
    element: SpiritElement | null;
    maxHp: number;
    slotVersion: number;
    spiritDefinition: {
      spiritId: string;
    } | null;
    traits: SpiritReadTrait[];
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
      baseAttack: number;
      baseHp: number;
      growthAttack: number;
      growthHp: number;
      lore: string | null;
      sortOrder: number;
    };
  }>,
  shopPurchases: Array<{ itemId: string; periodKey: string | null }>,
  adRewardUsedToday: number,
  now: Date = new Date(),
): ClientSpiritState {
  const mappedSlots: ClientSpiritSlot[] = slots.map((slot) => {
    const settled = slot.spiritDefinition ? settleSpiritProgress(slot, now, toFactionAdvantageCode(resource.factionCode)) : {
      level: slot.level,
      exp: slot.exp,
      breakthroughStage: slot.breakthroughStage,
      satiatedUntil: slot.satiatedUntil,
      lastExpSettledAt: slot.lastExpSettledAt,
    };
    const unlockedTraitSlots = getUnlockedTraitSlots(settled.breakthroughStage);
    return {
      slotIndex: slot.slotIndex,
      spiritId: slot.spiritDefinition?.spiritId ?? null,
      isMain: slot.isMain,
      level: settled.level,
      exp: settled.exp,
      currentLevelExpRequired: SPIRIT_LEVEL_EXP_REQUIRED,
      isAtBreakthroughNode: isAtPendingBreakthrough(settled.level, settled.breakthroughStage),
      breakthroughStage: settled.breakthroughStage,
      lastExpSettledAt: settled.lastExpSettledAt?.toISOString() ?? null,
      satiatedUntil: settled.satiatedUntil?.toISOString() ?? null,
      satiatedRemainingSeconds: Math.max(Math.floor(((settled.satiatedUntil?.getTime() ?? now.getTime()) - now.getTime()) / 1000), 0),
      satiatedExpBonusPercent: settled.satiatedUntil && settled.satiatedUntil.getTime() > now.getTime() ? 50 : 0,
      element: slot.element ? toClientElement(slot.element) : null,
      maxHp: slot.maxHp,
      traits: mapTraits(slot.traits).filter((trait) => trait.slotIndex <= unlockedTraitSlots),
      unlockedTraitSlots,
      slotVersion: slot.slotVersion,
    };
  });
  const mappedCodex: ClientSpiritCodexEntry[] = codexEntries
    .sort((left, right) => left.spiritDefinition.sortOrder - right.spiritDefinition.sortOrder)
    .map((entry) => {
      const codexState = resolveSpiritCodexState(entry);
      return {
        spiritId: entry.spiritDefinition.spiritId,
        hasSeen: entry.hasSeen,
        shardCount: entry.shardCount,
        readyToCompose: entry.readyToCompose,
        ownedCurrent: entry.ownedCurrent,
        ownedEver: entry.ownedEver,
        codexState,
        sceneVisibility: resolveSpiritSceneVisibility(codexState),
        displayName: resolveSpiritDisplayName(codexState, entry.spiritDefinition.label),
        definition: toClientDefinition(entry.spiritDefinition),
      };
    });

  const mainSlot = mappedSlots.find((slot) => slot.isMain && slot.spiritId !== null) ?? null;

  return {
    spiritSoul: resource.spiritSoul,
    spiritRoot: resource.spiritRoot,
    spiritMarrow: resource.spiritMarrow,
    spiritJade: resource.spiritJade,
    ordinarySoul: resource.ordinarySoul,
    rareSoul: resource.rareSoul,
    legendarySoul: resource.legendarySoul,
    tianjiTalisman: resource.tianjiTalisman,
    dailyIntelFreeUsed: getEffectiveDailyIntelFreeUsed(resource),
    dailyIntelTalismanUsed: getEffectiveDailyIntelTalismanUsed(resource),
    resourceVersion: resource.resourceVersion,
    mainSlot,
    slots: mappedSlots,
    codex: mappedCodex,
    readyToCompose: mappedCodex.filter((entry) => entry.readyToCompose),
    factionAdvantage: getCurrentFactionAdvantageConfig(toFactionAdvantageCode(resource.factionCode)) ?? undefined,
    breakthroughRequirement: buildBreakthroughRequirement(mainSlot, resource),
    shop: {
      items: buildShopItemsForState(shopPurchases),
      adReward: {
        dailyLimit: SPIRIT_AD_DAILY_LIMIT,
        usedToday: Math.min(adRewardUsedToday, SPIRIT_AD_DAILY_LIMIT),
        tianjiTalisman: SPIRIT_AD_TALISMAN_REWARD,
        bonusPool: ['天机符'],
      },
    },
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
  baseAttack: number;
  baseHp: number;
  growthAttack: number;
  growthHp: number;
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
    baseAttack: definition.baseAttack,
    baseHp: definition.baseHp,
    growthAttack: definition.growthAttack,
    growthHp: definition.growthHp,
    lore: definition.lore,
  };
}

function resolveSpiritCodexState(entry: {
  spiritDefinition: {
    spiritId: string;
  };
  hasSeen: boolean;
  shardCount: number;
  readyToCompose: boolean;
  ownedCurrent: boolean;
  ownedEver: boolean;
}): ClientCodexState {
  if (entry.ownedCurrent || entry.ownedEver || entry.readyToCompose) {
    return 'unlocked';
  }

  if (entry.hasSeen && STARTER_SPIRIT_IDS.includes(entry.spiritDefinition.spiritId as typeof STARTER_SPIRIT_IDS[number])) {
    return 'visible-progress';
  }

  if (entry.shardCount > 0) {
    return 'visible-progress';
  }

  return 'hidden';
}

function resolveSpiritSceneVisibility(codexState: ClientCodexState): ClientSceneVisibility {
  return codexState === 'hidden' ? 'masked' : 'named';
}

function resolveSpiritDisplayName(codexState: ClientCodexState, label: string): string {
  return codexState === 'hidden' ? '未知灵宠' : label;
}

function buildBreakthroughRequirement(
  slot: ClientSpiritSlot | null,
  resource: SpiritReadResource,
): ClientSpiritState['breakthroughRequirement'] {
  if (!slot?.spiritId || !slot.isAtBreakthroughNode) {
    return null;
  }

  const stage = getBreakthroughStageForLevel(slot.level);
  if (stage === null) {
    return null;
  }
  const cost = SPIRIT_BREAKTHROUGH_COSTS[stage];
  if (!cost) {
    return null;
  }

  const required = applyFactionSpiritBreakthroughSoulCost(cost.count, toFactionAdvantageCode(resource.factionCode));
  const owned = getSoulCount(resource, cost.quality);

  return {
    stage,
    level: slot.level,
    quality: cost.quality,
    label: getSoulQualityLabel(cost.quality),
    required,
    owned,
    canBreakthrough: owned >= required,
  };
}

function buildShopItemsForState(shopPurchases: Array<{ itemId: string; periodKey: string | null }>): ClientSpiritShopItem[] {
  const currentDateKey = getLocalDateKey();
  const currentWeekKey = getWeekPeriodKey();

  return SPIRIT_SHOP_ITEMS.map((item) => {
    const limit = getShopLimit(item.itemId);
    const periodKey = getShopLimitPeriodKey(item.itemId, currentDateKey, currentWeekKey);
    const used = limit === null || !periodKey
      ? 0
      : shopPurchases.filter((purchase) => purchase.itemId === item.itemId && purchase.periodKey === periodKey).length;

    return {
      ...item,
      remainingPurchases: limit === null ? null : Math.max(limit - used, 0),
    };
  });
}

function getSoulQualityLabel(quality: 'ordinary' | 'rare' | 'legendary'): string {
  if (quality === 'legendary') {
    return '浼犺鍏介瓊';
  }
  if (quality === 'rare') {
    return '稀有兽魂';
  }
  return '普通兽魂';
}

function toClientElement(element: SpiritElement): ClientSpiritElement {
  return element.toLowerCase() as ClientSpiritElement;
}

function toPrismaElement(element: ClientSpiritElement): SpiritElement {
  return element.toUpperCase() as SpiritElement;
}

function mapTraits(traits: SpiritReadTrait[]): ClientSpiritTrait[] {
  return traits
    .sort((left, right) => left.slotIndex - right.slotIndex)
    .map((trait) => {
      const definition = getTraitDefinition(trait.traitCode);
      return {
        slotIndex: trait.slotIndex,
        traitCode: definition.code,
        label: definition.label,
        description: definition.description,
        value: trait.traitValue,
        sourceType: trait.sourceType,
      };
    });
}

function getUnlockedTraitSlots(breakthroughStage: number): number {
  return Math.min(Math.max(Math.floor(breakthroughStage), 0), 5);
}

function toFactionAdvantageCode(value: string | null | undefined): FactionAdvantageCode {
  return value === 'human' || value === 'immortal' || value === 'demon' ? value : null;
}

function getBreakthroughStageForLevel(level: number): number | null {
  if (level < 9 || level >= SPIRIT_MAX_LEVEL) {
    return null;
  }

  const stage = Math.floor((level + 1) / 10);
  return stage >= 1 && stage <= 5 && level === stage * 10 - 1 ? stage : null;
}

function getCompletedBreakthroughStageForLevel(level: number): number {
  if (level >= SPIRIT_MAX_LEVEL) {
    return 5;
  }

  return Math.min(Math.max(Math.floor(level / 10), 0), 4);
}

function isAtPendingBreakthrough(level: number, breakthroughStage: number): boolean {
  const stage = getBreakthroughStageForLevel(level);
  return stage !== null && breakthroughStage < stage;
}

function getPassiveExpPerMinute(level: number, factionCode: FactionAdvantageCode = null): number {
  let baseExpPerMinute = 150;

  if (level <= 2) {
    baseExpPerMinute = 5000;
  } else if (level <= 10) {
    baseExpPerMinute = 1000;
  } else if (level <= 20) {
    baseExpPerMinute = 500;
  } else if (level <= 30) {
    baseExpPerMinute = 250;
  }

  const tunedBaseExpPerMinute = Math.floor(baseExpPerMinute * SPIRIT_BALANCE_CONFIG.passiveExpRateBps / 10_000);
  return applyFactionSpiritPassiveExpBonus(tunedBaseExpPerMinute, factionCode);
}

function settleSpiritProgress(slot: {
  level: number;
  exp: number;
  breakthroughStage: number;
  satiatedUntil: Date | null;
  lastExpSettledAt: Date | null;
}, now: Date, factionCode: FactionAdvantageCode = null): {
  level: number;
  exp: number;
  breakthroughStage: number;
  satiatedUntil: Date | null;
  lastExpSettledAt: Date | null;
} {
  const normalizedSlot = {
    ...slot,
    breakthroughStage: Math.max(slot.breakthroughStage, getCompletedBreakthroughStageForLevel(slot.level)),
  };

  if (isAtPendingBreakthrough(normalizedSlot.level, normalizedSlot.breakthroughStage)) {
    return { ...normalizedSlot, exp: Math.min(normalizedSlot.exp, SPIRIT_LEVEL_EXP_REQUIRED), lastExpSettledAt: now };
  }

  const lastSettledAt = normalizedSlot.lastExpSettledAt ?? now;
  const elapsedSeconds = Math.max(Math.floor((now.getTime() - lastSettledAt.getTime()) / 1000), 0);
  if (elapsedSeconds <= 0) {
    return normalizedSlot;
  }

  const satiatedUntilMs = normalizedSlot.satiatedUntil?.getTime() ?? 0;
  const lastSettledAtMs = lastSettledAt.getTime();
  const nowMs = now.getTime();
  const satiatedSeconds = satiatedUntilMs > lastSettledAtMs
    ? Math.max(Math.floor((Math.min(satiatedUntilMs, nowMs) - lastSettledAtMs) / 1000), 0)
    : 0;
  const normalSeconds = Math.max(elapsedSeconds - satiatedSeconds, 0);
  const passiveExpPerMinute = getPassiveExpPerMinute(slot.level, factionCode);
  const normalExpGain = Math.floor(passiveExpPerMinute * normalSeconds / 60);
  const satiatedExpGain = Math.floor(passiveExpPerMinute * satiatedSeconds * (10_000 + SPIRIT_ROOT_ECONOMY_CONFIG.feed.expBonusBps) / 10_000 / 60);
  const expGain = normalExpGain + satiatedExpGain;
  return applyExpGain({ ...normalizedSlot, lastExpSettledAt: now }, expGain);
}

function applyExpGain(state: {
  level: number;
  exp: number;
  breakthroughStage: number;
  satiatedUntil: Date | null;
  lastExpSettledAt: Date | null;
}, expGain: number) {
  let level = state.level;
  let exp = Math.max(state.exp + Math.max(expGain, 0), 0);
  const breakthroughStage = Math.max(state.breakthroughStage, getCompletedBreakthroughStageForLevel(level));

  while (level < SPIRIT_MAX_LEVEL && exp >= SPIRIT_LEVEL_EXP_REQUIRED) {
    exp -= SPIRIT_LEVEL_EXP_REQUIRED;
    level += 1;
    if (isAtPendingBreakthrough(level, breakthroughStage)) {
      exp = 0;
      break;
    }
  }

  if (level >= SPIRIT_MAX_LEVEL) {
    level = SPIRIT_MAX_LEVEL;
    exp = 0;
  }

  return {
    ...state,
    level,
    breakthroughStage,
    exp,
  };
}

function normalizeTraitRows(traits: SpiritReadTrait[]): Array<{ slotIndex: number; traitCode: ClientSpiritTraitCode }> {
  return traits
    .sort((left, right) => left.slotIndex - right.slotIndex)
    .map((trait) => ({
      slotIndex: trait.slotIndex,
      traitCode: getTraitDefinition(trait.traitCode).code,
    }));
}

function normalizeLockedTraitSlotIndexes(value: unknown): number[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throwBadRequest('lockedTraitSlotIndexes must be an array.');
  }

  const normalized: number[] = [];
  for (const slotIndex of value) {
    if (!Number.isInteger(slotIndex) || slotIndex <= 0) {
      throwBadRequest('lockedTraitSlotIndexes must contain positive integers.');
    }
    if (normalized.includes(slotIndex)) {
      throwBadRequest('lockedTraitSlotIndexes cannot contain duplicate slots.');
    }
    normalized.push(slotIndex);
  }

  return normalized.sort((left, right) => left - right);
}

function normalizeExcludeCandidateIds(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throwBadRequest('excludeCandidateIds must be an array.');
  }

  const normalized: string[] = [];
  for (const candidateId of value) {
    if (typeof candidateId !== 'string' || candidateId.trim().length <= 0) {
      throwBadRequest('excludeCandidateIds must contain strings.');
    }
    const definition = SPIRIT_TRAIT_DEFINITIONS.find((entry) => entry.code === candidateId);
    if (!definition) {
      throwBadRequest('excludeCandidateIds must contain known candidate ids.');
    }
    if (normalized.includes(definition.code)) {
      continue;
    }
    normalized.push(definition.code);
  }

  return normalized;
}

function validateLockedTraitSlots(
  lockedTraitSlotIndexes: number[],
  unlockedSlots: number,
  beforeTraits: Array<{ slotIndex: number; traitCode: ClientSpiritTraitCode }>,
): void {
  if (lockedTraitSlotIndexes.length > MAX_SPIRIT_TRAIT_LOCKED_SLOTS) {
    throwBadRequest(`lockedTraitSlotIndexes cannot contain more than ${MAX_SPIRIT_TRAIT_LOCKED_SLOTS} slots.`);
  }
  if (lockedTraitSlotIndexes.length >= unlockedSlots) {
    throwBadRequest('lockedTraitSlotIndexes cannot lock every unlocked trait slot.');
  }

  for (const slotIndex of lockedTraitSlotIndexes) {
    if (slotIndex > unlockedSlots) {
      throwBadRequest('lockedTraitSlotIndexes must refer to unlocked trait slots.');
    }
    if (!beforeTraits.some((trait) => trait.slotIndex === slotIndex)) {
      throwBadRequest('lockedTraitSlotIndexes must refer to existing traits.');
    }
  }
}

function getTraitRollMaterial(mode: ClientSpiritActiveRollMode): ClientSpiritTraitRollMaterial {
  if (mode === 'normal') {
    return 'lingsui';
  }
  if (mode === 'advanced') {
    return 'lingyu';
  }
  return 'gold';
}

function rollFullRandomTraitsWithLocks(
  unlockedSlots: number,
  beforeTraits: Array<{ slotIndex: number; traitCode: ClientSpiritTraitCode }>,
  lockedSlotSet: Set<number>,
): Array<{ slotIndex: number; traitCode: ClientSpiritTraitCode }> {
  const result: Array<{ slotIndex: number; traitCode: ClientSpiritTraitCode }> = [];

  for (let slotIndex = 1; slotIndex <= unlockedSlots; slotIndex += 1) {
    if (lockedSlotSet.has(slotIndex)) {
      const existingTrait = beforeTraits.find((trait) => trait.slotIndex === slotIndex);
      if (existingTrait) {
        result.push(existingTrait);
      }
      continue;
    }

    const definition = randomTraitDefinition(true, new Set());
    result.push({ slotIndex, traitCode: definition.code });
  }

  return result.sort((left, right) => left.slotIndex - right.slotIndex);
}

function randomTraitDefinition(allowDuplicate: boolean, usedCodes: Set<string>) {
  const pool = allowDuplicate ? SPIRIT_TRAIT_DEFINITIONS : SPIRIT_TRAIT_DEFINITIONS.filter((definition) => !usedCodes.has(definition.code));
  return pool[Math.floor(Math.random() * pool.length)] ?? SPIRIT_TRAIT_DEFINITIONS[0];
}

function parseTraitRows(value: Prisma.JsonValue): Array<{ slotIndex: number; traitCode: ClientSpiritTraitCode }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const row = item as { slotIndex?: unknown; traitCode?: unknown };
      if (typeof row.slotIndex !== 'number' || typeof row.traitCode !== 'string') {
        return null;
      }
      return {
        slotIndex: row.slotIndex,
        traitCode: getTraitDefinition(row.traitCode).code,
      };
    })
    .filter((item): item is { slotIndex: number; traitCode: ClientSpiritTraitCode } => Boolean(item));
}

function parseTraitRollCandidates(value: Prisma.JsonValue): ReturnType<typeof rollTraitCandidates> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const row = item as { traitCode?: unknown };
      if (typeof row.traitCode !== 'string') {
        return null;
      }
      return toTraitRollCandidate(row.traitCode);
    })
    .filter((item): item is ReturnType<typeof rollTraitCandidates>[number] => Boolean(item));
}

function mergeTraitRows(
  traits: Array<{ slotIndex: number; traitCode: ClientSpiritTraitCode }>,
  nextTrait: { slotIndex: number; traitCode: ClientSpiritTraitCode },
): Array<{ slotIndex: number; traitCode: ClientSpiritTraitCode }> {
  const merged = traits.filter((trait) => trait.slotIndex !== nextTrait.slotIndex);
  merged.push(nextTrait);
  return merged.sort((left, right) => left.slotIndex - right.slotIndex);
}

function getSoulField(quality: 'ordinary' | 'rare' | 'legendary'): 'ordinarySoul' | 'rareSoul' | 'legendarySoul' {
  if (quality === 'rare') {
    return 'rareSoul';
  }
  if (quality === 'legendary') {
    return 'legendarySoul';
  }
  return 'ordinarySoul';
}

function getSoulCount(resource: { ordinarySoul: number; rareSoul: number; legendarySoul: number }, quality: 'ordinary' | 'rare' | 'legendary'): number {
  return resource[getSoulField(quality)];
}

function buildSpiritRewardUpdateData(
  rewards: ClientSpiritShopItem['rewards'],
): Pick<Prisma.PlayerSpiritResourceUpdateInput, 'spiritRoot' | 'spiritMarrow' | 'spiritJade' | 'ordinarySoul' | 'rareSoul' | 'legendarySoul'> {
  const data: Pick<Prisma.PlayerSpiritResourceUpdateInput, 'spiritRoot' | 'spiritMarrow' | 'spiritJade' | 'ordinarySoul' | 'rareSoul' | 'legendarySoul'> = {};

  for (const reward of rewards) {
    if (reward.kind === 'spirit-root') {
      data.spiritRoot = { increment: reward.quantity };
    } else if (reward.kind === 'spirit-marrow') {
      data.spiritMarrow = { increment: reward.quantity };
    } else if (reward.kind === 'spirit-jade') {
      data.spiritJade = { increment: reward.quantity };
    } else if (reward.kind === 'ordinary-soul') {
      data.ordinarySoul = { increment: reward.quantity };
    } else if (reward.kind === 'rare-soul') {
      data.rareSoul = { increment: reward.quantity };
    } else if (reward.kind === 'legendary-soul') {
      data.legendarySoul = { increment: reward.quantity };
    }
  }

  return data;
}

function getShopLimit(itemId: string): number | null {
  if (itemId === 'spirit-root-100') {
    return null;
  }
  if (itemId === 'spirit-marrow-5') {
    return 5;
  }
  if (itemId === 'ordinary-soul-10') {
    return 3;
  }
  if (itemId === 'rare-soul-1') {
    return 2;
  }
  return 1;
}

function getShopLimitPeriodKey(itemId: string, dateKey = getLocalDateKey(), weekKey = getWeekPeriodKey()): string | null {
  if (itemId === 'spirit-root-100') {
    return null;
  }
  if (itemId === 'spirit-jade-1' || itemId === 'legendary-soul-1') {
    return weekKey;
  }
  return dateKey;
}

function getWeekPeriodKey(source = new Date()): string {
  const date = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function calculateSpiritMaxHp(baseHp: number, growthHp: number, level: number): number {
  return baseHp + Math.max(level - 1, 0) * growthHp;
}

function validateBuySpiritSoulRequest(request: ClientBuySpiritSoulRequest): void {
  const body = assertRequestBody(request);
  if (typeof body.goldAmount !== 'number' || !Number.isFinite(body.goldAmount) || body.goldAmount <= 0) {
    throwBadRequest(`goldAmount must be at least ${SPIRIT_SOUL_GOLD_PRICE}.`);
  }
  assertOptionalNumber(body.walletVersion, 'walletVersion');
  assertOptionalNumber(body.resourceVersion, 'resourceVersion');
}

function validateSlotRequest(request: { slotIndex?: number; slotVersion?: number; walletVersion?: number; resourceVersion?: number }, fieldName: string): void {
  const body = assertRequestBody(request);
  if (typeof body[fieldName] !== 'number' || !Number.isInteger(body[fieldName]) || Number(body[fieldName]) <= 0) {
    throwBadRequest(`${fieldName} must be a positive integer.`);
  }
  assertOptionalNumber(body.slotVersion, 'slotVersion');
  assertOptionalNumber(body.walletVersion, 'walletVersion');
  assertOptionalNumber(body.resourceVersion, 'resourceVersion');
}

function validateFeedSpiritRequest(request: ClientFeedSpiritRequest): void {
  validateSlotRequest(request, 'slotIndex');
  if (!['feed_once', 'fill_full'].includes(String(request.actionType))) {
    throwBadRequest('actionType must be feed_once or fill_full.');
  }
}

function validateBreakthroughSpiritRequest(request: ClientBreakthroughSpiritRequest): void {
  validateSlotRequest(request, 'slotIndex');
  if (request.targetStage !== undefined && (!Number.isInteger(request.targetStage) || request.targetStage < 1 || request.targetStage > 5)) {
    throwBadRequest('targetStage must be between 1 and 5.');
  }
}

function validateRollSpiritTraitsRequest(request: ClientRollSpiritTraitsRequest): void {
  validateSlotRequest(request, 'slotIndex');
  if (!isActiveTraitRollMode(String(request.mode))) {
    throwBadRequest('mode must be basic, normal, or advanced.');
  }
  const mode = request.mode;
  const body = request as unknown as Record<string, unknown>;
  const expectedMaterial = getTraitRollMaterial(mode);
  if (request.material !== undefined && request.material !== expectedMaterial) {
    throwBadRequest(`material must be ${expectedMaterial} for ${mode} mode.`);
  }
  if (request.candidateCount !== undefined) {
    const expectedCandidateCount = SPIRIT_TRAIT_ROLL_RULES[mode].candidateCount;
    if (!Number.isInteger(request.candidateCount) || request.candidateCount !== expectedCandidateCount) {
      throwBadRequest(`candidateCount must be ${expectedCandidateCount} for ${mode} mode.`);
    }
  }
  if (mode === 'basic') {
    if (request.targetSlotIndex !== undefined) {
      throwBadRequest('targetSlotIndex cannot be used in basic mode.');
    }
    if (Array.isArray(body.excludeCandidateIds) && body.excludeCandidateIds.length > 0) {
      throwBadRequest('excludeCandidateIds can only be used in advanced mode.');
    }
  }
  if (mode !== 'basic' && Array.isArray(body.lockedTraitSlotIndexes) && body.lockedTraitSlotIndexes.length > 0) {
    throwBadRequest('lockedTraitSlotIndexes can only be used in basic mode.');
  }
  if (mode !== 'advanced' && Array.isArray(body.excludeCandidateIds) && body.excludeCandidateIds.length > 0) {
    throwBadRequest('excludeCandidateIds can only be used in advanced mode.');
  }
  if (request.mode !== 'basic' && (!Number.isInteger(request.targetSlotIndex) || Number(request.targetSlotIndex) <= 0)) {
    throwBadRequest('targetSlotIndex must be a positive integer.');
  }
}

function validateResolveSpiritTraitRollRequest(request: ClientResolveSpiritTraitRollRequest): void {
  const body = assertRequestBody(request);
  if (typeof body.rollLogId !== 'string' || body.rollLogId.trim().length <= 0) {
    throwBadRequest('rollLogId is required.');
  }
  if (body.selectedTraitCode !== undefined && body.selectedTraitCode !== null && typeof body.selectedTraitCode !== 'string') {
    throwBadRequest('selectedTraitCode must be a string or null.');
  }
  assertOptionalNumber(body.slotVersion, 'slotVersion');
}

function validateBuyShopItemRequest(request: ClientBuySpiritShopItemRequest): void {
  const body = assertRequestBody(request);
  if (typeof body.itemId !== 'string' || body.itemId.trim().length <= 0) {
    throwBadRequest('itemId is required.');
  }
  assertOptionalNumber(body.resourceVersion, 'resourceVersion');
}

function validateClaimAdRewardRequest(request: ClientClaimSpiritAdRewardRequest): void {
  const body = assertRequestBody(request);
  assertOptionalNumber(body.resourceVersion, 'resourceVersion');
}

function validateComposeSpiritRequest(request: ClientComposeSpiritRequest): void {
  const body = assertRequestBody(request);
  if (typeof body.spiritId !== 'string' || body.spiritId.trim().length <= 0) {
    throwBadRequest('spiritId is required.');
  }
  if (typeof body.slotIndex !== 'number' || !Number.isInteger(body.slotIndex) || body.slotIndex <= 0) {
    throwBadRequest('slotIndex must be a positive integer.');
  }
  if (!['metal', 'wood', 'water', 'fire', 'earth'].includes(String(body.element))) {
    throwBadRequest('element must be metal, wood, water, fire, or earth.');
  }
}

function assertRequestBody(request: unknown): Record<string, unknown> {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throwBadRequest('Request body must be a JSON object.');
  }

  return request as Record<string, unknown>;
}

function assertOptionalNumber(value: unknown, fieldName: string): void {
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
    throwBadRequest(`${fieldName} must be a number.`);
  }
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

function getEffectiveDailyIntelFreeUsed(resource: { dailyIntelDateKey: string | null; dailyIntelFreeUsed: number }): number {
  return resource.dailyIntelDateKey === getLocalDateKey() ? resource.dailyIntelFreeUsed : 0;
}

function getEffectiveDailyIntelTalismanUsed(resource: { dailyIntelDateKey: string | null; dailyIntelTalismanUsed: number }): number {
  return resource.dailyIntelDateKey === getLocalDateKey() ? resource.dailyIntelTalismanUsed : 0;
}

function formatAccelerateDuration(seconds: number): string {
  const safeSeconds = Math.max(Math.floor(seconds), 0);
  if (safeSeconds > 0 && safeSeconds % 3600 === 0) {
    return `${safeSeconds / 3600} 小时`;
  }
  if (safeSeconds > 0 && safeSeconds % 60 === 0) {
    return `${safeSeconds / 60} 分钟`;
  }
  return `${safeSeconds} 秒`;
}

function assertVersion(label: string, expected: number | undefined, actual: number, options?: { allowStale?: boolean }): void {
  if (typeof expected !== 'number') {
    return;
  }

  if (options?.allowStale ? expected > actual : expected !== actual) {
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
