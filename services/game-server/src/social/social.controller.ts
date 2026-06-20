import { Body, Controller, Delete, Get, Headers, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type {
  ClientSocialAssistResponse,
  ClientSocialFeedResponse,
  ClientSocialFollowRequest,
  ClientSocialFriendRequest,
  ClientSocialFriendFieldVisitResponse,
  ClientSocialHarvestFieldPreviewResponse,
  ClientSocialHarvestFieldRequest,
  ClientSocialRelationListResponse,
  ClientSocialRelationMutationResponse,
  ClientSocialReviveFieldRequest,
  ClientSocialSummaryResponse,
  ClientTeamChallengeRequest,
  ClientTeamChallengeResponse,
} from '@trinitywar/shared';
import { SocialRelationType } from '@prisma/client';
import { AuthPlaceholderGuard } from '../auth/auth-placeholder.guard.js';
import { CurrentPlayer } from '../auth/current-player.decorator.js';
import type { CurrentPlayerContext } from '../auth/current-player-context.js';
import { createUnauthorizedError } from '../common/errors/index.js';
import { SocialFollowRequestDto, SocialFriendRequestDto, SocialHarvestFieldRequestDto, SocialReviveFieldRequestDto, TeamChallengeRequestDto } from './dto.js';
import { SocialService } from './social.service.js';

@ApiTags('client-social')
@Controller('client/social')
@UseGuards(AuthPlaceholderGuard)
@ApiBearerAuth()
export class SocialController {
  constructor(@Inject(SocialService) private readonly socialService: SocialService) {}

  @Get('summary')
  @ApiOkResponse({ description: 'Client social summary.' })
  async getSummary(@CurrentPlayer() currentPlayer: CurrentPlayerContext | null): Promise<ClientSocialSummaryResponse> {
    return this.socialService.getSummary(this.requirePlayerId(currentPlayer));
  }

  @Get('feed')
  @ApiOkResponse({ description: 'Client social feed.' })
  async getFeed(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Query('page') page?: string,
  ): Promise<ClientSocialFeedResponse> {
    return this.socialService.getFeed(this.requirePlayerId(currentPlayer), Number(page ?? 1));
  }

  @Get('friends')
  @ApiOkResponse({ description: 'Client friend list.' })
  async getFriends(@CurrentPlayer() currentPlayer: CurrentPlayerContext | null): Promise<ClientSocialRelationListResponse> {
    return this.socialService.listRelations(this.requirePlayerId(currentPlayer), SocialRelationType.FRIEND);
  }

  @Get('following')
  @ApiOkResponse({ description: 'Client following list.' })
  async getFollowing(@CurrentPlayer() currentPlayer: CurrentPlayerContext | null): Promise<ClientSocialRelationListResponse> {
    return this.socialService.listRelations(this.requirePlayerId(currentPlayer), SocialRelationType.FOLLOWING);
  }

  @Get('enemies')
  @ApiOkResponse({ description: 'Client enemy list.' })
  async getEnemies(@CurrentPlayer() currentPlayer: CurrentPlayerContext | null): Promise<ClientSocialRelationListResponse> {
    return this.socialService.listRelations(this.requirePlayerId(currentPlayer), SocialRelationType.ENEMY);
  }

  @Post('follow')
  @ApiBody({ type: SocialFollowRequestDto })
  @ApiOkResponse({ description: 'Follow another player.' })
  async follow(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientSocialFollowRequest,
  ): Promise<ClientSocialRelationMutationResponse> {
    return this.socialService.follow(this.requirePlayerId(currentPlayer), body);
  }

  @Delete('following/:targetPlayerId')
  @ApiOkResponse({ description: 'Unfollow another player.' })
  async unfollow(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Param('targetPlayerId') targetPlayerId: string,
  ): Promise<ClientSocialRelationMutationResponse> {
    return this.socialService.unfollow(this.requirePlayerId(currentPlayer), targetPlayerId);
  }

  @Post('friend-request')
  @ApiBody({ type: SocialFriendRequestDto })
  @ApiOkResponse({ description: 'Create or confirm a friend relation.' })
  async requestFriend(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientSocialFriendRequest,
  ): Promise<ClientSocialRelationMutationResponse> {
    return this.socialService.requestFriend(this.requirePlayerId(currentPlayer), body);
  }

  @Post('friend-request/:id/accept')
  @ApiOkResponse({ description: 'Accept a friend request.' })
  async acceptFriendRequest(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Param('id') relationId: string,
  ): Promise<ClientSocialRelationMutationResponse> {
    return this.socialService.acceptFriendRequest(this.requirePlayerId(currentPlayer), relationId);
  }

  @Post('friend-request/:id/reject')
  @ApiOkResponse({ description: 'Reject a friend request.' })
  async rejectFriendRequest(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Param('id') relationId: string,
  ): Promise<ClientSocialRelationMutationResponse> {
    return this.socialService.rejectFriendRequest(this.requirePlayerId(currentPlayer), relationId);
  }

  @Delete('friend/:targetPlayerId')
  @ApiOkResponse({ description: 'Delete a friend relation.' })
  async deleteFriend(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Param('targetPlayerId') targetPlayerId: string,
  ): Promise<ClientSocialRelationMutationResponse> {
    return this.socialService.deleteFriend(this.requirePlayerId(currentPlayer), targetPlayerId);
  }

  @Post('assist/revive-field')
  @ApiBody({ type: SocialReviveFieldRequestDto })
  @ApiOkResponse({ description: 'Record a revive-field assist.' })
  async reviveField(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientSocialReviveFieldRequest,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientSocialAssistResponse> {
    return this.socialService.reviveField(this.requirePlayerId(currentPlayer), {
      ...body,
      requestIdempotencyKey: body.requestIdempotencyKey ?? idempotencyKey,
    });
  }

  @Get('friends/:targetPlayerId/fields')
  @ApiOkResponse({ description: 'Preview a friend field board for social assists.' })
  async visitFriendFields(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Param('targetPlayerId') targetPlayerId: string,
  ): Promise<ClientSocialFriendFieldVisitResponse> {
    return this.socialService.visitFriendFields(this.requirePlayerId(currentPlayer), { targetPlayerId });
  }

  @Get('friends/:targetPlayerId/harvest-preview')
  @ApiOkResponse({ description: 'Preview harvest assist rewards for a friend.' })
  async previewHarvestField(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Param('targetPlayerId') targetPlayerId: string,
  ): Promise<ClientSocialHarvestFieldPreviewResponse> {
    return this.socialService.previewHarvestField(this.requirePlayerId(currentPlayer), { targetPlayerId });
  }

  @Post('assist/harvest-field')
  @ApiBody({ type: SocialHarvestFieldRequestDto })
  @ApiOkResponse({ description: 'Record a friend harvest assist.' })
  async harvestField(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientSocialHarvestFieldRequest,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientSocialAssistResponse> {
    return this.socialService.harvestField(this.requirePlayerId(currentPlayer), {
      ...body,
      requestIdempotencyKey: body.requestIdempotencyKey ?? idempotencyKey,
    });
  }

  @Post('team-challenge')
  @ApiBody({ type: TeamChallengeRequestDto })
  @ApiOkResponse({ description: 'Create a team challenge invitation.' })
  async createTeamChallenge(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientTeamChallengeRequest,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientTeamChallengeResponse> {
    return this.socialService.createTeamChallenge(this.requirePlayerId(currentPlayer), {
      ...body,
      requestIdempotencyKey: body.requestIdempotencyKey ?? idempotencyKey,
    });
  }

  @Post('team-challenge/:id/accept')
  @ApiOkResponse({ description: 'Accept a team challenge invitation.' })
  async acceptTeamChallenge(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Param('id') challengeId: string,
  ): Promise<ClientTeamChallengeResponse> {
    return this.socialService.acceptTeamChallenge(this.requirePlayerId(currentPlayer), challengeId);
  }

  @Post('team-challenge/:id/reject')
  @ApiOkResponse({ description: 'Reject a team challenge invitation.' })
  async rejectTeamChallenge(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Param('id') challengeId: string,
  ): Promise<ClientTeamChallengeResponse> {
    return this.socialService.rejectTeamChallenge(this.requirePlayerId(currentPlayer), challengeId);
  }

  private requirePlayerId(currentPlayer: CurrentPlayerContext | null): string {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return currentPlayer.playerId;
  }
}

defineRouteParamTypes(SocialController.prototype, 'getSummary', [Object]);
defineRouteParamTypes(SocialController.prototype, 'getFeed', [Object, String]);
defineRouteParamTypes(SocialController.prototype, 'getFriends', [Object]);
defineRouteParamTypes(SocialController.prototype, 'getFollowing', [Object]);
defineRouteParamTypes(SocialController.prototype, 'getEnemies', [Object]);
defineRouteParamTypes(SocialController.prototype, 'follow', [Object, Object]);
defineRouteParamTypes(SocialController.prototype, 'unfollow', [Object, String]);
defineRouteParamTypes(SocialController.prototype, 'requestFriend', [Object, Object]);
defineRouteParamTypes(SocialController.prototype, 'acceptFriendRequest', [Object, String]);
defineRouteParamTypes(SocialController.prototype, 'rejectFriendRequest', [Object, String]);
defineRouteParamTypes(SocialController.prototype, 'deleteFriend', [Object, String]);
defineRouteParamTypes(SocialController.prototype, 'reviveField', [Object, Object, String]);
defineRouteParamTypes(SocialController.prototype, 'visitFriendFields', [Object, String]);
defineRouteParamTypes(SocialController.prototype, 'previewHarvestField', [Object, String]);
defineRouteParamTypes(SocialController.prototype, 'harvestField', [Object, Object, String]);
defineRouteParamTypes(SocialController.prototype, 'createTeamChallenge', [Object, Object, String]);
defineRouteParamTypes(SocialController.prototype, 'acceptTeamChallenge', [Object, String]);
defineRouteParamTypes(SocialController.prototype, 'rejectTeamChallenge', [Object, String]);

function defineRouteParamTypes(target: object, methodName: string, paramTypes: unknown[]): void {
  const defineMetadata = Reflect.defineMetadata as
    | ((metadataKey: string, metadataValue: unknown, target: object, propertyKey: string) => void)
    | undefined;

  defineMetadata?.('design:paramtypes', paramTypes, target, methodName);
}
