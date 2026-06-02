import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { ClientSeasonSignInState } from '@trinitywar/shared';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { getLocalDateKey } from '../lib/date-key.js';

const SEASON_LENGTH_DAYS = 28;
const SEASON_START_UTC = new Date('2026-05-03T16:00:00.000Z');
const SEASON_MS = SEASON_LENGTH_DAYS * 24 * 60 * 60 * 1000;

type PrismaClientLike = Prisma.TransactionClient | PrismaClient;

export interface CurrentSeasonState {
  seasonNumber: number;
  currentWeek: number;
  totalWeeks: number;
  startsAt: Date;
  endsAt: Date;
}

export interface SeasonSnapshotResult {
  seasonNumber: number;
  playerSnapshotCount: number;
  factionSnapshotCount: number;
}

interface GenerateSeasonSnapshotsOptions {
  preserveExisting?: boolean;
}

export interface SeasonSignInClaimResult {
  signIn: ClientSeasonSignInState;
  rewardTianjiTalisman: number;
  tianjiTalisman: number;
  resourceVersion: number;
}

@Injectable()
export class SeasonService {
  getCurrentSeason(now: Date = new Date()): CurrentSeasonState {
    const elapsedMs = Math.max(now.getTime() - SEASON_START_UTC.getTime(), 0);
    const seasonIndex = Math.floor(elapsedMs / SEASON_MS);
    const seasonNumber = seasonIndex + 1;
    const startsAt = new Date(SEASON_START_UTC.getTime() + seasonIndex * SEASON_MS);
    const endsAt = new Date(startsAt.getTime() + SEASON_MS);
    const elapsedInSeasonMs = Math.max(now.getTime() - startsAt.getTime(), 0);
    const currentDay = Math.min(Math.floor(elapsedInSeasonMs / (24 * 60 * 60 * 1000)) + 1, SEASON_LENGTH_DAYS);

    return {
      seasonNumber,
      currentWeek: Math.min(Math.ceil(currentDay / 7), 4),
      totalWeeks: 4,
      startsAt,
      endsAt,
    };
  }

  async ensurePlayerSeason(client: PrismaClientLike, playerId: string, now: Date = new Date()): Promise<CurrentSeasonState> {
    const season = this.getCurrentSeason(now);

    await this.ensureCurrentSeasonRecord(client, season);

    const state = await client.playerSeasonState.findUnique({
      where: { playerId },
      select: { lastResetSeasonNumber: true },
    });

    if (!state) {
      await client.playerSeasonState.create({
        data: {
          playerId,
          currentSeasonNumber: season.seasonNumber,
          lastResetSeasonNumber: season.seasonNumber,
        },
      });
      return season;
    }

    if (state.lastResetSeasonNumber < season.seasonNumber) {
      await this.generateSeasonSnapshotsBeforeReset(client, state.lastResetSeasonNumber);
      await this.resetPlayerForNewSeason(client, playerId, season.seasonNumber, now);
      return season;
    }

    await client.playerSeasonState.update({
      where: { playerId },
      data: { currentSeasonNumber: season.seasonNumber },
    });

    return season;
  }

  async generateSeasonSnapshots(
    client: PrismaClientLike,
    seasonNumber: number,
    options: GenerateSeasonSnapshotsOptions = {},
  ): Promise<SeasonSnapshotResult> {
    const season = await this.ensureSeasonRecord(client, seasonNumber);
    const [factions, players] = await Promise.all([
      client.faction.findMany({
        orderBy: [{ contributionScore: 'desc' }, { treasuryGold: 'desc' }, { name: 'asc' }],
        include: {
          _count: { select: { members: true } },
        },
      }),
      client.player.findMany({
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          nickname: true,
          factionId: true,
          castleLevelCache: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          faction: { select: { code: true, name: true } },
          factionMembers: {
            select: {
              contributionScore: true,
              faction: { select: { id: true, code: true, name: true } },
            },
            take: 1,
          },
          fieldHarvestLogs: {
            where: { createdAt: { gte: season.startsAt, lt: season.endsAt } },
            select: { id: true },
          },
          attackRaidOrders: {
            where: { createdAt: { gte: season.startsAt, lt: season.endsAt }, status: 'SETTLED' },
            select: { id: true },
          },
          seasonSignIns: {
            where: { seasonNumber },
            select: { id: true },
          },
          seasonActivities: {
            where: { seasonNumber },
            select: { id: true },
          },
        },
      }),
    ]);

