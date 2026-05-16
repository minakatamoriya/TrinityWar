import { Body, Controller, Headers, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { ClientStateMutationResponse, ClientUpgradeBuildingRequest } from '@trinitywar/shared';
import { AuthPlaceholderGuard } from '../auth/auth-placeholder.guard.js';
import { CurrentPlayer } from '../auth/current-player.decorator.js';
import type { CurrentPlayerContext } from '../auth/current-player-context.js';
import { createUnauthorizedError } from '../common/errors/index.js';
import { ClientCommandService } from './client-command.service.js';
import { UpgradeBuildingRequestDto } from './dto.js';

@ApiTags('client')
@Controller('client/actions')
export class ClientCommandController {
  constructor(@Inject(ClientCommandService) private readonly clientCommandService: ClientCommandService) {}

  @Post('upgrade-building')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: UpgradeBuildingRequestDto })
  @ApiOkResponse({ description: 'Upgrade building mutation response.' })
  async upgradeBuilding(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientUpgradeBuildingRequest,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientStateMutationResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.upgradeBuilding({
      playerId: currentPlayer.playerId,
      request: body as UpgradeBuildingRequestDto,
      idempotencyKey,
    });
  }
}

defineRouteParamTypes(ClientCommandController.prototype, 'upgradeBuilding', [Object, Object, Object]);

function defineRouteParamTypes(target: object, methodName: string, paramTypes: unknown[]): void {
  const defineMetadata = Reflect.defineMetadata as
    | ((metadataKey: string, metadataValue: unknown, target: object, propertyKey: string) => void)
    | undefined;

  defineMetadata?.('design:paramtypes', paramTypes, target, methodName);
}
