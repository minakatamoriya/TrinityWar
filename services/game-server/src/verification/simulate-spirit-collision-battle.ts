import {
  DEFAULT_SPIRIT_COLLISION_BATTLE_CONFIG,
  buildSpiritCollisionBattleReplay,
  type ClientRaidBattleReplay,
  type ClientSpiritElement,
  type SpiritCollisionTraitInput,
  type SpiritCollisionUnitInput,
} from '@trinitywar/shared';

type Rarity = 'common' | 'rare' | 'legendary';
type Role = 'balanced' | 'attack' | 'health' | 'extremeAttack' | 'extremeHealth' | 'stall';

interface UnitSpec {
  label: string;
  rarity: Rarity;
  role: Role;
  level: number;
  spiritId?: string;
  element?: ClientSpiritElement;
  traits?: SpiritCollisionTraitInput[];
}

interface Scenario {
  name: string;
  attacker: UnitSpec;
  defender: UnitSpec;
}

interface ScenarioStats {
  scenario: string;
  runs: number;
  attackerWinRate: string;
  bloodModeRate: string;
  sameDeathRate: string;
  avgRounds: string;
  avgBloodRounds: string;
  avgSteal: string;
  avgAttackerHp: string;
  avgDefenderHp: string;
}

interface MatrixStats {
  attacker: string;
  avgWinRate: string;
  bestTarget: string;
  bestWinRate: string;
  worstTarget: string;
  worstWinRate: string;
  highWinTargets: number;
}

const GOLD_POOL = 10000;
const DEFAULT_RUNS = 100;

const trait = (code: string, label: string, value: number): SpiritCollisionTraitInput => ({ code, label, value });

