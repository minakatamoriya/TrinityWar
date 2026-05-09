import {
  APP_NAME,
  type ClientClaimPendingRequest,
  type ClientClaimPendingResponse,
  type ClientCollectFieldRequest,
  type ClientBuildingUpgradeId,
  type ClientPendingClaimSource,
  type ClientResetDemoStateResponse,
  type ClientSceneAction,
  type ClientSceneContentResponse,
  type ClientResourceLedger,
  type ClientStartCultivationRequest,
  type ClientStateMutationResponse,
  type ClientTransferGoldRequest,
  type ClientUpgradeBuildingRequest,
  type HomeSummaryResponse,
} from '@trinitywar/shared';

interface FieldState {
  id: string;
  code: string;
  unlocked: boolean;
  status: 'empty' | 'growing' | 'ripe';
  plantedGold: number;
  currentYield: number;
  badgeText: string;
}

interface InMemoryPlayerState {
  playerName: string;
  factionName: string;
  buildingLevels: Record<ClientBuildingUpgradeId, number>;
  raidTicketsUsed: number;
  unreadReports: number;
  revengeCount: number;
  ledger: ClientResourceLedger;
  fields: FieldState[];
}

function clonePlayerState(state: InMemoryPlayerState): InMemoryPlayerState {
  return JSON.parse(JSON.stringify(state)) as InMemoryPlayerState;
}

const initialPlayerState: InMemoryPlayerState = {
  playerName: '人界领主·临川',
  factionName: '人界',
  buildingLevels: {
    castle: 4,
    vault: 3,
    'field-slot': 1,
    watchtower: 1,
  },
  raidTicketsUsed: 1,
  unreadReports: 2,
  revengeCount: 1,
  ledger: {
    vaultGold: 4280,
    vaultCapacity: 5000,
    walletGold: 620,
    walletCapacity: 1500,
    taxPendingGold: 380,
    factionDividendGold: 540,
  },
  fields: [
    {
      id: 'field-1',
      code: '外场 01',
      unlocked: true,
      status: 'ripe',
      plantedGold: 600,
      currentYield: 1260,
      badgeText: '高风险高收益',
    },
    {
      id: 'field-2',
      code: '外场 02',
      unlocked: true,
      status: 'growing',
      plantedGold: 420,
      currentYield: 520,
      badgeText: '01:42 后成熟',
    },
    {
      id: 'field-3',
      code: '外场 03',
      unlocked: false,
      status: 'empty',
      plantedGold: 0,
      currentYield: 0,
      badgeText: '升级解锁',
    },
  ],
};

const playerState: InMemoryPlayerState = clonePlayerState(initialPlayerState);

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function buildStaminaStatus(): string {
  return `免费掠夺 ${Math.max(3 - playerState.raidTicketsUsed, 0)}/3`;
}

function getCastleLevel(): number {
  return playerState.buildingLevels.castle;
}

function getFieldCounts(): { mature: number; growing: number; empty: number } {
  return playerState.fields.reduce((counts, field) => {
    if (!field.unlocked || field.status === 'empty') {
      return {
        ...counts,
        empty: field.unlocked && field.status === 'empty' ? counts.empty + 1 : counts.empty,
      };
    }

    if (field.status === 'ripe') {
      return { ...counts, mature: counts.mature + 1 };
    }

    return { ...counts, growing: counts.growing + 1 };
  }, { mature: 0, growing: 0, empty: 0 });
}

function buildFieldStatus(): string {
  const counts = getFieldCounts();
  return `成熟外场 ${counts.mature} 块，成长中 ${counts.growing} 块`;
}

function buildReportStatus(): string {
  return `未读战报 ${playerState.unreadReports}，免费复仇 ${playerState.revengeCount}`;
}

function getTaxIncomePerHour(level: number): number {
  if (level === 4) {
    return 190;
  }

  if (level === 5) {
    return 260;
  }

  return level >= 6 ? 340 : 120;
}

function getFactionDividendPerHour(): { base: number; bonus: number; total: number } {
  const base = 160;
  const bonus = 40;

  return {
    base,
    bonus,
    total: base + bonus,
  };
}

function getPendingClaimAmount(source: ClientPendingClaimSource): number {
  return source === 'tax' ? playerState.ledger.taxPendingGold : playerState.ledger.factionDividendGold;
}

