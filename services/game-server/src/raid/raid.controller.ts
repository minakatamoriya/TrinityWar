import { Body, Controller, Headers, Inject, Param, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { ClientRaidActionRequest, ClientRaidActionResponse, ClientRaidTargetDetailResponse } from '@trinitywar/shared';
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
      armyVersion: body.armyVersion,
    });
  }
}

defineRouteParamTypes(RaidController.prototype, 'getRaidTargetDetail', [Object, String]);
defineRouteParamTypes(RaidController.prototype, 'raidTarget', [Object, Object, Object]);

function defineRouteParamTypes(target: object, methodName: string, paramTypes: unknown[]): void {
  const defineMetadata = Reflect.defineMetadata as
    | ((metadataKey: string, metadataValue: unknown, target: object, propertyKey: string) => void)
    | undefined;

  defineMetadata?.('design:paramtypes', paramTypes, target, methodName);
}
