import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type {
  AdminAdjustPlayerResourcesResponse,
  AdminDeletePlayerResponse,
  AdminListResponse,
  AdminOverviewResponse,
  AdminPlayerOverviewResponse,
  AdminPlayerSearchResponse,
  AdminRaidOrderDetailResponse,
  AdminRobotDashboardResponse,
  AdminSystemStatusResponse,
} from '@trinitywar/shared';
import { AdminReadonlyGuard } from './admin-readonly.guard.js';
import { AdminReadonlyService } from './admin-readonly.service.js';

@ApiTags('admin')
@UseGuards(AdminReadonlyGuard)
@Controller('admin')
export class AdminReadonlyController {
  constructor(@Inject(AdminReadonlyService) private readonly adminReadonlyService: AdminReadonlyService) {}

  @Get('overview')
  @ApiOkResponse({ description: 'Admin overview with read/write capability groups.' })
  getOverview(): Promise<AdminOverviewResponse> {
    return this.adminReadonlyService.getOverview();
  }

  @Get('system/status')
  @ApiOkResponse({ description: 'Admin system status.' })
  getSystemStatus(): Promise<AdminSystemStatusResponse> {
    return this.adminReadonlyService.getSystemStatus();
  }

  @Get('audit-logs')
  @ApiOkResponse({ description: 'List admin operation audit logs.' })
  listAuditLogs(@Query() query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.listAuditLogs(query);
  }

  @Get('robots/dashboard')
  @ApiOkResponse({ description: 'Readonly robot smoke test dashboard.' })
  getRobotDashboard(): Promise<AdminRobotDashboardResponse> {
    return this.adminReadonlyService.getRobotDashboard();
  }

