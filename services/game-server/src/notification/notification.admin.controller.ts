import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AdminCreateNotificationResponse, AdminListResponse, AdminNotificationHistoryItem, AdminPlayerNotificationItem } from '@trinitywar/shared';
import { AdminReadonlyGuard } from '../admin-readonly/admin-readonly.guard.js';
import { NotificationService } from './notification.service.js';

@ApiTags('admin-notifications')
@UseGuards(AdminReadonlyGuard)
@Controller('admin')
export class NotificationAdminController {
  constructor(@Inject(NotificationService) private readonly notificationService: NotificationService) {}

  @Get('notifications')
  @ApiOkResponse({ description: 'List notification history.' })
  listNotificationHistory(@Query() query: Record<string, string | undefined>): Promise<AdminListResponse<AdminNotificationHistoryItem>> {
    return this.notificationService.listNotificationHistory(query);
  }

  @Post('notifications/global')
  @ApiOkResponse({ description: 'Send a global notification to all players.' })
  createGlobalNotification(@Body() body: unknown): Promise<AdminCreateNotificationResponse> {
    return this.notificationService.createGlobalNotification(body);
  }

  @Post('players/:playerId/notifications')
  @ApiOkResponse({ description: 'Send a text notification to a single player.' })
  createPlayerNotification(
    @Param('playerId') playerId: string,
    @Body() body: unknown,
  ): Promise<AdminCreateNotificationResponse> {
    return this.notificationService.createPlayerNotification(playerId, body);
  }

  @Get('players/:playerId/notifications')
  @ApiOkResponse({ description: 'List a player notification history.' })
  listPlayerNotifications(
    @Param('playerId') playerId: string,
    @Query() query: Record<string, string | undefined>,
  ): Promise<AdminListResponse<AdminPlayerNotificationItem>> {
    return this.notificationService.listAdminPlayerNotifications(playerId, query);
  }
}

defineRouteParamTypes(NotificationAdminController.prototype, 'listNotificationHistory', [Object]);
defineRouteParamTypes(NotificationAdminController.prototype, 'createGlobalNotification', [Object]);
defineRouteParamTypes(NotificationAdminController.prototype, 'createPlayerNotification', [String, Object]);
defineRouteParamTypes(NotificationAdminController.prototype, 'listPlayerNotifications', [String, Object]);

function defineRouteParamTypes(target: object, methodName: string, paramTypes: unknown[]): void {
  const defineMetadata = Reflect.defineMetadata as
    | ((metadataKey: string, metadataValue: unknown, target: object, propertyKey: string) => void)
    | undefined;

  defineMetadata?.('design:paramtypes', paramTypes, target, methodName);
}