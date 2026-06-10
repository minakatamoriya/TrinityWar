export interface SeasonSimPlayerLike {
  spec: {
    factionCode: string;
    activityProfileKey?: SeasonSimActivityProfileKey;
  };
  playerId?: string;
}

export type SeasonSimActivityProfileKey = 'low' | 'standard' | 'high' | 'extreme';

export interface SeasonSimActivityProfile {
  key: SeasonSimActivityProfileKey;
  label: string;
  description: string;
  loginHours: number[];
  socialAssistHours: number[];
  raidCount: number;
}

export interface SeasonSimDayPlan {
  profileKey: SeasonSimActivityProfileKey;
  profileLabel: string;
  farmVisitHours: number[];
  stipendHour: number;
  spiritGrowthHour: number;
  socialAssistHours: number[];
  raidRoundHours: number[];
  snapshotHour: number;
  expectedActions: number;
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

export const SEASON_SIM_SOCIAL_ASSISTS_PER_DAY = 2;
export const SEASON_SIM_RAIDS_PER_DAY = 3;
export const SEASON_SIM_DEFAULT_TOTAL_DAYS = 28;
export const SEASON_SIM_DEFAULT_START_AT = new Date('2026-06-08T00:00:00+08:00');
export const SEASON_SIM_DEFAULT_ACTION_DELAY_MS = 0;
export const SEASON_SIM_DEFAULT_ACTIVITY_PROFILE_KEY: SeasonSimActivityProfileKey = 'standard';

export const SEASON_SIM_ACTIVITY_PROFILES: Record<SeasonSimActivityProfileKey, SeasonSimActivityProfile> = {
  low: {
    key: 'low',
    label: '低活跃',
    description: '每天 2 次上线，适合普通轻度玩家基线。',
    loginHours: [9, 21],
    socialAssistHours: [9, 21],
    raidCount: SEASON_SIM_RAIDS_PER_DAY,
  },
  standard: {
    key: 'standard',
    label: '标准活跃',
    description: '每天 4 次上线，作为真实勤奋玩家主基线。',
    loginHours: [8, 12, 18, 22],
    socialAssistHours: [8, 22],
    raidCount: SEASON_SIM_RAIDS_PER_DAY,
  },
  high: {
    key: 'high',
    label: '高活跃',
    description: '每天 5 次上线，观察高频但非准点玩家收益。',
    loginHours: [7, 11, 15, 19, 22],
    socialAssistHours: [7, 22],
    raidCount: SEASON_SIM_RAIDS_PER_DAY,
  },
  extreme: {
    key: 'extreme',
    label: '极限准点',
    description: '每天 8 次准点上线，仅用于压力测试。',
    loginHours: [0, 3, 6, 9, 12, 15, 18, 21],
    socialAssistHours: [0, 21],
    raidCount: SEASON_SIM_RAIDS_PER_DAY,
  },
};

export function getSeasonSimActivityProfile(key: SeasonSimActivityProfileKey | undefined): SeasonSimActivityProfile {
  return SEASON_SIM_ACTIVITY_PROFILES[key ?? SEASON_SIM_DEFAULT_ACTIVITY_PROFILE_KEY] ?? SEASON_SIM_ACTIVITY_PROFILES[SEASON_SIM_DEFAULT_ACTIVITY_PROFILE_KEY];
}

export function buildSeasonSimDayPlan(profileKey: SeasonSimActivityProfileKey = SEASON_SIM_DEFAULT_ACTIVITY_PROFILE_KEY): SeasonSimDayPlan {
  const profile = getSeasonSimActivityProfile(profileKey);
  const lastLoginHour = profile.loginHours[profile.loginHours.length - 1] ?? 0;

  return {
    profileKey: profile.key,
    profileLabel: profile.label,
    farmVisitHours: profile.loginHours,
    stipendHour: lastLoginHour,
    spiritGrowthHour: lastLoginHour,
    socialAssistHours: profile.socialAssistHours,
    raidRoundHours: Array.from({ length: profile.raidCount }, () => lastLoginHour),
    snapshotHour: 24,
    expectedActions: getSeasonSimExpectedActionsForProfile(profile.key),
  };
}

export function getSeasonSimExpectedActionsForProfile(profileKey: SeasonSimActivityProfileKey | undefined): number {
  const profile = getSeasonSimActivityProfile(profileKey);
  return profile.loginHours.length + 1 + 1 + profile.socialAssistHours.length + profile.raidCount;
}

export function getSeasonSimExpectedActionsPerPlayer(profileKey: SeasonSimActivityProfileKey | undefined = SEASON_SIM_DEFAULT_ACTIVITY_PROFILE_KEY): number {
  return getSeasonSimExpectedActionsForProfile(profileKey);
}

export function getSeasonSimExpectedActionCount(players: number | SeasonSimPlayerLike[]): number {
  if (Array.isArray(players)) {
    return players.reduce((sum, player) => sum + getSeasonSimExpectedActionsForProfile(player.spec.activityProfileKey), 0);
  }
  return Math.max(Math.floor(players), 0) * getSeasonSimExpectedActionsPerPlayer();
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

  const raidCount = getSeasonSimActivityProfile(current.spec.activityProfileKey).raidCount;
  if (raidRound > raidCount) {
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
    const raidCount = getSeasonSimActivityProfile(player.spec.activityProfileKey).raidCount;
    for (let raidRound = 1; raidRound <= raidCount; raidRound += 1) {
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
