import type {
  AdminDesignDocCard,
  AdminDesignDocFact,
  AdminDesignDocMetric,
  AdminDesignDocResponse,
  AdminDesignDocSection,
  AdminDesignDocTable,
} from '@trinitywar/shared';
import {
  GAME_BALANCE,
  GAME_DESIGN_CONFIG,
  SEASON_WEEK_PLAN,
  SPIRIT_ROOT_ECONOMY_CONFIG,
  getFactionAdvantageConfig,
  getSeedGrowthSeconds,
  getSeedStageGold,
} from '../lib/game-balance.js';
import { getFactionAdvantageRuleSet } from '../lib/faction-advantage-formulas.js';
import type { AdminTaskConfigRecord } from '../task-config/task-config.service.js';

interface SeedDefinitionDocInput {
  seedId: string;
  label: string;
  rarity: string;
  sortOrder: number;
  growSeconds: number;
  matureSeconds: number;
  collectWindowSeconds: number;
  baseYieldGold: number;
  strategyNote: string | null;
  lore: string | null;
}

interface SpiritDefinitionDocInput {
  spiritId: string;
  label: string;
  rarity: string;
  factionAffinity: string;
  role: string;
  shardName: string;
  shardUnlockRequired: number;
  baseAttack: number;
  baseHp: number;
  growthAttack: number;
  growthHp: number;
  sortOrder: number;
  lore: string | null;
}

interface FactionDocInput {
  code: string;
  name: string;
}

interface BuildAdminDesignDocInput {
  seedDefinitions: SeedDefinitionDocInput[];
  spiritDefinitions: SpiritDefinitionDocInput[];
  taskConfigs: AdminTaskConfigRecord[];
  factions: FactionDocInput[];
  generatedAt?: Date;
}

type FactionAdvantageConfig = {
  factionCode: string;
  factionName: string;
  title: string;
  summary: string;
  details: string[];
  modifiers: {
    farmMatureYieldBonusPercent: number;
    farmCollectWindowBonusPercent: number;
    farmMatureSecondsReductionPercent: number;
    farmHarvestSpiritRootBonusPercent: number;
    spiritTraitRollGoldCostReductionPercent: number;
    spiritBreakthroughSoulCostReductionPercent: number;
    spiritPassiveExpBonusPercent: number;
    spiritFeedDurationBonusPercent: number;
    battleDefenseLootLossReductionPercent: number;
    battleDefenseMainSpiritMaxHpBonusPercent: number;
    battleAttackBonusPercent: number;
    battlePostRecoveryLostHpPercent: number;
    battleAttackBonusAppliesToRaidAttackOnly: boolean;
  };
};

type FactionStipendTier = {
  tierKey: string;
  minContribution: number;
  label: string;
  rewards: Array<{
    kind: string;
    quantity: number;
    label: string;
    spiritPoolIds?: string[];
  }>;
};

type SeasonWeekPlan = {
  week: number;
  phase: string;
  completionRate: number;
  focus: string;
};

const SECTION_ORDER = [
  'core-rules',
  'factions',
  'stipends',
  'seeds',
  'spirits',
  'tasks',
] as const;

export function buildAdminDesignDocResponse(input: BuildAdminDesignDocInput): AdminDesignDocResponse {
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();
  const sections = buildSections(input);

  return {
    generatedAt,
    overview: {
      title: 'TrinityWar 数值与设定简表',
      summary: '基于当前数据库定义、任务 override 与正式平衡配置聚合生成，适合在后台快速查关键规则、派生口径和横向对比。',
      metrics: [
        metric('文档分组', sections.length),
        metric('灵植定义', input.seedDefinitions.length),
        metric('灵宠定义', input.spiritDefinitions.length),
        metric('任务规则', filterCurrentTaskConfigs(input.taskConfigs).length),
        metric('阵营规则集', formatRuleSet(getFactionAdvantageRuleSet())),
        metric('俸禄档位', getFactionStipendTiers().length),
      ],
    },
    sections,
  };
}

function buildSections(input: BuildAdminDesignDocInput): AdminDesignDocSection[] {
  const sections = [
    buildCoreRulesSection(),
    buildFactionsSection(input.factions),
    buildStipendsSection(),
    buildSeedsSection(input.seedDefinitions),
    buildSpiritsSection(input.spiritDefinitions),
    buildTasksSection(input.taskConfigs),
  ];

  return SECTION_ORDER.map((key) => sections.find((section) => section.key === key)).filter(isDefined);
}

