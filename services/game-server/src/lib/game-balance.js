/**
 * Trinity War 首发数值总表。
 *
 * 设计目的：
 * 1. 把会频繁改动的金币产出、金币消耗、容量、时间等规则参数集中到一个地方。
 * 2. 让服务端结算优先读取这里，后续做数值回放、压测和赛季调参时只改这一份。
 * 3. 把“已经接入逻辑的正式参数”和“还没接入逻辑的草案曲线”分开，避免改草案时误伤线上结算。
 *
 * 使用约定：
 * 1. 这里放规则参数，不放玩家存档、演示状态和一次性假数据。
 * 2. 所有金额单位默认都是金币，所有时间单位默认都是秒，除非字段名明确写了 minutes 或 hours。
 * 3. 如果一个参数已经进入服务端结算，请优先改这里，再观察模拟和埋点，不要回到业务文件里改硬编码。
 */

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
  { level: 1, upgradeCost: 100, cumulativeCost: 100, taxPerHour: 8, unlocks: ['初始主城，默认开田 1'] },
  { level: 2, upgradeCost: 150, cumulativeCost: 250, taxPerHour: 10, unlocks: ['开放基础建筑升级引导'] },
  { level: 3, upgradeCost: 200, cumulativeCost: 450, taxPerHour: 13, unlocks: ['开放基础灵宠培育引导'] },
  { level: 4, upgradeCost: 250, cumulativeCost: 700, taxPerHour: 18, unlocks: ['开放基础掠夺指引'] },
  { level: 5, upgradeCost: 300, cumulativeCost: 1000, taxPerHour: 24, unlocks: ['开田 2', '解锁护山结界', '解锁灵脉灌溉'] },
  { level: 6, upgradeCost: 400, cumulativeCost: 1400, taxPerHour: 30, unlocks: ['开放灵宠扩编 2 阶'] },
  { level: 7, upgradeCost: 500, cumulativeCost: 1900, taxPerHour: 36, unlocks: ['开放防守强化 2'] },
  { level: 8, upgradeCost: 650, cumulativeCost: 2550, taxPerHour: 42, unlocks: ['解锁时序观象台', '解锁庶务司'] },
  { level: 9, upgradeCost: 800, cumulativeCost: 3350, taxPerHour: 48, unlocks: ['为 10 级送稀有种做预热'] },
  { level: 10, upgradeCost: 1000, cumulativeCost: 4350, taxPerHour: 56, unlocks: ['开田 3', '赠送稀有种'] },
  { level: 11, upgradeCost: 1150, cumulativeCost: 5500, taxPerHour: 64, unlocks: ['开放灵宠扩编 3 阶'] },
  { level: 12, upgradeCost: 1300, cumulativeCost: 6800, taxPerHour: 72, unlocks: ['开放中段防守强化'] },
  { level: 13, upgradeCost: 1500, cumulativeCost: 8300, taxPerHour: 80, unlocks: ['开放中段阵营上缴效率加成'] },
  { level: 14, upgradeCost: 1700, cumulativeCost: 10000, taxPerHour: 88, unlocks: ['为 15 级开田 4 做预热'] },
  { level: 15, upgradeCost: 1900, cumulativeCost: 11900, taxPerHour: 98, unlocks: ['开田 4', '进入四田成型阶段'] },
  { level: 16, upgradeCost: 2100, cumulativeCost: 14000, taxPerHour: 108, unlocks: ['开放灵宠扩编 4 阶'] },
  { level: 17, upgradeCost: 2300, cumulativeCost: 16300, taxPerHour: 118, unlocks: ['开放高段恢复效率'] },
  { level: 18, upgradeCost: 2600, cumulativeCost: 18900, taxPerHour: 128, unlocks: ['开放高段防守强化'] },
  { level: 19, upgradeCost: 2900, cumulativeCost: 21800, taxPerHour: 138, unlocks: ['为 20 级送传说种做预热'] },
  { level: 20, upgradeCost: 3200, cumulativeCost: 25000, taxPerHour: 150, unlocks: ['赠送传说种', '开启称号成长线'] },
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
  { level: 1, upgradeCost: 180, capacityGain: 100 },
  { level: 2, upgradeCost: 260, capacityGain: 100 },
  { level: 3, upgradeCost: 360, capacityGain: 100 },
  { level: 4, upgradeCost: 500, capacityGain: 100 },
  { level: 5, upgradeCost: 700, capacityGain: 200 },
  { level: 6, upgradeCost: 950, capacityGain: 200 },
  { level: 7, upgradeCost: 1250, capacityGain: 300 },
  { level: 8, upgradeCost: 1600, capacityGain: 400 },
  { level: 9, upgradeCost: 1950, capacityGain: 600 },
  { level: 10, upgradeCost: 2200, capacityGain: 800 },
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

