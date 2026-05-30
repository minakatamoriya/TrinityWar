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
import {
  buildFieldReadyAtUpdate,
  getFieldReadyAt,
} from '../lib/field-timing.js';
import { PrismaService } from '../prisma/prisma.service.js';

const WATER_CAMPAIGN_EXPIRES_MS = 24 * 60 * 60 * 1000;
const FRIEND_INVITE_CAMPAIGN_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_WATER_MAX_ASSIST_COUNT = 3;
const MAX_WATER_MAX_ASSIST_COUNT = 5;
const WATER_REMAINING_RATIO = 0.4;
const WATER_MIN_EFFECT_SECONDS = 10 * 60;
const WATER_MAX_EFFECT_SECONDS = 60 * 60;
const SHARE_ASSIST_REWARD_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;
const OWNER_WATER_ASSIST_REWARD = [{ kind: 'gold' as const, quantity: 20, label: '金币' }];
const RETURNING_HELPER_WATER_ASSIST_REWARD = [
  { kind: 'gold' as const, quantity: 20, label: '金币' },
  { kind: 'spiritSoul' as const, quantity: 1, label: '兽魂' },
];
const NEW_HELPER_TUTORIAL_REWARD = [
  { kind: 'gold' as const, quantity: 30, label: '金币' },
  { kind: 'spiritSoul' as const, quantity: 1, label: '兽魂' },
];

type CampaignWithOwner = ShareAssistCampaign & {
  owner: Pick<Player, 'id' | 'nickname' | 'factionId' | 'castleLevelCache' | 'lastLoginAt'> & {
    faction: { name: string } | null;
  };
};

interface DeliveredWaterEffect {
  applied: boolean;
  shortenedSeconds: number;
  reason: 'shortened' | 'no_active_field' | 'already_complete';
  fieldSlotId: string | null;
}

const shareWaterableFieldSelect = {
  id: true,
  status: true,
  seedAt: true,
  matureAt: true,
  readyAt: true,
  lastCalculatedAt: true,
  seedDefinition: {
    select: {
      seedId: true,
    },
  },
} satisfies Prisma.PlayerFieldSlotSelect;

type ShareWaterableField = Prisma.PlayerFieldSlotGetPayload<{ select: typeof shareWaterableFieldSelect }>;

@Injectable()
export class ShareAssistService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createCampaign(playerId: string, request: ClientCreateShareAssistCampaignRequest): Promise<ClientCreateShareAssistCampaignResponse> {
    if (request.campaignType !== 'water' && request.campaignType !== 'friend_invite') {
      throw this.invalidRequest('Unsupported share assist campaign type.');
    }

