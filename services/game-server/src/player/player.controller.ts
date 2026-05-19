import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthPlaceholderGuard } from '../auth/auth-placeholder.guard.js';
import { CurrentPlayer } from '../auth/current-player.decorator.js';
import type { CurrentPlayerContext } from '../auth/current-player-context.js';
import { createUnauthorizedError } from '../common/errors/index.js';
import { PlayerService, type CurrentPlayerResponse } from './player.service.js';
import type { ClientFarmBoardState, ClientFarmBoardUpdateRequest, ClientFarmBoardUpdateResponse } from '@trinitywar/shared';

@ApiTags('client-player')
@Controller('client')
export class PlayerController {
  constructor(@Inject(PlayerService) private readonly playerService: PlayerService) {}

  @Get('me')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Current player summary.' })
  async getMe(@CurrentPlayer() currentPlayer: CurrentPlayerContext | null): Promise<CurrentPlayerResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.playerService.getCurrentPlayer(currentPlayer);
  }

  @Get('profile/farm-board')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Current farm board message.' })
  async getFarmBoard(@CurrentPlayer() currentPlayer: CurrentPlayerContext | null): Promise<ClientFarmBoardState> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.playerService.getFarmBoard(currentPlayer.playerId);
  }

  @Post('profile/farm-board')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Update farm board message.' })
  async updateFarmBoard(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientFarmBoardUpdateRequest,
  ): Promise<ClientFarmBoardUpdateResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.playerService.updateFarmBoard(currentPlayer.playerId, body);
  }
}

defineRouteParamTypes(PlayerController.prototype, 'getMe', [Object]);
defineRouteParamTypes(PlayerController.prototype, 'getFarmBoard', [Object]);
defineRouteParamTypes(PlayerController.prototype, 'updateFarmBoard', [Object, Object]);

function defineRouteParamTypes(target: object, methodName: string, paramTypes: unknown[]): void {
  const defineMetadata = Reflect.defineMetadata as
    | ((metadataKey: string, metadataValue: unknown, target: object, propertyKey: string) => void)
    | undefined;

  defineMetadata?.('design:paramtypes', paramTypes, target, methodName);
}
