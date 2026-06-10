import { AsyncLocalStorage } from 'node:async_hooks';
import { getFactionAdvantageConfig } from './game-balance.js';

export type FactionAdvantageCode = 'human' | 'immortal' | 'demon' | null;
export type FactionAdvantageRuleSet = 'current' | 'legacy' | 'v0.2' | 'none';

const factionAdvantageRuleSetStorage = new AsyncLocalStorage<FactionAdvantageRuleSet>();

export function getFactionAdvantageRuleSet(): FactionAdvantageRuleSet {
  return factionAdvantageRuleSetStorage.getStore() ?? getDefaultFactionAdvantageRuleSet();
}

export function areFactionAdvantagesEnabled(): boolean {
  return normalizeFactionAdvantageRuleSet(getFactionAdvantageRuleSet()) !== 'none';
}

export function runWithFactionAdvantageRuleSet<T>(
  ruleSet: FactionAdvantageRuleSet,
  callback: () => T,
): T {
  return factionAdvantageRuleSetStorage.run(normalizeFactionAdvantageRuleSet(ruleSet), callback);
}

export function getCurrentFactionAdvantageConfig(factionCode: FactionAdvantageCode): ReturnType<typeof getFactionAdvantageConfig> | null {
  return getFactionAdvantageConfig(factionCode, normalizeFactionAdvantageRuleSet(getFactionAdvantageRuleSet())) ?? null;
}

export function getFactionFarmMatureYieldMultiplier(factionCode: FactionAdvantageCode): number {
  return 1 + ((getCurrentFactionAdvantageConfig(factionCode)?.modifiers.farmMatureYieldBonusPercent ?? 0) / 100);
}

export function getFactionFarmCollectWindowSeconds(
  baseCollectWindowSeconds: number,
  techBonusSeconds: number,
  factionCode: FactionAdvantageCode,
): number {
  const safeBaseSeconds = Math.max(Math.floor(baseCollectWindowSeconds), 0);
  const safeTechBonusSeconds = Math.max(Math.floor(techBonusSeconds), 0);
  const bonusPercent = getCurrentFactionAdvantageConfig(factionCode)?.modifiers.farmCollectWindowBonusPercent ?? 0;
  const factionBonusSeconds = Math.round(safeBaseSeconds * bonusPercent / 100);

  return Math.max(safeBaseSeconds + safeTechBonusSeconds + factionBonusSeconds, 1);
}

export function getFactionFarmMatureSeconds(baseSeconds: number, factionCode: FactionAdvantageCode): number {
  const safeBaseSeconds = Math.max(Math.floor(baseSeconds), 1);
  const reductionPercent = getCurrentFactionAdvantageConfig(factionCode)?.modifiers.farmMatureSecondsReductionPercent ?? 0;
  return Math.max(Math.ceil(safeBaseSeconds * (1 - reductionPercent / 100)), 1);
}

export function applyFactionFarmHarvestSpiritRootBonus(quantity: number, factionCode: FactionAdvantageCode): number {
  const safeQuantity = Math.max(Math.floor(quantity), 0);
  const bonusPercent = getCurrentFactionAdvantageConfig(factionCode)?.modifiers.farmHarvestSpiritRootBonusPercent ?? 0;
  return Math.floor(safeQuantity * (1 + bonusPercent / 100));
}

export function applyFactionSpiritPassiveExpBonus(baseExpPerMinute: number, factionCode: FactionAdvantageCode): number {
  const safeBaseExpPerMinute = Math.max(Math.floor(baseExpPerMinute), 0);
  const bonusPercent = getCurrentFactionAdvantageConfig(factionCode)?.modifiers.spiritPassiveExpBonusPercent ?? 0;
  return Math.floor(safeBaseExpPerMinute * (1 + bonusPercent / 100));
}

