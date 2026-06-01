import { Inject, Injectable } from '@nestjs/common';
import type { FieldStatus, Player, PlayerSocialFeed, PlayerSocialRelation, Prisma, PrismaClient, TeamChallenge } from '@prisma/client';
import { SocialAssistType, SocialFeedType, SocialRelationStatus, SocialRelationType, TeamChallengeStatus } from '@prisma/client';
import {
  APP_NAME,
  type ClientSocialAssistResponse,
  type ClientSocialFeedItem,
  type ClientSocialFeedResponse,
  type ClientSocialFollowRequest,
  type ClientSocialFriendRequest,
  type ClientSocialFriendFieldVisitField,
  type ClientSocialFriendFieldVisitResponse,
  type ClientSocialHarvestFieldPreviewRequest,
  type ClientSocialHarvestFieldPreviewResponse,
  type ClientSocialHarvestFieldRequest,
  type ClientSocialRelationItem,
  type ClientSocialRelationListResponse,
  type ClientSocialRelationMutationResponse,
  type ClientSocialSummaryResponse,
  type ClientSocialWaterFieldRequest,
  type ClientTeamChallengeItem,
  type ClientTeamChallengeRequest,
  type ClientTeamChallengeResponse,
} from '@trinitywar/shared';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { getLocalDateKey } from '../lib/date-key.js';
import {
  buildFieldReadyAtUpdate,
  getFieldReadyAt,
} from '../lib/field-timing.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { grantFactionContribution } from '../faction/contribution.service.js';

const SOCIAL_PAGE_SIZE = 30;
const HARVEST_INTIMACY_GAIN = 2;
const WATER_INTIMACY_GAIN = 2;
const FRIEND_HARVEST_REWARD_GOLD = 10;
const WATER_REMAINING_RATIO = 0.4;
const WATER_MIN_EFFECT_SECONDS = 10 * 60;
const WATER_MAX_EFFECT_SECONDS = 60 * 60;
const TEAM_CHALLENGE_EXPIRES_MS = 2 * 60 * 60 * 1000;
const SOCIAL_CONTRIBUTION_REWARDS = {
  waterField: 1,
  harvestField: 2,
} as const;

type DbClient = Prisma.TransactionClient | PrismaClient;

type PlayerSummaryProjection = Pick<Player, 'id' | 'nickname' | 'castleLevelCache' | 'lastLoginAt'> & {
  factionId: string | null;
  faction: { name: string } | null;
};

type RelationWithTarget = PlayerSocialRelation & {
  targetPlayer: PlayerSummaryProjection;
};

type FeedWithActor = PlayerSocialFeed & {
  actor: PlayerSummaryProjection | null;
};

type TeamChallengeWithPlayers = TeamChallenge & {
  initiator: PlayerSummaryProjection;
  ally: PlayerSummaryProjection;
  target: PlayerSummaryProjection;
};

interface WateredFieldResult {
  fieldSlotId: string;
  status: FieldStatus;
  shortenedSeconds: number;
  beforeStageEndsAt: Date;
  afterStageEndsAt: Date;
  fieldVersion: number;
}

interface HarvestedFieldResult {
  fieldSlotId: string;
  fieldCode: string;
  status: FieldStatus;
  cropName: string;
  cropRarity: string;
  rewardGold: number;
}

