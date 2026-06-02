import type {
  ClientSocialAssistResponse,
  ClientSocialFriendFieldVisitField,
  ClientSocialSummaryResponse,
} from '@trinitywar/shared';

export interface SocialFieldAssistResult {
  wateredCount: number;
  harvestedCount: number;
  rewardGold: number;
  intimacyGain: number;
  latestCounts: ClientSocialSummaryResponse['counts'] | null;
  failedMessages: string[];
}

export async function runSocialFieldAssists(input: {
  targetPlayerId: string;
  fields: ClientSocialFriendFieldVisitField[];
  waterField: (fieldSlotId: string) => Promise<ClientSocialAssistResponse>;
  harvestField: (fieldSlotId: string) => Promise<ClientSocialAssistResponse>;
}): Promise<SocialFieldAssistResult> {
  const result: SocialFieldAssistResult = {
    wateredCount: 0,
    harvestedCount: 0,
    rewardGold: 0,
    intimacyGain: 0,
    latestCounts: null,
    failedMessages: [],
  };

  for (const field of input.fields) {
    try {
      if (field.nextAction === 'water') {
        const response = await input.waterField(field.fieldSlotId);
        result.wateredCount += 1;
        result.intimacyGain += response.intimacyGain;
        result.latestCounts = response.counts;
        continue;
      }

      if (field.nextAction === 'harvest') {
        const response = await input.harvestField(field.fieldSlotId);
        result.harvestedCount += 1;
        result.rewardGold += response.rewards?.reduce((sum, reward) => sum + (reward.kind === 'gold' ? reward.quantity : 0), 0) ?? 0;
        result.intimacyGain += response.intimacyGain;
        result.latestCounts = response.counts;
      }
    } catch (error) {
      result.failedMessages.push(error instanceof Error && error.message ? error.message : `${field.fieldCode} 助力失败`);
    }
  }

  return result;
}