export function getFactionSpiritFeedDurationSeconds(baseSeconds: number, factionCode: FactionAdvantageCode): number {
  const safeBaseSeconds = Math.max(Math.floor(baseSeconds), 0);
  const bonusPercent = getCurrentFactionAdvantageConfig(factionCode)?.modifiers.spiritFeedDurationBonusPercent ?? 0;
  return Math.round(safeBaseSeconds * (1 + bonusPercent / 100));
}

export function applyFactionSpiritTraitRollGoldCost(baseGoldCost: number, factionCode: FactionAdvantageCode): number {
  const safeBaseGoldCost = Math.max(Math.floor(baseGoldCost), 0);
  const reductionPercent = getCurrentFactionAdvantageConfig(factionCode)?.modifiers.spiritTraitRollGoldCostReductionPercent ?? 0;
  return Math.ceil(safeBaseGoldCost * (1 - reductionPercent / 100));
}

export function applyFactionSpiritBreakthroughSoulCost(baseSoulCost: number, factionCode: FactionAdvantageCode): number {
  const safeBaseSoulCost = Math.max(Math.floor(baseSoulCost), 0);
  const reductionPercent = getCurrentFactionAdvantageConfig(factionCode)?.modifiers.spiritBreakthroughSoulCostReductionPercent ?? 0;
  return Math.ceil(safeBaseSoulCost * (1 - reductionPercent / 100));
}

export function getFactionBattleAttackMultiplier(
  factionCode: FactionAdvantageCode,
  context: { isRaidAttack?: boolean } = {},
): number {
  const config = getCurrentFactionAdvantageConfig(factionCode);
  const bonusPercent = config?.modifiers.battleAttackBonusPercent ?? 0;
  const appliesToRaidAttackOnly = config?.modifiers.battleAttackBonusAppliesToRaidAttackOnly ?? false;
  if (appliesToRaidAttackOnly && !context.isRaidAttack) {
    return 1;
  }

  return 1 + (bonusPercent / 100);
}

export function applyFactionRaidDefenseLootLossReduction(lootGold: number, defenderFactionCode: FactionAdvantageCode): number {
  const safeLootGold = Math.max(Math.floor(lootGold), 0);
  const reductionPercent = getCurrentFactionAdvantageConfig(defenderFactionCode)?.modifiers.battleDefenseLootLossReductionPercent ?? 0;
  return Math.floor(safeLootGold * (1 - reductionPercent / 100));
}

export function getFactionBattleDefenseMainSpiritMaxHpMultiplier(defenderFactionCode: FactionAdvantageCode): number {
  const bonusPercent = getCurrentFactionAdvantageConfig(defenderFactionCode)?.modifiers.battleDefenseMainSpiritMaxHpBonusPercent ?? 0;
  return 1 + (bonusPercent / 100);
}

export function applyFactionBattlePostRecovery(
  currentHp: number,
  maxHp: number,
  factionCode: FactionAdvantageCode,
): number {
  const safeMaxHp = Math.max(Math.floor(maxHp), 1);
  const clampedCurrentHp = Math.min(Math.max(Math.floor(currentHp), 0), safeMaxHp);
  const recoveryPercent = getCurrentFactionAdvantageConfig(factionCode)?.modifiers.battlePostRecoveryLostHpPercent ?? 0;

  if (recoveryPercent <= 0) {
    return clampedCurrentHp;
  }

  const lostHp = Math.max(safeMaxHp - clampedCurrentHp, 0);
  return Math.min(clampedCurrentHp + Math.round(lostHp * recoveryPercent / 100), safeMaxHp);
}

export function normalizeFactionAdvantageRuleSet(value: unknown): Exclude<FactionAdvantageRuleSet, 'current'> {
  if (value === 'none') {
    return 'none';
  }

  if (value === 'v0.2') {
    return 'v0.2';
  }

  return 'legacy';
}

function getDefaultFactionAdvantageRuleSet(): Exclude<FactionAdvantageRuleSet, 'current'> {
  return normalizeFactionAdvantageRuleSet(process.env.FACTION_ADVANTAGE_RULE_SET);
}
