import { SPIRIT_BATTLE_INNATE_RULES } from './spiritBattleRules.js';
export const APP_NAME = 'TrinityWar';
export const API_PREFIX = '/api';
export const CLIENT_API_PREFIX = `${API_PREFIX}/client`;
export const ADMIN_API_PREFIX = `${API_PREFIX}/admin`;
export const DOCS_ROUTE = '/docs';
export const ARMY_RECRUIT_GOLD_COST_PER_UNIT = 100;
export const ARMY_RECRUIT_SECONDS_PER_UNIT = 60;
export function formatSeasonLabel(seasonNumber) {
    const normalizedSeasonNumber = Number.isFinite(seasonNumber) ? Math.max(Math.floor(seasonNumber), 1) : 1;
    return `第${normalizedSeasonNumber}赛季`;
}
export const CLIENT_SPIRIT_TRAIT_ROLL_RULES = {
    basic: {
        mode: 'basic',
        label: '金币重铸',
        badge: '全随机',
        summary: '只消耗金币，随机覆盖全部已解锁词条。',
        confirmLabel: '金币重铸',
        unlockBreakthroughStage: 1,
        unlockLevel: 10,
        candidateCount: 0,
        cost: { marrow: 0, jade: 0, gold: 1000 },
    },
    normal: {
        mode: 'normal',
        label: '灵髓定向',
        badge: '7 选 1',
        summary: '选择 1 个槽位，从常规候选池中生成 7 个可替换结果。',
        confirmLabel: '灵髓定向',
        unlockBreakthroughStage: 2,
        unlockLevel: 20,
        candidateCount: 7,
        cost: { marrow: 5, jade: 0, gold: 500 },
    },
    advanced: {
        mode: 'advanced',
        label: '灵玉高级',
        badge: '高级 3 选 1',
        summary: '选择 1 个槽位，从高级候选池中生成 3 个结果，可消耗灵玉换一组。',
        confirmLabel: '灵玉高级',
        unlockBreakthroughStage: 3,
        unlockLevel: 30,
        candidateCount: 3,
        cost: { marrow: 0, jade: 1, gold: 1000 },
    },
};
export const CLIENT_SPIRIT_TRAIT_ROLL_PLAN_ORDER = ['basic', 'normal', 'advanced'];
export function getBasicSpiritTraitRollGoldCost(level) {
    if (level < 10) {
        return CLIENT_SPIRIT_TRAIT_ROLL_RULES.basic.cost.gold;
    }
    if (level < 20) {
        return 200;
    }
    if (level < 30) {
        return 400;
    }
    if (level < 40) {
        return 600;
    }
    if (level < 50) {
        return 800;
    }
    return 1000;
}
export const CLIENT_SPIRIT_INNATE_TRAITS = Object.fromEntries(Object.entries(SPIRIT_BATTLE_INNATE_RULES).map(([spiritId, rules]) => [
    spiritId,
    {
        spiritId,
        label: rules[0]?.label ?? spiritId,
        description: [...new Set(rules.map((rule) => rule.description))].join('；'),
        effects: rules.flatMap(toClientSpiritInnateEffects),
    },
]));
function toClientSpiritInnateEffects(rule) {
    const effects = [];
    if (typeof rule.attackPercent === 'number')
        effects.push({ stat: 'attack', valueType: 'percent', value: rule.attackPercent });
    if (typeof rule.damagePercent === 'number')
        effects.push({ stat: 'damage', valueType: 'percent', value: rule.damagePercent });
    if (typeof rule.maxHpPercent === 'number')
        effects.push({ stat: 'maxHp', valueType: 'percent', value: rule.maxHpPercent });
    if (typeof rule.damageTakenPercent === 'number')
        effects.push({ stat: 'damageTaken', valueType: 'percent', value: rule.damageTakenPercent });
    if (typeof rule.critPercent === 'number')
        effects.push({ stat: 'crit', valueType: 'percent', value: rule.critPercent });
    if (typeof rule.lifestealPercent === 'number')
        effects.push({ stat: 'lifesteal', valueType: 'percent', value: rule.lifestealPercent });
    if (typeof rule.bloodLossReductionRatio === 'number')
        effects.push({ stat: 'bloodLoss', valueType: 'percent', value: -Math.round(rule.bloodLossReductionRatio * 100) });
    if (typeof rule.fixedHealRatio === 'number')
        effects.push({ stat: 'maxHp', valueType: 'percent', value: Math.round(rule.fixedHealRatio * 100) });
    return effects;
}
export function getClientSpiritInnateTrait(spiritId) {
    if (!spiritId) {
        return null;
    }
    return CLIENT_SPIRIT_INNATE_TRAITS[spiritId] ?? null;
}
export * from './spiritCollisionBattle.js';
export * from './spiritBattleRules.js';