function buildCoreRulesSection(): AdminDesignDocSection {
  const seasonPlan = SEASON_WEEK_PLAN as SeasonWeekPlan[];
  const raidConfig = GAME_BALANCE.raid as {
    freeRaidCountPerDay: number;
    protectionHoursAfterRaid: number;
    temporaryClaimMinutes: number;
    spiritShardDropChance: number;
  };

  const cards: AdminDesignDocCard[] = [
    card({
      id: 'core:raid',
      title: '掠夺节奏',
      subtitle: 'raid / 实时规则',
      category: '核心规则',
      source: '正式平衡配置',
      summary: '适合快速判断主动进攻窗口：每日免费次数、被掠后保护和临时待领取是否仍然生效。',
      tags: ['掠夺', 'PVP', '实时规则'],
      metrics: [
        metric('每日免费掠夺', raidConfig.freeRaidCountPerDay),
        metric('被掠保护', `${raidConfig.protectionHoursAfterRaid} 小时`),
        metric('临时待领取', raidConfig.temporaryClaimMinutes <= 0 ? '已退役' : `${raidConfig.temporaryClaimMinutes} 分钟`, raidConfig.temporaryClaimMinutes <= 0 ? 'warn' : 'neutral'),
        metric('灵宠精魄掉落率', `${raidConfig.spiritShardDropChance}%`),
      ],
      facts: [
        fact('freeRaidCountPerDay', 'freeRaidCountPerDay', raidConfig.freeRaidCountPerDay),
        fact('protectionHoursAfterRaid', 'protectionHoursAfterRaid', raidConfig.protectionHoursAfterRaid),
        fact('temporaryClaimMinutes', 'temporaryClaimMinutes', raidConfig.temporaryClaimMinutes),
        fact('spiritShardDropChance', 'spiritShardDropChance', raidConfig.spiritShardDropChance),
      ],
      notes: [
        '当前临时待领取金已退役，文档里保留该字段只是为了排查旧逻辑。',
      ],
    }),
    card({
      id: 'core:spirit-root',
      title: '灵根经济',
      subtitle: 'spirit-root / 正式规则',
      category: '核心规则',
      source: 'game-balance 正式配置',
      summary: '灵根主要来自收菜、投喂和阵营俸禄，是灵宠长期成长的关键资源。',
      tags: ['灵根', '灵宠', '经营'],
      metrics: [
        metric('投喂耗灵根', SPIRIT_ROOT_ECONOMY_CONFIG.feed.rootCostPerFeed),
        metric('投喂加速', formatDuration(SPIRIT_ROOT_ECONOMY_CONFIG.feed.accelerateSecondsPerFeed)),
        metric('投喂经验加成', formatPercentFromBps(SPIRIT_ROOT_ECONOMY_CONFIG.feed.expBonusBps)),
        metric('收菜灵根', `${SPIRIT_ROOT_ECONOMY_CONFIG.farmHarvest.commonRootRewardMin}-${SPIRIT_ROOT_ECONOMY_CONFIG.farmHarvest.commonRootRewardMax}`),
      ],
      facts: [
        fact('rootCostPerFeed', 'rootCostPerFeed', SPIRIT_ROOT_ECONOMY_CONFIG.feed.rootCostPerFeed),
        fact('accelerateSecondsPerFeed', 'accelerateSecondsPerFeed', SPIRIT_ROOT_ECONOMY_CONFIG.feed.accelerateSecondsPerFeed),
        fact('expBonusBps', 'expBonusBps', SPIRIT_ROOT_ECONOMY_CONFIG.feed.expBonusBps),
        fact('commonRootRewardMin', 'commonRootRewardMin', SPIRIT_ROOT_ECONOMY_CONFIG.farmHarvest.commonRootRewardMin),
        fact('commonRootRewardMax', 'commonRootRewardMax', SPIRIT_ROOT_ECONOMY_CONFIG.farmHarvest.commonRootRewardMax),
      ],
      notes: [
        `高阶阵营俸禄可把单日灵根提升到 ${SPIRIT_ROOT_ECONOMY_CONFIG.stipendRootRewards['contribution-1000']}。`,
      ],
    }),
    card({
      id: 'core:season-plan',
      title: '四周赛季节奏',
      subtitle: 'season / 设计目标',
      category: '核心规则',
      source: 'game-balance 赛季计划',
      summary: '这是四周赛季的目标完成度参考，用来判断当前成长线是否过快或过慢。',
      tags: ['赛季', '节奏', '设计目标'],
      metrics: [
        metric('周数', seasonPlan.length),
        metric('第 1 周完成度', formatPercent(seasonPlan[0]?.completionRate ?? 0)),
        metric('第 3 周完成度', formatPercent(seasonPlan[2]?.completionRate ?? 0)),
        metric('第 4 周完成度', formatPercent(seasonPlan[seasonPlan.length - 1]?.completionRate ?? 0)),
      ],
      facts: [
        fact('weekCount', 'weekCount', seasonPlan.length),
        fact('week1Phase', 'week1Phase', seasonPlan[0]?.phase ?? '-'),
        fact('week4Phase', 'week4Phase', seasonPlan[seasonPlan.length - 1]?.phase ?? '-'),
      ],
      notes: seasonPlan.map((item) => `第 ${item.week} 周 ${item.phase}：${sanitizeSeasonFocus(item.focus)}`),
    }),
  ];

  const seasonPlanTable: AdminDesignDocTable = {
    key: 'season-plan',
    title: '赛季节奏表',
    description: '按周查看目标完成度与设计关注点。',
    columns: [
      { key: 'week', label: '周次' },
      { key: 'phase', label: '阶段' },
      { key: 'completionRate', label: '目标完成度' },
      { key: 'focus', label: '关注点' },
    ],
    rows: seasonPlan.map((item) => ({
      week: `第 ${item.week} 周`,
      phase: item.phase,
      completionRate: formatPercent(item.completionRate),
      focus: sanitizeSeasonFocus(item.focus),
    })),
  };

  return section({
    key: 'core-rules',
    title: '核心规则',
    description: '用于快速了解当前版本的赛季节奏、掠夺和灵根经济口径。',
    metrics: [
      metric('卡片', cards.length),
      metric('赛季周数', seasonPlan.length),
      metric('免费掠夺 / 日', raidConfig.freeRaidCountPerDay),
      metric('灵根投喂成本', SPIRIT_ROOT_ECONOMY_CONFIG.feed.rootCostPerFeed),
    ],
    cards,
    tables: [seasonPlanTable],
  });
}