function setPendingClaimAmount(source: ClientPendingClaimSource, value: number): void {
  if (source === 'tax') {
    playerState.ledger.taxPendingGold = value;
    return;
  }

  playerState.ledger.factionDividendGold = value;
}

export function buildHomeSummary(): HomeSummaryResponse {
  const { ledger } = playerState;
  const castleLevel = getCastleLevel();
  const taxIncomePerHour = getTaxIncomePerHour(castleLevel);
  const factionDividend = getFactionDividendPerHour();

  return {
    app: APP_NAME,
    playerName: playerState.playerName,
    factionName: playerState.factionName,
    castleLevel,
    staminaStatus: buildStaminaStatus(),
    fieldStatus: buildFieldStatus(),
    reportStatus: buildReportStatus(),
    resources: [
      {
        label: '金库',
        value: `${formatNumber(ledger.vaultGold)} / ${formatNumber(ledger.vaultCapacity)}`,
        tone: 'vault',
      },
      {
        label: '余额',
        value: `${formatNumber(ledger.walletGold)} / ${formatNumber(ledger.walletCapacity)}`,
        tone: 'wallet',
      },
    ],
    pendingClaims: [
      {
        source: 'tax',
        label: '主城税收',
        value: formatNumber(ledger.taxPendingGold),
        description: `当前每小时产出 ${formatNumber(taxIncomePerHour)} 金币，领取后直接入库。`,
      },
      {
        source: 'faction',
        label: '阵营分红',
        value: formatNumber(ledger.factionDividendGold),
        description: `当前每小时可分到 ${formatNumber(factionDividend.total)} 金币，来自阵营结算与贡献加成。`,
      },
    ],
    primaryActions: [
      { key: 'building', title: '建筑', description: '升级主城与金库' },
      { key: 'farm', title: '农场', description: '收成熟外场' },
      { key: 'raid', title: '掠夺', description: '查看匿名目标' },
      { key: 'report', title: '战报', description: '处理未读与复仇' },
      { key: 'faction', title: '阵营', description: '上缴并查看分红' },
    ],
  };
}

function buildUpgradeAction(label: string, tone: 'primary' | 'secondary' | 'ghost'): ClientSceneAction {
  return { label, target: 'building', tone };
}

function getUpgradeCost(buildingId: ClientBuildingUpgradeId): number | null {
  const level = playerState.buildingLevels[buildingId];

  if (buildingId === 'castle') {
    return level === 4 ? 1800 : level === 5 ? 2400 : null;
  }

  if (buildingId === 'vault') {
    return level === 3 ? 1150 : level === 4 ? 1580 : null;
  }

  if (buildingId === 'field-slot') {
    return level === 1 ? 980 : null;
  }

  if (buildingId === 'watchtower') {
    return level === 1 ? 760 : level === 2 ? 980 : null;
  }

  return null;
}

