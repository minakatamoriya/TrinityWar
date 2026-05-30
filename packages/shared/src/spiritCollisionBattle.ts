import type {
  ClientRaidBattleEvent,
  ClientRaidBattleReplay,
  ClientRaidBattleStep,
  ClientRaidBattleUnitSnapshot,
  ClientRaidRewardItem,
  ClientSpiritElement,
} from './index.js';

export type SpiritCollisionBattleResult = 'WIN' | 'LOSS';
export type SpiritCollisionBattleSide = 'attacker' | 'defender';

export interface SpiritCollisionTraitInput {
  code: string;
  label: string;
  value: number;
}

export interface SpiritCollisionUnitInput {
  side: SpiritCollisionBattleSide;
  playerName: string;
  spiritId: string | null;
  spiritName: string;
  rarity: string | null;
  element: ClientSpiritElement | null;
  level: number;
  attack: number;
  maxHp: number;
  traits?: SpiritCollisionTraitInput[];
}

export interface SpiritCollisionBattleConfig {
  maxRounds: number;
  baseStealRatio: number;
  defenderLostHpStealFactor: number;
  attackerWinBonus: number;
  minStealRatio: number;
  maxStealRatio: number;
  minDamageByTargetMaxHpRatio: number;
  clashDurationMs: number;
  hpChangeDurationMs: number;
  returnDurationMs: number;
}

export interface SpiritCollisionBattleInput {
  orderId: string;
  attacker: SpiritCollisionUnitInput;
  defender: SpiritCollisionUnitInput;
  seed?: number;
  config?: Partial<SpiritCollisionBattleConfig>;
  goldPool?: number;
  rewards?: ClientRaidRewardItem[];
}

interface PreparedUnit {
  snapshot: ClientRaidBattleUnitSnapshot;
  attack: number;
  hp: number;
  traits: Record<string, number>;
}

interface RoundDamage {
  value: number;
  dodged: boolean;
  critical: boolean;
  lifesteal: number;
  counterDamage: number;
}

export const DEFAULT_SPIRIT_COLLISION_BATTLE_CONFIG: SpiritCollisionBattleConfig = {
  maxRounds: 10,
  baseStealRatio: 0.2,
  defenderLostHpStealFactor: 0.4,
  attackerWinBonus: 0.1,
  minStealRatio: 0.2,
  maxStealRatio: 0.7,
  minDamageByTargetMaxHpRatio: 0,
  clashDurationMs: 360,
  hpChangeDurationMs: 360,
  returnDurationMs: 260,
};