function buildFactionsSection(factions: FactionDocInput[]): AdminDesignDocSection {
  const ruleSet = getFactionAdvantageRuleSet();
  const sourceFactions = [...(factions.length > 0 ? factions : [
    { code: 'human', name: '人界' },
    { code: 'immortal', name: '仙界' },
    { code: 'demon', name: '魔界' },
  ])].sort((left, right) => factionSortOrder(left.code) - factionSortOrder(right.code));

  const cards = sourceFactions.map((faction) => {
    const config = getFactionAdvantageConfig(faction.code, ruleSet) as FactionAdvantageConfig | null;
    const modifiers = config?.modifiers;
    return card({
      id: `faction:${faction.code}`,
      title: config?.factionName ?? faction.name,
      subtitle: `${faction.code} / ${formatRuleSet(ruleSet)}`,
      category: '阵营优势',
      source: `当前阵营规则集 (${formatRuleSet(ruleSet)})`,
      summary: config?.summary ?? '当前环境已关闭阵营差异，阵营只保留身份展示。',
      tags: ['阵营', faction.code, formatRuleSet(ruleSet)],
      metrics: [
        metric('成熟收益', formatSignedPercent(modifiers?.farmMatureYieldBonusPercent ?? 0)),
        metric('成熟时间', formatSignedPercent(-(modifiers?.farmMatureSecondsReductionPercent ?? 0))),
        metric('收菜灵根', formatSignedPercent(modifiers?.farmHarvestSpiritRootBonusPercent ?? 0)),
        metric('主动战斗', formatSignedPercent(modifiers?.battleAttackBonusPercent ?? 0)),
      ],
      facts: [
        fact('factionCode', 'factionCode', faction.code),
        fact('title', 'title', config?.title ?? '阵营优势关闭'),
        fact('farmCollectWindowBonusPercent', 'farmCollectWindowBonusPercent', modifiers?.farmCollectWindowBonusPercent ?? 0),
        fact('spiritTraitRollGoldCostReductionPercent', 'spiritTraitRollGoldCostReductionPercent', modifiers?.spiritTraitRollGoldCostReductionPercent ?? 0),
        fact('spiritBreakthroughSoulCostReductionPercent', 'spiritBreakthroughSoulCostReductionPercent', modifiers?.spiritBreakthroughSoulCostReductionPercent ?? 0),
        fact('battleDefenseLootLossReductionPercent', 'battleDefenseLootLossReductionPercent', modifiers?.battleDefenseLootLossReductionPercent ?? 0),
      ],
      notes: config?.details ?? ['当前规则集未启用阵营差异。'],
    });
  });

  const table: AdminDesignDocTable = {
    key: 'faction-modifiers',
    title: '阵营优势对比',
    description: '展示当前规则集下，各阵营关键加成的真实生效值。',
    columns: [
      { key: 'faction', label: '阵营' },
      { key: 'title', label: '定位' },
      { key: 'matureYield', label: '成熟收益' },
      { key: 'collectWindow', label: '可收窗口' },
      { key: 'matureSeconds', label: '成熟时间' },
      { key: 'rootHarvest', label: '收菜灵根' },
      { key: 'traitRollGold', label: '洗练金币' },
      { key: 'breakthroughSoul', label: '突破兽魂' },
      { key: 'passiveExp', label: '挂机经验' },
      { key: 'raidAttack', label: '主动战斗' },
      { key: 'defenseLoss', label: '防守减损' },
    ],
    rows: sourceFactions.map((faction) => {
      const config = getFactionAdvantageConfig(faction.code, ruleSet) as FactionAdvantageConfig | null;
      const modifiers = config?.modifiers;
      return {
        faction: config?.factionName ?? faction.name,
        title: config?.title ?? '已关闭',
        matureYield: formatSignedPercent(modifiers?.farmMatureYieldBonusPercent ?? 0),
        collectWindow: formatSignedPercent(modifiers?.farmCollectWindowBonusPercent ?? 0),
        matureSeconds: formatReductionPercent(modifiers?.farmMatureSecondsReductionPercent ?? 0),
        rootHarvest: formatSignedPercent(modifiers?.farmHarvestSpiritRootBonusPercent ?? 0),
        traitRollGold: formatReductionPercent(modifiers?.spiritTraitRollGoldCostReductionPercent ?? 0),
        breakthroughSoul: formatReductionPercent(modifiers?.spiritBreakthroughSoulCostReductionPercent ?? 0),
        passiveExp: formatSignedPercent(modifiers?.spiritPassiveExpBonusPercent ?? 0),
        raidAttack: formatSignedPercent(modifiers?.battleAttackBonusPercent ?? 0),
        defenseLoss: formatReductionPercent(modifiers?.battleDefenseLootLossReductionPercent ?? 0),
      };
    }),
  };

  return section({
    key: 'factions',
    title: '阵营优势',
    description: '从当前启用的规则集读取阵营差异，方便查“这个版本到底按哪套阵营口径在跑”。',
    metrics: [
      metric('规则集', formatRuleSet(ruleSet), ruleSet === 'none' ? 'warn' : 'ok'),
      metric('阵营数', sourceFactions.length),
      metric('人界成熟收益', table.rows[0]?.['matureYield'] as string ?? '-'),
      metric('魔界主动战斗', table.rows[2]?.['raidAttack'] as string ?? '-'),
    ],
    cards,
    tables: [table],
  });
}

