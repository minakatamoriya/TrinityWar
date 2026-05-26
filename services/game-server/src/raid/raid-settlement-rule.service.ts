import { Injectable } from '@nestjs/common';

type RaidOutcomeTier = 'perfect_win' | 'major_win' | 'minor_win' | 'draw' | 'minor_loss' | 'major_loss' | 'perfect_loss';
type Element = 'METAL' | 'WOOD' | 'WATER' | 'FIRE' | 'EARTH';
type BattleResult = 'WIN' | 'LOSS' | 'DRAW';

export interface SpiritBattleSnapshot {
  slotId: string;
  slotIndex: number;
  level: number;
  element: Element | null;
  currentHp: number;
  maxHp: number;
  status: string;
  spiritDefinition: {
    id: string;
    spiritId: string;
    label: string;
    rarity: string;
    factionAffinity: string;
    role: string;
    baseAttack: number;
    baseDefense: number;
    baseHp: number;
    growthAttack: number;
    growthDefense: number;
    growthHp: number;
  };
  traits?: Array<{
    traitCode: string;
    traitValue: number;
  }>;
}

export interface RaidSettlementRuleInput {
  lockedGold: number;
  vaultGold: number;
  attackerFactionName: string | null;
  defenderFactionName: string | null;
  attackerSpirit: SpiritBattleSnapshot | null;
  defenderSpirit: SpiritBattleSnapshot | null;
  guaranteedOrdinarySoul?: number;
}

export interface RaidSettlementRuleResult {
  result: BattleResult;
  tier: RaidOutcomeTier;
  title: string;
  subtitle: string;
  lootGold: number;
  depositedGold: number;
  overflowGold: number;
  attackerLoss: number;
  defenderLoss: number;
  attackerHpLossPercent: number;
  defenderHpLossPercent: number;
  spiritSoulReward: number;
  soulRewards: { ordinary: number; rare: number; legendary: number };
  shardDrop: { spiritDefinitionId: string; spiritId: string; label: string; quantity: number } | null;
  rewardItems: Array<Record<string, unknown>>;
  battleEvents: Array<{ type: string; label: string; description: string }>;
  attackerSpiritSlotId: string | null;
  defenderSpiritSlotId: string | null;
  attackerNextHp: number | null;
  defenderNextHp: number | null;
  reportSummary: string;
}

const TIER_CONFIG: Record<RaidOutcomeTier, {
  title: string;
  subtitle: string;
  goldRatio: number;
}> = {
  perfect_win: { title: '完胜', subtitle: '摧枯拉朽', goldRatio: 0.92 },
  major_win: { title: '大胜', subtitle: '势如破竹', goldRatio: 0.72 },
  minor_win: { title: '小胜', subtitle: '险取一筹', goldRatio: 0.46 },
  draw: { title: '相持', subtitle: '平分秋色', goldRatio: 0.24 },
  minor_loss: { title: '小败', subtitle: '惜败而退', goldRatio: 0.1 },
  major_loss: { title: '大败', subtitle: '溃势而归', goldRatio: 0.03 },
  perfect_loss: { title: '完败', subtitle: '兵败如山', goldRatio: 0 },
};

