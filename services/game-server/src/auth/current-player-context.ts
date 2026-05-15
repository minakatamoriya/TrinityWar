export interface CurrentPlayerContext {
  playerId: string;
  authIdentityId?: string;
  provider?: 'DEV_FAKE' | 'WECHAT';
  providerUserId?: string;
  tokenExpiresAt?: string;
  traceId?: string;
}
