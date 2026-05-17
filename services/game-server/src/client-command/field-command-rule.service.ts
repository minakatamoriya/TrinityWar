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
  seedDefinition: {
    seedId: string;
    label: string;
  } | null;
}

export interface WalletStateForCollect {
  vaultGold: number;
  vaultCapacity: number;
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
    wallet: WalletStateForCollect,
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

    const availableVaultSpace = Math.max(wallet.vaultCapacity - wallet.vaultGold, 0);
    const collectedGold = Math.min(field.currentClaimableGold, availableVaultSpace);
    const overflowGold = Math.max(field.currentClaimableGold - collectedGold, 0);
    const rewards = buildFieldRewards(field, request.collectMode);
    const fieldCode = `田地 ${String(field.slotIndex).padStart(2, '0')}`;
    const rewardSummary = rewards.length > 0 ? `，并获得 ${rewards.map((reward) => `${reward.label} x${reward.quantity}`).join('、')}` : '';

    return {
      collectedGold,
      overflowGold,
      rewards,
      summary: overflowGold > 0
        ? `${fieldCode} 已收取 ${formatNumber(collectedGold)} 金币，另有 ${formatNumber(overflowGold)} 因金币已满未能入账${rewardSummary}。`
        : `${fieldCode} 已收取 ${formatNumber(collectedGold)} 金币${rewardSummary}，可以立即再投入新一轮培育。`,
    };
  }
}

function buildFieldRewards(field: FieldStateForCollect, collectMode: ClientCollectFieldRequest['collectMode']): ClientCollectRewardItem[] {
  if (collectMode !== 'ripe' || field.status !== 'MATURE' || !field.seedDefinition) {
    return [];
  }

  return [{
    seedId: field.seedDefinition.seedId,
    label: field.seedDefinition.label,
    quantity: 1,
  }];
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(Math.floor(value), 0));
}