function buildBuildingUpgrades(): ClientSceneContentResponse['building']['upgrades'] {
  const castleLevel = playerState.buildingLevels.castle;
  const vaultLevel = playerState.buildingLevels.vault;
  const fieldSlotLevel = playerState.buildingLevels['field-slot'];
  const watchtowerLevel = playerState.buildingLevels.watchtower;
  const lockedFieldExists = playerState.fields.some((field) => !field.unlocked);
  const watchtowerLocked = castleLevel < 5;
  const currentTaxIncome = getTaxIncomePerHour(castleLevel);
  const nextTaxIncome = getTaxIncomePerHour(castleLevel + 1);
  const factionDividend = getFactionDividendPerHour();

  return [
    {
      id: 'castle',
      title: '主城升级',
      description: `Lv.${castleLevel} -> Lv.${castleLevel + 1}，主城税收由每小时 ${formatNumber(currentTaxIncome)} 提升到 ${formatNumber(nextTaxIncome)}。`,
      costText: getUpgradeCost('castle') ? `消耗 ${formatNumber(getUpgradeCost('castle') ?? 0)} 金币` : '已达到验证上限',
      action: buildUpgradeAction(getUpgradeCost('castle') ? '升级主城' : '查看条件', getUpgradeCost('castle') ? 'primary' : 'ghost'),
      locked: !getUpgradeCost('castle'),
    },
    {
      id: 'vault',
      title: '金库升级',
      description: `Lv.${vaultLevel} -> Lv.${vaultLevel + 1}，容量由 ${formatNumber(playerState.ledger.vaultCapacity)} 提升到 ${formatNumber(playerState.ledger.vaultCapacity + 1600)}。`,
      costText: getUpgradeCost('vault') ? `消耗 ${formatNumber(getUpgradeCost('vault') ?? 0)} 金币` : '已达到验证上限',
      action: buildUpgradeAction(getUpgradeCost('vault') ? '升级金库' : '查看条件', getUpgradeCost('vault') ? 'secondary' : 'ghost'),
      locked: !getUpgradeCost('vault'),
    },
    {
      id: 'field-slot',
      title: '外场位升级',
      description: lockedFieldExists
        ? `Lv.${fieldSlotLevel} -> Lv.${fieldSlotLevel + 1}，新增第 3 个培育位。`
        : `Lv.${fieldSlotLevel}，当前验证版外场位已全部解锁。`,
      costText: lockedFieldExists && getUpgradeCost('field-slot') ? `消耗 ${formatNumber(getUpgradeCost('field-slot') ?? 0)} 金币` : '当前已全部解锁',
      action: buildUpgradeAction(lockedFieldExists && getUpgradeCost('field-slot') ? '升级外场位' : '查看条件', lockedFieldExists && getUpgradeCost('field-slot') ? 'secondary' : 'ghost'),
      locked: !lockedFieldExists || !getUpgradeCost('field-slot'),
    },
    {
      id: 'watchtower',
      title: '防守建筑升级',
      description: `Lv.${watchtowerLevel} -> Lv.${watchtowerLevel + 1}，降低余额与外场被掠损失。`,
      costText: watchtowerLocked ? '需要主城 Lv.5' : `消耗 ${formatNumber(getUpgradeCost('watchtower') ?? 0)} 金币`,
      locked: watchtowerLocked || !getUpgradeCost('watchtower'),
      action: buildUpgradeAction(watchtowerLocked ? '查看条件' : '升级防守建筑', watchtowerLocked ? 'ghost' : 'secondary'),
    },
  ];
}

function buildFarmHero(): ClientSceneContentResponse['farm']['hero'] {
  const counts = getFieldCounts();
  const emptyUnlockedField = playerState.fields.find((field) => field.unlocked && field.status === 'empty');

  return {
    eyebrow: '外场经营',
    title: `成熟 ${counts.mature} 块 · 成长中 ${counts.growing} 块`,
    description: emptyUnlockedField
      ? '农场页已接入真实收取与培育写接口，可以直接验证产出和再投入循环。'
      : '当前没有空闲地块，建议先收取成熟外场或升级外场位继续扩产。',
    action: emptyUnlockedField
      ? { label: '开始培育', target: 'farm', tone: 'primary' }
      : { label: '查看说明', target: 'farm', tone: 'ghost' },
  };
}

function buildFarmField(field: FieldState): ClientSceneContentResponse['farm']['fields'][number] {
  if (!field.unlocked) {
    return {
      id: field.id,
      code: field.code,
      title: '未解锁',
      badge: '升级解锁',
      tone: 'empty',
      description: '外场位升级到 Lv.2 后开放。',
      actions: [{ label: '去建筑', target: 'building', tone: 'primary' }],
    };
  }

  if (field.status === 'ripe') {
    return {
      id: field.id,
      code: field.code,
      title: '丰熟期',
      badge: field.badgeText,
      tone: 'ripe',
      description: `投入 ${formatNumber(field.plantedGold)} 金币，当前可收 ${formatNumber(field.currentYield)} 金币，过熟倒计时 02:00:00。`,
      actions: [
        { label: '成熟收取', target: 'farm', tone: 'primary' },
        { label: '收益预览', target: 'farm', tone: 'ghost' },
      ],
    };
  }

  if (field.status === 'growing') {
    return {
      id: field.id,
      code: field.code,
      title: '成长期',
      badge: field.badgeText,
      tone: 'growing',
      description: `投入 ${formatNumber(field.plantedGold)} 金币，当前提前收取仅返还 ${formatNumber(field.currentYield)} 金币。`,
      actions: [
        { label: '提前收取', target: 'farm', tone: 'secondary' },
        { label: '阶段说明', target: 'farm', tone: 'ghost' },
      ],
    };
  }

  return {
    id: field.id,
    code: field.code,
    title: '可培育',
    badge: '空闲地块',
    tone: 'empty',
    description: '投入 520 金币后开始新一轮培育，成熟后可以继续收取再投入。',
    actions: [{ label: '开始培育', target: 'farm', tone: 'primary' }],
  };
}

