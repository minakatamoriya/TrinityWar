export type SpiritBattleTraitCode =
  | 'claw'
  | 'thick_skin'
  | 'crit'
  | 'crit_damage'
  | 'dodge'
  | 'lifesteal'
  | 'last_stand'
  | 'harvest'
  | 'blood_breaker'
  | 'disruption'
  | 'suppress'
  | 'wound'
  | 'blaze'
  | 'sharp_blade'
  | 'iron_bone';

export type LegacySpiritBattleTraitCode = 'counter' | 'tenacity';
export type AnySpiritBattleTraitCode = SpiritBattleTraitCode | LegacySpiritBattleTraitCode;

export interface SpiritBattleTraitDefinition {
  code: SpiritBattleTraitCode;
  label: string;
  value: number;
  description: string;
  effects: SpiritBattleRuleEffect[];
}

export type SpiritBattleRuleEffectStat =
  | 'maxHp'
  | 'attack'
  | 'damage'
  | 'crit'
  | 'critDamage'
  | 'dodge'
  | 'lifesteal'
  | 'targetHealReduction'
  | 'targetAttackReduction'
  | 'targetBloodLossIncrease';

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

export const SPIRIT_BATTLE_TRAIT_DEFINITIONS: SpiritBattleTraitDefinition[] = [
  { code: 'claw', label: '利爪', value: 12, description: '攻击 +12%', effects: [{ stat: 'attack', value: 12, valueType: 'percent' }] },
  { code: 'thick_skin', label: '厚皮', value: 12, description: '最大生命 +12%', effects: [{ stat: 'maxHp', value: 12, valueType: 'percent' }] },
  { code: 'crit', label: '暴击', value: 8, description: '暴击率 +8%', effects: [{ stat: 'crit', value: 8, valueType: 'percent' }] },
  { code: 'crit_damage', label: '暴伤', value: 25, description: '暴击伤害 +25%', effects: [{ stat: 'critDamage', value: 25, valueType: 'percent' }] },
  { code: 'dodge', label: '闪避', value: 6, description: '闪避率 +6%', effects: [{ stat: 'dodge', value: 6, valueType: 'percent' }] },
  { code: 'lifesteal', label: '吸血', value: 12, description: '造成伤害的 12% 回复自身', effects: [{ stat: 'lifesteal', value: 12, valueType: 'percent' }] },
  { code: 'last_stand', label: '背水', value: 25, description: '自身生命低于 50% 时，攻击 +25%', effects: [{ stat: 'attack', value: 25, valueType: 'percent', selfHpBelowRatio: 0.5 }] },
  { code: 'harvest', label: '收割', value: 18, description: '目标生命低于 50% 时，伤害 +18%', effects: [{ stat: 'damage', value: 18, valueType: 'percent', targetHpBelowRatio: 0.5 }] },
  { code: 'blood_breaker', label: '破血', value: 18, description: '目标最大生命高于自己时，伤害 +18%', effects: [{ stat: 'damage', value: 18, valueType: 'percent', targetMaxHpHigher: true }] },
  { code: 'disruption', label: '断续', value: 20, description: '目标吸血和回血效果 -20%', effects: [{ stat: 'targetHealReduction', value: 20, valueType: 'percent' }] },
  { code: 'suppress', label: '压制', value: 8, description: '目标攻击 -8%', effects: [{ stat: 'targetAttackReduction', value: 8, valueType: 'percent' }] },
  { code: 'wound', label: '裂伤', value: 8, description: '目标受到伤害 +8%', effects: [{ stat: 'damage', value: 8, valueType: 'percent' }] },
  { code: 'blaze', label: '炽燃', value: 3, description: '目标受到燃血伤害 +3% 最大生命', effects: [{ stat: 'targetBloodLossIncrease', value: 0.03, valueType: 'ratio' }] },
  { code: 'sharp_blade', label: '利刃', value: 30, description: '攻击 +30%，最大生命 -10%', effects: [{ stat: 'attack', value: 30, valueType: 'percent' }, { stat: 'maxHp', value: -10, valueType: 'percent' }] },
  { code: 'iron_bone', label: '铁骨', value: 30, description: '最大生命 +30%，攻击 -10%', effects: [{ stat: 'maxHp', value: 30, valueType: 'percent' }, { stat: 'attack', value: -10, valueType: 'percent' }] },
];

export const LEGACY_SPIRIT_BATTLE_TRAIT_DEFINITIONS: Array<{
  code: LegacySpiritBattleTraitCode;
  label: string;
  value: number;
  description: string;
}> = [
  { code: 'counter', label: '反击', value: 10, description: '旧版词条，首发新战斗暂不生效' },
  { code: 'tenacity', label: '韧性', value: 10, description: '旧版词条，首发新战斗暂不生效' },
];

export const SPIRIT_BATTLE_TRAIT_BY_CODE: Record<SpiritBattleTraitCode, SpiritBattleTraitDefinition> =
  Object.fromEntries(SPIRIT_BATTLE_TRAIT_DEFINITIONS.map((definition) => [definition.code, definition])) as Record<SpiritBattleTraitCode, SpiritBattleTraitDefinition>;

export const SPIRIT_BATTLE_TRAIT_LABELS: Record<string, string> = Object.fromEntries(
  [...SPIRIT_BATTLE_TRAIT_DEFINITIONS, ...LEGACY_SPIRIT_BATTLE_TRAIT_DEFINITIONS].map((definition) => [definition.code, definition.label]),
);

