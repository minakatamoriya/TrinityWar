import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type {
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
defineRouteParamTypes(AdminReadonlyController.prototype, 'getPlayerOverview', [String]);
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
