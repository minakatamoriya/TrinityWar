/**
 * Trinity War 首发数值总表。
 *
 * 设计目的：
 * 1. 把会频繁改动的金币产出、金币消耗、时间、灵植资格和阵营俸禄等规则参数集中到一个地方。
 * 2. 让服务端结算优先读取这里，后续做数值回放、压测和赛季调参时只改这一份。
 * 3. 把“已经接入逻辑的正式参数”和“还没接入逻辑的草案曲线”分开，避免改草案时误伤线上结算。
 *
 * 使用约定：
 * 1. 这里放规则参数，不放玩家存档、演示状态和一次性假数据。
 * 2. 所有金额单位默认都是金币，所有时间单位默认都是秒，除非字段名明确写了 minutes 或 hours。
 * 3. 如果一个参数已经进入服务端结算，请优先改这里，再观察模拟和埋点，不要回到业务文件里改硬编码。
 */
const COMMON_NON_STARTER_SPIRIT_IDS = ['xuanhu', 'hegui', 'shuanghu', 'yingbao', 'yundiao', 'shanxiong'];

function buildLevelValueTable(levelConfigs, valueKey) {
  return levelConfigs.reduce((table, config) => {
    table[config.level] = config[valueKey];
    return table;
  }, {});
}

function buildUpgradeCostTable(levelConfigs) {
  return buildLevelValueTable(levelConfigs, 'upgradeCost');
}

function findLevelConfig(levelConfigs, level) {
  const normalizedLevel = Math.max(Math.floor(level), 1);
  return levelConfigs.find((config) => config.level === normalizedLevel) ?? levelConfigs[levelConfigs.length - 1] ?? null;
}

const CASTLE_LEVEL_CONFIG = [
  { level: 1, upgradeCost: 100, cumulativeCost: 100, taxPerHour: 8, unlocks: ['初始主城，默认开放 4 块田'] },
  { level: 2, upgradeCost: 150, cumulativeCost: 250, taxPerHour: 10, unlocks: ['开放基础建筑升级引导', '开放灵宠上限第 1 档'] },
  { level: 3, upgradeCost: 200, cumulativeCost: 450, taxPerHour: 13, unlocks: ['开放基础灵宠培育引导'] },
  { level: 4, upgradeCost: 250, cumulativeCost: 700, taxPerHour: 18, unlocks: ['开放基础探索指引', '开放灵宠上限第 2 档'] },
  { level: 5, upgradeCost: 300, cumulativeCost: 1000, taxPerHour: 24, unlocks: ['解锁护灵阵', '解锁祈雨术'] },
  { level: 6, upgradeCost: 400, cumulativeCost: 1400, taxPerHour: 30, unlocks: ['开放灵宠上限第 3 档'] },
  { level: 7, upgradeCost: 500, cumulativeCost: 1900, taxPerHour: 36, unlocks: ['开放防守强化 2'] },
  { level: 8, upgradeCost: 650, cumulativeCost: 2550, taxPerHour: 42, unlocks: ['解锁观星术', '解锁同心诀', '开放灵宠上限第 4 档'] },
  { level: 9, upgradeCost: 800, cumulativeCost: 3350, taxPerHour: 48, unlocks: ['为 10 级灵宠上限做预热'] },
  { level: 10, upgradeCost: 1000, cumulativeCost: 4350, taxPerHour: 56, unlocks: ['开放灵宠上限第 5 档'] },
  { level: 11, upgradeCost: 1150, cumulativeCost: 5500, taxPerHour: 64, unlocks: [] },
  { level: 12, upgradeCost: 1300, cumulativeCost: 6800, taxPerHour: 72, unlocks: ['开放中段防守强化', '开放灵宠上限第 6 档'] },
  { level: 13, upgradeCost: 1500, cumulativeCost: 8300, taxPerHour: 80, unlocks: ['开放中段阵营贡献效率加成'] },
  { level: 14, upgradeCost: 1700, cumulativeCost: 10000, taxPerHour: 88, unlocks: ['开放灵宠上限第 7 档'] },
  { level: 15, upgradeCost: 1900, cumulativeCost: 11900, taxPerHour: 98, unlocks: ['进入四田经营成型阶段'] },
  { level: 16, upgradeCost: 2100, cumulativeCost: 14000, taxPerHour: 108, unlocks: ['开放灵宠上限第 8 档'] },
  { level: 17, upgradeCost: 2300, cumulativeCost: 16300, taxPerHour: 118, unlocks: ['开放高段恢复效率'] },
  { level: 18, upgradeCost: 2600, cumulativeCost: 18900, taxPerHour: 128, unlocks: ['开放高段防守强化', '开放灵宠上限第 9 档'] },
  { level: 19, upgradeCost: 2900, cumulativeCost: 21800, taxPerHour: 138, unlocks: ['为 20 级称号成长线做预热'] },
  { level: 20, upgradeCost: 3200, cumulativeCost: 25000, taxPerHour: 150, unlocks: ['开启称号成长线', '开放灵宠上限第 10 档'] },
];

const VAULT_LEVEL_CONFIG = [
  { level: 1, upgradeCost: 200, capacityGain: 800 },
  { level: 2, upgradeCost: 300, capacityGain: 800 },
  { level: 3, upgradeCost: 450, capacityGain: 1600 },
  { level: 4, upgradeCost: 650, capacityGain: 1600 },
  { level: 5, upgradeCost: 900, capacityGain: 1800 },
  { level: 6, upgradeCost: 1200, capacityGain: 1800 },
  { level: 7, upgradeCost: 1550, capacityGain: 2000 },
  { level: 8, upgradeCost: 1950, capacityGain: 2000 },
  { level: 9, upgradeCost: 2400, capacityGain: 2200 },
  { level: 10, upgradeCost: 2600, capacityGain: 2200 },
];

