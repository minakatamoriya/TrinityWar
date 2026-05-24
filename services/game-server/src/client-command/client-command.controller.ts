import { Body, Controller, Headers, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type {
  ClientClaimDailyTaskRequest,
  ClientClaimDailyTaskResponse,
  ClientClaimPendingRequest,
  ClientClaimPendingResponse,
  ClientClaimFactionStipendRequest,
  ClientClaimFactionStipendResponse,
  ClientCollectFieldRequest,
  ClientFactionDonateRequest,
  ClientCollectFieldResponse,
  ClientRecruitArmyRequest,
  ClientResetDemoStateResponse,
  ClientStartCultivationRequest,
  ClientStateMutationResponse,
  ClientUpgradeBuildingRequest,
} from '@trinitywar/shared';
import { AuthPlaceholderGuard } from '../auth/auth-placeholder.guard.js';
import { CurrentPlayer } from '../auth/current-player.decorator.js';
import type { CurrentPlayerContext } from '../auth/current-player-context.js';
import { createUnauthorizedError } from '../common/errors/index.js';
import { ClientCommandService } from './client-command.service.js';
import { ClaimDailyTaskRequestDto, ClaimPendingRequestDto, CollectFieldRequestDto, FactionDonateRequestDto, ClaimFactionStipendRequestDto, RecruitArmyRequestDto, StartCultivationRequestDto, UpgradeBuildingRequestDto } from './dto.js';

@ApiTags('client')
@Controller('client/actions')
export class ClientCommandController {
  constructor(@Inject(ClientCommandService) private readonly clientCommandService: ClientCommandService) {}

  @Post('claim-pending')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: ClaimPendingRequestDto })
  @ApiOkResponse({ description: 'Claim pending gold mutation response.' })
  async claimPending(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientClaimPendingRequest,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientClaimPendingResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.claimPending({
      playerId: currentPlayer.playerId,
      request: body as ClaimPendingRequestDto,
      idempotencyKey,
    });
  }

  @Post('claim-daily-task')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: ClaimDailyTaskRequestDto })
  @ApiOkResponse({ description: 'Claim daily task mutation response.' })
  async claimDailyTask(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientClaimDailyTaskRequest,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientClaimDailyTaskResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.claimDailyTask({
      playerId: currentPlayer.playerId,
      request: body as ClaimDailyTaskRequestDto,
      idempotencyKey,
    });
  }

  @Post('collect-field')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: CollectFieldRequestDto })
  @ApiOkResponse({ description: 'Collect field mutation response.' })
  async collectField(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientCollectFieldRequest,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientCollectFieldResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.collectField({
      playerId: currentPlayer.playerId,
      request: body as CollectFieldRequestDto,
      idempotencyKey,
    });
  }

  @Post('start-cultivation')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: StartCultivationRequestDto })
  @ApiOkResponse({ description: 'Start field cultivation mutation response.' })
  async startCultivation(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientStartCultivationRequest,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientStateMutationResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.startCultivation({
      playerId: currentPlayer.playerId,
      request: body as StartCultivationRequestDto,
      idempotencyKey,
    });
  }

  @Post('recruit-army')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: RecruitArmyRequestDto })
  @ApiOkResponse({ description: 'Recruit army mutation response.' })
  async recruitArmy(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientRecruitArmyRequest,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientStateMutationResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.recruitArmy({
      playerId: currentPlayer.playerId,
      request: body as RecruitArmyRequestDto,
      idempotencyKey,
    });
  }

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

  @Post('faction-donate')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: FactionDonateRequestDto })
  @ApiOkResponse({ description: 'Donate gold to faction and gain contribution.' })
  async donateFaction(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientFactionDonateRequest,
  ): Promise<ClientStateMutationResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.donateFaction({
      playerId: currentPlayer.playerId,
      request: body,
    });
  }

  @Post('claim-faction-stipend')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: ClaimFactionStipendRequestDto })
  @ApiOkResponse({ description: 'Claim daily faction stipend rewards.' })
  async claimFactionStipend(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientClaimFactionStipendRequest,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientClaimFactionStipendResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.claimFactionStipend({
      playerId: currentPlayer.playerId,
      request: body as ClaimFactionStipendRequestDto,
      idempotencyKey,
    });
  }

  @Post('reset-demo-state')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Reset current development player state.' })
  async resetDemoState(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
  ): Promise<ClientResetDemoStateResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.resetDemoState({
      playerId: currentPlayer.playerId,
    });
  }
}

defineRouteParamTypes(ClientCommandController.prototype, 'claimPending', [Object, Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'claimDailyTask', [Object, Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'collectField', [Object, Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'startCultivation', [Object, Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'recruitArmy', [Object, Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'upgradeBuilding', [Object, Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'donateFaction', [Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'claimFactionStipend', [Object, Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'resetDemoState', [Object]);

function defineRouteParamTypes(target: object, methodName: string, paramTypes: unknown[]): void {
  const defineMetadata = Reflect.defineMetadata as
    | ((metadataKey: string, metadataValue: unknown, target: object, propertyKey: string) => void)
    | undefined;

  defineMetadata?.('design:paramtypes', paramTypes, target, methodName);
}