const scenarios: Scenario[] = [
  {
    name: '快攻爆杀 vs 慢速防守',
    attacker: {
      label: '苍狼快攻',
      spiritId: 'canglang',
      rarity: 'common',
      role: 'attack',
      level: 20,
      element: 'fire',
      traits: [
        trait('claw', '利爪', 12),
        trait('sharp_blade', '利刃', 30),
        trait('crit', '暴击', 8),
        trait('crit_damage', '暴伤', 25),
        trait('harvest', '收割', 18),
      ],
    },
    defender: {
      label: '乘黄防守',
      spiritId: 'chenghuang',
      rarity: 'rare',
      role: 'health',
      level: 20,
      element: 'metal',
      traits: [
        trait('thick_skin', '厚皮', 12),
        trait('lifesteal', '吸血', 12),
        trait('dodge', '闪避', 6),
        trait('suppress', '压制', 8),
        trait('iron_bone', '铁骨', 30),
      ],
    },
  },
  {
    name: '血牛拖燃 vs 攻击压血',
    attacker: {
      label: '岩龟血牛',
      spiritId: 'hegui',
      rarity: 'common',
      role: 'stall',
      level: 20,
      element: 'earth',
      traits: [
        trait('thick_skin', '厚皮', 12),
        trait('thick_skin', '厚皮', 12),
        trait('iron_bone', '铁骨', 30),
        trait('lifesteal', '吸血', 12),
        trait('blaze', '炽燃', 3),
      ],
    },
    defender: {
      label: '血魇快攻',
      spiritId: 'xueyan',
      rarity: 'legendary',
      role: 'stall',
      level: 20,
      element: 'water',
      traits: [
        trait('claw', '利爪', 12),
        trait('crit', '暴击', 8),
        trait('crit_damage', '暴伤', 25),
        trait('lifesteal', '吸血', 12),
        trait('sharp_blade', '利刃', 30),
      ],
    },
  },
  {
    name: '反血牛 vs 极厚血',
    attacker: {
      label: '朱厌破血',
      spiritId: 'zhuyan',
      rarity: 'rare',
      role: 'attack',
      level: 20,
      element: 'wood',
      traits: [
        trait('blood_breaker', '破血', 18),
        trait('blood_breaker', '破血', 18),
        trait('wound', '裂伤', 8),
        trait('claw', '利爪', 12),
        trait('crit', '暴击', 8),
      ],
    },
    defender: {
      label: '应龙厚血',
      spiritId: 'yinglong',
      rarity: 'legendary',
      role: 'health',
      level: 20,
      element: 'earth',
      traits: [
        trait('thick_skin', '厚皮', 12),
        trait('thick_skin', '厚皮', 12),
        trait('iron_bone', '铁骨', 30),
        trait('lifesteal', '吸血', 12),
        trait('disruption', '断续', 20),
      ],
    },
  },
  {
    name: '残血反打 vs 收割压线',
    attacker: {
      label: '青猿背水',
      spiritId: 'qingyuan',
      rarity: 'common',
      role: 'balanced',
      level: 20,
      element: 'water',
      traits: [
        trait('last_stand', '背水', 25),
        trait('last_stand', '背水', 25),
        trait('lifesteal', '吸血', 12),
        trait('crit', '暴击', 8),
        trait('crit_damage', '暴伤', 25),
      ],
    },
    defender: {
      label: '影豹收割',
      spiritId: 'yingbao',
      rarity: 'common',
      role: 'attack',
      level: 20,
      element: 'fire',
      traits: [
        trait('harvest', '收割', 18),
        trait('claw', '利爪', 12),
        trait('crit', '暴击', 8),
        trait('crit_damage', '暴伤', 25),
        trait('dodge', '闪避', 6),
      ],
    },
  },
  {
    name: '干扰压制 vs 玻璃炮',
    attacker: {
      label: '讹兽干扰',
      spiritId: 'guishou',
      rarity: 'rare',
      role: 'balanced',
      level: 20,
      element: 'metal',
      traits: [
        trait('suppress', '压制', 8),
        trait('disruption', '断续', 20),
        trait('wound', '裂伤', 8),
        trait('thick_skin', '厚皮', 12),
        trait('harvest', '收割', 18),
      ],
    },
    defender: {
      label: '玄虎玻璃炮',
      spiritId: 'xuanhu',
      rarity: 'common',
      role: 'attack',
      level: 20,
      element: 'wood',
      traits: [
        trait('claw', '利爪', 12),
        trait('sharp_blade', '利刃', 30),
        trait('crit', '暴击', 8),
        trait('crit_damage', '暴伤', 25),
        trait('lifesteal', '吸血', 12),
      ],
    },
  },
  {
    name: '闪避赌命 vs 五行劣势快攻',
    attacker: {
      label: '霜狐闪避',
      spiritId: 'shuanghu',
      rarity: 'common',
      role: 'balanced',
      level: 20,
      element: 'fire',
      traits: [
        trait('dodge', '闪避', 6),
        trait('dodge', '闪避', 6),
        trait('dodge', '闪避', 6),
        trait('crit', '暴击', 8),
        trait('lifesteal', '吸血', 12),
      ],
    },
    defender: {
      label: '苍狼克制',
      spiritId: 'canglang',
      rarity: 'common',
      role: 'attack',
      level: 20,
      element: 'water',
      traits: [
        trait('claw', '利爪', 12),
        trait('sharp_blade', '利刃', 30),
        trait('crit', '暴击', 8),
        trait('crit_damage', '暴伤', 25),
        trait('harvest', '收割', 18),
      ],
    },
  },
  {
    name: '炽燃 x5 pressure',
    attacker: {
      label: '玄蛇炽燃',
      spiritId: 'xuangui',
      rarity: 'rare',
      role: 'stall',
      level: 20,
      element: 'water',
      traits: [
        trait('blaze', '炽燃', 3),
        trait('blaze', '炽燃', 3),
        trait('blaze', '炽燃', 3),
        trait('blaze', '炽燃', 3),
        trait('blaze', '炽燃', 3),
      ],
    },
    defender: { label: '厚血对照', spiritId: 'dangchang', rarity: 'rare', role: 'stall', level: 20, element: 'fire' },
  },
  {
    name: '闪避 x5 pressure',
    attacker: {
      label: '闪避上限',
      spiritId: 'shuanghu',
      rarity: 'common',
      role: 'balanced',
      level: 20,
      element: 'wood',
      traits: [
        trait('dodge', '闪避', 6),
        trait('dodge', '闪避', 6),
        trait('dodge', '闪避', 6),
        trait('dodge', '闪避', 6),
        trait('dodge', '闪避', 6),
      ],
    },
    defender: { label: '稳定输出', spiritId: 'canglang', rarity: 'common', role: 'attack', level: 20, element: 'metal' },
  },
];

