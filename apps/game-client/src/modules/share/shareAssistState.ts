import type {
  PublicShareAssistCampaignResponse,
  PublicShareAssistConfirmResponse,
} from '@trinitywar/shared';
import type { ShareAssistAudience, ShareAssistKind } from '../../ui/share/ShareAssistPage';
import type { ShareAssistDemoState } from '../../shell/appStateTypes';

export function buildShareAssistDemoState(input: {
  audience: ShareAssistAudience;
  campaign: PublicShareAssistCampaignResponse;
  campaignId: string;
  kind: ShareAssistKind;
}): ShareAssistDemoState {
  return {
    audience: input.audience,
    kind: input.kind,
    status: input.campaign.campaign.status === 'expired'
      ? 'expired'
      : input.campaign.campaign.status === 'full' ? 'full' : 'pending',
    campaignId: input.campaignId,
    campaign: input.campaign,
    error: null,
  };
}

export function buildFriendInviteDemoLinks(input: {
  campaignId: string;
  origin: string;
}): { newUser: string; returningUser: string } {
  const baseUrl = `${input.origin}/?invite=friend&campaignId=${encodeURIComponent(input.campaignId)}`;

  return {
    newUser: `${baseUrl}&audience=new-user`,
    returningUser: `${baseUrl}&audience=returning-user`,
  };
}

export function applyShareAssistConfirmResultToDemoState(
  current: ShareAssistDemoState | null,
  result: PublicShareAssistConfirmResponse,
): ShareAssistDemoState | null {
  if (!current) {
    return current;
  }

  return {
    ...current,
    status: result.nextAction === 'expired' ? 'expired' : result.nextAction === 'full' ? 'full' : 'completed',
    campaign: {
      app: result.app,
      campaign: result.campaign,
      copy: current.campaign?.copy ?? {
        title: `${result.campaign.owner.nickname}邀请你帮 TA 浇水`,
        description: '帮 TA 浇一次水，可以缩短田地成长时间。',
        actionLabel: '帮 TA 浇水',
      },
    },
    error: null,
  };
}
