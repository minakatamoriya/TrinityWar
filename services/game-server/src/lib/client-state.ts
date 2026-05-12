import {
  APP_NAME,
  type ClientArmyTrainingQueue,
  type ClientBootstrapResponse,
  type ClientRaidActionRequest,
  type ClientRaidActionResponse,
  type ClientFactionDonateRequest,
  type ClientClaimPendingRequest,
  type ClientClaimPendingResponse,
  type ClientCollectFieldRequest,
  type ClientCollectFieldResponse,
  type ClientCollectRewardItem,
  type ClientBuildingUpgradeId,
  type ClientPendingClaimSource,
  type ClientRaidRewardItem,
  type ClientRaidTargetDetailResponse,
  type ClientRecruitArmyRequest,
  type ClientResetDemoStateResponse,
  type ClientReportEntry,
  type ClientSceneAction,
  type ClientSceneContentResponse,
  type ClientResourceLedger,
  type ClientStartCultivationRequest,
  type ClientStateMutationResponse,
  type ClientUpgradeBuildingRequest,
  type HomeSummaryResponse,
} from '@trinitywar/shared';
import {
  GAME_BALANCE,
  getBuildingUpgradeCost,
  getFactionDividendPerHour as getConfiguredFactionDividendPerHour,
  getPopulationCapacityGain,
  getTaxIncomePerHour as getConfiguredTaxIncomePerHour,
  getVaultCapacityGain,
} from './game-balance.js';

interface FieldState {
  id: string;
  code: string;
  unlocked: boolean;
  status: 'empty' | 'seeded' | 'growing' | 'mature' | 'withered';
  plantedSeedId?: string;
  plantedGold: number;
  currentYield: number;
  badgeText: string;
}

const seedLabelMap: Record<string, string> = {
  lingmai: '灵麦',
  yingdou: '影豆',
  chihu: '赤葫',
  yuzhe: '玉蔗',
  xuanSu: '玄粟',
  yaokui: '曜葵',
  hanmei: '寒莓',
  chijiao: '炽椒',
  yuelan: '月兰',
  longteng: '龙藤',
  xiaolian: '霄莲',
};

interface RaidTargetState {
  id: string;
  name: string;
  faction: string;
  level: number;
  combatPower: number;
  summary: string;
  risk: string;
  detail: string;
  fieldPreviewTone: 'seeded' | 'growing' | 'mature' | 'withered' | 'empty' | 'locked';
  fieldStatus: string;
  fields: FieldState[];
  raidableGold: number;
  exposedFruit: string;
  defenseStatus: string;
  protectionUntil?: string;
  seedDrop: {
    seedId: string;
    label: string;
    quantity: number;
    chance: number;
  };
}

interface InMemoryPlayerState {
  playerName: string;
  factionName: string;
  seedInventory: Record<string, number>;
  unlockedSeedIds: string[];
  starterSeedClaimed: boolean;
  buildingLevels: Record<ClientBuildingUpgradeId, number>;
  armyCount: number;
  armyCapacity: number;
  armyTrainingQueue: Omit<ClientArmyTrainingQueue, 'remainingSeconds'> | null;
  raidTicketsUsed: number;
  unreadReports: number;
  revengeCount: number;
  factionContribution: number;
  factionTreasuryGold: number;
  factionArmyPower: number;
  ledger: ClientResourceLedger;
  temporaryRaidClaim: {
    goldAmount: number;
    expiresAt: string;
  } | null;
  fields: FieldState[];
  raidTargets: RaidTargetState[];
  defenseReports: ClientReportEntry[];
  attackReports: ClientReportEntry[];
}

function clonePlayerState(state: InMemoryPlayerState): InMemoryPlayerState {
  return JSON.parse(JSON.stringify(state)) as InMemoryPlayerState;
}

function buildSeedBackpack(): ClientBootstrapResponse['backpack'] {
  return {
    seedInventory: { ...playerState.seedInventory },
    unlockedSeedIds: [...playerState.unlockedSeedIds],
    starterSeedClaimed: playerState.starterSeedClaimed,
  };
}

export function buildClientBootstrap(): ClientBootstrapResponse {
  return {
    app: APP_NAME,
    env: 'local',
    version: '0.1.0',
    serverTime: new Date().toISOString(),
    season: {
      seasonNumber: 3,
      currentWeek: 1,
      totalWeeks: 4,
    },
    backpack: buildSeedBackpack(),
  };
}

function applySeedRewards(rewards: Array<{ seedId: string; quantity: number }>): void {
  rewards.forEach((reward) => {
    playerState.seedInventory[reward.seedId] = (playerState.seedInventory[reward.seedId] ?? 0) + reward.quantity;
    if (!playerState.unlockedSeedIds.includes(reward.seedId)) {
      playerState.unlockedSeedIds.push(reward.seedId);
    }
  });
}

function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

const initialDefenseReports: ClientReportEntry[] = [
  {
    title: '魔界 · 烬牙',
    tag: '可复仇',
    tone: 'danger',
    createdAt: minutesAgoIso(37),
    unread: true,
    revengeable: true,
    summary: '37 分钟前成功掠走你田地 240 金币，击伤 8 名守备兵。',
    actions: [
      { label: '查看详情', target: 'report', tone: 'ghost' },
      { label: '复仇', target: 'raid', tone: 'primary' },
    ],
  },
];

const initialAttackReports: ClientReportEntry[] = [
  {
    title: '匿名目标 · 赤砂营地',
    tag: '掠夺成功',
    tone: 'success',
    createdAt: minutesAgoIso(58),
    summary: '08:40 你成功掠夺 436 金币，获得 18 点掠夺积分。',
    actions: [{ label: '查看详情', target: 'report', tone: 'ghost' }],
  },
];

