import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  AdminDeletePlayerResponse,
  AdminListResponse,
  AdminOverviewResponse,
  AdminPlayerOverviewResponse,
  AdminPlayerSearchResponse,
  AdminRaidOrderDetailResponse,
  AdminSystemStatusResponse,
} from '@trinitywar/shared';
import { APP_NAME, DOCS_ROUTE, formatSeasonLabel } from '@trinitywar/shared';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { GAME_DESIGN_CONFIG } from '../lib/game-balance.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SeasonService } from '../season/season.service.js';
import { TaskConfigService, type TaskConfigGroup } from '../task-config/task-config.service.js';

interface PagingQuery {
  page?: string;
  pageSize?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class AdminReadonlyService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SeasonService) private readonly seasonService: SeasonService,
    @Inject(TaskConfigService) private readonly taskConfigService: TaskConfigService,
  ) {}

  async getOverview(): Promise<AdminOverviewResponse> {
    const readonlyModules = [
      'system-status',
      'player-search',
      'player-overview',
      'wallet-logs',
      'building-logs',
      'field-logs',
      'player-orders',
      'raid-order-detail',
      'castle-level-config',
      'share-assist-readonly',
      'season-readonly',
    ];
    const configWriteModules = [
      'seed-config-write',
      'spirit-config-write',
      'task-config-write',
    ];
    const notificationWriteModules = [
      'notification-history',
      'notification-global-write',
      'notification-player-write',
    ];
    const dangerousWriteModules = [
      'player-delete',
      'seed-delete',
      'spirit-delete',
    ];

    return {
      app: APP_NAME,
      docs: DOCS_ROUTE,
      modules: [
        ...readonlyModules,
        ...configWriteModules,
        ...notificationWriteModules,
        ...dangerousWriteModules,
      ],
      adminCapabilities: {
        readonly: readonlyModules,
        configWrite: configWriteModules,
        notificationWrite: notificationWriteModules,
        dangerousWrite: dangerousWriteModules,
        auth: {
          readHeader: 'x-admin-debug-key',
          writeHeader: 'x-admin-write-debug-key',
          writeHeaderRequiredInProduction: true,
        },
      },
    };
  }

  async getCurrentSeasonAdmin(): Promise<Record<string, unknown>> {
    const computed = this.seasonService.getCurrentSeason();
    const persisted = await this.prisma.db.gameSeason.findUnique({
      where: { seasonNumber: computed.seasonNumber },
    });
    const [playerStateCount, pendingResetCount] = await Promise.all([
      this.prisma.db.playerSeasonState.count({
        where: { currentSeasonNumber: computed.seasonNumber },
      }),
      this.prisma.db.playerSeasonState.count({
        where: { lastResetSeasonNumber: { lt: computed.seasonNumber } },
      }),
    ]);

    return normalizeDates({
      seasonNumber: computed.seasonNumber,
      currentWeek: computed.currentWeek,
      totalWeeks: computed.totalWeeks,
      startsAt: computed.startsAt,
      endsAt: computed.endsAt,
      persisted: Boolean(persisted),
      persistedStartsAt: persisted?.startsAt ?? null,
      persistedEndsAt: persisted?.endsAt ?? null,
      playerStateCount,
      pendingResetCount,
    });
  }

  async listSeasons(query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const computed = this.seasonService.getCurrentSeason();
    const [items, total] = await Promise.all([
      this.prisma.db.gameSeason.findMany({
        orderBy: { seasonNumber: 'desc' },
        skip,
        take,
      }),
      this.prisma.db.gameSeason.count(),
    ]);

    return {
      items: items.map((item) => normalizeDates({
        seasonNumber: item.seasonNumber,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        isCurrent: item.seasonNumber === computed.seasonNumber,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      pagination: { page, pageSize, total },
    };
  }

  async getPlayerSeasonState(playerId: string): Promise<Record<string, unknown>> {
    const normalizedPlayerId = playerId.trim();
    if (!normalizedPlayerId) {
      throwBadRequest('playerId is required.');
    }

    const player = await this.prisma.db.player.findUnique({
      where: { id: normalizedPlayerId },
      select: {
        id: true,
        nickname: true,
        faction: { select: { code: true, name: true } },
        factionMembers: {
          select: {
            contributionScore: true,
            faction: { select: { code: true, name: true } },
          },
          take: 5,
        },
        seasonStates: true,
      },
    });

    if (!player) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Player not found.',
        statusCode: 404,
      });
    }

    const computed = this.seasonService.getCurrentSeason();
    const state = player.seasonStates[0] ?? null;
    const contribution = player.factionMembers[0]?.contributionScore ?? 0;

    return normalizeDates({
      playerId: player.id,
      nickname: player.nickname,
      factionCode: player.faction?.code ?? player.factionMembers[0]?.faction.code ?? null,
      factionName: player.faction?.name ?? player.factionMembers[0]?.faction.name ?? null,
      currentSeasonNumber: computed.seasonNumber,
      currentWeek: computed.currentWeek,
      totalWeeks: computed.totalWeeks,
      seasonStartsAt: computed.startsAt,
      seasonEndsAt: computed.endsAt,
      trackedCurrentSeasonNumber: state?.currentSeasonNumber ?? null,
      lastResetSeasonNumber: state?.lastResetSeasonNumber ?? null,
      needsReset: (state?.lastResetSeasonNumber ?? computed.seasonNumber) < computed.seasonNumber,
      contributionScore: contribution,
      stateCreatedAt: state?.createdAt ?? null,
      stateUpdatedAt: state?.updatedAt ?? null,
    });
  }

  async listPlayerSeasonSnapshots(
    seasonNumber: number,
    query: Record<string, string | undefined>,
  ): Promise<AdminListResponse<Record<string, unknown>>> {
    const normalizedSeasonNumber = normalizeSeasonNumber(seasonNumber);
    const { page, pageSize, skip, take } = parsePagination(query);
    const where: Prisma.PlayerSeasonSnapshotWhereInput = { seasonNumber: normalizedSeasonNumber };
    if (query.playerId?.trim()) {
      where.playerId = query.playerId.trim();
    }
    if (query.factionId?.trim()) {
      where.factionId = query.factionId.trim();
    }

    const [items, total] = await Promise.all([
      this.prisma.db.playerSeasonSnapshot.findMany({
        where,
        orderBy: [{ contributionScore: 'desc' }, { playerId: 'asc' }],
        skip,
        take,
        include: {
          player: { select: { nickname: true } },
          faction: { select: { code: true, name: true } },
        },
      }),
      this.prisma.db.playerSeasonSnapshot.count({ where }),
    ]);

    return {
      items: items.map((item) => normalizeDates({
        id: item.id,
        playerId: item.playerId,
        nickname: item.player.nickname,
        seasonNumber: item.seasonNumber,
        factionId: item.factionId,
        factionCode: item.faction?.code ?? null,
        factionName: item.faction?.name ?? null,
        contributionScore: item.contributionScore,
        signInDays: item.signInDays,
        loginDays: item.loginDays,
        harvestCount: item.harvestCount,
        raidCount: item.raidCount,
        finalRank: item.finalRank,
        rewardTier: item.rewardTier,
        snapshotJson: item.snapshotJson,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      pagination: { page, pageSize, total },
    };
  }

  async listFactionSeasonSnapshots(
    seasonNumber: number,
    query: Record<string, string | undefined>,
  ): Promise<AdminListResponse<Record<string, unknown>>> {
    const normalizedSeasonNumber = normalizeSeasonNumber(seasonNumber);
    const { page, pageSize, skip, take } = parsePagination(query);
    const [items, total] = await Promise.all([
      this.prisma.db.factionSeasonSnapshot.findMany({
        where: { seasonNumber: normalizedSeasonNumber },
        orderBy: [{ contributionScore: 'desc' }, { factionId: 'asc' }],
        skip,
        take,
        include: {
          faction: { select: { code: true, name: true } },
        },
      }),
      this.prisma.db.factionSeasonSnapshot.count({ where: { seasonNumber: normalizedSeasonNumber } }),
    ]);

    return {
      items: items.map((item) => normalizeDates({
        id: item.id,
        factionId: item.factionId,
        factionCode: item.faction.code,
        factionName: item.faction.name,
        seasonNumber: item.seasonNumber,
        contributionScore: item.contributionScore,
        memberCount: item.memberCount,
        finalRank: item.finalRank,
        snapshotJson: item.snapshotJson,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      pagination: { page, pageSize, total },
    };
  }

  async listPlayerSeasonHistory(
    playerId: string,
    query: Record<string, string | undefined>,
  ): Promise<AdminListResponse<Record<string, unknown>>> {
    const normalizedPlayerId = playerId.trim();
    if (!normalizedPlayerId) {
      throwBadRequest('playerId is required.');
    }
    const { page, pageSize, skip, take } = parsePagination(query);
    const where: Prisma.PlayerSeasonSnapshotWhereInput = { playerId: normalizedPlayerId };

    const [items, total] = await Promise.all([
      this.prisma.db.playerSeasonSnapshot.findMany({
        where,
        orderBy: { seasonNumber: 'desc' },
        skip,
        take,
        include: {
          faction: { select: { code: true, name: true } },
        },
      }),
      this.prisma.db.playerSeasonSnapshot.count({ where }),
    ]);

    return {
      items: items.map((item) => normalizeDates({
        id: item.id,
        playerId: item.playerId,
        seasonNumber: item.seasonNumber,
        factionId: item.factionId,
        factionCode: item.faction?.code ?? null,
        factionName: item.faction?.name ?? null,
        contributionScore: item.contributionScore,
        signInDays: item.signInDays,
        loginDays: item.loginDays,
        harvestCount: item.harvestCount,
        raidCount: item.raidCount,
        finalRank: item.finalRank,
        rewardTier: item.rewardTier,
        snapshotJson: item.snapshotJson,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      pagination: { page, pageSize, total },
    };
  }

  async listPlayerSeasonRewardHistory(
    playerId: string,
    query: Record<string, string | undefined>,
  ): Promise<AdminListResponse<Record<string, unknown>>> {
    const normalizedPlayerId = playerId.trim();
    if (!normalizedPlayerId) {
      throwBadRequest('playerId is required.');
    }

    const { page, pageSize, skip, take } = parsePagination(query);
    const where: Prisma.PlayerSeasonRewardGrantWhereInput = { playerId: normalizedPlayerId };
    if (query.seasonNumber?.trim()) {
      where.seasonNumber = normalizeSeasonNumber(Number(query.seasonNumber));
    }
    if (query.rewardType?.trim()) {
      where.rewardType = query.rewardType.trim();
    }
    if (query.status?.trim()) {
      where.status = query.status.trim();
    }

    const [items, total] = await Promise.all([
      this.prisma.db.playerSeasonRewardGrant.findMany({
        where,
        orderBy: [{ seasonNumber: 'desc' }, { createdAt: 'desc' }, { rewardType: 'asc' }],
        skip,
        take,
        include: {
          player: { select: { nickname: true } },
          notification: {
            select: {
              id: true,
              titleSnapshot: true,
              bodySnapshot: true,
              claimStatus: true,
              attachmentJson: true,
              expiresAt: true,
              readAt: true,
              claimedAt: true,
              deletedAt: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          achievements: {
            orderBy: [{ domain: 'asc' }, { achievementKey: 'asc' }],
            include: {
              rewardGrant: { select: { rewardType: true, rewardTier: true, status: true, notificationId: true } },
            },
          },
        },
      }),
      this.prisma.db.playerSeasonRewardGrant.count({ where }),
    ]);

    return {
      items: items.map((item) => {
        const achievements = item.achievements.map((achievement) => {
          const statSnapshot = normalizeAdminJsonObject(achievement.statSnapshotJson);
          const displayCopy = this.seasonService.getSeasonMedalDisplayCopy({
            achievementKey: achievement.achievementKey,
            title: achievement.title,
            description: achievement.description,
            statSnapshot,
          });

          return normalizeDates({
            id: achievement.id,
            playerId: achievement.playerId,
            seasonNumber: achievement.seasonNumber,
            seasonLabel: formatSeasonLabel(achievement.seasonNumber),
            domain: achievement.domain,
            achievementKey: achievement.achievementKey,
            title: displayCopy.title,
            description: displayCopy.description,
            contributionSnapshot: achievement.contributionSnapshot,
            statSnapshotJson: statSnapshot,
            rewardGrantId: achievement.rewardGrantId,
            rewardType: achievement.rewardGrant?.rewardType ?? null,
            rewardTier: achievement.rewardGrant?.rewardTier ?? null,
            rewardStatus: achievement.rewardGrant?.status ?? null,
            notificationId: achievement.rewardGrant?.notificationId ?? null,
            clientVisible: isVisibleAdminSeasonAchievement(achievement),
            createdAt: achievement.createdAt,
            updatedAt: achievement.updatedAt,
          });
        });

        return normalizeDates({
          id: item.id,
          playerId: item.playerId,
          nickname: item.player.nickname,
          seasonNumber: item.seasonNumber,
          seasonLabel: formatSeasonLabel(item.seasonNumber),
          rewardType: item.rewardType,
          rewardTypeLabel: formatSeasonRewardTypeLabel(item.rewardType),
          rewardTier: item.rewardTier,
          status: item.status,
          notificationId: item.notificationId,
          notificationTitle: item.notification?.titleSnapshot ?? null,
          notificationBody: item.notification?.bodySnapshot ?? null,
          notificationClaimStatus: item.notification?.claimStatus ?? null,
          notificationAttachmentJson: item.notification?.attachmentJson ?? null,
          notificationCreatedAt: item.notification?.createdAt ?? null,
          notificationUpdatedAt: item.notification?.updatedAt ?? null,
          notificationReadAt: item.notification?.readAt ?? null,
          notificationClaimedAt: item.notification?.claimedAt ?? null,
          notificationDeletedAt: item.notification?.deletedAt ?? null,
          expiresAt: item.notification?.expiresAt ?? null,
          contributionSnapshot: item.contributionSnapshot,
          signInDays: item.signInDays,
          loginDays: item.loginDays,
          harvestCount: item.harvestCount,
          raidCount: item.raidCount,
          rewardJson: item.rewardJson,
          rewardSummary: formatRuleRewards(item.rewardJson),
          achievementCount: achievements.length,
          achievementKeys: achievements.map((achievement) => achievement['achievementKey']),
          achievementTitles: achievements.map((achievement) => achievement['title']),
          visibleAchievementTitles: achievements
            .filter((achievement) => achievement['clientVisible'])
            .map((achievement) => achievement['title']),
          achievements,
          claimedAt: item.claimedAt,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        });
      }),
      pagination: { page, pageSize, total },
    };
  }

  async getSeasonRewardPreview(
    seasonNumber: number,
    query: Record<string, string | undefined>,
  ): Promise<Record<string, unknown>> {
    const normalizedSeasonNumber = normalizeSeasonNumber(seasonNumber);
    const normalizedPlayerId = query.playerId?.trim() ?? '';
    if (!normalizedPlayerId) {
      throwBadRequest('playerId is required.');
    }

    const player = await this.prisma.db.player.findUnique({
      where: { id: normalizedPlayerId },
      select: {
        id: true,
        nickname: true,
        faction: { select: { code: true, name: true } },
      },
    });
    if (!player) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Player not found.',
        statusCode: 404,
      });
    }

    const [snapshot, existingGrants, existingAchievements] = await Promise.all([
      this.prisma.db.playerSeasonSnapshot.findUnique({
        where: {
          playerId_seasonNumber: {
            playerId: normalizedPlayerId,
            seasonNumber: normalizedSeasonNumber,
          },
        },
        include: {
          faction: { select: { code: true, name: true } },
        },
      }),
      this.prisma.db.playerSeasonRewardGrant.findMany({
        where: { playerId: normalizedPlayerId, seasonNumber: normalizedSeasonNumber },
        orderBy: [{ rewardType: 'asc' }, { createdAt: 'desc' }],
        include: {
          notification: { select: { id: true, claimStatus: true, claimedAt: true, expiresAt: true, readAt: true, deletedAt: true } },
          _count: { select: { achievements: true } },
        },
      }),
      this.prisma.db.playerSeasonAchievement.findMany({
        where: { playerId: normalizedPlayerId, seasonNumber: normalizedSeasonNumber },
        orderBy: [{ domain: 'asc' }, { achievementKey: 'asc' }],
        include: {
          rewardGrant: { select: { rewardType: true, rewardTier: true, status: true, notificationId: true } },
        },
      }),
    ]);

    const grantsByRewardType = new Map(existingGrants.map((grant) => [grant.rewardType, grant]));
    const achievementsByKey = new Map(existingAchievements.map((achievement) => [achievement.achievementKey, achievement]));
    const previewRules = snapshot
      ? this.seasonService.previewSeasonRewardRules(snapshot).map((rule) => {
          const existingGrant = grantsByRewardType.get(rule.rewardType) ?? null;
          const existingAchievement = rule.achievementKey ? achievementsByKey.get(rule.achievementKey) ?? null : null;
          return normalizeDates({
            rewardType: rule.rewardType,
            rewardTypeLabel: rule.rewardTypeLabel,
            rewardTier: rule.rewardTier,
            domain: rule.domain,
            achievementKey: rule.achievementKey,
            achievementTitle: rule.achievementTitle,
            achievementDescription: rule.achievementDescription,
            statSnapshot: rule.statSnapshot,
            rewards: rule.rewards,
            rewardSummary: formatRuleRewards(rule.rewards),
            existingGrantId: existingGrant?.id ?? null,
            existingGrantStatus: existingGrant?.status ?? null,
            existingGrantTier: existingGrant?.rewardTier ?? null,
            existingNotificationId: existingGrant?.notificationId ?? null,
            existingNotificationClaimStatus: existingGrant?.notification?.claimStatus ?? null,
            existingAchievementId: existingAchievement?.id ?? null,
            previewOutcome: describeSeasonRewardPreviewOutcome(existingGrant),
          });
        })
      : [];

    const existingGrantRows = existingGrants.map((grant) => normalizeDates({
      id: grant.id,
      playerId: grant.playerId,
      seasonNumber: grant.seasonNumber,
      seasonLabel: formatSeasonLabel(grant.seasonNumber),
      rewardType: grant.rewardType,
      rewardTypeLabel: formatSeasonRewardTypeLabel(grant.rewardType),
      rewardTier: grant.rewardTier,
      status: grant.status,
      notificationId: grant.notificationId,
      notificationClaimStatus: grant.notification?.claimStatus ?? null,
      notificationClaimedAt: grant.notification?.claimedAt ?? null,
      notificationReadAt: grant.notification?.readAt ?? null,
      notificationDeletedAt: grant.notification?.deletedAt ?? null,
      expiresAt: grant.notification?.expiresAt ?? null,
      contributionSnapshot: grant.contributionSnapshot,
      signInDays: grant.signInDays,
      loginDays: grant.loginDays,
      harvestCount: grant.harvestCount,
      raidCount: grant.raidCount,
      achievementCount: grant._count.achievements,
      rewardJson: grant.rewardJson,
      rewardSummary: formatRuleRewards(grant.rewardJson),
      claimedAt: grant.claimedAt,
      createdAt: grant.createdAt,
      updatedAt: grant.updatedAt,
    }));
    const existingAchievementRows = existingAchievements.map((achievement) => {
      const statSnapshot = normalizeAdminJsonObject(achievement.statSnapshotJson);
      const displayCopy = this.seasonService.getSeasonMedalDisplayCopy({
        achievementKey: achievement.achievementKey,
        title: achievement.title,
        description: achievement.description,
        statSnapshot,
      });

      return normalizeDates({
        id: achievement.id,
        playerId: achievement.playerId,
        seasonNumber: achievement.seasonNumber,
        seasonLabel: formatSeasonLabel(achievement.seasonNumber),
        domain: achievement.domain,
        achievementKey: achievement.achievementKey,
        title: displayCopy.title,
        description: displayCopy.description,
        contributionSnapshot: achievement.contributionSnapshot,
        statSnapshotJson: statSnapshot,
        rewardGrantId: achievement.rewardGrantId,
        rewardType: achievement.rewardGrant?.rewardType ?? null,
        rewardTier: achievement.rewardGrant?.rewardTier ?? null,
        rewardStatus: achievement.rewardGrant?.status ?? null,
        notificationId: achievement.rewardGrant?.notificationId ?? null,
        clientVisible: isVisibleAdminSeasonAchievement(achievement),
        createdAt: achievement.createdAt,
        updatedAt: achievement.updatedAt,
      });
    });

    return normalizeDates({
      playerId: player.id,
      nickname: player.nickname,
      factionCode: snapshot?.faction?.code ?? player.faction?.code ?? null,
      factionName: snapshot?.faction?.name ?? player.faction?.name ?? null,
      seasonNumber: normalizedSeasonNumber,
      seasonLabel: formatSeasonLabel(normalizedSeasonNumber),
      readOnly: true,
      willWrite: false,
      previewAvailable: Boolean(snapshot),
      reason: snapshot ? null : '未找到该玩家该赛季快照，无法预览赛季奖励。',
      snapshot: snapshot ? normalizeDates({
        id: snapshot.id,
        playerId: snapshot.playerId,
        seasonNumber: snapshot.seasonNumber,
        seasonLabel: formatSeasonLabel(snapshot.seasonNumber),
        factionId: snapshot.factionId,
        factionCode: snapshot.faction?.code ?? null,
        factionName: snapshot.faction?.name ?? null,
        contributionScore: snapshot.contributionScore,
        signInDays: snapshot.signInDays,
        loginDays: snapshot.loginDays,
        harvestCount: snapshot.harvestCount,
        raidCount: snapshot.raidCount,
        finalRank: snapshot.finalRank,
        rewardTier: snapshot.rewardTier,
        snapshotJson: snapshot.snapshotJson,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
      }) : null,
      ruleCount: previewRules.length,
      existingGrantCount: existingGrantRows.length,
      existingAchievementCount: existingAchievementRows.length,
      visibleAchievementCount: existingAchievementRows.filter((achievement) => achievement['clientVisible']).length,
      rules: previewRules,
      existingGrants: existingGrantRows,
      existingAchievements: existingAchievementRows,
    });
  }

  async getSeasonRewardSummary(seasonNumber: number): Promise<Record<string, unknown>> {
    const normalizedSeasonNumber = normalizeSeasonNumber(seasonNumber);
    const where: Prisma.PlayerSeasonRewardGrantWhereInput = { seasonNumber: normalizedSeasonNumber };
    const [totalGrantCount, totalAchievementCount, rewardTypeGroups, statusGroups, achievementDomainGroups] = await Promise.all([
      this.prisma.db.playerSeasonRewardGrant.count({ where }),
      this.prisma.db.playerSeasonAchievement.count({ where: { seasonNumber: normalizedSeasonNumber } }),
      this.prisma.db.playerSeasonRewardGrant.groupBy({
        by: ['rewardType'],
        where,
        _count: { _all: true },
      }),
      this.prisma.db.playerSeasonRewardGrant.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.db.playerSeasonAchievement.groupBy({
        by: ['domain'],
        where: { seasonNumber: normalizedSeasonNumber },
        _count: { _all: true },
      }),
    ]);

    const notificationStatusRows = await this.prisma.db.playerSeasonRewardGrant.findMany({
      where,
      select: {
        notification: { select: { claimStatus: true } },
      },
    });
    const notificationClaimStatusCounts = new Map<string, number>();
    for (const row of notificationStatusRows) {
      const status = row.notification?.claimStatus ?? 'NONE';
      notificationClaimStatusCounts.set(status, (notificationClaimStatusCounts.get(status) ?? 0) + 1);
    }

    return {
      seasonNumber: normalizedSeasonNumber,
      totalGrantCount,
      totalAchievementCount,
      rewardTypeCounts: Object.fromEntries(rewardTypeGroups.map((item) => [item.rewardType, item._count._all])),
      grantStatusCounts: Object.fromEntries(statusGroups.map((item) => [item.status, item._count._all])),
      notificationClaimStatusCounts: Object.fromEntries(notificationClaimStatusCounts),
      achievementDomainCounts: Object.fromEntries(achievementDomainGroups.map((item) => [item.domain, item._count._all])),
    };
  }

  async listSeasonRewardGrants(
    seasonNumber: number,
    query: Record<string, string | undefined>,
  ): Promise<AdminListResponse<Record<string, unknown>>> {
    const normalizedSeasonNumber = normalizeSeasonNumber(seasonNumber);
    const { page, pageSize, skip, take } = parsePagination(query);
    const where: Prisma.PlayerSeasonRewardGrantWhereInput = { seasonNumber: normalizedSeasonNumber };
    if (query.playerId?.trim()) {
      where.playerId = query.playerId.trim();
    }
    if (query.rewardType?.trim()) {
      where.rewardType = query.rewardType.trim();
    }
    if (query.status?.trim()) {
      where.status = query.status.trim();
    }

    const [items, total] = await Promise.all([
      this.prisma.db.playerSeasonRewardGrant.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
        include: {
          player: { select: { nickname: true } },
          notification: { select: { id: true, claimStatus: true, claimedAt: true, expiresAt: true, readAt: true } },
          _count: { select: { achievements: true } },
        },
      }),
      this.prisma.db.playerSeasonRewardGrant.count({ where }),
    ]);

    return {
      items: items.map((item) => normalizeDates({
        id: item.id,
        playerId: item.playerId,
        nickname: item.player.nickname,
        seasonNumber: item.seasonNumber,
        rewardType: item.rewardType,
        rewardTier: item.rewardTier,
        status: item.status,
        notificationId: item.notificationId,
        notificationClaimStatus: item.notification?.claimStatus ?? null,
        notificationClaimedAt: item.notification?.claimedAt ?? null,
        notificationReadAt: item.notification?.readAt ?? null,
        expiresAt: item.notification?.expiresAt ?? null,
        contributionSnapshot: item.contributionSnapshot,
        signInDays: item.signInDays,
        loginDays: item.loginDays,
        harvestCount: item.harvestCount,
        raidCount: item.raidCount,
        achievementCount: item._count.achievements,
        rewardJson: item.rewardJson,
        claimedAt: item.claimedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      pagination: { page, pageSize, total },
    };
  }

  async listSeasonAchievements(
    seasonNumber: number,
    query: Record<string, string | undefined>,
  ): Promise<AdminListResponse<Record<string, unknown>>> {
    const normalizedSeasonNumber = normalizeSeasonNumber(seasonNumber);
    const { page, pageSize, skip, take } = parsePagination(query);
    const where: Prisma.PlayerSeasonAchievementWhereInput = { seasonNumber: normalizedSeasonNumber };
    if (query.playerId?.trim()) {
      where.playerId = query.playerId.trim();
    }
    if (query.domain?.trim()) {
      where.domain = query.domain.trim();
    }

    const [items, total] = await Promise.all([
      this.prisma.db.playerSeasonAchievement.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
        include: {
          player: { select: { nickname: true } },
          rewardGrant: { select: { rewardType: true, rewardTier: true, status: true, notificationId: true } },
        },
      }),
      this.prisma.db.playerSeasonAchievement.count({ where }),
    ]);

    return {
      items: items.map((item) => normalizeDates({
        id: item.id,
        playerId: item.playerId,
        nickname: item.player.nickname,
        seasonNumber: item.seasonNumber,
        domain: item.domain,
        achievementKey: item.achievementKey,
        title: item.title,
        description: item.description,
        contributionSnapshot: item.contributionSnapshot,
        statSnapshotJson: item.statSnapshotJson,
        rewardGrantId: item.rewardGrantId,
        rewardType: item.rewardGrant?.rewardType ?? null,
        rewardTier: item.rewardGrant?.rewardTier ?? null,
        rewardStatus: item.rewardGrant?.status ?? null,
        notificationId: item.rewardGrant?.notificationId ?? null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      pagination: { page, pageSize, total },
    };
  }

  async listShareAssistCampaigns(query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const where: Prisma.ShareAssistCampaignWhereInput = {};
    if (query.status?.trim()) {
      where.status = query.status.trim().toUpperCase() as Prisma.EnumShareAssistCampaignStatusFilter;
    }
    if (query.ownerPlayerId?.trim()) {
      where.ownerPlayerId = query.ownerPlayerId.trim();
    }

    const [items, total] = await Promise.all([
      this.prisma.db.shareAssistCampaign.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
        include: {
          owner: { select: { id: true, nickname: true, castleLevelCache: true } },
          _count: { select: { records: true, inviteRelations: true } },
        },
      }),
      this.prisma.db.shareAssistCampaign.count({ where }),
    ]);

    return {
      items: items.map((item) => normalizeDates({
        id: item.id,
        ownerPlayerId: item.ownerPlayerId,
        ownerNickname: item.owner.nickname,
        ownerCastleLevel: item.owner.castleLevelCache,
        campaignType: item.campaignType,
        status: item.status,
        currentAssistCount: item.currentAssistCount,
        maxAssistCount: item.maxAssistCount,
        targetEntityType: item.targetEntityType,
        targetEntityId: item.targetEntityId,
        recordCount: item._count.records,
        inviteCount: item._count.inviteRelations,
        expiresAt: item.expiresAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      pagination: { page, pageSize, total },
    };
  }

  async listShareAssistRecords(query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const where: Prisma.ShareAssistRecordWhereInput = {};
    if (query.campaignId?.trim()) {
      where.campaignId = query.campaignId.trim();
    }
    if (query.helperPlayerId?.trim()) {
      where.helperPlayerId = query.helperPlayerId.trim();
    }

    const [items, total] = await Promise.all([
      this.prisma.db.shareAssistRecord.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
        include: {
          campaign: {
            select: {
              id: true,
              ownerPlayerId: true,
              campaignType: true,
              owner: { select: { nickname: true } },
            },
          },
          helperPlayer: { select: { id: true, nickname: true } },
        },
      }),
      this.prisma.db.shareAssistRecord.count({ where }),
    ]);

    return {
      items: items.map((item) => normalizeDates({
        id: item.id,
        campaignId: item.campaignId,
        campaignType: item.campaign.campaignType,
        ownerPlayerId: item.campaign.ownerPlayerId,
        ownerNickname: item.campaign.owner.nickname,
        helperAudience: item.helperAudience,
        helperPlayerId: item.helperPlayerId,
        helperNickname: item.helperPlayer?.nickname ?? null,
        helperOpenidHash: item.helperOpenidHash,
        helperDeviceHash: item.helperDeviceHash,
        status: item.status,
        assistRecordId: item.assistRecordId,
        rewardClaimedAt: item.rewardClaimedAt,
        boundAt: item.boundAt,
        createdAt: item.createdAt,
      })),
      pagination: { page, pageSize, total },
    };
  }

  async listShareInviteRelations(query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const where: Prisma.PlayerInviteRelationWhereInput = {};
    if (query.status?.trim()) {
      where.status = query.status.trim().toUpperCase() as Prisma.EnumPlayerInviteRelationStatusFilter;
    }
    if (query.playerId?.trim()) {
      const playerId = query.playerId.trim();
      where.OR = [{ inviterPlayerId: playerId }, { invitedPlayerId: playerId }];
    }

    const [items, total] = await Promise.all([
      this.prisma.db.playerInviteRelation.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
        include: {
          inviter: { select: { id: true, nickname: true } },
          invitedPlayer: { select: { id: true, nickname: true } },
          campaign: { select: { id: true, campaignType: true, status: true } },
        },
      }),
      this.prisma.db.playerInviteRelation.count({ where }),
    ]);

    return {
      items: items.map((item) => normalizeDates({
        id: item.id,
        inviterPlayerId: item.inviterPlayerId,
        inviterNickname: item.inviter.nickname,
        invitedPlayerId: item.invitedPlayerId,
        invitedNickname: item.invitedPlayer?.nickname ?? null,
        invitedOpenidHash: item.invitedOpenidHash,
        sourceCampaignId: item.sourceCampaignId,
        campaignType: item.campaign?.campaignType ?? null,
        campaignStatus: item.campaign?.status ?? null,
        status: item.status,
        createdAt: item.createdAt,
        boundAt: item.boundAt,
        rewardedAt: item.rewardedAt,
      })),
      pagination: { page, pageSize, total },
    };
  }

  async listTaskConfigs(query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    const group = normalizeTaskGroup(query.group);
    const items = await this.taskConfigService.listAdminTaskConfigs(group);
    return {
      items: items.map((item) => ({ ...item })),
      pagination: { page: 1, pageSize: items.length, total: items.length },
    };
  }

  async updateTaskConfig(taskGroup: string, taskId: string, body: unknown): Promise<Record<string, unknown>> {
    const group = normalizeTaskGroup(taskGroup);
    if (!group) {
      throwBadRequest('taskGroup must be starter, contribution, daily, or daily-faction.');
    }

    const payload = parseTaskConfigPayload(body);
    return { ...(await this.taskConfigService.upsertAdminTaskConfig(group, taskId, payload)) };
  }

  async getSystemStatus(): Promise<AdminSystemStatusResponse> {
    let databaseStatus: 'up' | 'down' = 'up';

    try {
      await this.prisma.db.$queryRaw`SELECT 1`;
    } catch {
      databaseStatus = 'down';
    }

    return {
      app: APP_NAME,
      environment: process.env.NODE_ENV ?? 'development',
      version: '0.1.0',
      time: new Date().toISOString(),
      database: { status: databaseStatus },
      workers: [{ name: 'raid-settlement', status: 'registered' }],
      featureFlags: {
        adminDebugKeyEnabled: Boolean(process.env.ADMIN_DEBUG_KEY?.trim()),
        adminWriteDebugKeyEnabled: Boolean(process.env.ADMIN_WRITE_DEBUG_KEY?.trim()),
        forceMockReads: parseBoolean(process.env.VITE_FORCE_MOCK_READS),
        allowMockReadFallback: parseBoolean(process.env.VITE_ALLOW_MOCK_READ_FALLBACK),
        forceMockCommands: parseBoolean(process.env.VITE_FORCE_MOCK_COMMANDS),
      },
    };
  }

  async listSeedDefinitions(query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const [items, total] = await Promise.all([
      this.prisma.db.seedDefinition.findMany({
        orderBy: [{ sortOrder: 'asc' }, { seedId: 'asc' }],
        skip,
        take,
      }),
      this.prisma.db.seedDefinition.count(),
    ]);

    return { items: items.map(normalizeDates), pagination: { page, pageSize, total } };
  }

  async createSeedDefinition(body: unknown): Promise<Record<string, unknown>> {
    const payload = parseSeedDefinitionPayload(body, true);
    try {
      const created = await this.prisma.db.seedDefinition.create({ data: payload as unknown as Prisma.SeedDefinitionUncheckedCreateInput });
      return normalizeDates(created);
    } catch (caught) {
      throwConfigMutationError(caught, 'Seed definition already exists or is referenced.');
    }
  }

  async updateSeedDefinition(seedId: string, body: unknown): Promise<Record<string, unknown>> {
    const payload = parseSeedDefinitionPayload(body, false);
    if (Object.keys(payload).length <= 0) {
      throwBadRequest('At least one seed field is required.');
    }

    try {
      const updated = await this.prisma.db.seedDefinition.update({
        where: { seedId },
        data: payload as Prisma.SeedDefinitionUncheckedUpdateInput,
      });
      return normalizeDates(updated);
    } catch (caught) {
      throwConfigMutationError(caught, 'Seed definition not found or update conflicts.');
    }
  }

  async deleteSeedDefinition(seedId: string, body: unknown): Promise<Record<string, unknown>> {
    const audit = parseDangerousOperationPayload(body, seedId);
    try {
      const deleted = await this.prisma.transaction(async (client) => {
        const deletedSeed = await client.seedDefinition.delete({ where: { seedId } });
        await createAdminOperationAuditLog(client, {
          action: 'delete-seed-definition',
          targetType: 'seed-definition',
          targetId: deletedSeed.seedId,
          reason: audit.reason,
          confirmText: audit.confirmText,
          metadata: { label: deletedSeed.label },
        });
        return deletedSeed;
      });
      return { seedId: deleted.seedId, label: deleted.label, deleted: true };
    } catch (caught) {
      throwConfigMutationError(caught, 'Seed definition is referenced by player data or does not exist.');
    }
  }

  async listSpiritDefinitions(query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const [items, total] = await Promise.all([
      this.prisma.db.spiritDefinition.findMany({
        orderBy: [{ sortOrder: 'asc' }, { spiritId: 'asc' }],
        skip,
        take,
      }),
      this.prisma.db.spiritDefinition.count(),
    ]);

    return { items: items.map(normalizeDates), pagination: { page, pageSize, total } };
  }

  async createSpiritDefinition(body: unknown): Promise<Record<string, unknown>> {
    const payload = parseSpiritDefinitionPayload(body, true);
    try {
      const created = await this.prisma.db.spiritDefinition.create({ data: payload as unknown as Prisma.SpiritDefinitionUncheckedCreateInput });
      return normalizeDates(created);
    } catch (caught) {
      throwConfigMutationError(caught, 'Spirit definition already exists or is referenced.');
    }
  }

  async updateSpiritDefinition(spiritId: string, body: unknown): Promise<Record<string, unknown>> {
    const payload = parseSpiritDefinitionPayload(body, false);
    if (Object.keys(payload).length <= 0) {
      throwBadRequest('At least one spirit field is required.');
    }

    try {
      const updated = await this.prisma.db.spiritDefinition.update({
        where: { spiritId },
        data: payload as Prisma.SpiritDefinitionUncheckedUpdateInput,
      });
      return normalizeDates(updated);
    } catch (caught) {
      throwConfigMutationError(caught, 'Spirit definition not found or update conflicts.');
    }
  }

  async deleteSpiritDefinition(spiritId: string, body: unknown): Promise<Record<string, unknown>> {
    const audit = parseDangerousOperationPayload(body, spiritId);
    try {
      const deleted = await this.prisma.transaction(async (client) => {
        const deletedSpirit = await client.spiritDefinition.delete({ where: { spiritId } });
        await createAdminOperationAuditLog(client, {
          action: 'delete-spirit-definition',
          targetType: 'spirit-definition',
          targetId: deletedSpirit.spiritId,
          reason: audit.reason,
          confirmText: audit.confirmText,
          metadata: { label: deletedSpirit.label },
        });
        return deletedSpirit;
      });
      return { spiritId: deleted.spiritId, label: deleted.label, deleted: true };
    } catch (caught) {
      throwConfigMutationError(caught, 'Spirit definition is referenced by player data or does not exist.');
    }
  }

  async listCastleLevels(): Promise<AdminListResponse<Record<string, unknown>>> {
    const factionStipends = ((GAME_DESIGN_CONFIG.factionStipends as { tiers?: Array<Record<string, unknown>> }).tiers ?? [])
      .map((tier) => ({
        type: 'faction-stipend',
        ruleGroup: 'faction-stipend',
        key: tier['tierKey'],
        title: tier['label'],
        requirements: `contribution >= ${tier['minContribution']}`,
        cost: 'daily claim',
        effect: '-',
        rewards: formatRuleRewards(tier['rewards']),
      }));
    const items = [...factionStipends];
    return {
      items,
      pagination: { page: 1, pageSize: items.length, total: items.length },
    };
  }
  async searchPlayers(query: Record<string, string | undefined>): Promise<AdminPlayerSearchResponse> {
    const keyword = query.keyword?.trim();
    const { page, pageSize, skip, take } = parsePagination(query);
    const where = keyword
      ? {
          OR: [
            { id: { contains: keyword } },
            { nickname: { contains: keyword, mode: 'insensitive' as const } },
            { authIdentities: { some: { providerUserId: { contains: keyword, mode: 'insensitive' as const } } } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.db.player.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          nickname: true,
          castleLevelCache: true,
          lastLoginAt: true,
          faction: { select: { name: true } },
          authIdentities: { select: { provider: true, providerUserId: true } },
        },
      }),
      this.prisma.db.player.count({ where }),
    ]);

    return {
      items: items.map((player) => ({
        playerId: player.id,
        nickname: player.nickname,
        faction: player.faction?.name ?? null,
        castleLevel: player.castleLevelCache,
        lastLoginAt: toIso(player.lastLoginAt),
        tags: player.authIdentities.map((identity) => `${identity.provider}:${identity.providerUserId}`),
      })),
      pagination: { page, pageSize, total },
    };
  }

  async deletePlayer(playerId: string, body: unknown): Promise<AdminDeletePlayerResponse> {
    const normalizedPlayerId = playerId.trim();
    if (!normalizedPlayerId) {
      throw new BusinessError({
        code: ErrorCode.BadRequest,
        message: 'playerId is required.',
        statusCode: 400,
      });
    }
    const audit = parseDangerousOperationPayload(body, normalizedPlayerId);

    const existing = await this.prisma.db.player.findUnique({
      where: { id: normalizedPlayerId },
      select: { id: true, nickname: true },
    });
    if (!existing) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Player not found.',
        statusCode: 404,
      });
    }

    await this.prisma.transaction(async (client) => {
      await createAdminOperationAuditLog(client, {
        action: 'delete-player',
        targetType: 'player',
        targetId: existing.id,
        reason: audit.reason,
        confirmText: audit.confirmText,
        metadata: { nickname: existing.nickname },
      });
      await client.player.delete({ where: { id: normalizedPlayerId } });
    });
    return {
      playerId: existing.id,
      nickname: existing.nickname,
      deleted: true,
    };
  }

  async getPlayerOverview(playerId: string): Promise<AdminPlayerOverviewResponse> {
    const player = await this.prisma.db.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        nickname: true,
        castleLevelCache: true,
        stateVersion: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        faction: { select: { code: true, name: true } },
        factionMembers: {
          select: {
            contributionScore: true,
            joinedAt: true,
            faction: { select: { code: true, name: true } },
          },
          take: 5,
        },
        wallet: true,
        buildings: true,
        army: true,
        spiritResource: true,
        spiritSlots: {
          orderBy: { slotIndex: 'asc' },
          include: { spiritDefinition: true },
        },
        spiritCodex: {
          orderBy: { updatedAt: 'desc' },
          take: 20,
          include: { spiritDefinition: true },
        },
        fieldSlots: { orderBy: { slotIndex: 'asc' }, include: { seedDefinition: true } },
        seedInventory: {
          include: { seedDefinition: true },
          orderBy: [
            { seedDefinition: { sortOrder: 'asc' } },
            { seedDefinition: { seedId: 'asc' } },
          ],
        },
        taskStates: { orderBy: { updatedAt: 'desc' }, take: 20 },
        ownedBattleReports: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!player) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Player not found.',
        statusCode: 404,
      });
    }

    return {
      identity: {
        playerId: player.id,
        nickname: player.nickname,
        faction: player.faction,
        factionMembers: player.factionMembers.map((member) => ({
          faction: member.faction,
          contributionScore: member.contributionScore,
          joinedAt: toIso(member.joinedAt),
        })),
        castleLevel: player.castleLevelCache,
        stateVersion: player.stateVersion,
        createdAt: toIso(player.createdAt),
        updatedAt: toIso(player.updatedAt),
        lastLoginAt: toIso(player.lastLoginAt),
      },
      resources: {
        playerId: player.id,
        gold: player.wallet?.vaultGold ?? 0,
        tianjiTalisman: player.spiritResource?.tianjiTalisman ?? 0,
        resourceStateVersion: player.wallet?.balanceVersion ?? null,
        spiritResourceStateVersion: player.spiritResource?.resourceVersion ?? null,
      },
      spell: {
        playerId: player.id,
        protectionTechLevel: player.buildings?.protectionTechLevel ?? 0,
        farmYieldTechLevel: player.buildings?.farmYieldTechLevel ?? 0,
        collectWindowTechLevel: player.buildings?.collectWindowTechLevel ?? 0,
        pendingClaimTechLevel: player.buildings?.pendingClaimTechLevel ?? 0,
        spellStateVersion: player.buildings?.buildingVersion ?? null,
      },
      wallet: player.wallet ? normalizeDates(player.wallet) : null,
      building: player.buildings ? normalizeDates(player.buildings) : null,
      army: player.army ? normalizeDates(player.army) : null,
      spirit: {
        resource: player.spiritResource ? normalizeDates(player.spiritResource) : null,
        mainSlot: (() => {
          const mainSlot = player.spiritSlots.find((slot) => slot.isMain);
          return mainSlot ? normalizeSpiritSlot(mainSlot) : null;
        })(),
        slots: player.spiritSlots.map(normalizeSpiritSlot),
        codex: player.spiritCodex.map((entry) => normalizeDates({
          spiritId: entry.spiritDefinition.spiritId,
          label: entry.spiritDefinition.label,
          rarity: entry.spiritDefinition.rarity,
          factionAffinity: entry.spiritDefinition.factionAffinity,
          role: entry.spiritDefinition.role,
          shardName: entry.spiritDefinition.shardName,
          shardCount: entry.shardCount,
          shardUnlockRequired: entry.spiritDefinition.shardUnlockRequired,
          hasSeen: entry.hasSeen,
          readyToCompose: entry.readyToCompose,
          ownedCurrent: entry.ownedCurrent,
          ownedEver: entry.ownedEver,
          firstSeenAt: entry.firstSeenAt,
          readyAt: entry.readyAt,
          lastOwnedAt: entry.lastOwnedAt,
          codexVersion: entry.codexVersion,
        })),
      },
      fields: player.fieldSlots.map((field) => normalizeDates({
        id: field.id,
        slotIndex: field.slotIndex,
        isUnlocked: field.isUnlocked,
        status: field.status,
        seedId: field.seedDefinition?.seedId ?? null,
        currentClaimableGold: field.currentClaimableGold,
        matureAt: field.matureAt,
        readyAt: field.readyAt,
        overripeAt: field.overripeAt,
        statusVersion: field.statusVersion,
        updatedAt: field.updatedAt,
      })),
      seedInventory: {
        unlockedSeedIds: player.seedInventory
          .filter((item) => item.unlockedAt || item.quantity > 0)
          .map((item) => item.seedDefinition.seedId),
        items: player.seedInventory.map((item) => normalizeDates({
          seedId: item.seedDefinition.seedId,
          label: item.seedDefinition.label,
          sortOrder: item.seedDefinition.sortOrder,
          unlocked: Boolean(item.unlockedAt || item.quantity > 0),
          quantity: item.quantity,
          inventoryVersion: item.inventoryVersion,
          unlockedAt: item.unlockedAt,
        })),
      },
      dailyTasks: player.taskStates.map((task) => normalizeDates(task)),
      recentReports: player.ownedBattleReports.map((report) => normalizeDates(report)),
    };
  }

  async getWalletLogs(playerId: string, query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const where = {
      playerId,
      ...buildDateRange(query),
      ...(query.changeType ? { changeType: query.changeType } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.db.walletChangeLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.db.walletChangeLog.count({ where }),
    ]);
    return { items: items.map(normalizeDates), pagination: { page, pageSize, total } };
  }

  async getBuildingLogs(playerId: string, query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const where = {
      playerId,
      ...buildDateRange(query),
      ...(query.buildingKey ? { buildingKey: query.buildingKey } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.db.buildingUpgradeLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.db.buildingUpgradeLog.count({ where }),
    ]);
    return { items: items.map(normalizeDates), pagination: { page, pageSize, total } };
  }

  async getFieldLogs(playerId: string, query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const where = {
      playerId,
      ...buildDateRange(query),
      ...(query.actionType ? { collectMode: query.actionType } : {}),
      ...(query.slotIndex ? { fieldSlot: { slotIndex: Number(query.slotIndex) } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.db.fieldHarvestLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { fieldSlot: { select: { slotIndex: true } } },
      }),
      this.prisma.db.fieldHarvestLog.count({ where }),
    ]);
    return { items: items.map(normalizeDates), pagination: { page, pageSize, total } };
  }

  async getPlayerOrders(playerId: string, query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const status = query.status?.trim();
    const type = query.type?.trim();
    const mergeTake = skip + take;
    const trainingWhere = { playerId, ...(status ? { status: status as never } : {}) };
    const raidWhere = {
      OR: [{ attackerPlayerId: playerId }, { defenderPlayerId: playerId }],
      ...(status ? { status: status as never } : {}),
    };
    const [trainingQueues, trainingTotal, raidOrders, raidTotal] = await Promise.all([
      type && type !== 'army-training'
        ? Promise.resolve([])
        : this.prisma.db.armyTrainingQueue.findMany({
          where: trainingWhere,
          orderBy: { createdAt: 'desc' },
          take: mergeTake,
        }),
      type && type !== 'army-training'
        ? Promise.resolve(0)
        : this.prisma.db.armyTrainingQueue.count({ where: trainingWhere }),
      type && type !== 'raid'
        ? Promise.resolve([])
        : this.prisma.db.raidOrder.findMany({
          where: raidWhere,
          orderBy: { createdAt: 'desc' },
          take: mergeTake,
        }),
      type && type !== 'raid'
        ? Promise.resolve(0)
        : this.prisma.db.raidOrder.count({ where: raidWhere }),
    ]);
    const items = [
      ...trainingQueues.map((queue) => normalizeDates({
        type: 'army-training',
        orderId: queue.id,
        status: queue.status,
        queuedCount: queue.queuedCount,
        totalCostGold: queue.totalCostGold,
        startedAt: queue.startedAt,
        finishAt: queue.finishAt,
        createdAt: queue.createdAt,
      })),
      ...raidOrders.map((order) => normalizeDates({
        type: 'raid',
        orderId: order.id,
        status: order.status,
        attackerPlayerId: order.attackerPlayerId,
        defenderPlayerId: order.defenderPlayerId,
        dispatchedUnitCount: order.dispatchedUnitCount,
        dispatchedAt: order.dispatchedAt,
        settleAt: order.settleAt,
        settledAt: order.settledAt,
        createdAt: order.createdAt,
      })),
    ].sort((left, right) => String(right['createdAt'] ?? '').localeCompare(String(left['createdAt'] ?? '')));

    return {
      items: items.slice(skip, skip + take),
      pagination: { page, pageSize, total: trainingTotal + raidTotal },
    };
  }

  async getRaidOrderDetail(orderId: string): Promise<AdminRaidOrderDetailResponse> {
    const order = await this.prisma.db.raidOrder.findUnique({
      where: { id: orderId },
      include: {
        settlement: true,
        battleReports: { orderBy: { createdAt: 'desc' } },
        assetLocks: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Raid order not found.',
        statusCode: 404,
      });
    }

    return {
      order: normalizeDates({
        id: order.id,
        attackerPlayerId: order.attackerPlayerId,
        defenderPlayerId: order.defenderPlayerId,
        defenderFieldSlotId: order.defenderFieldSlotId,
        sourceTargetPoolId: order.sourceTargetPoolId,
        mode: order.mode,
        status: order.status,
        dispatchedUnitCount: order.dispatchedUnitCount,
        requestIdempotencyKey: order.requestIdempotencyKey,
        dispatchedAt: order.dispatchedAt,
        settleAt: order.settleAt,
        settledAt: order.settledAt,
        settlementVersion: order.settlementVersion,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      }),
      settlement: order.settlement ? normalizeDates(order.settlement) : null,
      reports: order.battleReports.map(normalizeDates),
      assetLocks: order.assetLocks.map(normalizeDates),
    };
  }
}