function buildStipendsSection(): AdminDesignDocSection {
  const tiers = getFactionStipendTiers();

  const cards = tiers.map((tier) => {
    const rewards = summarizeRewards(tier.rewards);
    return card({
      id: `stipend:${tier.tierKey}`,
      title: tier.label,
      subtitle: `${tier.tierKey} / contribution >= ${tier.minContribution}`,
      category: '阵营俸禄',
      source: 'game-balance 正式配置',
      summary: `达到 ${tier.minContribution} 贡献即可领取这一档阵营俸禄。`,
      tags: ['俸禄', '阵营', `贡献 ${tier.minContribution}+`],
      metrics: [
        metric('贡献门槛', tier.minContribution),
        metric('金币', rewards.gold),
        metric('灵根', rewards.spiritRoot),
        metric('灵宠精魄', rewards.spiritShard),
      ],
      facts: [
        fact('tierKey', 'tierKey', tier.tierKey),
        fact('minContribution', 'minContribution', tier.minContribution),
        fact('rewardSummary', 'rewardSummary', formatRewardSummary(tier.rewards)),
      ],
      notes: tier.rewards.map((reward) => `${reward.label} x${reward.quantity}${formatRewardPoolSuffix(reward.spiritPoolIds)}`),
    });
  });

  const table: AdminDesignDocTable = {
    key: 'stipend-tiers',
    title: '俸禄档位表',
    description: '按个人贡献查看每日可领取的阵营俸禄。',
    columns: [
      { key: 'tierKey', label: '档位 ID' },
      { key: 'label', label: '名称' },
      { key: 'minContribution', label: '贡献门槛' },
      { key: 'gold', label: '金币' },
      { key: 'spiritRoot', label: '灵根' },
      { key: 'spiritShard', label: '灵宠精魄' },
      { key: 'spiritMarrow', label: '灵髓' },
      { key: 'spiritJade', label: '灵玉' },
      { key: 'ordinarySoul', label: '普通兽魂' },
      { key: 'rareSoul', label: '稀有兽魂' },
      { key: 'legendarySoul', label: '传说兽魂' },
    ],
    rows: tiers.map((tier) => {
      const rewards = summarizeRewards(tier.rewards);
      return {
        tierKey: tier.tierKey,
        label: tier.label,
        minContribution: tier.minContribution,
        gold: rewards.gold,
        spiritRoot: rewards.spiritRoot,
        spiritShard: rewards.spiritShard,
        spiritMarrow: rewards.spiritMarrow,
        spiritJade: rewards.spiritJade,
        ordinarySoul: rewards.ordinarySoul,
        rareSoul: rewards.rareSoul,
        legendarySoul: rewards.legendarySoul,
      };
    }),
  };

  return section({
    key: 'stipends',
    title: '阵营俸禄',
    description: '以真实俸禄配置生成为准，适合快速查某个贡献档位每天给什么。',
    metrics: [
      metric('档位数', tiers.length),
      metric('最高门槛', tiers[tiers.length - 1]?.minContribution ?? 0),
      metric('最高金币', summarizeRewards(tiers[tiers.length - 1]?.rewards ?? []).gold),
      metric('最高灵根', summarizeRewards(tiers[tiers.length - 1]?.rewards ?? []).spiritRoot),
    ],
    cards,
    tables: [table],
  });
}