    const isFriendInvite = request.campaignType === 'friend_invite';
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
      summary: isFriendInvite ? '单人好友邀请链接已创建，被接受后即失效。' : '浇水助力链接已创建。',
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
          title: `${campaign.owner.nickname}邀请你成为好友`,
          description: '这是一条单人好友邀请链接，仅第一个确认者生效；接受后双方会成为好友并收到对应奖励。',
          actionLabel: '接受好友邀请',
        }
        : {
          title: `${campaign.owner.nickname}邀请你帮 TA 浇水`,
          description: '帮 TA 浇一次水，助力会送达好友；完成助力后，双方都可以获得轻量奖励。',
          actionLabel: '帮 TA 浇水',
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
        title: isFriendInvite ? '新友奖励' : '新友助力奖励',
        body: canBindFriend
          ? `你已和 ${relation.inviter.nickname} 成为好友，新友奖励已送达。`
          : '你已完成新手流程，微信助力奖励已送达，请在附件中领取。',
        attachments: NEW_HELPER_TUTORIAL_REWARD,
      });

      if (isFriendInvite) {
        await createRewardNotification(client, {
          playerId: relation.inviterPlayerId,
          title: '邀请新友奖励',
          body: `${invitedPlayer.nickname} 已接受邀请并成为你的好友，邀请奖励已送达。`,
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
          summary: canBindFriend ? `你已和 ${relation.inviter.nickname} 成为好友。` : '你已完成微信助力。',
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
            summary: `${invitedPlayer.nickname} 已接受邀请并成为你的好友。`,
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
      summary: result.rewarded ? '新友助力奖励已发送到通知。' : result.bound ? '邀请关系已绑定，无需重复发奖。' : '没有找到待绑定的助力邀请。',
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
      title: '好友邀请奖励',
      body: `你已和 ${input.campaign.owner.nickname} 成为好友，奖励可在附件中领取。`,
      attachments: RETURNING_HELPER_WATER_ASSIST_REWARD,
    });

    await createRewardNotification(client, {
      playerId: input.campaign.ownerPlayerId,
      title: '邀请好友奖励',
      body: `${helper.nickname} 已接受邀请并成为你的好友，邀请奖励已送达。`,
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
          summary: `你已和 ${input.campaign.owner.nickname} 成为好友。`,
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
          summary: `${helper.nickname} 已接受邀请并成为你的好友。`,
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
    const now = new Date();
    const field = input.campaign.targetEntityId
      ? await findShareWaterableFieldById(client, input.campaign.ownerPlayerId, input.campaign.targetEntityId)
      : await findFirstShareWaterableField(client, input.campaign.ownerPlayerId);
    const effect = field ? await applyShareWaterFieldEffect(client, field, now) : noDeliveredEffect('no_active_field');
    const assistRecord = await client.playerAssistRecord.create({
      data: {
        helperPlayerId: input.helperPlayerId ?? input.campaign.ownerPlayerId,
        targetPlayerId: input.campaign.ownerPlayerId,
        assistType: SocialAssistType.WATER_FIELD,
        targetEntityType: 'field_slot',
        targetEntityId: effect.fieldSlotId,
        effectValue: effect.shortenedSeconds,
        dateKey: getLocalDateKey(),
      },
    });

    await client.playerSocialFeed.create({
      data: {
        playerId: input.campaign.ownerPlayerId,
        actorPlayerId: input.helperPlayerId,
        feedType: SocialFeedType.FRIEND_WATERED_FIELD,
        relatedEntityType: 'field_slot',
        relatedEntityId: effect.fieldSlotId,
        summary: effect.applied ? '好友帮你浇水，田地成长已加快。' : '好友的浇水助力已送达。',
        metadataJson: {
          shareAssistCampaignId: input.campaign.id,
          effectSeconds: effect.shortenedSeconds,
          deliveredReason: effect.reason,
        },
      },
    });

    await createRewardNotification(client, {
      playerId: input.campaign.ownerPlayerId,
      title: '浇水助力已送达',
      body: effect.applied ? '好友已为你的灵田浇水，本次助力奖励可在附件中领取。' : '好友已送出浇水助力，本次助力奖励可在附件中领取。',
      attachments: OWNER_WATER_ASSIST_REWARD,
    });

    if (input.helperPlayerId && input.helperPlayerId !== input.campaign.ownerPlayerId) {
      await client.playerSocialFeed.create({
        data: {
          playerId: input.helperPlayerId,
          actorPlayerId: input.campaign.ownerPlayerId,
          feedType: SocialFeedType.FRIEND_WATERED_FIELD,
          relatedEntityType: 'field_slot',
          relatedEntityId: effect.fieldSlotId,
          summary: effect.applied ? '你已帮好友完成浇水，助力奖励已送达。' : '你已帮好友送出浇水助力，奖励已送达。',
          metadataJson: {
            shareAssistCampaignId: input.campaign.id,
            effectSeconds: effect.shortenedSeconds,
            deliveredReason: effect.reason,
          },
        },
      });

      await createRewardNotification(client, {
        playerId: input.helperPlayerId,
        title: '浇水助力奖励',
        body: '你已完成一次好友浇水助力，奖励可在附件中领取。',
        attachments: RETURNING_HELPER_WATER_ASSIST_REWARD,
      });
    }

    return { ...effect, assistRecordId: assistRecord.id };
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

async function findShareWaterableFieldById(
  client: Prisma.TransactionClient,
  targetPlayerId: string,
  fieldSlotId: string,
): Promise<ShareWaterableField | null> {
  return client.playerFieldSlot.findFirst({
    where: {
      id: fieldSlotId,
      playerId: targetPlayerId,
      isUnlocked: true,
      status: 'GROWING',
      seedDefinitionId: { not: null },
    },
    select: shareWaterableFieldSelect,
  });
}

async function findFirstShareWaterableField(client: Prisma.TransactionClient, targetPlayerId: string): Promise<ShareWaterableField | null> {
  return client.playerFieldSlot.findFirst({
    where: {
      playerId: targetPlayerId,
      isUnlocked: true,
      status: 'GROWING',
      seedDefinitionId: { not: null },
    },
    orderBy: [
      { readyAt: 'asc' },
      { matureAt: 'asc' },
      { slotIndex: 'asc' },
    ],
    select: shareWaterableFieldSelect,
  });
}

async function applyShareWaterFieldEffect(client: Prisma.TransactionClient, field: ShareWaterableField, now: Date): Promise<DeliveredWaterEffect> {
  const stageStartedAt = getShareWaterableStageStartedAt(field, now);
  const currentStageEndsAt = getShareWaterableStageEndsAt(field, stageStartedAt);

  if (currentStageEndsAt.getTime() <= now.getTime()) {
    return noDeliveredEffect('already_complete', field.id);
  }

  const remainingSeconds = Math.ceil((currentStageEndsAt.getTime() - now.getTime()) / 1000);
  const shortenedSeconds = Math.min(
    Math.max(Math.floor(remainingSeconds * WATER_REMAINING_RATIO), WATER_MIN_EFFECT_SECONDS),
    WATER_MAX_EFFECT_SECONDS,
    remainingSeconds,
  );
  const afterStageEndsAt = new Date(currentStageEndsAt.getTime() - shortenedSeconds * 1000);

  await client.playerFieldSlot.update({
    where: { id: field.id },
    data: {
      ...buildFieldReadyAtUpdate(afterStageEndsAt),
      lastCalculatedAt: now,
      statusVersion: { increment: 1 },
    },
  });

  return {
    applied: true,
    shortenedSeconds,
    reason: 'shortened',
    fieldSlotId: field.id,
  };
}

function getShareWaterableStageStartedAt(field: ShareWaterableField, now: Date): Date {
  return field.seedAt ?? field.lastCalculatedAt ?? now;
}

function getShareWaterableStageEndsAt(field: ShareWaterableField, stageStartedAt: Date): Date {
  return getFieldReadyAt(field, field.seedDefinition?.seedId ?? '', stageStartedAt);
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

function noDeliveredEffect(reason: DeliveredWaterEffect['reason'], fieldSlotId: string | null = null): DeliveredWaterEffect {
  return {
    applied: false,
    shortenedSeconds: 0,
    reason,
    fieldSlotId,
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
    return campaignType === ShareAssistCampaignType.FRIEND_INVITE ? '你已经确认过这个好友邀请。' : '你已经帮过这个助力链接。';
  }
  if (nextAction === 'expired') {
    return campaignType === ShareAssistCampaignType.FRIEND_INVITE ? '这个好友邀请已过期。' : '这个助力链接已过期。';
  }
  if (nextAction === 'full') {
    return campaignType === ShareAssistCampaignType.FRIEND_INVITE ? '这个单人好友邀请已经被接受。' : '这个助力链接的次数已满。';
  }
  if (campaignType === ShareAssistCampaignType.FRIEND_INVITE) {
    return audience === 'new-user'
      ? '邀请已确认，完成新手流程后可绑定好友并领取新友奖励。这条单人链接随后失效。'
      : '好友邀请已确认，欢迎回归。这条单人链接随后失效。';
  }
  return audience === 'new-user'
    ? '助力成功，完成新手流程后可以领取新友奖励。'
    : '浇水成功，助力已送达好友。';
}

function isKnownUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