@Injectable()
export class RaidSettlementRuleService {
  calculate(input: RaidSettlementRuleInput): RaidSettlementRuleResult {
    const attackerPanel = buildPanel(input.attackerSpirit, input.attackerFactionName);
    const defenderPanel = buildPanel(input.defenderSpirit, input.defenderFactionName);
    const battle = resolveSingleClash(attackerPanel, defenderPanel);
    const attackerRatio = battle.attackerHpAfter / Math.max(battle.attackerMaxHp, 1);
    const defenderRatio = battle.defenderHpAfter / Math.max(battle.defenderMaxHp, 1);
    const scoreDeltaRatio = attackerRatio - defenderRatio;
    const tier = resolveTier(battle.result, scoreDeltaRatio);
    const config = TIER_CONFIG[tier];
    const lockedGold = Math.max(Math.floor(input.lockedGold), 0);
    const lootGold = Math.min(lockedGold, Math.floor(lockedGold * config.goldRatio));
    const depositedGold = lootGold;
    const attackerNextHp = input.attackerSpirit ? clampHpForPersistence(battle.attackerHpAfter, input.attackerSpirit.maxHp) : null;
    const defenderNextHp = input.defenderSpirit ? clampHpForPersistence(battle.defenderHpAfter, input.defenderSpirit.maxHp) : null;
    const soulRewards = buildSoulRewards(input.defenderSpirit, battle.result);
    if (battle.result === 'WIN' && (input.guaranteedOrdinarySoul ?? 0) > 0) {
      soulRewards.ordinary = Math.max(soulRewards.ordinary, Math.floor(input.guaranteedOrdinarySoul ?? 0));
    }
    const shardDrop = buildShardDrop(input.defenderSpirit, tier, scoreDeltaRatio);
    const rewardItems = buildRewardItems(soulRewards, shardDrop);
    const rewardSummary = formatRewardSummary(soulRewards, shardDrop);
    const attackerHpLossPercent = input.attackerSpirit ? Math.max(Math.round((1 - (attackerNextHp ?? 0) / Math.max(input.attackerSpirit.maxHp, 1)) * 100), 0) : 0;
    const defenderHpLossPercent = input.defenderSpirit ? Math.max(Math.round((1 - (defenderNextHp ?? 0) / Math.max(input.defenderSpirit.maxHp, 1)) * 100), 0) : 0;

    return {
      result: battle.result,
      tier,
      title: config.title,
      subtitle: config.subtitle,
      lootGold,
      depositedGold,
      overflowGold: 0,
      attackerLoss: 0,
      defenderLoss: 0,
      attackerHpLossPercent,
      defenderHpLossPercent,
      spiritSoulReward: 0,
      soulRewards,
      shardDrop,
      rewardItems,
      battleEvents: battle.events,
      attackerSpiritSlotId: input.attackerSpirit?.slotId ?? null,
      defenderSpiritSlotId: input.defenderSpirit?.slotId ?? null,
      attackerNextHp,
      defenderNextHp,
      reportSummary: `${config.title} · ${config.subtitle}，带回 ${lootGold} 金币、${rewardSummary}。${battle.events.map((event) => event.label).join('、')}。`,
    };
  }
}

interface TraitTotals {
  claw: number;
  thickSkin: number;
  hardArmor: number;
  crit: number;
  critDamage: number;
  dodge: number;
  counter: number;
  lifesteal: number;
  armorBreak: number;
  tenacity: number;
}

interface SpiritPanel {
  label: string;
  attack: number;
  defense: number;
  maxHp: number;
  currentHp: number;
  healthStatus: BattleHealthStatus;
  element: Element | null;
  traits: TraitTotals;
}

type BattleHealthStatus = {
  code: 'normal' | 'low' | 'injured' | 'down';
  label: string;
  attackDefenseCoefficient: number;
};

function buildPanel(snapshot: SpiritBattleSnapshot | null, factionName: string | null): SpiritPanel {
  if (!snapshot) {
    return {
      label: '守备灵宠',
      attack: 50,
      defense: 50,
      maxHp: 120,
      currentHp: 120,
      healthStatus: resolveBattleHealthStatus(120, 120),
      element: null,
      traits: emptyTraits(),
    };
  }

  const rarityMultiplier = getRarityGrowthMultiplier(snapshot.spiritDefinition.rarity, snapshot.level);
  const levelDelta = Math.max(snapshot.level - 1, 0);
  let attack = snapshot.spiritDefinition.baseAttack + levelDelta * snapshot.spiritDefinition.growthAttack * rarityMultiplier;
  let defense = snapshot.spiritDefinition.baseDefense + levelDelta * snapshot.spiritDefinition.growthDefense * rarityMultiplier;
  let maxHp = snapshot.spiritDefinition.baseHp + levelDelta * snapshot.spiritDefinition.growthHp * rarityMultiplier;
  const faction = normalizeFaction(snapshot.spiritDefinition.factionAffinity);

  if (faction && faction === normalizeFaction(factionName)) {
    if (faction === 'immortal') {
      defense *= 1.08;
    } else if (faction === 'demon') {
      attack *= 1.08;
    } else if (faction === 'human') {
      maxHp *= 1.08;
    }
  }

  const traits = buildTraitTotals(snapshot.traits ?? []);
  attack *= 1 + traits.claw / 100;
  defense *= 1 + traits.hardArmor / 100;
  maxHp *= 1 + traits.thickSkin / 100;
  const currentHp = Math.min(Math.max(snapshot.currentHp, 0), Math.max(snapshot.maxHp, 1));
  const healthStatus = resolveBattleHealthStatus(currentHp, snapshot.maxHp);
  attack *= healthStatus.attackDefenseCoefficient;
  defense *= healthStatus.attackDefenseCoefficient;

  return {
    label: snapshot.spiritDefinition.label,
    attack,
    defense,
    maxHp,
    currentHp,
    healthStatus,
    element: snapshot.element,
    traits,
  };
}

