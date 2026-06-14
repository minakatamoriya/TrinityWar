import { Inject, Injectable } from '@nestjs/common';
import {
  NotificationCategory,
  SocialAssistType,
  SocialFeedType,
  SocialRelationStatus,
  SocialRelationType,
  PlayerInviteRelationStatus,
  Prisma,
  type Player,
  ShareAssistCampaignStatus,
  ShareAssistCampaignType,
  ShareAssistRecordAudience,
  ShareAssistRecordStatus,
  type ShareAssistCampaign,
  type ShareAssistRecord,
} from '@prisma/client';
import {
  APP_NAME,
  type ClientCompleteShareInviteTutorialRequest,
  type ClientCompleteShareInviteTutorialResponse,
  type ClientCreateShareAssistCampaignRequest,
  type ClientCreateShareAssistCampaignResponse,
  type ClientShareAssistAudience,
  type ClientShareAssistCampaignView,
  type ClientSocialPlayerSummary,
  type PublicShareAssistCampaignResponse,
  type PublicShareAssistConfirmRequest,
  type PublicShareAssistConfirmResponse,
} from '@trinitywar/shared';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { getLocalDateKey } from '../lib/date-key.js';
import { PrismaService } from '../prisma/prisma.service.js';

const WATER_CAMPAIGN_EXPIRES_MS = 24 * 60 * 60 * 1000;
const FRIEND_INVITE_CAMPAIGN_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_WATER_MAX_ASSIST_COUNT = 3;
const MAX_WATER_MAX_ASSIST_COUNT = 5;
const DAILY_WATER_CAMPAIGN_CREATE_LIMIT = 5;
const DAILY_FRIEND_INVITE_CAMPAIGN_CREATE_LIMIT = 3;
const DAILY_PUBLIC_ASSIST_CONFIRM_LIMIT = 10;
const DAILY_OWNER_WATER_ASSIST_RECEIVE_LIMIT = 10;
const SHARE_ASSIST_REWARD_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;
const OWNER_WATER_ASSIST_REWARD = [{ kind: 'gold' as const, quantity: 20, label: '閲戝竵' }];
const RETURNING_HELPER_WATER_ASSIST_REWARD = [
  { kind: 'gold' as const, quantity: 20, label: '閲戝竵' },
  { kind: 'spiritSoul' as const, quantity: 1, label: '鍏介瓊' },
];
const NEW_HELPER_TUTORIAL_REWARD = [
  { kind: 'gold' as const, quantity: 30, label: '閲戝竵' },
  { kind: 'spiritSoul' as const, quantity: 1, label: '鍏介瓊' },
];

type CampaignWithOwner = ShareAssistCampaign & {
  owner: Pick<Player, 'id' | 'nickname' | 'factionId' | 'castleLevelCache' | 'lastLoginAt'> & {
    faction: { name: string } | null;
  };
};

interface DeliveredWaterEffect {
  applied: boolean;
  shortenedSeconds: number;
  reason: 'delivered' | 'no_active_field' | 'already_complete';
}

@Injectable()
export class ShareAssistService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createCampaign(playerId: string, request: ClientCreateShareAssistCampaignRequest): Promise<ClientCreateShareAssistCampaignResponse> {
    if (request.campaignType !== 'water' && request.campaignType !== 'friend_invite') {
      throw this.invalidRequest('Unsupported share assist campaign type.');
    }

    const isFriendInvite = request.campaignType === 'friend_invite';
    await this.assertCampaignCreateWithinDailyLimit(playerId, isFriendInvite);
    const maxAssistCount = isFriendInvite ? 1 : clampAssistCount(request.maxAssistCount ?? DEFAULT_WATER_MAX_ASSIST_COUNT);
    const campaign = await this.prisma.db.shareAssistCampaign.create({
      data: {
        ownerPlayerId: playerId,
        campaignType: isFriendInvite ? ShareAssistCampaignType.FRIEND_INVITE : ShareAssistCampaignType.WATER,
        targetEntityType: isFriendInvite ? 'player' : 'field_slot',
        targetEntityId: isFriendInvite ? playerId : request.targetEntityId,
        maxAssistCount,
        expiresAt: new Date(Date.now() + (isFriendInvite ? FRIEND_INVITE_CAMPAIGN_EXPIRES_MS : WATER_CAMPAIGN_EXPIRES_MS)),
      },
      include: campaignInclude(),
    });

    if (isFriendInvite) {
      await this.prisma.db.playerInviteRelation.create({
        data: {
          inviterPlayerId: playerId,
          sourceCampaignId: campaign.id,
          status: PlayerInviteRelationStatus.PENDING_BIND,
        },
      });
    }

