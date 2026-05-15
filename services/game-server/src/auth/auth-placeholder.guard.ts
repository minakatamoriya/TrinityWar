import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { createUnauthorizedError } from '../common/errors/index.js';
import { AuthTokenService } from './auth-token.service.js';
import type { CurrentPlayerContext } from './current-player-context.js';

interface RequestWithCurrentPlayer {
  headers?: Record<string, string | string[] | undefined>;
  currentPlayer?: CurrentPlayerContext;
}

@Injectable()
export class AuthPlaceholderGuard implements CanActivate {
  constructor(@Inject(AuthTokenService) private readonly authTokenService: AuthTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithCurrentPlayer>();
    const authorization = request.headers?.authorization;
    const headerValue = Array.isArray(authorization) ? authorization[0] : authorization;

    if (!headerValue?.startsWith('Bearer ')) {
      throw createUnauthorizedError('Authorization bearer token is required.');
    }

    request.currentPlayer = this.authTokenService.verifyAccessToken(headerValue.slice('Bearer '.length));
    return true;
  }
}
