import type {
  ClientSocialFollowRequest,
  ClientSocialFriendRequest,
  ClientSocialHarvestFieldRequest,
  ClientSocialReviveFieldRequest,
  ClientTeamChallengeRequest,
} from '@trinitywar/shared';

export class SocialFollowRequestDto implements ClientSocialFollowRequest {
  targetPlayerId!: string;
}

export class SocialFriendRequestDto implements ClientSocialFriendRequest {
  targetPlayerId!: string;
  sourceType?: string;
}

export class SocialReviveFieldRequestDto implements ClientSocialReviveFieldRequest {
  targetPlayerId!: string;
  fieldSlotId?: string;
  requestIdempotencyKey?: string;
}

export class SocialHarvestFieldRequestDto implements ClientSocialHarvestFieldRequest {
  targetPlayerId!: string;
  fieldSlotId?: string;
  requestIdempotencyKey?: string;
}

export class TeamChallengeRequestDto implements ClientTeamChallengeRequest {
  allyPlayerId!: string;
  targetPlayerId!: string;
  requestIdempotencyKey?: string;
}
