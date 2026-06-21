export type SpiritBattleTraitCode = 'claw' | 'thick_skin' | 'crit' | 'crit_damage' | 'dodge' | 'lifesteal' | 'last_stand' | 'harvest' | 'blood_breaker' | 'disruption' | 'suppress' | 'wound' | 'blaze' | 'sharp_blade' | 'iron_bone';
export type LegacySpiritBattleTraitCode = 'counter' | 'tenacity';
export type AnySpiritBattleTraitCode = SpiritBattleTraitCode | LegacySpiritBattleTraitCode;
export interface SpiritBattleTraitDefinition {
    code: SpiritBattleTraitCode;
    label: string;
    value: number;
    description: string;
    effects: SpiritBattleRuleEffect[];
}
export type SpiritBattleRuleEffectStat = 'maxHp' | 'attack' | 'damage' | 'crit' | 'critDamage' | 'dodge' | 'lifesteal' | 'targetHealReduction' | 'targetAttackReduction' | 'targetBloodLossIncrease';
export interface SpiritBattleRuleCondition {
    activeRounds?: number[];
    minRound?: number;
    maxRound?: number;
    bloodOnly?: boolean;
    selfHpBelowRatio?: number;
    selfHpAboveRatio?: number;
    targetHpBelowRatio?: number;
    targetMaxHpHigher?: boolean;
    selfHpLowerThanTarget?: boolean;
}
export interface SpiritBattleRuleEffect extends SpiritBattleRuleCondition {
    stat: SpiritBattleRuleEffectStat;
    value: number;
    valueType: 'percent' | 'ratio';
}
export interface SpiritBattleInnateRule extends SpiritBattleRuleCondition {
    spiritId: string;
    label: string;
    description: string;
    maxHpPercent?: number;
    attackPercent?: number;
    damagePercent?: number;
    damageTakenPercent?: number;
    critPercent?: number;
    lifestealPercent?: number;
    bloodLossReductionRatio?: number;
    fixedHealRatio?: number;
    fixedHealRounds?: number[];
    activeRounds?: number[];
    minRound?: number;
    maxRound?: number;
    bloodOnly?: boolean;
    selfHpBelowRatio?: number;
    selfHpAboveRatio?: number;
    targetHpBelowRatio?: number;
    targetMaxHpHigher?: boolean;
    selfHpLowerThanTarget?: boolean;
}
export declare const SPIRIT_BATTLE_TRAIT_DEFINITIONS: SpiritBattleTraitDefinition[];
export declare const LEGACY_SPIRIT_BATTLE_TRAIT_DEFINITIONS: Array<{
    code: LegacySpiritBattleTraitCode;
    label: string;
    value: number;
    description: string;
}>;
export declare const SPIRIT_BATTLE_TRAIT_BY_CODE: Record<SpiritBattleTraitCode, SpiritBattleTraitDefinition>;
export declare const SPIRIT_BATTLE_TRAIT_LABELS: Record<string, string>;
export declare const SPIRIT_BATTLE_INNATE_RULES: Record<string, SpiritBattleInnateRule[]>;
export declare function getSpiritBattleInnateRules(spiritId: string | null | undefined): SpiritBattleInnateRule[];
export declare function getSpiritBattleTraitLabel(code: string): string;
