import { Body, Controller, Headers, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type {
  ClientClaimSeasonSignInResponse,
  ClientClaimSeasonSignInMilestoneRequest,
  ClientClaimSeasonSignInMilestoneResponse,
  ClientClaimStarterSeedRequest,
  ClientClaimStarterSeedResponse,
  ClientChangeSeasonFactionRequest,
  ClientDevelopmentSeasonControlResponse,
  ClientClaimDailyTaskRequest,
  ClientClaimDailyTaskResponse,
  ClientClaimPendingRequest,
  ClientClaimPendingResponse,
  ClientClaimFactionStipendRequest,
  ClientClaimFactionStipendResponse,
  ClientCollectFieldRequest,
  ClientFactionDonateRequest,
  ClientFactionTaskSubmitRequest,
  ClientFactionTaskSubmitResponse,
  ClientSeasonStartupActionResponse,
  ClientConfirmSeasonFactionRequest,
  ClientUnlockPlantRequest,
  ClientUnlockPlantResponse,
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
import { ChangeSeasonFactionRequestDto, ClaimDailyTaskRequestDto, ClaimPendingRequestDto, ClaimSeasonSignInMilestoneRequestDto, ClaimStarterSeedRequestDto, CollectFieldRequestDto, ConfirmSeasonFactionRequestDto, FactionDonateRequestDto, FactionTaskSubmitRequestDto, ClaimFactionStipendRequestDto, RecruitArmyRequestDto, StartCultivationRequestDto, UnlockPlantRequestDto, UpgradeBuildingRequestDto } from './dto.js';

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

  @Post('claim-season-sign-in')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Claim current season sign-in reward.' })
  async claimSeasonSignIn(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
  ): Promise<ClientClaimSeasonSignInResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.claimSeasonSignIn({
      playerId: currentPlayer.playerId,
    });
  }

  @Post('claim-season-sign-in-milestone')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: ClaimSeasonSignInMilestoneRequestDto })
  @ApiOkResponse({ description: 'Claim a season sign-in milestone reward.' })
  async claimSeasonSignInMilestone(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientClaimSeasonSignInMilestoneRequest,
  ): Promise<ClientClaimSeasonSignInMilestoneResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.claimSeasonSignInMilestone({
      playerId: currentPlayer.playerId,
      request: body as ClaimSeasonSignInMilestoneRequestDto,
    });
  }

  @Post('refresh-raid-targets')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Refresh current player raid targets.' })
  async refreshRaidTargets(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
  ): Promise<ClientStateMutationResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.refreshRaidTargets({
      playerId: currentPlayer.playerId,
    });
  }

  @Post('claim-starter-seeds')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: ClaimStarterSeedRequestDto })
  @ApiOkResponse({ description: 'Claim tutorial starter plant access.' })
  async claimStarterSeeds(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientClaimStarterSeedRequest,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientClaimStarterSeedResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.claimStarterSeeds({
      playerId: currentPlayer.playerId,
      request: body as ClaimStarterSeedRequestDto,
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
  @ApiOkResponse({ description: '旧版兼容入口，不再发放贡献。' })
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

  @Post('submit-faction-task')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: FactionTaskSubmitRequestDto })
  @ApiOkResponse({ description: 'Submit progress to an available daily faction task.' })
  async submitFactionTask(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientFactionTaskSubmitRequest,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientFactionTaskSubmitResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.submitFactionTask({
      playerId: currentPlayer.playerId,
      request: body as FactionTaskSubmitRequestDto,
      idempotencyKey,
    });
  }

  @Post('unlock-plant')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: UnlockPlantRequestDto })
  @ApiOkResponse({ description: 'Unlock a discovered plant after meeting its contribution requirements.' })
  async unlockPlant(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientUnlockPlantRequest,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientUnlockPlantResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.unlockPlant({
      playerId: currentPlayer.playerId,
      request: body as UnlockPlantRequestDto,
      idempotencyKey,
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

  @Post('dev-season-near-rollover')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Set current season to end in 60 seconds for development verification.' })
  async setDevelopmentSeasonNearRollover(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
  ): Promise<ClientDevelopmentSeasonControlResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.setDevelopmentSeasonNearRollover({
      playerId: currentPlayer.playerId,
    });
  }

  @Post('dev-season-reset-timing')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Restore normal season timing after development verification.' })
  async resetDevelopmentSeasonTiming(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
  ): Promise<ClientDevelopmentSeasonControlResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.resetDevelopmentSeasonTiming({
      playerId: currentPlayer.playerId,
    });
  }

  @Post('confirm-season-startup-intro')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Confirm season startup intro step.' })
  async confirmSeasonStartupIntro(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
  ): Promise<ClientSeasonStartupActionResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.confirmSeasonStartupIntro({
      playerId: currentPlayer.playerId,
    });
  }

  @Post('confirm-season-faction')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: ConfirmSeasonFactionRequestDto })
  @ApiOkResponse({ description: 'Confirm keeping current faction for the current season startup.' })
  async confirmSeasonFaction(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() _body: ClientConfirmSeasonFactionRequest,
  ): Promise<ClientSeasonStartupActionResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.confirmSeasonFaction({
      playerId: currentPlayer.playerId,
    });
  }

  @Post('change-season-faction')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: ChangeSeasonFactionRequestDto })
  @ApiOkResponse({ description: 'Change faction during the current season startup flow.' })
  async changeSeasonFaction(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientChangeSeasonFactionRequest,
  ): Promise<ClientSeasonStartupActionResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.clientCommandService.changeSeasonFaction({
      playerId: currentPlayer.playerId,
      request: body,
    });
  }
}

defineRouteParamTypes(ClientCommandController.prototype, 'claimPending', [Object, Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'claimDailyTask', [Object, Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'claimSeasonSignIn', [Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'claimSeasonSignInMilestone', [Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'refreshRaidTargets', [Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'claimStarterSeeds', [Object, Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'collectField', [Object, Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'startCultivation', [Object, Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'recruitArmy', [Object, Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'upgradeBuilding', [Object, Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'donateFaction', [Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'submitFactionTask', [Object, Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'unlockPlant', [Object, Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'claimFactionStipend', [Object, Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'resetDemoState', [Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'setDevelopmentSeasonNearRollover', [Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'resetDevelopmentSeasonTiming', [Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'confirmSeasonStartupIntro', [Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'confirmSeasonFaction', [Object, Object]);
defineRouteParamTypes(ClientCommandController.prototype, 'changeSeasonFaction', [Object, Object]);

function defineRouteParamTypes(target: object, methodName: string, paramTypes: unknown[]): void {
  const defineMetadata = Reflect.defineMetadata as
    | ((metadataKey: string, metadataValue: unknown, target: object, propertyKey: string) => void)
    | undefined;

  defineMetadata?.('design:paramtypes', paramTypes, target, methodName);
}
