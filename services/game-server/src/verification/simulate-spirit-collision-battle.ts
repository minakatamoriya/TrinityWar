import {
  DEFAULT_SPIRIT_COLLISION_BATTLE_CONFIG,
  buildSpiritCollisionBattleReplay,
  type ClientRaidBattleReplay,
  type SpiritCollisionTraitInput,
  type SpiritCollisionUnitInput,
} from '@trinitywar/shared';

type Rarity = 'common' | 'rare' | 'legendary';
type Role = 'balanced' | 'attack' | 'health' | 'extremeAttack' | 'extremeHealth';

interface UnitSpec {
  label: string;
  rarity: Rarity;
  role: Role;
  level: number;
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
  timeoutRate: string;
  sameDeathRate: string;
  avgRounds: string;
  avgSteal: string;
  avgAttackerHp: string;
  avgDefenderHp: string;
}

const GOLD_POOL = 10000;
const DEFAULT_RUNS = 1000;

const scenarios: Scenario[] = [
  {
    name: 'same-level common balanced mirror',
    attacker: { label: 'Common A', rarity: 'common', role: 'balanced', level: 20 },
    defender: { label: 'Common D', rarity: 'common', role: 'balanced', level: 20 },
  },
  {
    name: 'rare balanced vs common balanced',
    attacker: { label: 'Rare A', rarity: 'rare', role: 'balanced', level: 20 },
    defender: { label: 'Common D', rarity: 'common', role: 'balanced', level: 20 },
  },
  {
    name: 'legendary balanced vs rare balanced',
    attacker: { label: 'Legend A', rarity: 'legendary', role: 'balanced', level: 20 },
    defender: { label: 'Rare D', rarity: 'rare', role: 'balanced', level: 20 },
  },
  {
    name: 'legendary -3 levels vs rare',
    attacker: { label: 'Legend A', rarity: 'legendary', role: 'balanced', level: 17 },
    defender: { label: 'Rare D', rarity: 'rare', role: 'balanced', level: 20 },
  },
  {
    name: 'legendary -5 levels vs common',
    attacker: { label: 'Legend A', rarity: 'legendary', role: 'balanced', level: 15 },
    defender: { label: 'Common D', rarity: 'common', role: 'balanced', level: 20 },
  },
  {
    name: 'attack role vs balanced',
    attacker: { label: 'Attack A', rarity: 'rare', role: 'attack', level: 20 },
    defender: { label: 'Balanced D', rarity: 'rare', role: 'balanced', level: 20 },
  },
  {
    name: 'health role vs balanced',
    attacker: { label: 'Health A', rarity: 'rare', role: 'health', level: 20 },
    defender: { label: 'Balanced D', rarity: 'rare', role: 'balanced', level: 20 },
  },
  {
    name: 'health mirror',
    attacker: { label: 'Health A', rarity: 'rare', role: 'health', level: 20 },
    defender: { label: 'Health D', rarity: 'rare', role: 'health', level: 20 },
  },
  {
    name: 'extreme attack vs extreme health',
    attacker: { label: 'Extreme A', rarity: 'rare', role: 'extremeAttack', level: 20 },
    defender: { label: 'Extreme D', rarity: 'rare', role: 'extremeHealth', level: 20 },
  },
  {
    name: 'crit traits vs attack trait',
    attacker: {
      label: 'Crit A',
      rarity: 'rare',
      role: 'balanced',
      level: 20,
      traits: [
        { code: 'crit', label: 'Crit', value: 18 },
        { code: 'crit_damage', label: 'Crit Damage', value: 20 },
      ],
    },
    defender: {
      label: 'Claw D',
      rarity: 'rare',
      role: 'balanced',
      level: 20,
      traits: [{ code: 'claw', label: 'Claw', value: 10 }],
    },
  },
];

function main(): void {
  const runs = readNumberArg('runs', DEFAULT_RUNS);
  const minDamage = readNumberArg('minDamage', DEFAULT_SPIRIT_COLLISION_BATTLE_CONFIG.minDamageByTargetMaxHpRatio);
  const config = {
    ...DEFAULT_SPIRIT_COLLISION_BATTLE_CONFIG,
    minDamageByTargetMaxHpRatio: minDamage,
  };

  const rows = scenarios.map((scenario, scenarioIndex) => {
    let wins = 0;
    let timeouts = 0;
    let sameDeaths = 0;
    let totalRounds = 0;
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
      const attackerHpRatio = replay.attacker.hpAfter / Math.max(replay.attacker.maxHp, 1);
      const defenderHpRatio = replay.defender.hpAfter / Math.max(replay.defender.maxHp, 1);

      wins += replay.result === 'WIN' ? 1 : 0;
      timeouts += rounds >= config.maxRounds && replay.attacker.hpAfter > 0 && replay.defender.hpAfter > 0 ? 1 : 0;
      sameDeaths += replay.attacker.hpAfter <= 0 && replay.defender.hpAfter <= 0 ? 1 : 0;
      totalRounds += rounds;
      totalStealRatio += replay.rewardsPreview.goldLoot / GOLD_POOL;
      totalAttackerHpRatio += attackerHpRatio;
      totalDefenderHpRatio += defenderHpRatio;
    }

    return {
      scenario: scenario.name,
      runs,
      attackerWinRate: formatPercent(wins / runs),
      timeoutRate: formatPercent(timeouts / runs),
      sameDeathRate: formatPercent(sameDeaths / runs),
      avgRounds: formatDecimal(totalRounds / runs),
      avgSteal: formatPercent(totalStealRatio / runs),
      avgAttackerHp: formatPercent(totalAttackerHpRatio / runs),
      avgDefenderHp: formatPercent(totalDefenderHpRatio / runs),
    } satisfies ScenarioStats;
  });

  console.log(`Spirit collision simulation: runs=${runs}, minDamage=${formatPercent(minDamage)}`);
  console.table(rows);
}

function buildUnit(side: 'attacker' | 'defender', spec: UnitSpec): SpiritCollisionUnitInput {
  const attack = standardAttack(spec.level) * rarityMultiplier(spec.rarity) * roleAttackMultiplier(spec.role);
  const maxHp = standardAttack(spec.level) * 6 * rarityMultiplier(spec.rarity) * roleHpMultiplier(spec.role);

  return {
    side,
    playerName: side === 'attacker' ? 'Attacker' : 'Defender',
    spiritId: `${side}-${spec.rarity}-${spec.role}`,
    spiritName: spec.label,
    rarity: spec.rarity,
    element: null,
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
  return 1;
}

function roleHpMultiplier(role: Role): number {
  if (role === 'attack') return 0.8;
  if (role === 'health') return 1.2;
  if (role === 'extremeAttack') return 0.65;
  if (role === 'extremeHealth') return 1.35;
  return 1;
}

function countRounds(replay: ClientRaidBattleReplay): number {
  return replay.steps.filter((step) => step.type === 'clash').length;
}

function readNumberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  const rawValue = match?.slice(prefix.length) ?? process.env[`npm_config_${name}`] ?? process.env[`npm_config_${name.toLowerCase()}`];
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallback;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDecimal(value: number): string {
  return value.toFixed(2);
}

main();
