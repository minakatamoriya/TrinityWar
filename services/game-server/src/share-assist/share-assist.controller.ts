import { Body, Controller, Get, Headers, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type {
  ClientCompleteShareInviteTutorialRequest,
  ClientCompleteShareInviteTutorialResponse,
  ClientCreateShareAssistCampaignRequest,
  ClientCreateShareAssistCampaignResponse,
  PublicShareAssistCampaignResponse,
  PublicShareAssistConfirmRequest,
  PublicShareAssistConfirmResponse,
} from '@trinitywar/shared';
import { AuthPlaceholderGuard } from '../auth/auth-placeholder.guard.js';
import { CurrentPlayer } from '../auth/current-player.decorator.js';
import type { CurrentPlayerContext } from '../auth/current-player-context.js';
import { createUnauthorizedError } from '../common/errors/index.js';
import { CompleteShareInviteTutorialDto, CreateShareAssistCampaignDto, PublicShareAssistConfirmDto } from './dto.js';
import { ShareAssistService } from './share-assist.service.js';

@ApiTags('share-assist')
@Controller()
export class ShareAssistController {
  constructor(@Inject(ShareAssistService) private readonly shareAssistService: ShareAssistService) {}

  @Post('client/share-assist/campaigns')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: CreateShareAssistCampaignDto })
  @ApiOkResponse({ description: 'Create a share assist campaign.' })
  async createCampaign(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientCreateShareAssistCampaignRequest,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientCreateShareAssistCampaignResponse> {
    return this.shareAssistService.createCampaign(this.requirePlayerId(currentPlayer), {
      ...body,
      requestIdempotencyKey: body.requestIdempotencyKey ?? idempotencyKey,
    });
  }

  @Post('client/share-assist/invite-tutorial-complete')
  @UseGuards(AuthPlaceholderGuard)
  @ApiBearerAuth()
  @ApiBody({ type: CompleteShareInviteTutorialDto })
  @ApiOkResponse({ description: 'Bind pending share invite after tutorial completion and grant reward notification.' })
  async completeInviteTutorial(
    @CurrentPlayer() currentPlayer: CurrentPlayerContext | null,
    @Body() body: ClientCompleteShareInviteTutorialRequest,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<ClientCompleteShareInviteTutorialResponse> {
    return this.shareAssistService.completeInviteTutorial(this.requirePlayerId(currentPlayer), {
      ...body,
      requestIdempotencyKey: body.requestIdempotencyKey ?? idempotencyKey,
    });
  }

  @Get('public/share-assist/campaigns/:id')
  @ApiOkResponse({ description: 'Read a public share assist campaign.' })
  async getPublicCampaign(@Param('id') campaignId: string): Promise<PublicShareAssistCampaignResponse> {
    return this.shareAssistService.getPublicCampaign(campaignId);
  }

  @Post('public/share-assist/campaigns/:id/assist')
  @ApiBody({ type: PublicShareAssistConfirmDto })
  @ApiOkResponse({ description: 'Confirm a public share assist.' })
  async confirmAssist(
    @Param('id') campaignId: string,
    @Body() body: PublicShareAssistConfirmRequest,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<PublicShareAssistConfirmResponse> {
    return this.shareAssistService.confirmAssist(campaignId, {
      ...body,
      requestIdempotencyKey: body.requestIdempotencyKey ?? idempotencyKey,
    });
  }

  private requirePlayerId(currentPlayer: CurrentPlayerContext | null): string {
    if (!currentPlayer) {
      throw createUnauthorizedError('Current player context is required.');
    }

    return currentPlayer.playerId;
  }
}

defineRouteParamTypes(ShareAssistController.prototype, 'createCampaign', [Object, Object, String]);
defineRouteParamTypes(ShareAssistController.prototype, 'completeInviteTutorial', [Object, Object, String]);
defineRouteParamTypes(ShareAssistController.prototype, 'getPublicCampaign', [String]);
defineRouteParamTypes(ShareAssistController.prototype, 'confirmAssist', [String, Object, String]);

function defineRouteParamTypes(target: object, methodName: string, paramTypes: unknown[]): void {
  const defineMetadata = Reflect.defineMetadata as
    | ((metadataKey: string, metadataValue: unknown, target: object, propertyKey: string) => void)
    | undefined;

  defineMetadata?.('design:paramtypes', paramTypes, target, methodName);
}