function buildSeedsSection(seedDefinitions: SeedDefinitionDocInput[]): AdminDesignDocSection {
  const matureSecondsValues = seedDefinitions.map((item) => item.matureSeconds);
  const liveCultivationValues = seedDefinitions.map((item) => getSeedGrowthSeconds(item.seedId));
  const yieldValues = seedDefinitions.map((item) => item.baseYieldGold);

  const cards = seedDefinitions.map((seed) => {
    const liveCultivationSeconds = getSeedGrowthSeconds(seed.seedId);
    const liveMatureYield = getSeedStageGold(seed.seedId, 'mature');
    const definitionYieldPerHour = calculatePerHour(seed.baseYieldGold, seed.matureSeconds);
    const liveYieldPerHour = calculatePerHour(liveMatureYield, liveCultivationSeconds);
    const notes = compact([
      seed.strategyNote ? `策略：${seed.strategyNote}` : null,
      seed.lore ? `背景：${seed.lore}` : null,
      seed.matureSeconds !== liveCultivationSeconds ? `提示：数据库 matureSeconds=${seed.matureSeconds}，当前实时培育口径=${liveCultivationSeconds}。` : null,
      seed.baseYieldGold !== liveMatureYield ? `提示：数据库 baseYieldGold=${seed.baseYieldGold}，当前实时成熟收益口径=${liveMatureYield}。` : null,
    ]);

    return card({
      id: `seed:${seed.seedId}`,
      title: seed.label,
      subtitle: `${seed.seedId} / ${formatRarity(seed.rarity)}`,
      category: '灵植',
      source: '数据库 seed_definition + 实时平衡表',
      summary: seed.strategyNote || seed.lore || '暂无额外设定说明。',
      tags: ['灵植', formatRarity(seed.rarity), classifySeedPace(liveCultivationSeconds), classifyWindow(seed.collectWindowSeconds)],
      metrics: [
        metric('配置成熟', formatDuration(seed.matureSeconds)),
        metric('实时培育', formatDuration(liveCultivationSeconds)),
        metric('可收窗口', formatDuration(seed.collectWindowSeconds)),
        metric('定义产金', seed.baseYieldGold),
        metric('实时成熟收益', liveMatureYield),
      ],
      facts: [
        fact('seedId', 'seedId', seed.seedId),
        fact('sortOrder', 'sortOrder', seed.sortOrder),
        fact('growSeconds', 'growSeconds', seed.growSeconds),
        fact('matureSeconds', 'matureSeconds', seed.matureSeconds),
        fact('collectWindowSeconds', 'collectWindowSeconds', seed.collectWindowSeconds),
        fact('baseYieldGold', 'baseYieldGold', seed.baseYieldGold),
        fact('definitionYieldPerHour', 'definitionYieldPerHour', definitionYieldPerHour),
        fact('liveMatureYieldPerHour', 'liveMatureYieldPerHour', liveYieldPerHour),
      ],
      notes,
    });
  });

  const table: AdminDesignDocTable = {
    key: 'seed-compare',
    title: '灵植对比表',
    description: '同时显示数据库定义和实时结算口径，方便排查“看起来一样，实际不一样”的问题。',
    columns: [
      { key: 'seedId', label: '灵植 ID' },
      { key: 'label', label: '名称' },
      { key: 'rarity', label: '稀有度' },
      { key: 'configMature', label: '配置成熟' },
      { key: 'liveCultivation', label: '实时培育' },
      { key: 'collectWindow', label: '可收窗口' },
      { key: 'definitionYield', label: '定义产金' },
      { key: 'liveMatureYield', label: '实时成熟收益' },
      { key: 'definitionYieldPerHour', label: '定义产金 / 小时' },
      { key: 'liveYieldPerHour', label: '实时收益 / 小时' },
    ],
    rows: seedDefinitions.map((seed) => ({
      seedId: seed.seedId,
      label: seed.label,
      rarity: formatRarity(seed.rarity),
      configMature: formatDuration(seed.matureSeconds),
      liveCultivation: formatDuration(getSeedGrowthSeconds(seed.seedId)),
      collectWindow: formatDuration(seed.collectWindowSeconds),
      definitionYield: seed.baseYieldGold,
      liveMatureYield: getSeedStageGold(seed.seedId, 'mature'),
      definitionYieldPerHour: calculatePerHour(seed.baseYieldGold, seed.matureSeconds),
      liveYieldPerHour: calculatePerHour(getSeedStageGold(seed.seedId, 'mature'), getSeedGrowthSeconds(seed.seedId)),
    })),
  };

  return section({
    key: 'seeds',
    title: '灵植文档',
    description: '适合快速查植物节奏、窗口和实时收益口径，也能第一眼看出定义表与平衡表是否一致。',
    metrics: [
      metric('灵植数', seedDefinitions.length),
      metric('最快成熟', formatDuration(Math.min(...matureSecondsValues))),
      metric('最快实时培育', formatDuration(Math.min(...liveCultivationValues))),
      metric('最高定义产金', Math.max(...yieldValues)),
    ],
    cards,
    tables: [table],
  });
}