  @Get('robots/daily-3/automation-config')
  @ApiOkResponse({ description: 'Get daily-3 robot automation config.' })
  getRobotDaily3AutomationConfig(): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.getRobotDaily3AutomationConfig();
  }

  @Patch('robots/daily-3/automation-config')
  @ApiOkResponse({ description: 'Update daily-3 robot automation config.' })
  updateRobotDaily3AutomationConfig(@Body() body: unknown): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.updateRobotDaily3AutomationConfig(body);
  }

  @Get('robots/social-3/automation-config')
  @ApiOkResponse({ description: 'Get social-3 robot automation config.' })
  getRobotSocial3AutomationConfig(): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.getRobotSocial3AutomationConfig();
  }

  @Patch('robots/social-3/automation-config')
  @ApiOkResponse({ description: 'Update social-3 robot automation config.' })
  updateRobotSocial3AutomationConfig(@Body() body: unknown): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.updateRobotSocial3AutomationConfig(body);
  }

  @Get('robots/player-sim-v1/automation-config')
  @ApiOkResponse({ description: 'Get player-sim-v1 robot automation config.' })
  getRobotPlayerSimV1AutomationConfig(): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.getRobotPlayerSimV1AutomationConfig();
  }

  @Patch('robots/player-sim-v1/automation-config')
  @ApiOkResponse({ description: 'Update player-sim-v1 robot automation config.' })
  updateRobotPlayerSimV1AutomationConfig(@Body() body: unknown): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.updateRobotPlayerSimV1AutomationConfig(body);
  }

  @Get('robots/season-sim-v1/automation-config')
  @ApiOkResponse({ description: 'Get season-sim-v1 robot automation config.' })
  getRobotSeasonSimV1AutomationConfig(): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.getRobotSeasonSimV1AutomationConfig();
  }

  @Patch('robots/season-sim-v1/automation-config')
  @ApiOkResponse({ description: 'Update season-sim-v1 robot automation config.' })
  updateRobotSeasonSimV1AutomationConfig(@Body() body: unknown): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.updateRobotSeasonSimV1AutomationConfig(body);
  }

  @Post('robots/smoke')
  @ApiOkResponse({ description: 'Run one robot smoke test cycle.' })
  runRobotSmoke(): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.runRobotSmoke();
  }

  @Post('robots/daily-3')
  @ApiOkResponse({ description: 'Run one daily-3 robot test cycle.' })
  runRobotDaily3(): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.runRobotDaily3();
  }

  @Post('robots/social-3')
  @ApiOkResponse({ description: 'Run one social-3 robot test cycle.' })
  runRobotSocial3(): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.runRobotSocial3();
  }

  @Post('robots/player-sim-v1')
  @ApiOkResponse({ description: 'Run one diligent player simulation cycle.' })
  runRobotPlayerSimV1(): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.runRobotPlayerSimV1();
  }

  @Post('robots/season-sim-v1/day')
  @ApiOkResponse({ description: 'Run one simulated season day for diligent players.' })
  runRobotSeasonSimV1Day(@Body() body: unknown): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.runRobotSeasonSimV1Day(body);
  }

  @Post('robots/daily-3/loop/start')
  @ApiOkResponse({ description: 'Start daily-3 robot test loop.' })
  startRobotDaily3Loop(@Body() body: unknown): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.startRobotDaily3Loop(body);
  }

  @Post('robots/social-3/loop/start')
  @ApiOkResponse({ description: 'Start social-3 robot test loop.' })
  startRobotSocial3Loop(@Body() body: unknown): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.startRobotSocial3Loop(body);
  }

  @Post('robots/player-sim-v1/loop/start')
  @ApiOkResponse({ description: 'Start player-sim-v1 robot test loop.' })
  startRobotPlayerSimV1Loop(@Body() body: unknown): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.startRobotPlayerSimV1Loop(body);
  }

  @Post('robots/season-sim-v1/loop/start')
  @ApiOkResponse({ description: 'Start season-sim-v1 robot simulation loop.' })
  startRobotSeasonSimV1Loop(@Body() body: unknown): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.startRobotSeasonSimV1Loop(body);
  }

  @Post('robots/daily-3/loop/stop')
  @ApiOkResponse({ description: 'Stop daily-3 robot test loop.' })
  stopRobotDaily3Loop(): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.stopRobotDaily3Loop();
  }

  @Post('robots/season-sim-v1/loop/stop')
  @ApiOkResponse({ description: 'Stop season-sim-v1 robot simulation loop.' })
  stopRobotSeasonSimV1Loop(): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.stopRobotSeasonSimV1Loop();
  }

  @Delete('robots/errors')
  @ApiOkResponse({ description: 'Clear robot failed action logs.' })
  clearRobotErrors(): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.clearRobotErrors();
  }

  @Get('seasons/current')
  @ApiOkResponse({ description: 'Readonly current season status.' })
  getCurrentSeasonAdmin(): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.getCurrentSeasonAdmin();
  }

  @Get('seasons')
  @ApiOkResponse({ description: 'Readonly season list.' })
  listSeasons(@Query() query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.listSeasons(query);
  }

  @Get('seasons/:seasonNumber/player-snapshots')
  @ApiOkResponse({ description: 'Readonly player season snapshots.' })
  listPlayerSeasonSnapshots(
    @Param('seasonNumber') seasonNumber: string,
    @Query() query: Record<string, string | undefined>,
  ): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.listPlayerSeasonSnapshots(Number(seasonNumber), query);
  }

  @Get('seasons/:seasonNumber/faction-snapshots')
  @ApiOkResponse({ description: 'Readonly faction season snapshots.' })
  listFactionSeasonSnapshots(
    @Param('seasonNumber') seasonNumber: string,
    @Query() query: Record<string, string | undefined>,
  ): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.listFactionSeasonSnapshots(Number(seasonNumber), query);
  }

  @Get('seasons/:seasonNumber/reward-summary')
  @ApiOkResponse({ description: 'Readonly season reward summary.' })
  getSeasonRewardSummary(@Param('seasonNumber') seasonNumber: string): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.getSeasonRewardSummary(Number(seasonNumber));
  }

  @Get('seasons/:seasonNumber/reward-grants')
  @ApiOkResponse({ description: 'Readonly season reward grants.' })
  listSeasonRewardGrants(
    @Param('seasonNumber') seasonNumber: string,
    @Query() query: Record<string, string | undefined>,
  ): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.listSeasonRewardGrants(Number(seasonNumber), query);
  }

  @Get('seasons/:seasonNumber/rewards/preview')
  @ApiOkResponse({ description: 'Readonly season reward preview for a player snapshot.' })
  getSeasonRewardPreview(
    @Param('seasonNumber') seasonNumber: string,
    @Query() query: Record<string, string | undefined>,
  ): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.getSeasonRewardPreview(Number(seasonNumber), query);
  }

  @Get('seasons/:seasonNumber/achievements')
  @ApiOkResponse({ description: 'Readonly season achievements.' })
  listSeasonAchievements(
    @Param('seasonNumber') seasonNumber: string,
    @Query() query: Record<string, string | undefined>,
  ): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.listSeasonAchievements(Number(seasonNumber), query);
  }

  @Get('config/seeds')
  @ApiOkResponse({ description: 'List plant definitions.' })
  listSeedDefinitions(@Query() query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.listSeedDefinitions(query);
  }

  @Post('config/seeds')
  @ApiOkResponse({ description: 'Create plant definition.' })
  createSeedDefinition(@Body() body: unknown): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.createSeedDefinition(body);
  }

  @Patch('config/seeds/:seedId')
  @ApiOkResponse({ description: 'Update plant definition.' })
  updateSeedDefinition(@Param('seedId') seedId: string, @Body() body: unknown): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.updateSeedDefinition(seedId, body);
  }

  @Delete('config/seeds/:seedId')
  @ApiOkResponse({ description: 'Delete plant definition.' })
  deleteSeedDefinition(@Param('seedId') seedId: string, @Body() body: unknown): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.deleteSeedDefinition(seedId, body);
  }

  @Get('config/spirits')
  @ApiOkResponse({ description: 'List spirit definitions.' })
  listSpiritDefinitions(@Query() query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.listSpiritDefinitions(query);
  }

  @Post('config/spirits')
  @ApiOkResponse({ description: 'Create spirit definition.' })
  createSpiritDefinition(@Body() body: unknown): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.createSpiritDefinition(body);
  }

  @Patch('config/spirits/:spiritId')
  @ApiOkResponse({ description: 'Update spirit definition.' })
  updateSpiritDefinition(@Param('spiritId') spiritId: string, @Body() body: unknown): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.updateSpiritDefinition(spiritId, body);
  }

  @Delete('config/spirits/:spiritId')
  @ApiOkResponse({ description: 'Delete spirit definition.' })
  deleteSpiritDefinition(@Param('spiritId') spiritId: string, @Body() body: unknown): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.deleteSpiritDefinition(spiritId, body);
  }

  @Get('config/castle-levels')
  @ApiOkResponse({ description: 'List readonly castle level configs.' })
  listCastleLevels(): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.listCastleLevels();
  }

  @Get('config/tasks')
  @ApiOkResponse({ description: 'List task configs.' })
  listTaskConfigs(@Query() query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.listTaskConfigs(query);
  }

  @Get('share-assist/campaigns')
  @ApiOkResponse({ description: 'List share assist campaigns.' })
  listShareAssistCampaigns(@Query() query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.listShareAssistCampaigns(query);
  }

  @Get('share-assist/records')
  @ApiOkResponse({ description: 'List share assist records.' })
  listShareAssistRecords(@Query() query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.listShareAssistRecords(query);
  }

  @Get('share-assist/invite-relations')
  @ApiOkResponse({ description: 'List player invite relations created by share assist.' })
  listShareInviteRelations(@Query() query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.listShareInviteRelations(query);
  }

  @Patch('config/tasks/:taskGroup/:taskId')
  @ApiOkResponse({ description: 'Update task config override.' })
  updateTaskConfig(
    @Param('taskGroup') taskGroup: string,
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.updateTaskConfig(taskGroup, taskId, body);
  }

  @Get('players/search')
  @ApiOkResponse({ description: 'Search players by id, nickname, or dev identity.' })
  searchPlayers(@Query() query: Record<string, string | undefined>): Promise<AdminPlayerSearchResponse> {
    return this.adminReadonlyService.searchPlayers(query);
  }

  @Get('players/:playerId/overview')
  @ApiOkResponse({ description: 'Readonly player aggregate overview.' })
  getPlayerOverview(@Param('playerId') playerId: string): Promise<AdminPlayerOverviewResponse> {
    return this.adminReadonlyService.getPlayerOverview(playerId);
  }

  @Post('players/:playerId/resources/adjust')
  @ApiOkResponse({ description: 'Adjust player resources with admin audit.' })
  adjustPlayerResources(
    @Param('playerId') playerId: string,
    @Body() body: unknown,
  ): Promise<AdminAdjustPlayerResourcesResponse> {
    return this.adminReadonlyService.adjustPlayerResources(playerId, body);
  }

  @Get('players/:playerId/season-state')
  @ApiOkResponse({ description: 'Readonly player season state.' })
  getPlayerSeasonState(@Param('playerId') playerId: string): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.getPlayerSeasonState(playerId);
  }

  @Get('players/:playerId/season-history')
  @ApiOkResponse({ description: 'Readonly player season history snapshots.' })
  listPlayerSeasonHistory(
    @Param('playerId') playerId: string,
    @Query() query: Record<string, string | undefined>,
  ): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.listPlayerSeasonHistory(playerId, query);
  }

  @Get('players/:playerId/season-rewards')
  @ApiOkResponse({ description: 'Readonly player season reward history.' })
  listPlayerSeasonRewardHistory(
    @Param('playerId') playerId: string,
    @Query() query: Record<string, string | undefined>,
  ): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.listPlayerSeasonRewardHistory(playerId, query);
  }

  @Delete('players/:playerId')
  @ApiOkResponse({ description: 'Delete player and cascaded records.' })
  deletePlayer(@Param('playerId') playerId: string, @Body() body: unknown): Promise<AdminDeletePlayerResponse> {
    return this.adminReadonlyService.deletePlayer(playerId, body);
  }

  @Get('players/:playerId/wallet-logs')
  @ApiOkResponse({ description: 'Readonly player wallet logs.' })
  getWalletLogs(
    @Param('playerId') playerId: string,
    @Query() query: Record<string, string | undefined>,
  ): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.getWalletLogs(playerId, query);
  }

  @Get('players/:playerId/building-logs')
  @ApiOkResponse({ description: 'Readonly player building upgrade logs.' })
  getBuildingLogs(
    @Param('playerId') playerId: string,
    @Query() query: Record<string, string | undefined>,
  ): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.getBuildingLogs(playerId, query);
  }

  @Get('players/:playerId/field-logs')
  @ApiOkResponse({ description: 'Readonly player field harvest logs.' })
  getFieldLogs(
    @Param('playerId') playerId: string,
    @Query() query: Record<string, string | undefined>,
  ): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.getFieldLogs(playerId, query);
  }

  @Get('players/:playerId/orders')
  @ApiOkResponse({ description: 'Readonly player order summary.' })
  getPlayerOrders(
    @Param('playerId') playerId: string,
    @Query() query: Record<string, string | undefined>,
  ): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.getPlayerOrders(playerId, query);
  }

  @Get('raid/orders/:orderId')
  @ApiOkResponse({ description: 'Readonly raid order detail.' })
  getRaidOrderDetail(@Param('orderId') orderId: string): Promise<AdminRaidOrderDetailResponse> {
    return this.adminReadonlyService.getRaidOrderDetail(orderId);
  }
}