const POPULATION_LEVEL_CONFIG = [
  { level: 1, requiredCastleLevel: 2, upgradeCost: 180, capacityGain: 100 },
  { level: 2, requiredCastleLevel: 4, upgradeCost: 260, capacityGain: 100 },
  { level: 3, requiredCastleLevel: 6, upgradeCost: 360, capacityGain: 100 },
  { level: 4, requiredCastleLevel: 8, upgradeCost: 500, capacityGain: 100 },
  { level: 5, requiredCastleLevel: 10, upgradeCost: 700, capacityGain: 200 },
  { level: 6, requiredCastleLevel: 12, upgradeCost: 950, capacityGain: 200 },
  { level: 7, requiredCastleLevel: 14, upgradeCost: 1250, capacityGain: 300 },
  { level: 8, requiredCastleLevel: 16, upgradeCost: 1600, capacityGain: 400 },
  { level: 9, requiredCastleLevel: 18, upgradeCost: 1950, capacityGain: 600 },
  { level: 10, requiredCastleLevel: 20, upgradeCost: 2200, capacityGain: 800 },
];

const WATCHTOWER_LEVEL_CONFIG = [
  { level: 1, upgradeCost: 180 },
  { level: 2, upgradeCost: 260 },
  { level: 3, upgradeCost: 380 },
  { level: 4, upgradeCost: 540 },
  { level: 5, upgradeCost: 760 },
  { level: 6, upgradeCost: 1020 },
  { level: 7, upgradeCost: 1340 },
  { level: 8, upgradeCost: 1720 },
  { level: 9, upgradeCost: 2060 },
  { level: 10, upgradeCost: 2400 },
];

export const DEFAULT_FIELD_SLOT_COUNT = 4;

// Legacy only. Current farming rules open all field slots by default.
const FIELD_SLOT_UNLOCK_CONFIG = [
  { level: 1, requiredCastleLevel: 1, unlockFieldIndex: 1 },
  { level: 2, requiredCastleLevel: 5, unlockFieldIndex: 2 },
  { level: 3, requiredCastleLevel: 10, unlockFieldIndex: 3 },
  { level: 4, requiredCastleLevel: 15, unlockFieldIndex: 4 },
];

const SEED_LEVEL_CONFIG = {
  qilingya: {
    label: '启灵芽',
    rarity: 'common',
    stageGold: { growing: 20, mature: 50, withered: 50 },
    growthSeconds: 10,
  },
  qinglingmai: {
    label: '青灵麦',
    rarity: 'common',
    stageGold: { growing: 100, mature: 200, withered: 100 },
    growthSeconds: 10800,
  },
  xunyamai: {
    label: '风云稻',
    rarity: 'common',
    stageGold: { growing: 100, mature: 200, withered: 100 },
    growthSeconds: 1800,
  },
  ninglucao: {
    label: '凝露草',
    rarity: 'common',
    stageGold: { growing: 100, mature: 800, withered: 400 },
    growthSeconds: 36000,
  },
  suixinhua: {
    label: '碎心花',
    rarity: 'common',
    stageGold: { growing: 120, mature: 300, withered: 50 },
    growthSeconds: 10800,
  },
  baiyulian: {
    label: '白玉莲',
    rarity: 'common',
    stageGold: { growing: 160, mature: 220, withered: 180 },
    growthSeconds: 16200,
  },
  yingyuezhu: {
    label: '影月竹',
    rarity: 'common',
    stageGold: { growing: 150, mature: 230, withered: 140 },
    growthSeconds: 12600,
  },
  qianjiteng: {
    label: '牵机藤',
    rarity: 'common',
    stageGold: { growing: 170, mature: 360, withered: 120 },
    growthSeconds: 12600,
  },
  huichuncao: {
    label: '回春草',
    rarity: 'rare',
    stageGold: { growing: 320, mature: 480, withered: 380 },
    growthSeconds: 14400,
  },
  xueyuehua: {
    label: '雪月花',
    rarity: 'rare',
    stageGold: { growing: 300, mature: 760, withered: 180 },
    growthSeconds: 12600,
  },
  jingdaosong: {
    label: '劲道松',
    rarity: 'rare',
    stageGold: { growing: 450, mature: 620, withered: 520 },
    growthSeconds: 18000,
  },
  hundunguo: {
    label: '混沌果',
    rarity: 'rare',
    stageGold: { growing: 420, mature: 880, withered: 260 },
    growthSeconds: 19800,
  },
  zhanqingsi: {
    label: '斩情丝',
    rarity: 'legendary',
    stageGold: { growing: 520, mature: 1200, withered: 200 },
    growthSeconds: 14400,
  },
  wangchuanying: {
    label: '忘川影',
    rarity: 'legendary',
    stageGold: { growing: 760, mature: 1200, withered: 960 },
    growthSeconds: 21600,
  },
  zhaoyouming: {
    label: '照幽冥',
    rarity: 'legendary',
    stageGold: { growing: 700, mature: 1600, withered: 680 },
    growthSeconds: 18000,
  },
};

/**
 * @typedef {{ key: string; label: string; target: number }} LandDeedRequirement
 */

/**
 * @type {Array<{
 *   deedKey: string;
 *   targetFieldSlotIndex: number;
 *   title: string;
 *   description: string;
 *   requirements: LandDeedRequirement[];
 *   alternativeRequirements?: LandDeedRequirement[];
 * }>}
 */
export const LAND_DEED_CONFIG = [];

export const SPIRIT_BALANCE_CONFIG = {
  passiveExpRateBps: 1300,
};

export const SPIRIT_ROOT_ECONOMY_CONFIG = {
  feed: {
    accelerateSecondsPerFeed: 2 * 60 * 60,
    rootCostPerFeed: 10,
    expBonusBps: 5000,
  },
  farmHarvest: {
    commonRootRewardMin: 5,
    commonRootRewardMax: 10,
  },
  stipendRootRewards: {
    'contribution-0': 10,
    'contribution-100': 18,
    'contribution-300': 25,
    'contribution-600': 35,
    'contribution-800': 45,
    'contribution-1000': 60,
  },
};