export const SPIRIT_BATTLE_INNATE_RULES: Record<string, SpiritBattleInnateRule[]> = {
  canglang: [
    { spiritId: 'canglang', label: '先扑', description: '前 3 回合攻击 +18%', attackPercent: 18, maxRound: 3 },
  ],
  xuanhu: [
    { spiritId: 'xuanhu', label: '追猎', description: '目标生命低于 50% 时，伤害 +18%', damagePercent: 18, targetHpBelowRatio: 0.5 },
  ],
  linglu: [
    { spiritId: 'linglu', label: '回春', description: '第 3/6/9 回合后，各回复 7% 最大生命', fixedHealRatio: 0.07, fixedHealRounds: [3, 6, 9] },
  ],
  qingyuan: [
    { spiritId: 'qingyuan', label: '背水', description: '自身生命低于 50% 时，攻击 +18%', attackPercent: 18, selfHpBelowRatio: 0.5 },
  ],
  hegui: [
    { spiritId: 'hegui', label: '厚甲', description: '前 3 回合受到伤害 -15%', damageTakenPercent: -15, maxRound: 3 },
  ],
  shuanghu: [
    { spiritId: 'shuanghu', label: '韧燃', description: '燃血扣血 -3% 最大生命', bloodLossReductionRatio: 0.03 },
  ],
  yingbao: [
    { spiritId: 'yingbao', label: '收割', description: '目标生命低于 40% 时，伤害 +20%', damagePercent: 20, targetHpBelowRatio: 0.4 },
  ],
  yundiao: [
    { spiritId: 'yundiao', label: '暴起', description: '前 3 回合暴击率 +15%', critPercent: 15, maxRound: 3 },
  ],
  shanxiong: [
    { spiritId: 'shanxiong', label: '残守', description: '自身生命低于 50% 时，受到伤害 -15%', damageTakenPercent: -15, selfHpBelowRatio: 0.5 },
  ],
  chenghuang: [
    { spiritId: 'chenghuang', label: '稳步', description: '第 2/5/8 回合后，各回复 6% 最大生命', fixedHealRatio: 0.06, fixedHealRounds: [2, 5, 8] },
    { spiritId: 'chenghuang', label: '稳步', description: '第 6 到 10 回合受到伤害 -6%', damageTakenPercent: -6, minRound: 6, maxRound: 10 },
  ],
  guishou: [
    { spiritId: 'guishou', label: '逆势', description: '自身生命低于对手时，攻击 +16%', attackPercent: 16, selfHpLowerThanTarget: true },
    { spiritId: 'guishou', label: '逆势', description: '自身生命低于对手时，暴击率 +6%', critPercent: 6, selfHpLowerThanTarget: true },
  ],
  xuangui: [
    { spiritId: 'xuangui', label: '玄息', description: '燃血扣血 -4% 最大生命', bloodLossReductionRatio: 0.04 },
    { spiritId: 'xuangui', label: '玄息', description: '燃血模式下受到对撞伤害 -6%', damageTakenPercent: -6, bloodOnly: true },
  ],
  taowu: [
    { spiritId: 'taowu', label: '后凶', description: '第 4 回合起攻击 +16%', attackPercent: 16, minRound: 4 },
    { spiritId: 'taowu', label: '后凶', description: '燃血模式下额外攻击 +10%', attackPercent: 10, bloodOnly: true },
  ],
  dangchang: [
    { spiritId: 'dangchang', label: '厚血', description: '最大生命 +10%', maxHpPercent: 10 },
    { spiritId: 'dangchang', label: '厚血', description: '自身生命高于 70% 时受到伤害 -8%', damageTakenPercent: -8, selfHpAboveRatio: 0.7 },
  ],
  zhuyan: [
    { spiritId: 'zhuyan', label: '破血', description: '目标最大生命高于自己时，伤害 +16%', damagePercent: 16, targetMaxHpHigher: true },
    { spiritId: 'zhuyan', label: '破血', description: '目标生命低于 50% 时，伤害 +8%', damagePercent: 8, targetHpBelowRatio: 0.5 },
  ],
  fenghuang: [
    { spiritId: 'fenghuang', label: '不熄', description: '第 3/6/9 回合后，各回复 7% 最大生命', fixedHealRatio: 0.07, fixedHealRounds: [3, 6, 9] },
    { spiritId: 'fenghuang', label: '不熄', description: '燃血扣血 -3%', bloodLossReductionRatio: 0.03 },
    { spiritId: 'fenghuang', label: '不熄', description: '自身低于 50% 生命时吸血 +8%', lifestealPercent: 8, selfHpBelowRatio: 0.5 },
  ],
  xueyan: [
    { spiritId: 'xueyan', label: '血猎', description: '前 3 回合攻击 +15%', attackPercent: 15, maxRound: 3 },
    { spiritId: 'xueyan', label: '血猎', description: '目标生命低于 50% 时伤害 +12%', damagePercent: 12, targetHpBelowRatio: 0.5 },
    { spiritId: 'xueyan', label: '血猎', description: '燃血模式下攻击 +10%', attackPercent: 10, bloodOnly: true },
  ],
  yinglong: [
    { spiritId: 'yinglong', label: '镇场', description: '最大生命 +12%', maxHpPercent: 12 },
    { spiritId: 'yinglong', label: '镇场', description: '自身生命高于 70% 时受到伤害 -10%', damageTakenPercent: -10, selfHpAboveRatio: 0.7 },
    { spiritId: 'yinglong', label: '镇场', description: '自身生命低于 40% 时攻击 +15%', attackPercent: 15, selfHpBelowRatio: 0.4 },
  ],
};

export function getSpiritBattleInnateRules(spiritId: string | null | undefined): SpiritBattleInnateRule[] {
  return spiritId ? SPIRIT_BATTLE_INNATE_RULES[spiritId] ?? [] : [];
}

export function getSpiritBattleTraitLabel(code: string): string {
  return SPIRIT_BATTLE_TRAIT_LABELS[code] ?? code;
}