defineRouteParamTypes(AdminReadonlyController.prototype, 'searchPlayers', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'listAuditLogs', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'getRobotDaily3AutomationConfig', []);
defineRouteParamTypes(AdminReadonlyController.prototype, 'updateRobotDaily3AutomationConfig', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'getRobotSocial3AutomationConfig', []);
defineRouteParamTypes(AdminReadonlyController.prototype, 'updateRobotSocial3AutomationConfig', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'startRobotSocial3Loop', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'getRobotPlayerSimV1AutomationConfig', []);
defineRouteParamTypes(AdminReadonlyController.prototype, 'updateRobotPlayerSimV1AutomationConfig', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'getRobotSeasonSimV1AutomationConfig', []);
defineRouteParamTypes(AdminReadonlyController.prototype, 'updateRobotSeasonSimV1AutomationConfig', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'startRobotPlayerSimV1Loop', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'runRobotSeasonSimV1Day', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'startRobotSeasonSimV1Loop', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'startRobotDaily3Loop', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'getCurrentSeasonAdmin', []);
defineRouteParamTypes(AdminReadonlyController.prototype, 'listSeasons', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'listPlayerSeasonSnapshots', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'listFactionSeasonSnapshots', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'getSeasonRewardSummary', [String]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'listSeasonRewardGrants', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'getSeasonRewardPreview', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'listSeasonAchievements', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'listSeedDefinitions', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'createSeedDefinition', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'updateSeedDefinition', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'deleteSeedDefinition', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'listSpiritDefinitions', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'createSpiritDefinition', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'updateSpiritDefinition', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'deleteSpiritDefinition', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'listCastleLevels', []);
defineRouteParamTypes(AdminReadonlyController.prototype, 'listTaskConfigs', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'listShareAssistCampaigns', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'listShareAssistRecords', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'listShareInviteRelations', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'updateTaskConfig', [String, String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'getPlayerOverview', [String]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'adjustPlayerResources', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'getPlayerSeasonState', [String]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'listPlayerSeasonHistory', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'listPlayerSeasonRewardHistory', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'deletePlayer', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'getWalletLogs', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'getBuildingLogs', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'getFieldLogs', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'getPlayerOrders', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'getRaidOrderDetail', [String]);

function defineRouteParamTypes(target: object, methodName: string, paramTypes: unknown[]): void {
  const defineMetadata = Reflect.defineMetadata as
    | ((metadataKey: string, metadataValue: unknown, target: object, propertyKey: string) => void)
    | undefined;

  defineMetadata?.('design:paramtypes', paramTypes, target, methodName);
}