export function buildSpiritCollisionBattleReplay(input: SpiritCollisionBattleInput): ClientRaidBattleReplay {
  const config = { ...DEFAULT_SPIRIT_COLLISION_BATTLE_CONFIG, ...input.config };
  const random = createSeededRandom(input.seed ?? 20260530);
  const attacker = prepareUnit(input.attacker);
  const defender = prepareUnit(input.defender);
  const events: ClientRaidBattleEvent[] = [];
  const steps: ClientRaidBattleStep[] = [{ type: 'enter', durationMs: 520 }];

  let result: SpiritCollisionBattleResult | null = null;
  let resultReason = '';

  for (let round = 1; round <= config.maxRounds; round += 1) {
    const attackerBefore = attacker.hp;
    const defenderBefore = defender.hp;
    const attackerDamage = resolveRoundDamage(attacker, defender, config, random);
    const defenderDamage = resolveRoundDamage(defender, attacker, config, random);

    defender.hp = clampHp(defender.hp - attackerDamage.value - defenderDamage.counterDamage + defenderDamage.lifesteal, defender.snapshot.maxHp);
    attacker.hp = clampHp(attacker.hp - defenderDamage.value - attackerDamage.counterDamage + attackerDamage.lifesteal, attacker.snapshot.maxHp);

    appendRoundSteps(
      steps,
      round,
      attackerBefore,
      defenderBefore,
      attacker.hp,
      defender.hp,
      attacker.snapshot.maxHp,
      defender.snapshot.maxHp,
      attackerDamage,
      defenderDamage,
      config,
    );
    appendRoundEvents(events, round, attackerDamage, defenderDamage, attacker.hp, defender.hp);

    const attackerDead = attacker.hp <= 0;
    const defenderDead = defender.hp <= 0;
    if (attackerDead || defenderDead) {
      if (defenderDead && !attackerDead) {
        result = 'WIN';
        resultReason = '守方倒下';
      } else {
        result = 'LOSS';
        resultReason = attackerDead && defenderDead ? '双方同归于尽，守方守护成功' : '攻方倒下';
      }
      break;
    }
  }

  if (!result) {
    const attackerRatio = attacker.hp / Math.max(attacker.snapshot.maxHp, 1);
    const defenderRatio = defender.hp / Math.max(defender.snapshot.maxHp, 1);
    result = attackerRatio > defenderRatio ? 'WIN' : 'LOSS';
    resultReason = attackerRatio > defenderRatio ? '10 回合后攻方血量比例更高' : '10 回合后守方血量比例不低于攻方';
  }

  attacker.snapshot.hpAfter = attacker.hp;
  defender.snapshot.hpAfter = defender.hp;

  const defenderLostHpRatio = (defender.snapshot.maxHp - defender.hp) / Math.max(defender.snapshot.maxHp, 1);
  const stealRatio = clampRatio(
    config.baseStealRatio
      + defenderLostHpRatio * config.defenderLostHpStealFactor
      + (result === 'WIN' ? config.attackerWinBonus : 0),
    config.minStealRatio,
    config.maxStealRatio,
  );
  const goldLoot = Math.floor((input.goldPool ?? 1000) * stealRatio);
  const title = result === 'WIN' ? '突破守护' : '守护成功';
  const summary = `${title}，${resultReason}，打掉守方 ${Math.round(defenderLostHpRatio * 100)}% 血量，偷取 ${Math.round(stealRatio * 100)}%。`;

  steps.push({ type: 'result', title, summary, durationMs: 1 });

  return {
    orderId: input.orderId,
    result,
    title,
    summary,
    attacker: attacker.snapshot,
    defender: defender.snapshot,
    events,
    steps,
    rewardsPreview: {
      goldLoot,
      items: input.rewards ?? [],
    },
  };
}

function prepareUnit(input: SpiritCollisionUnitInput): PreparedUnit {
  const traits = normalizeTraits(input.traits ?? []);
  const maxHp = Math.max(Math.round(input.maxHp * (1 + (traits.thick_skin ?? 0) / 100)), 1);
  const attack = Math.max(Math.round(input.attack * (1 + (traits.claw ?? 0) / 100)), 0);

  return {
    attack,
    hp: maxHp,
    traits,
    snapshot: {
      side: input.side,
      playerName: input.playerName,
      spiritId: input.spiritId,
      spiritName: input.spiritName,
      rarity: input.rarity,
      element: input.element,
      level: Math.max(Math.floor(input.level), 1),
      hpBefore: maxHp,
      hpAfter: maxHp,
      maxHp,
      attack,
      healthStatus: 'normal',
      healthStatusLabel: '正常',
      attackCoefficient: 1,
      traits: (input.traits ?? []).map((trait) => ({
        code: trait.code,
        label: trait.label,
        value: trait.value,
        valueType: 'percent' as const,
        source: 'spirit' as const,
        visible: true,
      })),
    },
  };
}

function normalizeTraits(traits: SpiritCollisionTraitInput[]): Record<string, number> {
  return traits.reduce<Record<string, number>>((totals, trait) => {
    totals[trait.code] = (totals[trait.code] ?? 0) + trait.value;
    return totals;
  }, {});
}

function resolveRoundDamage(
  attacker: PreparedUnit,
  defender: PreparedUnit,
  config: SpiritCollisionBattleConfig,
  random: () => number,
): RoundDamage {
  const dodgeChance = clampRatio((defender.traits.dodge ?? 0) / 100, 0, 0.75);
  if (random() < dodgeChance) {
    return { value: 0, dodged: true, critical: false, lifesteal: 0, counterDamage: 0 };
  }

  const randomFactor = 0.95 + random() * 0.1;
  const minDamage = defender.snapshot.maxHp * config.minDamageByTargetMaxHpRatio;
  let value = Math.max(attacker.attack * randomFactor, minDamage);
  const critChance = clampRatio((attacker.traits.crit ?? 0) / 100, 0, 1);
  const critical = random() < critChance;
  if (critical) {
    value *= 1.5 + Math.max(attacker.traits.crit_damage ?? 0, 0) / 100;
  }

  const roundedValue = Math.max(Math.round(value), 0);
  const lifesteal = Math.round(roundedValue * clampRatio((attacker.traits.lifesteal ?? 0) / 100, 0, 1));
  const counterDamage = Math.round(roundedValue * clampRatio((defender.traits.counter ?? 0) / 100, 0, 1));

  return {
    value: roundedValue,
    dodged: false,
    critical,
    lifesteal,
    counterDamage,
  };
}