const waterableFieldSelect = {
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

type WaterableField = Prisma.PlayerFieldSlotGetPayload<{ select: typeof waterableFieldSelect }>;

const harvestableFieldSelect = {
  id: true,
  slotIndex: true,
  status: true,
  seedAt: true,
  matureAt: true,
  readyAt: true,
  lastCalculatedAt: true,
  currentClaimableGold: true,
  seedDefinition: {
    select: {
      seedId: true,
      label: true,
      rarity: true,
      baseYieldGold: true,
    },
  },
} satisfies Prisma.PlayerFieldSlotSelect;

type HarvestableField = Prisma.PlayerFieldSlotGetPayload<{ select: typeof harvestableFieldSelect }>;

const friendFieldVisitSelect = {
  id: true,
  slotIndex: true,
  isUnlocked: true,
  status: true,
  seedAt: true,
  matureAt: true,
  readyAt: true,
  lastCalculatedAt: true,
  currentClaimableGold: true,
  seedDefinitionId: true,
  seedDefinition: {
    select: {
      seedId: true,
      label: true,
      rarity: true,
      baseYieldGold: true,
    },
  },
} satisfies Prisma.PlayerFieldSlotSelect;

type FriendFieldVisitSlot = Prisma.PlayerFieldSlotGetPayload<{ select: typeof friendFieldVisitSelect }>;

@Injectable()
export class SocialService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getSummary(playerId: string): Promise<ClientSocialSummaryResponse> {
    await this.assertPlayerExists(this.prisma.db, playerId);
    const [counts, quickActions] = await Promise.all([
      this.getCounts(this.prisma.db, playerId),
      this.prisma.db.playerSocialFeed.findMany({
        where: {
          playerId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { actor: this.playerSummaryInclude() },
      }),
    ]);

    return {
      app: APP_NAME,
      counts,
      quickActions: quickActions.map((feed) => this.mapFeed(feed)),
    };
  }

  async getFeed(playerId: string, page = 1): Promise<ClientSocialFeedResponse> {
    await this.assertPlayerExists(this.prisma.db, playerId);
    const safePage = Math.max(Math.floor(page), 1);
    const where: Prisma.PlayerSocialFeedWhereInput = {
      playerId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };
    const [total, feeds] = await Promise.all([
      this.prisma.db.playerSocialFeed.count({ where }),
      this.prisma.db.playerSocialFeed.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * SOCIAL_PAGE_SIZE,
        take: SOCIAL_PAGE_SIZE,
        include: { actor: this.playerSummaryInclude() },
      }),
    ]);

    return {
      app: APP_NAME,
      items: feeds.map((feed) => this.mapFeed(feed)),
      pagination: { page: safePage, pageSize: SOCIAL_PAGE_SIZE, total },
    };
  }

  async listRelations(playerId: string, relationType: SocialRelationType, page = 1): Promise<ClientSocialRelationListResponse> {
    await this.assertPlayerExists(this.prisma.db, playerId);
    const safePage = Math.max(Math.floor(page), 1);
    const where: Prisma.PlayerSocialRelationWhereInput = {
      playerId,
      relationType,
      status: { not: SocialRelationStatus.MUTED },
    };
    const [total, relations] = await Promise.all([
      this.prisma.db.playerSocialRelation.count({ where }),
      this.prisma.db.playerSocialRelation.findMany({
        where,
        orderBy: [{ lastInteractedAt: 'desc' }, { intimacy: 'desc' }, { createdAt: 'desc' }],
        skip: (safePage - 1) * SOCIAL_PAGE_SIZE,
        take: SOCIAL_PAGE_SIZE,
        include: { targetPlayer: this.playerSummaryInclude() },
      }),
    ]);

    const assistSummaryByPlayerId = relationType === SocialRelationType.FRIEND
      ? await this.getAssistSummaries(
        this.prisma.db,
        playerId,
        relations
          .filter((relation) => relation.status === SocialRelationStatus.ACTIVE)
          .map((relation) => relation.targetPlayerId),
      )
      : new Map<string, ClientSocialRelationItem['assistSummary']>();

    return {
      app: APP_NAME,
      items: relations.map((relation) => this.mapRelation(relation, assistSummaryByPlayerId.get(relation.targetPlayerId))),
      pagination: { page: safePage, pageSize: SOCIAL_PAGE_SIZE, total },
    };
  }

  async follow(playerId: string, request: ClientSocialFollowRequest): Promise<ClientSocialRelationMutationResponse> {
    const relation = await this.upsertRelation(playerId, request.targetPlayerId, SocialRelationType.FOLLOWING, 'manual-follow', SocialRelationStatus.ACTIVE);
    return {
      app: APP_NAME,
      summary: `Followed ${relation.target.nickname}.`,
      relation,
    };
  }

  async requestFriend(playerId: string, request: ClientSocialFriendRequest): Promise<ClientSocialRelationMutationResponse> {
    const result = await this.prisma.transaction(async (client) => {
      const player = await this.assertPlayerExists(client, playerId);
      const target = await this.assertPlayerExists(client, request.targetPlayerId);
      if (playerId === request.targetPlayerId) {
        throw this.invalidRequest('Cannot create a social relation to yourself.');
      }
      this.assertSameFactionForFriend(playerId, target.id, player, target);

      const existingRelation = await client.playerSocialRelation.findUnique({
        where: {
          playerId_targetPlayerId_relationType: {
            playerId,
            targetPlayerId: request.targetPlayerId,
            relationType: SocialRelationType.FRIEND,
          },
        },
      });
      const reverseRelation = await client.playerSocialRelation.findUnique({
        where: {
          playerId_targetPlayerId_relationType: {
            playerId: request.targetPlayerId,
            targetPlayerId: playerId,
            relationType: SocialRelationType.FRIEND,
          },
        },
      });
      const shouldActivate =
        existingRelation?.status === SocialRelationStatus.ACTIVE ||
        reverseRelation?.status === SocialRelationStatus.ACTIVE ||
        (existingRelation?.status === SocialRelationStatus.PENDING && existingRelation.sourceType.endsWith(':incoming'));
      const now = new Date();
      const sourceBase = request.sourceType ?? 'manual-friend-request';
      const relation = await this.upsertRelationRecord(client, {
        playerId,
        targetPlayerId: request.targetPlayerId,
        relationType: SocialRelationType.FRIEND,
        sourceType: shouldActivate ? 'friend-accepted' : `${sourceBase}:outgoing`,
        status: shouldActivate ? SocialRelationStatus.ACTIVE : SocialRelationStatus.PENDING,
        now,
      });
      const targetRelation = await this.upsertRelationRecord(client, {
        playerId: request.targetPlayerId,
        targetPlayerId: playerId,
        relationType: SocialRelationType.FRIEND,
        sourceType: shouldActivate ? 'friend-accepted' : `${sourceBase}:incoming`,
        status: shouldActivate ? SocialRelationStatus.ACTIVE : SocialRelationStatus.PENDING,
        now,
      });

      if (shouldActivate) {
        await this.createFriendAcceptedFeeds(client, playerId, request.targetPlayerId);
        await this.expireFriendRequestFeeds(client, playerId, request.targetPlayerId, now);
      } else if (existingRelation?.status !== SocialRelationStatus.PENDING) {
        await client.playerSocialFeed.create({
          data: {
            playerId: request.targetPlayerId,
            actorPlayerId: playerId,
            feedType: SocialFeedType.FRIEND_REQUESTED,
            relatedEntityType: 'player_social_relation',
            relatedEntityId: targetRelation.id,
            summary: '对方请求加你为好友。',
            metadataJson: { relationId: targetRelation.id, requesterPlayerId: playerId },
          },
        });
      }

      return {
        target,
        relation,
        targetRelation,
        active: Boolean(shouldActivate),
      };
    });

    return {
      app: APP_NAME,
      summary: result.active ? `已和 ${result.target.nickname} 成为好友。` : `已向 ${result.target.nickname} 发送好友申请。`,
      relation: this.mapRelation(result.relation),
      reverseRelation: this.mapRelation(result.targetRelation),
    };
  }

  async acceptFriendRequest(playerId: string, relationId: string): Promise<ClientSocialRelationMutationResponse> {
    const result = await this.prisma.transaction(async (client) => {
      const currentPlayer = await this.assertPlayerExists(client, playerId);
      const existing = await this.findPendingIncomingFriendRelation(client, playerId, relationId);
      const target = existing.targetPlayer;
      this.assertSameFactionForFriend(playerId, existing.targetPlayerId, currentPlayer, target);
      const now = new Date();
      const relation = await this.upsertRelationRecord(client, {
        playerId,
        targetPlayerId: existing.targetPlayerId,
        relationType: SocialRelationType.FRIEND,
        sourceType: 'friend-accepted',
        status: SocialRelationStatus.ACTIVE,
        now,
      });
      const reverseRelation = await this.upsertRelationRecord(client, {
        playerId: existing.targetPlayerId,
        targetPlayerId: playerId,
        relationType: SocialRelationType.FRIEND,
        sourceType: 'friend-accepted',
        status: SocialRelationStatus.ACTIVE,
        now,
      });

      await this.createFriendAcceptedFeeds(client, playerId, existing.targetPlayerId);
      await this.expireFriendRequestFeeds(client, playerId, existing.targetPlayerId, now);
      return { target, relation, reverseRelation };
    });

    return {
      app: APP_NAME,
      summary: `已和 ${result.target.nickname} 成为好友。`,
      relation: this.mapRelation(result.relation),
      reverseRelation: this.mapRelation(result.reverseRelation),
    };
  }

  async rejectFriendRequest(playerId: string, relationId: string): Promise<ClientSocialRelationMutationResponse> {
    const result = await this.prisma.transaction(async (client) => {
      const existing = await this.findPendingIncomingFriendRelation(client, playerId, relationId);
      const target = existing.targetPlayer;
      const now = new Date();
      const relation = await this.upsertRelationRecord(client, {
        playerId,
        targetPlayerId: existing.targetPlayerId,
        relationType: SocialRelationType.FRIEND,
        sourceType: 'friend-rejected',
        status: SocialRelationStatus.MUTED,
        now,
      });
      const reverseRelation = await this.upsertRelationRecord(client, {
        playerId: existing.targetPlayerId,
        targetPlayerId: playerId,
        relationType: SocialRelationType.FRIEND,
        sourceType: 'friend-rejected',
        status: SocialRelationStatus.MUTED,
        now,
      });

      await client.playerSocialFeed.create({
        data: {
          playerId: existing.targetPlayerId,
          actorPlayerId: playerId,
          feedType: SocialFeedType.FRIEND_REJECTED,
          relatedEntityType: 'player_social_relation',
          relatedEntityId: reverseRelation.id,
          summary: '对方暂未通过你的好友申请。',
          metadataJson: { relationId: reverseRelation.id },
        },
      });
      await client.playerSocialFeed.create({
        data: {
          playerId,
          actorPlayerId: existing.targetPlayerId,
          feedType: SocialFeedType.FRIEND_REJECTED,
          relatedEntityType: 'player_social_relation',
          relatedEntityId: relation.id,
          summary: '你已拒绝这条好友申请。',
          metadataJson: { relationId: relation.id },
        },
      });
      await this.expireFriendRequestFeeds(client, playerId, existing.targetPlayerId, now);

      return { target, relation, reverseRelation };
    });

    return {
      app: APP_NAME,
      summary: `已拒绝 ${result.target.nickname} 的好友申请。`,
      relation: this.mapRelation(result.relation),
      reverseRelation: this.mapRelation(result.reverseRelation),
    };
  }

  async deleteFriend(playerId: string, targetPlayerId: string): Promise<ClientSocialRelationMutationResponse> {
    if (playerId === targetPlayerId) {
      throw this.invalidRequest('Cannot delete yourself from friend list.');
    }

    const result = await this.prisma.transaction(async (client) => {
      await this.assertPlayerExists(client, playerId);
      const target = await this.assertPlayerExists(client, targetPlayerId);
      const now = new Date();
      const relation = await this.upsertRelationRecord(client, {
        playerId,
        targetPlayerId,
        relationType: SocialRelationType.FRIEND,
        sourceType: 'friend-deleted',
        status: SocialRelationStatus.MUTED,
        now,
      });
      const reverseRelation = await this.upsertRelationRecord(client, {
        playerId: targetPlayerId,
        targetPlayerId: playerId,
        relationType: SocialRelationType.FRIEND,
        sourceType: 'friend-deleted',
        status: SocialRelationStatus.MUTED,
        now,
      });

      await this.expireFriendRequestFeeds(client, playerId, targetPlayerId, now);
      return { target, relation, reverseRelation };
    });

    return {
      app: APP_NAME,
      summary: `已删除 ${result.target.nickname}。`,
      relation: this.mapRelation(result.relation),
      reverseRelation: this.mapRelation(result.reverseRelation),
    };
  }

  async waterField(playerId: string, request: ClientSocialWaterFieldRequest): Promise<ClientSocialAssistResponse> {
    const result = await this.prisma.transaction(async (client) => {
      await this.assertPlayerExists(client, playerId);
      await this.assertPlayerExists(client, request.targetPlayerId);

      if (playerId === request.targetPlayerId) {
        throw this.invalidRequest('Cannot assist your own field.');
      }
      await this.assertActiveFriendRelation(client, playerId, request.targetPlayerId);

      const dateKey = getLocalDateKey();
      const wateredField = await this.applyWaterFieldAssist(client, {
        helperPlayerId: playerId,
        targetPlayerId: request.targetPlayerId,
        fieldSlotId: request.fieldSlotId,
        now: new Date(),
      });

      const assist = await client.playerAssistRecord.create({
        data: {
          helperPlayerId: playerId,
          targetPlayerId: request.targetPlayerId,
          assistType: SocialAssistType.WATER_FIELD,
          targetEntityType: 'field_slot',
          targetEntityId: wateredField.fieldSlotId,
          effectValue: wateredField.shortenedSeconds,
          dateKey,
        },
      });

      await client.playerSocialFeed.create({
        data: {
          playerId: request.targetPlayerId,
          actorPlayerId: playerId,
          feedType: SocialFeedType.FRIEND_WATERED_FIELD,
          relatedEntityType: 'field_slot',
          relatedEntityId: wateredField.fieldSlotId,
          summary: 'A friend watered your field.',
          metadataJson: {
            assistId: assist.id,
            effectSeconds: wateredField.shortenedSeconds,
            beforeStageEndsAt: wateredField.beforeStageEndsAt.toISOString(),
            afterStageEndsAt: wateredField.afterStageEndsAt.toISOString(),
          },
        },
      });

      await this.bumpInteraction(client, playerId, request.targetPlayerId, WATER_INTIMACY_GAIN);
      await grantFactionContribution(client, {
        playerId,
        contribution: SOCIAL_CONTRIBUTION_REWARDS.waterField,
        sourceType: 'social-water-field',
        sourceId: assist.id,
        metadata: {
          targetPlayerId: request.targetPlayerId,
          fieldSlotId: wateredField.fieldSlotId,
          shortenedSeconds: wateredField.shortenedSeconds,
        },
      });
      const counts = await this.getCounts(client, playerId);
      return { assist, counts, wateredField };
    });

    return {
      app: APP_NAME,
      summary: `已帮好友浇水，成长缩短 ${formatDuration(result.wateredField.shortenedSeconds)}，亲密度 +${WATER_INTIMACY_GAIN}。`,
      assist: {
        id: result.assist.id,
        assistType: 'water_field',
        targetPlayerId: result.assist.targetPlayerId,
        targetEntityType: result.assist.targetEntityType,
        targetEntityId: result.assist.targetEntityId,
        effectValue: result.assist.effectValue,
        dateKey: result.assist.dateKey,
        createdAt: result.assist.createdAt.toISOString(),
      },
      field: {
        fieldSlotId: result.wateredField.fieldSlotId,
        status: result.wateredField.status,
        shortenedSeconds: result.wateredField.shortenedSeconds,
        beforeStageEndsAt: result.wateredField.beforeStageEndsAt.toISOString(),
        afterStageEndsAt: result.wateredField.afterStageEndsAt.toISOString(),
        fieldVersion: result.wateredField.fieldVersion,
      },
      counts: result.counts,
    };
  }

  async visitFriendFields(
    playerId: string,
    request: ClientSocialHarvestFieldPreviewRequest,
  ): Promise<ClientSocialFriendFieldVisitResponse> {
    await this.assertPlayerExists(this.prisma.db, playerId);
    const target = await this.assertPlayerExists(this.prisma.db, request.targetPlayerId);

    if (playerId === request.targetPlayerId) {
      throw this.invalidRequest('Cannot visit your own field through friend assist.');
    }
    await this.assertActiveFriendRelation(this.prisma.db, playerId, request.targetPlayerId);

    const fields = await this.prisma.db.playerFieldSlot.findMany({
      where: { playerId: request.targetPlayerId },
      orderBy: { slotIndex: 'asc' },
      select: friendFieldVisitSelect,
    });
    const harvestedFieldIds = await this.findHarvestedFieldIdsForCurrentCycle(this.prisma.db, playerId, request.targetPlayerId, fields);

    return {
      app: APP_NAME,
      friend: this.mapPlayer(target),
      fields: fields.map((field) => this.mapFriendVisitField(field, new Date(), harvestedFieldIds.has(field.id))),
      ruleText: '一键助力会自动处理当前可助力田地：成长中浇水，成熟后采摘；枯萎田暂时不能助力，采摘不影响好友收成。',
    };
  }

  async previewHarvestField(
    playerId: string,
    request: ClientSocialHarvestFieldPreviewRequest,
  ): Promise<ClientSocialHarvestFieldPreviewResponse> {
    await this.assertPlayerExists(this.prisma.db, playerId);
    const target = await this.assertPlayerExists(this.prisma.db, request.targetPlayerId);

    if (playerId === request.targetPlayerId) {
      throw this.invalidRequest('Cannot harvest your own field through friend assist.');
    }
    await this.assertActiveFriendRelation(this.prisma.db, playerId, request.targetPlayerId);

    const fields = await this.findHarvestableFields(this.prisma.db, request.targetPlayerId);

    return {
      app: APP_NAME,
      friend: this.mapPlayer(target),
      fields: fields.map((field) => this.mapHarvestableField(field)),
      ruleText: '不会影响好友收成',
    };
  }

  async harvestField(playerId: string, request: ClientSocialHarvestFieldRequest): Promise<ClientSocialAssistResponse> {
    const result = await this.prisma.transaction(async (client) => {
      const helper = await this.assertPlayerExists(client, playerId);
      const target = await this.assertPlayerExists(client, request.targetPlayerId);

      if (playerId === request.targetPlayerId) {
        throw this.invalidRequest('Cannot harvest your own field through friend assist.');
      }
      await this.assertActiveFriendRelation(client, playerId, request.targetPlayerId);

      const dateKey = getLocalDateKey();

      const harvestedField = await this.resolveHarvestableField(client, request.targetPlayerId, request.fieldSlotId);
      if (!harvestedField) {
        throw this.invalidRequest('当前没有可采摘的好友田地。');
      }

      const repeatedHarvest = await client.playerAssistRecord.findFirst({
        where: {
          helperPlayerId: playerId,
          targetPlayerId: request.targetPlayerId,
          assistType: SocialAssistType.HARVEST_FIELD,
          targetEntityType: 'field_slot',
          targetEntityId: harvestedField.id,
          createdAt: { gte: getHarvestCycleStartedAt(harvestedField) },
        },
        select: { id: true },
      });
      if (repeatedHarvest) {
        throw this.invalidRequest('这块田地本轮已经采摘过了，可以继续帮好友浇水。');
      }

      const harvestResult = this.mapHarvestedField(harvestedField);
      const wallet = await client.playerWallet.findUnique({
        where: { playerId },
        select: { vaultGold: true, balanceVersion: true },
      });
      if (!wallet) {
        throw new BusinessError({ code: ErrorCode.NotFound, message: 'Player wallet not found.', statusCode: 404 });
      }

      const updatedWallet = await client.playerWallet.update({
        where: { playerId },
        data: {
          vaultGold: { increment: harvestResult.rewardGold },
          balanceVersion: { increment: 1 },
        },
        select: { vaultGold: true, balanceVersion: true },
      });

      const assist = await client.playerAssistRecord.create({
        data: {
          helperPlayerId: playerId,
          targetPlayerId: request.targetPlayerId,
          assistType: SocialAssistType.HARVEST_FIELD,
          targetEntityType: 'field_slot',
          targetEntityId: harvestResult.fieldSlotId,
          effectValue: harvestResult.rewardGold,
          dateKey,
        },
      });

      await client.walletChangeLog.create({
        data: {
          playerId,
          walletBucket: 'vault',
          changeType: 'friend-harvest-assist',
          deltaGold: harvestResult.rewardGold,
          beforeGold: wallet.vaultGold,
          afterGold: updatedWallet.vaultGold,
          relatedEntityType: 'player_assist_record',
          relatedEntityId: assist.id,
          requestIdempotencyKey: request.requestIdempotencyKey,
          note: `好友采摘 ${target.nickname} 的灵田余韵`,
        },
      });

      await Promise.all([
        client.playerSocialFeed.create({
          data: {
            playerId,
            actorPlayerId: request.targetPlayerId,
            feedType: SocialFeedType.FRIEND_WATERED_FIELD,
            relatedEntityType: 'player_assist_record',
            relatedEntityId: assist.id,
            summary: `你拜访 ${target.nickname} 的灵田，采摘到一缕灵田余韵。`,
            metadataJson: {
              assistId: assist.id,
              assistType: 'harvest_field',
              fieldSlotId: harvestResult.fieldSlotId,
              rewardGold: harvestResult.rewardGold,
            },
          },
        }),
        client.playerSocialFeed.create({
          data: {
            playerId: request.targetPlayerId,
            actorPlayerId: playerId,
            feedType: SocialFeedType.FRIEND_WATERED_FIELD,
            relatedEntityType: 'player_assist_record',
            relatedEntityId: assist.id,
            summary: `${helper.nickname} 拜访了你的灵田，采摘不会影响你的收成。`,
            metadataJson: {
              assistId: assist.id,
              assistType: 'harvest_field',
              fieldSlotId: harvestResult.fieldSlotId,
              rewardGold: harvestResult.rewardGold,
            },
          },
        }),
      ]);

      await this.bumpInteraction(client, playerId, request.targetPlayerId, HARVEST_INTIMACY_GAIN);
      await grantFactionContribution(client, {
        playerId,
        contribution: SOCIAL_CONTRIBUTION_REWARDS.harvestField,
        sourceType: 'social-harvest-field',
        sourceId: assist.id,
        metadata: {
          targetPlayerId: request.targetPlayerId,
          fieldSlotId: harvestResult.fieldSlotId,
          rewardGold: harvestResult.rewardGold,
        },
      });
      const counts = await this.getCounts(client, playerId);
      return { assist, counts, harvestResult };
    });

    return {
      app: APP_NAME,
      summary: `采摘到一缕灵田余韵，亲密度 +${HARVEST_INTIMACY_GAIN}。`,
      assist: {
        id: result.assist.id,
        assistType: 'harvest_field',
        targetPlayerId: result.assist.targetPlayerId,
        targetEntityType: result.assist.targetEntityType,
        targetEntityId: result.assist.targetEntityId,
        effectValue: result.assist.effectValue,
        dateKey: result.assist.dateKey,
        createdAt: result.assist.createdAt.toISOString(),
      },
      rewards: [
        { kind: 'gold', quantity: result.harvestResult.rewardGold, label: '金币' },
      ],
      counts: result.counts,
    };
  }

  async createTeamChallenge(playerId: string, request: ClientTeamChallengeRequest): Promise<ClientTeamChallengeResponse> {
    const challenge = await this.prisma.transaction(async (client) => {
      await this.assertPlayerExists(client, playerId);
      await this.assertPlayerExists(client, request.allyPlayerId);
      await this.assertPlayerExists(client, request.targetPlayerId);

      if (playerId === request.allyPlayerId || playerId === request.targetPlayerId || request.allyPlayerId === request.targetPlayerId) {
        throw this.invalidRequest('Team challenge participants must be different players.');
      }

      const created = await client.teamChallenge.create({
        data: {
          initiatorPlayerId: playerId,
          allyPlayerId: request.allyPlayerId,
          targetPlayerId: request.targetPlayerId,
          expiresAt: new Date(Date.now() + TEAM_CHALLENGE_EXPIRES_MS),
        },
        include: this.teamChallengeInclude(),
      });

      await client.playerSocialFeed.create({
        data: {
          playerId: request.allyPlayerId,
          actorPlayerId: playerId,
          feedType: SocialFeedType.TEAM_CHALLENGE_INVITED,
          relatedEntityType: 'team_challenge',
          relatedEntityId: created.id,
          summary: `${created.initiator.nickname} invited you to challenge ${created.target.nickname}.`,
          metadataJson: { challengeId: created.id },
          expiresAt: created.expiresAt,
        },
      });

      return created;
    });

    return {
      app: APP_NAME,
      summary: `Invited ${challenge.ally.nickname} to a team challenge.`,
      challenge: this.mapChallenge(challenge),
    };
  }

  async acceptTeamChallenge(playerId: string, challengeId: string): Promise<ClientTeamChallengeResponse> {
    return this.updateTeamChallengeStatus(playerId, challengeId, TeamChallengeStatus.ACCEPTED, 'Team challenge accepted.');
  }

  async rejectTeamChallenge(playerId: string, challengeId: string): Promise<ClientTeamChallengeResponse> {
    return this.updateTeamChallengeStatus(playerId, challengeId, TeamChallengeStatus.REJECTED, 'Team challenge rejected.');
  }

  private async updateTeamChallengeStatus(
    playerId: string,
    challengeId: string,
    status: typeof TeamChallengeStatus.ACCEPTED | typeof TeamChallengeStatus.REJECTED,
    summary: string,
  ): Promise<ClientTeamChallengeResponse> {
    const challenge = await this.prisma.transaction(async (client) => {
      const existing = await client.teamChallenge.findUnique({
        where: { id: challengeId },
        include: this.teamChallengeInclude(),
      });

      if (!existing) {
        throw new BusinessError({ code: ErrorCode.NotFound, message: 'Team challenge not found.', statusCode: 404 });
      }

      if (existing.allyPlayerId !== playerId) {
        throw this.invalidRequest('Only the invited ally can update this challenge.');
      }

      if (existing.status !== TeamChallengeStatus.PENDING || existing.expiresAt.getTime() <= Date.now()) {
        throw this.invalidRequest('Team challenge is no longer pending.');
      }

      const updated = await client.teamChallenge.update({
        where: { id: challengeId },
        data: { status },
        include: this.teamChallengeInclude(),
      });

      if (status === TeamChallengeStatus.ACCEPTED) {
        await client.playerSocialFeed.create({
          data: {
            playerId: updated.initiatorPlayerId,
            actorPlayerId: playerId,
            feedType: SocialFeedType.TEAM_CHALLENGE_ACCEPTED,
            relatedEntityType: 'team_challenge',
            relatedEntityId: updated.id,
            summary: `${updated.ally.nickname} accepted your team challenge invitation.`,
            metadataJson: { challengeId: updated.id },
          },
        });
      }

      return updated;
    });

    return {
      app: APP_NAME,
      summary,
      challenge: this.mapChallenge(challenge),
    };
  }

  private async upsertRelation(
    playerId: string,
    targetPlayerId: string,
    relationType: SocialRelationType,
    sourceType: string,
    status: SocialRelationStatus,
  ): Promise<ClientSocialRelationItem> {
    if (playerId === targetPlayerId) {
      throw this.invalidRequest('Cannot create a social relation to yourself.');
    }

    await this.assertPlayerExists(this.prisma.db, playerId);
    await this.assertPlayerExists(this.prisma.db, targetPlayerId);
    const relation = await this.upsertRelationRecord(this.prisma.db, {
      playerId,
      targetPlayerId,
      relationType,
      sourceType,
      status,
      now: new Date(),
    });

    return this.mapRelation(relation);
  }

  private async upsertRelationRecord(
    client: DbClient,
    input: {
      playerId: string;
      targetPlayerId: string;
      relationType: SocialRelationType;
      sourceType: string;
      status: SocialRelationStatus;
      now: Date;
    },
  ): Promise<RelationWithTarget> {
    return client.playerSocialRelation.upsert({
      where: {
        playerId_targetPlayerId_relationType: {
          playerId: input.playerId,
          targetPlayerId: input.targetPlayerId,
          relationType: input.relationType,
        },
      },
      create: {
        playerId: input.playerId,
        targetPlayerId: input.targetPlayerId,
        relationType: input.relationType,
        status: input.status,
        sourceType: input.sourceType,
        lastInteractedAt: input.status === SocialRelationStatus.ACTIVE ? input.now : undefined,
      },
      update: {
        status: input.status,
        sourceType: input.sourceType,
        lastInteractedAt: input.status === SocialRelationStatus.ACTIVE ? input.now : undefined,
      },
      include: { targetPlayer: this.playerSummaryInclude() },
    });
  }

  private async createFriendAcceptedFeeds(client: DbClient, firstPlayerId: string, secondPlayerId: string): Promise<void> {
    await Promise.all([
      client.playerSocialFeed.create({
        data: {
          playerId: firstPlayerId,
          actorPlayerId: secondPlayerId,
          feedType: SocialFeedType.FRIEND_ACCEPTED,
          relatedEntityType: 'player',
          relatedEntityId: secondPlayerId,
          summary: '你们已经成为好友，可以互相浇水了。',
          metadataJson: { friendPlayerId: secondPlayerId },
        },
      }),
      client.playerSocialFeed.create({
        data: {
          playerId: secondPlayerId,
          actorPlayerId: firstPlayerId,
          feedType: SocialFeedType.FRIEND_ACCEPTED,
          relatedEntityType: 'player',
          relatedEntityId: firstPlayerId,
          summary: '你们已经成为好友，可以互相浇水了。',
          metadataJson: { friendPlayerId: firstPlayerId },
        },
      }),
    ]);
  }

  private async expireFriendRequestFeeds(client: DbClient, firstPlayerId: string, secondPlayerId: string, now: Date): Promise<void> {
    await client.playerSocialFeed.updateMany({
      where: {
        feedType: SocialFeedType.FRIEND_REQUESTED,
        expiresAt: null,
        OR: [
          { playerId: firstPlayerId, actorPlayerId: secondPlayerId },
          { playerId: secondPlayerId, actorPlayerId: firstPlayerId },
        ],
      },
      data: {
        expiresAt: now,
        isRead: true,
      },
    });
  }

  private async findPendingIncomingFriendRelation(client: DbClient, playerId: string, relationId: string): Promise<RelationWithTarget> {
    const relation = await client.playerSocialRelation.findFirst({
      where: {
        id: relationId,
        playerId,
        relationType: SocialRelationType.FRIEND,
        status: SocialRelationStatus.PENDING,
        sourceType: { endsWith: ':incoming' },
      },
      include: { targetPlayer: this.playerSummaryInclude() },
    });

    if (!relation) {
      throw this.invalidRequest('Friend request is no longer pending.');
    }

    return relation;
  }

  private assertSameFactionForFriend(
    playerId: string,
    targetPlayerId: string,
    player: PlayerSummaryProjection,
    target: PlayerSummaryProjection,
  ): void {
    if (!player.factionId || !target.factionId || player.factionId !== target.factionId) {
      throw this.invalidRequest(`Players ${playerId} and ${targetPlayerId} are in different factions. Manual friend requests only support same-faction players; invite links can still bind real friends.`);
    }
  }

  private async assertActiveFriendRelation(client: DbClient, playerId: string, targetPlayerId: string): Promise<void> {
    const relation = await client.playerSocialRelation.findUnique({
      where: {
        playerId_targetPlayerId_relationType: {
          playerId,
          targetPlayerId,
          relationType: SocialRelationType.FRIEND,
        },
      },
      select: { status: true },
    });

    if (relation?.status !== SocialRelationStatus.ACTIVE) {
      throw this.invalidRequest('Only active friends can water each other.');
    }
  }

  private async bumpInteraction(client: DbClient, playerId: string, targetPlayerId: string, intimacyGain = 5): Promise<void> {
    const now = new Date();
    await Promise.all([
      client.playerSocialRelation.updateMany({
        where: {
          playerId,
          targetPlayerId,
          relationType: { in: [SocialRelationType.FRIEND, SocialRelationType.FOLLOWING] },
        },
        data: {
          intimacy: { increment: intimacyGain },
          lastInteractedAt: now,
        },
      }),
      client.playerSocialRelation.updateMany({
        where: {
          playerId: targetPlayerId,
          targetPlayerId: playerId,
          relationType: SocialRelationType.FRIEND,
        },
        data: {
          intimacy: { increment: intimacyGain },
          lastInteractedAt: now,
        },
      }),
    ]);
  }

  private async applyWaterFieldAssist(
    client: DbClient,
    input: { helperPlayerId: string; targetPlayerId: string; fieldSlotId?: string; now: Date },
  ): Promise<WateredFieldResult> {
    const field = input.fieldSlotId
      ? await this.findWaterableFieldById(client, input.targetPlayerId, input.fieldSlotId)
      : await this.findFirstWaterableField(client, input.targetPlayerId);

    if (!field) {
      throw this.invalidRequest('好友当前没有可浇水的成长中田地。');
    }

    const stageStartedAt = getWaterableStageStartedAt(field, input.now);
    const currentStageEndsAt = getWaterableStageEndsAt(field, stageStartedAt);

    if (currentStageEndsAt.getTime() <= input.now.getTime()) {
      throw this.invalidRequest('这块田已经可以进入下一阶段，不能继续浇水。');
    }

    const repeatedAssist = await client.playerAssistRecord.findFirst({
      where: {
        helperPlayerId: input.helperPlayerId,
        targetPlayerId: input.targetPlayerId,
        assistType: SocialAssistType.WATER_FIELD,
        targetEntityType: 'field_slot',
        targetEntityId: field.id,
        createdAt: { gte: stageStartedAt },
      },
      select: { id: true },
    });

    if (repeatedAssist) {
      throw this.invalidRequest('你已经帮这块田浇过水了，等它进入下一轮成长后再来。');
    }

    const remainingSeconds = Math.ceil((currentStageEndsAt.getTime() - input.now.getTime()) / 1000);
    const shortenedSeconds = Math.min(
      Math.max(Math.floor(remainingSeconds * WATER_REMAINING_RATIO), WATER_MIN_EFFECT_SECONDS),
      WATER_MAX_EFFECT_SECONDS,
      remainingSeconds,
    );
    const afterStageEndsAt = new Date(currentStageEndsAt.getTime() - shortenedSeconds * 1000);
    const updated = await client.playerFieldSlot.update({
      where: { id: field.id },
      data: {
        ...buildFieldReadyAtUpdate(afterStageEndsAt),
        lastCalculatedAt: input.now,
        statusVersion: { increment: 1 },
      },
      select: { statusVersion: true },
    });

    return {
      fieldSlotId: field.id,
      status: field.status,
      shortenedSeconds,
      beforeStageEndsAt: currentStageEndsAt,
      afterStageEndsAt,
      fieldVersion: updated.statusVersion,
    };
  }

  private async findWaterableFieldById(client: DbClient, targetPlayerId: string, fieldSlotId: string): Promise<WaterableField | null> {
    return client.playerFieldSlot.findFirst({
      where: {
        id: fieldSlotId,
        playerId: targetPlayerId,
        isUnlocked: true,
        status: 'GROWING',
        seedDefinitionId: { not: null },
      },
      orderBy: { slotIndex: 'asc' },
      select: waterableFieldSelect,
    });
  }

  private async findFirstWaterableField(client: DbClient, targetPlayerId: string): Promise<WaterableField | null> {
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
      select: waterableFieldSelect,
    });
  }

  private async findHarvestableFields(client: DbClient, targetPlayerId: string): Promise<HarvestableField[]> {
    return client.playerFieldSlot.findMany({
      where: {
        playerId: targetPlayerId,
        isUnlocked: true,
        status: 'MATURE',
        seedDefinitionId: { not: null },
      },
      orderBy: [
        { status: 'desc' },
        { currentClaimableGold: 'desc' },
        { slotIndex: 'asc' },
      ],
      take: 4,
      select: harvestableFieldSelect,
    });
  }

  private async resolveHarvestableField(client: DbClient, targetPlayerId: string, fieldSlotId?: string): Promise<HarvestableField | null> {
    if (fieldSlotId) {
      return client.playerFieldSlot.findFirst({
        where: {
          id: fieldSlotId,
          playerId: targetPlayerId,
          isUnlocked: true,
          status: 'MATURE',
          seedDefinitionId: { not: null },
        },
        select: harvestableFieldSelect,
      });
    }

    const fields = await this.findHarvestableFields(client, targetPlayerId);
    return fields[0] ?? null;
  }

  private async findHarvestedFieldIdsForCurrentCycle(
    client: DbClient,
    helperPlayerId: string,
    targetPlayerId: string,
    fields: FriendFieldVisitSlot[],
  ): Promise<Set<string>> {
    const harvestableFields = fields.filter((field) => isFieldHarvestableForVisit(field));
    if (harvestableFields.length === 0) {
      return new Set();
    }

    const conditions = harvestableFields.map((field) => ({
      targetEntityId: field.id,
      createdAt: { gte: getVisitFieldCycleStartedAt(field) },
    }));
    const records = await client.playerAssistRecord.findMany({
      where: {
        helperPlayerId,
        targetPlayerId,
        assistType: SocialAssistType.HARVEST_FIELD,
        targetEntityType: 'field_slot',
        OR: conditions,
      },
      select: { targetEntityId: true },
    });

    return new Set(records.map((record) => record.targetEntityId).filter((id): id is string => typeof id === 'string'));
  }

  private mapFriendVisitField(field: FriendFieldVisitSlot, now: Date, harvestedThisCycle: boolean): ClientSocialFriendFieldVisitField {
    const status = field.status as ClientSocialFriendFieldVisitField['status'];
    const canWater = field.isUnlocked && field.status === 'GROWING' && Boolean(field.seedDefinition);
    const canHarvest = !harvestedThisCycle && field.isUnlocked && field.status === 'MATURE' && Boolean(field.seedDefinition);
    const timing = getFriendFieldTiming(field, now);
    const rewardPreview = canHarvest ? { gold: calculateHarvestRewardGold(field) } : null;
    const tone = mapFriendFieldTone(field.status);

    return {
      fieldSlotId: field.id,
      fieldCode: `田地 ${String(field.slotIndex).padStart(2, '0')}`,
      slotIndex: field.slotIndex,
      status,
      tone,
      badge: getFriendFieldBadge(status),
      title: getFriendFieldTitle(status),
      cropName: field.seedDefinition?.label ?? null,
      cropRarity: field.seedDefinition?.rarity ?? null,
      canWater,
      canHarvest,
      nextAction: canHarvest ? 'harvest' : canWater ? 'water' : null,
      unavailableReason: canWater || canHarvest ? null : getFriendFieldUnavailableReason(field),
      rewardPreview,
      progressRemainingSeconds: timing.remainingSeconds,
      progressTotalSeconds: timing.totalSeconds,
      yieldGold: field.currentClaimableGold || field.seedDefinition?.baseYieldGold || 0,
    };
  }

  private mapHarvestableField(field: HarvestableField): ClientSocialHarvestFieldPreviewResponse['fields'][number] {
    const rewardGold = calculateHarvestRewardGold(field);
    return {
      fieldSlotId: field.id,
      fieldCode: `田地 ${field.slotIndex}`,
      status: field.status as 'MATURE',
      cropName: field.seedDefinition?.label ?? '未知灵植',
      cropRarity: field.seedDefinition?.rarity ?? 'common',
      rewardPreview: { gold: rewardGold },
    };
  }

  private mapHarvestedField(field: HarvestableField): HarvestedFieldResult {
    return {
      fieldSlotId: field.id,
      fieldCode: `田地 ${field.slotIndex}`,
      status: field.status,
      cropName: field.seedDefinition?.label ?? '未知灵植',
      cropRarity: field.seedDefinition?.rarity ?? 'common',
      rewardGold: calculateHarvestRewardGold(field),
    };
  }

  private async getCounts(client: DbClient, playerId: string): Promise<ClientSocialSummaryResponse['counts']> {
    const [feedUnread, friends, following, enemies, pendingTeamChallenges] = await Promise.all([
      client.playerSocialFeed.count({ where: { playerId, isRead: false } }),
      client.playerSocialRelation.count({ where: { playerId, relationType: SocialRelationType.FRIEND, status: SocialRelationStatus.ACTIVE } }),
      client.playerSocialRelation.count({ where: { playerId, relationType: SocialRelationType.FOLLOWING, status: SocialRelationStatus.ACTIVE } }),
      client.playerSocialRelation.count({ where: { playerId, relationType: SocialRelationType.ENEMY, status: SocialRelationStatus.ACTIVE } }),
      client.teamChallenge.count({ where: { allyPlayerId: playerId, status: TeamChallengeStatus.PENDING, expiresAt: { gt: new Date() } } }),
    ]);

    return {
      feedUnread,
      friends,
      following,
      enemies,
      pendingTeamChallenges,
    };
  }

  private async assertPlayerExists(client: DbClient, playerId: string): Promise<PlayerSummaryProjection> {
    const player = await client.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        nickname: true,
        factionId: true,
        castleLevelCache: true,
        lastLoginAt: true,
        faction: { select: { name: true } },
      },
    });

    if (!player) {
      throw new BusinessError({ code: ErrorCode.NotFound, message: 'Player not found.', statusCode: 404 });
    }

    return player;
  }

  private playerSummaryInclude(): {
    select: {
      id: true;
      nickname: true;
      factionId: true;
      castleLevelCache: true;
      lastLoginAt: true;
      faction: { select: { name: true } };
    };
  } {
    return {
      select: {
        id: true,
        nickname: true,
        factionId: true,
        castleLevelCache: true,
        lastLoginAt: true,
        faction: { select: { name: true } },
      },
    };
  }

  private teamChallengeInclude(): {
    initiator: ReturnType<SocialService['playerSummaryInclude']>;
    ally: ReturnType<SocialService['playerSummaryInclude']>;
    target: ReturnType<SocialService['playerSummaryInclude']>;
  } {
    return {
      initiator: this.playerSummaryInclude(),
      ally: this.playerSummaryInclude(),
      target: this.playerSummaryInclude(),
    };
  }

  private mapPlayer(player: PlayerSummaryProjection): ClientSocialRelationItem['target'] {
    return {
      playerId: player.id,
      nickname: player.nickname,
      factionId: player.factionId,
      factionName: player.faction?.name ?? null,
      castleLevel: player.castleLevelCache,
      lastActiveAt: player.lastLoginAt?.toISOString() ?? null,
    };
  }

  private mapRelation(relation: RelationWithTarget, assistSummary?: ClientSocialRelationItem['assistSummary']): ClientSocialRelationItem {
    return {
      id: relation.id,
      relationType: this.mapRelationType(relation.relationType),
      status: this.mapRelationStatus(relation.status),
      sourceType: relation.sourceType,
      intimacy: relation.intimacy,
      lastInteractedAt: relation.lastInteractedAt?.toISOString() ?? null,
      createdAt: relation.createdAt.toISOString(),
      target: this.mapPlayer(relation.targetPlayer),
      assistSummary,
    };
  }

  private async getAssistSummaries(
    client: DbClient,
    helperPlayerId: string,
    targetPlayerIds: string[],
  ): Promise<Map<string, ClientSocialRelationItem['assistSummary']>> {
    const uniqueTargetPlayerIds = Array.from(new Set(targetPlayerIds));
    if (uniqueTargetPlayerIds.length === 0) {
      return new Map();
    }

    const fields = await client.playerFieldSlot.findMany({
      where: {
        playerId: { in: uniqueTargetPlayerIds },
        isUnlocked: true,
        status: { in: ['GROWING', 'MATURE'] },
        seedDefinitionId: { not: null },
      },
      select: {
        id: true,
        playerId: true,
        status: true,
        seedAt: true,
        lastCalculatedAt: true,
      },
    });
    const matureFields = fields.filter((field) => field.status === 'MATURE');
    const growingFields = fields.filter((field) => field.status === 'GROWING');
    const [wateredRecords, harvestedRecords] = await Promise.all([
      growingFields.length > 0
        ? client.playerAssistRecord.findMany({
          where: {
            helperPlayerId,
            assistType: SocialAssistType.WATER_FIELD,
            targetEntityType: 'field_slot',
            OR: growingFields.map((field) => ({
              targetPlayerId: field.playerId,
              targetEntityId: field.id,
              createdAt: { gte: field.seedAt ?? field.lastCalculatedAt ?? new Date(0) },
            })),
          },
          select: {
            targetEntityId: true,
          },
        })
        : [],
      matureFields.length > 0
        ? client.playerAssistRecord.findMany({
        where: {
          helperPlayerId,
          assistType: SocialAssistType.HARVEST_FIELD,
          targetEntityType: 'field_slot',
          OR: matureFields.map((field) => ({
            targetPlayerId: field.playerId,
            targetEntityId: field.id,
            createdAt: { gte: field.seedAt ?? field.lastCalculatedAt ?? new Date(0) },
          })),
        },
        select: {
          targetEntityId: true,
        },
      })
        : [],
    ]);
    const wateredFieldIds = new Set(wateredRecords.map((record) => record.targetEntityId).filter((id): id is string => typeof id === 'string'));
    const harvestedFieldIds = new Set(harvestedRecords.map((record) => record.targetEntityId).filter((id): id is string => typeof id === 'string'));
    const summaryByPlayerId = new Map<string, ClientSocialRelationItem['assistSummary']>();

    for (const targetPlayerId of uniqueTargetPlayerIds) {
      summaryByPlayerId.set(targetPlayerId, { waterableCount: 0, harvestableCount: 0, availableCount: 0 });
    }

    for (const field of fields) {
      const summary = summaryByPlayerId.get(field.playerId);
      if (!summary) {
        continue;
      }
      if (field.status === 'GROWING' && !wateredFieldIds.has(field.id)) {
        summary.waterableCount += 1;
        summary.availableCount += 1;
        continue;
      }
      if (field.status === 'MATURE' && !harvestedFieldIds.has(field.id)) {
        summary.harvestableCount += 1;
        summary.availableCount += 1;
      }
    }

    return summaryByPlayerId;
  }

  private mapFeed(feed: FeedWithActor): ClientSocialFeedItem {
    const targetPlayerId = feed.actorPlayerId ?? undefined;
    return {
      id: feed.id,
      feedType: this.mapFeedType(feed.feedType),
      summary: feed.summary,
      isRead: feed.isRead,
      createdAt: feed.createdAt.toISOString(),
      expiresAt: feed.expiresAt?.toISOString() ?? null,
      actor: feed.actor ? this.mapPlayer(feed.actor) : null,
      actions: this.buildFeedActions(feed.feedType, targetPlayerId, feed.relatedEntityId ?? undefined),
    };
  }

  private mapChallenge(challenge: TeamChallengeWithPlayers): ClientTeamChallengeItem {
    return {
      id: challenge.id,
      status: this.mapTeamChallengeStatus(challenge.status),
      initiator: this.mapPlayer(challenge.initiator),
      ally: this.mapPlayer(challenge.ally),
      target: this.mapPlayer(challenge.target),
      assistEfficiencyBps: challenge.assistEfficiencyBps,
      result: challenge.result,
      reward: (challenge.rewardJson as Record<string, unknown> | null) ?? null,
      expiresAt: challenge.expiresAt.toISOString(),
      createdAt: challenge.createdAt.toISOString(),
      settledAt: challenge.settledAt?.toISOString() ?? null,
    };
  }

  private buildFeedActions(feedType: SocialFeedType, targetPlayerId?: string, relatedEntityId?: string): ClientSocialFeedItem['actions'] {
    if (feedType === SocialFeedType.FRIEND_REQUESTED) {
      return [
        { label: '同意', action: 'accept_friend', targetPlayerId, relatedEntityId },
        { label: '拒绝', action: 'reject_friend', targetPlayerId, relatedEntityId },
      ];
    }
    if (feedType === SocialFeedType.FRIEND_WATERED_FIELD) {
      return [{ label: '回浇', action: 'assist_back', targetPlayerId }];
    }
    if (feedType === SocialFeedType.REVENGE_AVAILABLE || feedType === SocialFeedType.ENEMY_RAIDED) {
      return [
        { label: '复仇', action: 'revenge', targetPlayerId, relatedEntityId },
        { label: '关注', action: 'follow', targetPlayerId },
      ];
    }
    if (feedType === SocialFeedType.TEAM_CHALLENGE_INVITED) {
      return [{ label: '查看邀请', action: 'team_challenge', targetPlayerId, relatedEntityId }];
    }
    return [{ label: '忽略', action: 'ignore', targetPlayerId, relatedEntityId }];
  }

  private mapRelationType(type: SocialRelationType): ClientSocialRelationItem['relationType'] {
    return type.toLowerCase() as ClientSocialRelationItem['relationType'];
  }

  private mapRelationStatus(status: SocialRelationStatus): ClientSocialRelationItem['status'] {
    return status.toLowerCase() as ClientSocialRelationItem['status'];
  }

  private mapFeedType(type: SocialFeedType): ClientSocialFeedItem['feedType'] {
    return type.toLowerCase() as ClientSocialFeedItem['feedType'];
  }

  private mapTeamChallengeStatus(status: TeamChallengeStatus): ClientTeamChallengeItem['status'] {
    return status.toLowerCase() as ClientTeamChallengeItem['status'];
  }

  private invalidRequest(message: string): BusinessError {
    return new BusinessError({ code: ErrorCode.BadRequest, message, statusCode: 400 });
  }
}

