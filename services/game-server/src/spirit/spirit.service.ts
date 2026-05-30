import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { PlayerSpiritStatus, Prisma, PrismaClient, SpiritElement, SpiritRarity, SpiritRole } from '@prisma/client';
import { APP_NAME, type ClientBreakthroughSpiritRequest, type ClientBuySpiritShopItemRequest, type ClientBuySpiritSoulRequest, type ClientClaimSpiritAdRewardRequest, type ClientComposeSpiritRequest, type ClientDissolveSpiritRequest, type ClientFeedSpiritRequest, type ClientRecoverSpiritRequest, type ClientRollSpiritTraitsRequest, type ClientSetMainSpiritRequest, type ClientSpiritCodexEntry, type ClientSpiritElement, type ClientSpiritMutationResponse, type ClientSpiritShopItem, type ClientSpiritState, type ClientSpiritStateResponse, type ClientSpiritStatus, type ClientSpiritSlot, type ClientSpiritDefinition, type ClientSpiritTrait, type ClientSpiritTraitCode, type ClientUpgradeSpiritRequest } from '@trinitywar/shared';
import { AuditService } from '../audit/audit.service.js';
import { DailyTaskLifecycleService } from '../client-read/daily-task-lifecycle.service.js';
import { ClientReadService } from '../client-read/client-read.service.js';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';
import { getLocalDateKey } from '../lib/date-key.js';
import { DAILY_TASK_CONFIG, getFactionAdvantageConfig } from '../lib/game-balance.js';
import { applyFactionSpiritPassiveExpBonus, getFactionSpiritFeedDurationSeconds, type FactionAdvantageCode } from '../lib/faction-advantage-formulas.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { STARTER_SPIRIT_IDS } from '../seed/seed-data/spirits.js';

const SPIRIT_SOUL_GOLD_PRICE = 100;
const SPIRIT_MAX_LEVEL = 50;
const SPIRIT_DAILY_FREE_RECOVERY_LIMIT = 3;
const SPIRIT_DAILY_TALISMAN_RECOVERY_LIMIT = 3;
const SPIRIT_DAILY_RECOVERY_LIMIT = SPIRIT_DAILY_FREE_RECOVERY_LIMIT + SPIRIT_DAILY_TALISMAN_RECOVERY_LIMIT;
const SPIRIT_DISSOLVE_REFUND_RATIO = 0.35;
const SPIRIT_LEVEL_EXP_REQUIRED = 10_000;
const SPIRIT_ROOT_PER_SATIATED_HOUR = 5;
const SPIRIT_FEED_ONCE_SECONDS = 2 * 60 * 60;
const SPIRIT_SATIATED_EXP_BONUS_BPS = 5000;
const SPIRIT_AD_DAILY_LIMIT = 3;
const SPIRIT_AD_TALISMAN_REWARD = 5;

const SPIRIT_SHOP_ITEMS: ClientSpiritShopItem[] = [
  { itemId: 'spirit-root-100', label: '灵根 x100', description: '日常补粮', priceTianjiTalisman: 10, limitLabel: '不限购', remainingPurchases: null, rewards: [{ kind: 'spirit-root', label: '灵根', quantity: 100 }] },
  { itemId: 'spirit-marrow-5', label: '灵髓 x5', description: '洗练基础材料', priceTianjiTalisman: 20, limitLabel: '每日 5 次', remainingPurchases: 5, rewards: [{ kind: 'spirit-marrow', label: '灵髓', quantity: 5 }] },
  { itemId: 'spirit-jade-1', label: '灵玉 x1', description: '高级洗练材料', priceTianjiTalisman: 80, limitLabel: '每周 1 次', remainingPurchases: 1, rewards: [{ kind: 'spirit-jade', label: '灵玉', quantity: 1 }] },
  { itemId: 'ordinary-soul-10', label: '普通兽魂 x10', description: '低段突破', priceTianjiTalisman: 5, limitLabel: '每日 3 次', remainingPurchases: 3, rewards: [{ kind: 'ordinary-soul', label: '普通兽魂', quantity: 10 }] },
  { itemId: 'rare-soul-1', label: '稀有兽魂 x1', description: '中段突破', priceTianjiTalisman: 30, limitLabel: '每日 2 次', remainingPurchases: 2, rewards: [{ kind: 'rare-soul', label: '稀有兽魂', quantity: 1 }] },
  { itemId: 'legendary-soul-1', label: '传说兽魂 x1', description: '高层突破', priceTianjiTalisman: 150, limitLabel: '每周 1 次', remainingPurchases: 1, rewards: [{ kind: 'legendary-soul', label: '传说兽魂', quantity: 1 }] },
];

