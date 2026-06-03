import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { APP_NAME, type ClientSeasonMedal, type ClientSeasonRewardGrant, type ClientSeasonRewardItem, type ClientSeasonRewardsResponse, type ClientSeasonSignInState } from '@trinitywar/shared';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { getLocalDateKey } from '../lib/date-key.js';

const SEASON_LENGTH_DAYS = 28;
const SEASON_START_UTC = new Date('2026-05-03T16:00:00.000Z');
const SEASON_MS = SEASON_LENGTH_DAYS * 24 * 60 * 60 * 1000;

type PrismaClientLike = Prisma.TransactionClient | PrismaClient;
type SeasonRewardDomain = 'participation' | 'farming' | 'spirit' | 'combat' | 'contribution';

interface SeasonRewardRule {
  rewardType: string;
  rewardTier: string;
  domain: SeasonRewardDomain;
  achievementKey?: string;
  achievementTitle?: string;
  achievementTitleEn?: string;
  achievementDescription?: string;
  achievementDescriptionEn?: string;
  statSnapshot: Prisma.InputJsonObject;
  rewards: ClientSeasonRewardItem[];
}

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
          spiritSlots: {
            where: {
              status: { not: 'DISSOLVED' },
              spiritDefinitionId: { not: null },
            },
            select: {
              level: true,
              spiritDefinition: {
                select: {
                  spiritId: true,
                  rarity: true,
                },
              },
            },
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
      const spiritStats = buildSeasonSpiritStats(player.spiritSlots);

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
          snapshotJson: buildPlayerSeasonSnapshotJson(player, season, { signInDays, loginDays, ...spiritStats }),
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
          snapshotJson: buildPlayerSeasonSnapshotJson(player, season, { signInDays, loginDays, ...spiritStats }),
        },
      });
    }

    await this.generateSeasonRewardGrants(client, seasonNumber);

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

  async getSeasonRewards(
    client: PrismaClientLike,
    playerId: string,
    now: Date = new Date(),
  ): Promise<ClientSeasonRewardsResponse> {
    const currentSeason = await this.ensurePlayerSeason(client, playerId, now);
    const grants = await client.playerSeasonRewardGrant.findMany({
      where: { playerId },
      orderBy: [{ seasonNumber: 'desc' }, { createdAt: 'desc' }, { rewardType: 'asc' }],
    });
    const achievements = await client.playerSeasonAchievement.findMany({
      where: { playerId },
      orderBy: [{ seasonNumber: 'desc' }, { createdAt: 'desc' }, { achievementKey: 'asc' }],
      include: {
        rewardGrant: { select: { rewardType: true, rewardTier: true, status: true } },
      },
    });
    const items = grants.map(mapSeasonRewardGrant);
    const medals = achievements.map(mapSeasonMedal);

    return {
      app: APP_NAME,
      currentSeasonNumber: currentSeason.seasonNumber,
      items,
      claimableCount: items.filter((item) => item.status === 'generated' || item.status === 'notified').length,
      medalCabinet: buildSeasonMedalCabinet(currentSeason.seasonNumber, medals),
    };
  }

  async generateSeasonRewardGrants(client: PrismaClientLike, seasonNumber: number): Promise<number> {
    const snapshots = await client.playerSeasonSnapshot.findMany({
      where: { seasonNumber },
      orderBy: [{ playerId: 'asc' }],
    });
    let generatedCount = 0;

    for (const snapshot of snapshots) {
      const rewardRules = getSeasonRewardRules(snapshot);

      for (const rule of rewardRules) {
        let grant = await client.playerSeasonRewardGrant.findUnique({
          where: {
            playerId_seasonNumber_rewardType: {
              playerId: snapshot.playerId,
              seasonNumber,
              rewardType: rule.rewardType,
            },
          },
        });

        if (!grant) {
          grant = await client.playerSeasonRewardGrant.create({
            data: buildSeasonRewardGrantCreate(snapshot, rule.rewardType, rule.rewardTier, rule.rewards),
          });
        }

        await ensureSeasonAchievement(client, snapshot, grant.id, rule);
        await ensureSeasonRewardNotification(client, grant, rule.rewards);
        generatedCount += 1;
      }
    }

    return generatedCount;
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

const SEASON_REWARD_SHARD_SPIRIT_ID = 'canglang';
const TALISMAN_REWARD: ClientSeasonRewardItem = { kind: 'tianjiTalisman', quantity: 1, label: '天机符', name: '天机符', nameEn: 'Tianji Talisman' };

type SeasonRewardSnapshot = {
  playerId: string;
  seasonNumber: number;
  contributionScore: number;
  signInDays: number;
  loginDays: number;
  harvestCount: number;
  raidCount: number;
  snapshotJson: Prisma.JsonValue;
};

function getSeasonRewardRules(snapshot: SeasonRewardSnapshot): SeasonRewardRule[] {
  return [
    getParticipationRewardRule(snapshot),
    getFarmingRewardRule(snapshot),
    getSpiritRewardRule(snapshot),
    getCombatRewardRule(snapshot),
    getContributionRewardRule(snapshot),
  ].filter((rule): rule is SeasonRewardRule => rule !== null);
}

function getParticipationRewardRule(snapshot: SeasonRewardSnapshot): SeasonRewardRule | null {
  const eligible = snapshot.signInDays >= 3
    || snapshot.loginDays >= 3
    || snapshot.contributionScore >= 100
    || snapshot.harvestCount >= 3
    || snapshot.raidCount >= 1;

  return eligible
    ? {
      rewardType: 'participation',
      rewardTier: 'season-participation',
      domain: 'participation',
      statSnapshot: {
        signInDays: snapshot.signInDays,
        loginDays: snapshot.loginDays,
        contributionScore: snapshot.contributionScore,
        harvestCount: snapshot.harvestCount,
        raidCount: snapshot.raidCount,
      },
      rewards: [
        tianjiTalisman(1),
        essence('qinglingmai', 2, '青灵麦', 'Qinglingmai'),
      ],
    }
    : null;
}

function getFarmingRewardRule(snapshot: SeasonRewardSnapshot): SeasonRewardRule | null {
  if (snapshot.harvestCount >= 50) {
    return buildDomainRewardRule({
      rewardType: 'domain_farming',
      rewardTier: 'season-farming-gold',
      domain: 'farming',
      achievementTitle: '赛季耕耘金章',
      achievementTitleEn: 'Season Farming Gold',
      achievementDescription: '本赛季累计收获不少于 50 次。',
      achievementDescriptionEn: 'Harvested at least 50 times in the season.',
      statSnapshot: { harvestCount: snapshot.harvestCount },
      rewards: [
        essence('qianjiteng', 8, '千机藤', 'Qianjiteng'),
      ],
    });
  }

  if (snapshot.harvestCount >= 20) {
    return buildDomainRewardRule({
      rewardType: 'domain_farming',
      rewardTier: 'season-farming-silver',
      domain: 'farming',
      achievementTitle: '赛季耕耘银章',
      achievementTitleEn: 'Season Farming Silver',
      achievementDescription: '本赛季累计收获不少于 20 次。',
      achievementDescriptionEn: 'Harvested at least 20 times in the season.',
      statSnapshot: { harvestCount: snapshot.harvestCount },
      rewards: [
        essence('ninglucao', 6, '凝露草', 'Ninglucao'),
      ],
    });
  }

  if (snapshot.harvestCount >= 3) {
    return buildDomainRewardRule({
      rewardType: 'domain_farming',
      rewardTier: 'season-farming-bronze',
      domain: 'farming',
      achievementTitle: '赛季耕耘铜章',
      achievementTitleEn: 'Season Farming Bronze',
      achievementDescription: '本赛季累计收获不少于 3 次。',
      achievementDescriptionEn: 'Harvested at least 3 times in the season.',
      statSnapshot: { harvestCount: snapshot.harvestCount },
      rewards: [
        essence('qinglingmai', 3, '青灵麦', 'Qinglingmai'),
      ],
    });
  }

  return null;
}

function getSpiritRewardRule(snapshot: SeasonRewardSnapshot): SeasonRewardRule | null {
  const spiritOwnedCount = getSnapshotNumber(snapshot.snapshotJson, 'spiritOwnedCount');
  const maxSpiritLevel = getSnapshotNumber(snapshot.snapshotJson, 'maxSpiritLevel');

  if (maxSpiritLevel >= 20) {
    return buildDomainRewardRule({
      rewardType: 'domain_spirit',
      rewardTier: 'season-spirit-gold',
      domain: 'spirit',
      achievementTitle: '赛季御灵金章',
      achievementTitleEn: 'Season Spirit Gold',
      achievementDescription: '本赛季拥有等级不低于 20 的灵宠。',
      achievementDescriptionEn: 'Raised a spirit to level 20 or higher in the season.',
      statSnapshot: { spiritOwnedCount, maxSpiritLevel },
      rewards: [
        rareSoul(2),
        spiritShard(8),
      ],
    });
  }

  if (maxSpiritLevel >= 10) {
    return buildDomainRewardRule({
      rewardType: 'domain_spirit',
      rewardTier: 'season-spirit-silver',
      domain: 'spirit',
      achievementTitle: '赛季御灵银章',
      achievementTitleEn: 'Season Spirit Silver',
      achievementDescription: '本赛季拥有等级不低于 10 的灵宠。',
      achievementDescriptionEn: 'Raised a spirit to level 10 or higher in the season.',
      statSnapshot: { spiritOwnedCount, maxSpiritLevel },
      rewards: [
        ordinarySoul(8),
        spiritShard(5),
      ],
    });
  }

  if (spiritOwnedCount >= 1) {
    return buildDomainRewardRule({
      rewardType: 'domain_spirit',
      rewardTier: 'season-spirit-bronze',
      domain: 'spirit',
      achievementTitle: '赛季御灵铜章',
      achievementTitleEn: 'Season Spirit Bronze',
      achievementDescription: '本赛季至少持有 1 只灵宠。',
      achievementDescriptionEn: 'Owned at least one spirit during the season.',
      statSnapshot: { spiritOwnedCount, maxSpiritLevel },
      rewards: [
        ordinarySoul(3),
        spiritShard(3),
      ],
    });
  }

  return null;
}

function getCombatRewardRule(snapshot: SeasonRewardSnapshot): SeasonRewardRule | null {
  if (snapshot.raidCount >= 20) {
    return buildDomainRewardRule({
      rewardType: 'domain_combat',
      rewardTier: 'season-combat-gold',
      domain: 'combat',
      achievementTitle: '赛季远征金章',
      achievementTitleEn: 'Season Combat Gold',
      achievementDescription: '本赛季已结算探索战斗不少于 20 次。',
      achievementDescriptionEn: 'Settled at least 20 raids in the season.',
      statSnapshot: { raidCount: snapshot.raidCount },
      rewards: [
        rareSoul(2),
        spiritShard(8),
      ],
    });
  }

  if (snapshot.raidCount >= 5) {
    return buildDomainRewardRule({
      rewardType: 'domain_combat',
      rewardTier: 'season-combat-silver',
      domain: 'combat',
      achievementTitle: '赛季远征银章',
      achievementTitleEn: 'Season Combat Silver',
      achievementDescription: '本赛季已结算探索战斗不少于 5 次。',
      achievementDescriptionEn: 'Settled at least 5 raids in the season.',
      statSnapshot: { raidCount: snapshot.raidCount },
      rewards: [
        ordinarySoul(8),
        spiritShard(5),
      ],
    });
  }

  if (snapshot.raidCount >= 1) {
    return buildDomainRewardRule({
      rewardType: 'domain_combat',
      rewardTier: 'season-combat-bronze',
      domain: 'combat',
      achievementTitle: '赛季远征铜章',
      achievementTitleEn: 'Season Combat Bronze',
      achievementDescription: '本赛季已结算探索战斗不少于 1 次。',
      achievementDescriptionEn: 'Settled at least 1 raid in the season.',
      statSnapshot: { raidCount: snapshot.raidCount },
      rewards: [
        ordinarySoul(3),
        spiritShard(2),
      ],
    });
  }

  return null;
}

function getContributionRewardRule(snapshot: SeasonRewardSnapshot): SeasonRewardRule | null {
  if (snapshot.contributionScore >= 3000) {
    return buildDomainRewardRule({
      rewardType: 'contribution_tier',
      rewardTier: 'season-contribution-3000',
      domain: 'contribution',
      achievementTitle: '赛季贡献金章',
      achievementTitleEn: 'Season Contribution Gold',
      achievementDescription: '本赛季阵营贡献达到 3000。',
      achievementDescriptionEn: 'Reached 3000 contribution in the season.',
      statSnapshot: { contributionScore: snapshot.contributionScore },
      rewards: [
        tianjiTalisman(10),
        essence('xueyuehua', 10, '雪月花', 'Xueyuehua'),
        rareSoul(3),
        spiritShard(10),
      ],
    });
  }

  if (snapshot.contributionScore >= 1500) {
    return buildDomainRewardRule({
      rewardType: 'contribution_tier',
      rewardTier: 'season-contribution-1500',
      domain: 'contribution',
      achievementTitle: '赛季贡献银章',
      achievementTitleEn: 'Season Contribution Silver',
      achievementDescription: '本赛季阵营贡献达到 1500。',
      achievementDescriptionEn: 'Reached 1500 contribution in the season.',
      statSnapshot: { contributionScore: snapshot.contributionScore },
      rewards: [
        tianjiTalisman(7),
        essence('huichuncao', 8, '回春草', 'Huichuncao'),
        rareSoul(2),
        spiritShard(8),
      ],
    });
  }

  if (snapshot.contributionScore >= 800) {
    return buildDomainRewardRule({
      rewardType: 'contribution_tier',
      rewardTier: 'season-contribution-800',
      domain: 'contribution',
      achievementTitle: '赛季贡献铜章',
      achievementTitleEn: 'Season Contribution Bronze',
      achievementDescription: '本赛季阵营贡献达到 800。',
      achievementDescriptionEn: 'Reached 800 contribution in the season.',
      statSnapshot: { contributionScore: snapshot.contributionScore },
      rewards: [
        tianjiTalisman(5),
        essence('qianjiteng', 6, '千机藤', 'Qianjiteng'),
        ordinarySoul(10),
        spiritShard(6),
      ],
    });
  }

  if (snapshot.contributionScore >= 300) {
    return buildDomainRewardRule({
      rewardType: 'contribution_tier',
      rewardTier: 'season-contribution-300',
      domain: 'contribution',
      achievementTitle: '赛季贡献入门章',
      achievementTitleEn: 'Season Contribution Entry',
      achievementDescription: '本赛季阵营贡献达到 300。',
      achievementDescriptionEn: 'Reached 300 contribution in the season.',
      statSnapshot: { contributionScore: snapshot.contributionScore },
      rewards: [
        tianjiTalisman(3),
        essence('ninglucao', 5, '凝露草', 'Ninglucao'),
        ordinarySoul(5),
        spiritShard(4),
      ],
    });
  }

  if (snapshot.contributionScore >= 100) {
    return buildDomainRewardRule({
      rewardType: 'contribution_tier',
      rewardTier: 'season-contribution-100',
      domain: 'contribution',
      achievementTitle: '赛季贡献起步章',
      achievementTitleEn: 'Season Contribution Starter',
      achievementDescription: '本赛季阵营贡献达到 100。',
      achievementDescriptionEn: 'Reached 100 contribution in the season.',
      statSnapshot: { contributionScore: snapshot.contributionScore },
      rewards: [
        tianjiTalisman(2),
        essence('qinglingmai', 3, '青灵麦', 'Qinglingmai'),
        ordinarySoul(3),
        spiritShard(2),
      ],
    });
  }

  return null;
}

function buildDomainRewardRule(input: Omit<SeasonRewardRule, 'achievementKey'>): SeasonRewardRule {
  const achievementKey = input.rewardTier;
  return {
    ...input,
    achievementKey,
    statSnapshot: {
      ...input.statSnapshot,
      titleEn: input.achievementTitleEn ?? input.achievementTitle ?? input.rewardTier,
      descriptionEn: input.achievementDescriptionEn ?? input.achievementDescription ?? input.rewardTier,
    },
    rewards: [
      ...input.rewards,
      {
        kind: 'medal',
        quantity: 1,
        label: input.achievementTitle ?? input.rewardTier,
        name: input.achievementTitle ?? input.rewardTier,
        nameEn: `${input.achievementTitleEn ?? input.rewardTier} Medal`,
        medalKey: achievementKey,
        domain: input.domain,
      },
    ],
  };
}

function getSnapshotNumber(snapshotJson: Prisma.JsonValue, key: string): number {
  if (typeof snapshotJson !== 'object' || snapshotJson === null || Array.isArray(snapshotJson)) {
    return 0;
  }

  const value = (snapshotJson as Record<string, Prisma.JsonValue>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function tianjiTalisman(quantity: number): ClientSeasonRewardItem {
  return { ...TALISMAN_REWARD, quantity };
}

function essence(essenceType: string, quantity: number, name: string, nameEn: string): ClientSeasonRewardItem {
  return { kind: 'essence', essenceType, quantity, label: `${name}精华`, name: `${name}精华`, nameEn: `${nameEn} Essence` };
}

function ordinarySoul(quantity: number): ClientSeasonRewardItem {
  return { kind: 'ordinarySoul', quantity, label: '普通兽魂', name: '普通兽魂', nameEn: 'Ordinary Soul' };
}

function rareSoul(quantity: number): ClientSeasonRewardItem {
  return { kind: 'rareSoul', quantity, label: '稀有兽魂', name: '稀有兽魂', nameEn: 'Rare Soul' };
}

function spiritShard(quantity: number): ClientSeasonRewardItem {
  return { kind: 'spiritShard', spiritId: SEASON_REWARD_SHARD_SPIRIT_ID, quantity, label: '苍狼精魄', name: '苍狼精魄', nameEn: 'Canglang Shard' };
}

async function ensureSeasonAchievement(
  client: PrismaClientLike,
  snapshot: SeasonRewardSnapshot,
  rewardGrantId: string,
  rule: SeasonRewardRule,
): Promise<void> {
  if (!rule.achievementKey || !rule.achievementTitle || !rule.achievementDescription) {
    return;
  }

  await client.playerSeasonAchievement.upsert({
    where: {
      playerId_seasonNumber_achievementKey: {
        playerId: snapshot.playerId,
        seasonNumber: snapshot.seasonNumber,
        achievementKey: rule.achievementKey,
      },
    },
    create: {
      player: { connect: { id: snapshot.playerId } },
      season: { connect: { seasonNumber: snapshot.seasonNumber } },
      rewardGrant: { connect: { id: rewardGrantId } },
      domain: rule.domain,
      achievementKey: rule.achievementKey,
      title: rule.achievementTitle,
      description: rule.achievementDescription,
      contributionSnapshot: snapshot.contributionScore,
      statSnapshotJson: rule.statSnapshot,
    },
    update: {
      rewardGrant: { connect: { id: rewardGrantId } },
      domain: rule.domain,
      title: rule.achievementTitle,
      description: rule.achievementDescription,
      contributionSnapshot: snapshot.contributionScore,
      statSnapshotJson: rule.statSnapshot,
    },
  });
}

async function ensureSeasonRewardNotification(
  client: PrismaClientLike,
  grant: {
    id: string;
    playerId: string;
    seasonNumber: number;
    rewardType: string;
    rewardTier: string | null;
    notificationId: string | null;
    status: string;
  },
  rewards: ClientSeasonRewardItem[],
): Promise<void> {
  if (grant.notificationId || grant.status === 'claimed' || grant.status === 'voided') {
    return;
  }

  const expiresAt = getSeasonRewardNotificationExpiresAt(grant.seasonNumber);
  const title = `S${grant.seasonNumber} 赛季奖励`;
  const body = `你在 S${grant.seasonNumber} 赛季获得了${getSeasonRewardTypeLabel(grant.rewardType)}奖励，请在过期前领取。`;
  const notification = await client.playerNotification.create({
    data: {
      playerId: grant.playerId,
      category: 'REWARD',
      titleSnapshot: title,
      bodySnapshot: body,
      attachmentJson: buildSeasonRewardNotificationAttachmentJson(grant.id, rewards),
      expiresAt,
      claimStatus: 'UNCLAIMED',
    },
    select: { id: true },
  });

  await client.playerSeasonRewardGrant.update({
    where: { id: grant.id },
    data: {
      status: 'notified',
      notificationId: notification.id,
    },
  });
}

function getSeasonRewardNotificationExpiresAt(seasonNumber: number): Date {
  const seasonEndsAt = new Date(SEASON_START_UTC.getTime() + Math.max(seasonNumber, 1) * SEASON_MS);
  return new Date(seasonEndsAt.getTime() + 35 * 24 * 60 * 60 * 1000);
}

function getSeasonRewardTypeLabel(rewardType: string): string {
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

function buildSeasonRewardNotificationAttachmentJson(
  grantId: string,
  rewards: ClientSeasonRewardItem[],
): Prisma.InputJsonValue {
  return rewards.map((reward) => ({
    kind: reward.kind,
    quantity: reward.quantity,
    label: reward.label,
    ...(reward.name ? { name: reward.name } : {}),
    ...(reward.nameEn ? { nameEn: reward.nameEn } : {}),
    ...(reward.essenceType ? { essenceType: reward.essenceType } : {}),
    ...(reward.spiritId ? { spiritId: reward.spiritId } : {}),
    ...(reward.medalKey ? { medalKey: reward.medalKey } : {}),
    ...(reward.domain ? { domain: reward.domain } : {}),
    sourceType: 'season-reward',
    sourceId: grantId,
  })) as Prisma.InputJsonValue;
}

function buildSeasonRewardGrantCreate(
  snapshot: {
    playerId: string;
    seasonNumber: number;
    contributionScore: number;
    signInDays: number;
    loginDays: number;
    harvestCount: number;
    raidCount: number;
  },
  rewardType: string,
  rewardTier: string,
  rewards: ClientSeasonRewardItem[],
): Prisma.PlayerSeasonRewardGrantCreateInput {
  return {
    player: { connect: { id: snapshot.playerId } },
    season: { connect: { seasonNumber: snapshot.seasonNumber } },
    rewardType,
    rewardTier,
    contributionSnapshot: snapshot.contributionScore,
    signInDays: snapshot.signInDays,
    loginDays: snapshot.loginDays,
    harvestCount: snapshot.harvestCount,
    raidCount: snapshot.raidCount,
    rewardJson: rewards as unknown as Prisma.InputJsonValue,
  };
}

function mapSeasonRewardGrant(grant: {
  id: string;
  seasonNumber: number;
  rewardType: string;
  rewardTier: string | null;
  status: string;
  contributionSnapshot: number;
  signInDays: number;
  loginDays: number;
  harvestCount: number;
  raidCount: number;
  rewardJson: Prisma.JsonValue;
  claimedAt: Date | null;
  createdAt: Date;
}): ClientSeasonRewardGrant {
  const normalizedStatus = grant.status === 'notified' || grant.status === 'claimed' || grant.status === 'voided' ? grant.status : 'generated';
  return {
    id: grant.id,
    seasonNumber: grant.seasonNumber,
    rewardType: grant.rewardType,
    rewardTier: grant.rewardTier,
    status: normalizedStatus,
    contributionSnapshot: grant.contributionSnapshot,
    signInDays: grant.signInDays,
    loginDays: grant.loginDays,
    harvestCount: grant.harvestCount,
    raidCount: grant.raidCount,
    rewards: normalizeSeasonRewardItems(grant.rewardJson),
    claimedAt: grant.claimedAt?.toISOString() ?? null,
    createdAt: grant.createdAt.toISOString(),
  };
}

function mapSeasonMedal(achievement: {
  id: string;
  seasonNumber: number;
  domain: string;
  achievementKey: string;
  title: string;
  description: string;
  statSnapshotJson: Prisma.JsonValue;
  rewardGrantId: string | null;
  createdAt: Date;
  rewardGrant: { rewardType: string; rewardTier: string | null; status: string } | null;
}): ClientSeasonMedal {
  const statSnapshot = normalizeJsonObject(achievement.statSnapshotJson);
  const titleEn = typeof statSnapshot.titleEn === 'string' ? statSnapshot.titleEn : undefined;
  const descriptionEn = typeof statSnapshot.descriptionEn === 'string' ? statSnapshot.descriptionEn : undefined;
  const normalizedStatus = achievement.rewardGrant?.status === 'notified'
    || achievement.rewardGrant?.status === 'claimed'
    || achievement.rewardGrant?.status === 'voided'
      ? achievement.rewardGrant.status
      : achievement.rewardGrant ? 'generated' : null;

  return {
    id: achievement.id,
    seasonNumber: achievement.seasonNumber,
    domain: achievement.domain,
    achievementKey: achievement.achievementKey,
    title: achievement.title,
    ...(titleEn ? { titleEn } : {}),
    description: achievement.description,
    ...(descriptionEn ? { descriptionEn } : {}),
    rewardGrantId: achievement.rewardGrantId,
    rewardType: achievement.rewardGrant?.rewardType ?? null,
    rewardTier: achievement.rewardGrant?.rewardTier ?? null,
    rewardStatus: normalizedStatus,
    statSnapshot,
    createdAt: achievement.createdAt.toISOString(),
  };
}

function buildSeasonMedalCabinet(currentSeasonNumber: number, medals: ClientSeasonMedal[]): ClientSeasonRewardsResponse['medalCabinet'] {
  const seasonNumbers = Array.from(new Set([
    currentSeasonNumber,
    ...medals.map((medal) => medal.seasonNumber),
  ])).sort((left, right) => right - left);

  return {
    currentSeasonNumber,
    currentSeasonTitle: `S${currentSeasonNumber}赛季奖章陈列柜`,
    medals,
    medalsBySeason: seasonNumbers.map((seasonNumber) => ({
      seasonNumber,
      title: `S${seasonNumber}赛季奖章陈列柜`,
      medals: medals.filter((medal) => medal.seasonNumber === seasonNumber),
    })),
  };
}

function normalizeJsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(Object.entries(value));
}

function normalizeSeasonRewardItems(value: Prisma.JsonValue): ClientSeasonRewardItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeSeasonRewardItem(item))
    .filter((item): item is ClientSeasonRewardItem => item !== null);
}

function normalizeSeasonRewardItem(value: Prisma.JsonValue): ClientSeasonRewardItem | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, Prisma.JsonValue>;
  const kind = typeof record.kind === 'string' ? record.kind : '';
  const quantity = typeof record.quantity === 'number' ? Math.max(Math.floor(record.quantity), 0) : 0;
  const label = typeof record.label === 'string' && record.label.trim().length > 0 ? record.label : kind;
  const name = typeof record.name === 'string' && record.name.trim().length > 0 ? record.name.trim() : label;
  const nameEn = typeof record.nameEn === 'string' && record.nameEn.trim().length > 0 ? record.nameEn.trim() : undefined;

  if (quantity <= 0) {
    return null;
  }

  if (kind === 'tianjiTalisman') {
    return { kind, quantity, label, name, ...(nameEn ? { nameEn } : {}) };
  }

  if (kind === 'spiritSoul' || kind === 'ordinarySoul' || kind === 'rareSoul' || kind === 'legendarySoul') {
    return { kind, quantity, label, name, ...(nameEn ? { nameEn } : {}) };
  }

  if (kind === 'essence') {
    const essenceType = typeof record.essenceType === 'string' ? record.essenceType.trim() : '';
    if (!essenceType) {
      return null;
    }
    return { kind, essenceType, quantity, label, name, ...(nameEn ? { nameEn } : {}) };
  }

  if (kind === 'spiritShard') {
    const spiritId = typeof record.spiritId === 'string' ? record.spiritId.trim() : '';
    if (!spiritId) {
      return null;
    }
    return { kind, spiritId, quantity, label, name, ...(nameEn ? { nameEn } : {}) };
  }

  if (kind === 'medal') {
    const medalKey = typeof record.medalKey === 'string' ? record.medalKey.trim() : '';
    const domain = typeof record.domain === 'string' ? record.domain.trim() : '';
    if (!medalKey) {
      return null;
    }
    return {
      kind,
      medalKey,
      quantity,
      label,
      name,
      ...(nameEn ? { nameEn } : {}),
      ...(domain ? { domain } : {}),
    };
  }

  return null;
}

function buildSeasonSpiritStats(spiritSlots: Array<{ level: number; spiritDefinition: { spiritId: string; rarity: string } | null }>): {
  spiritOwnedCount: number;
  maxSpiritLevel: number;
} {
  return {
    spiritOwnedCount: spiritSlots.length,
    maxSpiritLevel: spiritSlots.reduce((maxLevel, slot) => Math.max(maxLevel, slot.level), 0),
  };
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
    spiritSlots: Array<{
      level: number;
      spiritDefinition: { spiritId: string; rarity: string } | null;
    }>;
  },
  season: CurrentSeasonState,
  stats: { signInDays: number; loginDays: number; spiritOwnedCount: number; maxSpiritLevel: number },
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
    spiritOwnedCount: stats.spiritOwnedCount,
    maxSpiritLevel: stats.maxSpiritLevel,
    createdAt: player.createdAt.toISOString(),
    updatedAt: player.updatedAt.toISOString(),
    lastLoginAt: player.lastLoginAt?.toISOString() ?? null,
  };
}