function buildMutationResponse(summary: string): ClientStateMutationResponse {
  return {
    app: APP_NAME,
    summary,
    home: buildHomeSummary(),
    scenes: buildSceneContent(),
  };
}

export function buildSceneContent(): ClientSceneContentResponse {
  return {
    app: APP_NAME,
    building: {
      upgrades: buildBuildingUpgrades(),
      guide: {
        title: '建筑线引导',
        description: '建筑页已经接入真实花费链路，优先验证主城、金库和外场位升级的资源扣减与状态回写。',
        actions: [
          { label: '打开农场页', target: 'farm', tone: 'secondary' },
          { label: '去掠夺', target: 'raid', tone: 'ghost' },
        ],
      },
    },
    farm: {
      hero: buildFarmHero(),
      fields: playerState.fields.map((field) => buildFarmField(field)),
      guide: {
        title: '农场线引导',
        description: '农场页已经接入真实产出链路，成熟收取和开始培育都会直接改写内存态与首页资源。',
        actions: [
          { label: '打开建筑页', target: 'building', tone: 'secondary' },
          { label: '返回主城', target: 'home', tone: 'ghost' },
        ],
      },
    },
    raid: {
      hero: {
        eyebrow: '匿名目标池',
        title: '剩余免费掠夺 2 / 3',
        description: '系统按综合战力匹配 3 个目标，重点看值不值得打。',
        action: { label: '刷新目标', target: 'raid', tone: 'secondary' },
      },
      targets: [
        {
          id: 'target-1',
          name: '赤砂营地',
          faction: '魔界',
          summary: '等级段 4~5 · 资源预估高 · 防守偏弱',
          loot: '420~560 金币',
          risk: '高风险',
          detail: '魔界 · 主城等级 4~5 · 外场成熟 2 块 · 防守偏弱 · 今日被掠 1 次。',
          action: { label: '发起掠夺', target: 'raid', tone: 'primary' },
        },
        {
          id: 'target-2',
          name: '天穹边仓',
          faction: '仙界',
          summary: '等级段 4 · 资源预估中 · 被掠损失低',
          loot: '260~340 金币',
          risk: '中风险',
          detail: '仙界 · 主城等级 4 · 外场成熟 1 块 · 防守偏稳 · 今日未被掠。',
          action: { label: '发起掠夺', target: 'raid', tone: 'secondary' },
        },
        {
          id: 'target-3',
          name: '灰堡驿站',
          faction: '人界',
          summary: '等级段 3~4 · 资源预估低 · 风险较稳',
          loot: '180~260 金币',
          risk: '低风险',
          detail: '人界 · 主城等级 3~4 · 余额暴露较低 · 适合保守出手。',
          action: { label: '发起掠夺', target: 'raid', tone: 'secondary' },
        },
      ],
      detail: {
        advice: '出征建议：派出 90~110 掠夺兵',
        actions: [
          { label: '更换兵力', target: 'raid', tone: 'ghost' },
          { label: '确认出兵', target: 'raid', tone: 'primary' },
        ],
      },
    },
    report: {
      defense: [
        {
          title: '魔界 · 烬牙',
          tag: '可复仇',
          tone: 'danger',
          unread: true,
          revengeable: true,
          summary: '37 分钟前成功掠走你外场 240 金币，击伤 8 名守备兵。',
          actions: [
            { label: '查看详情', target: 'report', tone: 'ghost' },
            { label: '复仇', target: 'raid', tone: 'primary' },
          ],
        },
        {
          title: '系统结算',
          tag: '分红记录',
          tone: 'neutral',
          unread: true,
          summary: `10:00 阵营小时分红 +${formatNumber(getFactionDividendPerHour().total)}，当前待领取分红 ${formatNumber(playerState.ledger.factionDividendGold)}。`,
          actions: [{ label: '查看详情', target: 'faction', tone: 'ghost' }],
        },
      ],
      attack: [
        {
          title: '匿名目标 · 赤砂营地',
          tag: '掠夺成功',
          tone: 'success',
          summary: '08:40 你成功掠夺 436 金币，获得 18 点掠夺积分。',
          actions: [{ label: '查看详情', target: 'report', tone: 'ghost' }],
        },
      ],
      actions: [
        { label: '一键已读', target: 'report', tone: 'secondary' },
        { label: '返回主城', target: 'home', tone: 'primary' },
      ],
    },
    faction: {
      hero: {
        eyebrow: '人界阵营面板',
        title: `当前待领取分红 ${formatNumber(playerState.ledger.factionDividendGold)}`,
        description: `当前每小时可分到 ${formatNumber(factionDividend.total)} 金币，其中基础分红 ${formatNumber(factionDividend.base)}，贡献加成 ${formatNumber(factionDividend.bonus)}。`,
        action: { label: '领取分红', target: 'faction', tone: 'primary' },
      },
      overview: [
        { label: '阵营公库', value: '82,400' },
        { label: '当前每小时总分红', value: formatNumber(factionDividend.total) },
        { label: '本小时基础分红', value: formatNumber(factionDividend.base) },
        { label: '个人贡献加成', value: `+${formatNumber(factionDividend.bonus)}` },
      ],
      donate: {
        title: '金币上缴',
        description: `上缴会立刻增加贡献值，当前你的每小时分红为 ${formatNumber(factionDividend.total)}，后续会随贡献变化继续浮动。`,
        actions: [
          { label: '金币上缴', target: 'faction', tone: 'secondary' },
          { label: '查看说明', target: 'faction', tone: 'ghost' },
        ],
      },
      rankings: [
        { label: '1. 烬牙', value: '2,340' },
        { label: '2. 你', value: '2,120' },
        { label: '3. 玄潮', value: '1,980' },
      ],
    },
  };
}