export const FACTION_STIPEND_BALANCE_CONFIG = {
  tiers: [
    { tierKey: 'contribution-0', minContribution: 0 },
    { tierKey: 'contribution-100', minContribution: 100 },
    { tierKey: 'contribution-300', minContribution: 300 },
    { tierKey: 'contribution-600', minContribution: 600 },
    { tierKey: 'contribution-800', minContribution: 800 },
    { tierKey: 'contribution-1000', minContribution: 1000 },
  ],
};


export const FACTION_STIPEND_CONFIG = {
  dateKeyTimezone: 'Asia/Shanghai',
  tiers: [
    {
      tierKey: 'contribution-0',
      minContribution: 0,
      label: '基础俸禄',
      rewards: [
        { kind: 'gold', quantity: 20, label: '金币' },
        { kind: 'spirit-root', quantity: SPIRIT_ROOT_ECONOMY_CONFIG.stipendRootRewards['contribution-0'], label: '灵根' },
        { kind: 'spirit-shard', quantity: 1, label: '随机灵宠碎片', spiritPoolIds: COMMON_NON_STARTER_SPIRIT_IDS },
        { kind: 'ordinary-soul', quantity: 5, label: '普通兽魂' },
      ],
    },
    {
      tierKey: 'contribution-100',
      minContribution: 100,
      label: '小有供奉',
      rewards: [
        { kind: 'gold', quantity: 30, label: '金币' },
        { kind: 'spirit-root', quantity: SPIRIT_ROOT_ECONOMY_CONFIG.stipendRootRewards['contribution-100'], label: '灵根' },
        { kind: 'spirit-shard', quantity: 2, label: '随机灵宠碎片', spiritPoolIds: COMMON_NON_STARTER_SPIRIT_IDS },
        { kind: 'ordinary-soul', quantity: 10, label: '普通兽魂' },
      ],
    },
    {
      tierKey: 'contribution-300',
      minContribution: 300,
      label: '稳定供奉',
      rewards: [
        { kind: 'gold', quantity: 40, label: '金币' },
        { kind: 'spirit-root', quantity: SPIRIT_ROOT_ECONOMY_CONFIG.stipendRootRewards['contribution-300'], label: '灵根' },
        { kind: 'spirit-shard', quantity: 3, label: '随机灵宠碎片', spiritPoolIds: COMMON_NON_STARTER_SPIRIT_IDS },
        { kind: 'spirit-marrow', quantity: 2, label: '灵髓' },
        { kind: 'rare-soul', quantity: 2, label: '稀有兽魂' },
        { kind: 'ordinary-soul', quantity: 8, label: '普通兽魂' },
      ],
    },
    {
      tierKey: 'contribution-600',
      minContribution: 600,
      label: '阵营骨干',
      rewards: [
        { kind: 'gold', quantity: 50, label: '金币' },
        { kind: 'spirit-root', quantity: SPIRIT_ROOT_ECONOMY_CONFIG.stipendRootRewards['contribution-600'], label: '灵根' },
        { kind: 'spirit-shard', quantity: 4, label: '随机灵宠碎片', spiritPoolIds: COMMON_NON_STARTER_SPIRIT_IDS },
        { kind: 'spirit-marrow', quantity: 4, label: '灵髓' },
        { kind: 'rare-soul', quantity: 6, label: '稀有兽魂' },
      ],
    },
    {
      tierKey: FACTION_STIPEND_BALANCE_CONFIG.tiers[4].tierKey,
      minContribution: 800,
      label: '高阶供奉',
      rewards: [
        { kind: 'gold', quantity: 60, label: '金币' },
        { kind: 'spirit-root', quantity: SPIRIT_ROOT_ECONOMY_CONFIG.stipendRootRewards['contribution-800'], label: '灵根' },
        { kind: 'spirit-shard', quantity: 5, label: '随机灵宠碎片', spiritPoolIds: COMMON_NON_STARTER_SPIRIT_IDS },
        { kind: 'spirit-marrow', quantity: 6, label: '灵髓' },
        { kind: 'spirit-jade', quantity: 1, label: '灵玉' },
        { kind: 'rare-soul', quantity: 10, label: '稀有兽魂' },
      ],
    },
    {
      tierKey: FACTION_STIPEND_BALANCE_CONFIG.tiers[5].tierKey,
      minContribution: 1000,
      label: '阵营重臣',
      rewards: [
        { kind: 'gold', quantity: 80, label: '金币' },
        { kind: 'spirit-root', quantity: SPIRIT_ROOT_ECONOMY_CONFIG.stipendRootRewards['contribution-1000'], label: '灵根' },
        { kind: 'spirit-shard', quantity: 6, label: '随机灵宠碎片', spiritPoolIds: COMMON_NON_STARTER_SPIRIT_IDS },
        { kind: 'spirit-marrow', quantity: 8, label: '灵髓' },
        { kind: 'spirit-jade', quantity: 2, label: '灵玉' },
        { kind: 'legendary-soul', quantity: 2, label: '传说兽魂' },
      ],
    },
  ],
};