    const sortedPlayers = [...players].sort((left, right) => {
      const leftContribution = left.factionMembers[0]?.contributionScore ?? 0;
      const rightContribution = right.factionMembers[0]?.contributionScore ?? 0;
      if (rightContribution !== leftContribution) {
        return rightContribution - leftContribution;
      }
      return left.id.localeCompare(right.id);
    });
    const playerRanks = new Map(sortedPlayers.map((player, index) => [player.id, index + 1]));

    for (const [index, faction] of factions.entries()) {
      if (options.preserveExisting) {
        const existingFactionSnapshot = await client.factionSeasonSnapshot.findUnique({
          where: { factionId_seasonNumber: { factionId: faction.id, seasonNumber } },
          select: { id: true },
        });

        if (existingFactionSnapshot) {
          continue;
        }
      }

      await client.factionSeasonSnapshot.upsert({
        where: { factionId_seasonNumber: { factionId: faction.id, seasonNumber } },
        create: {
          factionId: faction.id,
          seasonNumber,
          contributionScore: faction.contributionScore,
          memberCount: faction._count.members,
          finalRank: index + 1,
          snapshotJson: {
            factionCode: faction.code,
            factionName: faction.name,
            treasuryGold: faction.treasuryGold,
            hourlyBaseDividend: faction.hourlyBaseDividend,
            hourlyContributionDividendPerTen: faction.hourlyContributionDividendPerTen,
          },
        },
        update: {
          contributionScore: faction.contributionScore,
          memberCount: faction._count.members,
          finalRank: index + 1,
          snapshotJson: {
            factionCode: faction.code,
            factionName: faction.name,
            treasuryGold: faction.treasuryGold,
            hourlyBaseDividend: faction.hourlyBaseDividend,
            hourlyContributionDividendPerTen: faction.hourlyContributionDividendPerTen,
          },
        },
      });
    }

    for (const player of players) {
      if (options.preserveExisting) {
        const existingPlayerSnapshot = await client.playerSeasonSnapshot.findUnique({
          where: { playerId_seasonNumber: { playerId: player.id, seasonNumber } },
          select: { id: true },
        });

        if (existingPlayerSnapshot) {
          continue;
        }
      }

      const membership = player.factionMembers[0];
      const contributionScore = membership?.contributionScore ?? 0;
      const factionId = player.factionId ?? membership?.faction.id ?? null;
      const harvestCount = player.fieldHarvestLogs.length;
      const raidCount = player.attackRaidOrders.length;
      const signInDays = player.seasonSignIns.length;
      const loginDays = player.seasonActivities.length;

      await client.playerSeasonSnapshot.upsert({
        where: { playerId_seasonNumber: { playerId: player.id, seasonNumber } },
        create: {
          playerId: player.id,
          seasonNumber,
          factionId,
          contributionScore,
          signInDays,
          loginDays,
          harvestCount,
          raidCount,
          finalRank: playerRanks.get(player.id) ?? null,
          rewardTier: getContributionRewardTier(contributionScore),
          snapshotJson: buildPlayerSeasonSnapshotJson(player, season, { signInDays, loginDays }),
        },
        update: {
          factionId,
          contributionScore,
          signInDays,
          loginDays,
          harvestCount,
          raidCount,
          finalRank: playerRanks.get(player.id) ?? null,
          rewardTier: getContributionRewardTier(contributionScore),
          snapshotJson: buildPlayerSeasonSnapshotJson(player, season, { signInDays, loginDays }),
        },
      });
    }

