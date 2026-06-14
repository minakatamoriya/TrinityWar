import type {
  ClientSocialAssistResponse,
  ClientSocialFriendFieldVisitField,
  ClientSocialSummaryResponse,
} from '@trinitywar/shared';

export interface SocialFieldAssistResult {
  revivedCount: number;
  harvestedCount: number;
  rewardGold: number;
  intimacyGain: number;
  cappedIntimacyCount: number;
  latestCounts: ClientSocialSummaryResponse['counts'] | null;
  failedMessages: string[];
}

export async function runSocialFieldAssists(input: {
  targetPlayerId: string;
  fields: ClientSocialFriendFieldVisitField[];
  reviveField: (fieldSlotId: string) => Promise<ClientSocialAssistResponse>;
  harvestField: (fieldSlotId: string) => Promise<ClientSocialAssistResponse>;
}): Promise<SocialFieldAssistResult> {
  const result: SocialFieldAssistResult = {
    revivedCount: 0,
    harvestedCount: 0,
    rewardGold: 0,
    intimacyGain: 0,
    cappedIntimacyCount: 0,
    latestCounts: null,
    failedMessages: [],
  };

  for (const field of input.fields) {
    try {
      if (field.nextAction === 'revive') {
        const response = await input.reviveField(field.fieldSlotId);
        result.revivedCount += 1;
        result.intimacyGain += response.intimacyGain;
        if (response.intimacyGain <= 0) {
          result.cappedIntimacyCount += 1;
        }
        result.latestCounts = response.counts;

        const harvestResponse = await input.harvestField(field.fieldSlotId);
        result.harvestedCount += 1;
        result.rewardGold += harvestResponse.rewards?.reduce((sum, reward) => sum + (reward.kind === 'gold' ? reward.quantity : 0), 0) ?? 0;
        result.intimacyGain += harvestResponse.intimacyGain;
        if (harvestResponse.intimacyGain <= 0) {
          result.cappedIntimacyCount += 1;
        }
        result.latestCounts = harvestResponse.counts;
        continue;
      }

      if (field.nextAction === 'harvest') {
        const response = await input.harvestField(field.fieldSlotId);
        result.harvestedCount += 1;
        result.rewardGold += response.rewards?.reduce((sum, reward) => sum + (reward.kind === 'gold' ? reward.quantity : 0), 0) ?? 0;
        result.intimacyGain += response.intimacyGain;
        if (response.intimacyGain <= 0) {
          result.cappedIntimacyCount += 1;
        }
        result.latestCounts = response.counts;
      }
    } catch (error) {
      result.failedMessages.push(error instanceof Error && error.message ? error.message : `${field.fieldCode} 助力失败`);
    }
  }

  return result;
}
