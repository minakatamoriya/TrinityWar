import {
  APP_NAME,
  type ClientClaimPendingRequest,
  type ClientClaimPendingResponse,
  type ClientCollectFieldRequest,
  type ClientBuildingUpgradeId,
  type ClientPendingClaimSource,
  type ClientRaidTargetDetailResponse,
  type ClientResetDemoStateResponse,
  type ClientSceneAction,
  type ClientSceneContentResponse,
  type ClientResourceLedger,
  type ClientStartCultivationRequest,
  type ClientStateMutationResponse,
  type ClientUpgradeBuildingRequest,
  type HomeSummaryResponse,
} from '@trinitywar/shared';

interface FieldState {
  id: string;
  code: string;
  unlocked: boolean;
  status: 'empty' | 'seeded' | 'growing' | 'mature' | 'withered';
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
    taxPendingGold: 380,
    factionDividendGold: 540,
  },
  fields: [
    {
      id: 'field-1',
      code: '田地 01',
      unlocked: true,
      status: 'mature',
      plantedGold: 600,
      currentYield: 1260,
      badgeText: '成熟',
    },
    {
      id: 'field-2',
      code: '田地 02',
      unlocked: true,
      status: 'seeded',
      plantedGold: 420,
      currentYield: 520,
      badgeText: '播种',
    },
    {
      id: 'field-3',
      code: '田地 03',
      unlocked: true,
      status: 'growing',
      plantedGold: 520,
      currentYield: 660,
      badgeText: '成长',
    },
    {
      id: 'field-4',
      code: '田地 04',
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

    if (field.status === 'mature' || field.status === 'withered') {
      return { ...counts, mature: counts.mature + 1 };
    }

    return { ...counts, growing: counts.growing + 1 };
  }, { mature: 0, growing: 0, empty: 0 });
}

function buildFieldStatus(): string {
  const counts = getFieldCounts();
  return `成熟田地 ${counts.mature} 块，成长中 ${counts.growing} 块`;
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
        label: '我的金币',
        value: `${formatNumber(ledger.vaultGold)} / ${formatNumber(ledger.vaultCapacity)}`,
        tone: 'vault',
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
      { key: 'building', title: '建筑', description: '升级主城与金币容量' },
      { key: 'farm', title: '农场', description: '收成熟田地' },
      { key: 'raid', title: '掠夺', description: '查看可掠夺目标' },
      { key: 'report', title: '战报', description: '处理未读与复仇' },
      { key: 'faction', title: '阵营', description: '上缴并查看分红' },
    ],
  };
}

function buildRaidDetailActions(): ClientSceneAction[] {
  return [
    { label: '发起掠夺', target: 'raid', tone: 'primary' },
    { label: '发布通缉令', target: 'raid', tone: 'secondary' },
    { label: '邀请摇人', target: 'raid', tone: 'ghost' },
    { label: '分享目标', target: 'raid', tone: 'ghost' },
  ];
}