function parsePagination(query: PagingQuery): { page: number; pageSize: number; skip: number; take: number } {
  const page = Math.max(Number(query.page ?? 1) || 1, 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize ?? 20) || 20, 1), 100);
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

function parseSeedDefinitionPayload(body: unknown, requireAll: boolean): Record<string, string | number | null> {
  const record = requireRecord(body);
  const payload: Record<string, string | number | null> = {};

  copyStringField(payload, record, 'seedId', requireAll);
  copyStringField(payload, record, 'label', requireAll);
  copyEnumField(payload, record, 'rarity', ['common', 'rare', 'legendary'], requireAll);
  copyIntegerField(payload, record, 'sortOrder', requireAll, 0);
  copyIntegerField(payload, record, 'growSeconds', requireAll, 1);
  copyIntegerField(payload, record, 'matureSeconds', requireAll, 1);
  copyIntegerField(payload, record, 'collectWindowSeconds', requireAll, 0);
  copyIntegerField(payload, record, 'baseYieldGold', requireAll, 0);
  copyIntegerField(payload, record, 'harvestSeedReturn', requireAll, 0);
  copyNullableStringField(payload, record, 'strategyNote', requireAll);
  copyNullableStringField(payload, record, 'lore', requireAll);

  return payload;
}

function parseSpiritDefinitionPayload(body: unknown, requireAll: boolean): Record<string, string | number | null> {
  const record = requireRecord(body);
  const payload: Record<string, string | number | null> = {};

  copyStringField(payload, record, 'spiritId', requireAll);
  copyStringField(payload, record, 'label', requireAll);
  copyEnumField(payload, record, 'rarity', ['COMMON', 'RARE', 'LEGENDARY'], requireAll, true);
  copyEnumField(payload, record, 'factionAffinity', ['human', 'immortal', 'demon'], requireAll);
  copyEnumField(payload, record, 'role', ['ATTACK', 'BALANCED', 'HEALTH'], requireAll, true);
  copyStringField(payload, record, 'shardName', requireAll);
  copyIntegerField(payload, record, 'shardUnlockRequired', requireAll, 1);
  copyIntegerField(payload, record, 'baseAttack', requireAll, 0);
  copyIntegerField(payload, record, 'baseHp', requireAll, 1);
  copyIntegerField(payload, record, 'growthAttack', requireAll, 0);
  copyIntegerField(payload, record, 'growthHp', requireAll, 0);
  copyIntegerField(payload, record, 'sortOrder', requireAll, 0);
  copyNullableStringField(payload, record, 'lore', requireAll);

  return payload;
}