const matrixBuilds: UnitSpec[] = [
  {
    label: '快攻爆杀',
    spiritId: 'canglang',
    rarity: 'common',
    role: 'attack',
    level: 20,
    element: 'fire',
    traits: [
      trait('claw', '利爪', 12),
      trait('sharp_blade', '利刃', 30),
      trait('crit', '暴击', 8),
      trait('crit_damage', '暴伤', 25),
      trait('harvest', '收割', 18),
    ],
  },
  {
    label: '血牛拖燃',
    spiritId: 'hegui',
    rarity: 'common',
    role: 'stall',
    level: 20,
    element: 'earth',
    traits: [
      trait('thick_skin', '厚皮', 12),
      trait('thick_skin', '厚皮', 12),
      trait('iron_bone', '铁骨', 30),
      trait('lifesteal', '吸血', 12),
      trait('blaze', '炽燃', 3),
    ],
  },
  {
    label: '反血牛',
    spiritId: 'zhuyan',
    rarity: 'rare',
    role: 'attack',
    level: 20,
    element: 'wood',
    traits: [
      trait('blood_breaker', '破血', 18),
      trait('blood_breaker', '破血', 18),
      trait('wound', '裂伤', 8),
      trait('claw', '利爪', 12),
      trait('crit', '暴击', 8),
    ],
  },
  {
    label: '残血反打',
    spiritId: 'qingyuan',
    rarity: 'common',
    role: 'balanced',
    level: 20,
    element: 'water',
    traits: [
      trait('last_stand', '背水', 25),
      trait('last_stand', '背水', 25),
      trait('lifesteal', '吸血', 12),
      trait('crit', '暴击', 8),
      trait('crit_damage', '暴伤', 25),
    ],
  },
  {
    label: '干扰压制',
    spiritId: 'guishou',
    rarity: 'rare',
    role: 'balanced',
    level: 20,
    element: 'metal',
    traits: [
      trait('suppress', '压制', 8),
      trait('disruption', '断续', 20),
      trait('wound', '裂伤', 8),
      trait('thick_skin', '厚皮', 12),
      trait('harvest', '收割', 18),
    ],
  },
  {
    label: '闪避赌命',
    spiritId: 'shuanghu',
    rarity: 'common',
    role: 'balanced',
    level: 20,
    element: 'wood',
    traits: [
      trait('dodge', '闪避', 6),
      trait('dodge', '闪避', 6),
      trait('dodge', '闪避', 6),
      trait('dodge', '闪避', 6),
      trait('dodge', '闪避', 6),
    ],
  },
  {
    label: '极限燃血',
    spiritId: 'xuangui',
    rarity: 'rare',
    role: 'stall',
    level: 20,
    element: 'water',
    traits: [
      trait('blaze', '炽燃', 3),
      trait('blaze', '炽燃', 3),
      trait('blaze', '炽燃', 3),
      trait('blaze', '炽燃', 3),
      trait('blaze', '炽燃', 3),
    ],
  },
];