// 田地位不作为独立付费升级线处理，而是随主城里程碑自动赠送开启。
const FIELD_SLOT_UNLOCK_CONFIG = [
  { level: 1, requiredCastleLevel: 1, unlockFieldIndex: 1 },
  { level: 2, requiredCastleLevel: 5, unlockFieldIndex: 2 },
  { level: 3, requiredCastleLevel: 10, unlockFieldIndex: 3 },
  { level: 4, requiredCastleLevel: 15, unlockFieldIndex: 4 },
];

const SEED_LEVEL_CONFIG = {
  qinglingmai: {
    label: '青灵麦',
    rarity: 'common',
    stageGold: { growing: 100, mature: 200, withered: 100 },
    stageSeconds: { seeded: 7200, growing: 3600 },
  },
  ninglucao: {
    label: '凝露草',
    rarity: 'common',
    stageGold: { growing: 100, mature: 140, withered: 40 },
    stageSeconds: { seeded: 5400, growing: 1800 },
  },
  suixinhua: {
    label: '碎心花',
    rarity: 'common',
    stageGold: { growing: 120, mature: 300, withered: 50 },
    stageSeconds: { seeded: 7200, growing: 3600 },
  },
  baiyulian: {
    label: '白玉莲',
    rarity: 'common',
    stageGold: { growing: 160, mature: 220, withered: 180 },
    stageSeconds: { seeded: 10800, growing: 5400 },
  },
  yingyuezhu: {
    label: '影月竹',
    rarity: 'common',
    stageGold: { growing: 150, mature: 230, withered: 140 },
    stageSeconds: { seeded: 9000, growing: 3600 },
  },
  qianjiteng: {
    label: '牵机藤',
    rarity: 'common',
    stageGold: { growing: 170, mature: 360, withered: 120 },
    stageSeconds: { seeded: 9000, growing: 3600 },
  },
  huichuncao: {
    label: '回春草',
    rarity: 'rare',
    stageGold: { growing: 320, mature: 480, withered: 380 },
    stageSeconds: { seeded: 10800, growing: 3600 },
  },
  xueyuehua: {
    label: '雪月花',
    rarity: 'rare',
    stageGold: { growing: 300, mature: 760, withered: 180 },
    stageSeconds: { seeded: 9000, growing: 3600 },
  },
  jingdaosong: {
    label: '劲道松',
    rarity: 'rare',
    stageGold: { growing: 450, mature: 620, withered: 520 },
    stageSeconds: { seeded: 14400, growing: 3600 },
  },
  hundunguo: {
    label: '混沌果',
    rarity: 'rare',
    stageGold: { growing: 420, mature: 880, withered: 260 },
    stageSeconds: { seeded: 14400, growing: 5400 },
  },
  zhanqingsi: {
    label: '斩情丝',
    rarity: 'legendary',
    stageGold: { growing: 520, mature: 1200, withered: 200 },
    stageSeconds: { seeded: 10800, growing: 3600 },
  },
  wangchuanying: {
    label: '忘川影',
    rarity: 'legendary',
    stageGold: { growing: 760, mature: 1200, withered: 960 },
    stageSeconds: { seeded: 18000, growing: 3600 },
  },
  zhaoyouming: {
    label: '照幽冥',
    rarity: 'legendary',
    stageGold: { growing: 700, mature: 1600, withered: 680 },
    stageSeconds: { seeded: 14400, growing: 3600 },
  },
};