export const FACTION_ADVANTAGE_LEGACY_CONFIG = {
  human: {
    factionCode: 'human',
    factionName: '人界',
    title: '种田更强',
    summary: '人界优势：成熟收益更高，可收窗口更长，适合稳定经营。',
    details: [
      '可收窗口 +20%',
      '成熟收益 +5%',
      '已解锁植物和灵宠图鉴赛季内保留可见',
    ],
    modifiers: {
      farmMatureYieldBonusPercent: 5,
      farmCollectWindowBonusPercent: 20,
      farmMatureSecondsReductionPercent: 0,
      farmHarvestSpiritRootBonusPercent: 0,
      spiritTraitRollGoldCostReductionPercent: 0,
      spiritBreakthroughSoulCostReductionPercent: 0,
      spiritPassiveExpBonusPercent: 0,
      spiritFeedDurationBonusPercent: 0,
      battleDefenseLootLossReductionPercent: 0,
      battleDefenseMainSpiritMaxHpBonusPercent: 0,
      battleAttackBonusPercent: 0,
      battlePostRecoveryLostHpPercent: 0,
      battleAttackBonusAppliesToRaidAttackOnly: false,
    },
  },
  immortal: {
    factionCode: 'immortal',
    factionName: '仙界',
    title: '灵宠更强',
    summary: '仙界优势：挂机经验更高，投喂后培育更快，适合围绕主宠持续培养。',
    details: [
      '挂机经验 +10%',
      '投喂后培育加速 +25%',
      '灵宠等级赛季重置后可更快重新养成',
    ],
    modifiers: {
      farmMatureYieldBonusPercent: 0,
      farmCollectWindowBonusPercent: 0,
      farmMatureSecondsReductionPercent: 0,
      farmHarvestSpiritRootBonusPercent: 0,
      spiritTraitRollGoldCostReductionPercent: 0,
      spiritBreakthroughSoulCostReductionPercent: 0,
      spiritPassiveExpBonusPercent: 10,
      spiritFeedDurationBonusPercent: 0,
      battleDefenseLootLossReductionPercent: 0,
      battleDefenseMainSpiritMaxHpBonusPercent: 0,
      battleAttackBonusPercent: 0,
      battlePostRecoveryLostHpPercent: 0,
      battleAttackBonusAppliesToRaidAttackOnly: false,
    },
  },
  demon: {
    factionCode: 'demon',
    factionName: '魔界',
    title: '战斗更强',
    summary: '魔界优势：战斗伤害更高，战后恢复更强，适合主动战斗。',
    details: [
      '战斗伤害 +5%',
      '战后恢复已损生命 20%',
      '更适合连续战斗和压制节奏',
    ],
    modifiers: {
      farmMatureYieldBonusPercent: 0,
      farmCollectWindowBonusPercent: 0,
      farmMatureSecondsReductionPercent: 0,
      farmHarvestSpiritRootBonusPercent: 0,
      spiritTraitRollGoldCostReductionPercent: 0,
      spiritBreakthroughSoulCostReductionPercent: 0,
      spiritPassiveExpBonusPercent: 0,
      spiritFeedDurationBonusPercent: 0,
      battleDefenseLootLossReductionPercent: 0,
      battleDefenseMainSpiritMaxHpBonusPercent: 0,
      battleAttackBonusPercent: 5,
      battlePostRecoveryLostHpPercent: 20,
      battleAttackBonusAppliesToRaidAttackOnly: false,
    },
  },
};

export const FACTION_ADVANTAGE_V02_CONFIG = {
  human: {
    factionCode: 'human',
    factionName: '人界',
    title: '稳定经营',
    summary: '收成更高，洗练更省金币，被掠夺时损失更少，适合稳定经营。',
    details: [
      '成熟收获金币 +10%',
      '灵宠洗练金币消耗 -10%',
      '防守战中资源损失 -20%',
    ],
    modifiers: {
      farmMatureYieldBonusPercent: 10,
      farmCollectWindowBonusPercent: 20,
      farmMatureSecondsReductionPercent: 0,
      farmHarvestSpiritRootBonusPercent: 0,
      spiritTraitRollGoldCostReductionPercent: 10,
      spiritBreakthroughSoulCostReductionPercent: 0,
      spiritPassiveExpBonusPercent: 0,
      spiritFeedDurationBonusPercent: 0,
      battleDefenseLootLossReductionPercent: 20,
      battleDefenseMainSpiritMaxHpBonusPercent: 0,
      battleAttackBonusPercent: 0,
      battlePostRecoveryLostHpPercent: 0,
      battleAttackBonusAppliesToRaidAttackOnly: true,
    },
  },
  immortal: {
    factionCode: 'immortal',
    factionName: '仙界',
    title: '高效修行',
    summary: '灵根更多，灵宠成长更快，防守时主战灵宠气血更稳。',
    details: [
      '收菜获得灵根 +10%',
      '挂机经验 +10%',
      '防守战中主战灵宠最大 HP +5%',
    ],
    modifiers: {
      farmMatureYieldBonusPercent: 0,
      farmCollectWindowBonusPercent: 0,
      farmMatureSecondsReductionPercent: 0,
      farmHarvestSpiritRootBonusPercent: 10,
      spiritTraitRollGoldCostReductionPercent: 0,
      spiritBreakthroughSoulCostReductionPercent: 0,
      spiritPassiveExpBonusPercent: 10,
      spiritFeedDurationBonusPercent: 0,
      battleDefenseLootLossReductionPercent: 0,
      battleDefenseMainSpiritMaxHpBonusPercent: 5,
      battleAttackBonusPercent: 0,
      battlePostRecoveryLostHpPercent: 0,
      battleAttackBonusAppliesToRaidAttackOnly: true,
    },
  },
  demon: {
    factionCode: 'demon',
    factionName: '魔界',
    title: '主动进攻',
    summary: '灵田成熟更快，主动进攻更强，灵宠突破更省兽魂。',
    details: [
      '作物成熟时间 -10%',
      '灵宠突破兽魂消耗 -10%',
      '主动 raid 攻击 +6%，无战后回血',
    ],
    modifiers: {
      farmMatureYieldBonusPercent: 0,
      farmCollectWindowBonusPercent: 0,
      farmMatureSecondsReductionPercent: 10,
      farmHarvestSpiritRootBonusPercent: 0,
      spiritTraitRollGoldCostReductionPercent: 0,
      spiritBreakthroughSoulCostReductionPercent: 10,
      spiritPassiveExpBonusPercent: 0,
      spiritFeedDurationBonusPercent: 0,
      battleDefenseLootLossReductionPercent: 0,
      battleDefenseMainSpiritMaxHpBonusPercent: 0,
      battleAttackBonusPercent: 6,
      battlePostRecoveryLostHpPercent: 0,
      battleAttackBonusAppliesToRaidAttackOnly: true,
    },
  },
};

