import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { ClientBootstrapResponse } from '@trinitywar/shared';
import { AuthPlaceholderGuard } from '../auth/auth-placeholder.guard.js';
import { CurrentPlayer } from '../auth/current-player.decorator.js';
import type { CurrentPlayerContext } from '../auth/current-player-context.js';
import { createUnauthorizedError } from '../common/errors/index.js';
import { ClientReadService } from './client-read.service.js';

@ApiTags('client')
@Controller('client')
export class ClientReadController {
  constructor(@Inject(ClientReadService) private readonly clientReadService: ClientReadService) {}

  @Get('bootstrap')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Client bootstrap payload.' })
  async getBootstrap(@CurrentPlayer() currentPlayer: CurrentPlayerContext | null): Promise<ClientBootstrapResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientReadService.getBootstrap(currentPlayer.playerId);
  }
}

defineRouteParamTypes(ClientReadController.prototype, 'getBootstrap', [Object]);

function defineRouteParamTypes(target: object, methodName: string, paramTypes: unknown[]): void {
  const defineMetadata = Reflect.defineMetadata as
    | ((metadataKey: string, metadataValue: unknown, target: object, propertyKey: string) => void)
    | undefined;

  defineMetadata?.('design:paramtypes', paramTypes, target, methodName);
}