function main(): void {
  const runs = readNumberArg('runs', DEFAULT_RUNS);
  const minDamage = readNumberArg('minDamage', DEFAULT_SPIRIT_COLLISION_BATTLE_CONFIG.minDamageByTargetMaxHpRatio);
  const config = {
    ...DEFAULT_SPIRIT_COLLISION_BATTLE_CONFIG,
    minDamageByTargetMaxHpRatio: minDamage,
  };

  if (readFlag('matrix')) {
    runMatrix(runs, config);
    return;
  }

  const rows = scenarios.map((scenario, scenarioIndex) => runScenarioStats(scenario, scenarioIndex, runs, config));

  console.log(`Spirit collision simulation: runs=${runs}, minDamage=${formatPercent(minDamage)}`);
  console.table(rows);
}

function runMatrix(runs: number, config: typeof DEFAULT_SPIRIT_COLLISION_BATTLE_CONFIG): void {
  const pairRows: Array<{ attacker: string; defender: string; winRate: string; bloodModeRate: string; avgRounds: string }> = [];
  const summaryRows: MatrixStats[] = [];

  matrixBuilds.forEach((attacker, attackerIndex) => {
    const pairStats: Array<{ defender: string; winRate: number }> = [];
    matrixBuilds.forEach((defender, defenderIndex) => {
      if (attackerIndex === defenderIndex) {
        return;
      }
      const stats = runScenarioStats(
        {
          name: `${attacker.label} vs ${defender.label}`,
          attacker,
          defender,
        },
        attackerIndex * matrixBuilds.length + defenderIndex,
        runs,
        config,
      );
      const winRate = parsePercent(stats.attackerWinRate);
      pairStats.push({ defender: defender.label, winRate });
      pairRows.push({
        attacker: attacker.label,
        defender: defender.label,
        winRate: stats.attackerWinRate,
        bloodModeRate: stats.bloodModeRate,
        avgRounds: stats.avgRounds,
      });
    });

    const sorted = [...pairStats].sort((left, right) => left.winRate - right.winRate);
    const worst = sorted[0] ?? { defender: '-', winRate: 0 };
    const best = sorted[sorted.length - 1] ?? { defender: '-', winRate: 0 };
    const avgWinRate = pairStats.reduce((total, item) => total + item.winRate, 0) / Math.max(pairStats.length, 1);
    summaryRows.push({
      attacker: attacker.label,
      avgWinRate: formatPercent(avgWinRate),
      bestTarget: best.defender,
      bestWinRate: formatPercent(best.winRate),
      worstTarget: worst.defender,
      worstWinRate: formatPercent(worst.winRate),
      highWinTargets: pairStats.filter((item) => item.winRate >= 0.7).length,
    });
  });

  console.log(`Spirit archetype matrix: builds=${matrixBuilds.length}, runs=${runs}`);
  console.table(summaryRows);
  console.table(pairRows);
}

function runScenarioStats(
  scenario: Scenario,
  scenarioIndex: number,
  runs: number,
  config: typeof DEFAULT_SPIRIT_COLLISION_BATTLE_CONFIG,
): ScenarioStats {
  let wins = 0;
  let bloodModeEntries = 0;
  let sameDeaths = 0;
  let totalRounds = 0;
  let totalBloodRounds = 0;
  let totalStealRatio = 0;
  let totalAttackerHpRatio = 0;
  let totalDefenderHpRatio = 0;

  for (let runIndex = 0; runIndex < runs; runIndex += 1) {
    const replay = buildSpiritCollisionBattleReplay({
      orderId: `sim-${scenarioIndex}-${runIndex}`,
      attacker: buildUnit('attacker', scenario.attacker),
      defender: buildUnit('defender', scenario.defender),
      config,
      goldPool: GOLD_POOL,
      seed: 100000 + scenarioIndex * 10000 + runIndex,
    });
    const rounds = countRounds(replay);
    const bloodRounds = countBloodRounds(replay);
    const attackerHpRatio = replay.attacker.hpAfter / Math.max(replay.attacker.maxHp, 1);
    const defenderHpRatio = replay.defender.hpAfter / Math.max(replay.defender.maxHp, 1);

    wins += replay.result === 'WIN' ? 1 : 0;
    bloodModeEntries += hasBloodMode(replay) ? 1 : 0;
    sameDeaths += replay.attacker.hpAfter <= 0 && replay.defender.hpAfter <= 0 ? 1 : 0;
    totalRounds += rounds;
    totalBloodRounds += bloodRounds;
    totalStealRatio += replay.rewardsPreview.goldLoot / GOLD_POOL;
    totalAttackerHpRatio += attackerHpRatio;
    totalDefenderHpRatio += defenderHpRatio;
  }

  return {
    scenario: scenario.name,
    runs,
    attackerWinRate: formatPercent(wins / runs),
    bloodModeRate: formatPercent(bloodModeEntries / runs),
    sameDeathRate: formatPercent(sameDeaths / runs),
    avgRounds: formatDecimal(totalRounds / runs),
    avgBloodRounds: formatDecimal(bloodModeEntries > 0 ? totalBloodRounds / bloodModeEntries : 0),
    avgSteal: formatPercent(totalStealRatio / runs),
    avgAttackerHp: formatPercent(totalAttackerHpRatio / runs),
    avgDefenderHp: formatPercent(totalDefenderHpRatio / runs),
  };
}

