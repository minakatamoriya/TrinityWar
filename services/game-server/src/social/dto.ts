import type {
  ClientSocialFollowRequest,
  ClientSocialFriendRequest,
  ClientSocialWaterFieldRequest,
  ClientTeamChallengeRequest,
} from '@trinitywar/shared';

export class SocialFollowRequestDto implements ClientSocialFollowRequest {
  targetPlayerId!: string;
}

export class SocialFriendRequestDto implements ClientSocialFriendRequest {
  targetPlayerId!: string;
  sourceType?: string;
}

export class SocialWaterFieldRequestDto implements ClientSocialWaterFieldRequest {
  targetPlayerId!: string;
  fieldSlotId?: string;
  requestIdempotencyKey?: string;
}

export class TeamChallengeRequestDto implements ClientTeamChallengeRequest {
  allyPlayerId!: string;
  targetPlayerId!: string;
  requestIdempotencyKey?: string;
}
