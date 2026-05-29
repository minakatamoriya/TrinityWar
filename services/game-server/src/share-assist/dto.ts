import type {
  ClientCompleteShareInviteTutorialRequest,
  ClientCreateShareAssistCampaignRequest,
  PublicShareAssistConfirmRequest,
} from '@trinitywar/shared';

export class CreateShareAssistCampaignDto implements ClientCreateShareAssistCampaignRequest {
  campaignType!: 'water' | 'friend_invite';
  targetEntityId?: string;
  maxAssistCount?: number;
  requestIdempotencyKey?: string;
}

export class PublicShareAssistConfirmDto implements PublicShareAssistConfirmRequest {
  audience!: 'new-user' | 'returning-user';
  helperPlayerId?: string;
  helperOpenidHash?: string;
  helperDeviceHash?: string;
  requestIdempotencyKey?: string;
}

export class CompleteShareInviteTutorialDto implements ClientCompleteShareInviteTutorialRequest {
  campaignId?: string;
  helperOpenidHash?: string;
  helperDeviceHash?: string;
  requestIdempotencyKey?: string;
}