function buildSpiritsSection(spiritDefinitions: SpiritDefinitionDocInput[]): AdminDesignDocSection {
  const cards = spiritDefinitions.map((spirit) => {
    const basePowerIndex = calculateSpiritPowerIndex(spirit.baseAttack, spirit.baseHp);
    const growthPowerIndex = calculateSpiritPowerIndex(spirit.growthAttack, spirit.growthHp);
    return card({
      id: `spirit:${spirit.spiritId}`,
      title: spirit.label,
      subtitle: `${spirit.spiritId} / ${formatRarity(spirit.rarity)} / ${formatSpiritRole(spirit.role)}`,
      category: '灵宠',
      source: '数据库 spirit_definition',
      summary: spirit.lore || '暂无额外设定说明。',
      tags: ['灵宠', formatRarity(spirit.rarity), formatFaction(spirit.factionAffinity), formatSpiritRole(spirit.role)],
      metrics: [
        metric('基础攻击', spirit.baseAttack),
        metric('基础生命', spirit.baseHp),
        metric('成长攻击', spirit.growthAttack),
        metric('成长生命', spirit.growthHp),
        metric('合成精魄', spirit.shardUnlockRequired),
      ],
      facts: [
        fact('spiritId', 'spiritId', spirit.spiritId),
        fact('factionAffinity', 'factionAffinity', formatFaction(spirit.factionAffinity)),
        fact('role', 'role', formatSpiritRole(spirit.role)),
        fact('shardName', 'shardName', spirit.shardName),
        fact('shardUnlockRequired', 'shardUnlockRequired', spirit.shardUnlockRequired),
        fact('basePowerIndex', 'basePowerIndex', basePowerIndex),
        fact('growthPowerIndex', 'growthPowerIndex', growthPowerIndex),
        fact('attackPer100Hp', 'attackPer100Hp', roundNumber((spirit.baseAttack * 100) / Math.max(spirit.baseHp, 1))),
      ],
      notes: compact([
        spirit.lore,
        `基础战力指标 = 攻击 + 生命 / 10，当前约为 ${basePowerIndex}。`,
        `成长战力指标 = 成长攻击 + 成长生命 / 10，当前约为 ${growthPowerIndex}。`,
      ]),
    });
  });

  const table: AdminDesignDocTable = {
    key: 'spirit-compare',
    title: '灵宠对比表',
    description: '适合横向比较不同阵营、定位和稀有度的基础数值。',
    columns: [
      { key: 'spiritId', label: '灵宠 ID' },
      { key: 'label', label: '名称' },
      { key: 'rarity', label: '稀有度' },
      { key: 'faction', label: '阵营' },
      { key: 'role', label: '定位' },
      { key: 'shards', label: '合成精魄' },
      { key: 'baseAttack', label: '基础攻击' },
      { key: 'baseHp', label: '基础生命' },
      { key: 'growthAttack', label: '成长攻击' },
      { key: 'growthHp', label: '成长生命' },
      { key: 'basePowerIndex', label: '基础战力指标' },
    ],
    rows: spiritDefinitions.map((spirit) => ({
      spiritId: spirit.spiritId,
      label: spirit.label,
      rarity: formatRarity(spirit.rarity),
      faction: formatFaction(spirit.factionAffinity),
      role: formatSpiritRole(spirit.role),
      shards: spirit.shardUnlockRequired,
      baseAttack: spirit.baseAttack,
      baseHp: spirit.baseHp,
      growthAttack: spirit.growthAttack,
      growthHp: spirit.growthHp,
      basePowerIndex: calculateSpiritPowerIndex(spirit.baseAttack, spirit.baseHp),
    })),
  };

  return section({
    key: 'spirits',
    title: '灵宠文档',
    description: '从真实灵宠定义读取，适合快速查定位、阵营归属和基础成长值。',
    metrics: [
      metric('灵宠数', spiritDefinitions.length),
      metric('最高基础攻击', Math.max(...spiritDefinitions.map((item) => item.baseAttack))),
      metric('最高基础生命', Math.max(...spiritDefinitions.map((item) => item.baseHp))),
      metric('最高合成门槛', Math.max(...spiritDefinitions.map((item) => item.shardUnlockRequired))),
    ],
    cards,
    tables: [table],
  });
}

function buildTasksSection(taskConfigs: AdminTaskConfigRecord[]): AdminDesignDocSection {
  const sortedTasks = filterCurrentTaskConfigs(taskConfigs).sort((left, right) => {
    const leftOrder = groupSortOrder(left.taskGroup);
    const rightOrder = groupSortOrder(right.taskGroup);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.taskId.localeCompare(right.taskId);
  });

  const overrideCount = sortedTasks.filter((task) => task.source === 'override').length;
  const enabledCount = sortedTasks.filter((task) => task.isEnabled).length;

  const cards = sortedTasks.map((task) => {
    const normalizedTitle = normalizeTaskTitle(task.title);
    const normalizedDescription = normalizeTaskDescription(task.description);
    const normalizedObjectiveType = normalizeTaskObjectiveType(task.objectiveType);
    const rewardValue = task.rewardGold ?? task.rewardContribution ?? 0;
    const rewardUnit = task.rewardGold !== null ? '金币' : '贡献';
    const perTarget = task.targetCount && task.targetCount > 0 ? roundNumber(rewardValue / task.targetCount) : rewardValue;
    return card({
      id: `task:${task.taskGroup}:${task.taskId}`,
      title: normalizedTitle,
      subtitle: `${formatTaskGroup(task.taskGroup)} / ${task.taskId}`,
      category: '任务规则',
      source: task.source === 'override' ? '默认任务配置 + task_config_override' : '默认任务配置',
      summary: buildTaskSummary(task, normalizedObjectiveType),
      tags: ['任务', formatTaskGroup(task.taskGroup), task.isEnabled ? '启用' : '关闭', task.source],
      metrics: [
        metric('分组', formatTaskGroup(task.taskGroup)),
        metric('目标次数', task.targetCount ?? '-'),
        metric(`奖励${rewardUnit}`, rewardValue),
        metric(`单次${rewardUnit}`, perTarget),
      ],
      facts: [
        fact('taskId', 'taskId', task.taskId),
        fact('objectiveType', 'objectiveType', normalizedObjectiveType),
        fact('rewardGold', 'rewardGold', task.rewardGold),
        fact('rewardContribution', 'rewardContribution', task.rewardContribution),
        fact('isEnabled', 'isEnabled', task.isEnabled),
        fact('source', 'source', task.source),
      ],
      notes: compact([
        normalizedDescription,
        task.source === 'override' ? '当前任务已被后台 override 覆盖。' : null,
        task.isEnabled ? null : '当前任务处于关闭状态。',
      ]),
    });
  });

  const table: AdminDesignDocTable = {
    key: 'task-configs',
    title: '任务规则表',
    description: '覆盖每日、追赶和阵营贡献任务，直接显示当前启用与 override 情况。',
    columns: [
      { key: 'taskGroup', label: '分组' },
      { key: 'taskId', label: '任务 ID' },
      { key: 'title', label: '名称' },
      { key: 'objectiveType', label: '目标类型' },
      { key: 'targetCount', label: '目标次数' },
      { key: 'rewardGold', label: '金币奖励' },
      { key: 'rewardContribution', label: '贡献奖励' },
      { key: 'isEnabled', label: '启用' },
      { key: 'source', label: '来源' },
    ],
    rows: sortedTasks.map((task) => ({
      taskGroup: formatTaskGroup(task.taskGroup),
      taskId: task.taskId,
      title: normalizeTaskTitle(task.title),
      objectiveType: normalizeTaskObjectiveType(task.objectiveType),
      targetCount: task.targetCount ?? '-',
      rewardGold: task.rewardGold ?? '-',
      rewardContribution: task.rewardContribution ?? '-',
      isEnabled: task.isEnabled ? '是' : '否',
      source: task.source,
    })),
  };

  return section({
    key: 'tasks',
    title: '任务文档',
    description: '从默认任务配置和后台 override 聚合生成，适合快速判断奖励是否过高、某个任务是不是已经被覆盖。',
    metrics: [
      metric('任务数', sortedTasks.length),
      metric('启用中', enabledCount),
      metric('已 override', overrideCount, overrideCount > 0 ? 'warn' : 'neutral'),
      metric('每日结构', `${GAME_DESIGN_CONFIG.dailyTasks.structure.fixedTaskCount}+${GAME_DESIGN_CONFIG.dailyTasks.structure.randomTaskCount}`),
    ],
    cards,
    tables: [table],
  });
}