export const FACTION_ADVANTAGE_CONFIG = FACTION_ADVANTAGE_LEGACY_CONFIG;

export const TERRITORY_TECH_TRACKS = {
  protectionTech: {
    id: 'protectionTech',
    title: '护灵阵',
    description: '结阵护住灵田与本命灵宠，延长被挑战成功后的保护时间。',
    effectKey: 'protectionMinutes',
    levels: [
      { level: 1, costResource: 'gold', costAmount: 50, upgradeCost: 50, effectValue: 10 },
      { level: 2, costResource: 'gold', costAmount: 480, upgradeCost: 480, effectValue: 20 },
      { level: 3, costResource: 'gold', costAmount: 680, upgradeCost: 680, effectValue: 30 },
      { level: 4, costResource: 'gold', costAmount: 920, upgradeCost: 920, effectValue: 40 },
      { level: 5, costResource: 'gold', costAmount: 1200, upgradeCost: 1200, effectValue: 50 },
      { level: 6, costResource: 'tianjiTalisman', costAmount: 2, upgradeCost: 2, effectValue: 65 },
      { level: 7, costResource: 'tianjiTalisman', costAmount: 3, upgradeCost: 3, effectValue: 80 },
      { level: 8, costResource: 'tianjiTalisman', costAmount: 4, upgradeCost: 4, effectValue: 95 },
      { level: 9, costResource: 'tianjiTalisman', costAmount: 5, upgradeCost: 5, effectValue: 110 },
      { level: 10, costResource: 'tianjiTalisman', costAmount: 6, upgradeCost: 6, effectValue: 130 },
    ],
  },
  farmYieldTech: {
    id: 'farmYieldTech',
    title: '祈雨术',
    description: '引灵雨滋养田垄，提升作物培育与成熟阶段的金币收益。',
    effectKey: 'yieldBonusPercent',
    levels: [
      { level: 1, costResource: 'gold', costAmount: 400, upgradeCost: 400, effectValue: 2 },
      { level: 2, costResource: 'gold', costAmount: 600, upgradeCost: 600, effectValue: 4 },
      { level: 3, costResource: 'gold', costAmount: 850, upgradeCost: 850, effectValue: 6 },
      { level: 4, costResource: 'gold', costAmount: 1150, upgradeCost: 1150, effectValue: 8 },
      { level: 5, costResource: 'gold', costAmount: 1500, upgradeCost: 1500, effectValue: 10 },
      { level: 6, costResource: 'tianjiTalisman', costAmount: 2, upgradeCost: 2, effectValue: 13 },
      { level: 7, costResource: 'tianjiTalisman', costAmount: 3, upgradeCost: 3, effectValue: 16 },
      { level: 8, costResource: 'tianjiTalisman', costAmount: 4, upgradeCost: 4, effectValue: 19 },
      { level: 9, costResource: 'tianjiTalisman', costAmount: 5, upgradeCost: 5, effectValue: 22 },
      { level: 10, costResource: 'tianjiTalisman', costAmount: 7, upgradeCost: 7, effectValue: 25 },
    ],
  },
  collectWindowTech: {
    id: 'collectWindowTech',
    title: '观星术',
    description: '观天象定农时，延长作物成熟后的可收窗口。',
    effectKey: 'collectWindowMinutes',
    levels: [
      { level: 1, costResource: 'gold', costAmount: 360, upgradeCost: 360, effectValue: 5 },
      { level: 2, costResource: 'gold', costAmount: 540, upgradeCost: 540, effectValue: 10 },
      { level: 3, costResource: 'gold', costAmount: 760, upgradeCost: 760, effectValue: 15 },
      { level: 4, costResource: 'gold', costAmount: 1020, upgradeCost: 1020, effectValue: 20 },
      { level: 5, costResource: 'gold', costAmount: 1320, upgradeCost: 1320, effectValue: 25 },
      { level: 6, costResource: 'tianjiTalisman', costAmount: 2, upgradeCost: 2, effectValue: 30 },
      { level: 7, costResource: 'tianjiTalisman', costAmount: 3, upgradeCost: 3, effectValue: 35 },
      { level: 8, costResource: 'tianjiTalisman', costAmount: 4, upgradeCost: 4, effectValue: 40 },
      { level: 9, costResource: 'tianjiTalisman', costAmount: 5, upgradeCost: 5, effectValue: 45 },
      { level: 10, costResource: 'tianjiTalisman', costAmount: 6, upgradeCost: 6, effectValue: 50 },
    ],
  },
  factionOfferingTech: {
    id: 'factionOfferingTech',
    title: '同心诀',
    description: '凝聚同道心念，提升个人阵营贡献获取效率。',
    effectKey: 'factionContributionBonusPercent',
    levels: [
      { level: 1, costResource: 'gold', costAmount: 360, upgradeCost: 360, effectValue: 3 },
      { level: 2, costResource: 'gold', costAmount: 540, upgradeCost: 540, effectValue: 6 },
      { level: 3, costResource: 'gold', costAmount: 760, upgradeCost: 760, effectValue: 9 },
      { level: 4, costResource: 'gold', costAmount: 1020, upgradeCost: 1020, effectValue: 12 },
      { level: 5, costResource: 'gold', costAmount: 1320, upgradeCost: 1320, effectValue: 15 },
      { level: 6, costResource: 'tianjiTalisman', costAmount: 2, upgradeCost: 2, effectValue: 19 },
      { level: 7, costResource: 'tianjiTalisman', costAmount: 3, upgradeCost: 3, effectValue: 23 },
      { level: 8, costResource: 'tianjiTalisman', costAmount: 4, upgradeCost: 4, effectValue: 27 },
      { level: 9, costResource: 'tianjiTalisman', costAmount: 5, upgradeCost: 5, effectValue: 31 },
      { level: 10, costResource: 'tianjiTalisman', costAmount: 6, upgradeCost: 6, effectValue: 35 },
    ],
  },
};