function parseTaskConfigPayload(body: unknown): {
  title?: string | null;
  description?: string | null;
  targetCount?: number | null;
  rewardGold?: number | null;
  rewardContribution?: number | null;
  isEnabled?: boolean;
} {
  const record = requireRecord(body);
  const payload: {
    title?: string | null;
    description?: string | null;
    targetCount?: number | null;
    rewardGold?: number | null;
    rewardContribution?: number | null;
    isEnabled?: boolean;
  } = {};

  copyOptionalNullableString(payload, record, 'title');
  copyOptionalNullableString(payload, record, 'description');
  copyOptionalNullableInteger(payload, record, 'targetCount', 0);
  copyOptionalNullableInteger(payload, record, 'rewardGold', 0);
  copyOptionalNullableInteger(payload, record, 'rewardContribution', 0);

  if (record.isEnabled !== undefined) {
    if (typeof record.isEnabled !== 'boolean') {
      throwBadRequest('isEnabled must be a boolean.');
    }
    payload.isEnabled = record.isEnabled;
  }

  return payload;
}

function requireRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throwBadRequest('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

function parseDangerousOperationPayload(body: unknown, expectedConfirmText: string): { reason: string; confirmText: string } {
  const record = requireRecord(body);
  const reason = typeof record.reason === 'string' ? record.reason.trim() : '';
  const confirmText = typeof record.confirmText === 'string' ? record.confirmText.trim() : '';

  if (reason.length < 4 || reason.length > 200) {
    throwBadRequest('reason must be 4-200 characters.');
  }
  if (confirmText !== expectedConfirmText) {
    throwBadRequest('confirmText must match the target id.');
  }

  return { reason, confirmText };
}

async function createAdminOperationAuditLog(
  client: Prisma.TransactionClient,
  input: {
    action: string;
    targetType: string;
    targetId: string;
    reason: string;
    confirmText: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await client.adminOperationAuditLog.create({
    data: {
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      confirmText: input.confirmText,
      ...(input.metadata ? { metadataJson: input.metadata } : {}),
    },
  });
}

function copyOptionalNullableString<T extends Record<string, unknown>>(
  payload: T,
  record: Record<string, unknown>,
  field: string,
): void {
  const value = record[field];
  if (value === undefined) {
    return;
  }
  if (value === null) {
    payload[field as keyof T] = null as T[keyof T];
    return;
  }
  if (typeof value !== 'string') {
    throwBadRequest(`${field} must be a string or null.`);
  }
  payload[field as keyof T] = (value.trim() || null) as T[keyof T];
}

function copyOptionalNullableInteger<T extends Record<string, unknown>>(
  payload: T,
  record: Record<string, unknown>,
  field: string,
  minValue: number,
): void {
  const value = record[field];
  if (value === undefined) {
    return;
  }
  if (value === null || value === '') {
    payload[field as keyof T] = null as T[keyof T];
    return;
  }
  const normalized = typeof value === 'string' ? Number(value) : value;
  if (!Number.isInteger(normalized) || Number(normalized) < minValue) {
    throwBadRequest(`${field} must be an integer >= ${minValue} or null.`);
  }
  payload[field as keyof T] = Number(normalized) as T[keyof T];
}

function copyStringField(
  payload: Record<string, string | number | null>,
  record: Record<string, unknown>,
  field: string,
  required: boolean,
): void {
  const value = record[field];
  if (value === undefined) {
    if (required) {
      throwBadRequest(`${field} is required.`);
    }
    return;
  }
  if (typeof value !== 'string' || value.trim().length <= 0) {
    throwBadRequest(`${field} must be a non-empty string.`);
  }
  payload[field] = value.trim();
}

function copyNullableStringField(
  payload: Record<string, string | number | null>,
  record: Record<string, unknown>,
  field: string,
  required: boolean,
): void {
  const value = record[field];
  if (value === undefined) {
    if (required) {
      payload[field] = null;
    }
    return;
  }
  if (value === null) {
    payload[field] = null;
    return;
  }
  if (typeof value !== 'string') {
    throwBadRequest(`${field} must be a string or null.`);
  }
  payload[field] = value.trim() || null;
}

function copyIntegerField(
  payload: Record<string, string | number | null>,
  record: Record<string, unknown>,
  field: string,
  required: boolean,
  minValue: number,
): void {
  const value = record[field];
  if (value === undefined) {
    if (required) {
      throwBadRequest(`${field} is required.`);
    }
    return;
  }
  const normalized = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(normalized) || Number(normalized) < minValue) {
    throwBadRequest(`${field} must be an integer >= ${minValue}.`);
  }
  payload[field] = Number(normalized);
}

function copyEnumField(
  payload: Record<string, string | number | null>,
  record: Record<string, unknown>,
  field: string,
  allowedValues: string[],
  required: boolean,
  uppercase = false,
): void {
  const value = record[field];
  if (value === undefined) {
    if (required) {
      throwBadRequest(`${field} is required.`);
    }
    return;
  }
  if (typeof value !== 'string') {
    throwBadRequest(`${field} must be a string.`);
  }
  const normalized = uppercase ? value.trim().toUpperCase() : value.trim();
  if (!allowedValues.includes(normalized)) {
    throwBadRequest(`${field} must be one of: ${allowedValues.join(', ')}.`);
  }
  payload[field] = normalized;
}

function throwConfigMutationError(caught: unknown, fallbackMessage: string): never {
  const code = getPrismaErrorCode(caught);
  if (code === 'P2025') {
    throw new BusinessError({
      code: ErrorCode.NotFound,
      message: fallbackMessage,
      statusCode: 404,
    });
  }
  if (code === 'P2002' || code === 'P2003') {
    throw new BusinessError({
      code: ErrorCode.Conflict,
      message: fallbackMessage,
      statusCode: 409,
    });
  }
  throw new BusinessError({
    code: ErrorCode.Conflict,
    message: fallbackMessage,
    statusCode: 409,
    details: caught instanceof Error ? caught.message : String(caught),
  });
}

function getPrismaErrorCode(caught: unknown): string | null {
  if (!caught || typeof caught !== 'object' || !('code' in caught)) {
    return null;
  }
  const code = (caught as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function throwBadRequest(message: string): never {
  throw new BusinessError({
    code: ErrorCode.BadRequest,
    message,
    statusCode: 400,
  });
}

function normalizeTaskGroup(value: string | undefined): TaskConfigGroup | null {
  if (!value) {
    return null;
  }

  if (value === 'starter' || value === 'daily' || value === 'daily-faction' || value === 'contribution') {
    return value;
  }

  throwBadRequest('taskGroup must be starter, contribution, daily, or daily-faction.');
}

function normalizeSeasonNumber(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throwBadRequest('seasonNumber must be a positive integer.');
  }
  return value;
}

function buildDateRange(query: PagingQuery): { createdAt?: { gte?: Date; lte?: Date } } {
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (query.from) {
    createdAt.gte = new Date(query.from);
  }
  if (query.to) {
    createdAt.lte = new Date(query.to);
  }
  return Object.keys(createdAt).length > 0 ? { createdAt } : {};
}

function normalizeDates<T extends Record<string, unknown>>(record: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]),
  );
}

function normalizeAdminJsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(Object.entries(value));
}

function isVisibleAdminSeasonAchievement(achievement: {
  achievementKey: string;
  rewardGrant: { rewardTier: string | null; status: string } | null;
}): boolean {
  if (achievement.rewardGrant?.status === 'voided') {
    return false;
  }

  if (achievement.rewardGrant?.rewardTier && achievement.achievementKey !== achievement.rewardGrant.rewardTier) {
    return false;
  }

  return true;
}

function formatSeasonRewardTypeLabel(rewardType: string): string {
  if (rewardType === 'participation') {
    return '基础参与';
  }
  if (rewardType === 'domain_farming') {
    return '种田领域';
  }
  if (rewardType === 'domain_spirit') {
    return '养宠领域';
  }
  if (rewardType === 'domain_combat') {
    return '探索战斗领域';
  }
  if (rewardType === 'contribution_tier') {
    return '贡献领域';
  }
  return rewardType;
}

function describeSeasonRewardPreviewOutcome(grant: { status: string; notificationId: string | null } | null): string {
  if (!grant) {
    return '未生成：真实生成会创建奖励单和通知';
  }
  if (grant.status === 'claimed') {
    return '已领取：真实生成不会刷新该奖励单';
  }
  if (grant.status === 'voided') {
    return '已撤销：真实生成不会刷新该奖励单';
  }
  if (grant.notificationId) {
    return '已存在：真实生成会保持或刷新未领取通知';
  }
  return '已存在：真实生成会补建通知';
}