function filterCurrentTaskConfigs(taskConfigs: AdminTaskConfigRecord[]): AdminTaskConfigRecord[] {
  return taskConfigs.filter((task) => !isLegacyArmyTask(task));
}

function isLegacyArmyTask(task: AdminTaskConfigRecord): boolean {
  return task.taskId.includes('recruit-army')
    || task.objectiveType === 'recruit-army'
    || task.title.includes('征召')
    || task.title.toLowerCase().includes('army');
}

function section(input: AdminDesignDocSection): AdminDesignDocSection {
  return input;
}

function card(input: AdminDesignDocCard): AdminDesignDocCard {
  return input;
}

function metric(label: string, value: string | number, tone: AdminDesignDocMetric['tone'] = 'neutral'): AdminDesignDocMetric {
  return { label, value, tone };
}

function fact(label: string, key: string, value: unknown): AdminDesignDocFact {
  return { label, key, value };
}

function formatRarity(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized === 'common') {
    return '普通';
  }
  if (normalized === 'rare') {
    return '稀有';
  }
  if (normalized === 'legendary') {
    return '传说';
  }
  return value;
}

function formatFaction(value: string): string {
  if (value === 'human') {
    return '人界';
  }
  if (value === 'immortal') {
    return '仙界';
  }
  if (value === 'demon') {
    return '魔界';
  }
  return value;
}

function formatSpiritRole(value: string): string {
  if (value === 'ATTACK') {
    return '输出';
  }
  if (value === 'BALANCED') {
    return '均衡';
  }
  if (value === 'HEALTH') {
    return '生存';
  }
  return value;
}

function formatTaskGroup(value: string): string {
  if (value === 'daily') {
    return '每日任务';
  }
  if (value === 'starter') {
    return '追赶任务';
  }
  if (value === 'contribution') {
    return '阵营贡献';
  }
  if (value === 'daily-faction') {
    return '旧阵营任务';
  }
  return value;
}

function formatRuleSet(value: string): string {
  if (value === 'legacy') {
    return 'legacy';
  }
  if (value === 'v0.2') {
    return 'v0.2';
  }
  if (value === 'none') {
    return '已关闭';
  }
  return value;
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(Math.floor(seconds), 0);
  if (safeSeconds < 60) {
    return `${safeSeconds} 秒`;
  }
  if (safeSeconds < 60 * 60) {
    const minutes = safeSeconds / 60;
    return Number.isInteger(minutes) ? `${minutes} 分钟` : `${roundNumber(minutes)} 分钟`;
  }
  if (safeSeconds < 24 * 60 * 60) {
    const hours = safeSeconds / 3600;
    return Number.isInteger(hours) ? `${hours} 小时` : `${roundNumber(hours)} 小时`;
  }
  const days = safeSeconds / (24 * 3600);
  return Number.isInteger(days) ? `${days} 天` : `${roundNumber(days)} 天`;
}

function formatPercent(value: number): string {
  return `${roundNumber(value * 100)}%`;
}

function formatSignedPercent(value: number): string {
  if (value > 0) {
    return `+${roundNumber(value)}%`;
  }
  if (value < 0) {
    return `${roundNumber(value)}%`;
  }
  return '0%';
}

function formatReductionPercent(value: number): string {
  if (value <= 0) {
    return '0%';
  }
  return `-${roundNumber(value)}%`;
}

