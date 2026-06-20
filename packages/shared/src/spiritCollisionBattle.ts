import type {
  ClientRaidBattleEvent,
  ClientRaidBattleReplay,
  ClientRaidBattleStep,
  ClientRaidBattleUnitSnapshot,
  ClientRaidRewardItem,
  ClientSpiritElement,
} from './index.js';
import {
  getSpiritBattleInnateRules,
  SPIRIT_BATTLE_TRAIT_BY_CODE,
  type SpiritBattleRuleCondition,
  type SpiritBattleRuleEffectStat,
} from './spiritBattleRules.js';

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
  bloodModeInitialHpLossRatio: number;
  bloodModeHpLossRatioIncrement: number;
  maxBloodModeRounds: number;
  clashDurationMs: number;
  hpChangeDurationMs: number;
  returnDurationMs: number;
  noticeDurationMs: number;
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
  spiritId: string | null;
  baseAttack: number;
  attack: number;
  hp: number;
  traits: Record<string, number>;
}

interface RoundDamage {
  value: number;
  dodged: boolean;
  critical: boolean;
  lifesteal: number;
  elementAdvantage: 'strong' | 'weak' | 'none';
  traitLabels: string[];
}

interface RoundContext {
  round: number;
  bloodRound: number | null;
  attackerHpRatio: number;
  defenderHpRatio: number;
}

interface HealResult {
  attackerHeal: number;
  defenderHeal: number;
  attackerLabels: string[];
  defenderLabels: string[];
}

