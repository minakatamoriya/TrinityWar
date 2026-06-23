import { Body, Controller, Headers, Inject, Param, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type {
  ClientRaidActionRequest,
  ClientRaidActionResponse,
  ClientRaidBattleReplayResponse,
  ClientRaidDeepIntelResponse,
  ClientRaidOrderMessageRequest,
  ClientRaidOrderMessageResponse,
  ClientRaidTargetDetailResponse,
} from '@trinitywar/shared';
import { AuthPlaceholderGuard } from '../auth/auth-placeholder.guard.js';
import { CurrentPlayer } from '../auth/current-player.decorator.js';
import type { CurrentPlayerContext } from '../auth/current-player-context.js';
import { createUnauthorizedError } from '../common/errors/index.js';
import { RaidTargetRequestDto } from '../client-command/dto.js';
import { RaidTargetService } from './raid-target.service.js';

@ApiTags('client')
@Controller('client')
export class RaidController {
  constructor(@Inject(RaidTargetService) private readonly raidTargetService: RaidTargetService) {}

  @Get('raid-targets/:targetId')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Client raid target detail payload.' })
  async getRaidTargetDetail(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Param('targetId') targetId: string,
  ): Promise<ClientRaidTargetDetailResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.raidTargetService.getRaidTargetDetail(currentPlayer.playerId, targetId);
  }

  @Post('raid-targets/:targetId/deep-intel')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Reveal limited spirit intel for a visible raid target.' })
  async getRaidTargetDeepIntel(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Param('targetId') targetId: string,
  ): Promise<ClientRaidDeepIntelResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.raidTargetService.getRaidTargetDeepIntel(currentPlayer.playerId, targetId);
  }

  @Post('actions/raid-target')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: RaidTargetRequestDto })
  @ApiOkResponse({ description: 'Create raid order response.' })
  async raidTarget(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientRaidActionRequest,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientRaidActionResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.raidTargetService.createRaidOrder({
      playerId: currentPlayer.playerId,
      targetId: body.targetId,
      requestIdempotencyKey: idempotencyKey ?? body.requestIdempotencyKey,
      attackerSpiritInstanceId: body.attackerSpiritInstanceId,
      armyVersion: body.armyVersion,
    });
  }

  @Post('raid-orders/:orderId/message')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Create raid order message from a fixed template.' })
  async createRaidOrderMessage(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Param('orderId') orderId: string,
    @Body() body: ClientRaidOrderMessageRequest,
  ): Promise<ClientRaidOrderMessageResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.raidTargetService.createRaidOrderMessage({
      playerId: currentPlayer.playerId,
      raidOrderId: orderId,
      messageTemplateId: body.messageTemplateId,
    });
  }

  @Get('raid-orders/:orderId/battle-replay')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Readonly raid battle replay payload.' })
  async getRaidBattleReplay(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Param('orderId') orderId: string,
  ): Promise<ClientRaidBattleReplayResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.raidTargetService.getRaidBattleReplay({
      playerId: currentPlayer.playerId,
      raidOrderId: orderId,
    });
  }
}

defineRouteParamTypes(RaidController.prototype, 'getRaidTargetDetail', [Object, String]);
defineRouteParamTypes(RaidController.prototype, 'getRaidTargetDeepIntel', [Object, String]);
defineRouteParamTypes(RaidController.prototype, 'raidTarget', [Object, Object, Object]);
defineRouteParamTypes(RaidController.prototype, 'createRaidOrderMessage', [Object, String, Object]);
defineRouteParamTypes(RaidController.prototype, 'getRaidBattleReplay', [Object, String]);

function defineRouteParamTypes(target: object, methodName: string, paramTypes: unknown[]): void {
  const defineMetadata = Reflect.defineMetadata as
    | ((metadataKey: string, metadataValue: unknown, target: object, propertyKey: string) => void)
    | undefined;

  defineMetadata?.('design:paramtypes', paramTypes, target, methodName);
}