export const CASTLE_EXTENSION_TRACKS = {
  protectionTech: {
    id: 'protectionTech',
    title: '护山结界',
    description: '延长被成功掠夺后的保护期，优先降低中后段连续受击疲劳。',
    effectKey: 'protectionMinutes',
    levels: [
      { level: 1, requiredCastleLevel: 5, upgradeCost: 320, effectValue: 10 },
      { level: 2, requiredCastleLevel: 8, upgradeCost: 460, effectValue: 20 },
      { level: 3, requiredCastleLevel: 10, upgradeCost: 620, effectValue: 30 },
      { level: 4, requiredCastleLevel: 12, upgradeCost: 820, effectValue: 40 },
      { level: 5, requiredCastleLevel: 14, upgradeCost: 1040, effectValue: 50 },
      { level: 6, requiredCastleLevel: 15, upgradeCost: 1280, effectValue: 60 },
      { level: 7, requiredCastleLevel: 16, upgradeCost: 1560, effectValue: 75 },
      { level: 8, requiredCastleLevel: 17, upgradeCost: 1880, effectValue: 90 },
      { level: 9, requiredCastleLevel: 18, upgradeCost: 2240, effectValue: 105 },
      { level: 10, requiredCastleLevel: 20, upgradeCost: 2640, effectValue: 120 },
    ],
  },
  farmYieldTech: {
    id: 'farmYieldTech',
    title: '灵脉灌溉',
    description: '提升田地成熟与丰熟产出，只影响田地金币，不抬税收、分红与任务金币。',
    effectKey: 'yieldBonusPercent',
    levels: [
      { level: 1, requiredCastleLevel: 5, upgradeCost: 400, effectValue: 2 },
      { level: 2, requiredCastleLevel: 8, upgradeCost: 560, effectValue: 4 },
      { level: 3, requiredCastleLevel: 10, upgradeCost: 760, effectValue: 6 },
      { level: 4, requiredCastleLevel: 12, upgradeCost: 980, effectValue: 8 },
      { level: 5, requiredCastleLevel: 14, upgradeCost: 1240, effectValue: 10 },
      { level: 6, requiredCastleLevel: 15, upgradeCost: 1540, effectValue: 12 },
      { level: 7, requiredCastleLevel: 16, upgradeCost: 1880, effectValue: 14 },
      { level: 8, requiredCastleLevel: 17, upgradeCost: 2260, effectValue: 16 },
      { level: 9, requiredCastleLevel: 18, upgradeCost: 2680, effectValue: 18 },
      { level: 10, requiredCastleLevel: 20, upgradeCost: 3140, effectValue: 20 },
    ],
  },
  ripeWindowTech: {
    id: 'ripeWindowTech',
    title: '时序观象台',
    description: '延长成熟到丰熟的有效操作窗口，降低错过高价值收取的挫败感。',
    effectKey: 'ripeWindowMinutes',
    levels: [
      { level: 1, requiredCastleLevel: 8, upgradeCost: 360, effectValue: 5 },
      { level: 2, requiredCastleLevel: 10, upgradeCost: 520, effectValue: 10 },
      { level: 3, requiredCastleLevel: 12, upgradeCost: 720, effectValue: 15 },
      { level: 4, requiredCastleLevel: 14, upgradeCost: 960, effectValue: 20 },
      { level: 5, requiredCastleLevel: 15, upgradeCost: 1240, effectValue: 25 },
      { level: 6, requiredCastleLevel: 16, upgradeCost: 1560, effectValue: 30 },
      { level: 7, requiredCastleLevel: 18, upgradeCost: 1940, effectValue: 35 },
      { level: 8, requiredCastleLevel: 20, upgradeCost: 2380, effectValue: 40 },
    ],
  },
  pendingClaimTech: {
    id: 'pendingClaimTech',
    title: '庶务司',
    description: '提高待领取金币的保留时长与调度容错，降低忙碌玩家的静默损失。',
    effectKey: 'pendingRetentionHours',
    levels: [
      { level: 1, requiredCastleLevel: 8, upgradeCost: 300, effectValue: 26 },
      { level: 2, requiredCastleLevel: 10, upgradeCost: 420, effectValue: 28 },
      { level: 3, requiredCastleLevel: 12, upgradeCost: 580, effectValue: 30 },
      { level: 4, requiredCastleLevel: 14, upgradeCost: 780, effectValue: 32 },
      { level: 5, requiredCastleLevel: 16, upgradeCost: 1020, effectValue: 34 },
      { level: 6, requiredCastleLevel: 20, upgradeCost: 1300, effectValue: 36 },
    ],
  },
};

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
    { completedCount: 4, rewards: [{ type: 'gold', amount: 15 }, { type: 'faction-contribution', amount: 2 }] },
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
    {
      id: 'daily-faction-touch',
      title: '领取 1 次分红或完成 1 次上缴',
      category: '阵营',
      objective: { type: 'faction-interaction', count: 1 },
      rewards: [{ type: 'gold', amount: 18 }],
    },
  ],
  randomTasks: [
    {
      id: 'daily-upgrade-building',
      title: '完成 1 次建筑升级',
      category: '经营',
      objective: { type: 'upgrade-building', count: 1 },
      rewards: [{ type: 'gold', amount: 22 }],
    },
    {
      id: 'daily-recruit-army',
      title: '培育 10 只灵宠',
      category: '经营',
      objective: { type: 'recruit-army', count: 10 },
      rewards: [{ type: 'gold', amount: 20 }],
    },
    {
      id: 'daily-donate-gold',
      title: '完成 1 次金币上缴',
      category: '阵营',
      objective: { type: 'faction-donate', count: 1 },
      rewards: [{ type: 'gold', amount: 18 }],
    },
    {
      id: 'daily-upgrade-core-line',
      title: '升级 1 次主城、金库、灵宠上限或防守',
      category: '经营',
      objective: { type: 'upgrade-core-line', count: 1 },
      rewards: [{ type: 'gold', amount: 22 }],
    },
  ],
  catchupTasks: [
    {
      id: 'catchup-first-upgrade',
      title: '完成 1 次主城或金库升级',
      category: '追赶',
      objective: { type: 'upgrade-core-building', count: 1 },
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
      id: 'catchup-first-donate',
      title: '完成 1 次金币上缴',
      category: '追赶',
      objective: { type: 'faction-donate', count: 1 },
      rewards: [{ type: 'gold', amount: 40 }, { type: 'faction-contribution', amount: 5 }],
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
  dailyTasks: DAILY_TASK_CONFIG,
};

/**
 * 四周赛季的目标节奏。
 *
 * 这里的 completionRate 不是强制公式，而是给数值反推时用的目标参考：
 * - 第 1 周让玩家快速建立基础盘。
 * - 第 2 周拉开外场、掠夺、分红的经营差距。
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
    focus: '开始在主城、金库、田地位、人口和阵营贡献之间做取舍。',
  },
  {
    week: 3,
    phase: '高峰成型',
    completionRate: 0.82,
    focus: '达到主体成长的 80% 左右，同时把掠夺、防守、榜单与分红差距拉开。',
  },
  {
    week: 4,
    phase: '冲刺收官',
    completionRate: 1,
    focus: '以冲榜、冲分红、冲阵营结果和冲最后升级为主，不再只靠建筑线提供驱动力。',
  },
];

/**
 * 已经接入服务端结算的正式参数。
 *
 * 这些字段改动后，会直接影响当前 demo 的税收、分红、建造、培育、造兵和金库逻辑。
 */
export const GAME_BALANCE = {
  tax: {
    incomeByCastleLevel: buildLevelValueTable(CASTLE_LEVEL_CONFIG, 'taxPerHour'),
  },
  faction: {
    dividendBasePerHour: 8,
    contributionStep: 10,
    dividendBonusPerStepPerHour: 3,
    donateGoldStep: 100,
    contributionPerDonateStep: 1,
  },
  raid: {
    temporaryClaimMinutes: 5,
    freeRaidCountPerDay: 3,
    protectionHoursAfterRaid: 1,
  },
  farm: {
    defaultCultivationCost: 0,
    defaultCultivationYield: 520,
    progressSeconds: {
      seeded: 3600,
      growing: 7200,
    },
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
    },
    effects: {
      vaultCapacityGainPerUpgradeLevel: buildLevelValueTable(VAULT_LEVEL_CONFIG, 'capacityGain'),
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
  dailyTasks: DAILY_TASK_CONFIG,
};

/**
 * 读取主城固定小时税收。
 *
 * 超出显式配置的等级时，默认沿用当前已配置的最高等级值，避免新等级接入前出现 0 收益断层。
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
 * 读取阵营分红。
 *
 * 当前版本采用“基础分红 + 贡献线性加成”的最轻量模型，方便你之后先调基线，再调上缴价值。
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

export function getCastleExtensionTrack(trackId) {
  return CASTLE_EXTENSION_TRACKS[trackId] ?? null;
}

export function getCastleExtensionLevelConfig(trackId, level) {
  const track = getCastleExtensionTrack(trackId);
  if (!track) {
    return null;
  }

  return findLevelConfig(track.levels, level);
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

export function getSeedStageSeconds(seedId, fieldStatus) {
  const seedConfig = getSeedLevelConfig(seedId);

  if (!seedConfig) {
    return fieldStatus === 'seeded' ? GAME_BALANCE.farm.progressSeconds.seeded : GAME_BALANCE.farm.progressSeconds.growing;
  }

  if (fieldStatus === 'seeded') {
    return seedConfig.stageSeconds.seeded;
  }

  if (fieldStatus === 'growing') {
    return seedConfig.stageSeconds.growing;
  }

  return 1;
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
 * 3. 判断金库容量有没有被动收入压穿的风险。
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
 * 这恰好能帮你快速识别：如果不补种子差异或成熟加成，农场主循环本身不会形成稳定净产金。
 */
export function estimateFieldCycleNetGold({ cost, yieldGold }) {
  return Math.max(yieldGold, 0) - Math.max(cost, 0);
}