// Backward-compatible export name for migration tasks. New code should use TERRITORY_TECH_TRACKS.
export const CASTLE_EXTENSION_TRACKS = TERRITORY_TECH_TRACKS;

export const DAILY_TASK_CONFIG = {
  structure: {
    fixedTaskCount: 2,
    randomTaskCount: 1,
    freeRefreshesPerDay: 0,
    milestoneThresholds: [1, 2, 3],
  },
  rewardBudgetByWeek: {
    1: { directGoldMin: 70, directGoldMax: 110, totalEquivalentMin: 90, totalEquivalentMax: 150 },
    2: { directGoldMin: 90, directGoldMax: 130, totalEquivalentMin: 120, totalEquivalentMax: 190 },
    3: { directGoldMin: 110, directGoldMax: 150, totalEquivalentMin: 150, totalEquivalentMax: 220 },
    4: { directGoldMin: 120, directGoldMax: 170, totalEquivalentMin: 160, totalEquivalentMax: 240 },
  },
  milestoneRewards: [
    { completedCount: 2, rewards: [{ type: 'gold', amount: 10 }, { type: 'seed-pack', packId: 'common-choice', amount: 1 }] },
    { completedCount: 4, rewards: [{ type: 'gold', amount: 15 }, { type: 'seed-pack', packId: 'common-choice', amount: 1 }] },
    { completedCount: 5, rewards: [{ type: 'gold', amount: 20 }, { type: 'seed-pack', packId: 'common-random', amount: 1 }] },
  ],
  fixedTasks: [
    {
      id: 'daily-harvest-once',
      title: '收取 1 次成熟田地',
      category: '经营',
      objective: { type: 'collect-field', count: 1 },
      rewards: [{ type: 'gold', amount: 18 }],
    },
    {
      id: 'daily-start-cultivation',
      title: '完成 1 次播种',
      category: '经营',
      objective: { type: 'start-cultivation', count: 1 },
      rewards: [{ type: 'gold', amount: 16 }],
    },
  ],
  randomTasks: [
    {
      id: 'daily-upgrade-building',
      title: '修习 1 次法术',
      category: '经营',
      objective: { type: 'upgrade-territory-tech', count: 1 },
      rewards: [{ type: 'gold', amount: 22 }],
    },
    {
      id: 'daily-feed-spirit',
      title: '投喂 1 次灵宠',
      category: '灵宠',
      objective: { type: 'feed-spirit', count: 1 },
      rewards: [{ type: 'gold', amount: 20 }],
    },
    {
      id: 'daily-recruit-army',
      title: '征召 1 次士兵',
      category: '经营',
      objective: { type: 'recruit-army', count: 1 },
      rewards: [{ type: 'gold', amount: 18 }],
    },
    {
      id: 'daily-upgrade-core-line',
      title: '完成 1 次核心成长投入',
      category: '经营',
      objective: { type: 'upgrade-core-line', count: 1 },
      rewards: [{ type: 'gold', amount: 22 }],
    },
  ],
  catchupTasks: [
    {
      id: 'catchup-first-upgrade',
      title: '修习 1 次法术',
      category: '追赶',
      objective: { type: 'upgrade-territory-tech', count: 1 },
      rewards: [{ type: 'gold', amount: 45 }, { type: 'seed-pack', packId: 'starter-common', amount: 1 }],
    },
    {
      id: 'catchup-first-cultivation',
      title: '完成 2 次播种或收取',
      category: '追赶',
      objective: { type: 'farm-cycle', count: 2 },
      rewards: [{ type: 'gold', amount: 40 }, { type: 'seed-pack', packId: 'common-choice', amount: 1 }],
    },
    {
      id: 'catchup-first-recruit',
      title: '征召 1 次士兵',
      category: '追赶',
      objective: { type: 'recruit-army', count: 1 },
      rewards: [{ type: 'gold', amount: 40 }, { type: 'seed-pack', packId: 'starter-common', amount: 1 }],
    },
  ],
};

export const GAME_DESIGN_CONFIG = {
  castleLevels: CASTLE_LEVEL_CONFIG,
  vaultLevels: VAULT_LEVEL_CONFIG,
  populationLevels: POPULATION_LEVEL_CONFIG,
  watchtowerLevels: WATCHTOWER_LEVEL_CONFIG,
  fieldSlotUnlockLevels: FIELD_SLOT_UNLOCK_CONFIG,
  seedLevels: SEED_LEVEL_CONFIG,
  castleExtensions: CASTLE_EXTENSION_TRACKS,
  territoryTechs: TERRITORY_TECH_TRACKS,
  landDeeds: LAND_DEED_CONFIG,
  factionStipends: FACTION_STIPEND_CONFIG,
  factionAdvantages: FACTION_ADVANTAGE_CONFIG,
  dailyTasks: DAILY_TASK_CONFIG,
};

/**
 * 四周赛季的目标节奏。
 *
 * 这里的 completionRate 不是强制公式，而是给数值反推时用的目标参考：
 * - 第 1 周让玩家快速建立基础盘。
 * - 第 2 周拉开外场、战斗、分红的经营差距。
 * - 第 3 周进入 75%~85% 的主成长完成度，仍然保留继续冲刺的理由。
 * - 第 4 周更偏向收成果、冲榜、打仗和做最后的资金调度。
 */
export const SEASON_WEEK_PLAN = [
  {
    week: 1,
    phase: '开荒',
    completionRate: 0.3,
    focus: '先解锁基础成长位，保证每天都能收、能种、能升。',
  },
  {
    week: 2,
    phase: '均衡发展',
    completionRate: 0.58,
    focus: '开始在法术修习、灵宠培养和阵营贡献之间做取舍。',
  },
  {
    week: 3,
    phase: '高峰成型',
    completionRate: 0.82,
    focus: '达到主体成长的 80% 左右，同时把战斗、防守、榜单与阵营俸禄差距拉开。',
  },
  {
    week: 4,
    phase: '冲刺收官',
    completionRate: 1,
    focus: '以冲榜、冲阵营俸禄、冲阵营结果和冲最后法术为主，不再只靠建筑线提供驱动力。',
  },
];