export function buildRaidTargetDetail(targetId: string): ClientRaidTargetDetailResponse {
  if (targetId === 'target-1') {
    return {
      app: APP_NAME,
      targetId,
      name: '烬牙',
      faction: '魔界',
      level: 5,
      combatPower: '1,320',
      fieldPreviewTone: 'mature',
      fieldStatus: '成熟田 2 块，成长期 1 块',
      raidableGold: '520 金币',
      exposedFruit: '2 块成熟田 · 预计 880 金币',
      raidRule: '按当前金币的一部分结算，本次预计命中 520 金币',
      defenseStatus: '防守偏弱，驻守兵少于常见同级目标',
      protectionStatus: '当前无保护，可直接发起掠夺或通缉令',
      detail: '对手昵称烬牙，刚结束一轮农场收取，外露收益仍然较高。魔界加成偏向进攻，适合快速出手。',
      actions: buildRaidDetailActions(),
    };
  }

  if (targetId === 'target-2') {
    return {
      app: APP_NAME,
      targetId,
      name: '云栖',
      faction: '仙界',
      level: 4,
      combatPower: '1,080',
      fieldPreviewTone: 'seeded',
      fieldStatus: '成熟田 1 块，播种田 2 块',
      raidableGold: '260 金币',
      exposedFruit: '1 块成熟田 · 预计 420 金币',
      raidRule: '按当前金币的一部分结算，本次预计命中 260 金币',
      defenseStatus: '防守偏稳，仙界被掠损失减免明显',
      protectionStatus: '刚结束保护期，可被单人试探',
      detail: '对手昵称云栖，收益中等但仙界自带减损，适合先做一轮稳妥试探。',
      actions: buildRaidDetailActions(),
    };
  }

  if (targetId === 'target-3') {
    return {
      app: APP_NAME,
      targetId,
      name: '临风',
      faction: '人界',
      level: 4,
      combatPower: '920',
      fieldPreviewTone: 'growing',
      fieldStatus: '成长期 1 块，空闲田 1 块',
      raidableGold: '180 金币',
      exposedFruit: '1 块成长尾段田 · 预计 260 金币',
      raidRule: '按当前金币的一部分结算，本次预计命中 180 金币',
      defenseStatus: '人界经营向，防守一般，但暴露收益偏低',
      protectionStatus: '今日未被掠，可正常查看并试探',
      detail: '对手昵称临风，收益较低，更适合作为保守出手对象。',
      actions: buildRaidDetailActions(),
    };
  }

  if (targetId === 'target-4') {
    return {
      app: APP_NAME,
      targetId,
      name: '玄潮',
      faction: '魔界',
      level: 5,
      combatPower: '1,240',
      fieldPreviewTone: 'mature',
      fieldStatus: '成熟田 1 块，成长期 2 块',
      raidableGold: '460 金币',
      exposedFruit: '1 块成熟田 · 预计 510 金币',
      raidRule: '按当前金币的一部分结算，本次预计命中 460 金币',
      defenseStatus: '中等防守，战力高但驻防分散',
      protectionStatus: '当前无保护，可立即出手',
      detail: '对手昵称玄潮，主城等级高一档，收益不错，但正面强碰战损会更高。',
      actions: buildRaidDetailActions(),
    };
  }

  if (targetId === 'target-5') {
    return {
      app: APP_NAME,
      targetId,
      name: '青槐',
      faction: '仙界',
      level: 3,
      combatPower: '760',
      fieldPreviewTone: 'mature',
      fieldStatus: '成熟田 1 块，空闲田 2 块',
      raidableGold: '140 金币',
      exposedFruit: '1 块成熟田 · 预计 190 金币',
      raidRule: '按当前金币的一部分结算，本次预计命中 140 金币',
      defenseStatus: '防守偏弱，适合低损验证',
      protectionStatus: '保护已结束，可正常掠夺',
      detail: '对手昵称青槐，适合低风险起手，重点看田地收益是否值得你消耗免费次数。',
      actions: buildRaidDetailActions(),
    };
  }

  return {
    app: APP_NAME,
    targetId,
    name: '碎星',
    faction: '人界',
    level: 4,
    combatPower: '880',
    fieldPreviewTone: 'seeded',
    fieldStatus: '播种田 2 块，空闲田 1 块',
    raidableGold: '120 金币',
    exposedFruit: '成熟收益较低 · 预计 120 金币',
    raidRule: '按当前金币的一部分结算，本次预计命中 120 金币',
    defenseStatus: '防守一般，当前暴露值较低',
    protectionStatus: '可查看，但当前不算优质目标',
    detail: '对手昵称碎星，属于当前列表里价值最低的一档，更多用于衬托目标筛选判断。',
    actions: buildRaidDetailActions(),
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
      title: '田地位升级',
      description: lockedFieldExists
        ? `Lv.${fieldSlotLevel} -> Lv.${fieldSlotLevel + 1}，新增第 3 个培育位。`
        : `Lv.${fieldSlotLevel}，当前验证版田地位已全部解锁。`,
      costText: lockedFieldExists && getUpgradeCost('field-slot') ? `消耗 ${formatNumber(getUpgradeCost('field-slot') ?? 0)} 金币` : '当前已全部解锁',
      action: buildUpgradeAction(lockedFieldExists && getUpgradeCost('field-slot') ? '升级田地位' : '查看条件', lockedFieldExists && getUpgradeCost('field-slot') ? 'secondary' : 'ghost'),
      locked: !lockedFieldExists || !getUpgradeCost('field-slot'),
    },
    {
      id: 'watchtower',
      title: '防守建筑升级',
      description: `Lv.${watchtowerLevel} -> Lv.${watchtowerLevel + 1}，降低单次被掠比例并强化田地防守。`,
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
    eyebrow: '田地经营',
    title: `成熟 ${counts.mature} 块 · 生长中 ${counts.growing} 块`,
    description: emptyUnlockedField
      ? '农场以田地为主，点击空地即可继续播种，成熟后直接收取。'
      : '农场地块已排满，可直接收取成熟地块或解锁新田位。',
    action: emptyUnlockedField
      ? { label: '开始培育', target: 'farm', tone: 'primary' }
      : { label: '解锁田地', target: 'farm', tone: 'secondary' },
  };
}

