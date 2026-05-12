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
    incomeByCastleLevel: {
      1: 120,
      2: 120,
      3: 120,
      4: 190,
      5: 260,
      6: 340,
      7: 340,
      8: 340,
    },
  },
  faction: {
    dividendBasePerHour: 160,
    dividendBonusPerContributionPerHour: 1,
    donateGoldStep: 100,
    contributionPerDonateStep: 1,
  },
  raid: {
    temporaryClaimMinutes: 5,
    freeRaidCountPerDay: 3,
    protectionHoursAfterRaid: 1,
  },
  farm: {
    defaultCultivationCost: 520,
    defaultCultivationYield: 520,
    progressSeconds: {
      seeded: 3600,
      growing: 7200,
    },
  },
  army: {
    recruitGoldCostPerUnit: 100,
    recruitSecondsPerUnit: 60,
    populationCapacityGainPerUpgradeLevel: {
      1: 100,
      2: 100,
    },
  },
  buildings: {
    upgradeCosts: {
      castle: {
        4: 1800,
        5: 2400,
      },
      vault: {
        3: 1150,
        4: 1580,
      },
      'field-slot': {
        1: 980,
      },
      population: {
        1: 880,
        2: 1180,
      },
      watchtower: {
        1: 760,
        2: 980,
      },
    },
    effects: {
      vaultCapacityGainPerUpgradeLevel: {
        3: 1600,
        4: 1600,
      },
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
    castleUpgradeGoldByLevel: {
      1: 200,
      2: 400,
      3: 700,
      4: 1100,
      5: 1700,
      6: 2500,
      7: 3600,
    },
    vaultUpgradeGoldByLevel: {
      1: 150,
      2: 300,
      3: 550,
      4: 900,
      5: 1400,
      6: 2100,
    },
    fieldSlotUpgradeGoldByLevel: {
      1: 300,
      2: 600,
      3: 1100,
      4: 1800,
      5: 2800,
    },
    petUpgradeGoldByLevel: {
      1: 200,
      2: 420,
      3: 760,
      4: 1200,
      5: 1800,
      6: 2600,
    },
  },
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
  const bonus = Math.max(Math.floor(factionContribution), 0) * GAME_BALANCE.faction.dividendBonusPerContributionPerHour;

  return {
    base,
    bonus,
    total: base + bonus,
  };
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