const initialRaidTargets: RaidTargetState[] = [
  {
    id: 'target-1',
    name: '烬牙',
    faction: '魔界',
    level: 5,
    combatPower: 1320,
    summary: '魔界 · 资源高 · 防守偏弱',
    risk: '高风险',
    detail: '成熟田 2 块 · 可掠 520 · 今日被掠 1 次',
    fieldPreviewTone: 'mature',
    fieldStatus: '成熟田 2 块，成长期 1 块',
    fields: [
      { id: 'target-1-field-1', code: '田地 01', unlocked: true, status: 'mature', plantedSeedId: 'longteng', plantedGold: 260, currentYield: 420, badgeText: '丰熟' },
      { id: 'target-1-field-2', code: '田地 02', unlocked: true, status: 'mature', plantedSeedId: 'chijiao', plantedGold: 280, currentYield: 460, badgeText: '丰熟' },
      { id: 'target-1-field-3', code: '田地 03', unlocked: true, status: 'growing', plantedSeedId: 'yaokui', plantedGold: 210, currentYield: 320, badgeText: '成长' },
      { id: 'target-1-field-4', code: '田地 04', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' },
    ],
    raidableGold: 520,
    exposedFruit: '2 块成熟田 · 预计 880 金币',
    defenseStatus: '防守偏弱，驻守兵少于常见同级目标',
    seedDrop: { seedId: 'longteng', label: '龙藤', quantity: 1, chance: 0.18 },
  },
  {
    id: 'target-2',
    name: '云栖',
    faction: '仙界',
    level: 4,
    combatPower: 1080,
    summary: '仙界 · 资源中 · 减损明显',
    risk: '中风险',
    detail: '成熟田 1 块 · 可掠 260 · 防守偏稳',
    fieldPreviewTone: 'seeded',
    fieldStatus: '成熟田 1 块，播种田 2 块',
    fields: [
      { id: 'target-2-field-1', code: '田地 01', unlocked: true, status: 'mature', plantedSeedId: 'yuelan', plantedGold: 200, currentYield: 420, badgeText: '丰熟' },
      { id: 'target-2-field-2', code: '田地 02', unlocked: true, status: 'seeded', plantedSeedId: 'lingmai', plantedGold: 120, currentYield: 180, badgeText: '播种' },
      { id: 'target-2-field-3', code: '田地 03', unlocked: true, status: 'seeded', plantedSeedId: 'hanmei', plantedGold: 160, currentYield: 210, badgeText: '播种' },
      { id: 'target-2-field-4', code: '田地 04', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' },
    ],
    raidableGold: 260,
    exposedFruit: '1 块成熟田 · 预计 420 金币',
    defenseStatus: '防守偏稳，仙界被掠损失减免明显',
    seedDrop: { seedId: 'yuelan', label: '月兰', quantity: 1, chance: 0.14 },
  },
  {
    id: 'target-3',
    name: '临风',
    faction: '人界',
    level: 4,
    combatPower: 920,
    summary: '人界 · 资源低 · 风险较稳',
    risk: '低风险',
    detail: '成长期 1 块 · 可掠 180 · 适合保守出手',
    fieldPreviewTone: 'growing',
    fieldStatus: '成长期 1 块，空闲田 1 块',
    fields: [
      { id: 'target-3-field-1', code: '田地 01', unlocked: true, status: 'growing', plantedSeedId: 'hanmei', plantedGold: 140, currentYield: 260, badgeText: '成长' },
      { id: 'target-3-field-2', code: '田地 02', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' },
      { id: 'target-3-field-3', code: '田地 03', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' },
      { id: 'target-3-field-4', code: '田地 04', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' },
    ],
    raidableGold: 180,
    exposedFruit: '1 块成长尾段田 · 预计 260 金币',
    defenseStatus: '人界经营向，防守一般，但暴露收益偏低',
    seedDrop: { seedId: 'hanmei', label: '寒莓', quantity: 1, chance: 0.12 },
  },
  {
    id: 'target-4',
    name: '玄潮',
    faction: '魔界',
    level: 5,
    combatPower: 1240,
    summary: '魔界 · 资源中高 · 战力偏高',
    risk: '中高风险',
    detail: '成熟田 1 块 · 可掠 460 · 驻防分散',
    fieldPreviewTone: 'mature',
    fieldStatus: '成熟田 1 块，成长期 2 块',
    fields: [
      { id: 'target-4-field-1', code: '田地 01', unlocked: true, status: 'mature', plantedSeedId: 'chijiao', plantedGold: 250, currentYield: 510, badgeText: '丰熟' },
      { id: 'target-4-field-2', code: '田地 02', unlocked: true, status: 'growing', plantedSeedId: 'yaokui', plantedGold: 220, currentYield: 300, badgeText: '成长' },
      { id: 'target-4-field-3', code: '田地 03', unlocked: true, status: 'growing', plantedSeedId: 'longteng', plantedGold: 240, currentYield: 340, badgeText: '成长' },
      { id: 'target-4-field-4', code: '田地 04', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' },
    ],
    raidableGold: 460,
    exposedFruit: '1 块成熟田 · 预计 510 金币',
    defenseStatus: '中等防守，战力高但驻防分散',
    seedDrop: { seedId: 'chijiao', label: '炽椒', quantity: 1, chance: 0.16 },
  },
  {
    id: 'target-5',
    name: '青槐',
    faction: '仙界',
    level: 3,
    combatPower: 760,
    summary: '仙界 · 资源低 · 适合起手',
    risk: '低风险',
    detail: '成熟田 1 块 · 可掠 140 · 防守偏弱',
    fieldPreviewTone: 'mature',
    fieldStatus: '成熟田 1 块，空闲田 2 块',
    fields: [
      { id: 'target-5-field-1', code: '田地 01', unlocked: true, status: 'mature', plantedSeedId: 'yaokui', plantedGold: 120, currentYield: 190, badgeText: '丰熟' },
      { id: 'target-5-field-2', code: '田地 02', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' },
      { id: 'target-5-field-3', code: '田地 03', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' },
      { id: 'target-5-field-4', code: '田地 04', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' },
    ],
    raidableGold: 140,
    exposedFruit: '1 块成熟田 · 预计 190 金币',
    defenseStatus: '防守偏弱，适合低损验证',
    seedDrop: { seedId: 'yaokui', label: '曜葵', quantity: 1, chance: 0.1 },
  },
];

const initialPlayerState: InMemoryPlayerState = {
  playerName: '人界领主·临川',
  factionName: '人界',
  seedInventory: {
    lingmai: 0,
    yingdou: 0,
    chihu: 0,
    yuzhe: 0,
    xuanSu: 0,
    yaokui: 0,
    hanmei: 0,
    chijiao: 0,
    yuelan: 0,
    longteng: 0,
    xiaolian: 0,
  },
  unlockedSeedIds: ['lingmai'],
  starterSeedClaimed: false,
  buildingLevels: {
    castle: 4,
    vault: 3,
    'field-slot': 1,
    population: 1,
    watchtower: 1,
  },
  armyCount: 40,
  armyCapacity: 100,
  armyTrainingQueue: null,
  raidTicketsUsed: 1,
  unreadReports: 2,
  revengeCount: 1,
  factionContribution: 40,
  factionTreasuryGold: 82400,
  factionArmyPower: 1260,
  ledger: {
    vaultGold: 4280,
    vaultCapacity: 5000,
    taxPendingGold: 380,
    factionDividendGold: 540,
  },
  temporaryRaidClaim: null,
  fields: [
    {
      id: 'field-1',
      code: '田地 01',
      unlocked: true,
      status: 'mature',
      plantedSeedId: 'lingmai',
      plantedGold: 600,
      currentYield: 1260,
      badgeText: '丰熟',
    },
    {
      id: 'field-2',
      code: '田地 02',
      unlocked: true,
      status: 'seeded',
      plantedSeedId: 'lingmai',
      plantedGold: 420,
      currentYield: 520,
      badgeText: '播种',
    },
    {
      id: 'field-3',
      code: '田地 03',
      unlocked: true,
      status: 'growing',
      plantedSeedId: 'lingmai',
      plantedGold: 520,
      currentYield: 660,
      badgeText: '成熟',
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
  raidTargets: initialRaidTargets,
  defenseReports: initialDefenseReports,
  attackReports: initialAttackReports,
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
  return `丰熟田地 ${counts.mature} 块，成熟中 ${counts.growing} 块`;
}

function buildReportStatus(): string {
  return `未读战报 ${playerState.unreadReports}，免费复仇 ${playerState.revengeCount}`;
}

function getRemainingRaidCount(): number {
  return Math.max(3 - playerState.raidTicketsUsed, 0);
}

function isTargetProtected(target: RaidTargetState): boolean {
  if (!target.protectionUntil) {
    return false;
  }

  return new Date(target.protectionUntil).getTime() > Date.now();
}

function formatProtectionStatus(target: RaidTargetState): string {
  if (!target.protectionUntil) {
    return '当前无保护，可直接发起掠夺或通缉令';
  }

  const remainingMs = new Date(target.protectionUntil).getTime() - Date.now();
  if (remainingMs <= 0) {
    return '保护已结束，可正常掠夺';
  }

  const remainingMinutes = Math.max(Math.ceil(remainingMs / 60000), 1);
  return `防护中，约 ${remainingMinutes} 分钟后解除`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getTaxIncomePerHour(level: number): number {
  return getConfiguredTaxIncomePerHour(level);
}

function getFactionDividendPerHour(): { base: number; bonus: number; total: number } {
  return getConfiguredFactionDividendPerHour(playerState.factionContribution);
}

function getFactionAdvantageText(): string {
  if (playerState.factionName === '仙界') {
    return '仙界优势：被掠损失更低，更适合稳发育和保成熟窗口。';
  }

  if (playerState.factionName === '魔界') {
    return '魔界优势：更擅长主动掠夺，但战损更高、防守更脆。';
  }

  return '人界优势：更擅长把上缴资源转成贡献与分红，适合平衡运营。';
}

function buildFactionComparison(): ClientSceneContentResponse['faction']['comparison'] {
  return [
    {
      faction: '人界',
      advantage: '贡献转化更稳，适合分红运营。',
      gold: formatNumber(playerState.factionTreasuryGold),
      power: formatNumber(playerState.factionArmyPower),
      isCurrent: playerState.factionName === '人界',
    },
    {
      faction: '仙界',
      advantage: '被掠损失减少 10%，更适合稳守。',
      gold: '79,600',
      power: '1,180',
      isCurrent: playerState.factionName === '仙界',
    },
    {
      faction: '魔界',
      advantage: '掠夺收益增加 10%，但战损更高。',
      gold: '85,300',
      power: '1,340',
      isCurrent: playerState.factionName === '魔界',
    },
  ];
}

function buildFactionRankings(): ClientSceneContentResponse['faction']['rankings'] {
  const rankingEntries = [
    { name: '烬牙', value: 86, note: '魔界' },
    { name: '玄潮', value: 72, note: '魔界' },
    { name: '云栖', value: 65, note: '仙界' },
    { name: '你', value: playerState.factionContribution, note: playerState.factionName },
  ].sort((left, right) => right.value - left.value);

  return rankingEntries.map((entry, index) => ({
    label: `${index + 1}. ${entry.name}`,
    value: formatNumber(entry.value),
    note: entry.note,
  }));
}

function getPendingClaimAmount(source: ClientPendingClaimSource): number {
  if (source === 'tax') {
    return playerState.ledger.taxPendingGold;
  }

  if (source === 'faction') {
    return playerState.ledger.factionDividendGold;
  }

  settleTemporaryRaidClaim();
  return playerState.temporaryRaidClaim?.goldAmount ?? 0;
}

function setPendingClaimAmount(source: ClientPendingClaimSource, value: number): void {
  if (source === 'tax') {
    playerState.ledger.taxPendingGold = value;
    return;
  }

  if (source === 'faction') {
    playerState.ledger.factionDividendGold = value;
    return;
  }

  if (value <= 0) {
    playerState.temporaryRaidClaim = null;
    return;
  }

  playerState.temporaryRaidClaim = {
    goldAmount: value,
    expiresAt: playerState.temporaryRaidClaim?.expiresAt ?? new Date(Date.now() + GAME_BALANCE.raid.temporaryClaimMinutes * 60 * 1000).toISOString(),
  };
}

function settleTemporaryRaidClaim(): void {
  if (!playerState.temporaryRaidClaim) {
    return;
  }

  if (Date.now() >= new Date(playerState.temporaryRaidClaim.expiresAt).getTime()) {
    playerState.temporaryRaidClaim = null;
  }
}

function addTemporaryRaidClaim(goldAmount: number): string {
  const expiresAt = new Date(Date.now() + GAME_BALANCE.raid.temporaryClaimMinutes * 60 * 1000).toISOString();

  if (goldAmount <= 0) {
    return expiresAt;
  }

  settleTemporaryRaidClaim();
  playerState.temporaryRaidClaim = {
    goldAmount: (playerState.temporaryRaidClaim?.goldAmount ?? 0) + goldAmount,
    expiresAt,
  };

  return expiresAt;
}

function getQueuedArmyCount(): number {
  return playerState.armyTrainingQueue?.queuedUnits ?? 0;
}

function settleArmyTrainingQueue(): void {
  const queue = playerState.armyTrainingQueue;

  if (!queue) {
    return;
  }

  if (Date.now() < new Date(queue.readyAt).getTime()) {
    return;
  }

  playerState.armyCount = Math.min(playerState.armyCount + queue.queuedUnits, playerState.armyCapacity);
  playerState.armyTrainingQueue = null;
}

function buildArmyTrainingQueue(): ClientArmyTrainingQueue | null {
  const queue = playerState.armyTrainingQueue;

  if (!queue) {
    return null;
  }

  return {
    ...queue,
    remainingSeconds: Math.max(Math.ceil((new Date(queue.readyAt).getTime() - Date.now()) / 1000), 0),
  };
}

export function buildHomeSummary(): HomeSummaryResponse {
  settleArmyTrainingQueue();
  settleTemporaryRaidClaim();

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
    protectedUntil: null,
    resources: [
      {
        label: '金币',
        value: `${formatNumber(ledger.vaultGold)} / ${formatNumber(ledger.vaultCapacity)}`,
        tone: 'vault',
      },
      {
        label: '战力',
        value: `${formatNumber(playerState.armyCount)} / ${formatNumber(playerState.armyCapacity)}`,
        tone: 'army',
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
    temporaryClaim: playerState.temporaryRaidClaim
      ? {
          source: 'raid-overflow',
          label: '待领取',
          goldAmount: playerState.temporaryRaidClaim.goldAmount,
          expiresAt: playerState.temporaryRaidClaim.expiresAt,
          description: '掠夺时金库已满，超出的金币会临时保留在这里，过期后消失。',
        }
      : null,
    primaryActions: [
      { key: 'building', title: '主城', description: '升级主城与金币容量' },
      { key: 'farm', title: '农场', description: '收成熟田地' },
      { key: 'raid', title: '部队', description: '征召兵力并查看训练队列' },
      { key: 'report', title: '掠夺', description: '查看目标、战报与通缉令' },
      { key: 'faction', title: '阵营', description: '上缴并查看分红' },
    ],
  };
}

function buildRaidDetailActions(): ClientSceneAction[] {
  return [
    { label: '发起掠夺', target: 'report', tone: 'primary' },
    { label: '发布通缉令', target: 'report', tone: 'secondary' },
    { label: '邀请摇人', target: 'report', tone: 'ghost' },
    { label: '分享目标', target: 'report', tone: 'ghost' },
  ];
}

function buildRaidDetailField(field: FieldState): ClientRaidTargetDetailResponse['fields'][number] {
  const farmField = buildFarmField(field);

  return {
    ...farmField,
    actions: [],
  };
}

export function buildRaidTargetDetail(targetId: string): ClientRaidTargetDetailResponse {

  settleArmyTrainingQueue();

  const target = playerState.raidTargets.find((item) => item.id === targetId);

  if (!target) {
    return {
      app: APP_NAME,
      targetId,
      name: '碎星',
      faction: '人界',
      level: 4,
      combatPower: '880',
      fieldPreviewTone: 'seeded',
      fieldStatus: '播种田 2 块，空闲田 1 块',
      fields: [
        buildRaidDetailField({ id: `${targetId}-field-1`, code: '田地 01', unlocked: true, status: 'seeded', plantedGold: 80, currentYield: 80, badgeText: '播种' }),
        buildRaidDetailField({ id: `${targetId}-field-2`, code: '田地 02', unlocked: true, status: 'seeded', plantedGold: 90, currentYield: 90, badgeText: '播种' }),
        buildRaidDetailField({ id: `${targetId}-field-3`, code: '田地 03', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' }),
        buildRaidDetailField({ id: `${targetId}-field-4`, code: '田地 04', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' }),
      ],
      raidableGold: '120 金币',
      exposedFruit: '成熟收益较低 · 预计 120 金币',
      raidRule: '按当前金币的一部分结算，本次预计命中 120 金币',
      defenseStatus: '防守一般，当前暴露值较低',
      protectionStatus: '当前不在可攻击目标池中',
      detail: '该目标当前不可用，可能正处于保护中或已从目标池移除。',
      actions: [{ label: '返回掠夺页', target: 'report', tone: 'ghost' }],
    };
  }

  return {
    app: APP_NAME,
    targetId,
    name: target.name,
    faction: target.faction,
    level: target.level,
    combatPower: formatNumber(target.combatPower),
    fieldPreviewTone: target.fieldPreviewTone,
    fieldStatus: target.fieldStatus,
    fields: target.fields.map((field) => buildRaidDetailField(field)),
    raidableGold: `${formatNumber(target.raidableGold)} 金币`,
    exposedFruit: target.exposedFruit,
    raidRule: '当前采用黑盒结算：低兵力也能直接掠夺，但收益更低、战损更高，仍有概率带回高级种子。',
    defenseStatus: target.defenseStatus,
    protectionStatus: formatProtectionStatus(target),
    detail: target.detail,
    actions: isTargetProtected(target) ? [{ label: '保护中', target: 'raid', tone: 'ghost' }] : buildRaidDetailActions(),
  };
}

function buildUpgradeAction(label: string, tone: 'primary' | 'secondary' | 'ghost'): ClientSceneAction {
  return { label, target: 'building', tone };
}

function getUpgradeCost(buildingId: ClientBuildingUpgradeId): number | null {
  return getBuildingUpgradeCost(buildingId, playerState.buildingLevels[buildingId]);
}

function buildBuildingUpgrades(): ClientSceneContentResponse['building']['upgrades'] {
  const castleLevel = playerState.buildingLevels.castle;
  const vaultLevel = playerState.buildingLevels.vault;
  const fieldSlotLevel = playerState.buildingLevels['field-slot'];
  const populationLevel = playerState.buildingLevels.population;
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
      description: `Lv.${vaultLevel} -> Lv.${vaultLevel + 1}，容量由 ${formatNumber(playerState.ledger.vaultCapacity)} 提升到 ${formatNumber(playerState.ledger.vaultCapacity + getVaultCapacityGain(vaultLevel))}。`,
      costText: getUpgradeCost('vault') ? `消耗 ${formatNumber(getUpgradeCost('vault') ?? 0)} 金币` : '已达到验证上限',
      action: buildUpgradeAction(getUpgradeCost('vault') ? '升级金币上限' : '查看条件', getUpgradeCost('vault') ? 'secondary' : 'ghost'),
      locked: !getUpgradeCost('vault'),
    },
    {
      id: 'field-slot',
      title: '田地',
      description: lockedFieldExists
        ? `Lv.${fieldSlotLevel} -> Lv.${fieldSlotLevel + 1}，新增第 3 个培育位。`
        : `Lv.${fieldSlotLevel}，当前验证版田地位已全部解锁。`,
      costText: lockedFieldExists && getUpgradeCost('field-slot') ? `消耗 ${formatNumber(getUpgradeCost('field-slot') ?? 0)} 金币` : '当前已全部解锁',
      action: buildUpgradeAction(lockedFieldExists && getUpgradeCost('field-slot') ? '升级田地位' : '查看条件', lockedFieldExists && getUpgradeCost('field-slot') ? 'secondary' : 'ghost'),
      locked: !lockedFieldExists || !getUpgradeCost('field-slot'),
    },
    {
      id: 'population',
      title: '人口',
      description: `Lv.${populationLevel} -> Lv.${populationLevel + 1}，人口上限由 ${formatNumber(playerState.armyCapacity)} 提升到 ${formatNumber(playerState.armyCapacity + getPopulationCapacityGain(populationLevel))}。`,
      costText: getUpgradeCost('population') ? `消耗 ${formatNumber(getUpgradeCost('population') ?? 0)} 金币` : '已达到验证上限',
      action: buildUpgradeAction(getUpgradeCost('population') ? '升级人口上限' : '查看条件', getUpgradeCost('population') ? 'secondary' : 'ghost'),
      locked: !getUpgradeCost('population'),
    },
    {
      id: 'watchtower',
      title: '防守',
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
    title: `丰熟 ${counts.mature} 块 · 成熟中 ${counts.growing} 块`,
    description: emptyUnlockedField
      ? '农场以田地为主，点击空地即可继续播种，进入丰熟后直接收取。'
      : '农场地块已排满，可直接收取丰熟地块或解锁新田位。',
    action: emptyUnlockedField
      ? { label: '开始培育', target: 'farm', tone: 'primary' }
      : { label: '解锁田地', target: 'farm', tone: 'secondary' },
  };
}

function buildFarmField(field: FieldState): ClientSceneContentResponse['farm']['fields'][number] {
  const cropName = field.plantedSeedId ? (seedLabelMap[field.plantedSeedId] ?? field.plantedSeedId) : undefined;

  if (!field.unlocked) {
    return {
      id: field.id,
      code: field.code,
      title: '未解锁',
      badge: '待解锁',
      cropName: undefined,
      tone: 'locked',
      progressRemainingSeconds: 0,
      progressTotalSeconds: 1,
      yieldGold: 0,
      description: '点击中央入口，直接升级并开放这块田地。',
      actions: [{ label: '解锁田地', target: 'farm', tone: 'secondary' }],
    };
  }

  if (field.status === 'mature') {
    return {
      id: field.id,
      code: field.code,
      title: '丰熟期',
      badge: field.badgeText,
      cropName,
      tone: 'mature',
      progressRemainingSeconds: 0,
      progressTotalSeconds: 1,
      yieldGold: field.currentYield,
      description: '点击收取，触发爆金币并结算本轮成熟收益。',
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
      cropName,
      tone: 'withered',
      progressRemainingSeconds: 0,
      progressTotalSeconds: 1,
      yieldGold: field.currentYield,
      description: '点击收取，收益已进入衰减段，但仍能爆出金币和种子。',
      actions: [
        { label: '枯萎收取', target: 'farm', tone: 'secondary' },
      ],
    };
  }

  if (field.status === 'growing') {
    return {
      id: field.id,
      code: field.code,
      title: '成熟期',
      badge: field.badgeText,
      cropName,
      tone: 'growing',
      progressRemainingSeconds: 4690,
      progressTotalSeconds: GAME_BALANCE.farm.progressSeconds.growing,
      yieldGold: field.currentYield,
      description: '可抢收，点击后直接结算一轮提前收取结果。',
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
      cropName,
      tone: 'seeded',
      progressRemainingSeconds: 2535,
      progressTotalSeconds: GAME_BALANCE.farm.progressSeconds.seeded,
      yieldGold: field.currentYield,
      description: '播种刚完成，等待进入成长后再决定是否抢收。',
      actions: [],
    };
  }

  return {
    id: field.id,
    code: field.code,
    title: '可培育',
    badge: '空闲地块',
    cropName: undefined,
    tone: 'empty',
    progressRemainingSeconds: 0,
    progressTotalSeconds: 1,
    yieldGold: 0,
    description: '点击中央入口，选择种子后立刻开始新一轮培育。',
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

function buildCollectFieldResponse(summary: string, collectedGold: number, overflowGold: number, rewards: ClientCollectRewardItem[]): ClientCollectFieldResponse {
  return {
    app: APP_NAME,
    summary,
    home: buildHomeSummary(),
    scenes: buildSceneContent(),
    result: {
      collectedGold,
      overflowGold,
      rewards,
    },
  };
}

function buildFieldRewards(field: FieldState, collectMode: ClientCollectFieldRequest['collectMode']): ClientCollectRewardItem[] {
  if (collectMode !== 'ripe') {
    return [];
  }

  if (field.status === 'withered' || field.status === 'seeded') {
    return [];
  }

  const seedId = field.plantedSeedId;
  if (!seedId) {
    return [];
  }

  const label = seedLabelMap[seedId] ?? seedId;
  const quantity = field.status === 'mature' ? 1 : 0;
  return quantity > 0 ? [{ seedId, label, quantity }] : [];
}

export function buildSceneContent(): ClientSceneContentResponse {
  settleArmyTrainingQueue();

  const factionDividend = getFactionDividendPerHour();
  const visibleRaidTargets = playerState.raidTargets.filter((target) => !isTargetProtected(target));

  return {
    app: APP_NAME,
    building: {
      upgrades: buildBuildingUpgrades(),
    },
    army: {
      unitCostGold: GAME_BALANCE.army.recruitGoldCostPerUnit,
      unitTrainingSeconds: GAME_BALANCE.army.recruitSecondsPerUnit,
      queue: buildArmyTrainingQueue(),
    },
    farm: {
      hero: buildFarmHero(),
      fields: playerState.fields.map((field) => buildFarmField(field)),
      guide: {
        title: '农场线引导',
        description: '农场页已经接入真实产出链路，成熟收取和开始培育都会直接改写内存态与首页资源。',
        actions: [
          { label: '打开主城页', target: 'building', tone: 'secondary' },
          { label: '返回首页', target: 'home', tone: 'ghost' },
        ],
      },
    },
    raid: {
      hero: {
        eyebrow: '可掠夺目标',
        title: `剩余免费掠夺 ${getRemainingRaidCount()} / 3`,
        description: visibleRaidTargets.length > 0 ? '进入页面后先看目标列表，重点判断等级、阵营和当前值不值得出手。' : '当前目标都处于防护中，稍后刷新或等待保护结束。',
        action: { label: '刷新目标', target: 'raid', tone: 'secondary' },
      },
      targets: visibleRaidTargets.map((target, index) => ({
        id: target.id,
        name: target.name,
        faction: target.faction,
        level: target.level,
        combatPower: formatNumber(target.combatPower),
        summary: target.summary,
        loot: `${formatNumber(Math.round(target.raidableGold * 0.35))}~${formatNumber(target.raidableGold)} 金币`,
        risk: target.risk,
        detail: target.detail,
        action: { label: '发起掠夺', target: 'raid', tone: index === 0 ? 'primary' : 'secondary' },
      })),
      detail: {
        advice: '出征建议：派出 90~110 掠夺兵',
        actions: [
          { label: '更换兵力', target: 'raid', tone: 'ghost' },
          { label: '确认出兵', target: 'raid', tone: 'primary' },
        ],
      },
    },
    report: {
      defense: playerState.defenseReports,
      attack: playerState.attackReports,
      actions: [],
    },
    faction: {
      hero: {
        eyebrow: '阵营面板',
        title: `${playerState.factionName}阵营`,
        description: `当前每小时分红 ${formatNumber(factionDividend.total)}，先上缴再领取会更划算。`,
        advantage: getFactionAdvantageText(),
        breakdown: `金额构成：基础分红 ${formatNumber(factionDividend.base)} + 贡献加成 ${formatNumber(factionDividend.bonus)}`,
        action: { label: '领取分红', target: 'faction', tone: 'primary' },
      },
      contribution: {
        title: '当前贡献值',
        value: formatNumber(playerState.factionContribution),
        description: '100 金币 = 1 贡献。捐献后会立刻反馈到贡献值与分红构成。',
      },
      comparison: buildFactionComparison(),
      donate: {
        title: '捐献金币',
        description: '金币按 100 为一步，确认后会立即从当前总金币扣除。',
        goldStep: 100,
        contributionRule: '100 金币 = 1 贡献。',
      },
      rankings: buildFactionRankings(),
    },
  };
}

function buildRaidActionResponse(summary: string, target: RaidTargetState | null, goldLoot: number, depositedGold: number, overflowGold: number, temporaryClaimExpiresAt: string | null, casualties: number, rewards: ClientRaidRewardItem[], reportSummary: string): ClientRaidActionResponse {
  return {
    app: APP_NAME,
    summary,
    home: buildHomeSummary(),
    scenes: buildSceneContent(),
    result: {
      targetId: target?.id ?? '',
      targetName: target?.name ?? '未知目标',
      goldLoot,
      depositedGold,
      overflowGold,
      temporaryClaimExpiresAt,
      casualties,
      rewards,
      protectedUntil: target?.protectionUntil ?? new Date().toISOString(),
      reportSummary,
    },
  };
}

export function raidTarget(input: ClientRaidActionRequest): ClientRaidActionResponse {
  settleArmyTrainingQueue();
  settleTemporaryRaidClaim();

  const target = playerState.raidTargets.find((item) => item.id === input.targetId);
  const defenseReportTitle = target ? `${target.faction} · ${target.name}` : '';
  const defenseReport = playerState.defenseReports.find((entry) => entry.title === defenseReportTitle);

  if (!target) {
    return buildRaidActionResponse('当前目标不存在或已离开目标池。', null, 0, 0, 0, null, 0, [], '当前目标不存在或已离开目标池。');
  }

  if (input.mode === 'revenge' && !defenseReport?.revengeable) {
    return buildRaidActionResponse(`${target.name} 的复仇机会已经用完。`, target, 0, 0, 0, null, 0, [], `${target.name} 的这条战报已经完成复仇，当前不能再次复仇。`);
  }

  if (isTargetProtected(target)) {
    return buildRaidActionResponse(`${target.name} 当前处于防护中，暂时无法再次被掠夺。`, target, 0, 0, 0, null, 0, [], `${target.name} 仍在防护期内，本次未能发起掠夺。`);
  }

  if (playerState.armyCount <= 0) {
    return buildRaidActionResponse('当前兵力不足，无法发起掠夺。', target, 0, 0, 0, null, 0, [], '当前兵力不足，未能发起掠夺。');
  }

  const currentArmy = Math.max(playerState.armyCount, 1);
  const powerRatio = currentArmy / target.combatPower;

  // 黑盒规则先只保证三点：低兵力也能打、有明显战损差异、存在高级种子掉落机会。
  const successChance = clamp(0.18 + powerRatio * 0.72, 0.18, 0.88);
  const success = Math.random() < successChance;
  const lootRatio = clamp(0.08 + powerRatio * 0.22 + (success ? 0.08 : 0), 0.05, 0.4);
  const rawGoldLoot = Math.max(Math.round(target.raidableGold * lootRatio), 20);
  const depositedGold = Math.min(rawGoldLoot, Math.max(playerState.ledger.vaultCapacity - playerState.ledger.vaultGold, 0));
  const overflowGold = Math.max(rawGoldLoot - depositedGold, 0);
  const casualtyRatio = clamp(0.1 + (target.combatPower / currentArmy) * 0.04 - (success ? 0.03 : 0), 0.08, 0.42);
  const casualties = Math.min(Math.max(Math.ceil(currentArmy * casualtyRatio), 1), playerState.armyCount);
  const seedChance = clamp(target.seedDrop.chance + (powerRatio < 0.35 ? 0.08 : 0) + (success ? 0.05 : 0), 0.1, 0.55);
  const rewards: ClientRaidRewardItem[] = Math.random() < seedChance
    ? [{ seedId: target.seedDrop.seedId, label: target.seedDrop.label, quantity: target.seedDrop.quantity }]
    : [];
  const now = Date.now();
  target.protectionUntil = new Date(now + 60 * 60 * 1000).toISOString();
  playerState.ledger.vaultGold += depositedGold;
  const temporaryClaimExpiresAt = overflowGold > 0 ? addTemporaryRaidClaim(overflowGold) : null;
  playerState.armyCount = Math.max(playerState.armyCount - casualties, 0);
  playerState.raidTicketsUsed += 1;
  applySeedRewards(rewards);

  const rewardSummary = rewards.length > 0 ? `，额外获得 ${rewards.map((reward) => `${reward.label} x${reward.quantity}`).join('、')}` : '';
  const overflowSummary = overflowGold > 0 ? `，另有 ${formatNumber(overflowGold)} 金币已转入待领取` : '';
  const reportSummary = `你对${target.name}发起黑盒掠夺，带回 ${formatNumber(rawGoldLoot)} 金币，其中 ${formatNumber(depositedGold)} 已入库${overflowSummary}，战损 ${formatNumber(casualties)} 兵${rewardSummary}。`;
  playerState.attackReports.unshift({
    title: `${target.faction} · ${target.name}`,
    tag: success ? '掠夺成功' : '强袭试探',
    tone: success ? 'success' : 'neutral',
    createdAt: new Date(now).toISOString(),
    summary: `${reportSummary} 目标已进入 1 小时防护。`,
    actions: [{ label: '查看详情', target: 'report', tone: 'ghost' }],
  });
  playerState.attackReports = playerState.attackReports.slice(0, 6);

  if (input.mode === 'revenge' && defenseReport) {
    const wasUnread = defenseReport.unread;
    defenseReport.tag = '已复仇';
    defenseReport.unread = false;
    defenseReport.revengeable = false;
    defenseReport.summary = '已完成复仇，目标进入防护中。';
    defenseReport.actions = [{ label: '查看详情', target: 'report', tone: 'ghost' }];
    if (wasUnread) {
      playerState.unreadReports = Math.max(playerState.unreadReports - 1, 0);
    }
    playerState.revengeCount = Math.max(playerState.revengeCount - 1, 0);
  }

  const summary = overflowGold > 0
    ? `${target.name} 已进入 1 小时防护，本次掠夺 ${formatNumber(rawGoldLoot)} 金币，其中 ${formatNumber(depositedGold)} 已入库，另有 ${formatNumber(overflowGold)} 转入待领取，战损 ${formatNumber(casualties)} 兵${rewardSummary}。`
    : `${target.name} 已进入 1 小时防护，本次获得 ${formatNumber(rawGoldLoot)} 金币，战损 ${formatNumber(casualties)} 兵${rewardSummary}。`;
  return buildRaidActionResponse(summary, target, rawGoldLoot, depositedGold, overflowGold, temporaryClaimExpiresAt, casualties, rewards, reportSummary);
}

export function claimPendingGold(input: ClientClaimPendingRequest): Omit<ClientClaimPendingResponse, 'home' | 'scenes'> {
  settleTemporaryRaidClaim();
  const availableVaultSpace = Math.max(playerState.ledger.vaultCapacity - playerState.ledger.vaultGold, 0);
  const pendingGold = getPendingClaimAmount(input.source);
  const claimedGold = Math.min(pendingGold, availableVaultSpace);

  playerState.ledger.vaultGold += claimedGold;
  setPendingClaimAmount(input.source, Math.max(pendingGold - claimedGold, 0));

  const remainingPendingGold = getPendingClaimAmount(input.source);
  const sourceLabel = input.source === 'tax' ? '主城税收' : input.source === 'faction' ? '阵营分红' : '临时待领取';
  const summary = claimedGold > 0
    ? `${sourceLabel}本次入账 ${formatNumber(claimedGold)} 金币，剩余待领取 ${formatNumber(remainingPendingGold)}。`
    : `金币空间不足，当前没有可入账的${sourceLabel}。`;

  return {
    app: APP_NAME,
    summary,
    source: input.source,
    claimedGold,
    remainingPendingGold,
    ledger: { ...playerState.ledger },
  };
}

export function donateFactionSupport(input: ClientFactionDonateRequest): ClientStateMutationResponse {
  const normalizedGoldAmount = Math.max(Math.floor(input.goldAmount / 100) * 100, 0);
  const actualGoldAmount = Math.min(normalizedGoldAmount, Math.floor(playerState.ledger.vaultGold / 100) * 100);

  if (actualGoldAmount <= 0) {
    return buildMutationResponse('请先选择要捐出的金币。');
  }

  const contributionGain = actualGoldAmount / 100;
  playerState.ledger.vaultGold -= actualGoldAmount;
  playerState.factionContribution += contributionGain;
  playerState.factionTreasuryGold += actualGoldAmount;

  return buildMutationResponse(`已向阵营捐出 ${formatNumber(actualGoldAmount)} 金币，贡献值 +${formatNumber(contributionGain)}。`);
}

export function collectFieldGold(input: ClientCollectFieldRequest): ClientCollectFieldResponse {
  const field = playerState.fields.find((item) => item.id === input.fieldId);

  if (!field || !field.unlocked) {
    return buildCollectFieldResponse('当前地块不可操作，请先解锁对应田地位。', 0, 0, []);
  }

  if (input.collectMode === 'ripe' && field.status !== 'mature' && field.status !== 'withered') {
    return buildCollectFieldResponse('这块地当前不在成熟收取阶段。', 0, 0, []);
  }

  if (input.collectMode === 'early' && field.status !== 'growing') {
    return buildCollectFieldResponse('这块地当前不支持提前收取。', 0, 0, []);
  }

  const availableVaultSpace = Math.max(playerState.ledger.vaultCapacity - playerState.ledger.vaultGold, 0);
  const depositedGold = Math.min(field.currentYield, availableVaultSpace);
  const overflowGold = Math.max(field.currentYield - depositedGold, 0);
  const rewards = buildFieldRewards(field, input.collectMode);

  playerState.ledger.vaultGold += depositedGold;
  applySeedRewards(rewards);
  field.status = 'empty';
  field.plantedSeedId = undefined;
  field.plantedGold = 0;
  field.currentYield = 0;
  field.badgeText = '空闲地块';

  const rewardSummary = rewards.length > 0 ? `，并获得 ${rewards.map((reward) => `${reward.label} x${reward.quantity}`).join('、')}` : '';
  const summary = overflowGold > 0
    ? `${field.code} 已收取 ${formatNumber(depositedGold)} 金币，另有 ${formatNumber(overflowGold)} 因金币已满未能入账${rewardSummary}。`
    : `${field.code} 已收取 ${formatNumber(depositedGold)} 金币${rewardSummary}，可以立即再投入新一轮培育。`;

  return buildCollectFieldResponse(summary, depositedGold, overflowGold, rewards);
}

export function startCultivation(input: ClientStartCultivationRequest): ClientStateMutationResponse {
  const field = playerState.fields.find((item) => item.id === input.fieldId);
  const cultivationCost = GAME_BALANCE.farm.defaultCultivationCost;

  if (!field || !field.unlocked) {
    return buildMutationResponse('当前地块尚未解锁，无法开始培育。');
  }

  if (field.status !== 'empty') {
    return buildMutationResponse('当前地块已经在培育中或可直接收取。');
  }

  if (playerState.ledger.vaultGold < cultivationCost) {
    return buildMutationResponse('金币不足，无法开始本轮培育。');
  }

  if (!playerState.unlockedSeedIds.includes(input.seedId)) {
    return buildMutationResponse('当前种子尚未解锁，无法开始本轮培育。');
  }

  if ((playerState.seedInventory[input.seedId] ?? 0) <= 0) {
    return buildMutationResponse('当前种子库存不足，无法开始本轮培育。');
  }

  playerState.ledger.vaultGold -= cultivationCost;
  playerState.seedInventory[input.seedId] = Math.max((playerState.seedInventory[input.seedId] ?? 0) - 1, 0);
  field.status = 'seeded';
  field.plantedSeedId = input.seedId;
  field.plantedGold = cultivationCost;
  field.currentYield = GAME_BALANCE.farm.defaultCultivationYield;
  field.badgeText = '播种';

  return buildMutationResponse(`${field.code} 已投入 ${formatNumber(cultivationCost)} 金币，播下 ${seedLabelMap[input.seedId] ?? input.seedId}，开始新一轮培育。`);
}

export function claimStarterSeeds(): ClientStateMutationResponse {
  if (playerState.starterSeedClaimed) {
    return buildMutationResponse('今日种子已经领取过了。');
  }

  playerState.starterSeedClaimed = true;
  applySeedRewards([{ seedId: 'lingmai', quantity: 3 }]);

  return buildMutationResponse('今日种子已领取，获得 灵麦 x3。');
}

export function recruitArmy(input: ClientRecruitArmyRequest): ClientStateMutationResponse {
  settleArmyTrainingQueue();

  const requestedCount = Math.max(Math.floor(input.recruitCount), 0);
  const availableArmySpace = Math.max(playerState.armyCapacity - playerState.armyCount - getQueuedArmyCount(), 0);

  if (requestedCount <= 0) {
    return buildMutationResponse('请输入有效的造兵数量。');
  }

  if (availableArmySpace <= 0) {
    return buildMutationResponse('当前战力已满，请先扩充上限后再继续造兵。');
  }

  const affordableCount = Math.floor(playerState.ledger.vaultGold / GAME_BALANCE.army.recruitGoldCostPerUnit);
  if (affordableCount <= 0) {
    return buildMutationResponse('金币不足，当前无法开始造兵。');
  }

  const actualRecruitCount = Math.min(requestedCount, availableArmySpace, affordableCount);
  const totalCost = actualRecruitCount * GAME_BALANCE.army.recruitGoldCostPerUnit;
  const now = Date.now();
  const currentQueue = playerState.armyTrainingQueue;
  const remainingSeconds = currentQueue
    ? Math.max(Math.ceil((new Date(currentQueue.readyAt).getTime() - now) / 1000), 0)
    : 0;
  const nextTotalSeconds = remainingSeconds + actualRecruitCount * GAME_BALANCE.army.recruitSecondsPerUnit;

  playerState.ledger.vaultGold -= totalCost;
  playerState.armyTrainingQueue = {
    queuedUnits: (currentQueue?.queuedUnits ?? 0) + actualRecruitCount,
    totalCost: (currentQueue?.totalCost ?? 0) + totalCost,
    startedAt: new Date(now).toISOString(),
    readyAt: new Date(now + nextTotalSeconds * 1000).toISOString(),
    totalSeconds: nextTotalSeconds,
  };

  const summary = actualRecruitCount < requestedCount
    ? `本次新增 ${formatNumber(actualRecruitCount)} 名士兵进入训练队列，已立即扣除 ${formatNumber(totalCost)} 金币；其余部分受金币或兵力上限限制。`
    : currentQueue
      ? `已追加 ${formatNumber(actualRecruitCount)} 名士兵到当前训练队列，金币已立即扣除，剩余训练时间已重算。`
      : `已开始训练 ${formatNumber(actualRecruitCount)} 名士兵，金币已立即扣除，倒计时结束后才会增加战力。`;

  return buildMutationResponse(summary);
}

export function upgradeBuilding(input: ClientUpgradeBuildingRequest): ClientStateMutationResponse {
  const cost = getUpgradeCost(input.buildingId);

  if (!cost) {
    return buildMutationResponse('当前建筑不满足升级条件，或已达到验证上限。');
  }

  if (playerState.ledger.vaultGold < cost) {
    return buildMutationResponse('金币不足，当前无法完成升级。');
  }

  playerState.ledger.vaultGold -= cost;

  if (input.buildingId === 'castle') {
    playerState.buildingLevels.castle += 1;
    return buildMutationResponse(`主城升级完成，当前已升至 Lv.${playerState.buildingLevels.castle}。`);
  }

  if (input.buildingId === 'vault') {
    playerState.buildingLevels.vault += 1;
    playerState.ledger.vaultCapacity += getVaultCapacityGain(playerState.buildingLevels.vault - 1);
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

  if (input.buildingId === 'population') {
    playerState.buildingLevels.population += 1;
    playerState.armyCapacity += getPopulationCapacityGain(playerState.buildingLevels.population - 1);
    return buildMutationResponse(`人口上限升级完成，当前人口上限已提升到 ${formatNumber(playerState.armyCapacity)}。`);
  }

  playerState.buildingLevels.watchtower += 1;
  return buildMutationResponse(`防守建筑升级完成，当前已升至 Lv.${playerState.buildingLevels.watchtower}。`);
}

export function resetDemoState(): ClientResetDemoStateResponse {
  const nextState = clonePlayerState(initialPlayerState);

  playerState.playerName = nextState.playerName;
  playerState.factionName = nextState.factionName;
  playerState.seedInventory = nextState.seedInventory;
  playerState.unlockedSeedIds = nextState.unlockedSeedIds;
  playerState.starterSeedClaimed = nextState.starterSeedClaimed;
  playerState.buildingLevels = nextState.buildingLevels;
  playerState.armyCount = nextState.armyCount;
  playerState.armyCapacity = nextState.armyCapacity;
  playerState.raidTicketsUsed = nextState.raidTicketsUsed;
  playerState.unreadReports = nextState.unreadReports;
  playerState.revengeCount = nextState.revengeCount;
  playerState.factionContribution = nextState.factionContribution;
  playerState.factionTreasuryGold = nextState.factionTreasuryGold;
  playerState.factionArmyPower = nextState.factionArmyPower;
  playerState.armyTrainingQueue = nextState.armyTrainingQueue;
  playerState.ledger = nextState.ledger;
  playerState.fields = nextState.fields;
  playerState.raidTargets = nextState.raidTargets;
  playerState.defenseReports = nextState.defenseReports;
  playerState.attackReports = nextState.attackReports;

  return {
    app: APP_NAME,
    summary: '实验数据已重置到初始状态，可以重新验证领取、收取和升级链路。',
    home: buildHomeSummary(),
    scenes: buildSceneContent(),
  };
}

