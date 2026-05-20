import { Injectable } from '@nestjs/common';

type RaidOutcomeTier = 'perfect_win' | 'major_win' | 'minor_win' | 'draw' | 'minor_loss' | 'major_loss' | 'perfect_loss';
type Element = 'METAL' | 'WOOD' | 'WATER' | 'FIRE' | 'EARTH';

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
}

export interface RaidSettlementRuleInput {
  lockedGold: number;
  vaultGold: number;
  vaultCapacity: number;
  attackerFactionName: string | null;
  defenderFactionName: string | null;
  attackerSpirit: SpiritBattleSnapshot | null;
  defenderSpirit: SpiritBattleSnapshot | null;
}

export interface RaidSettlementRuleResult {
  result: 'WIN' | 'LOSS' | 'DRAW';
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
  shardDrop: { spiritDefinitionId: string; spiritId: string; label: string; quantity: number } | null;
  rewardItems: Array<Record<string, unknown>>;
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
  soulReward: number;
  attackerHpLossPercent: number;
  defenderHpLossPercent: number;
}> = {
  perfect_win: { title: '完胜', subtitle: '摧枯拉朽', goldRatio: 0.92, soulReward: 8, attackerHpLossPercent: 6, defenderHpLossPercent: 34 },
  major_win: { title: '大胜', subtitle: '势如破竹', goldRatio: 0.72, soulReward: 6, attackerHpLossPercent: 11, defenderHpLossPercent: 28 },
  minor_win: { title: '小胜', subtitle: '险取一筹', goldRatio: 0.46, soulReward: 4, attackerHpLossPercent: 18, defenderHpLossPercent: 23 },
  draw: { title: '相持', subtitle: '平分秋色', goldRatio: 0.24, soulReward: 3, attackerHpLossPercent: 22, defenderHpLossPercent: 22 },
  minor_loss: { title: '小败', subtitle: '惜败而退', goldRatio: 0.1, soulReward: 2, attackerHpLossPercent: 28, defenderHpLossPercent: 16 },
  major_loss: { title: '大败', subtitle: '溃势而归', goldRatio: 0.03, soulReward: 1, attackerHpLossPercent: 36, defenderHpLossPercent: 10 },
  perfect_loss: { title: '完败', subtitle: '兵败如山', goldRatio: 0, soulReward: 1, attackerHpLossPercent: 46, defenderHpLossPercent: 6 },
};

@Injectable()
export class RaidSettlementRuleService {
  calculate(input: RaidSettlementRuleInput): RaidSettlementRuleResult {
    const attackerPanel = buildPanel(input.attackerSpirit, input.attackerFactionName);
    const defenderPanel = buildPanel(input.defenderSpirit, input.defenderFactionName);
    const adjusted = applyElementRelation(attackerPanel, defenderPanel);
    const attackerScore = calculateBattleScore(adjusted.attacker);
    const defenderScore = calculateBattleScore(adjusted.defender);
    const scoreDeltaRatio = (attackerScore - defenderScore) / Math.max(defenderScore, 1);
    const tier = resolveTier(scoreDeltaRatio);
    const config = TIER_CONFIG[tier];
    const result = tier === 'draw' ? 'DRAW' : tier.endsWith('win') ? 'WIN' : 'LOSS';
    const lockedGold = Math.max(Math.floor(input.lockedGold), 0);
    const lootGold = Math.min(lockedGold, Math.floor(lockedGold * config.goldRatio));
    const availableVaultSpace = Math.max(input.vaultCapacity - input.vaultGold, 0);
    const depositedGold = Math.min(lootGold, availableVaultSpace);
    const overflowGold = Math.max(lootGold - depositedGold, 0);
    const attackerNextHp = applyHpLoss(input.attackerSpirit, config.attackerHpLossPercent);
    const defenderNextHp = applyHpLoss(input.defenderSpirit, config.defenderHpLossPercent);
    const shardDrop = buildShardDrop(input.defenderSpirit, tier, scoreDeltaRatio);
    const rewardItems: Array<Record<string, unknown>> = [
      { type: 'spiritSoul', label: '兽魂', quantity: config.soulReward },
    ];

    if (shardDrop) {
      rewardItems.push({ type: 'spiritShard', spiritId: shardDrop.spiritId, label: `${shardDrop.label}精魄`, quantity: shardDrop.quantity });
    }

    return {
      result,
      tier,
      title: config.title,
      subtitle: config.subtitle,
      lootGold,
      depositedGold,
      overflowGold,
      attackerLoss: 0,
      defenderLoss: 0,
      attackerHpLossPercent: config.attackerHpLossPercent,
      defenderHpLossPercent: config.defenderHpLossPercent,
      spiritSoulReward: config.soulReward,
      shardDrop,
      rewardItems,
      attackerSpiritSlotId: input.attackerSpirit?.slotId ?? null,
      defenderSpiritSlotId: input.defenderSpirit?.slotId ?? null,
      attackerNextHp,
      defenderNextHp,
      reportSummary: `${config.title} · ${config.subtitle}，带回 ${lootGold} 金币、${config.soulReward} 颗兽魂，主战灵宠扣血 ${config.attackerHpLossPercent}%。`,
    };
  }
}

