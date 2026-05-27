import { getFactionAdvantageConfig } from './game-balance.js';

export type FactionAdvantageCode = 'human' | 'immortal' | 'demon' | null;

export function getFactionFarmMatureYieldMultiplier(factionCode: FactionAdvantageCode): number {
  return 1 + ((getFactionAdvantageConfig(factionCode)?.modifiers.farmMatureYieldBonusPercent ?? 0) / 100);
}

export function getFactionFarmRipeWindowSeconds(
  baseRipeWindowSeconds: number,
  techBonusSeconds: number,
  factionCode: FactionAdvantageCode,
): number {
  const safeBaseSeconds = Math.max(Math.floor(baseRipeWindowSeconds), 0);
  const safeTechBonusSeconds = Math.max(Math.floor(techBonusSeconds), 0);
  const bonusPercent = getFactionAdvantageConfig(factionCode)?.modifiers.farmRipeWindowBonusPercent ?? 0;
  const factionBonusSeconds = Math.round(safeBaseSeconds * bonusPercent / 100);

  return Math.max(safeBaseSeconds + safeTechBonusSeconds + factionBonusSeconds, 1);
}

export function applyFactionSpiritPassiveExpBonus(baseExpPerMinute: number, factionCode: FactionAdvantageCode): number {
  const safeBaseExpPerMinute = Math.max(Math.floor(baseExpPerMinute), 0);
  const bonusPercent = getFactionAdvantageConfig(factionCode)?.modifiers.spiritPassiveExpBonusPercent ?? 0;
  return Math.floor(safeBaseExpPerMinute * (1 + bonusPercent / 100));
}

export function getFactionSpiritFeedDurationSeconds(baseSeconds: number, factionCode: FactionAdvantageCode): number {
  const safeBaseSeconds = Math.max(Math.floor(baseSeconds), 0);
  const bonusPercent = getFactionAdvantageConfig(factionCode)?.modifiers.spiritFeedDurationBonusPercent ?? 0;
  return Math.round(safeBaseSeconds * (1 + bonusPercent / 100));
}

export function getFactionBattleAttackMultiplier(factionCode: FactionAdvantageCode): number {
  return 1 + ((getFactionAdvantageConfig(factionCode)?.modifiers.battleAttackBonusPercent ?? 0) / 100);
}

export function applyFactionBattlePostRecovery(
  currentHp: number,
  maxHp: number,
  factionCode: FactionAdvantageCode,
): number {
  const safeMaxHp = Math.max(Math.floor(maxHp), 1);
  const clampedCurrentHp = Math.min(Math.max(Math.floor(currentHp), 0), safeMaxHp);
  const recoveryPercent = getFactionAdvantageConfig(factionCode)?.modifiers.battlePostRecoveryLostHpPercent ?? 0;

  if (recoveryPercent <= 0) {
    return clampedCurrentHp;
  }

  const lostHp = Math.max(safeMaxHp - clampedCurrentHp, 0);
  return Math.min(clampedCurrentHp + Math.round(lostHp * recoveryPercent / 100), safeMaxHp);
}