function getWaterableStageStartedAt(field: WaterableField, now: Date): Date {
  return field.seedAt ?? field.lastCalculatedAt ?? now;
}

function getWaterableStageEndsAt(field: WaterableField, stageStartedAt: Date): Date {
  return getFieldReadyAt(field, field.seedDefinition?.seedId ?? '', stageStartedAt);
}

function getHarvestCycleStartedAt(field: HarvestableField): Date {
  return field.seedAt ?? field.lastCalculatedAt ?? new Date(0);
}

function calculateHarvestRewardGold(field: HarvestableField): number {
  return field.seedDefinition ? FRIEND_HARVEST_REWARD_GOLD : 0;
}

function isFieldHarvestableForVisit(field: FriendFieldVisitSlot): boolean {
  return field.isUnlocked
    && Boolean(field.seedDefinition)
    && field.status === 'MATURE';
}

function getVisitFieldCycleStartedAt(field: FriendFieldVisitSlot): Date {
  return field.seedAt ?? field.lastCalculatedAt ?? new Date(0);
}

function getFriendFieldUnavailableReason(field: FriendFieldVisitSlot): string | null {
  if (!field.isUnlocked || field.status === 'LOCKED') {
    return '好友尚未解锁这块田地';
  }
  if (field.status === 'EMPTY' || !field.seedDefinition) {
    return '好友还没有播种';
  }
  if (field.status === 'WITHERED') {
    return '这块田地已经枯萎，不能采摘；等好友重新播种后再来助力';
  }
  return null;
}