function resolveSingleClash(attacker: SpiritPanel, defender: SpiritPanel): {
  result: BattleResult;
  attackerHpAfter: number;
  defenderHpAfter: number;
  attackerMaxHp: number;
  defenderMaxHp: number;
  events: Array<{ type: string; label: string; description: string }>;
} {
  const events: Array<{ type: string; label: string; description: string }> = [];
  const relation = resolveElementAdvantage(attacker.element, defender.element);
  const attackerMultiplier = relation === 'attacker' ? 2 : 1;
  const defenderMultiplier = relation === 'defender' ? 2 : 1;

  for (const [sideLabel, panel] of [['进攻方', attacker], ['防守方', defender]] as const) {
    if (panel.healthStatus.code !== 'normal') {
      events.push({
        type: 'status',
        label: `${sideLabel}${panel.healthStatus.label}`,
        description: `${sideLabel}开战血量状态为${panel.healthStatus.label}，攻击和防御按 ${Math.round(panel.healthStatus.attackDefenseCoefficient * 100)}% 结算，词条效果不受影响。`,
      });
    }
  }

  if (relation !== 'none') {
    events.push({
      type: 'element',
      label: relation === 'attacker' ? '五行克制' : '被五行克制',
      description: relation === 'attacker' ? '进攻方本场攻防血和普通战斗词条效果翻倍。' : '防守方本场攻防血和普通战斗词条效果翻倍。',
    });
  }

  const attackerDamage = resolveAttack(attacker, defender, attackerMultiplier, defenderMultiplier, '进攻方', events);
  const defenderDamage = resolveAttack(defender, attacker, defenderMultiplier, attackerMultiplier, '防守方', events);
  let attackerHpAfter = Math.max(attacker.currentHp * attackerMultiplier - defenderDamage.damage + attackerDamage.lifesteal - defenderDamage.counterDamage, 0);
  let defenderHpAfter = Math.max(defender.currentHp * defenderMultiplier - attackerDamage.damage + defenderDamage.lifesteal - attackerDamage.counterDamage, 0);

  if (attackerDamage.execute) {
    defenderHpAfter = 0;
  }
  if (defenderDamage.execute) {
    attackerHpAfter = 0;
  }

  const result = attackerHpAfter > defenderHpAfter
    ? 'WIN'
    : defenderHpAfter > attackerHpAfter
      ? 'LOSS'
      : relation === 'attacker'
        ? 'WIN'
        : relation === 'defender'
          ? 'LOSS'
          : 'DRAW';

  events.push({
    type: 'damage',
    label: result === 'WIN' ? '进攻方胜出' : result === 'LOSS' ? '防守方胜出' : '双方战平',
    description: `进攻方剩余 ${Math.floor(attackerHpAfter)}，防守方剩余 ${Math.floor(defenderHpAfter)}。`,
  });

  return {
    result,
    attackerHpAfter,
    defenderHpAfter,
    attackerMaxHp: attacker.maxHp * attackerMultiplier,
    defenderMaxHp: defender.maxHp * defenderMultiplier,
    events,
  };
}

function resolveBattleHealthStatus(currentHp: number, maxHp: number): BattleHealthStatus {
  const ratio = maxHp > 0 ? currentHp / maxHp : 0;
  if (currentHp <= 0 || ratio <= 0) {
    return { code: 'down', label: '不可出战', attackDefenseCoefficient: 0 };
  }
  if (ratio < 0.3) {
    return { code: 'injured', label: '重伤：攻防 30%', attackDefenseCoefficient: 0.3 };
  }
  if (ratio < 0.7) {
    return { code: 'low', label: '低迷：攻防 70%', attackDefenseCoefficient: 0.7 };
  }
  return { code: 'normal', label: '正常：攻防 100%', attackDefenseCoefficient: 1 };
}