function formatPercentFromBps(value: number): string {
  return `${roundNumber(value / 100)}%`;
}

function classifySeedPace(seconds: number): string {
  if (seconds <= 60 * 60) {
    return '快收';
  }
  if (seconds <= 4 * 60 * 60) {
    return '中速';
  }
  return '长线';
}

function classifyWindow(seconds: number): string {
  if (seconds >= 12 * 60 * 60) {
    return '长窗口';
  }
  if (seconds >= 60 * 60) {
    return '中窗口';
  }
  return '短窗口';
}

function calculatePerHour(value: number, seconds: number): number {
  if (seconds <= 0) {
    return 0;
  }
  return roundNumber(value / (seconds / 3600));
}

function calculateSpiritPowerIndex(attack: number, hp: number): number {
  return roundNumber(attack + hp / 10);
}

function buildTaskSummary(task: AdminTaskConfigRecord, normalizedObjectiveType: string): string {
  const rewardParts = [
    task.rewardGold !== null ? `${task.rewardGold} 金币` : null,
    task.rewardContribution !== null ? `${task.rewardContribution} 贡献` : null,
  ].filter(isDefined);
  const targetText = task.targetCount !== null ? `${task.targetCount} 次` : '若干次';
  const objectiveText = normalizedObjectiveType || '未标注目标类型';
  return `目标：${objectiveText}，默认完成 ${targetText}，奖励 ${rewardParts.join(' / ') || '无' }。`;
}

function normalizeTaskTitle(title: string): string {
  if (title.includes('修习 1 次法术')) {
    return '完成 1 次成长升级';
  }
  return sanitizeLegacyPhrase(title);
}

function normalizeTaskDescription(description: string | null): string | null {
  return description ? sanitizeLegacyPhrase(description) : description;
}

function normalizeTaskObjectiveType(value: string | null): string {
  if (!value) {
    return '-';
  }
  if (value === 'upgrade-territory-tech') {
    return '成长升级';
  }
  return value;
}

function sanitizeSeasonFocus(value: string): string {
  return sanitizeLegacyPhrase(value);
}

function sanitizeLegacyPhrase(value: string): string {
  return [
    ['法术修习', '种植经营'],
    ['修习 1 次法术', '完成 1 次成长升级'],
    ['修习法术', '推进种植经营'],
    ['冲最后法术', '冲灵宠成长节点'],
    ['最后法术', '灵宠成长节点'],
    ['不再只靠建筑线提供驱动力。', '由种植、灵宠和阵营目标共同提供驱动力。'],
    ['建筑线', '种植与灵宠成长'],
  ].reduce((current, [search, replacement]) => replaceAllText(current, search, replacement), value);
}

function replaceAllText(value: string, search: string, replacement: string): string {
  return value.split(search).join(replacement);
}

function groupSortOrder(group: string): number {
  if (group === 'starter') {
    return 0;
  }
  if (group === 'daily') {
    return 1;
  }
  if (group === 'contribution') {
    return 2;
  }
  return 3;
}

function factionSortOrder(code: string): number {
  if (code === 'human') {
    return 0;
  }
  if (code === 'immortal') {
    return 1;
  }
  if (code === 'demon') {
    return 2;
  }
  return 3;
}

function summarizeRewards(rewards: FactionStipendTier['rewards']): Record<string, number> {
  const summary = {
    gold: 0,
    spiritRoot: 0,
    spiritShard: 0,
    spiritMarrow: 0,
    spiritJade: 0,
    ordinarySoul: 0,
    rareSoul: 0,
    legendarySoul: 0,
  };

  for (const reward of rewards) {
    if (reward.kind === 'gold') {
      summary.gold += reward.quantity;
    } else if (reward.kind === 'spirit-root') {
      summary.spiritRoot += reward.quantity;
    } else if (reward.kind === 'spirit-shard') {
      summary.spiritShard += reward.quantity;
    } else if (reward.kind === 'spirit-marrow') {
      summary.spiritMarrow += reward.quantity;
    } else if (reward.kind === 'spirit-jade') {
      summary.spiritJade += reward.quantity;
    } else if (reward.kind === 'ordinary-soul') {
      summary.ordinarySoul += reward.quantity;
    } else if (reward.kind === 'rare-soul') {
      summary.rareSoul += reward.quantity;
    } else if (reward.kind === 'legendary-soul') {
      summary.legendarySoul += reward.quantity;
    }
  }

  return summary;
}

function formatRewardSummary(rewards: FactionStipendTier['rewards']): string {
  return rewards.map((reward) => `${reward.label} x${reward.quantity}${formatRewardPoolSuffix(reward.spiritPoolIds)}`).join('、');
}

function formatRewardPoolSuffix(poolIds: string[] | undefined): string {
  return poolIds && poolIds.length > 0 ? ` (${poolIds.join('/')})` : '';
}

function compact(values: Array<string | null | undefined>): string[] {
  return values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function roundNumber(value: number, digits = 1): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Number(value.toFixed(digits));
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function getFactionStipendTiers(): FactionStipendTier[] {
  return (GAME_DESIGN_CONFIG.factionStipends as { tiers: FactionStipendTier[] }).tiers ?? [];
}