function buildUnit(side: 'attacker' | 'defender', spec: UnitSpec): SpiritCollisionUnitInput {
  const attack = standardAttack(spec.level) * rarityMultiplier(spec.rarity) * roleAttackMultiplier(spec.role);
  const maxHp = standardAttack(spec.level) * 6 * rarityMultiplier(spec.rarity) * roleHpMultiplier(spec.role);

  return {
    side,
    playerName: side === 'attacker' ? 'Attacker' : 'Defender',
    spiritId: spec.spiritId ?? `${side}-${spec.rarity}-${spec.role}`,
    spiritName: spec.label,
    rarity: spec.rarity,
    element: spec.element ?? null,
    level: spec.level,
    attack: Math.round(attack),
    maxHp: Math.round(maxHp),
    traits: spec.traits,
  };
}

function standardAttack(level: number): number {
  return 100 * (1 + (Math.max(Math.floor(level), 1) - 1) * 0.03);
}

function rarityMultiplier(rarity: Rarity): number {
  if (rarity === 'legendary') return 1.2;
  if (rarity === 'rare') return 1.1;
  return 1;
}

function roleAttackMultiplier(role: Role): number {
  if (role === 'attack') return 1.2;
  if (role === 'health') return 0.8;
  if (role === 'extremeAttack') return 1.35;
  if (role === 'extremeHealth') return 0.65;
  if (role === 'stall') return 0.45;
  return 1;
}

function roleHpMultiplier(role: Role): number {
  if (role === 'attack') return 0.8;
  if (role === 'health') return 1.2;
  if (role === 'extremeAttack') return 0.65;
  if (role === 'extremeHealth') return 1.35;
  if (role === 'stall') return 1.8;
  return 1;
}

function countRounds(replay: ClientRaidBattleReplay): number {
  return replay.steps.filter((step) => step.type === 'clash').length;
}

function countBloodRounds(replay: ClientRaidBattleReplay): number {
  return replay.events.filter((event) => event.type === 'blood' && event.label.startsWith('燃血回合')).length;
}

function hasBloodMode(replay: ClientRaidBattleReplay): boolean {
  return replay.events.some((event) => event.type === 'blood');
}

function readNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  const rawValue = match?.slice(prefix.length) ?? process.env[`npm_config_${name}`] ?? process.env[`npm_config_${name.toLowerCase()}`];
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallback;
}

function readFlag(name: string): boolean {
  return process.argv.includes(`--${name}`) || process.env[`npm_config_${name}`] === 'true';
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function parsePercent(value: string): number {
  const numeric = Number(value.replace('%', ''));
  return Number.isFinite(numeric) ? numeric / 100 : 0;
}

function formatDecimal(value: number): string {
  return value.toFixed(2);
}

main();