function formatRuleRewards(rewards: unknown): string {
  if (!Array.isArray(rewards)) {
    return '';
  }

  return rewards
    .map((reward) => {
      const record = reward && typeof reward === 'object' ? reward as Record<string, unknown> : {};
      const poolIds = record['essencePoolIds'] ?? record['spiritPoolIds'] ?? record['seedPoolIds'];
      const poolLabel = Array.isArray(poolIds) && poolIds.length > 0 ? ` (${poolIds.join('/')})` : '';
      return `${record['label'] ?? record['kind'] ?? 'reward'}${poolLabel} x${record['quantity'] ?? 0}`;
    })
    .join(', ');
}

function normalizeSpiritSlot(slot: {
  id: string;
  playerId: string;
  slotIndex: number;
  spiritDefinitionId: string | null;
  isMain: boolean;
  level: number;
  exp: number;
  element: unknown;
  currentHp: number;
  maxHp: number;
  status: unknown;
  acquiredAt: Date | null;
  dissolvedAt: Date | null;
  slotVersion: number;
  createdAt: Date;
  updatedAt: Date;
  spiritDefinition: {
    spiritId: string;
    label: string;
    rarity: unknown;
    factionAffinity: string;
    role: unknown;
    shardName: string;
    shardUnlockRequired: number;
    baseAttack: number;
    baseHp: number;
    growthAttack: number;
    growthHp: number;
    lore: string | null;
  } | null;
}): Record<string, unknown> {
  return normalizeDates({
    id: slot.id,
    playerId: slot.playerId,
    slotIndex: slot.slotIndex,
    isMain: slot.isMain,
    spiritId: slot.spiritDefinition?.spiritId ?? null,
    label: slot.spiritDefinition?.label ?? null,
    rarity: slot.spiritDefinition?.rarity ?? null,
    factionAffinity: slot.spiritDefinition?.factionAffinity ?? null,
    role: slot.spiritDefinition?.role ?? null,
    element: slot.element,
    level: slot.level,
    exp: slot.exp,
    currentHp: slot.currentHp,
    maxHp: slot.maxHp,
    status: slot.status,
    baseAttack: slot.spiritDefinition?.baseAttack ?? null,
    baseHp: slot.spiritDefinition?.baseHp ?? null,
    growthAttack: slot.spiritDefinition?.growthAttack ?? null,
    growthHp: slot.spiritDefinition?.growthHp ?? null,
    shardName: slot.spiritDefinition?.shardName ?? null,
    shardUnlockRequired: slot.spiritDefinition?.shardUnlockRequired ?? null,
    lore: slot.spiritDefinition?.lore ?? null,
    acquiredAt: slot.acquiredAt,
    dissolvedAt: slot.dissolvedAt,
    slotVersion: slot.slotVersion,
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt,
  });
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function parseBoolean(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}
