import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type {
  AdminDeletePlayerResponse,
  AdminListResponse,
  AdminOverviewResponse,
  AdminPlayerOverviewResponse,
  AdminPlayerSearchResponse,
  AdminRaidOrderDetailResponse,
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
  @ApiOkResponse({ description: 'Admin readonly overview.' })
  getOverview(): Promise<AdminOverviewResponse> {
    return this.adminReadonlyService.getOverview();
  }

  @Get('system/status')
  @ApiOkResponse({ description: 'Admin system status.' })
  getSystemStatus(): Promise<AdminSystemStatusResponse> {
    return this.adminReadonlyService.getSystemStatus();
  }

  @Get('config/seeds')
  @ApiOkResponse({ description: 'List seed definitions.' })
  listSeedDefinitions(@Query() query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.listSeedDefinitions(query);
  }

  @Post('config/seeds')
  @ApiOkResponse({ description: 'Create seed definition.' })
  createSeedDefinition(@Body() body: unknown): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.createSeedDefinition(body);
  }

  @Patch('config/seeds/:seedId')
  @ApiOkResponse({ description: 'Update seed definition.' })
  updateSeedDefinition(@Param('seedId') seedId: string, @Body() body: unknown): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.updateSeedDefinition(seedId, body);
  }

  @Delete('config/seeds/:seedId')
  @ApiOkResponse({ description: 'Delete seed definition.' })
  deleteSeedDefinition(@Param('seedId') seedId: string): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.deleteSeedDefinition(seedId);
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
  deleteSpiritDefinition(@Param('spiritId') spiritId: string): Promise<Record<string, unknown>> {
    return this.adminReadonlyService.deleteSpiritDefinition(spiritId);
  }

  @Get('config/castle-levels')
  @ApiOkResponse({ description: 'List readonly castle level configs.' })
  listCastleLevels(): Promise<AdminListResponse<Record<string, unknown>>> {
    return this.adminReadonlyService.listCastleLevels();
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

  @Delete('players/:playerId')
  @ApiOkResponse({ description: 'Delete player and cascaded records.' })
  deletePlayer(@Param('playerId') playerId: string): Promise<AdminDeletePlayerResponse> {
    return this.adminReadonlyService.deletePlayer(playerId);
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
defineRouteParamTypes(AdminReadonlyController.prototype, 'listSeedDefinitions', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'createSeedDefinition', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'updateSeedDefinition', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'deleteSeedDefinition', [String]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'listSpiritDefinitions', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'createSpiritDefinition', [Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'updateSpiritDefinition', [String, Object]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'deleteSpiritDefinition', [String]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'listCastleLevels', []);
defineRouteParamTypes(AdminReadonlyController.prototype, 'getPlayerOverview', [String]);
defineRouteParamTypes(AdminReadonlyController.prototype, 'deletePlayer', [String]);
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
