import { Controller, Delete, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type {
  ClientClaimNotificationResponse,
  ClientDeleteNotificationResponse,
  ClientMarkNotificationReadResponse,
  ClientNotificationListResponse,
  ClientUnreadNotificationCountResponse,
} from '@trinitywar/shared';
import { AuthPlaceholderGuard } from '../auth/auth-placeholder.guard.js';
import { CurrentPlayer } from '../auth/current-player.decorator.js';
import type { CurrentPlayerContext } from '../auth/current-player-context.js';
import { createUnauthorizedError } from '../common/errors/index.js';
import { NotificationService } from './notification.service.js';

@ApiTags('client-notifications')
@Controller('client/notifications')
export class NotificationClientController {
  constructor(@Inject(NotificationService) private readonly notificationService: NotificationService) {}

  @Get()
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'List current player notifications.' })
  async listNotifications(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Query() query: Record<string, string | undefined>,
  ): Promise<ClientNotificationListResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.notificationService.listPlayerNotifications(currentPlayer.playerId, query);
  }

  @Get('unread-count')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Get current player unread notification count.' })
  async getUnreadCount(@CurrentPlayer() currentPlayer: CurrentPlayerContext | null): Promise<ClientUnreadNotificationCountResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.notificationService.getUnreadCount(currentPlayer.playerId);
  }

  @Post(':notificationId/read')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Mark notification as read.' })
  async markAsRead(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Param('notificationId') notificationId: string,
  ): Promise<ClientMarkNotificationReadResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.notificationService.markPlayerNotificationAsRead(currentPlayer.playerId, notificationId);
  }

  @Post(':notificationId/claim')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Claim notification attachments.' })
  async claimNotification(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Param('notificationId') notificationId: string,
  ): Promise<ClientClaimNotificationResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.notificationService.claimPlayerNotification(currentPlayer.playerId, notificationId);
  }

  @Delete(':notificationId')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Delete a read notification.' })
  async deleteNotification(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Param('notificationId') notificationId: string,
  ): Promise<ClientDeleteNotificationResponse> {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return this.notificationService.deletePlayerNotification(currentPlayer.playerId, notificationId);
  }
}

defineRouteParamTypes(NotificationClientController.prototype, 'listNotifications', [Object, Object]);
defineRouteParamTypes(NotificationClientController.prototype, 'getUnreadCount', [Object]);
defineRouteParamTypes(NotificationClientController.prototype, 'markAsRead', [Object, String]);
defineRouteParamTypes(NotificationClientController.prototype, 'claimNotification', [Object, String]);
defineRouteParamTypes(NotificationClientController.prototype, 'deleteNotification', [Object, String]);

function defineRouteParamTypes(target: object, methodName: string, paramTypes: unknown[]): void {
  const defineMetadata = Reflect.defineMetadata as
    | ((metadataKey: string, metadataValue: unknown, target: object, propertyKey: string) => void)
    | undefined;

  defineMetadata?.('design:paramtypes', paramTypes, target, methodName);
}