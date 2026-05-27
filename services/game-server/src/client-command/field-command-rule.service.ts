import { Injectable } from '@nestjs/common';
import type { ClientCollectFieldRequest, ClientCollectRewardItem } from '@trinitywar/shared';
import { BusinessError, ErrorCode } from '../common/errors/index.js';

export interface FieldStateForCollect {
  id: string;
  slotIndex: number;
  isUnlocked: boolean;
  status: 'LOCKED' | 'EMPTY' | 'SEEDED' | 'GROWING' | 'MATURE' | 'WITHERED';
  statusVersion: number;
  currentClaimableGold: number;
  expectedEssenceYield: number;
  stolenEssenceYield: number;
  seedDefinition: {
    seedId: string;
    label: string;
    rarity: string;
  } | null;
}

export interface WalletStateForCollect {
  vaultGold: number;
}

export interface CollectFieldResolution {
  collectedGold: number;
  overflowGold: number;
  rewards: ClientCollectRewardItem[];
  summary: string;
}

@Injectable()
export class FieldCommandRuleService {
  resolveCollectField(
    field: FieldStateForCollect,
    _wallet: WalletStateForCollect,
    request: ClientCollectFieldRequest,
  ): CollectFieldResolution {
    if (!field.isUnlocked || field.status === 'LOCKED') {
      throw new BusinessError({
        code: ErrorCode.FieldLocked,
        message: 'Field is locked.',
        statusCode: 403,
      });
    }

    if (request.collectMode === 'ripe' && field.status !== 'MATURE' && field.status !== 'WITHERED') {
      throw new BusinessError({
        code: ErrorCode.FieldNotCollectable,
        message: 'Field is not collectable in ripe mode.',
        statusCode: 409,
      });
    }

    if (request.collectMode === 'early' && field.status !== 'GROWING') {
      throw new BusinessError({
        code: ErrorCode.FieldNotCollectable,
        message: 'Field is not collectable in early mode.',
        statusCode: 409,
      });
    }

  const collectedGold = Math.max(field.currentClaimableGold, 0);
  const overflowGold = 0;
  const rewards = buildFieldRewards(field, request.collectMode);
    const fieldCode = `田地 ${String(field.slotIndex).padStart(2, '0')}`;
    const rewardSummary = rewards.length > 0 ? `，并获得 ${rewards.map((reward) => `${reward.label} x${reward.quantity}`).join('、')}` : '';

    return {
      collectedGold,
      overflowGold,
      rewards,
      summary: `${fieldCode} 已收取 ${formatNumber(collectedGold)} 金币${rewardSummary}，可以立即再投入新一轮培育。`,
    };
  }
}

function buildFieldRewards(field: FieldStateForCollect, collectMode: ClientCollectFieldRequest['collectMode']): ClientCollectRewardItem[] {
  if (collectMode !== 'ripe' || field.status !== 'MATURE' || !field.seedDefinition) {
    return [];
  }

  const essenceYield = Math.max((field.expectedEssenceYield || getExpectedEssenceYield(field.seedDefinition.rarity)) - field.stolenEssenceYield, 0);

  const rewards: ClientCollectRewardItem[] = [{
    kind: 'essence',
    seedId: field.seedDefinition.seedId,
    essenceType: field.seedDefinition.seedId,
    label: `${field.seedDefinition.label}精华`,
    quantity: essenceYield,
  }, buildSpiritCropReward(field.seedDefinition.rarity)];

  return rewards;
}

function getExpectedEssenceYield(rarity: string): number {
  if (rarity === 'legendary') {
    return 8;
  }

  if (rarity === 'rare') {
    return 6;
  }

  return 10;
}

function buildSpiritCropReward(rarity: string): ClientCollectRewardItem {
  if (rarity === 'legendary') {
    return {
      kind: 'spirit-jade',
      seedId: 'spirit-jade',
      label: '灵玉',
      quantity: randomIntInclusive(1, 2),
    };
  }

  if (rarity === 'rare') {
    return {
      kind: 'spirit-marrow',
      seedId: 'spirit-marrow',
      label: '灵髓',
      quantity: randomIntInclusive(2, 4),
    };
  }

  return {
    kind: 'spirit-root',
    seedId: 'spirit-root',
    label: '灵根',
    quantity: randomIntInclusive(5, 10),
  };
}

function randomIntInclusive(min: number, max: number): number {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);

  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(Math.floor(value), 0));
}
