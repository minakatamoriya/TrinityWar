import { Body, Controller, Get, Headers, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { ClientRollSpiritTraitsResponse, ClientSpiritMutationResponse, ClientSpiritPublicProfileResponse, ClientSpiritStateResponse } from '@trinitywar/shared';
import { AuthPlaceholderGuard } from '../auth/auth-placeholder.guard.js';
import { CurrentPlayer } from '../auth/current-player.decorator.js';
import type { CurrentPlayerContext } from '../auth/current-player-context.js';
import { createUnauthorizedError } from '../common/errors/index.js';
import {
  BreakthroughSpiritRequestDto,
  BuySpiritSoulRequestDto,
  BuySpiritShopItemRequestDto,
  ClaimSpiritAdRewardRequestDto,
  ComposeSpiritRequestDto,
  DissolveSpiritRequestDto,
  FeedSpiritRequestDto,
  ResolveSpiritTraitRollRequestDto,
  RollSpiritTraitsRequestDto,
  SetMainSpiritRequestDto,
  UpgradeSpiritRequestDto,
} from './dto.js';
import { SpiritService } from './spirit.service.js';

@ApiTags('client-spirit')
@Controller('client/spirit')
export class SpiritController {
  constructor(@Inject(SpiritService) private readonly spiritService: SpiritService) {}

  @Get()
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Current player spirit state.' })
  async getSpiritState(@CurrentPlayer() currentPlayer: CurrentPlayerContext | null): Promise<ClientSpiritStateResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.spiritService.getSpiritStateResponse(currentPlayer.playerId);
  }

  @Get('players/:targetPlayerId')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Public spirit profile for a player.' })
  async getPublicSpiritProfile(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Param('targetPlayerId') targetPlayerId: string,
  ): Promise<ClientSpiritPublicProfileResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.spiritService.getPublicSpiritProfile(currentPlayer.playerId, targetPlayerId);
  }

  @Post('buy-soul')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: BuySpiritSoulRequestDto })
  @ApiOkResponse({ description: 'Buy spirit soul.' })
  async buySpiritSoul(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: BuySpiritSoulRequestDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.spiritService.buySpiritSoul(currentPlayer.playerId, body, idempotencyKey);
  }

  @Post('upgrade')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: UpgradeSpiritRequestDto })
  @ApiOkResponse({ description: 'Upgrade spirit level.' })
  async upgradeSpirit(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: UpgradeSpiritRequestDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.spiritService.upgradeSpirit(currentPlayer.playerId, body, idempotencyKey);
  }

  @Post('feed')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: FeedSpiritRequestDto })
  @ApiOkResponse({ description: 'Feed spirit root to gain exp and satiated time.' })
  async feedSpirit(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: FeedSpiritRequestDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.spiritService.feedSpirit(currentPlayer.playerId, body, idempotencyKey);
  }

  @Post('breakthrough')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: BreakthroughSpiritRequestDto })
  @ApiOkResponse({ description: 'Manually breakthrough spirit node.' })
  async breakthroughSpirit(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: BreakthroughSpiritRequestDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.spiritService.breakthroughSpirit(currentPlayer.playerId, body, idempotencyKey);
  }

  @Post('roll-traits')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: RollSpiritTraitsRequestDto })
  @ApiOkResponse({ description: 'Roll spirit traits.' })
  async rollSpiritTraits(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: RollSpiritTraitsRequestDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientRollSpiritTraitsResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.spiritService.rollSpiritTraits(currentPlayer.playerId, body, idempotencyKey);
  }

  @Post('resolve-roll')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: ResolveSpiritTraitRollRequestDto })
  @ApiOkResponse({ description: 'Resolve a pending spirit trait roll.' })
  async resolveSpiritTraitRoll(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ResolveSpiritTraitRollRequestDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.spiritService.resolveSpiritTraitRoll(currentPlayer.playerId, body, idempotencyKey);
  }

  @Post('shop/buy')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: BuySpiritShopItemRequestDto })
  @ApiOkResponse({ description: 'Buy a Tianji talisman shop item.' })
  async buySpiritShopItem(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: BuySpiritShopItemRequestDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.spiritService.buyShopItem(currentPlayer.playerId, body, idempotencyKey);
  }

  @Post('shop/ad-reward')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: ClaimSpiritAdRewardRequestDto })
  @ApiOkResponse({ description: 'Claim rewarded-ad Tianji talisman reward.' })
  async claimSpiritAdReward(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClaimSpiritAdRewardRequestDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.spiritService.claimAdReward(currentPlayer.playerId, body, idempotencyKey);
  }

  @Post('set-main')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: SetMainSpiritRequestDto })
  @ApiOkResponse({ description: 'Set main spirit.' })
  async setMainSpirit(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: SetMainSpiritRequestDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.spiritService.setMainSpirit(currentPlayer.playerId, body, idempotencyKey);
  }

  @Post('dissolve')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: DissolveSpiritRequestDto })
  @ApiOkResponse({ description: 'Dissolve spirit from slot.' })
  async dissolveSpirit(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: DissolveSpiritRequestDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.spiritService.dissolveSpirit(currentPlayer.playerId, body, idempotencyKey);
  }

  @Post('compose')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: ComposeSpiritRequestDto })
  @ApiOkResponse({ description: 'Compose spirit into empty slot.' })
  async composeSpirit(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ComposeSpiritRequestDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientSpiritMutationResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.spiritService.composeSpirit(currentPlayer.playerId, body, idempotencyKey);
  }
}

defineRouteParamTypes(SpiritController.prototype, 'getSpiritState', [Object]);
defineRouteParamTypes(SpiritController.prototype, 'getPublicSpiritProfile', [Object, String]);
defineRouteParamTypes(SpiritController.prototype, 'buySpiritSoul', [Object, Object, String]);
defineRouteParamTypes(SpiritController.prototype, 'upgradeSpirit', [Object, Object, String]);
defineRouteParamTypes(SpiritController.prototype, 'feedSpirit', [Object, Object, String]);
defineRouteParamTypes(SpiritController.prototype, 'breakthroughSpirit', [Object, Object, String]);
defineRouteParamTypes(SpiritController.prototype, 'rollSpiritTraits', [Object, Object, String]);
defineRouteParamTypes(SpiritController.prototype, 'resolveSpiritTraitRoll', [Object, Object, String]);
defineRouteParamTypes(SpiritController.prototype, 'buySpiritShopItem', [Object, Object, String]);
defineRouteParamTypes(SpiritController.prototype, 'claimSpiritAdReward', [Object, Object, String]);
defineRouteParamTypes(SpiritController.prototype, 'setMainSpirit', [Object, Object, String]);
defineRouteParamTypes(SpiritController.prototype, 'dissolveSpirit', [Object, Object, String]);
defineRouteParamTypes(SpiritController.prototype, 'composeSpirit', [Object, Object, String]);

function defineRouteParamTypes(target: object, methodName: string, paramTypes: unknown[]): void {
  const defineMetadata = Reflect.defineMetadata as
    | ((metadataKey: string, metadataValue: unknown, target: object, propertyKey: string) => void)
    | undefined;

  defineMetadata?.('design:paramtypes', paramTypes, target, methodName);
}
