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
  type ClientSocialReviveFieldRequest,
  type ClientSocialSummaryResponse,
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
import { FACTION_CONTRIBUTION_BALANCE_CONFIG } from '../lib/game-balance.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { grantFactionContribution } from '../faction/contribution.service.js';
import { FieldLifecycleService } from '../client-read/field-lifecycle.service.js';
import { SeasonGuardService } from '../season/season-guard.service.js';

const SOCIAL_PAGE_SIZE = 30;
const HARVEST_INTIMACY_GAIN = 2;
const REVIVE_INTIMACY_GAIN = 2;
const DAILY_FRIEND_INTIMACY_GAIN_LIMIT = 20;
const DAILY_FRIEND_ASSIST_LIMIT = 20;
const FRIEND_HARVEST_REWARD_GOLD = 10;
const REVIVE_WINDOW_SECONDS = 30 * 60;
const TEAM_CHALLENGE_EXPIRES_MS = 2 * 60 * 60 * 1000;
const FRIEND_REQUEST_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const SOCIAL_FOLLOW_LIMIT_CONFIG = {
  baseLimit: 30,
  expansionStep: 10,
  hardLimit: 100,
} as const;
export const SOCIAL_FRIEND_LIMIT_CONFIG = {
  baseLimit: 50,
  expansionStep: 10,
  hardLimit: 150,
} as const;
const SOCIAL_CONTRIBUTION_REWARDS = {
  reviveField: FACTION_CONTRIBUTION_BALANCE_CONFIG.sources.socialReviveField,
  harvestField: FACTION_CONTRIBUTION_BALANCE_CONFIG.sources.socialHarvestField,
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

interface RevivedFieldResult {
  fieldSlotId: string;
  status: FieldStatus;
  effectSeconds: number;
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

interface SocialAssistFeedMetadata {
  assistBatchKey?: string;
  perspective?: 'target' | 'helper';
  assistIds?: string[];
  reviveCount?: number;
  harvestCount?: number;
  totalRewardGold?: number;
  totalEffectSeconds?: number;
  fieldSlotIds?: string[];
}

const revivableFieldSelect = {
  id: true,
  status: true,
  statusVersion: true,
  matureAt: true,
  readyAt: true,
  overripeAt: true,
  seedDefinition: {
    select: {
      seedId: true,
    },
  },
} satisfies Prisma.PlayerFieldSlotSelect;

type RevivableField = Prisma.PlayerFieldSlotGetPayload<{ select: typeof revivableFieldSelect }>;

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
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FieldLifecycleService) private readonly fieldLifecycleService: FieldLifecycleService,
    @Inject(SeasonGuardService) private readonly seasonGuardService: SeasonGuardService,
  ) {}

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
    await this.seasonGuardService.ensureNoSeasonRolloverForAction(playerId);
    const relation = await this.prisma.transaction(async (client) => {
      await this.assertPlayerExists(client, playerId);
      await this.assertPlayerExists(client, request.targetPlayerId);
      if (playerId === request.targetPlayerId) {
        throw this.invalidRequest('Cannot create a social relation to yourself.');
      }

      const activeFriend = await client.playerSocialRelation.findUnique({
        where: {
          playerId_targetPlayerId_relationType: {
            playerId,
            targetPlayerId: request.targetPlayerId,
            relationType: SocialRelationType.FRIEND,
          },
        },
        include: { targetPlayer: this.playerSummaryInclude() },
      });

      if (activeFriend?.status === SocialRelationStatus.ACTIVE) {
        throw this.invalidRequest('Already friends. Friends do not need to be followed.');
      }

      const existingFollowing = await client.playerSocialRelation.findUnique({
        where: {
          playerId_targetPlayerId_relationType: {
            playerId,
            targetPlayerId: request.targetPlayerId,
            relationType: SocialRelationType.FOLLOWING,
          },
        },
      });

      if (existingFollowing?.status !== SocialRelationStatus.ACTIVE) {
        await this.assertFollowingCapacity(client, playerId);
      }

      return this.upsertRelationRecord(client, {
        playerId,
        targetPlayerId: request.targetPlayerId,
        relationType: SocialRelationType.FOLLOWING,
        sourceType: 'manual-follow',
        status: SocialRelationStatus.ACTIVE,
        now: new Date(),
      });
    });

    return {
      app: APP_NAME,
      summary: `已关注 ${relation.targetPlayer.nickname}。`,
      relation: this.mapRelation(relation),
    };
  }

  async unfollow(playerId: string, targetPlayerId: string): Promise<ClientSocialRelationMutationResponse> {
    await this.seasonGuardService.ensureNoSeasonRolloverForAction(playerId);
    const relation = await this.prisma.transaction(async (client) => {
      await this.assertPlayerExists(client, playerId);
      await this.assertPlayerExists(client, targetPlayerId);
      if (playerId === targetPlayerId) {
        throw this.invalidRequest('Cannot remove yourself from following list.');
      }

      return this.upsertRelationRecord(client, {
        playerId,
        targetPlayerId,
        relationType: SocialRelationType.FOLLOWING,
        sourceType: 'manual-unfollow',
        status: SocialRelationStatus.MUTED,
        now: new Date(),
      });
    });

    return {
      app: APP_NAME,
      summary: `已取消关注 ${relation.targetPlayer.nickname}。`,
      relation: this.mapRelation(relation),
    };
  }

  async requestFriend(playerId: string, request: ClientSocialFriendRequest): Promise<ClientSocialRelationMutationResponse> {
    await this.seasonGuardService.ensureNoSeasonRolloverForAction(playerId);
    const result = await this.prisma.transaction(async (client) => {
      await this.assertPlayerExists(client, playerId);
      const target = await this.assertPlayerExists(client, request.targetPlayerId);
      if (playerId === request.targetPlayerId) {
        throw this.invalidRequest('Cannot create a social relation to yourself.');
      }

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
      if (!shouldActivate) {
        this.assertFriendRequestNotPending(existingRelation, reverseRelation);
        this.assertFriendRequestCooldown(existingRelation, reverseRelation, now);
      }
      if (existingRelation?.status !== SocialRelationStatus.ACTIVE) {
        await this.assertFriendCapacityForPair(client, playerId, request.targetPlayerId, shouldActivate);
      }
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
        await this.muteFollowingBetween(client, playerId, request.targetPlayerId, now);
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
            summary: '对方向你发送了好友申请。',
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
    await this.seasonGuardService.ensureNoSeasonRolloverForAction(playerId);
    const result = await this.prisma.transaction(async (client) => {
      await this.assertPlayerExists(client, playerId);
      const existing = await this.findPendingIncomingFriendRelation(client, playerId, relationId);
      const target = existing.targetPlayer;
      const now = new Date();
      await this.assertFriendCapacityForPair(client, playerId, existing.targetPlayerId, true);
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

      await this.muteFollowingBetween(client, playerId, existing.targetPlayerId, now);
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
    await this.seasonGuardService.ensureNoSeasonRolloverForAction(playerId);
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
    await this.seasonGuardService.ensureNoSeasonRolloverForAction(playerId);
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
      await this.createFriendDeletedFeeds(client, playerId, targetPlayerId);
      return { target, relation, reverseRelation };
    });

    return {
      app: APP_NAME,
      summary: `已删除 ${result.target.nickname}。`,
      relation: this.mapRelation(result.relation),
      reverseRelation: this.mapRelation(result.reverseRelation),
    };
  }

  async reviveField(playerId: string, request: ClientSocialReviveFieldRequest, options: { now?: Date } = {}): Promise<ClientSocialAssistResponse> {
    await this.seasonGuardService.ensureNoSeasonRolloverForAction(playerId);
    const result = await this.prisma.transaction(async (client) => {
      const now = options.now ?? new Date();
      const helper = await this.assertPlayerExists(client, playerId);
      const target = await this.assertPlayerExists(client, request.targetPlayerId);

      if (playerId === request.targetPlayerId) {
        throw this.invalidRequest('Cannot assist your own field.');
      }
      await this.assertActiveFriendRelation(client, playerId, request.targetPlayerId);
      await this.fieldLifecycleService.settlePlayerFields(client, request.targetPlayerId, now);
      await this.assertDailyAssistCapacity(client, playerId, now);

      const dateKey = getLocalDateKey(now);
      const revivedField = await this.applyReviveFieldAssist(client, {
        helperPlayerId: playerId,
        targetPlayerId: request.targetPlayerId,
        fieldSlotId: request.fieldSlotId,
        now,
      });

      const assist = await client.playerAssistRecord.create({
        data: {
          helperPlayerId: playerId,
          targetPlayerId: request.targetPlayerId,
          assistType: SocialAssistType.REVIVE_FIELD,
          targetEntityType: 'field_slot',
          targetEntityId: revivedField.fieldSlotId,
          effectValue: revivedField.effectSeconds,
          createdAt: now,
          intimacyGain: await this.calculateDailyFriendIntimacyGain(client, {
            playerId,
            targetPlayerId: request.targetPlayerId,
            dateKey,
            requestedGain: REVIVE_INTIMACY_GAIN,
          }),
          dateKey,
        },
      });

      await this.recordFriendAssistFeed(client, {
        playerId: request.targetPlayerId,
        actorPlayerId: playerId,
        counterpartNickname: helper.nickname,
        perspective: 'target',
        requestIdempotencyKey: request.requestIdempotencyKey,
        fallbackRelatedEntityType: 'field_slot',
        fallbackRelatedEntityId: revivedField.fieldSlotId,
        assistId: assist.id,
        fieldSlotId: revivedField.fieldSlotId,
        reviveCount: 1,
        totalEffectSeconds: revivedField.effectSeconds,
      });

      await this.recordFriendAssistFeed(client, {
        playerId,
        actorPlayerId: request.targetPlayerId,
        counterpartNickname: target.nickname,
        perspective: 'helper',
        requestIdempotencyKey: request.requestIdempotencyKey,
        fallbackRelatedEntityType: 'field_slot',
        fallbackRelatedEntityId: revivedField.fieldSlotId,
        assistId: assist.id,
        fieldSlotId: revivedField.fieldSlotId,
        reviveCount: 1,
        totalEffectSeconds: revivedField.effectSeconds,
      });

      await this.bumpInteraction(client, playerId, request.targetPlayerId, assist.intimacyGain);
      await grantFactionContribution(client, {
        playerId,
        contribution: SOCIAL_CONTRIBUTION_REWARDS.reviveField,
        sourceType: 'social-revive-field',
        sourceId: assist.id,
        metadata: {
          targetPlayerId: request.targetPlayerId,
          fieldSlotId: revivedField.fieldSlotId,
          effectSeconds: revivedField.effectSeconds,
        },
      });
      const counts = await this.getCounts(client, playerId);
      return { assist, counts, intimacyGain: assist.intimacyGain, revivedField };
    });

    return {
      app: APP_NAME,
      summary: `已帮好友复活一块枯萎田，并重新争取到 30 分钟收取时间，${formatIntimacyGainClause(result.intimacyGain)}。`,
      assist: {
        id: result.assist.id,
        assistType: 'revive_field',
        targetPlayerId: result.assist.targetPlayerId,
        targetEntityType: result.assist.targetEntityType,
        targetEntityId: result.assist.targetEntityId,
        effectValue: result.assist.effectValue,
        dateKey: result.assist.dateKey,
        createdAt: result.assist.createdAt.toISOString(),
      },
      intimacyGain: result.intimacyGain,
      field: {
        fieldSlotId: result.revivedField.fieldSlotId,
        status: result.revivedField.status,
        effectSeconds: result.revivedField.effectSeconds,
        beforeStageEndsAt: result.revivedField.beforeStageEndsAt.toISOString(),
        afterStageEndsAt: result.revivedField.afterStageEndsAt.toISOString(),
        fieldVersion: result.revivedField.fieldVersion,
      },
      counts: result.counts,
    };
  }

  async visitFriendFields(
    playerId: string,
    request: ClientSocialHarvestFieldPreviewRequest,
    options: { now?: Date } = {},
  ): Promise<ClientSocialFriendFieldVisitResponse> {
    const now = options.now ?? new Date();
    await this.assertPlayerExists(this.prisma.db, playerId);
    const target = await this.assertPlayerExists(this.prisma.db, request.targetPlayerId);

    if (playerId === request.targetPlayerId) {
      throw this.invalidRequest('Cannot visit your own field through friend assist.');
    }
    await this.assertActiveFriendRelation(this.prisma.db, playerId, request.targetPlayerId);
    await this.fieldLifecycleService.settlePlayerFields(this.prisma.db, request.targetPlayerId, now);

    const fields = await this.prisma.db.playerFieldSlot.findMany({
      where: { playerId: request.targetPlayerId },
      orderBy: { slotIndex: 'asc' },
      select: friendFieldVisitSelect,
    });
    const harvestedFieldIds = await this.findHarvestedFieldIdsForCurrentCycle(this.prisma.db, playerId, request.targetPlayerId, fields);

    return {
      app: APP_NAME,
      friend: this.mapPlayer(target),
      fields: fields.map((field) => this.mapFriendVisitField(field, now, harvestedFieldIds.has(field.id))),
      ruleText: '一键助力会自动处理当前可助力田地：枯萎时先复活再收取，成熟时直接收取；采摘不会影响好友收成。',
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
    await this.fieldLifecycleService.settlePlayerFields(this.prisma.db, request.targetPlayerId);

    const fields = await this.findHarvestableFields(this.prisma.db, request.targetPlayerId);

    return {
      app: APP_NAME,
      friend: this.mapPlayer(target),
      fields: fields.map((field) => this.mapHarvestableField(field)),
      ruleText: '不会影响好友收成',
    };
  }

  async harvestField(playerId: string, request: ClientSocialHarvestFieldRequest, options: { now?: Date } = {}): Promise<ClientSocialAssistResponse> {
    await this.seasonGuardService.ensureNoSeasonRolloverForAction(playerId);
    const result = await this.prisma.transaction(async (client) => {
      const now = options.now ?? new Date();
      const helper = await this.assertPlayerExists(client, playerId);
      const target = await this.assertPlayerExists(client, request.targetPlayerId);

      if (playerId === request.targetPlayerId) {
        throw this.invalidRequest('Cannot harvest your own field through friend assist.');
      }
      await this.assertActiveFriendRelation(client, playerId, request.targetPlayerId);
      await this.fieldLifecycleService.settlePlayerFields(client, request.targetPlayerId, now);
      await this.assertDailyAssistCapacity(client, playerId, now);

      const dateKey = getLocalDateKey(now);

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
        throw this.invalidRequest('这块田地本轮已经采摘过了，可以继续帮助好友复活其他枯萎田。');
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
          createdAt: now,
          intimacyGain: await this.calculateDailyFriendIntimacyGain(client, {
            playerId,
            targetPlayerId: request.targetPlayerId,
            dateKey,
            requestedGain: HARVEST_INTIMACY_GAIN,
          }),
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

      await this.recordFriendAssistFeed(client, {
        playerId: request.targetPlayerId,
        actorPlayerId: playerId,
        counterpartNickname: helper.nickname,
        perspective: 'target',
        requestIdempotencyKey: request.requestIdempotencyKey,
        fallbackRelatedEntityType: 'player_assist_record',
        fallbackRelatedEntityId: assist.id,
        assistId: assist.id,
        fieldSlotId: harvestResult.fieldSlotId,
        harvestCount: 1,
        totalRewardGold: harvestResult.rewardGold,
      });

      await this.recordFriendAssistFeed(client, {
        playerId,
        actorPlayerId: request.targetPlayerId,
        counterpartNickname: target.nickname,
        perspective: 'helper',
        requestIdempotencyKey: request.requestIdempotencyKey,
        fallbackRelatedEntityType: 'player_assist_record',
        fallbackRelatedEntityId: assist.id,
        assistId: assist.id,
        fieldSlotId: harvestResult.fieldSlotId,
        harvestCount: 1,
        totalRewardGold: harvestResult.rewardGold,
      });

      await this.bumpInteraction(client, playerId, request.targetPlayerId, assist.intimacyGain);
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
      return { assist, counts, harvestResult, intimacyGain: assist.intimacyGain };
    });

    return {
      app: APP_NAME,
      summary: `采摘到一缕灵田余韵，${formatIntimacyGainClause(result.intimacyGain)}。`,
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
      intimacyGain: result.intimacyGain,
      rewards: [
        { kind: 'gold', quantity: result.harvestResult.rewardGold, label: '閲戝竵' },
      ],
      counts: result.counts,
    };
  }

  async createTeamChallenge(playerId: string, request: ClientTeamChallengeRequest): Promise<ClientTeamChallengeResponse> {
    await this.seasonGuardService.ensureNoSeasonRolloverForAction(playerId);
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
    await this.seasonGuardService.ensureNoSeasonRolloverForAction(playerId);
    return this.updateTeamChallengeStatus(playerId, challengeId, TeamChallengeStatus.ACCEPTED, 'Team challenge accepted.');
  }

  async rejectTeamChallenge(playerId: string, challengeId: string): Promise<ClientTeamChallengeResponse> {
    await this.seasonGuardService.ensureNoSeasonRolloverForAction(playerId);
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

  private assertFriendRequestNotPending(
    existingRelation: PlayerSocialRelation | null,
    reverseRelation: PlayerSocialRelation | null,
  ): void {
    if (existingRelation?.status === SocialRelationStatus.PENDING || reverseRelation?.status === SocialRelationStatus.PENDING) {
      throw this.invalidRequest('好友申请已发送，请等待对方处理。');
    }
  }

  private assertFriendRequestCooldown(
    existingRelation: PlayerSocialRelation | null,
    reverseRelation: PlayerSocialRelation | null,
    now: Date,
  ): void {
    const latestTouchedAt = [existingRelation?.updatedAt, reverseRelation?.updatedAt]
      .filter((value): value is Date => Boolean(value))
      .sort((left, right) => right.getTime() - left.getTime())[0];

    if (!latestTouchedAt) {
      return;
    }

    const nextAllowedAt = new Date(latestTouchedAt.getTime() + FRIEND_REQUEST_COOLDOWN_MS);
    if (nextAllowedAt.getTime() <= now.getTime()) {
      return;
    }

    throw this.invalidRequest(`好友申请过于频繁，${formatFriendRequestCooldownMessage(nextAllowedAt, now)}`);
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
          summary: '你们已经成为好友，可以互相助力灵田了。',
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
          summary: '你们已经成为好友，可以互相助力灵田了。',
          metadataJson: { friendPlayerId: firstPlayerId },
        },
      }),
    ]);
  }

  private async createFriendDeletedFeeds(client: DbClient, actorPlayerId: string, targetPlayerId: string): Promise<void> {
    await Promise.all([
      client.playerSocialFeed.create({
        data: {
          playerId: actorPlayerId,
          actorPlayerId: targetPlayerId,
          feedType: SocialFeedType.FRIEND_DELETED,
          relatedEntityType: 'player',
          relatedEntityId: targetPlayerId,
          summary: '你已解除这段好友关系。',
          metadataJson: { friendPlayerId: targetPlayerId, perspective: 'actor' },
        },
      }),
      client.playerSocialFeed.create({
        data: {
          playerId: targetPlayerId,
          actorPlayerId,
          feedType: SocialFeedType.FRIEND_DELETED,
          relatedEntityType: 'player',
          relatedEntityId: actorPlayerId,
          summary: '对方已解除与你的好友关系。',
          metadataJson: { friendPlayerId: actorPlayerId, perspective: 'target' },
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

  private async assertFollowingCapacity(client: DbClient, playerId: string): Promise<void> {
    const [activeFollowing, limit] = await Promise.all([
      client.playerSocialRelation.count({
        where: {
          playerId,
          relationType: SocialRelationType.FOLLOWING,
          status: SocialRelationStatus.ACTIVE,
        },
      }),
      this.getFollowingLimit(client, playerId),
    ]);

    if (activeFollowing >= limit) {
      throw new BusinessError({
        code: ErrorCode.Conflict,
        message: `关注人数已达上限（${activeFollowing}/${limit}）。后续可通过天机符扩容，但最高不超过 ${SOCIAL_FOLLOW_LIMIT_CONFIG.hardLimit}。`,
        statusCode: 409,
      });
    }
  }

  private async getFollowingLimit(_client: DbClient, _playerId: string): Promise<number> {
    // Future Tianji expansion can add expansion levels here:
    // baseLimit + expansionLevel * expansionStep, capped by hardLimit.
    return SOCIAL_FOLLOW_LIMIT_CONFIG.baseLimit;
  }

  private async assertFriendCapacityForPair(client: DbClient, playerId: string, targetPlayerId: string, checkTarget: boolean): Promise<void> {
    await this.assertFriendCapacity(client, playerId);
    if (checkTarget) {
      await this.assertFriendCapacity(client, targetPlayerId);
    }
  }

  private async assertFriendCapacity(client: DbClient, playerId: string): Promise<void> {
    const [activeFriends, limit] = await Promise.all([
      client.playerSocialRelation.count({
        where: {
          playerId,
          relationType: SocialRelationType.FRIEND,
          status: SocialRelationStatus.ACTIVE,
        },
      }),
      this.getFriendLimit(client, playerId),
    ]);

    if (activeFriends >= limit) {
      throw new BusinessError({
        code: ErrorCode.Conflict,
        message: `好友人数已达上限（${activeFriends}/${limit}）。后续可通过天机符扩容，但最高不超过 ${SOCIAL_FRIEND_LIMIT_CONFIG.hardLimit}。`,
        statusCode: 409,
      });
    }
  }

  private async getFriendLimit(_client: DbClient, _playerId: string): Promise<number> {
    // Future Tianji expansion can add expansion levels here:
    // baseLimit + expansionLevel * expansionStep, capped by hardLimit.
    return SOCIAL_FRIEND_LIMIT_CONFIG.baseLimit;
  }

  private async muteFollowingBetween(client: DbClient, firstPlayerId: string, secondPlayerId: string, now: Date): Promise<void> {
    await Promise.all([
      client.playerSocialRelation.updateMany({
        where: {
          playerId: firstPlayerId,
          targetPlayerId: secondPlayerId,
          relationType: SocialRelationType.FOLLOWING,
          status: { not: SocialRelationStatus.MUTED },
        },
        data: {
          status: SocialRelationStatus.MUTED,
          sourceType: 'friend-accepted:auto-unfollow',
          lastInteractedAt: now,
        },
      }),
      client.playerSocialRelation.updateMany({
        where: {
          playerId: secondPlayerId,
          targetPlayerId: firstPlayerId,
          relationType: SocialRelationType.FOLLOWING,
          status: { not: SocialRelationStatus.MUTED },
        },
        data: {
          status: SocialRelationStatus.MUTED,
          sourceType: 'friend-accepted:auto-unfollow',
          lastInteractedAt: now,
        },
      }),
    ]);
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

  private async calculateDailyFriendIntimacyGain(
    client: DbClient,
    input: { playerId: string; targetPlayerId: string; dateKey: string; requestedGain: number },
  ): Promise<number> {
    const pairKey = buildFriendIntimacyPairKey(input.playerId, input.targetPlayerId);
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pairKey}), hashtext(${input.dateKey}))`;

    const dailyGain = await client.playerAssistRecord.aggregate({
      where: {
        dateKey: input.dateKey,
        targetEntityType: 'field_slot',
        OR: [
          { helperPlayerId: input.playerId, targetPlayerId: input.targetPlayerId },
          { helperPlayerId: input.targetPlayerId, targetPlayerId: input.playerId },
        ],
      },
      _sum: {
        intimacyGain: true,
      },
    });
    const usedGain = dailyGain._sum.intimacyGain ?? 0;
    const remainingGain = Math.max(DAILY_FRIEND_INTIMACY_GAIN_LIMIT - usedGain, 0);

    return Math.min(Math.max(input.requestedGain, 0), remainingGain);
  }

  private async assertDailyAssistCapacity(client: DbClient, helperPlayerId: string, now: Date): Promise<void> {
    const dateKey = getLocalDateKey(now);
    const usedCount = await client.playerAssistRecord.count({
      where: {
        helperPlayerId,
        dateKey,
        assistType: { in: [SocialAssistType.REVIVE_FIELD, SocialAssistType.HARVEST_FIELD] },
      },
    });

    if (usedCount >= DAILY_FRIEND_ASSIST_LIMIT) {
      throw this.invalidRequest('今日好友助力次数已达上限。');
    }
  }

  private async applyReviveFieldAssist(
    client: DbClient,
    input: { helperPlayerId: string; targetPlayerId: string; fieldSlotId?: string; now: Date },
  ): Promise<RevivedFieldResult> {
    const field = input.fieldSlotId
      ? await this.findRevivableFieldById(client, input.targetPlayerId, input.fieldSlotId)
      : await this.findFirstRevivableField(client, input.targetPlayerId);

    if (!field) {
      throw this.invalidRequest('好友当前没有可复活的枯萎田地。');
    }

    const beforeStageEndsAt = field.overripeAt ?? field.readyAt ?? field.matureAt ?? input.now;
    const afterStageEndsAt = new Date(input.now.getTime() + REVIVE_WINDOW_SECONDS * 1000);
    const updatedCount = await client.playerFieldSlot.updateMany({
      where: {
        id: field.id,
        playerId: input.targetPlayerId,
        status: 'WITHERED',
        statusVersion: field.statusVersion,
      },
      data: {
        status: 'MATURE',
        ...buildFieldReadyAtUpdate(input.now),
        overripeAt: afterStageEndsAt,
        lastCalculatedAt: input.now,
        statusVersion: { increment: 1 },
      },
    });

    if (updatedCount.count !== 1) {
      throw this.invalidRequest('该田地状态已变化，请刷新后重试。');
    }

    const updatedField = await client.playerFieldSlot.findUnique({
      where: { id: field.id },
      select: { statusVersion: true },
    });

    return {
      fieldSlotId: field.id,
      status: 'MATURE',
      effectSeconds: REVIVE_WINDOW_SECONDS,
      beforeStageEndsAt,
      afterStageEndsAt,
      fieldVersion: updatedField?.statusVersion ?? field.statusVersion + 1,
    };
  }

  private async findRevivableFieldById(client: DbClient, targetPlayerId: string, fieldSlotId: string): Promise<RevivableField | null> {
    return client.playerFieldSlot.findFirst({
      where: {
        id: fieldSlotId,
        playerId: targetPlayerId,
        isUnlocked: true,
        status: 'WITHERED',
        seedDefinitionId: { not: null },
      },
      orderBy: { slotIndex: 'asc' },
      select: revivableFieldSelect,
    });
  }

  private async findFirstRevivableField(client: DbClient, targetPlayerId: string): Promise<RevivableField | null> {
    return client.playerFieldSlot.findFirst({
      where: {
        playerId: targetPlayerId,
        isUnlocked: true,
        status: 'WITHERED',
        seedDefinitionId: { not: null },
      },
      orderBy: [
        { overripeAt: 'asc' },
        { readyAt: 'asc' },
        { slotIndex: 'asc' },
      ],
      select: revivableFieldSelect,
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

  private mapFriendVisitField(
    field: FriendFieldVisitSlot,
    now: Date,
    harvestedThisCycle: boolean,
  ): ClientSocialFriendFieldVisitField {
    const status = field.status as ClientSocialFriendFieldVisitField['status'];
    const canRevive = field.isUnlocked && field.status === 'WITHERED' && Boolean(field.seedDefinition);
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
      canRevive,
      canHarvest,
      nextAction: canHarvest ? 'harvest' : canRevive ? 'revive' : null,
      unavailableReason: canRevive || canHarvest ? null : getFriendFieldUnavailableReason(field),
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
      friendLimit: await this.getFriendLimit(client, playerId),
      friendMaxLimit: SOCIAL_FRIEND_LIMIT_CONFIG.hardLimit,
      following,
      followingLimit: await this.getFollowingLimit(client, playerId),
      followingMaxLimit: SOCIAL_FOLLOW_LIMIT_CONFIG.hardLimit,
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

    for (const targetPlayerId of uniqueTargetPlayerIds) {
      await this.fieldLifecycleService.settlePlayerFields(client, targetPlayerId);
    }

    const fields = await client.playerFieldSlot.findMany({
      where: {
        playerId: { in: uniqueTargetPlayerIds },
        isUnlocked: true,
        status: { in: ['WITHERED', 'MATURE'] },
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
    const harvestedRecords: Array<{ targetEntityId: string | null }> = await (matureFields.length > 0
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
        : []);
    const harvestedFieldIds = new Set(harvestedRecords.map((record) => record.targetEntityId).filter((id): id is string => typeof id === 'string'));
    const summaryByPlayerId = new Map<string, ClientSocialRelationItem['assistSummary']>();

    for (const targetPlayerId of uniqueTargetPlayerIds) {
      summaryByPlayerId.set(targetPlayerId, { revivableCount: 0, harvestableCount: 0, availableCount: 0 });
    }

    for (const field of fields) {
      const summary = summaryByPlayerId.get(field.playerId);
      if (!summary) {
        continue;
      }
      if (field.status === 'WITHERED') {
        summary.revivableCount += 1;
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

  private buildFeedActions(
    feedType: SocialFeedType,
    targetPlayerId?: string,
    relatedEntityId?: string,
  ): ClientSocialFeedItem['actions'] {
    if (feedType === SocialFeedType.FRIEND_REQUESTED) {
      return [
        { label: '同意', action: 'accept_friend', targetPlayerId, relatedEntityId },
        { label: '拒绝', action: 'reject_friend', targetPlayerId, relatedEntityId },
      ];
    }
    if (feedType === SocialFeedType.FRIEND_WATERED_FIELD || feedType === SocialFeedType.FRIEND_REVIVED_FIELD) {
      return [];
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
    return [];
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

  private async recordFriendAssistFeed(
    client: DbClient,
    input: {
      playerId: string;
      actorPlayerId: string;
      counterpartNickname: string;
      perspective: 'target' | 'helper';
      requestIdempotencyKey?: string;
      fallbackRelatedEntityType: string;
      fallbackRelatedEntityId: string;
      assistId: string;
      fieldSlotId: string;
      reviveCount?: number;
      harvestCount?: number;
      totalRewardGold?: number;
      totalEffectSeconds?: number;
    },
  ): Promise<void> {
    const assistBatchKey = extractSocialAssistBatchKey(input.requestIdempotencyKey);
    const nextMetadata = this.mergeSocialAssistFeedMetadata(null, {
      assistBatchKey,
      perspective: input.perspective,
      assistId: input.assistId,
      fieldSlotId: input.fieldSlotId,
      reviveCount: input.reviveCount ?? 0,
      harvestCount: input.harvestCount ?? 0,
      totalRewardGold: input.totalRewardGold ?? 0,
      totalEffectSeconds: input.totalEffectSeconds ?? 0,
    });

    if (!assistBatchKey) {
      await client.playerSocialFeed.create({
        data: {
          playerId: input.playerId,
          actorPlayerId: input.actorPlayerId,
          feedType: this.resolveFriendAssistFeedType(nextMetadata),
          relatedEntityType: input.fallbackRelatedEntityType,
          relatedEntityId: input.fallbackRelatedEntityId,
          summary: buildFriendAssistFeedSummary(input.perspective, input.counterpartNickname, nextMetadata),
          metadataJson: nextMetadata as Prisma.InputJsonValue,
        },
      });
      return;
    }

    const existingFeed = await client.playerSocialFeed.findFirst({
      where: {
        playerId: input.playerId,
        actorPlayerId: input.actorPlayerId,
        relatedEntityType: 'social_assist_batch',
        relatedEntityId: assistBatchKey,
      },
      select: {
        id: true,
        metadataJson: true,
      },
    });

    if (!existingFeed) {
      await client.playerSocialFeed.create({
        data: {
          playerId: input.playerId,
          actorPlayerId: input.actorPlayerId,
          feedType: this.resolveFriendAssistFeedType(nextMetadata),
          relatedEntityType: 'social_assist_batch',
          relatedEntityId: assistBatchKey,
          summary: buildFriendAssistFeedSummary(input.perspective, input.counterpartNickname, nextMetadata),
          metadataJson: nextMetadata as Prisma.InputJsonValue,
        },
      });
      return;
    }

    const mergedMetadata = this.mergeSocialAssistFeedMetadata(existingFeed.metadataJson, {
      assistBatchKey,
      perspective: input.perspective,
      assistId: input.assistId,
      fieldSlotId: input.fieldSlotId,
      reviveCount: input.reviveCount ?? 0,
      harvestCount: input.harvestCount ?? 0,
      totalRewardGold: input.totalRewardGold ?? 0,
      totalEffectSeconds: input.totalEffectSeconds ?? 0,
    });

    await client.playerSocialFeed.update({
      where: { id: existingFeed.id },
      data: {
        feedType: this.resolveFriendAssistFeedType(mergedMetadata),
        summary: buildFriendAssistFeedSummary(input.perspective, input.counterpartNickname, mergedMetadata),
        metadataJson: mergedMetadata as Prisma.InputJsonValue,
      },
    });
  }

  private mergeSocialAssistFeedMetadata(
    current: unknown,
    delta: {
      assistBatchKey: string | null;
      perspective: 'target' | 'helper';
      assistId: string;
      fieldSlotId: string;
      reviveCount: number;
      harvestCount: number;
      totalRewardGold: number;
      totalEffectSeconds: number;
    },
  ): SocialAssistFeedMetadata {
    const currentMetadata = asSocialAssistFeedMetadata(current);
    return {
      assistBatchKey: delta.assistBatchKey ?? currentMetadata.assistBatchKey,
      perspective: delta.perspective ?? currentMetadata.perspective,
      assistIds: appendUniqueValue(currentMetadata.assistIds, delta.assistId),
      reviveCount: (currentMetadata.reviveCount ?? 0) + delta.reviveCount,
      harvestCount: (currentMetadata.harvestCount ?? 0) + delta.harvestCount,
      totalRewardGold: (currentMetadata.totalRewardGold ?? 0) + delta.totalRewardGold,
      totalEffectSeconds: (currentMetadata.totalEffectSeconds ?? 0) + delta.totalEffectSeconds,
      fieldSlotIds: appendUniqueValue(currentMetadata.fieldSlotIds, delta.fieldSlotId),
    };
  }

  private resolveFriendAssistFeedType(metadata: SocialAssistFeedMetadata): 'FRIEND_WATERED_FIELD' | 'FRIEND_REVIVED_FIELD' {
    return (metadata.harvestCount ?? 0) > 0
      ? SocialFeedType.FRIEND_WATERED_FIELD
      : SocialFeedType.FRIEND_REVIVED_FIELD;
  }

  private mapTeamChallengeStatus(status: TeamChallengeStatus): ClientTeamChallengeItem['status'] {
    return status.toLowerCase() as ClientTeamChallengeItem['status'];
  }

  private invalidRequest(message: string): BusinessError {
    return new BusinessError({ code: ErrorCode.BadRequest, message, statusCode: 400 });
  }
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
    return null;
  }
  if (field.status === 'GROWING') {
    return '作物仍在成长中，当前不可助力';
  }

  return '当前不可助力';
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

function formatIntimacyGainClause(intimacyGain: number): string {
  if (intimacyGain > 0) {
    return `亲密度 +${intimacyGain}`;
  }

  return '今日亲密度已达上限';
}

function buildFriendIntimacyPairKey(playerId: string, targetPlayerId: string): string {
  return [playerId, targetPlayerId].sort().join(':');
}

function formatFriendRequestCooldownMessage(nextAllowedAt: Date, now: Date): string {
  const remainingMs = Math.max(nextAllowedAt.getTime() - now.getTime(), 0);
  const oneDayMs = 24 * 60 * 60 * 1000;
  const clockToleranceMs = 60 * 1000;
  if (remainingMs >= oneDayMs) {
    const remainingDays = Math.max(1, Math.ceil((remainingMs - clockToleranceMs) / oneDayMs));
    return `请 ${remainingDays} 天后再试。`;
  }

  return '请稍后再试。';
}

function extractSocialAssistBatchKey(requestIdempotencyKey?: string | null): string | null {
  const normalizedKey = requestIdempotencyKey?.trim();
  if (!normalizedKey || !normalizedKey.startsWith('social-assist-batch-')) {
    return null;
  }

  const separatorIndex = normalizedKey.indexOf(':');
  return separatorIndex >= 0 ? normalizedKey.slice(0, separatorIndex) : normalizedKey;
}

function appendUniqueValue(values: string[] | undefined, nextValue: string): string[] {
  if (!values || values.length === 0) {
    return [nextValue];
  }
  if (values.includes(nextValue)) {
    return values;
  }
  return [...values, nextValue];
}

function asSocialAssistFeedMetadata(value: unknown): SocialAssistFeedMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  return {
    assistBatchKey: typeof record.assistBatchKey === 'string' ? record.assistBatchKey : undefined,
    perspective: record.perspective === 'target' || record.perspective === 'helper' ? record.perspective : undefined,
    assistIds: toStringArray(record.assistIds),
    reviveCount: toNumberOrUndefined(record.reviveCount),
    harvestCount: toNumberOrUndefined(record.harvestCount),
    totalRewardGold: toNumberOrUndefined(record.totalRewardGold),
    totalEffectSeconds: toNumberOrUndefined(record.totalEffectSeconds),
    fieldSlotIds: toStringArray(record.fieldSlotIds),
  };
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function toNumberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function buildFriendAssistFeedSummary(
  perspective: 'target' | 'helper',
  counterpartNickname: string,
  metadata: SocialAssistFeedMetadata,
): string {
  const reviveCount = metadata.reviveCount ?? 0;
  const harvestCount = metadata.harvestCount ?? 0;
  const summaryParts: string[] = [];

  if (reviveCount > 0) {
    summaryParts.push(`复活 ${reviveCount} 块枯萎田`);
  }
  if (harvestCount > 0) {
    summaryParts.push(`收取 ${harvestCount} 块成熟田`);
  }

  if (summaryParts.length === 0) {
    return perspective === 'target'
      ? `${counterpartNickname} 帮你回浇了灵田。`
      : `你帮 ${counterpartNickname} 回浇了灵田。`;
  }

  if (perspective === 'target') {
    const suffix = harvestCount > 0 ? '，采摘不会影响你的收成。' : '。';
    return `${counterpartNickname} 帮你回浇了灵田，${summaryParts.join('，')}${suffix}`;
  }

  return `你帮 ${counterpartNickname} 回浇了灵田，${summaryParts.join('，')}。`;
}



