import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import { createUnauthorizedError } from '../common/errors/index.js';
import type { CurrentPlayerContext } from './current-player-context.js';

interface AccessTokenPayload {
  playerId: string;
  authIdentityId: string;
  provider: 'DEV_FAKE' | 'WECHAT';
  providerUserId: string;
  exp: number;
}

@Injectable()
export class AuthTokenService {
  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  issueAccessToken(input: Omit<AccessTokenPayload, 'exp'>): { accessToken: string; expiresAt: string } {
    const exp = Math.floor(Date.now() / 1000) + this.config.authTokenTtlSeconds;
    const payload: AccessTokenPayload = {
      ...input,
      exp,
    };
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = this.sign(encodedPayload);

    return {
      accessToken: `${encodedPayload}.${signature}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  verifyAccessToken(token: string): CurrentPlayerContext {
    const [encodedPayload, signature] = token.split('.');

    if (!encodedPayload || !signature) {
      throw createUnauthorizedError('Invalid auth token.');
    }

    if (!isEqualSignature(signature, this.sign(encodedPayload))) {
      throw createUnauthorizedError('Invalid auth token signature.');
    }

    const payload = parsePayload(encodedPayload);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (payload.exp <= nowSeconds) {
      throw createUnauthorizedError('Auth token expired.');
    }

    return {
      playerId: payload.playerId,
      authIdentityId: payload.authIdentityId,
      provider: payload.provider,
      providerUserId: payload.providerUserId,
      tokenExpiresAt: new Date(payload.exp * 1000).toISOString(),
    };
  }

  private sign(encodedPayload: string): string {
    return createHmac('sha256', this.config.authTokenSecret).update(encodedPayload).digest('base64url');
  }
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function parsePayload(encodedPayload: string): AccessTokenPayload {
  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<AccessTokenPayload>;

    if (
      typeof parsed.playerId !== 'string'
      || typeof parsed.authIdentityId !== 'string'
      || (parsed.provider !== 'DEV_FAKE' && parsed.provider !== 'WECHAT')
      || typeof parsed.providerUserId !== 'string'
      || typeof parsed.exp !== 'number'
    ) {
      throw new Error('Invalid token payload shape.');
    }

    return parsed as AccessTokenPayload;
  } catch {
    throw createUnauthorizedError('Invalid auth token payload.');
  }
}

function isEqualSignature(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