    return {
      seasonNumber,
      playerSnapshotCount: players.length,
      factionSnapshotCount: factions.length,
    };
  }

  async ensureSeasonRecord(client: PrismaClientLike, seasonNumber: number): Promise<CurrentSeasonState> {
    const normalizedSeasonNumber = Math.max(Math.floor(seasonNumber), 1);
    const startsAt = new Date(SEASON_START_UTC.getTime() + (normalizedSeasonNumber - 1) * SEASON_MS);
    const endsAt = new Date(startsAt.getTime() + SEASON_MS);
    const season = {
      seasonNumber: normalizedSeasonNumber,
      currentWeek: 1,
      totalWeeks: 4,
      startsAt,
      endsAt,
    };

    await client.gameSeason.upsert({
      where: { seasonNumber: normalizedSeasonNumber },
      create: {
        seasonNumber: normalizedSeasonNumber,
        startsAt,
        endsAt,
      },
      update: {
        startsAt,
        endsAt,
      },
    });

    return season;
  }

  private async ensureCurrentSeasonRecord(client: PrismaClientLike, season: CurrentSeasonState): Promise<void> {
    const existingSeason = await client.gameSeason.findUnique({
      where: { seasonNumber: season.seasonNumber },
      select: { seasonNumber: true },
    });

    if (!existingSeason) {
      if (season.seasonNumber > 1) {
        await this.generateSeasonSnapshotsBeforeReset(client, season.seasonNumber - 1);
      }

      await client.gameSeason.create({
        data: {
          seasonNumber: season.seasonNumber,
          startsAt: season.startsAt,
          endsAt: season.endsAt,
        },
      });

      if (season.seasonNumber > 1) {
        await client.faction.updateMany({
          data: { contributionScore: 0 },
        });
      }

      return;
    }

    await client.gameSeason.update({
      where: { seasonNumber: season.seasonNumber },
      data: {
        startsAt: season.startsAt,
        endsAt: season.endsAt,
      },
    });
  }

  private async generateSeasonSnapshotsBeforeReset(client: PrismaClientLike, seasonNumber: number): Promise<void> {
    if (seasonNumber < 1) {
      return;
    }

    await this.generateSeasonSnapshots(client, seasonNumber, { preserveExisting: true });
  }

  async recordPlayerActivity(
    client: PrismaClientLike,
    playerId: string,
    season: CurrentSeasonState = this.getCurrentSeason(),
    now: Date = new Date(),
  ): Promise<void> {
    const dateKey = getLocalDateKey(now);
    await this.ensureSeasonRecord(client, season.seasonNumber);
    await client.playerSeasonActivity.upsert({
      where: {
        playerId_seasonNumber_dateKey: {
          playerId,
          seasonNumber: season.seasonNumber,
          dateKey,
        },
      },
      create: {
        playerId,
        seasonNumber: season.seasonNumber,
        dateKey,
        firstSeenAt: now,
        lastSeenAt: now,
      },
      update: {
        lastSeenAt: now,
      },
    });
  }

  async getSeasonSignInState(
    client: PrismaClientLike,
    playerId: string,
    now: Date = new Date(),
  ): Promise<ClientSeasonSignInState> {
    const season = await this.ensurePlayerSeason(client, playerId, now);
    return this.buildSeasonSignInState(client, playerId, season, now);
  }

  async claimSeasonSignIn(
    client: PrismaClientLike,
    playerId: string,
    now: Date = new Date(),
  ): Promise<SeasonSignInClaimResult> {
    const season = await this.ensurePlayerSeason(client, playerId, now);
    const currentDay = getSeasonDayIndex(season, now);
    const reward = getSeasonSignInReward(currentDay);

    try {
      await client.playerSeasonSignIn.create({
        data: {
          playerId,
          seasonNumber: season.seasonNumber,
          dayIndex: currentDay,
          rewardTianjiTalisman: reward,
          claimedAt: now,
        },
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new BusinessError({
          code: ErrorCode.TaskAlreadyClaimed,
          message: 'Season sign-in already claimed today.',
          statusCode: 409,
        });
      }

      throw error;
    }

    const resource = await client.playerSpiritResource.upsert({
      where: { playerId },
      create: {
        playerId,
        tianjiTalisman: reward,
      },
      update: {
        tianjiTalisman: { increment: reward },
        resourceVersion: { increment: 1 },
      },
      select: {
        tianjiTalisman: true,
        resourceVersion: true,
      },
    });

    return {
      signIn: await this.buildSeasonSignInState(client, playerId, season, now),
      rewardTianjiTalisman: reward,
      tianjiTalisman: resource.tianjiTalisman,
      resourceVersion: resource.resourceVersion,
    };
  }

  private async buildSeasonSignInState(
    client: PrismaClientLike,
    playerId: string,
    season: CurrentSeasonState,
    now: Date,
  ): Promise<ClientSeasonSignInState> {
    const currentDay = getSeasonDayIndex(season, now);
    const signIns = await buildPlayerClaimedSignIns(client, playerId, season.seasonNumber);
    const claimedDays = signIns.map((item) => item.dayIndex);
    const claimedDaySet = new Set(claimedDays);
    const totalTianjiReward = signIns.reduce((sum, item) => sum + item.rewardTianjiTalisman, 0);
    const todayReward = getSeasonSignInReward(currentDay);

    return {
      seasonNumber: season.seasonNumber,
      currentDay,
      claimedDays,
      totalTianjiReward,
      todayReward,
      claimedToday: claimedDaySet.has(currentDay),
      days: Array.from({ length: SEASON_LENGTH_DAYS }, (_, index) => {
        const day = index + 1;
        const claimed = claimedDaySet.has(day);
        return {
          day,
          reward: getSeasonSignInReward(day),
          claimed,
          current: day === currentDay,
          future: day > currentDay,
          missed: day < currentDay && !claimed,
        };
      }),
      milestones: buildSeasonSignInMilestones(claimedDays.length),
    };
  }

  private async resetPlayerForNewSeason(
    client: PrismaClientLike,
    playerId: string,
    seasonNumber: number,
    now: Date,
  ): Promise<void> {
    const activeSpiritSlots = await client.playerSpiritSlot.findMany({
      where: {
        playerId,
        status: { not: 'DISSOLVED' },
        spiritDefinitionId: { not: null },
      },
      select: {
        id: true,
        spiritDefinition: {
          select: {
            baseHp: true,
          },
        },
      },
    });

    await client.playerFieldSlot.updateMany({
        where: { playerId, isUnlocked: true },
        data: {
          status: 'EMPTY',
          seedDefinitionId: null,
          expectedEssenceYield: 0,
          stolenEssenceYield: 0,
          harvestedEssenceYield: 0,
          lastStolenAt: null,
          investedGold: 0,
          currentClaimableGold: 0,
          harvestedGoldTotal: 0,
          raidedGoldTotal: 0,
          seedAt: null,
          matureAt: null,
          readyAt: null,
          overripeAt: null,
          lastCalculatedAt: null,
          statusVersion: { increment: 1 },
        },
      });
    await client.playerWallet.updateMany({
      where: { playerId },
      data: {
        vaultGold: 0,
        walletGold: 0,
        pendingTaxGold: 0,
        pendingDividendGold: 0,
        pendingRaidOverflowGold: 0,
        pendingRaidOverflowExpiresAt: null,
        passiveSettledAt: now,
        balanceVersion: { increment: 1 },
      },
    });
    await client.playerArmy.updateMany({
      where: { playerId },
      data: {
        totalCount: 0,
        availableCount: 0,
        frozenCount: 0,
        woundedCount: 0,
        armyVersion: { increment: 1 },
      },
    });
    await client.armyTrainingQueue.updateMany({
      where: { playerId, status: { in: ['QUEUED', 'FINISHED'] } },
      data: { status: 'CANCELLED' },
    });
    await client.factionMember.updateMany({
      where: { playerId },
      data: { contributionScore: 0 },
    });
    await client.factionContributionLog.deleteMany({
      where: { playerId },
    });
    await client.playerFactionStipendState.deleteMany({
      where: { playerId },
    });
    await client.playerDailyTaskState.deleteMany({
      where: { playerId },
    });
    await client.dailyFactionTask.deleteMany({
      where: { playerId },
    });
    await client.playerSeedInventory.updateMany({
      where: { playerId },
      data: {
        quantity: 0,
        inventoryVersion: { increment: 1 },
      },
    });
    await client.raidTargetPool.deleteMany({
      where: { ownerPlayerId: playerId },
    });
    await client.raidAssetLock.updateMany({
      where: { defenderPlayerId: playerId, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    });
    await client.raidOrder.updateMany({
      where: {
        OR: [{ attackerPlayerId: playerId }, { defenderPlayerId: playerId }],
        status: { in: ['CREATED', 'LOCKED', 'SETTLING', 'BOUNTY_CREATED', 'BOUNTY_WAITING_PARTNER', 'BOUNTY_ACCEPTED'] },
      },
      data: { status: 'CANCELLED' },
    });
    await client.shareAssistCampaign.updateMany({
      where: { ownerPlayerId: playerId, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    });
    await client.player.update({
      where: { id: playerId },
      data: {
        protectedUntil: null,
        stateVersion: { increment: 1 },
      },
    });
    await client.playerSeasonState.upsert({
      where: { playerId },
      create: {
        playerId,
        currentSeasonNumber: seasonNumber,
        lastResetSeasonNumber: seasonNumber,
      },
      update: {
        currentSeasonNumber: seasonNumber,
        lastResetSeasonNumber: seasonNumber,
      },
    });

    for (const slot of activeSpiritSlots) {
      const baseHp = slot.spiritDefinition?.baseHp ?? 0;
      await client.playerSpiritSlot.update({
        where: { id: slot.id },
        data: {
          level: 1,
          exp: 0,
          breakthroughStage: 0,
          satiatedUntil: null,
          lastExpSettledAt: null,
          currentHp: baseHp,
          maxHp: baseHp,
          status: 'ACTIVE',
          slotVersion: { increment: 1 },
        },
      });
    }
  }
}

async function buildPlayerClaimedSignIns(
  client: PrismaClientLike,
  playerId: string,
  seasonNumber: number,
): Promise<Array<{ dayIndex: number; rewardTianjiTalisman: number }>> {
  return client.playerSeasonSignIn.findMany({
    where: { playerId, seasonNumber },
    orderBy: { dayIndex: 'asc' },
    select: {
      dayIndex: true,
      rewardTianjiTalisman: true,
    },
  });
}

function getSeasonDayIndex(season: CurrentSeasonState, now: Date): number {
  const elapsedMs = Math.max(now.getTime() - season.startsAt.getTime(), 0);
  return Math.min(Math.floor(elapsedMs / (24 * 60 * 60 * 1000)) + 1, SEASON_LENGTH_DAYS);
}

function getSeasonSignInReward(day: number): number {
  if (day >= 22) {
    return 4;
  }
  if (day >= 15) {
    return 3;
  }
  if (day >= 8) {
    return 2;
  }
  return 1;
}

function buildSeasonSignInMilestones(claimedDayCount: number): ClientSeasonSignInState['milestones'] {
  return [
    { dayCount: 7, title: '七日宝箱' },
    { dayCount: 14, title: '十四日宝箱' },
    { dayCount: 21, title: '二十一日宝箱' },
  ].map((milestone) => ({
    ...milestone,
    reached: claimedDayCount >= milestone.dayCount,
    remainingDays: Math.max(milestone.dayCount - claimedDayCount, 0),
  }));
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === 'P2002';
}

function getContributionRewardTier(contributionScore: number): string | null {
  if (contributionScore >= 3000) {
    return 'season-contribution-3000';
  }
  if (contributionScore >= 1500) {
    return 'season-contribution-1500';
  }
  if (contributionScore >= 800) {
    return 'season-contribution-800';
  }
  if (contributionScore >= 300) {
    return 'season-contribution-300';
  }
  if (contributionScore >= 100) {
    return 'season-contribution-100';
  }
  return null;
}

function buildPlayerSeasonSnapshotJson(
  player: {
    id: string;
    nickname: string;
    factionId: string | null;
    castleLevelCache: number;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
    faction: { code: string; name: string } | null;
    factionMembers: Array<{
      contributionScore: number;
      faction: { id: string; code: string; name: string };
    }>;
    fieldHarvestLogs: Array<{ id: string }>;
    attackRaidOrders: Array<{ id: string }>;
  },
  season: CurrentSeasonState,
  stats: { signInDays: number; loginDays: number },
): Prisma.InputJsonObject {
  const membership = player.factionMembers[0];
  return {
    playerId: player.id,
    nickname: player.nickname,
    castleLevelCache: player.castleLevelCache,
    factionId: player.factionId ?? membership?.faction.id ?? null,
    factionCode: player.faction?.code ?? membership?.faction.code ?? null,
    factionName: player.faction?.name ?? membership?.faction.name ?? null,
    seasonStartsAt: season.startsAt.toISOString(),
    seasonEndsAt: season.endsAt.toISOString(),
    signInDays: stats.signInDays,
    loginDays: stats.loginDays,
    createdAt: player.createdAt.toISOString(),
    updatedAt: player.updatedAt.toISOString(),
    lastLoginAt: player.lastLoginAt?.toISOString() ?? null,
  };
}