function resolveAttack(
  attacker: SpiritPanel,
  defender: SpiritPanel,
  attackerMultiplier: number,
  defenderMultiplier: number,
  label: string,
  events: Array<{ type: string; label: string; description: string }>,
): { damage: number; lifesteal: number; counterDamage: number; execute: boolean } {
  const dodgeChance = clampPercent(defender.traits.dodge);
  if (Math.random() * 100 < dodgeChance) {
    events.push({ type: 'dodge', label: `${label}攻击被闪避`, description: '闪避成功，本次攻击完全落空。' });
    return { damage: 0, lifesteal: 0, counterDamage: 0, execute: false };
  }

  const executeChance = 0;
  if (executeChance > 0 && Math.random() * 100 < executeChance) {
    events.push({ type: 'execute', label: `${label}触发秒杀`, description: '秒杀优先于普通伤害，直接击败目标。' });
    return { damage: defender.currentHp * defenderMultiplier, lifesteal: 0, counterDamage: 0, execute: true };
  }

  const pierceDefense = Math.max(defender.defense * defenderMultiplier * (1 - clampPercent(attacker.traits.armorBreak * attackerMultiplier) / 100), 0);
  const randomFactor = 0.9 + Math.random() * 0.2;
  let damage = attacker.attack * attackerMultiplier * (1 - pierceDefense / (pierceDefense + 200)) * randomFactor;
  const critChance = clampPercent(attacker.traits.crit * attackerMultiplier);
  const didCrit = Math.random() * 100 < critChance;

  if (didCrit) {
    const tenacity = clampPercent(defender.traits.tenacity * defenderMultiplier);
    const critMultiplier = Math.max(1, 1.5 + (attacker.traits.critDamage * attackerMultiplier) / 100 - tenacity / 100);
    damage *= critMultiplier;
    events.push({ type: 'critical', label: `${label}暴击`, description: `暴击倍率 ${critMultiplier.toFixed(2)}。` });
  }

  const lifesteal = damage * clampPercent(attacker.traits.lifesteal * attackerMultiplier) / 100;
  if (lifesteal > 0) {
    events.push({ type: 'lifesteal', label: `${label}吸血`, description: `回复 ${Math.floor(lifesteal)} 生命。` });
  }

  let counterDamage = 0;
  const counterChance = clampPercent(defender.traits.counter * defenderMultiplier);
  if (Math.random() * 100 < counterChance) {
    counterDamage = damage * 0.5;
    events.push({ type: 'counter', label: `${label}被反击`, description: `反击造成 ${Math.floor(counterDamage)} 伤害。` });
  }

  return { damage, lifesteal, counterDamage, execute: false };
}

function buildSoulRewards(defenderSpirit: SpiritBattleSnapshot | null, result: BattleResult): { ordinary: number; rare: number; legendary: number } {
  if (result !== 'WIN' || !defenderSpirit) {
    return { ordinary: 0, rare: 0, legendary: 0 };
  }

  const rarity = defenderSpirit.spiritDefinition.rarity;
  const rewards = { ordinary: 0, rare: 0, legendary: 0 };

  if (rarity === 'LEGENDARY') {
    rewards.ordinary = randomChance(0.8) ? randomInt(2, 4) : 0;
    rewards.rare = randomChance(0.32) ? 1 : 0;
    rewards.legendary = randomChance(0.06) ? 1 : 0;
  } else if (rarity === 'RARE') {
    rewards.ordinary = randomChance(0.65) ? randomInt(1, 3) : 0;
    rewards.rare = randomChance(0.18) ? 1 : 0;
  } else {
    rewards.ordinary = randomChance(0.55) ? randomInt(1, 2) : 0;
  }

  return rewards;
}

function buildRewardItems(
  soulRewards: RaidSettlementRuleResult['soulRewards'],
  shardDrop: RaidSettlementRuleResult['shardDrop'],
): Array<Record<string, unknown>> {
  const items: Array<Record<string, unknown>> = [];
  if (soulRewards.ordinary > 0) {
    items.push({ type: 'ordinarySoul', seedId: 'ordinary-soul', label: '普通兽魂', quantity: soulRewards.ordinary });
  }
  if (soulRewards.rare > 0) {
    items.push({ type: 'rareSoul', seedId: 'rare-soul', label: '稀有兽魂', quantity: soulRewards.rare });
  }
  if (soulRewards.legendary > 0) {
    items.push({ type: 'legendarySoul', seedId: 'legendary-soul', label: '传说兽魂', quantity: soulRewards.legendary });
  }
  if (shardDrop) {
    items.push({ type: 'spiritShard', spiritId: shardDrop.spiritId, seedId: shardDrop.spiritId, label: `${shardDrop.label}精魄`, quantity: shardDrop.quantity });
  }
  return items;
}

function formatRewardSummary(soulRewards: RaidSettlementRuleResult['soulRewards'], shardDrop: RaidSettlementRuleResult['shardDrop']): string {
  const parts = buildRewardItems(soulRewards, shardDrop).map((item) => `${String(item.label)} x${Number(item.quantity)}`);
  return parts.join('、') || '无额外掉落';
}