function buildFarmField(field: FieldState): ClientSceneContentResponse['farm']['fields'][number] {
  if (!field.unlocked) {
    return {
      id: field.id,
      code: field.code,
      title: '未解锁',
      badge: '待解锁',
      tone: 'locked',
      progressRemainingSeconds: 0,
      progressTotalSeconds: 1,
      description: '收取金额 0 金币',
      actions: [{ label: '解锁田地', target: 'farm', tone: 'secondary' }],
    };
  }

  if (field.status === 'mature') {
    return {
      id: field.id,
      code: field.code,
      title: '成熟期',
      badge: field.badgeText,
      tone: 'mature',
      progressRemainingSeconds: 0,
      progressTotalSeconds: 1,
      description: `收取金额 ${formatNumber(field.currentYield)} 金币`,
      actions: [
        { label: '成熟收取', target: 'farm', tone: 'primary' },
      ],
    };
  }

  if (field.status === 'withered') {
    return {
      id: field.id,
      code: field.code,
      title: '枯萎期',
      badge: field.badgeText,
      tone: 'withered',
      progressRemainingSeconds: 0,
      progressTotalSeconds: 1,
      description: `收取金额 ${formatNumber(field.currentYield)} 金币`,
      actions: [
        { label: '枯萎收取', target: 'farm', tone: 'secondary' },
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
      progressRemainingSeconds: 4690,
      progressTotalSeconds: 7200,
      description: `收取金额 ${formatNumber(field.currentYield)} 金币`,
      actions: [
        { label: '提前收取', target: 'farm', tone: 'secondary' },
      ],
    };
  }

  if (field.status === 'seeded') {
    return {
      id: field.id,
      code: field.code,
      title: '播种期',
      badge: field.badgeText,
      tone: 'seeded',
      progressRemainingSeconds: 2535,
      progressTotalSeconds: 3600,
      description: `收取金额 ${formatNumber(field.currentYield)} 金币`,
      actions: [
        { label: '查看阶段', target: 'farm', tone: 'ghost' },
      ],
    };
  }

  return {
    id: field.id,
    code: field.code,
    title: '可培育',
    badge: '空闲地块',
    tone: 'empty',
    progressRemainingSeconds: 0,
    progressTotalSeconds: 1,
    description: '收取金额 0 金币',
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
  const factionDividend = getFactionDividendPerHour();

  return {
    app: APP_NAME,
    building: {
      upgrades: buildBuildingUpgrades(),
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
        eyebrow: '可掠夺目标',
        title: '剩余免费掠夺 2 / 3',
        description: '进入页面后先看目标列表，重点判断等级、阵营和当前值不值得出手。',
        action: { label: '刷新目标', target: 'raid', tone: 'secondary' },
      },
      targets: [
        {
          id: 'target-1',
          name: '烬牙',
          faction: '魔界',
          level: 5,
          combatPower: '1,320',
          summary: '魔界 · 资源高 · 防守偏弱',
          loot: '420~560 金币',
          risk: '高风险',
          detail: '成熟田 2 块 · 可掠 520 · 今日被掠 1 次',
          action: { label: '发起掠夺', target: 'raid', tone: 'primary' },
        },
        {
          id: 'target-2',
          name: '云栖',
          faction: '仙界',
          level: 4,
          combatPower: '1,080',
          summary: '仙界 · 资源中 · 减损明显',
          loot: '260~340 金币',
          risk: '中风险',
          detail: '成熟田 1 块 · 可掠 260 · 防守偏稳',
          action: { label: '发起掠夺', target: 'raid', tone: 'secondary' },
        },
        {
          id: 'target-3',
          name: '临风',
          faction: '人界',
          level: 4,
          combatPower: '920',
          summary: '人界 · 资源低 · 风险较稳',
          loot: '180~260 金币',
          risk: '低风险',
          detail: '成长期 1 块 · 可掠 180 · 适合保守出手',
          action: { label: '发起掠夺', target: 'raid', tone: 'secondary' },
        },
        {
          id: 'target-4',
          name: '玄潮',
          faction: '魔界',
          level: 5,
          combatPower: '1,240',
          summary: '魔界 · 资源中高 · 战力偏高',
          loot: '360~480 金币',
          risk: '中高风险',
          detail: '成熟田 1 块 · 可掠 460 · 驻防分散',
          action: { label: '发起掠夺', target: 'raid', tone: 'secondary' },
        },
        {
          id: 'target-5',
          name: '青槐',
          faction: '仙界',
          level: 3,
          combatPower: '760',
          summary: '仙界 · 资源低 · 适合起手',
          loot: '150~220 金币',
          risk: '低风险',
          detail: '成熟田 1 块 · 可掠 140 · 防守偏弱',
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
          summary: '37 分钟前成功掠走你田地 240 金币，击伤 8 名守备兵。',
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
    ? `${sourceLabel}本次入账 ${formatNumber(claimedGold)} 金币，剩余待领取 ${formatNumber(remainingPendingGold)}。`
    : `我的金币空间不足，当前没有可入账的${sourceLabel}。`;

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
    return buildMutationResponse('当前地块不可操作，请先解锁对应田地位。');
  }

  if (input.collectMode === 'ripe' && field.status !== 'mature' && field.status !== 'withered') {
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
    ? `${field.code} 已收取 ${formatNumber(depositedGold)} 金币，另有 ${formatNumber(overflowGold)} 因我的金币已满未能入账。`
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
    return buildMutationResponse('我的金币不足，无法开始本轮培育。');
  }

  playerState.ledger.vaultGold -= cultivationCost;
  field.status = 'seeded';
  field.plantedGold = cultivationCost;
  field.currentYield = 520;
  field.badgeText = '播种';

  return buildMutationResponse(`${field.code} 已投入 ${formatNumber(cultivationCost)} 金币，开始新一轮培育。`);
}

export function upgradeBuilding(input: ClientUpgradeBuildingRequest): ClientStateMutationResponse {
  const cost = getUpgradeCost(input.buildingId);

  if (!cost) {
    return buildMutationResponse('当前建筑不满足升级条件，或已达到验证上限。');
  }

  if (playerState.ledger.vaultGold < cost) {
    return buildMutationResponse('我的金币不足，当前无法完成升级。');
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
    return buildMutationResponse('田地位升级完成，新地块已经开放，可直接开始培育。');
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