/**
 * 已经接入服务端结算的正式参数。
 *
 * 这些字段改动后，会直接影响当前 demo 的建造、培育、造兵、阵营贡献和部分兼容逻辑。
 * 税收、小时分红、金库容量和临时待领取已在 2026-05-24 轻量化方案中退场。
 */
export const GAME_BALANCE = {
  tax: {
    incomeByCastleLevel: buildLevelValueTable(
      CASTLE_LEVEL_CONFIG.map((config) => ({ ...config, taxPerHour: 0 })),
      'taxPerHour',
    ),
  },
  faction: {
    dividendBasePerHour: 0,
    contributionStep: 10,
    dividendBonusPerStepPerHour: 0,
    donateGoldStep: 100,
    contributionPerDonateStep: 1,
    stipendTiers: FACTION_STIPEND_CONFIG.tiers,
    advantages: FACTION_ADVANTAGE_CONFIG,
  },
  raid: {
    temporaryClaimMinutes: 0,
    freeRaidCountPerDay: 3,
    protectionHoursAfterRaid: 1,
    spiritShardDropChance: 100,
  },
  farm: {
    defaultCultivationCost: 0,
    defaultCultivationYield: 520,
    defaultGrowthSeconds: 10800,
    seeds: SEED_LEVEL_CONFIG,
  },
  army: {
    recruitGoldCostPerUnit: 100,
    recruitSecondsPerUnit: 60,
    populationCapacityGainPerUpgradeLevel: buildLevelValueTable(POPULATION_LEVEL_CONFIG, 'capacityGain'),
  },
  buildings: {
    upgradeCosts: {
      castle: buildUpgradeCostTable(CASTLE_LEVEL_CONFIG),
      vault: buildUpgradeCostTable(VAULT_LEVEL_CONFIG),
      'field-slot': {},
      population: buildUpgradeCostTable(POPULATION_LEVEL_CONFIG),
      watchtower: buildUpgradeCostTable(WATCHTOWER_LEVEL_CONFIG),
      protectionTech: buildUpgradeCostTable(TERRITORY_TECH_TRACKS.protectionTech.levels),
      farmYieldTech: buildUpgradeCostTable(TERRITORY_TECH_TRACKS.farmYieldTech.levels),
      collectWindowTech: buildUpgradeCostTable(TERRITORY_TECH_TRACKS.collectWindowTech.levels),
      factionOfferingTech: buildUpgradeCostTable(TERRITORY_TECH_TRACKS.factionOfferingTech.levels),
    },
    effects: {
      vaultCapacityGainPerUpgradeLevel: buildLevelValueTable(
        VAULT_LEVEL_CONFIG.map((config) => ({ ...config, capacityGain: 0 })),
        'capacityGain',
      ),
    },
  },
};

/**
 * 尚未接入实时结算的草案曲线。
 *
 * 这些字段是为了后续反推四周目标和做极限模拟时有一个统一的候选方案，
 * 当前不会直接驱动服务端逻辑。
 */
export const GAME_BALANCE_DRAFT = {
  buildingCurves: {
    castleUpgradeGoldByLevel: buildUpgradeCostTable(CASTLE_LEVEL_CONFIG),
    vaultUpgradeGoldByLevel: buildUpgradeCostTable(VAULT_LEVEL_CONFIG),
    fieldSlotUpgradeGoldByLevel: {},
    petUpgradeGoldByLevel: buildUpgradeCostTable(POPULATION_LEVEL_CONFIG),
  },
  castleExtensions: CASTLE_EXTENSION_TRACKS,
  territoryTechs: TERRITORY_TECH_TRACKS,
  landDeeds: LAND_DEED_CONFIG,
  factionStipends: FACTION_STIPEND_CONFIG,
  dailyTasks: DAILY_TASK_CONFIG,
};

/**
 * Legacy compatibility: main city hourly tax is retired and returns 0.
 *
 * 后续 TW-LITE-005/006 会移除业务侧调用。
 */
export function getTaxIncomePerHour(level) {
  const normalizedLevel = Math.max(Math.floor(level), 1);
  const configuredValue = GAME_BALANCE.tax.incomeByCastleLevel[normalizedLevel];

  if (typeof configuredValue === 'number') {
    return configuredValue;
  }

  const configuredLevels = Object.keys(GAME_BALANCE.tax.incomeByCastleLevel)
    .map(Number)
    .sort((left, right) => left - right);
  const fallbackLevel = configuredLevels[configuredLevels.length - 1] ?? 1;
  return GAME_BALANCE.tax.incomeByCastleLevel[fallbackLevel] ?? 0;
}

/**
 * Legacy compatibility: hourly faction dividend is retired and returns 0 total.
 *
 * 后续 TW-LITE-008 会接入每日阵营俸禄。
 */
export function getFactionDividendPerHour(factionContribution) {
  const base = GAME_BALANCE.faction.dividendBasePerHour;
  const contributionStep = Math.max(Math.floor(GAME_BALANCE.faction.contributionStep ?? 1), 1);
  const contributionTier = Math.floor(Math.max(Math.floor(factionContribution), 0) / contributionStep);
  const bonus = contributionTier * (GAME_BALANCE.faction.dividendBonusPerStepPerHour ?? 0);

  return {
    base,
    bonus,
    contributionTier,
    contributionStep,
    total: base + bonus,
  };
}

export function getCastleLevelConfig(level) {
  return findLevelConfig(CASTLE_LEVEL_CONFIG, level);
}

export function getPopulationLevelConfig(level) {
  return findLevelConfig(POPULATION_LEVEL_CONFIG, level);
}