export const DEFAULT_SPIRIT_COLLISION_BATTLE_CONFIG: SpiritCollisionBattleConfig = {
  maxRounds: 10,
  baseStealRatio: 0.2,
  defenderLostHpStealFactor: 0.4,
  attackerWinBonus: 0.1,
  minStealRatio: 0.2,
  maxStealRatio: 0.7,
  minDamageByTargetMaxHpRatio: 0,
  bloodModeInitialHpLossRatio: 0.08,
  bloodModeHpLossRatioIncrement: 0.02,
  maxBloodModeRounds: 100,
  clashDurationMs: 360,
  hpChangeDurationMs: 360,
  returnDurationMs: 260,
  noticeDurationMs: 720,
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
  let enteredBloodMode = false;
  let attackerTotalCombatDamage = 0;
  let defenderTotalCombatDamage = 0;
  let attackerBloodEntryHpRatio = 0;
  let defenderBloodEntryHpRatio = 0;

  for (let round = 1; round <= config.maxRounds; round += 1) {
    const attackerBefore = attacker.hp;
    const defenderBefore = defender.hp;
    const attackerContext = buildRoundContext(round, null, attacker, defender);
    const defenderContext = buildRoundContext(round, null, defender, attacker);
    const attackerDamage = resolveRoundDamage(attacker, defender, attackerContext, config, random);
    const defenderDamage = resolveRoundDamage(defender, attacker, defenderContext, config, random);
    const heals = resolveRoundHeals(attacker, defender, round, attackerDamage.lifesteal, defenderDamage.lifesteal);
    const attackerCombatDamage = capEffectiveDamage(defenderBefore, attackerDamage.value);
    const defenderCombatDamage = capEffectiveDamage(attackerBefore, defenderDamage.value);

    attackerTotalCombatDamage += attackerCombatDamage;
    defenderTotalCombatDamage += defenderCombatDamage;

    defender.hp = clampHp(defender.hp - attackerDamage.value + heals.defenderHeal, defender.snapshot.maxHp);
    attacker.hp = clampHp(attacker.hp - defenderDamage.value + heals.attackerHeal, attacker.snapshot.maxHp);

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
      heals,
      config,
    );
    appendRoundEvents(events, round, attackerDamage, defenderDamage, heals, attacker.hp, defender.hp, attackerTotalCombatDamage, defenderTotalCombatDamage);

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
    enteredBloodMode = true;
    attackerBloodEntryHpRatio = attacker.hp / Math.max(attacker.snapshot.maxHp, 1);
    defenderBloodEntryHpRatio = defender.hp / Math.max(defender.snapshot.maxHp, 1);
    events.push({
      type: 'blood',
      label: '燃血模式',
      description: `第 ${config.maxRounds} 回合后双方仍存活，进入燃血模式；从 ${formatBloodRatio(config.bloodModeInitialHpLossRatio)} 最大生命开始，每回合递增 ${formatBloodRatio(config.bloodModeHpLossRatioIncrement)}。`,
    });
    steps.push({
      type: 'notice',
      title: '燃血模式',
      summary: `${formatBloodRatio(config.bloodModeInitialHpLossRatio)} 起，每回合 +${formatBloodRatio(config.bloodModeHpLossRatioIncrement)} 最大生命`,
      tone: 'blood',
      durationMs: config.noticeDurationMs,
    });

    for (let bloodRound = 1; bloodRound <= config.maxBloodModeRounds && !result; bloodRound += 1) {
      const round = config.maxRounds + bloodRound;
      const attackerBeforeBlood = attacker.hp;
      const defenderBeforeBlood = defender.hp;
      const baseBloodLossRatio = resolveBloodLossRatio(bloodRound, config);
      const attackerBloodLossRatio = resolveUnitBloodLossRatio(attacker, defender, baseBloodLossRatio);
      const defenderBloodLossRatio = resolveUnitBloodLossRatio(defender, attacker, baseBloodLossRatio);
      const bloodLossLabel = formatBloodRatio(baseBloodLossRatio);
      const attackerBloodLoss = resolveBloodLoss(attacker.snapshot.maxHp, attackerBloodLossRatio);
      const defenderBloodLoss = resolveBloodLoss(defender.snapshot.maxHp, defenderBloodLossRatio);

      attacker.hp = clampHp(attacker.hp - attackerBloodLoss, attacker.snapshot.maxHp);
      defender.hp = clampHp(defender.hp - defenderBloodLoss, defender.snapshot.maxHp);

      events.push({
        type: 'blood',
        label: `燃血回合 ${bloodRound}`,
        description: `本回合基础燃血 ${bloodLossLabel} 最大生命；攻方自损 ${attackerBloodLoss}，守方自损 ${defenderBloodLoss}；累计对敌伤害 攻方 ${attackerTotalCombatDamage} / 守方 ${defenderTotalCombatDamage}。`,
      });
      steps.push({
        type: 'hpChange',
        side: 'attacker',
        from: attackerBeforeBlood,
        to: attacker.hp,
        max: attacker.snapshot.maxHp,
        durationMs: config.hpChangeDurationMs,
        floatingText: `燃血${formatBloodRatio(attackerBloodLossRatio)} -${Math.max(attackerBeforeBlood - attacker.hp, 0)}`,
        floatingTone: 'blood',
        round,
        bloodRound,
      });
      steps.push({
        type: 'hpChange',
        side: 'defender',
        from: defenderBeforeBlood,
        to: defender.hp,
        max: defender.snapshot.maxHp,
        durationMs: config.hpChangeDurationMs,
        floatingText: `燃血${formatBloodRatio(defenderBloodLossRatio)} -${Math.max(defenderBeforeBlood - defender.hp, 0)}`,
        floatingTone: 'blood',
        round,
        bloodRound,
      });

      const bloodResult = resolveBloodModeDeaths(
        attacker.hp,
        defender.hp,
        bloodRound,
        attackerTotalCombatDamage,
        defenderTotalCombatDamage,
        attackerBloodEntryHpRatio,
        defenderBloodEntryHpRatio,
        '燃血结算后',
      );
      if (bloodResult) {
        result = bloodResult.result;
        resultReason = bloodResult.reason;
        break;
      }

      const attackerBefore = attacker.hp;
      const defenderBefore = defender.hp;
      const attackerContext = buildRoundContext(round, bloodRound, attacker, defender);
      const defenderContext = buildRoundContext(round, bloodRound, defender, attacker);
      const attackerDamage = resolveRoundDamage(attacker, defender, attackerContext, config, random);
      const defenderDamage = resolveRoundDamage(defender, attacker, defenderContext, config, random);
      const heals = resolveRoundHeals(attacker, defender, round, attackerDamage.lifesteal, defenderDamage.lifesteal);
      const attackerCombatDamage = capEffectiveDamage(defenderBefore, attackerDamage.value);
      const defenderCombatDamage = capEffectiveDamage(attackerBefore, defenderDamage.value);

      attackerTotalCombatDamage += attackerCombatDamage;
      defenderTotalCombatDamage += defenderCombatDamage;

      defender.hp = clampHp(defender.hp - attackerDamage.value + heals.defenderHeal, defender.snapshot.maxHp);
      attacker.hp = clampHp(attacker.hp - defenderDamage.value + heals.attackerHeal, attacker.snapshot.maxHp);

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
        heals,
        config,
      );
      appendRoundEvents(events, round, attackerDamage, defenderDamage, heals, attacker.hp, defender.hp, attackerTotalCombatDamage, defenderTotalCombatDamage);

      const clashResult = resolveBloodModeDeaths(
        attacker.hp,
        defender.hp,
        bloodRound,
        attackerTotalCombatDamage,
        defenderTotalCombatDamage,
        attackerBloodEntryHpRatio,
        defenderBloodEntryHpRatio,
        '普通互撞后',
      );
      if (clashResult) {
        result = clashResult.result;
        resultReason = clashResult.reason;
      }
    }
  }

  if (!result) {
    const tieBreak = resolveBloodModeTieBreak(
      attackerTotalCombatDamage,
      defenderTotalCombatDamage,
      attackerBloodEntryHpRatio,
      defenderBloodEntryHpRatio,
    );
    result = tieBreak.result;
    resultReason = `燃血达到安全回合上限，${tieBreak.reason}`;
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
  const bloodSummary = enteredBloodMode ? `，进入燃血模式，累计伤害 ${attackerTotalCombatDamage}/${defenderTotalCombatDamage}` : '';
  const summary = `${title}，${resultReason}${bloodSummary}，打掉守方 ${Math.round(defenderLostHpRatio * 100)}% 血量，偷取 ${Math.round(stealRatio * 100)}%。`;

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
  const maxHpPercent = resolveTraitEffectValue(traits, 'maxHp') + resolveStartInnatePercent(input.spiritId, 'maxHpPercent');
  const attackPercent = resolveTraitEffectValue(traits, 'attack');
  const maxHp = Math.max(Math.round(input.maxHp * (1 + maxHpPercent / 100)), 1);
  const attack = Math.max(Math.round(input.attack * (1 + attackPercent / 100)), 0);

  return {
    spiritId: input.spiritId,
    baseAttack: input.attack,
    attack,
    hp: maxHp,
    traits,
    snapshot: {
      side: input.side,
      playerName: input.playerName,
      spiritId: input.spiritId,
      sceneVisibility: 'named',
      displayName: input.spiritName,
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

function buildRoundContext(round: number, bloodRound: number | null, attacker: PreparedUnit, defender: PreparedUnit): RoundContext {
  return {
    round,
    bloodRound,
    attackerHpRatio: attacker.hp / Math.max(attacker.snapshot.maxHp, 1),
    defenderHpRatio: defender.hp / Math.max(defender.snapshot.maxHp, 1),
  };
}

function resolveRoundAttackPercent(attacker: PreparedUnit, defender: PreparedUnit, context: RoundContext, labels: string[]): number {
  return resolveTraitEffectValue(attacker.traits, 'attack', attacker, defender, context, labels, { requireRuntimeCondition: true })
    + resolveInnatePercent(attacker, defender, context, 'attackPercent', labels);
}

function resolveRoundCritPercent(attacker: PreparedUnit, defender: PreparedUnit, context: RoundContext, labels: string[]): number {
  return resolveTraitEffectValue(attacker.traits, 'crit', attacker, defender, context, labels)
    + resolveInnatePercent(attacker, defender, context, 'critPercent', labels);
}

function resolveFinalDamagePercent(attacker: PreparedUnit, defender: PreparedUnit, context: RoundContext, labels: string[]): number {
  return resolveTraitEffectValue(attacker.traits, 'damage', attacker, defender, context, labels)
    + resolveInnatePercent(attacker, defender, context, 'damagePercent', labels);
}

function resolveDamageTakenPercent(defender: PreparedUnit, attacker: PreparedUnit, context: RoundContext, labels: string[]): number {
  return resolveInnatePercent(defender, attacker, context, 'damageTakenPercent', labels);
}

function resolveRoundLifestealPercent(attacker: PreparedUnit, defender: PreparedUnit, context: RoundContext, labels: string[]): number {
  return resolveTraitEffectValue(attacker.traits, 'lifesteal', attacker, defender, context, labels)
    + resolveInnatePercent(attacker, defender, context, 'lifestealPercent', labels);
}

function resolveRoundHeals(
  attacker: PreparedUnit,
  defender: PreparedUnit,
  round: number,
  attackerLifesteal: number,
  defenderLifesteal: number,
): HealResult {
  const attackerFixed = resolveFixedRoundHeal(attacker, round);
  const defenderFixed = resolveFixedRoundHeal(defender, round);
  const context = buildRoundContext(round, null, attacker, defender);
  const attackerHealReduction = clampRatio(resolveTraitEffectValue(defender.traits, 'targetHealReduction', defender, attacker, context) / 100, 0, 1);
  const defenderHealReduction = clampRatio(resolveTraitEffectValue(attacker.traits, 'targetHealReduction', attacker, defender, context) / 100, 0, 1);
  return {
    attackerHeal: Math.round((attackerLifesteal + attackerFixed.value) * (1 - attackerHealReduction)),
    defenderHeal: Math.round((defenderLifesteal + defenderFixed.value) * (1 - defenderHealReduction)),
    attackerLabels: attackerFixed.label ? [attackerFixed.label] : [],
    defenderLabels: defenderFixed.label ? [defenderFixed.label] : [],
  };
}

function resolveFixedRoundHeal(unit: PreparedUnit, round: number): { value: number; label: string | null } {
  const rules = getSpiritBattleInnateRules(unit.spiritId).filter((rule) => {
    return typeof rule.fixedHealRatio === 'number' && (rule.fixedHealRounds ?? []).includes(round);
  });
  const value = rules.reduce((total, rule) => total + Math.round(unit.snapshot.maxHp * (rule.fixedHealRatio ?? 0)), 0);
  return { value, label: rules[0]?.label ?? null };
}

function resolveUnitBloodLossRatio(unit: PreparedUnit, opponent: PreparedUnit, baseRatio: number): number {
  return Math.max(baseRatio + resolveTraitEffectValue(opponent.traits, 'targetBloodLossIncrease') - resolveBloodLossReduction(unit), 0);
}

function resolveBloodLossReduction(unit: PreparedUnit): number {
  return getSpiritBattleInnateRules(unit.spiritId).reduce((total, rule) => total + (rule.bloodLossReductionRatio ?? 0), 0);
}

function resolveStartInnatePercent(
  spiritId: string | null,
  field: 'maxHpPercent',
): number {
  return getSpiritBattleInnateRules(spiritId).reduce((total, rule) => {
    return hasRuntimeCondition(rule) ? total : total + (rule[field] ?? 0);
  }, 0);
}

function resolveInnatePercent(
  unit: PreparedUnit,
  opponent: PreparedUnit,
  context: RoundContext,
  field: 'attackPercent' | 'damagePercent' | 'damageTakenPercent' | 'critPercent' | 'lifestealPercent',
  labels?: string[],
): number {
  return getSpiritBattleInnateRules(unit.spiritId).reduce((total, rule) => {
    const value = rule[field] ?? 0;
    if (value === 0 || !isRuleConditionActive(rule, unit, opponent, context)) {
      return total;
    }
    labels?.push(rule.label);
    return total + value;
  }, 0);
}

function resolveTraitEffectValue(
  traits: Record<string, number>,
  stat: SpiritBattleRuleEffectStat,
  unit?: PreparedUnit,
  opponent?: PreparedUnit,
  context?: RoundContext,
  labels?: string[],
  options: { requireRuntimeCondition?: boolean } = {},
): number {
  return Object.entries(traits).reduce((total, [code, traitValue]) => {
    const definition = SPIRIT_BATTLE_TRAIT_BY_CODE[code as keyof typeof SPIRIT_BATTLE_TRAIT_BY_CODE];
    if (!definition || definition.value === 0) {
      return total;
    }
    const stackRatio = traitValue / definition.value;
    const effectTotal = definition.effects.reduce((effectSum, effect) => {
      if (
        effect.stat !== stat
        || (options.requireRuntimeCondition && !hasRuntimeCondition(effect))
        || !isRuleConditionActive(effect, unit, opponent, context)
      ) {
        return effectSum;
      }
      labels?.push(definition.label);
      return effectSum + effect.value * stackRatio;
    }, 0);
    return total + effectTotal;
  }, 0);
}

function hasRuntimeCondition(rule: SpiritBattleRuleCondition): boolean {
  return Boolean(
    rule.activeRounds
      || typeof rule.minRound === 'number'
      || typeof rule.maxRound === 'number'
      || rule.bloodOnly
      || typeof rule.selfHpBelowRatio === 'number'
      || typeof rule.selfHpAboveRatio === 'number'
      || typeof rule.targetHpBelowRatio === 'number'
      || rule.targetMaxHpHigher
      || rule.selfHpLowerThanTarget,
  );
}

function isRuleConditionActive(
  rule: SpiritBattleRuleCondition,
  unit?: PreparedUnit,
  opponent?: PreparedUnit,
  context?: RoundContext,
): boolean {
  if (rule.activeRounds && context && !rule.activeRounds.includes(context.round)) return false;
  if (typeof rule.minRound === 'number' && context && context.round < rule.minRound) return false;
  if (typeof rule.maxRound === 'number' && context && context.round > rule.maxRound) return false;
  if (rule.bloodOnly && context?.bloodRound === null) return false;
  if (!unit || !opponent) return !hasRuntimeCondition(rule);

  const selfHpRatio = unit.hp / Math.max(unit.snapshot.maxHp, 1);
  const targetHpRatio = opponent.hp / Math.max(opponent.snapshot.maxHp, 1);
  if (typeof rule.selfHpBelowRatio === 'number' && selfHpRatio >= rule.selfHpBelowRatio) return false;
  if (typeof rule.selfHpAboveRatio === 'number' && selfHpRatio <= rule.selfHpAboveRatio) return false;
  if (typeof rule.targetHpBelowRatio === 'number' && targetHpRatio >= rule.targetHpBelowRatio) return false;
  if (rule.targetMaxHpHigher && opponent.snapshot.maxHp <= unit.snapshot.maxHp) return false;
  if (rule.selfHpLowerThanTarget && unit.hp >= opponent.hp) return false;
  return true;
}

function resolveElementDamageState(attacker: ClientSpiritElement | null, defender: ClientSpiritElement | null): RoundDamage['elementAdvantage'] {
  if (attacker && defender && controlsElement(attacker, defender)) return 'strong';
  if (attacker && defender && controlsElement(defender, attacker)) return 'weak';
  return 'none';
}

function controlsElement(left: ClientSpiritElement, right: ClientSpiritElement): boolean {
  return (
    (left === 'metal' && right === 'wood')
    || (left === 'wood' && right === 'earth')
    || (left === 'earth' && right === 'water')
    || (left === 'water' && right === 'fire')
    || (left === 'fire' && right === 'metal')
  );
}

function dedupeLabels(labels: string[]): string[] {
  return [...new Set(labels)].slice(0, 4);
}

function resolveRoundDamage(
  attacker: PreparedUnit,
  defender: PreparedUnit,
  context: RoundContext,
  config: SpiritCollisionBattleConfig,
  random: () => number,
): RoundDamage {
  const dodgeChance = clampRatio(resolveTraitEffectValue(defender.traits, 'dodge', defender, attacker, context) / 100, 0, 0.75);
  if (random() < dodgeChance) {
    return { value: 0, dodged: true, critical: false, lifesteal: 0, elementAdvantage: 'none', traitLabels: [] };
  }

  const traitLabels: string[] = [];
  const attackPercent = resolveRoundAttackPercent(attacker, defender, context, traitLabels);
  const suppressedAttackPercent = attackPercent - Math.max(resolveTraitEffectValue(defender.traits, 'targetAttackReduction', defender, attacker, context), 0);
  const randomFactor = 0.95 + random() * 0.1;
  const minDamage = defender.snapshot.maxHp * config.minDamageByTargetMaxHpRatio;
  let value = Math.max(attacker.attack * (1 + suppressedAttackPercent / 100) * randomFactor, minDamage);
  const critChance = clampRatio(resolveRoundCritPercent(attacker, defender, context, traitLabels) / 100, 0, 1);
  const critical = random() < critChance;
  if (critical) {
    value *= 1.5 + Math.max(resolveTraitEffectValue(attacker.traits, 'critDamage', attacker, defender, context, traitLabels), 0) / 100;
  }

  const finalDamagePercent = resolveFinalDamagePercent(attacker, defender, context, traitLabels);
  const elementAdvantage = resolveElementDamageState(attacker.snapshot.element, defender.snapshot.element);
  const elementPercent = elementAdvantage === 'strong' ? 50 : elementAdvantage === 'weak' ? -20 : 0;
  const takenPercent = resolveDamageTakenPercent(defender, attacker, context, traitLabels);
  value *= Math.max(0, 1 + (finalDamagePercent + elementPercent + takenPercent) / 100);
  const roundedValue = Math.max(Math.round(value), 0);
  const lifestealPercent = resolveRoundLifestealPercent(attacker, defender, context, traitLabels);
  const lifesteal = Math.round(roundedValue * clampRatio(lifestealPercent / 100, 0, 1));

  return {
    value: roundedValue,
    dodged: false,
    critical,
    lifesteal,
    elementAdvantage,
    traitLabels: dedupeLabels(traitLabels),
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
  heals: HealResult,
  config: SpiritCollisionBattleConfig,
): void {
  steps.push({ type: 'clash', round, durationMs: config.clashDurationMs });
  steps.push({
    type: 'floatingText',
    side: 'defender',
    text: attackerDamage.dodged ? '闪避' : `-${attackerDamage.value}`,
    tone: attackerDamage.dodged ? 'miss' : attackerDamage.critical ? 'crit' : attackerDamage.elementAdvantage === 'strong' ? 'element' : 'damage',
    round,
    durationMs: 260,
  });
  steps.push({
    type: 'floatingText',
    side: 'attacker',
    text: defenderDamage.dodged ? '闪避' : `-${defenderDamage.value}`,
    tone: defenderDamage.dodged ? 'miss' : defenderDamage.critical ? 'crit' : defenderDamage.elementAdvantage === 'strong' ? 'element' : 'damage',
    round,
    durationMs: 260,
  });

  if (heals.attackerHeal > 0) {
    steps.push({ type: 'floatingText', side: 'attacker', text: `+${heals.attackerHeal}`, tone: 'buff', round, durationMs: 220 });
  }
  if (heals.defenderHeal > 0) {
    steps.push({ type: 'floatingText', side: 'defender', text: `+${heals.defenderHeal}`, tone: 'buff', round, durationMs: 220 });
  }

  steps.push({ type: 'hpChange', side: 'defender', from: defenderBefore, to: defenderAfter, max: defenderMaxHp, round, durationMs: config.hpChangeDurationMs });
  steps.push({ type: 'hpChange', side: 'attacker', from: attackerBefore, to: attackerAfter, max: attackerMaxHp, round, durationMs: config.hpChangeDurationMs });
  steps.push({ type: 'return', durationMs: config.returnDurationMs + (round >= config.maxRounds ? 120 : 0) });
}

function appendRoundEvents(
  events: ClientRaidBattleEvent[],
  round: number,
  attackerDamage: RoundDamage,
  defenderDamage: RoundDamage,
  heals: HealResult,
  attackerHp: number,
  defenderHp: number,
  attackerTotalCombatDamage: number,
  defenderTotalCombatDamage: number,
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
  if (attackerDamage.elementAdvantage !== 'none') {
    events.push({
      type: 'element',
      label: `第 ${round} 回合攻方${attackerDamage.elementAdvantage === 'strong' ? '五行克制' : '五行被克'}`,
      description: attackerDamage.elementAdvantage === 'strong' ? '攻方命中后最终伤害 +50%。' : '攻方命中后最终伤害 -20%。',
    });
  }
  if (defenderDamage.elementAdvantage !== 'none') {
    events.push({
      type: 'element',
      label: `第 ${round} 回合守方${defenderDamage.elementAdvantage === 'strong' ? '五行克制' : '五行被克'}`,
      description: defenderDamage.elementAdvantage === 'strong' ? '守方命中后最终伤害 +50%。' : '守方命中后最终伤害 -20%。',
    });
  }
  for (const label of attackerDamage.traitLabels) {
    events.push({ type: 'trait', label: `第 ${round} 回合触发${label}`, description: `${label}参与了攻方本次命中结算。` });
  }
  for (const label of defenderDamage.traitLabels) {
    events.push({ type: 'trait', label: `第 ${round} 回合触发${label}`, description: `${label}参与了守方本次命中结算。` });
  }
  for (const label of heals.attackerLabels) {
    events.push({ type: 'trait', label: `第 ${round} 回合攻方${label}`, description: `${label}在本回合回复生命。` });
  }
  for (const label of heals.defenderLabels) {
    events.push({ type: 'trait', label: `第 ${round} 回合守方${label}`, description: `${label}在本回合回复生命。` });
  }
  events.push({
    type: 'damage',
    label: `第 ${round} 回合对撞`,
    description: `攻方剩余 ${attackerHp}，守方剩余 ${defenderHp}；累计对敌伤害 攻方 ${attackerTotalCombatDamage} / 守方 ${defenderTotalCombatDamage}。`,
  });
}

function resolveBloodLoss(maxHp: number, ratio: number): number {
  if (ratio <= 0) return 0;
  return Math.max(Math.round(Math.max(maxHp, 1) * ratio), 1);
}

function resolveBloodLossRatio(bloodRound: number, config: SpiritCollisionBattleConfig): number {
  return Math.max(
    config.bloodModeInitialHpLossRatio + Math.max(Math.floor(bloodRound) - 1, 0) * config.bloodModeHpLossRatioIncrement,
    0,
  );
}

function formatBloodRatio(ratio: number): string {
  const percent = ratio * 100;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

function capEffectiveDamage(targetHpBefore: number, rawDamage: number): number {
  return Math.min(Math.max(Math.round(targetHpBefore), 0), Math.max(Math.round(rawDamage), 0));
}

function resolveBloodModeDeaths(
  attackerHp: number,
  defenderHp: number,
  bloodRound: number,
  attackerTotalCombatDamage: number,
  defenderTotalCombatDamage: number,
  attackerBloodEntryHpRatio: number,
  defenderBloodEntryHpRatio: number,
  timing: string,
): { result: SpiritCollisionBattleResult; reason: string } | null {
  const attackerDead = attackerHp <= 0;
  const defenderDead = defenderHp <= 0;
  if (!attackerDead && !defenderDead) {
    return null;
  }
  if (defenderDead && !attackerDead) {
    return { result: 'WIN', reason: `燃血第 ${bloodRound} 回合${timing}守方倒下` };
  }
  if (attackerDead && !defenderDead) {
    return { result: 'LOSS', reason: `燃血第 ${bloodRound} 回合${timing}攻方倒下` };
  }

  const tieBreak = resolveBloodModeTieBreak(
    attackerTotalCombatDamage,
    defenderTotalCombatDamage,
    attackerBloodEntryHpRatio,
    defenderBloodEntryHpRatio,
  );
  return {
    result: tieBreak.result,
    reason: `燃血第 ${bloodRound} 回合${timing}双方同时归零，${tieBreak.reason}`,
  };
}

function resolveBloodModeTieBreak(
  attackerTotalCombatDamage: number,
  defenderTotalCombatDamage: number,
  attackerBloodEntryHpRatio: number,
  defenderBloodEntryHpRatio: number,
): { result: SpiritCollisionBattleResult; reason: string } {
  if (attackerTotalCombatDamage > defenderTotalCombatDamage) {
    return { result: 'WIN', reason: '攻方累计对敌伤害更高' };
  }
  if (defenderTotalCombatDamage > attackerTotalCombatDamage) {
    return { result: 'LOSS', reason: '守方累计对敌伤害更高' };
  }
  if (attackerBloodEntryHpRatio > defenderBloodEntryHpRatio) {
    return { result: 'WIN', reason: '累计伤害相同，攻方进入燃血时血量比例更高' };
  }
  if (defenderBloodEntryHpRatio > attackerBloodEntryHpRatio) {
    return { result: 'LOSS', reason: '累计伤害相同，守方进入燃血时血量比例更高' };
  }
  return { result: 'LOSS', reason: '累计伤害与燃血入场血量比例相同，守方守护成功' };
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