const SPIRIT_BREAKTHROUGH_COSTS: Record<number, { quality: 'ordinary' | 'rare' | 'legendary'; count: number }> = {
  1: { quality: 'ordinary', count: 5 },
  2: { quality: 'ordinary', count: 12 },
  3: { quality: 'rare', count: 10 },
  4: { quality: 'rare', count: 20 },
  5: { quality: 'legendary', count: 8 },
};

const SPIRIT_TRAIT_DEFINITIONS: Array<{ code: ClientSpiritTraitCode; label: string; value: number; description: string }> = [
  { code: 'claw', label: '利爪', value: 10, description: '攻击 +10%' },
  { code: 'thick_skin', label: '厚皮', value: 10, description: '生命 +10%' },
  { code: 'crit', label: '暴击', value: 6, description: '暴击率 +6%' },
  { code: 'crit_damage', label: '爆伤', value: 20, description: '暴击伤害 +20%' },
  { code: 'dodge', label: '闪避', value: 5, description: '闪避率 +5%' },
  { code: 'counter', label: '反击', value: 10, description: '受击 +10% 概率反击，造成 50% 伤害' },
  { code: 'lifesteal', label: '吸血', value: 10, description: '造成伤害的 10% 回复自身' },
  { code: 'tenacity', label: '韧性', value: 10, description: '受暴击时伤害降低 10%' },
];

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
  dailyRecoveryUsed: number;
  dailyRecoveryDateKey: string | null;
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
    return buildSpiritState(readModel.resource, readModel.slots, readModel.codex, readModel.shopPurchases, readModel.adRewardUsedToday);
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
            dailyRecoveryUsed: true,
            dailyRecoveryDateKey: true,
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
            dailyRecoveryUsed: true,
            dailyRecoveryDateKey: true,
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

  async feedSpirit(
    playerId: string,
    request: ClientFeedSpiritRequest,
    headerIdempotencyKey?: string,
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

      const now = new Date();
      const factionCode = toFactionAdvantageCode(resource.player?.faction?.code);
      const settled = settleSpiritProgress(slot, now, factionCode);
      const satiatedRemainingSeconds = Math.max(Math.floor(((settled.satiatedUntil?.getTime() ?? now.getTime()) - now.getTime()) / 1000), 0);
      const satiatedSecondsAdded = getFactionSpiritFeedDurationSeconds(SPIRIT_FEED_ONCE_SECONDS, factionCode);
      const feedCount = Math.ceil(SPIRIT_FEED_ONCE_SECONDS / 3600 * SPIRIT_ROOT_PER_SATIATED_HOUR);

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
      await this.recordDailyTaskProgress(client, playerId, 'feed-spirit');

      const response = await this.buildSpiritMutationResponse(client, playerId, `${slot.spiritDefinition?.label ?? '灵宠'} 已安排 2 小时自动加速。`);
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-slot', slot.id);
      return response;
    });
  }

  async breakthroughSpirit(
    playerId: string,
    request: ClientBreakthroughSpiritRequest,
    headerIdempotencyKey?: string,
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

      const now = new Date();
      const settled = settleSpiritProgress(slot, now, toFactionAdvantageCode(resource.player?.faction?.code));
      const targetStage = request.targetStage ?? getBreakthroughStageForLevel(settled.level);
      const expectedStage = getBreakthroughStageForLevel(settled.level);
      if (expectedStage === null || targetStage !== expectedStage || settled.breakthroughStage >= expectedStage) {
        throw new BusinessError({ code: ErrorCode.BadRequest, message: 'Spirit is not at a pending breakthrough node.', statusCode: 400 });
      }

      const cost = SPIRIT_BREAKTHROUGH_COSTS[expectedStage];
      if (!cost) {
        throw new BusinessError({ code: ErrorCode.BadRequest, message: 'Unsupported breakthrough stage.', statusCode: 400 });
      }

      const currentSoul = getSoulCount(resource, cost.quality);
      if (currentSoul < cost.count) {
        throw new BusinessError({ code: ErrorCode.Conflict, message: 'Insufficient spirit soul for breakthrough.', statusCode: 409 });
      }

      await client.playerSpiritResource.update({
        where: { playerId },
        data: {
          [getSoulField(cost.quality)]: { decrement: cost.count },
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
          consumedSoulCount: cost.count,
          requestIdempotencyKey: idempotencyKey ?? null,
        },
      });

      await this.ensureNaturalTraitSlots(client, slot.id, expectedStage);
      const response = await this.buildSpiritMutationResponse(client, playerId, `${slot.spiritDefinition?.label ?? '灵宠'} 已突破。`);
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-slot', slot.id);
      return response;
    });
  }

  async rollSpiritTraits(
    playerId: string,
    request: ClientRollSpiritTraitsRequest,
    headerIdempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    validateRollSpiritTraitsRequest(request);
    const idempotencyKey = normalizeIdempotencyKey(headerIdempotencyKey ?? request.requestIdempotencyKey);

    return this.prisma.transaction(async (client) => {
      const requestHash = hashRequest({
        endpoint: 'roll-traits',
        slotIndex: request.slotIndex,
        mode: request.mode,
        lockedSlotIndex: request.lockedSlotIndex ?? null,
        targetSlotIndex: request.targetSlotIndex ?? null,
        targetTraitCode: request.targetTraitCode ?? null,
        slotVersion: request.slotVersion ?? null,
        walletVersion: request.walletVersion ?? null,
        resourceVersion: request.resourceVersion ?? null,
      });
      const idempotencyRecord = await this.prepareIdempotencyRecord(client, playerId, 'spirit-roll-traits', idempotencyKey, requestHash);
      if (idempotencyRecord?.status === 'completed' && idempotencyRecord.responseSnapshotJson) {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientSpiritMutationResponse;
      }

      const [resource, wallet, slot] = await Promise.all([
        client.playerSpiritResource.findUnique({
          where: { playerId },
          select: {
            spiritMarrow: true,
            spiritJade: true,
            resourceVersion: true,
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

      const cost = getRollCost(request.mode);
      if (resource.spiritMarrow < cost.marrow || resource.spiritJade < cost.jade) {
        throw new BusinessError({ code: ErrorCode.Conflict, message: 'Insufficient trait roll materials.', statusCode: 409 });
      }
      if (wallet.vaultGold < cost.gold) {
        throw new BusinessError({ code: ErrorCode.InsufficientVaultGold, message: 'Insufficient vault gold.', statusCode: 409 });
      }

      const beforeTraits = normalizeTraitRows(slot.traits);
      const candidates: Array<Array<{ slotIndex: number; traitCode: ClientSpiritTraitCode }>> = [];
      let resultTraits: Array<{ slotIndex: number; traitCode: ClientSpiritTraitCode }>;

      if (request.mode === 'batch_basic') {
        for (let index = 0; index < 10; index += 1) {
          candidates.push(randomTraits(unlockedSlots, true));
        }
        resultTraits = candidates[0] ?? randomTraits(unlockedSlots, true);
      } else if (request.mode === 'advanced') {
        if (typeof request.lockedSlotIndex !== 'number') {
          throwBadRequest('lockedSlotIndex is required for advanced roll.');
        }
        const lockedTrait = beforeTraits.find((trait) => trait.slotIndex === request.lockedSlotIndex);
        if (!lockedTrait) {
          throwBadRequest('lockedSlotIndex must refer to an unlocked existing trait.');
        }
        resultTraits = randomTraits(unlockedSlots, true).map((trait) => (trait.slotIndex === lockedTrait.slotIndex ? lockedTrait : trait));
      } else if (request.mode === 'ultimate') {
        if (typeof request.targetSlotIndex !== 'number' || !request.targetTraitCode) {
          throwBadRequest('targetSlotIndex and targetTraitCode are required for ultimate roll.');
        }
        if (request.targetSlotIndex < 1 || request.targetSlotIndex > unlockedSlots) {
          throwBadRequest('targetSlotIndex must refer to an unlocked trait slot.');
        }
        assertKnownTraitCode(request.targetTraitCode);
        resultTraits = mergeWithExistingTraits(beforeTraits, unlockedSlots).map((trait) =>
          trait.slotIndex === request.targetSlotIndex ? { slotIndex: trait.slotIndex, traitCode: request.targetTraitCode as ClientSpiritTraitCode } : trait,
        );
      } else {
        resultTraits = randomTraits(unlockedSlots, true);
      }

      await client.playerSpiritResource.update({
        where: { playerId },
        data: {
          spiritMarrow: { decrement: cost.marrow },
          spiritJade: { decrement: cost.jade },
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
          note: `Roll spirit traits in ${request.mode} mode.`,
        });
      }
      await client.playerSpiritTrait.deleteMany({ where: { spiritSlotId: slot.id } });
      for (const trait of resultTraits) {
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
          lockedSlotIndex: request.lockedSlotIndex ?? null,
          targetSlotIndex: request.targetSlotIndex ?? null,
          targetTraitCode: request.targetTraitCode ?? null,
          consumedJson: cost as unknown as Prisma.InputJsonValue,
          beforeTraitsJson: beforeTraits as unknown as Prisma.InputJsonValue,
          resultTraitsJson: resultTraits as unknown as Prisma.InputJsonValue,
          candidateResultsJson: request.mode === 'batch_basic' ? candidates as unknown as Prisma.InputJsonValue : undefined,
          requestIdempotencyKey: idempotencyKey ?? null,
        },
      });

      const response = await this.buildSpiritMutationResponse(client, playerId, `${slot.spiritDefinition?.label ?? '灵宠'} 词条已洗练。`);
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-slot', slot.id);
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
    validateSlotRequest(request, 'slotIndex');
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
            tianjiTalisman: true,
            dailyRecoveryUsed: true,
            dailyRecoveryDateKey: true,
            dailyIntelFreeUsed: true,
            dailyIntelTalismanUsed: true,
            dailyIntelDateKey: true,
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

      assertVersion('resourceVersion', request.resourceVersion, resource.resourceVersion, { allowStale: true });
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

      const talismanCost = getSpiritRecoveryTalismanCost(nextRecoveryUsed);
      if (resource.tianjiTalisman < talismanCost) {
        throw new BusinessError({
          code: ErrorCode.Conflict,
          message: 'Insufficient Tianji talisman.',
          statusCode: 409,
        });
      }

      await client.playerSpiritResource.update({
        where: { playerId },
        data: {
          tianjiTalisman: talismanCost > 0 ? { decrement: talismanCost } : undefined,
          dailyRecoveryUsed: nextRecoveryUsed,
          dailyRecoveryDateKey: getLocalDateKey(),
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

      const costText = talismanCost > 0 ? `，消耗天机符 x${talismanCost}` : '，本次使用免费恢复';
      const response = await this.buildSpiritMutationResponse(client, playerId, `${slot.spiritDefinition?.label ?? '灵宠'} 已恢复至满血${costText}。`);
      await this.markIdempotencyCompleted(client, idempotencyRecord?.id, response, 'spirit-slot', slot.id);
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
          currentHp: maxHp,
          maxHp,
          status: 'ACTIVE',
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

      const response = await this.buildSpiritMutationResponse(client, playerId, `${codexEntry.spiritDefinition.label} 已合成入栏。`);
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
          dailyRecoveryUsed: true,
          dailyRecoveryDateKey: true,
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
          currentHp: true,
          maxHp: true,
          status: true,
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

    const dateKey = getLocalDateKey();
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
    currentHp: number;
    maxHp: number;
    status: PlayerSpiritStatus;
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
      lore: string | null;
      sortOrder: number;
    };
  }>,
  shopPurchases: Array<{ itemId: string; periodKey: string | null }>,
  adRewardUsedToday: number,
): ClientSpiritState {
  const now = new Date();
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
      currentHp: slot.currentHp,
      maxHp: slot.maxHp,
      status: toClientStatus(slot.status),
      traits: mapTraits(slot.traits).filter((trait) => trait.slotIndex <= unlockedTraitSlots),
      unlockedTraitSlots,
      slotVersion: slot.slotVersion,
    };
  });
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
    dailyRecoveryUsed: getEffectiveDailyRecoveryUsed(resource),
    dailyIntelFreeUsed: getEffectiveDailyIntelFreeUsed(resource),
    dailyIntelTalismanUsed: getEffectiveDailyIntelTalismanUsed(resource),
    resourceVersion: resource.resourceVersion,
    mainSlot,
    slots: mappedSlots,
    codex: mappedCodex,
    readyToCompose: mappedCodex.filter((entry) => entry.readyToCompose),
    factionAdvantage: getFactionAdvantageConfig(toFactionAdvantageCode(resource.factionCode)) ?? undefined,
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

  const owned = getSoulCount(resource, cost.quality);

  return {
    stage,
    level: slot.level,
    quality: cost.quality,
    label: getSoulQualityLabel(cost.quality),
    required: cost.count,
    owned,
    canBreakthrough: owned >= cost.count,
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
    return '传说兽魂';
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

function toClientStatus(status: PlayerSpiritStatus): ClientSpiritStatus {
  return status.toLowerCase() as ClientSpiritStatus;
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

  return applyFactionSpiritPassiveExpBonus(baseExpPerMinute, factionCode);
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
  const satiatedExpGain = Math.floor(passiveExpPerMinute * satiatedSeconds * (10_000 + SPIRIT_SATIATED_EXP_BONUS_BPS) / 10_000 / 60);
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

function getRollCost(mode: ClientRollSpiritTraitsRequest['mode']): { marrow: number; jade: number; gold: number } {
  switch (mode) {
    case 'advanced':
      return { marrow: 10, jade: 1, gold: 1000 };
    case 'ultimate':
      return { marrow: 20, jade: 5, gold: 0 };
    case 'batch_basic':
      return { marrow: 50, jade: 0, gold: 5000 };
    case 'basic':
    default:
      return { marrow: 5, jade: 0, gold: 500 };
  }
}

function normalizeTraitRows(traits: SpiritReadTrait[]): Array<{ slotIndex: number; traitCode: ClientSpiritTraitCode }> {
  return traits
    .sort((left, right) => left.slotIndex - right.slotIndex)
    .map((trait) => ({
      slotIndex: trait.slotIndex,
      traitCode: getTraitDefinition(trait.traitCode).code,
    }));
}

function randomTraits(unlockedSlots: number, allowDuplicate: boolean): Array<{ slotIndex: number; traitCode: ClientSpiritTraitCode }> {
  const usedCodes = new Set<string>();
  const result: Array<{ slotIndex: number; traitCode: ClientSpiritTraitCode }> = [];
  for (let slotIndex = 1; slotIndex <= unlockedSlots; slotIndex += 1) {
    const definition = randomTraitDefinition(allowDuplicate, usedCodes);
    usedCodes.add(definition.code);
    result.push({ slotIndex, traitCode: definition.code });
  }
  return result;
}

function mergeWithExistingTraits(
  traits: Array<{ slotIndex: number; traitCode: ClientSpiritTraitCode }>,
  unlockedSlots: number,
): Array<{ slotIndex: number; traitCode: ClientSpiritTraitCode }> {
  const merged: Array<{ slotIndex: number; traitCode: ClientSpiritTraitCode }> = [];
  for (let slotIndex = 1; slotIndex <= unlockedSlots; slotIndex += 1) {
    merged.push(traits.find((trait) => trait.slotIndex === slotIndex) ?? { slotIndex, traitCode: 'claw' });
  }
  return merged;
}

function randomTraitDefinition(allowDuplicate: boolean, usedCodes: Set<string>) {
  const pool = allowDuplicate ? SPIRIT_TRAIT_DEFINITIONS : SPIRIT_TRAIT_DEFINITIONS.filter((definition) => !usedCodes.has(definition.code));
  return pool[Math.floor(Math.random() * pool.length)] ?? SPIRIT_TRAIT_DEFINITIONS[0];
}

function getTraitDefinition(code: string) {
  const definition = SPIRIT_TRAIT_DEFINITIONS.find((trait) => trait.code === code);
  if (!definition) {
    return SPIRIT_TRAIT_DEFINITIONS[0];
  }
  return definition;
}

function assertKnownTraitCode(code: string): void {
  if (!SPIRIT_TRAIT_DEFINITIONS.some((trait) => trait.code === code)) {
    throwBadRequest('Unknown targetTraitCode.');
  }
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
  if (!['basic', 'advanced', 'ultimate', 'batch_basic'].includes(String(request.mode))) {
    throwBadRequest('mode must be basic, advanced, ultimate, or batch_basic.');
  }
  if (request.lockedSlotIndex !== undefined && (!Number.isInteger(request.lockedSlotIndex) || request.lockedSlotIndex <= 0)) {
    throwBadRequest('lockedSlotIndex must be a positive integer.');
  }
  if (request.targetSlotIndex !== undefined && (!Number.isInteger(request.targetSlotIndex) || request.targetSlotIndex <= 0)) {
    throwBadRequest('targetSlotIndex must be a positive integer.');
  }
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

function getEffectiveDailyRecoveryUsed(resource: { dailyRecoveryDateKey: string | null; dailyRecoveryUsed: number }): number {
  return resource.dailyRecoveryDateKey === getLocalDateKey() ? resource.dailyRecoveryUsed : 0;
}

function getEffectiveDailyIntelFreeUsed(resource: { dailyIntelDateKey: string | null; dailyIntelFreeUsed: number }): number {
  return resource.dailyIntelDateKey === getLocalDateKey() ? resource.dailyIntelFreeUsed : 0;
}

function getEffectiveDailyIntelTalismanUsed(resource: { dailyIntelDateKey: string | null; dailyIntelTalismanUsed: number }): number {
  return resource.dailyIntelDateKey === getLocalDateKey() ? resource.dailyIntelTalismanUsed : 0;
}

function getNextDailyRecoveryUsed(resource: { dailyRecoveryDateKey: string | null; dailyRecoveryUsed: number }): number {
  const currentUsed = getEffectiveDailyRecoveryUsed(resource);
  return currentUsed + 1;
}

function getSpiritRecoveryTalismanCost(nextRecoveryUsed: number): number {
  if (nextRecoveryUsed <= SPIRIT_DAILY_FREE_RECOVERY_LIMIT) {
    return 0;
  }

  return nextRecoveryUsed - SPIRIT_DAILY_FREE_RECOVERY_LIMIT;
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