export function claimPendingGold(input: ClientClaimPendingRequest): Omit<ClientClaimPendingResponse, 'home' | 'scenes'> {
  const availableVaultSpace = Math.max(playerState.ledger.vaultCapacity - playerState.ledger.vaultGold, 0);
  const pendingGold = getPendingClaimAmount(input.source);
  const claimedGold = Math.min(pendingGold, availableVaultSpace);

  playerState.ledger.vaultGold += claimedGold;
  setPendingClaimAmount(input.source, Math.max(pendingGold - claimedGold, 0));

  const remainingPendingGold = getPendingClaimAmount(input.source);
  const sourceLabel = input.source === 'tax' ? '主城税收' : '阵营分红';
  const summary = claimedGold > 0
    ? `${sourceLabel}本次入库 ${formatNumber(claimedGold)} 金币，剩余待领取 ${formatNumber(remainingPendingGold)}。`
    : `金库空间不足，当前没有可入库的${sourceLabel}。`;

  return {
    app: APP_NAME,
    summary,
    source: input.source,
    claimedGold,
    remainingPendingGold,
    ledger: { ...playerState.ledger },
  };
}

export function collectFieldGold(input: ClientCollectFieldRequest): ClientStateMutationResponse {
  const field = playerState.fields.find((item) => item.id === input.fieldId);

  if (!field || !field.unlocked) {
    return buildMutationResponse('当前地块不可操作，请先解锁对应外场位。');
  }

  if (input.collectMode === 'ripe' && field.status !== 'ripe') {
    return buildMutationResponse('这块地当前不在成熟收取阶段。');
  }

  if (input.collectMode === 'early' && field.status !== 'growing') {
    return buildMutationResponse('这块地当前不支持提前收取。');
  }

  const availableVaultSpace = Math.max(playerState.ledger.vaultCapacity - playerState.ledger.vaultGold, 0);
  const depositedGold = Math.min(field.currentYield, availableVaultSpace);
  const overflowGold = Math.max(field.currentYield - depositedGold, 0);

  playerState.ledger.vaultGold += depositedGold;
  field.status = 'empty';
  field.plantedGold = 0;
  field.currentYield = 0;
  field.badgeText = '空闲地块';

  const summary = overflowGold > 0
    ? `${field.code} 已收取 ${formatNumber(depositedGold)} 金币，另有 ${formatNumber(overflowGold)} 因金库满额未能入库。`
    : `${field.code} 已收取 ${formatNumber(depositedGold)} 金币，可以立即再投入新一轮培育。`;

  return buildMutationResponse(summary);
}

