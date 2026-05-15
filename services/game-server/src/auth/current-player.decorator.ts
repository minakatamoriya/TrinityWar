import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CurrentPlayerContext } from './current-player-context.js';

interface RequestWithCurrentPlayer {
  currentPlayer?: CurrentPlayerContext;
}

export const CurrentPlayer = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentPlayerContext | null => {
    const request = context.switchToHttp().getRequest<RequestWithCurrentPlayer>();
    return request.currentPlayer ?? null;
  },
);