function mapFriendFieldTone(status: FieldStatus): ClientSocialFriendFieldVisitField['tone'] {
  if (status === 'LOCKED') {
    return 'locked';
  }
  if (status === 'EMPTY') {
    return 'empty';
  }
  if (status === 'GROWING') {
    return 'growing';
  }
  if (status === 'MATURE') {
    return 'mature';
  }
  return 'withered';
}

function getFriendFieldBadge(status: ClientSocialFriendFieldVisitField['status']): string {
  if (status === 'LOCKED') {
    return '待解锁';
  }
  if (status === 'EMPTY') {
    return '空闲';
  }
  if (status === 'GROWING') {
    return '成长';
  }
  if (status === 'MATURE') {
    return '成熟';
  }
  return '枯萎';
}

function getFriendFieldTitle(status: ClientSocialFriendFieldVisitField['status']): string {
  if (status === 'LOCKED') {
    return '尚未解锁';
  }
  if (status === 'EMPTY') {
    return '还没有播种';
  }
  if (status === 'GROWING') {
    return '成长中';
  }
  if (status === 'MATURE') {
    return '成熟可收';
  }
  return '已经枯萎';
}

function getFriendFieldTiming(field: FriendFieldVisitSlot, now: Date): { remainingSeconds: number; totalSeconds: number } {
  if (field.status === 'GROWING') {
    const startedAt = field.seedAt ?? field.lastCalculatedAt ?? now;
    const endsAt = getFieldReadyAt(field, field.seedDefinition?.seedId ?? '', now);
    return buildTiming(startedAt, endsAt, now);
  }
  return { remainingSeconds: 0, totalSeconds: 1 };
}

function buildTiming(startedAt: Date, endsAt: Date, now: Date): { remainingSeconds: number; totalSeconds: number } {
  const totalSeconds = Math.max(Math.ceil((endsAt.getTime() - startedAt.getTime()) / 1000), 1);
  const remainingSeconds = Math.max(Math.ceil((endsAt.getTime() - now.getTime()) / 1000), 0);
  return { remainingSeconds, totalSeconds };
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(Math.floor(totalSeconds), 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${Math.max(minutes, 1)}m`;
}