function buildShardDrop(
  defenderSpirit: SpiritBattleSnapshot | null,
  tier: RaidOutcomeTier,
  scoreDeltaRatio: number,
): { spiritDefinitionId: string; spiritId: string; label: string; quantity: number } | null {
  if (!defenderSpirit || !['perfect_win', 'major_win', 'minor_win'].includes(tier)) {
    return null;
  }

  const rarity = defenderSpirit.spiritDefinition.rarity;
  const baseChance = rarity === 'LEGENDARY' ? 0.03 : rarity === 'RARE' ? 0.08 : 0.16;
  const tierBonus = tier === 'perfect_win' ? 0.08 : tier === 'major_win' ? 0.04 : 0;
  const deterministicRoll = Math.abs(Math.sin((scoreDeltaRatio + defenderSpirit.level) * 9973)) % 1;

  if (deterministicRoll > baseChance + tierBonus) {
    return null;
  }

  return {
    spiritDefinitionId: defenderSpirit.spiritDefinition.id,
    spiritId: defenderSpirit.spiritDefinition.spiritId,
    label: defenderSpirit.spiritDefinition.label,
    quantity: 1,
  };
}

function buildTraitTotals(traits: SpiritBattleSnapshot['traits']): TraitTotals {
  const totals = emptyTraits();
  for (const trait of traits ?? []) {
    if (trait.traitCode === 'claw') totals.claw += trait.traitValue;
    else if (trait.traitCode === 'thick_skin') totals.thickSkin += trait.traitValue;
    else if (trait.traitCode === 'hard_armor') totals.hardArmor += trait.traitValue;
    else if (trait.traitCode === 'crit') totals.crit += trait.traitValue;
    else if (trait.traitCode === 'crit_damage') totals.critDamage += trait.traitValue;
    else if (trait.traitCode === 'dodge') totals.dodge += trait.traitValue;
    else if (trait.traitCode === 'counter') totals.counter += trait.traitValue;
    else if (trait.traitCode === 'lifesteal') totals.lifesteal += trait.traitValue;
    else if (trait.traitCode === 'armor_break') totals.armorBreak += trait.traitValue;
    else if (trait.traitCode === 'tenacity') totals.tenacity += trait.traitValue;
  }
  return totals;
}

function emptyTraits(): TraitTotals {
  return { claw: 0, thickSkin: 0, hardArmor: 0, crit: 0, critDamage: 0, dodge: 0, counter: 0, lifesteal: 0, armorBreak: 0, tenacity: 0 };
}

function resolveElementAdvantage(attacker: Element | null, defender: Element | null): 'attacker' | 'defender' | 'none' {
  if (attacker && defender && controls(attacker, defender)) {
    return 'attacker';
  }
  if (attacker && defender && controls(defender, attacker)) {
    return 'defender';
  }
  return 'none';
}

function resolveTier(result: BattleResult, scoreDeltaRatio: number): RaidOutcomeTier {
  const delta = Math.abs(scoreDeltaRatio);
  if (result === 'DRAW') return 'draw';
  if (result === 'WIN') {
    if (delta >= 0.35) return 'perfect_win';
    if (delta >= 0.2) return 'major_win';
    return 'minor_win';
  }
  if (delta >= 0.35) return 'perfect_loss';
  if (delta >= 0.2) return 'major_loss';
  return 'minor_loss';
}

function clampPercent(value: number): number {
  return Math.max(Math.min(value, 100), 0);
}

function clampHpForPersistence(value: number, maxHp: number): number {
  return Math.max(Math.min(Math.floor(value), Math.max(maxHp, 0)), 0);
}

function randomChance(chance: number): boolean {
  return Math.random() < chance;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRarityGrowthMultiplier(rarity: string, level: number): number {
  if (rarity === 'LEGENDARY') return level <= 10 ? 0.9 : level <= 30 ? 1.02 : 1.18;
  if (rarity === 'RARE') return level <= 10 ? 0.96 : level <= 30 ? 1.06 : 1.08;
  return level <= 30 ? 1 : 0.92;
}

function normalizeFaction(value: string | null): 'human' | 'immortal' | 'demon' | null {
  if (!value) return null;
  if (value === 'human' || value === '人界') return 'human';
  if (value === 'immortal' || value === '仙界') return 'immortal';
  if (value === 'demon' || value === '魔界') return 'demon';
  return null;
}

function controls(left: Element, right: Element): boolean {
  return (
    (left === 'METAL' && right === 'WOOD')
    || (left === 'WOOD' && right === 'EARTH')
    || (left === 'EARTH' && right === 'WATER')
    || (left === 'WATER' && right === 'FIRE')
    || (left === 'FIRE' && right === 'METAL')
  );
}
