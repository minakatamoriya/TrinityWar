import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { ClientBootstrapResponse, ClientSceneContentResponse, ClientSeasonRewardsResponse, ClientSeasonSignInResponse, HomeSummaryResponse } from '@trinitywar/shared';
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

  @Get('home-summary')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Client home summary payload.' })
  async getHomeSummary(@CurrentPlayer() currentPlayer: CurrentPlayerContext | null): Promise<HomeSummaryResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientReadService.getHomeSummary(currentPlayer.playerId);
  }

  @Get('season/sign-in')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Client season sign-in state.' })
  async getSeasonSignIn(@CurrentPlayer() currentPlayer: CurrentPlayerContext | null): Promise<ClientSeasonSignInResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientReadService.getSeasonSignIn(currentPlayer.playerId);
  }

  @Get('season/rewards')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Client season reward grants.' })
  async getSeasonRewards(@CurrentPlayer() currentPlayer: CurrentPlayerContext | null): Promise<ClientSeasonRewardsResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientReadService.getSeasonRewards(currentPlayer.playerId);
  }

  @Get('scene-content')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Client scene content payload.' })
  async getSceneContent(@CurrentPlayer() currentPlayer: CurrentPlayerContext | null): Promise<ClientSceneContentResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientReadService.getSceneContent(currentPlayer.playerId);
  }
}

defineRouteParamTypes(ClientReadController.prototype, 'getBootstrap', [Object]);
defineRouteParamTypes(ClientReadController.prototype, 'getHomeSummary', [Object]);
defineRouteParamTypes(ClientReadController.prototype, 'getSeasonSignIn', [Object]);
defineRouteParamTypes(ClientReadController.prototype, 'getSeasonRewards', [Object]);
defineRouteParamTypes(ClientReadController.prototype, 'getSceneContent', [Object]);

function defineRouteParamTypes(target: object, methodName: string, paramTypes: unknown[]): void {
  const defineMetadata = Reflect.defineMetadata as
    | ((metadataKey: string, metadataValue: unknown, target: object, propertyKey: string) => void)
    | undefined;

  defineMetadata?.('design:paramtypes', paramTypes, target, methodName);
}