    return {
      app: APP_NAME,
      summary: isFriendInvite ? 'Friend invite link created.' : 'Water assist link created.',
      campaign: this.mapCampaign(campaign),
      sharePath: isFriendInvite ? `/share/friend/${campaign.id}` : `/share/water/${campaign.id}`,
    };
  }

  async getPublicCampaign(campaignId: string): Promise<PublicShareAssistCampaignResponse> {
    const campaign = await this.getCampaignOrThrow(campaignId);
    const campaignView = this.mapCampaign(withRuntimeStatus(campaign));

    return {
      app: APP_NAME,
      campaign: campaignView,
      copy: campaign.campaignType === ShareAssistCampaignType.FRIEND_INVITE
        ? {
          title: `${campaign.owner.nickname} invited you to be friends`,
          description: 'This link can only be accepted once. After acceptance, both players become friends and receive rewards.',
          actionLabel: 'Accept invite',
        }
        : {
          title: `${campaign.owner.nickname} invited you to assist`,
          description: 'Send an assist to your friend. Assist rewards are delivered after completion.',
          actionLabel: 'Send assist',
        },
    };
  }

  async completeInviteTutorial(
    playerId: string,
    request: ClientCompleteShareInviteTutorialRequest,
  ): Promise<ClientCompleteShareInviteTutorialResponse> {
    const filters: Prisma.PlayerInviteRelationWhereInput[] = [];
    if (request.campaignId) {
      filters.push({ sourceCampaignId: request.campaignId });
    }
    if (request.helperOpenidHash) {
      filters.push({ invitedOpenidHash: request.helperOpenidHash });
    }
    if (request.helperDeviceHash) {
      filters.push({ invitedOpenidHash: request.helperDeviceHash });
    }

    if (filters.length <= 0) {
      throw this.invalidRequest('Invite completion requires campaignId, helperOpenidHash or helperDeviceHash.');
    }

    const result = await this.prisma.transaction(async (client) => {
      const relation = await client.playerInviteRelation.findFirst({
        where: {
          OR: filters,
          status: { in: [PlayerInviteRelationStatus.PENDING_BIND, PlayerInviteRelationStatus.BOUND, PlayerInviteRelationStatus.TUTORIAL_COMPLETED] },
        },
        include: {
          campaign: { include: campaignInclude() },
          inviter: { select: { id: true, nickname: true, factionId: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!relation) {
        return { bound: false, rewarded: false, notificationId: null };
      }

      if (relation.invitedPlayerId && relation.invitedPlayerId !== playerId) {
        throw this.invalidRequest('This invite relation is already bound to another player.');
      }

      if (relation.rewardedAt) {
        return { bound: true, rewarded: false, notificationId: null };
      }

      const now = new Date();
      const invitedPlayer = await client.player.findUnique({
        where: { id: playerId },
        select: { id: true, nickname: true, factionId: true },
      });
      if (!invitedPlayer) {
        throw new BusinessError({ code: ErrorCode.NotFound, message: 'Player not found.', statusCode: 404 });
      }
      const isFriendInvite = relation.campaign?.campaignType === ShareAssistCampaignType.FRIEND_INVITE;
      const canBindFriend = isFriendInvite;
      await client.playerInviteRelation.update({
        where: { id: relation.id },
        data: {
          invitedPlayerId: playerId,
          status: PlayerInviteRelationStatus.REWARDED,
          boundAt: relation.boundAt ?? now,
          rewardedAt: now,
        },
      });

      if (relation.invitedOpenidHash) {
        await client.shareAssistRecord.updateMany({
          where: {
            campaignId: relation.sourceCampaignId ?? undefined,
            helperAudience: ShareAssistRecordAudience.GUEST,
            OR: [
              { helperOpenidHash: relation.invitedOpenidHash },
              { helperDeviceHash: relation.invitedOpenidHash },
            ],
          },
          data: {
            helperPlayerId: playerId,
            status: ShareAssistRecordStatus.REWARDED,
            boundAt: now,
            rewardClaimedAt: now,
          },
        });
      }

      if (canBindFriend) {
        await upsertFriendPair(client, {
          firstPlayerId: relation.inviterPlayerId,
          secondPlayerId: playerId,
          sourceType: 'friend-invite',
          now,
        });
      }

      if (isFriendInvite && relation.sourceCampaignId) {
        await client.shareAssistCampaign.update({
          where: { id: relation.sourceCampaignId },
          data: {
            currentAssistCount: Math.max(relation.campaign?.currentAssistCount ?? 0, 1),
            status: ShareAssistCampaignStatus.FULL,
          },
        });
      }

      const notificationId = await createRewardNotification(client, {
        playerId,
        title: isFriendInvite ? 'Friend reward' : 'Assist reward',
        body: canBindFriend
          ? `You and ${relation.inviter.nickname} are now friends. The new friend reward is ready.`
          : 'Tutorial assist reward has been delivered. Please claim it in notifications.',
        attachments: NEW_HELPER_TUTORIAL_REWARD,
      });

      if (isFriendInvite) {
        await createRewardNotification(client, {
          playerId: relation.inviterPlayerId,
          title: 'Invite reward',
          body: `${invitedPlayer.nickname} accepted your invite and became your friend. The invite reward is ready.`,
          attachments: OWNER_WATER_ASSIST_REWARD,
        });
      }

      await client.playerSocialFeed.create({
        data: {
          playerId,
          actorPlayerId: relation.inviterPlayerId,
          feedType: canBindFriend ? SocialFeedType.FRIEND_ACCEPTED : SocialFeedType.FRIEND_WATERED_FIELD,
          relatedEntityType: 'share_assist_campaign',
          relatedEntityId: relation.sourceCampaignId,
          summary: canBindFriend ? `You and ${relation.inviter.nickname} are now friends.` : 'Assist completed.',
          metadataJson: {
            shareAssistCampaignId: relation.sourceCampaignId,
            inviteRelationId: relation.id,
            reward: isFriendInvite ? 'friend_invite' : 'new_helper_tutorial',
          },
        },
      });

      if (isFriendInvite) {
        await client.playerSocialFeed.create({
          data: {
          playerId: relation.inviterPlayerId,
          actorPlayerId: playerId,
          feedType: SocialFeedType.FRIEND_ACCEPTED,
          relatedEntityType: 'share_assist_campaign',
          relatedEntityId: relation.sourceCampaignId,
          summary: `${invitedPlayer.nickname} accepted your invite and became your friend.`,
          metadataJson: {
            shareAssistCampaignId: relation.sourceCampaignId,
            inviteRelationId: relation.id,
            reward: 'friend_invite_owner',
            },
          },
        });
      }

      return { bound: true, rewarded: true, notificationId };
    });

    return {
      app: APP_NAME,
      summary: result.rewarded ? 'Reward delivered.' : result.bound ? 'Invite linked, no duplicate reward.' : 'No pending invite found.',
      bound: result.bound,
      rewarded: result.rewarded,
      notificationId: result.notificationId,
    };
  }

  async confirmAssist(campaignId: string, request: PublicShareAssistConfirmRequest): Promise<PublicShareAssistConfirmResponse> {
    const audience = request.audience;
    if (audience !== 'new-user' && audience !== 'returning-user') {
      throw this.invalidRequest('Invalid share assist audience.');
    }

    if (audience === 'returning-user' && !request.helperPlayerId) {
      throw this.invalidRequest('Returning user assist requires helperPlayerId.');
    }

    if (audience === 'new-user' && !request.helperOpenidHash && !request.helperDeviceHash) {
      throw this.invalidRequest('New user assist requires helperOpenidHash or helperDeviceHash.');
    }

    const result = await this.prisma.transaction(async (client) => {
      const campaign = await client.shareAssistCampaign.findUnique({
        where: { id: campaignId },
        include: campaignInclude(),
      });

      if (!campaign) {
        throw new BusinessError({ code: ErrorCode.NotFound, message: 'Share assist campaign not found.', statusCode: 404 });
      }

      const runtimeCampaign = withRuntimeStatus(campaign);
      if (runtimeCampaign.status === ShareAssistCampaignStatus.EXPIRED) {
        await client.shareAssistCampaign.update({
          where: { id: campaign.id },
          data: { status: ShareAssistCampaignStatus.EXPIRED },
        });
        return {
          campaign: runtimeCampaign,
          record: null,
          socialAssist: null,
          deliveredEffect: noDeliveredEffect('already_complete'),
          invitePending: false,
          nextAction: 'expired' as const,
        };
      }

      if (runtimeCampaign.status !== ShareAssistCampaignStatus.ACTIVE) {
        return {
          campaign: runtimeCampaign,
          record: null,
          socialAssist: null,
          deliveredEffect: noDeliveredEffect('already_complete'),
          invitePending: false,
          nextAction: runtimeCampaign.status === ShareAssistCampaignStatus.FULL ? 'full' as const : 'expired' as const,
        };
      }

      if (runtimeCampaign.currentAssistCount >= runtimeCampaign.maxAssistCount) {
        const fullCampaign = await client.shareAssistCampaign.update({
          where: { id: campaign.id },
          data: { status: ShareAssistCampaignStatus.FULL },
          include: campaignInclude(),
        });
        return {
          campaign: fullCampaign,
          record: null,
          socialAssist: null,
          deliveredEffect: noDeliveredEffect('already_complete'),
          invitePending: false,
          nextAction: 'full' as const,
        };
      }

      const existingRecord = await findExistingRecord(client, campaign.id, request);
      if (existingRecord) {
        if (
          campaign.campaignType === ShareAssistCampaignType.FRIEND_INVITE
          && audience === 'returning-user'
          && request.helperPlayerId
          && existingRecord.status === ShareAssistRecordStatus.CONFIRMED
        ) {
          const returningFriendInvite = await this.completeReturningFriendInvite(client, {
            campaign,
            record: existingRecord,
            helperPlayerId: request.helperPlayerId,
          });

          return {
            campaign: returningFriendInvite.campaign,
            record: returningFriendInvite.record,
            socialAssist: null,
            deliveredEffect: noDeliveredEffect('already_complete'),
            invitePending: false,
            nextAction: 'enter_game' as const,
          };
        }

        return {
          campaign: runtimeCampaign,
          record: existingRecord,
          socialAssist: null,
          deliveredEffect: noDeliveredEffect('already_complete'),
          invitePending: audience === 'new-user',
          nextAction: 'already_assisted' as const,
        };
      }

      if (campaign.campaignType === ShareAssistCampaignType.FRIEND_INVITE) {
        await this.assertPublicAssistConfirmWithinDailyLimit(client, campaign, request);
        const record = await client.shareAssistRecord.create({
          data: {
            campaignId: campaign.id,
            helperPlayerId: audience === 'returning-user' ? request.helperPlayerId : undefined,
            helperOpenidHash: request.helperOpenidHash,
            helperDeviceHash: request.helperDeviceHash,
            helperAudience: mapAudienceToDb(audience),
            status: ShareAssistRecordStatus.CONFIRMED,
          },
        });

        if (audience === 'returning-user' && request.helperPlayerId) {
          const returningFriendInvite = await this.completeReturningFriendInvite(client, {
            campaign,
            record,
            helperPlayerId: request.helperPlayerId,
          });

          return {
            campaign: returningFriendInvite.campaign,
            record: returningFriendInvite.record,
            socialAssist: null,
            deliveredEffect: noDeliveredEffect('already_complete'),
            invitePending: false,
            nextAction: 'enter_game' as const,
          };
        }

        if (audience === 'new-user') {
          await upsertPendingInviteRelation(client, {
            campaignId: campaign.id,
            inviterPlayerId: campaign.ownerPlayerId,
            invitedOpenidHash: request.helperOpenidHash ?? request.helperDeviceHash ?? null,
          });
        }

        const updatedCampaign = audience === 'new-user'
          ? await client.shareAssistCampaign.update({
            where: { id: campaign.id },
            data: {
              currentAssistCount: { increment: 1 },
              status: campaign.currentAssistCount + 1 >= campaign.maxAssistCount ? ShareAssistCampaignStatus.FULL : ShareAssistCampaignStatus.ACTIVE,
            },
            include: campaignInclude(),
          })
          : campaign;

        return {
          campaign: updatedCampaign,
          record,
          socialAssist: null,
          deliveredEffect: noDeliveredEffect('already_complete'),
          invitePending: audience === 'new-user',
          nextAction: audience === 'new-user' ? 'start_tutorial' as const : 'enter_game' as const,
        };
      }

      await this.assertPublicAssistConfirmWithinDailyLimit(client, campaign, request);
      const deliveredEffect = await this.deliverWaterAssist(client, {
        campaign,
        helperPlayerId: audience === 'returning-user' ? request.helperPlayerId ?? null : null,
      });

      const record = await client.shareAssistRecord.create({
        data: {
          campaignId: campaign.id,
          helperPlayerId: audience === 'returning-user' ? request.helperPlayerId : undefined,
          helperOpenidHash: request.helperOpenidHash,
          helperDeviceHash: request.helperDeviceHash,
          helperAudience: mapAudienceToDb(audience),
          status: ShareAssistRecordStatus.CONFIRMED,
          assistRecordId: deliveredEffect.assistRecordId,
        },
      });

      if (audience === 'new-user') {
        await client.playerInviteRelation.create({
          data: {
            inviterPlayerId: campaign.ownerPlayerId,
            invitedOpenidHash: request.helperOpenidHash ?? request.helperDeviceHash ?? null,
            sourceCampaignId: campaign.id,
            status: PlayerInviteRelationStatus.PENDING_BIND,
          },
        }).catch((error: unknown) => {
          if (isKnownUniqueError(error)) {
            return null;
          }
          throw error;
        });
      }

      const updatedCampaign = await client.shareAssistCampaign.update({
        where: { id: campaign.id },
        data: {
          currentAssistCount: { increment: 1 },
          status: campaign.currentAssistCount + 1 >= campaign.maxAssistCount ? ShareAssistCampaignStatus.FULL : ShareAssistCampaignStatus.ACTIVE,
        },
        include: campaignInclude(),
      });

      return {
        campaign: updatedCampaign,
        record,
        socialAssist: null,
        deliveredEffect,
        invitePending: audience === 'new-user',
        nextAction: audience === 'new-user' ? 'start_tutorial' as const : 'enter_game' as const,
      };
    });

    return {
      app: APP_NAME,
      summary: buildSummary(request.audience, result.nextAction, result.campaign.campaignType),
      campaign: this.mapCampaign(result.campaign),
      record: result.record
        ? {
          id: result.record.id,
          audience: mapAudienceFromDb(result.record.helperAudience),
          status: mapRecordStatus(result.record.status),
          helperPlayerId: result.record.helperPlayerId,
          createdAt: result.record.createdAt.toISOString(),
        }
        : {
          id: '',
          audience,
          status: 'rejected',
          helperPlayerId: request.helperPlayerId ?? null,
          createdAt: new Date().toISOString(),
        },
      socialAssist: undefined,
      deliveredEffect: {
        applied: result.deliveredEffect.applied,
        shortenedSeconds: result.deliveredEffect.shortenedSeconds,
        reason: result.deliveredEffect.reason,
      },
      invitePending: result.invitePending,
      nextAction: result.nextAction,
    };
  }

  private async getCampaignOrThrow(campaignId: string): Promise<CampaignWithOwner> {
    const campaign = await this.prisma.db.shareAssistCampaign.findUnique({
      where: { id: campaignId },
      include: campaignInclude(),
    });

    if (!campaign) {
      throw new BusinessError({ code: ErrorCode.NotFound, message: 'Share assist campaign not found.', statusCode: 404 });
    }

    return campaign;
  }

  private mapCampaign(campaign: CampaignWithOwner): ClientShareAssistCampaignView {
    const status = withRuntimeStatus(campaign).status;
    return {
      id: campaign.id,
      campaignType: mapCampaignType(campaign.campaignType),
      status: mapCampaignStatus(status),
      owner: mapPlayerSummary(campaign.owner),
      targetEntityType: campaign.targetEntityType,
      targetEntityId: campaign.targetEntityId,
      maxAssistCount: campaign.maxAssistCount,
      currentAssistCount: campaign.currentAssistCount,
      remainingAssistCount: Math.max(campaign.maxAssistCount - campaign.currentAssistCount, 0),
      expiresAt: campaign.expiresAt.toISOString(),
      createdAt: campaign.createdAt.toISOString(),
    };
  }

  private invalidRequest(message: string): BusinessError {
    return new BusinessError({ code: ErrorCode.BadRequest, message, statusCode: 400 });
  }

  private async assertCampaignCreateWithinDailyLimit(playerId: string, isFriendInvite: boolean): Promise<void> {
    const dateRange = getCurrentLocalDayRange();
    const campaignType = isFriendInvite ? ShareAssistCampaignType.FRIEND_INVITE : ShareAssistCampaignType.WATER;
    const limit = isFriendInvite ? DAILY_FRIEND_INVITE_CAMPAIGN_CREATE_LIMIT : DAILY_WATER_CAMPAIGN_CREATE_LIMIT;
    const createdToday = await this.prisma.db.shareAssistCampaign.count({
      where: {
        ownerPlayerId: playerId,
        campaignType,
        createdAt: {
          gte: dateRange.start,
          lt: dateRange.end,
        },
      },
    });

    if (createdToday >= limit) {
      throw this.invalidRequest(isFriendInvite
        ? 'Daily friend invite share limit reached.'
        : 'Daily water assist share limit reached.');
    }
  }

  private async assertPublicAssistConfirmWithinDailyLimit(
    client: Prisma.TransactionClient,
    campaign: CampaignWithOwner,
    request: PublicShareAssistConfirmRequest,
  ): Promise<void> {
    if (
      campaign.campaignType === ShareAssistCampaignType.WATER
      && request.audience === 'returning-user'
      && request.helperPlayerId === campaign.ownerPlayerId
    ) {
      throw this.invalidRequest('Cannot assist your own water share.');
    }

    const dateRange = getCurrentLocalDayRange();
    const helperFilters = buildShareAssistHelperFilters(request);
    if (helperFilters.length > 0) {
      const confirmedToday = await client.shareAssistRecord.count({
        where: {
          OR: helperFilters,
          createdAt: {
            gte: dateRange.start,
            lt: dateRange.end,
          },
        },
      });

      if (confirmedToday >= DAILY_PUBLIC_ASSIST_CONFIRM_LIMIT) {
        throw this.invalidRequest('Daily public assist limit reached.');
      }
    }

    if (campaign.campaignType === ShareAssistCampaignType.WATER) {
      const ownerReceivedToday = await client.shareAssistRecord.count({
        where: {
          campaign: {
            ownerPlayerId: campaign.ownerPlayerId,
            campaignType: ShareAssistCampaignType.WATER,
          },
          createdAt: {
            gte: dateRange.start,
            lt: dateRange.end,
          },
        },
      });

      if (ownerReceivedToday >= DAILY_OWNER_WATER_ASSIST_RECEIVE_LIMIT) {
        throw this.invalidRequest('Daily received water assist limit reached.');
      }
    }
  }

  private async completeReturningFriendInvite(
    client: Prisma.TransactionClient,
    input: { campaign: CampaignWithOwner; record: ShareAssistRecord; helperPlayerId: string },
  ): Promise<{ campaign: CampaignWithOwner; record: ShareAssistRecord }> {
    if (input.helperPlayerId === input.campaign.ownerPlayerId) {
      throw this.invalidRequest('Cannot accept your own friend invite.');
    }

    const now = new Date();
    const helper = await client.player.findUnique({
      where: { id: input.helperPlayerId },
      select: { id: true, nickname: true },
    });

    if (!helper) {
      throw new BusinessError({ code: ErrorCode.NotFound, message: 'Helper player not found.', statusCode: 404 });
    }

    await upsertFriendPair(client, {
      firstPlayerId: input.campaign.ownerPlayerId,
      secondPlayerId: input.helperPlayerId,
      sourceType: 'friend-invite',
      now,
    });

    await client.playerInviteRelation.updateMany({
      where: {
        inviterPlayerId: input.campaign.ownerPlayerId,
        sourceCampaignId: input.campaign.id,
        status: PlayerInviteRelationStatus.PENDING_BIND,
      },
      data: {
        invitedPlayerId: input.helperPlayerId,
        status: PlayerInviteRelationStatus.REWARDED,
        boundAt: now,
        rewardedAt: now,
      },
    });

    const record = await client.shareAssistRecord.update({
      where: { id: input.record.id },
      data: {
        helperPlayerId: input.helperPlayerId,
        status: ShareAssistRecordStatus.REWARDED,
        boundAt: input.record.boundAt ?? now,
        rewardClaimedAt: input.record.rewardClaimedAt ?? now,
      },
    });

    const campaign = await client.shareAssistCampaign.update({
      where: { id: input.campaign.id },
      data: {
        currentAssistCount: Math.max(input.campaign.currentAssistCount, 1),
        status: ShareAssistCampaignStatus.FULL,
      },
      include: campaignInclude(),
    });

    await createRewardNotification(client, {
      playerId: input.helperPlayerId,
      title: 'Friend invite reward',
      body: `You and ${input.campaign.owner.nickname} are now friends. The reward is ready.`,
      attachments: RETURNING_HELPER_WATER_ASSIST_REWARD,
    });

    await createRewardNotification(client, {
      playerId: input.campaign.ownerPlayerId,
      title: 'Invite reward',
      body: `${helper.nickname} accepted your invite and became your friend. The invite reward is ready.`,
      attachments: OWNER_WATER_ASSIST_REWARD,
    });

    await Promise.all([
      client.playerSocialFeed.create({
        data: {
          playerId: input.helperPlayerId,
          actorPlayerId: input.campaign.ownerPlayerId,
          feedType: SocialFeedType.FRIEND_ACCEPTED,
          relatedEntityType: 'share_assist_campaign',
          relatedEntityId: input.campaign.id,
          summary: `You and ${input.campaign.owner.nickname} are now friends.`,
          metadataJson: {
            shareAssistCampaignId: input.campaign.id,
            reward: 'returning_friend_invite',
          },
        },
      }),
      client.playerSocialFeed.create({
        data: {
          playerId: input.campaign.ownerPlayerId,
          actorPlayerId: input.helperPlayerId,
          feedType: SocialFeedType.FRIEND_ACCEPTED,
          relatedEntityType: 'share_assist_campaign',
          relatedEntityId: input.campaign.id,
          summary: `${helper.nickname} accepted your invite and became your friend.`,
          metadataJson: {
            shareAssistCampaignId: input.campaign.id,
            reward: 'friend_invite_owner',
          },
        },
      }),
    ]);

    return { campaign, record };
  }

  private async deliverWaterAssist(
    client: Prisma.TransactionClient,
    input: { campaign: CampaignWithOwner; helperPlayerId: string | null },
  ): Promise<DeliveredWaterEffect & { assistRecordId: string | null }> {
    const assistRecord = await client.playerAssistRecord.create({
      data: {
        helperPlayerId: input.helperPlayerId ?? input.campaign.ownerPlayerId,
        targetPlayerId: input.campaign.ownerPlayerId,
        assistType: SocialAssistType.WATER_FIELD,
        targetEntityType: input.campaign.targetEntityType,
        targetEntityId: input.campaign.targetEntityId,
        effectValue: 0,
        dateKey: getLocalDateKey(),
      },
    });

    await client.playerSocialFeed.create({
      data: {
        playerId: input.campaign.ownerPlayerId,
        actorPlayerId: input.helperPlayerId,
        feedType: SocialFeedType.FRIEND_WATERED_FIELD,
        relatedEntityType: 'share_assist_campaign',
        relatedEntityId: input.campaign.id,
        summary: 'Friend assist sent. Reward delivered.',
        metadataJson: {
          shareAssistCampaignId: input.campaign.id,
          effectSeconds: 0,
          deliveredReason: 'delivered',
        },
      },
    });

    await createRewardNotification(client, {
      playerId: input.campaign.ownerPlayerId,
      title: 'Assist delivered',
      body: 'Your friend assist has been sent. Please claim the reward in notifications.',
      attachments: OWNER_WATER_ASSIST_REWARD,
    });

    if (input.helperPlayerId && input.helperPlayerId !== input.campaign.ownerPlayerId) {
      await client.playerSocialFeed.create({
        data: {
          playerId: input.helperPlayerId,
          actorPlayerId: input.campaign.ownerPlayerId,
          feedType: SocialFeedType.FRIEND_WATERED_FIELD,
          relatedEntityType: 'share_assist_campaign',
          relatedEntityId: input.campaign.id,
          summary: 'You sent a friend assist. Reward delivered.',
          metadataJson: {
            shareAssistCampaignId: input.campaign.id,
            effectSeconds: 0,
            deliveredReason: 'delivered',
          },
        },
      });

      await createRewardNotification(client, {
        playerId: input.helperPlayerId,
        title: 'Assist reward',
        body: 'You completed one friend assist. The reward is ready in notifications.',
        attachments: RETURNING_HELPER_WATER_ASSIST_REWARD,
      });
    }

    return {
      applied: true,
      shortenedSeconds: 0,
      reason: 'delivered',
      assistRecordId: assistRecord.id,
    };
  }
}
function campaignInclude(): {
  owner: {
    select: {
      id: true;
      nickname: true;
      factionId: true;
      castleLevelCache: true;
      lastLoginAt: true;
      faction: { select: { name: true } };
    };
  };
} {
  return {
    owner: {
      select: {
        id: true,
        nickname: true,
        factionId: true,
        castleLevelCache: true,
        lastLoginAt: true,
        faction: { select: { name: true } },
      },
    },
  };
}

async function upsertFriendPair(
  client: Prisma.TransactionClient,
  input: {
    firstPlayerId: string;
    secondPlayerId: string;
    sourceType: string;
    now: Date;
  },
): Promise<void> {
  if (input.firstPlayerId === input.secondPlayerId) {
    return;
  }

  await Promise.all([
    client.playerSocialRelation.upsert({
      where: {
        playerId_targetPlayerId_relationType: {
          playerId: input.firstPlayerId,
          targetPlayerId: input.secondPlayerId,
          relationType: SocialRelationType.FRIEND,
        },
      },
      create: {
        playerId: input.firstPlayerId,
        targetPlayerId: input.secondPlayerId,
        relationType: SocialRelationType.FRIEND,
        status: SocialRelationStatus.ACTIVE,
        sourceType: input.sourceType,
        lastInteractedAt: input.now,
      },
      update: {
        status: SocialRelationStatus.ACTIVE,
        sourceType: input.sourceType,
        lastInteractedAt: input.now,
      },
    }),
    client.playerSocialRelation.upsert({
      where: {
        playerId_targetPlayerId_relationType: {
          playerId: input.secondPlayerId,
          targetPlayerId: input.firstPlayerId,
          relationType: SocialRelationType.FRIEND,
        },
      },
      create: {
        playerId: input.secondPlayerId,
        targetPlayerId: input.firstPlayerId,
        relationType: SocialRelationType.FRIEND,
        status: SocialRelationStatus.ACTIVE,
        sourceType: input.sourceType,
        lastInteractedAt: input.now,
      },
      update: {
        status: SocialRelationStatus.ACTIVE,
        sourceType: input.sourceType,
        lastInteractedAt: input.now,
      },
    }),
  ]);
}

async function upsertPendingInviteRelation(
  client: Prisma.TransactionClient,
  input: {
    campaignId: string;
    inviterPlayerId: string;
    invitedOpenidHash: string | null;
  },
): Promise<void> {
  await client.playerInviteRelation.create({
    data: {
      inviterPlayerId: input.inviterPlayerId,
      invitedOpenidHash: input.invitedOpenidHash,
      sourceCampaignId: input.campaignId,
      status: PlayerInviteRelationStatus.PENDING_BIND,
    },
  }).catch((error: unknown) => {
    if (isKnownUniqueError(error)) {
      return null;
    }
    throw error;
  });
}

function clampAssistCount(value: number): number {
  return Math.min(Math.max(Math.floor(value), 1), MAX_WATER_MAX_ASSIST_COUNT);
}

function withRuntimeStatus<T extends ShareAssistCampaign>(campaign: T): T {
  if (campaign.status === ShareAssistCampaignStatus.ACTIVE && campaign.expiresAt.getTime() <= Date.now()) {
    return { ...campaign, status: ShareAssistCampaignStatus.EXPIRED };
  }

  return campaign;
}

async function findExistingRecord(
  client: Prisma.TransactionClient,
  campaignId: string,
  request: PublicShareAssistConfirmRequest,
): Promise<Awaited<ReturnType<typeof client.shareAssistRecord.findFirst>>> {
  const filters = buildShareAssistHelperFilters(request);

  if (filters.length <= 0) {
    return null;
  }

  return client.shareAssistRecord.findFirst({
    where: {
      campaignId,
      OR: filters,
    },
  });
}

function buildShareAssistHelperFilters(request: PublicShareAssistConfirmRequest): Prisma.ShareAssistRecordWhereInput[] {
  const filters: Prisma.ShareAssistRecordWhereInput[] = [];
  if (request.helperPlayerId) {
    filters.push({ helperPlayerId: request.helperPlayerId });
  }
  if (request.helperOpenidHash) {
    filters.push({ helperOpenidHash: request.helperOpenidHash });
  }
  if (request.helperDeviceHash) {
    filters.push({ helperDeviceHash: request.helperDeviceHash });
  }
  return filters;
}

function getCurrentLocalDayRange(now = new Date()): { start: Date; end: Date } {
  const dateKey = getLocalDateKey(now);
  const start = new Date(`${dateKey}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

async function createRewardNotification(
  client: Prisma.TransactionClient,
  input: {
    playerId: string;
    title: string;
    body: string;
    attachments: Array<{ kind: 'gold' | 'spiritSoul'; quantity: number; label: string }>;
  },
): Promise<string> {
  const expiresAt = new Date(Date.now() + SHARE_ASSIST_REWARD_EXPIRES_MS);
  const systemNotification = await client.systemNotification.create({
    data: {
      audience: 'PLAYER',
      category: NotificationCategory.REWARD,
      title: input.title,
      body: input.body,
      expiresAt,
      createdByAdmin: 'share-assist-system',
    },
  });

  const playerNotification = await client.playerNotification.create({
    data: {
      playerId: input.playerId,
      systemNotificationId: systemNotification.id,
      category: NotificationCategory.REWARD,
      titleSnapshot: input.title,
      bodySnapshot: input.body,
      attachmentJson: toAttachmentJson(input.attachments),
      expiresAt,
      claimStatus: 'UNCLAIMED',
    },
  });

  return playerNotification.id;
}

function toAttachmentJson(attachments: Array<{ kind: 'gold' | 'spiritSoul'; quantity: number; label: string }>): Prisma.InputJsonValue {
  return attachments.map((item) => ({
    kind: item.kind,
    quantity: item.quantity,
    label: item.label,
  })) as Prisma.InputJsonValue;
}

function noDeliveredEffect(reason: DeliveredWaterEffect['reason']): DeliveredWaterEffect {
  return {
    applied: false,
    shortenedSeconds: 0,
    reason,
  };
}

function mapAudienceToDb(audience: ClientShareAssistAudience): ShareAssistRecordAudience {
  return audience === 'new-user' ? ShareAssistRecordAudience.GUEST : ShareAssistRecordAudience.PLAYER;
}

function mapAudienceFromDb(audience: ShareAssistRecordAudience): ClientShareAssistAudience {
  return audience === ShareAssistRecordAudience.GUEST ? 'new-user' : 'returning-user';
}

function mapCampaignType(type: ShareAssistCampaignType): 'water' | 'friend_invite' {
  return type === ShareAssistCampaignType.FRIEND_INVITE ? 'friend_invite' : 'water';
}

function mapCampaignStatus(status: ShareAssistCampaignStatus): ClientShareAssistCampaignView['status'] {
  if (status === ShareAssistCampaignStatus.FULL) {
    return 'full';
  }
  if (status === ShareAssistCampaignStatus.EXPIRED) {
    return 'expired';
  }
  if (status === ShareAssistCampaignStatus.CANCELLED) {
    return 'cancelled';
  }
  return 'active';
}

function mapRecordStatus(status: ShareAssistRecordStatus): PublicShareAssistConfirmResponse['record']['status'] {
  if (status === ShareAssistRecordStatus.BOUND) {
    return 'bound';
  }
  if (status === ShareAssistRecordStatus.REWARDED) {
    return 'rewarded';
  }
  if (status === ShareAssistRecordStatus.REJECTED) {
    return 'rejected';
  }
  return 'confirmed';
}

function mapPlayerSummary(player: CampaignWithOwner['owner']): ClientSocialPlayerSummary {
  return {
    playerId: player.id,
    nickname: player.nickname,
    factionId: player.factionId,
    factionName: player.faction?.name ?? null,
    castleLevel: player.castleLevelCache,
    lastActiveAt: player.lastLoginAt?.toISOString() ?? null,
  };
}

function buildSummary(
  audience: ClientShareAssistAudience,
  nextAction: PublicShareAssistConfirmResponse['nextAction'],
  campaignType: ShareAssistCampaignType,
): string {
  if (nextAction === 'already_assisted') {
    return campaignType === ShareAssistCampaignType.FRIEND_INVITE ? 'Invite already accepted.' : 'Assist already used.';
  }
  if (nextAction === 'expired') {
    return campaignType === ShareAssistCampaignType.FRIEND_INVITE ? 'This invite has expired.' : 'This assist link has expired.';
  }
  if (nextAction === 'full') {
    return campaignType === ShareAssistCampaignType.FRIEND_INVITE ? 'This friend invite is already full.' : 'This assist link has reached its limit.';
  }
  if (campaignType === ShareAssistCampaignType.FRIEND_INVITE) {
    return audience === 'new-user'
      ? 'Invite confirmed. Finish onboarding to bind and claim the friend reward.'
      : 'Friend invite confirmed. Welcome back.';
  }
  return audience === 'new-user'
    ? 'Assist confirmed. Finish onboarding to claim the reward.'
    : 'Assist delivered to your friend.';
}

function isKnownUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

