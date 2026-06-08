export interface SeasonSimPlayerLike {
  spec: {
    factionCode: string;
  };
  playerId?: string;
}

export interface SeasonSimDayPlan {
  farmCycleHours: number[];
  stipendHour: number;
  spiritGrowthHour: number;
  raidRoundHours: number[];
  snapshotHour: number;
  expectedActionsPerPlayer: number;
}

export interface SeasonSimProgress {
  totalDays: number;
  completedDays: number;
  remainingDays: number;
  progressPercent: number;
}

export type RobotLoopBoundary =
  | { ok: true }
  | { ok: true; alreadyRunning: true; reason: 'loop already running' | 'season simulation already running' }
  | { ok: false; blocked: true; reason: 'season simulation is running' | 'another robot loop is running' };

export const SEASON_SIM_FARM_CYCLES_PER_DAY = 8;
export const SEASON_SIM_FARM_CYCLE_HOURS = 3;
export const SEASON_SIM_RAIDS_PER_DAY = 3;
export const SEASON_SIM_DEFAULT_TOTAL_DAYS = 28;
export const SEASON_SIM_DEFAULT_START_AT = new Date('2026-06-08T00:00:00+08:00');
export const SEASON_SIM_DEFAULT_ACTION_DELAY_MS = 250;

export function buildSeasonSimDayPlan(): SeasonSimDayPlan {
  const farmCycleHours = Array.from({ length: SEASON_SIM_FARM_CYCLES_PER_DAY }, (_, index) => (
    index * SEASON_SIM_FARM_CYCLE_HOURS
  ));
  const lastFarmHour = farmCycleHours[farmCycleHours.length - 1] ?? 0;

  return {
    farmCycleHours,
    stipendHour: lastFarmHour,
    spiritGrowthHour: lastFarmHour,
    raidRoundHours: Array.from({ length: SEASON_SIM_RAIDS_PER_DAY }, (_, index) => lastFarmHour + index),
    snapshotHour: lastFarmHour + SEASON_SIM_RAIDS_PER_DAY,
    expectedActionsPerPlayer: getSeasonSimExpectedActionsPerPlayer(),
  };
}

export function getSeasonSimExpectedActionsPerPlayer(): number {
  return SEASON_SIM_FARM_CYCLES_PER_DAY + 1 + 1 + SEASON_SIM_RAIDS_PER_DAY;
}

export function getSeasonSimExpectedActionCount(playerCount: number): number {
  return Math.max(Math.floor(playerCount), 0) * getSeasonSimExpectedActionsPerPlayer();
}

export function buildSeasonSimProgress(totalDays: number, currentDayIndex: number): SeasonSimProgress {
  const normalizedTotalDays = Math.max(Math.floor(totalDays), 1);
  const completedDays = Math.min(Math.max(Math.floor(currentDayIndex), 0), normalizedTotalDays);

  return {
    totalDays: normalizedTotalDays,
    completedDays,
    remainingDays: normalizedTotalDays - completedDays,
    progressPercent: Math.round((completedDays / normalizedTotalDays) * 100),
  };
}

export function evaluateSeasonSimStartBoundary(input: { loopRunning: boolean; seasonRunning: boolean }): RobotLoopBoundary {
  if (input.loopRunning) {
    return {
      ok: false,
      blocked: true,
      reason: 'another robot loop is running',
    };
  }
  if (input.seasonRunning) {
    return {
      ok: true,
      alreadyRunning: true,
      reason: 'season simulation already running',
    };
  }
  return { ok: true };
}

export function evaluateRobotLoopStartBoundary(input: { loopRunning: boolean; seasonRunning: boolean }): RobotLoopBoundary {
  if (input.seasonRunning) {
    return {
      ok: false,
      blocked: true,
      reason: 'season simulation is running',
    };
  }
  if (input.loopRunning) {
    return {
      ok: true,
      alreadyRunning: true,
      reason: 'loop already running',
    };
  }
  return { ok: true };
}

export function findSeasonSimRaidTarget<T extends SeasonSimPlayerLike>(
  players: T[],
  currentIndex: number,
  raidRound: number,
): T | null {
  const current = players[currentIndex];
  if (!current || players.length <= 1) {
    return null;
  }

  const candidates = players.filter((candidate, index) => (
    index !== currentIndex
    && candidate.playerId !== current.playerId
    && candidate.spec.factionCode !== current.spec.factionCode
  ));
  if (candidates.length <= 0) {
    return null;
  }

  return candidates[(currentIndex + raidRound - 1) % candidates.length] ?? null;
}

export function validateSeasonSimRaidTargets(players: SeasonSimPlayerLike[]): Array<Record<string, unknown>> {
  const issues: Array<Record<string, unknown>> = [];

  for (let index = 0; index < players.length; index += 1) {
    const player = players[index];
    for (let raidRound = 1; raidRound <= SEASON_SIM_RAIDS_PER_DAY; raidRound += 1) {
      const target = findSeasonSimRaidTarget(players, index, raidRound);
      if (!target) {
        issues.push({
          code: 'NO_CROSS_FACTION_TARGET',
          playerIndex: index,
          playerId: player.playerId ?? null,
          raidRound,
        });
        continue;
      }
      if (target === player || target.playerId === player.playerId) {
        issues.push({
          code: 'SELF_RAID_TARGET',
          playerIndex: index,
          playerId: player.playerId ?? null,
          raidRound,
        });
      }
      if (target.spec.factionCode === player.spec.factionCode) {
        issues.push({
          code: 'SAME_FACTION_RAID_TARGET',
          playerIndex: index,
          playerId: player.playerId ?? null,
          targetPlayerId: target.playerId ?? null,
          raidRound,
          factionCode: player.spec.factionCode,
        });
      }
    }
  }

  return issues;
}