export function startCultivation(input: ClientStartCultivationRequest): ClientStateMutationResponse {
  const field = playerState.fields.find((item) => item.id === input.fieldId);
  const cultivationCost = 520;

  if (!field || !field.unlocked) {
    return buildMutationResponse('当前地块尚未解锁，无法开始培育。');
  }

  if (field.status !== 'empty') {
    return buildMutationResponse('当前地块已经在培育中或可直接收取。');
  }

  if (playerState.ledger.vaultGold < cultivationCost) {
    return buildMutationResponse('金库余额不足，无法开始本轮培育。');
  }

  playerState.ledger.vaultGold -= cultivationCost;
  field.status = 'growing';
  field.plantedGold = cultivationCost;
  field.currentYield = 660;
  field.badgeText = '01:42 后成熟';

  return buildMutationResponse(`${field.code} 已投入 ${formatNumber(cultivationCost)} 金币，开始新一轮培育。`);
}

export function upgradeBuilding(input: ClientUpgradeBuildingRequest): ClientStateMutationResponse {
  const cost = getUpgradeCost(input.buildingId);

  if (!cost) {
    return buildMutationResponse('当前建筑不满足升级条件，或已达到验证上限。');
  }

  if (playerState.ledger.vaultGold < cost) {
    return buildMutationResponse('金库余额不足，当前无法完成升级。');
  }

  playerState.ledger.vaultGold -= cost;

  if (input.buildingId === 'castle') {
    playerState.buildingLevels.castle += 1;
    return buildMutationResponse(`主城升级完成，当前已升至 Lv.${playerState.buildingLevels.castle}。`);
  }

  if (input.buildingId === 'vault') {
    playerState.buildingLevels.vault += 1;
    playerState.ledger.vaultCapacity += 1600;
    return buildMutationResponse(`金库升级完成，容量已提升到 ${formatNumber(playerState.ledger.vaultCapacity)}。`);
  }

  if (input.buildingId === 'field-slot') {
    playerState.buildingLevels['field-slot'] += 1;
    const lockedField = playerState.fields.find((field) => !field.unlocked);
    if (lockedField) {
      lockedField.unlocked = true;
      lockedField.status = 'empty';
      lockedField.badgeText = '空闲地块';
    }
    return buildMutationResponse('外场位升级完成，新地块已经开放，可直接开始培育。');
  }

  playerState.buildingLevels.watchtower += 1;
  return buildMutationResponse(`防守建筑升级完成，当前已升至 Lv.${playerState.buildingLevels.watchtower}。`);
}

export function resetDemoState(): ClientResetDemoStateResponse {
  const nextState = clonePlayerState(initialPlayerState);

  playerState.playerName = nextState.playerName;
  playerState.factionName = nextState.factionName;
  playerState.buildingLevels = nextState.buildingLevels;
  playerState.raidTicketsUsed = nextState.raidTicketsUsed;
  playerState.unreadReports = nextState.unreadReports;
  playerState.revengeCount = nextState.revengeCount;
  playerState.ledger = nextState.ledger;
  playerState.fields = nextState.fields;

  return {
    app: APP_NAME,
    summary: '实验数据已重置到初始状态，可以重新验证领取、收取和升级链路。',
    home: buildHomeSummary(),
    scenes: buildSceneContent(),
  };
}

export function transferGold(input: ClientTransferGoldRequest): ClientStateMutationResponse {
  const amount = Math.max(Math.floor(input.amount), 0);

  if (amount <= 0) {
    return buildMutationResponse('请输入大于 0 的转账金额。');
  }

  if (input.from === 'vault') {
    const transferableGold = Math.min(
      amount,
      playerState.ledger.vaultGold,
      Math.max(playerState.ledger.walletCapacity - playerState.ledger.walletGold, 0),
    );

    if (transferableGold <= 0) {
      return buildMutationResponse('余额已满或金库可转金额不足，当前无法转入余额。');
    }

    playerState.ledger.vaultGold -= transferableGold;
    playerState.ledger.walletGold += transferableGold;

    return buildMutationResponse(`已从金库转出 ${formatNumber(transferableGold)} 金币到余额。`);
  }

  const transferableGold = Math.min(
    amount,
    playerState.ledger.walletGold,
    Math.max(playerState.ledger.vaultCapacity - playerState.ledger.vaultGold, 0),
  );

  if (transferableGold <= 0) {
    return buildMutationResponse('金库已满或余额可转金额不足，当前无法转回金库。');
  }

  playerState.ledger.walletGold -= transferableGold;
  playerState.ledger.vaultGold += transferableGold;

  return buildMutationResponse(`已从余额转入 ${formatNumber(transferableGold)} 金币到金库。`);
}