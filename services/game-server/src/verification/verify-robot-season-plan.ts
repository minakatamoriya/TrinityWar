import {
  SEASON_SIM_FARM_CYCLE_HOURS,
  SEASON_SIM_FARM_CYCLES_PER_DAY,
  SEASON_SIM_RAIDS_PER_DAY,
  buildSeasonSimDayPlan,
  buildSeasonSimProgress,
  evaluateRobotLoopStartBoundary,
  evaluateSeasonSimStartBoundary,
  findSeasonSimRaidTarget,
  getSeasonSimExpectedActionCount,
  getSeasonSimExpectedActionsPerPlayer,
  validateSeasonSimRaidTargets,
} from '../robot/season-sim-plan.js';

const players = [
  { playerId: 'sim-human-001', spec: { factionCode: 'human' } },
  { playerId: 'sim-human-002', spec: { factionCode: 'human' } },
  { playerId: 'sim-human-003', spec: { factionCode: 'human' } },
  { playerId: 'sim-immortal-001', spec: { factionCode: 'immortal' } },
  { playerId: 'sim-immortal-002', spec: { factionCode: 'immortal' } },
  { playerId: 'sim-immortal-003', spec: { factionCode: 'immortal' } },
  { playerId: 'sim-demon-001', spec: { factionCode: 'demon' } },
  { playerId: 'sim-demon-002', spec: { factionCode: 'demon' } },
  { playerId: 'sim-demon-003', spec: { factionCode: 'demon' } },
];

function main(): void {
  const plan = buildSeasonSimDayPlan();
  assertEqual(plan.farmCycleHours.length, SEASON_SIM_FARM_CYCLES_PER_DAY, 'farm cycle count');
  assertEqual(plan.farmCycleHours[1] - plan.farmCycleHours[0], SEASON_SIM_FARM_CYCLE_HOURS, 'farm cycle interval');
  assertEqual(plan.raidRoundHours.length, SEASON_SIM_RAIDS_PER_DAY, 'raid round count');
  assertEqual(plan.stipendHour, 21, 'stipend hour');
  assertEqual(plan.spiritGrowthHour, 21, 'spirit growth hour');
  assertEqual(plan.snapshotHour, 24, 'snapshot hour');
  assertEqual(getSeasonSimExpectedActionsPerPlayer(), 13, 'expected actions per player');
  assertEqual(getSeasonSimExpectedActionCount(players.length), 117, 'expected total actions');
  assertEqual(buildSeasonSimProgress(28, 0).progressPercent, 0, 'season progress before day 1');
  assertEqual(buildSeasonSimProgress(28, 14).progressPercent, 50, 'season progress mid season');
  assertEqual(buildSeasonSimProgress(28, 28).remainingDays, 0, 'season progress after day 28');
  assertEqual(buildSeasonSimProgress(28, 29).completedDays, 28, 'season progress clamps overflow days');

  assertEqual(evaluateSeasonSimStartBoundary({ loopRunning: false, seasonRunning: false }).ok, true, 'season start allowed when idle');
  assertEqual(boundaryReason(evaluateSeasonSimStartBoundary({ loopRunning: true, seasonRunning: false })), 'another robot loop is running', 'season start blocked by legacy loop');
  assertEqual(boundaryReason(evaluateSeasonSimStartBoundary({ loopRunning: false, seasonRunning: true })), 'season simulation already running', 'season start idempotent when already running');
  assertEqual(evaluateRobotLoopStartBoundary({ loopRunning: false, seasonRunning: false }).ok, true, 'legacy loop start allowed when idle');
  assertEqual(boundaryReason(evaluateRobotLoopStartBoundary({ loopRunning: false, seasonRunning: true })), 'season simulation is running', 'legacy loop start blocked by season sim');
  assertEqual(boundaryReason(evaluateRobotLoopStartBoundary({ loopRunning: true, seasonRunning: false })), 'loop already running', 'legacy loop start idempotent when already running');

  const issues = validateSeasonSimRaidTargets(players);
  assertEqual(issues.length, 0, 'raid target validation issues');

  const assignments = players.map((player, index) => ({
    playerId: player.playerId,
    factionCode: player.spec.factionCode,
    targets: Array.from({ length: SEASON_SIM_RAIDS_PER_DAY }, (_, raidRoundIndex) => {
      const target = findSeasonSimRaidTarget(players, index, raidRoundIndex + 1);
      return target?.playerId ?? null;
    }),
  }));
  for (const assignment of assignments) {
    assertAtLeast(new Set(assignment.targets).size, Math.min(SEASON_SIM_RAIDS_PER_DAY, 2), `${assignment.playerId} target spread`);
  }

  console.log(JSON.stringify({
    ok: true,
    plan,
    expected: {
      players: players.length,
      actionsPerPlayer: getSeasonSimExpectedActionsPerPlayer(),
      totalActions: getSeasonSimExpectedActionCount(players.length),
    },
    assignments,
  }, null, 2));
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertAtLeast(actual: number, expected: number, message: string): void {
  if (actual < expected) {
    throw new Error(`${message}: expected at least ${String(expected)}, got ${String(actual)}`);
  }
}

function boundaryReason(boundary: ReturnType<typeof evaluateSeasonSimStartBoundary> | ReturnType<typeof evaluateRobotLoopStartBoundary>): string {
  return 'reason' in boundary ? boundary.reason : '';
}

main();