export function getCastleExtensionTrack(trackId) {
  return CASTLE_EXTENSION_TRACKS[trackId] ?? null;
}

export function getTerritoryTechTrack(trackId) {
  return TERRITORY_TECH_TRACKS[trackId] ?? null;
}

export function getCastleExtensionLevelConfig(trackId, level) {
  const track = getCastleExtensionTrack(trackId);
  if (!track) {
    return null;
  }

  return findLevelConfig(track.levels, level);
}

export function getTerritoryTechLevelConfig(trackId, level) {
  const track = getTerritoryTechTrack(trackId);
  if (!track) {
    return null;
  }

  return findLevelConfig(track.levels, level);
}

export function getLandDeedConfig(deedKey) {
  return LAND_DEED_CONFIG.find((config) => config.deedKey === deedKey) ?? null;
}

export function getFactionStipendTier(factionContribution) {
  const contribution = Math.max(Math.floor(factionContribution), 0);
  return [...FACTION_STIPEND_CONFIG.tiers]
    .sort((left, right) => right.minContribution - left.minContribution)
    .find((tier) => contribution >= tier.minContribution) ?? FACTION_STIPEND_CONFIG.tiers[0] ?? null;
}

export function getFactionAdvantageConfig(factionCode, ruleSet = 'legacy') {
  if (!factionCode) {
    return null;
  }

  if (ruleSet === 'none') {
    return null;
  }

  if (ruleSet === 'v0.2') {
    return FACTION_ADVANTAGE_V02_CONFIG[factionCode] ?? null;
  }

  return FACTION_ADVANTAGE_LEGACY_CONFIG[factionCode] ?? null;
}

export function getDailyTaskRewardBudget(week) {
  const normalizedWeek = Math.max(Math.floor(week), 1);
  return DAILY_TASK_CONFIG.rewardBudgetByWeek[normalizedWeek] ?? DAILY_TASK_CONFIG.rewardBudgetByWeek[4];
}

export function getDailyTaskDefinition(taskId) {
  const allTasks = [
    ...DAILY_TASK_CONFIG.fixedTasks,
    ...DAILY_TASK_CONFIG.randomTasks,
    ...DAILY_TASK_CONFIG.catchupTasks,
  ];

  return allTasks.find((task) => task.id === taskId) ?? null;
}

export function getActiveDailyTaskIds() {
  return new Set([
    ...DAILY_TASK_CONFIG.fixedTasks,
    ...DAILY_TASK_CONFIG.randomTasks,
    ...DAILY_TASK_CONFIG.catchupTasks,
  ].map((task) => task.id));
}

export function getSeedLevelConfig(seedId) {
  return SEED_LEVEL_CONFIG[seedId] ?? null;
}

export function getSeedStageGold(seedId, fieldStatus) {
  const seedConfig = getSeedLevelConfig(seedId);

  if (!seedConfig) {
    return GAME_BALANCE.farm.defaultCultivationYield;
  }

  if (fieldStatus === 'mature') {
    return seedConfig.stageGold.mature;
  }

  if (fieldStatus === 'withered') {
    return seedConfig.stageGold.withered;
  }

  if (fieldStatus === 'growing') {
    return seedConfig.stageGold.growing;
  }

  return seedConfig.stageGold.growing;
}

export function getSeedGrowthSeconds(seedId) {
  const seedConfig = getSeedLevelConfig(seedId);

  if (!seedConfig) {
    return GAME_BALANCE.farm.defaultGrowthSeconds;
  }

  return seedConfig.growthSeconds;
}

/**
 * 读取建筑升级费用。
 */
export function getBuildingUpgradeCost(buildingId, currentLevel) {
  const costTable = GAME_BALANCE.buildings.upgradeCosts[buildingId];
  if (!costTable) {
    return null;
  }

  const normalizedLevel = Math.max(Math.floor(currentLevel), 0);
  return costTable[normalizedLevel] ?? null;
}

/**
 * 读取单次金库升级增加的容量。
 */
export function getVaultCapacityGain(currentLevel) {
  const normalizedLevel = Math.max(Math.floor(currentLevel), 0);
  return GAME_BALANCE.buildings.effects.vaultCapacityGainPerUpgradeLevel[normalizedLevel] ?? 0;
}

/**
 * 读取单次人口升级增加的上限。
 */
export function getPopulationCapacityGain(currentLevel) {
  const normalizedLevel = Math.max(Math.floor(currentLevel), 0);
  return GAME_BALANCE.army.populationCapacityGainPerUpgradeLevel[normalizedLevel] ?? 0;
}

/**
 * 估算纯被动日收入。
 *
 * 用途：
 * 1. 反推某个阶段一天能稳定拿到多少安全金币。
 * 2. 对比同阶段的升级成本，判断是否会让玩家“天天都能点一点”。
 * 3. 兼容旧模拟入口；2026-05-24 后税收与小时分红均返回 0。
 */
export function estimateDailyPassiveGold({ castleLevel, factionContribution, hours = 24 }) {
  const safeHours = Math.max(hours, 0);
  const taxPerHour = getTaxIncomePerHour(castleLevel);
  const factionDividend = getFactionDividendPerHour(factionContribution);

  return {
    hours: safeHours,
    taxPerHour,
    factionDividendPerHour: factionDividend.total,
    taxGold: taxPerHour * safeHours,
    factionGold: factionDividend.total * safeHours,
    totalGold: (taxPerHour + factionDividend.total) * safeHours,
  };
}

/**
 * 估算单块田一轮净金币。
 *
 * 当前 demo 里，新一轮培育默认是 520 成本、520 产出，净金币为 0；
 * 这恰好能帮你快速识别：如果不补植物差异或成熟加成，农场主循环本身不会形成稳定净产金。
 */
export function estimateFieldCycleNetGold({ cost, yieldGold }) {
  return Math.max(yieldGold, 0) - Math.max(cost, 0);
}