interface SpiritPanel {
  attack: number;
  defense: number;
  hp: number;
  hpRatio: number;
  element: Element | null;
}

function buildPanel(snapshot: SpiritBattleSnapshot | null, factionName: string | null): SpiritPanel {
  if (!snapshot) {
    return { attack: 50, defense: 50, hp: 120, hpRatio: 1, element: null };
  }

  const rarityMultiplier = getRarityGrowthMultiplier(snapshot.spiritDefinition.rarity, snapshot.level);
  const levelDelta = Math.max(snapshot.level - 1, 0);
  let attack = snapshot.spiritDefinition.baseAttack + levelDelta * snapshot.spiritDefinition.growthAttack * rarityMultiplier;
  let defense = snapshot.spiritDefinition.baseDefense + levelDelta * snapshot.spiritDefinition.growthDefense * rarityMultiplier;
  let hp = snapshot.spiritDefinition.baseHp + levelDelta * snapshot.spiritDefinition.growthHp * rarityMultiplier;
  const faction = normalizeFaction(snapshot.spiritDefinition.factionAffinity);

  if (faction && faction === normalizeFaction(factionName)) {
    if (faction === 'immortal') {
      defense *= 1.08;
    } else if (faction === 'demon') {
      attack *= 1.08;
    } else if (faction === 'human') {
      hp *= 1.08;
    }
  }

  return {
    attack,
    defense,
    hp,
    hpRatio: snapshot.maxHp > 0 ? Math.max(Math.min(snapshot.currentHp / snapshot.maxHp, 1), 0.05) : 1,
    element: snapshot.element,
  };
}

function applyElementRelation(attacker: SpiritPanel, defender: SpiritPanel): { attacker: SpiritPanel; defender: SpiritPanel } {
  const nextAttacker = { ...attacker };
  const nextDefender = { ...defender };

  if (attacker.element && defender.element && controls(attacker.element, defender.element)) {
    nextAttacker.attack *= 1.8;
    nextAttacker.defense *= 1.5;
    nextDefender.attack *= 0.75;
    nextDefender.defense *= 0.75;
  } else if (attacker.element && defender.element && controls(defender.element, attacker.element)) {
    nextDefender.attack *= 1.8;
    nextDefender.defense *= 1.5;
    nextAttacker.attack *= 0.75;
    nextAttacker.defense *= 0.75;
  }

  return { attacker: nextAttacker, defender: nextDefender };
}

function calculateBattleScore(panel: SpiritPanel): number {
  return (panel.attack * 0.46 + panel.defense * 0.34 + panel.hp * 0.2) * (0.55 + panel.hpRatio * 0.45);
}

function resolveTier(scoreDeltaRatio: number): RaidOutcomeTier {
  if (scoreDeltaRatio >= 0.35) {
    return 'perfect_win';
  }
  if (scoreDeltaRatio >= 0.2) {
    return 'major_win';
  }
  if (scoreDeltaRatio >= 0.03) {
    return 'minor_win';
  }
  if (scoreDeltaRatio > -0.03) {
    return 'draw';
  }
  if (scoreDeltaRatio > -0.2) {
    return 'minor_loss';
  }
  if (scoreDeltaRatio > -0.35) {
    return 'major_loss';
  }
  return 'perfect_loss';
}

function applyHpLoss(snapshot: SpiritBattleSnapshot | null, percent: number): number | null {
  if (!snapshot) {
    return null;
  }

  const loss = Math.max(1, Math.ceil(snapshot.maxHp * (percent / 100)));
  return Math.max(snapshot.currentHp - loss, 0);
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

function getRarityGrowthMultiplier(rarity: string, level: number): number {
  if (rarity === 'LEGENDARY') {
    return level <= 10 ? 0.9 : level <= 30 ? 1.02 : 1.18;
  }
  if (rarity === 'RARE') {
    return level <= 10 ? 0.96 : level <= 30 ? 1.06 : 1.08;
  }
  return level <= 30 ? 1 : 0.92;
}

function normalizeFaction(value: string | null): 'human' | 'immortal' | 'demon' | null {
  if (!value) {
    return null;
  }
  if (value === 'human' || value === '人界') {
    return 'human';
  }
  if (value === 'immortal' || value === '仙界') {
    return 'immortal';
  }
  if (value === 'demon' || value === '魔界') {
    return 'demon';
  }
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