function appendRoundSteps(
  steps: ClientRaidBattleStep[],
  round: number,
  attackerBefore: number,
  defenderBefore: number,
  attackerAfter: number,
  defenderAfter: number,
  attackerMaxHp: number,
  defenderMaxHp: number,
  attackerDamage: RoundDamage,
  defenderDamage: RoundDamage,
  config: SpiritCollisionBattleConfig,
): void {
  steps.push({ type: 'clash', durationMs: config.clashDurationMs });
  steps.push({
    type: 'floatingText',
    side: 'defender',
    text: attackerDamage.dodged ? '闪避' : `-${attackerDamage.value}`,
    tone: attackerDamage.dodged ? 'miss' : attackerDamage.critical ? 'crit' : 'damage',
    durationMs: 260,
  });
  steps.push({
    type: 'floatingText',
    side: 'attacker',
    text: defenderDamage.dodged ? '闪避' : `-${defenderDamage.value}`,
    tone: defenderDamage.dodged ? 'miss' : defenderDamage.critical ? 'crit' : 'damage',
    durationMs: 260,
  });

  if (attackerDamage.lifesteal > 0) {
    steps.push({ type: 'floatingText', side: 'attacker', text: `+${attackerDamage.lifesteal}`, tone: 'buff', durationMs: 220 });
  }
  if (defenderDamage.lifesteal > 0) {
    steps.push({ type: 'floatingText', side: 'defender', text: `+${defenderDamage.lifesteal}`, tone: 'buff', durationMs: 220 });
  }

  steps.push({ type: 'hpChange', side: 'defender', from: defenderBefore, to: defenderAfter, max: defenderMaxHp, durationMs: config.hpChangeDurationMs });
  steps.push({ type: 'hpChange', side: 'attacker', from: attackerBefore, to: attackerAfter, max: attackerMaxHp, durationMs: config.hpChangeDurationMs });
  steps.push({ type: 'return', durationMs: config.returnDurationMs + (round >= config.maxRounds ? 120 : 0) });
}

function appendRoundEvents(
  events: ClientRaidBattleEvent[],
  round: number,
  attackerDamage: RoundDamage,
  defenderDamage: RoundDamage,
  attackerHp: number,
  defenderHp: number,
): void {
  if (attackerDamage.critical) {
    events.push({ type: 'critical', label: `第 ${round} 回合攻方暴击`, description: `攻方本回合造成 ${attackerDamage.value} 伤害。` });
  }
  if (defenderDamage.critical) {
    events.push({ type: 'critical', label: `第 ${round} 回合守方暴击`, description: `守方本回合造成 ${defenderDamage.value} 伤害。` });
  }
  if (attackerDamage.dodged) {
    events.push({ type: 'dodge', label: `第 ${round} 回合守方闪避`, description: '守方避开了攻方本回合伤害。' });
  }
  if (defenderDamage.dodged) {
    events.push({ type: 'dodge', label: `第 ${round} 回合攻方闪避`, description: '攻方避开了守方本回合伤害。' });
  }
  events.push({
    type: 'damage',
    label: `第 ${round} 回合对撞`,
    description: `攻方剩余 ${attackerHp}，守方剩余 ${defenderHp}。`,
  });
}

function clampHp(value: number, maxHp: number): number {
  return Math.min(Math.max(Math.round(value), 0), Math.max(maxHp, 1));
}

function clampRatio(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function createSeededRandom(seed: number): () => number {
  let state = Math.max(Math.floor(seed), 1) % 2147483647;
  return () => {
    state = state * 16807 % 2147483647;
    return (state - 1) / 2147483646;
  };
}
