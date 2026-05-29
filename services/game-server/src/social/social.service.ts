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
import { getSeedStageSeconds } from '../lib/game-balance.js';
import { PrismaService } from '../prisma/prisma.service.js';

const SOCIAL_PAGE_SIZE = 30;
const DAILY_WATER_LIMIT = 5;
const DAILY_TARGET_WATER_LIMIT = 3;
const WATER_REMAINING_RATIO = 0.4;
const WATER_MIN_EFFECT_SECONDS = 10 * 60;
const WATER_MAX_EFFECT_SECONDS = 60 * 60;
const TEAM_CHALLENGE_EXPIRES_MS = 2 * 60 * 60 * 1000;

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

const waterableFieldSelect = {
  id: true,
  status: true,
  seedAt: true,
  matureAt: true,
  fullMatureAt: true,
  lastCalculatedAt: true,
  seedDefinition: {
    select: {
      seedId: true,
    },
  },
} satisfies Prisma.PlayerFieldSlotSelect;

type WaterableField = Prisma.PlayerFieldSlotGetPayload<{ select: typeof waterableFieldSelect }>;

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
    const player = await this.assertPlayerExists(this.prisma.db, playerId);
    const safePage = Math.max(Math.floor(page), 1);
    const where: Prisma.PlayerSocialRelationWhereInput = {
      playerId,
      relationType,
      status: { not: SocialRelationStatus.MUTED },
    };
    if (relationType === SocialRelationType.FRIEND) {
      where.targetPlayer = { factionId: player.factionId };
    }
    const [total, relations] = await Promise.all([
      this.prisma.db.playerSocialRelation.count({ where }),
      this.prisma.db.playerSocialRelation.findMany({
        where,
        orderBy: [{ lastInteractedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (safePage - 1) * SOCIAL_PAGE_SIZE,
        take: SOCIAL_PAGE_SIZE,
        include: { targetPlayer: this.playerSummaryInclude() },
      }),
    ]);

    return {
      app: APP_NAME,
      items: relations.map((relation) => this.mapRelation(relation)),
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
      const helper = await this.assertPlayerExists(client, playerId);
      const target = await this.assertPlayerExists(client, request.targetPlayerId);

      if (playerId === request.targetPlayerId) {
        throw this.invalidRequest('Cannot assist your own field.');
      }
      this.assertSameFactionForFriend(playerId, request.targetPlayerId, helper, target);
      await this.assertActiveFriendRelation(client, playerId, request.targetPlayerId);

      const dateKey = getLocalDateKey();
      const used = await client.playerAssistRecord.count({
        where: { helperPlayerId: playerId, dateKey, assistType: SocialAssistType.WATER_FIELD },
      });

      if (used >= DAILY_WATER_LIMIT) {
        throw this.invalidRequest('Daily water assist limit reached.');
      }

      const targetWateredToday = await client.playerAssistRecord.count({
        where: { targetPlayerId: request.targetPlayerId, dateKey, assistType: SocialAssistType.WATER_FIELD },
      });

      if (targetWateredToday >= DAILY_TARGET_WATER_LIMIT) {
        throw this.invalidRequest('Target player has reached today water assist limit.');
      }

      const wateredField = await this.applyWaterFieldAssist(client, {
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

      await this.bumpInteraction(client, playerId, request.targetPlayerId);
      const counts = await this.getCounts(client, playerId);
      return { assist, counts, wateredField };
    });

    return {
      app: APP_NAME,
      summary: `Water assist applied. Shortened by ${formatDuration(result.wateredField.shortenedSeconds)}.`,
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
      throw this.invalidRequest(`Players ${playerId} and ${targetPlayerId} are in different factions and cannot become friends or water each other.`);
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

  private async bumpInteraction(client: DbClient, playerId: string, targetPlayerId: string): Promise<void> {
    await client.playerSocialRelation.updateMany({
      where: {
        playerId,
        targetPlayerId,
        relationType: { in: [SocialRelationType.FRIEND, SocialRelationType.FOLLOWING] },
      },
      data: {
        intimacy: { increment: 5 },
        lastInteractedAt: new Date(),
      },
    });
  }

  private async applyWaterFieldAssist(
    client: DbClient,
    input: { targetPlayerId: string; fieldSlotId?: string; now: Date },
  ): Promise<WateredFieldResult> {
    const field = input.fieldSlotId
      ? await this.findWaterableFieldById(client, input.targetPlayerId, input.fieldSlotId)
      : await this.findFirstWaterableField(client, input.targetPlayerId);

    if (!field) {
      throw this.invalidRequest('No waterable field is available.');
    }

    const stageStartedAt = getWaterableStageStartedAt(field, input.now);
    const currentStageEndsAt = getWaterableStageEndsAt(field, stageStartedAt);

    if (currentStageEndsAt.getTime() <= input.now.getTime()) {
      throw this.invalidRequest('Field is ready to settle and cannot be watered.');
    }

    const repeatedAssist = await client.playerAssistRecord.findFirst({
      where: {
        targetPlayerId: input.targetPlayerId,
        assistType: SocialAssistType.WATER_FIELD,
        targetEntityType: 'field_slot',
        targetEntityId: field.id,
        createdAt: { gte: stageStartedAt },
      },
      select: { id: true },
    });

    if (repeatedAssist) {
      throw this.invalidRequest('This field has already been watered in the current growth cycle.');
    }

    const remainingSeconds = Math.ceil((currentStageEndsAt.getTime() - input.now.getTime()) / 1000);
    const shortenedSeconds = Math.min(
      Math.max(Math.floor(remainingSeconds * WATER_REMAINING_RATIO), WATER_MIN_EFFECT_SECONDS),
      WATER_MAX_EFFECT_SECONDS,
      remainingSeconds,
    );
    const afterStageEndsAt = new Date(currentStageEndsAt.getTime() - shortenedSeconds * 1000);
    const updateData = field.status === 'SEEDED'
      ? { matureAt: afterStageEndsAt, statusVersion: { increment: 1 } }
      : { fullMatureAt: afterStageEndsAt, statusVersion: { increment: 1 } };
    const updated = await client.playerFieldSlot.update({
      where: { id: field.id },
      data: {
        ...updateData,
        lastCalculatedAt: input.now,
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
        status: { in: ['SEEDED', 'GROWING'] },
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
        status: { in: ['SEEDED', 'GROWING'] },
        seedDefinitionId: { not: null },
      },
      orderBy: [
        { fullMatureAt: 'asc' },
        { matureAt: 'asc' },
        { slotIndex: 'asc' },
      ],
      select: waterableFieldSelect,
    });
  }

  private async getCounts(client: DbClient, playerId: string): Promise<ClientSocialSummaryResponse['counts']> {
    const dateKey = getLocalDateKey();
    const [feedUnread, friends, following, enemies, pendingTeamChallenges, todayWaterUsed] = await Promise.all([
      client.playerSocialFeed.count({ where: { playerId, isRead: false } }),
      client.playerSocialRelation.count({ where: { playerId, relationType: SocialRelationType.FRIEND, status: SocialRelationStatus.ACTIVE } }),
      client.playerSocialRelation.count({ where: { playerId, relationType: SocialRelationType.FOLLOWING, status: SocialRelationStatus.ACTIVE } }),
      client.playerSocialRelation.count({ where: { playerId, relationType: SocialRelationType.ENEMY, status: SocialRelationStatus.ACTIVE } }),
      client.teamChallenge.count({ where: { allyPlayerId: playerId, status: TeamChallengeStatus.PENDING, expiresAt: { gt: new Date() } } }),
      client.playerAssistRecord.count({ where: { helperPlayerId: playerId, dateKey, assistType: SocialAssistType.WATER_FIELD } }),
    ]);

    return {
      feedUnread,
      friends,
      following,
      enemies,
      pendingTeamChallenges,
      todayWaterUsed,
      todayWaterLimit: DAILY_WATER_LIMIT,
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

  private mapRelation(relation: RelationWithTarget): ClientSocialRelationItem {
    return {
      id: relation.id,
      relationType: this.mapRelationType(relation.relationType),
      status: this.mapRelationStatus(relation.status),
      sourceType: relation.sourceType,
      intimacy: relation.intimacy,
      lastInteractedAt: relation.lastInteractedAt?.toISOString() ?? null,
      createdAt: relation.createdAt.toISOString(),
      target: this.mapPlayer(relation.targetPlayer),
    };
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
  if (field.status === 'SEEDED') {
    return field.seedAt ?? field.lastCalculatedAt ?? now;
  }

  return field.matureAt ?? field.seedAt ?? field.lastCalculatedAt ?? now;
}

function getWaterableStageEndsAt(field: WaterableField, stageStartedAt: Date): Date {
  if (field.status === 'SEEDED') {
    return field.matureAt ?? addSeconds(stageStartedAt, getSeedStageSeconds(field.seedDefinition?.seedId ?? '', 'seeded'));
  }

  return field.fullMatureAt ?? addSeconds(stageStartedAt, getSeedStageSeconds(field.seedDefinition?.seedId ?? '', 'growing'));
}

function addSeconds(source: Date, seconds: number): Date {
  return new Date(source.getTime() + Math.max(Math.floor(seconds), 0) * 1000);
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
