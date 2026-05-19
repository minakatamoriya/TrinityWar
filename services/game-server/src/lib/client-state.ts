import {
  APP_NAME,
  type ClientArmyTrainingQueue,
  type ClientBootstrapResponse,
  type ClientCastleExtensionUpgrade,
  type ClientCastleExtensionUpgradeId,
  type ClientClaimDailyTaskRequest,
  type ClientClaimDailyTaskResponse,
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
  type ClientSceneKey,
  type ClientSceneAction,
  type ClientSceneContentResponse,
  type ClientResourceLedger,
  type ClientStartCultivationRequest,
  type ClientStateMutationResponse,
  type ClientUpgradeBuildingRequest,
  type HomeSummaryResponse,
} from '@trinitywar/shared';
import {
  DAILY_TASK_CONFIG,
  GAME_BALANCE,
  getCastleExtensionLevelConfig,
  getCastleExtensionTrack,
  getBuildingUpgradeCost,
  getDailyTaskDefinition,
  getFactionDividendPerHour as getConfiguredFactionDividendPerHour,
  getPopulationLevelConfig,
  getPopulationCapacityGain,
  getSeedStageGold,
  getSeedStageSeconds,
  getTaxIncomePerHour as getConfiguredTaxIncomePerHour,
  getVaultCapacityGain,
} from './game-balance.js';

interface FieldState {
  id: string;
  code: string;
  unlocked: boolean;
  status: 'empty' | 'seeded' | 'growing' | 'mature' | 'withered';
  statusStartedAt?: string;
  plantedSeedId?: string;
  plantedGold: number;
  currentYield: number;
  badgeText: string;
}

const seedLabelMap: Record<string, string> = {
  qinglingmai: '青灵麦',
  ninglucao: '凝露草',
  suixinhua: '碎心花',
  baiyulian: '白玉莲',
  yingyuezhu: '影月竹',
  qianjiteng: '牵机藤',
  huichuncao: '回春草',
  xueyuehua: '雪月花',
  jingdaosong: '劲道松',
  hundunguo: '混沌果',
  zhanqingsi: '斩情丝',
  wangchuanying: '忘川影',
  zhaoyouming: '照幽冥',
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

interface DailyTaskProgressState {
  taskId: string;
  progress: number;
  claimed: boolean;
}

interface InMemoryPlayerState {
  playerName: string;
  factionName: string;
  seedInventory: Record<string, number>;
  globalItemInventory: Record<string, number>;
  unlockedSeedIds: string[];
  starterSeedClaimed: boolean;
  tianjiTalismanClaimed: boolean;
  buildingLevels: Record<ClientBuildingUpgradeId, number>;
  castleExtensionLevels: Record<ClientCastleExtensionUpgradeId, number>;
  buildingVersion: number;
  walletVersion: number;
  armyVersion: number;
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
  dailyTaskState: {
    dateKey: string;
    tasks: DailyTaskProgressState[];
  };
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
    globalItemInventory: { ...playerState.globalItemInventory },
    unlockedSeedIds: [...playerState.unlockedSeedIds],
    starterSeedClaimed: playerState.starterSeedClaimed,
    tianjiTalismanClaimed: playerState.tianjiTalismanClaimed,
  };
}

const CASTLE_FIELD_UNLOCK_MILESTONES = [1, 5, 10, 15];
const DAILY_TASK_SCENE_MAP: Record<string, ClientSceneKey> = {
  'collect-field': 'farm',
  'start-cultivation': 'farm',
  'faction-interaction': 'faction',
  'faction-donate': 'faction',
  'recruit-army': 'raid',
  'upgrade-building': 'building',
  'upgrade-core-line': 'building',
  'upgrade-core-building': 'building',
  'farm-cycle': 'farm',
};

function getUnlockedFieldCountByCastleLevel(castleLevel: number): number {
  return CASTLE_FIELD_UNLOCK_MILESTONES.filter((requiredLevel) => castleLevel >= requiredLevel).length;
}

function getNextFieldUnlockRequirement(castleLevel: number): number | null {
  return CASTLE_FIELD_UNLOCK_MILESTONES.find((requiredLevel) => castleLevel < requiredLevel) ?? null;
}

function getFieldUnlockRequirement(fieldId: string): number | null {
  const fieldIndex = playerState.fields.findIndex((field) => field.id === fieldId);
  if (fieldIndex < 0) {
    return null;
  }

  return CASTLE_FIELD_UNLOCK_MILESTONES[fieldIndex] ?? null;
}

function getCurrentDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDailyTaskGoldReward(taskId: string): number {
  const task = getDailyTaskDefinition(taskId);
  const goldReward = task?.rewards?.find((reward: { type?: string; amount?: number }) => reward.type === 'gold');
  return typeof goldReward?.amount === 'number' ? goldReward.amount : 0;
}

function buildDailyTaskProgressText(current: number, target: number, claimed: boolean): string {
  if (claimed) {
    return '已领取';
  }

  if (current >= target) {
    return '可领取';
  }

  return `${current}/${target}`;
}

function buildDailyTaskSelection(dateKey: string): string[] {
  const fixedTaskIds = DAILY_TASK_CONFIG.fixedTasks
    .slice(0, DAILY_TASK_CONFIG.structure.fixedTaskCount)
    .map((task) => task.id);
  const randomTaskCount = Math.max(DAILY_TASK_CONFIG.structure.randomTaskCount, 0);

  if (randomTaskCount <= 0 || DAILY_TASK_CONFIG.randomTasks.length <= 0) {
    return fixedTaskIds;
  }

  const seed = Array.from(dateKey).reduce((total, char) => total + char.charCodeAt(0), 0);
  const randomTaskIds = Array.from({ length: Math.min(randomTaskCount, DAILY_TASK_CONFIG.randomTasks.length) }, (_, index) => {
    const randomTask = DAILY_TASK_CONFIG.randomTasks[(seed + index) % DAILY_TASK_CONFIG.randomTasks.length];
    return randomTask.id;
  });

  return [...fixedTaskIds, ...randomTaskIds];
}

function ensureDailyTasks(): void {
  const dateKey = getCurrentDateKey();

  if (playerState.dailyTaskState.dateKey === dateKey && playerState.dailyTaskState.tasks.length > 0) {
    return;
  }

  playerState.dailyTaskState = {
    dateKey,
    tasks: buildDailyTaskSelection(dateKey).map((taskId) => ({
      taskId,
      progress: 0,
      claimed: false,
    })),
  };
}

function recordDailyTaskProgress(objectiveType: string, amount = 1): void {
  ensureDailyTasks();

  playerState.dailyTaskState.tasks.forEach((taskState) => {
    const taskDefinition = getDailyTaskDefinition(taskState.taskId);
    if (!taskDefinition || taskState.claimed || taskDefinition.objective.type !== objectiveType) {
      return;
    }

    taskState.progress = Math.min(taskState.progress + amount, taskDefinition.objective.count);
  });
}

function buildDailyTaskSummaries(): HomeSummaryResponse['dailyTasks'] {
  ensureDailyTasks();

  return playerState.dailyTaskState.tasks.map((taskState) => {
    const taskDefinition = getDailyTaskDefinition(taskState.taskId);
    const progressTarget = taskDefinition?.objective.count ?? 1;
    const progressCurrent = Math.min(taskState.progress, progressTarget);
    const status = taskState.claimed
      ? 'claimed'
      : progressCurrent >= progressTarget
        ? 'completed'
        : 'in-progress';
    const actionScene: HomeSummaryResponse['dailyTasks'][number]['actionScene'] = DAILY_TASK_SCENE_MAP[taskDefinition?.objective.type ?? 'collect-field'] ?? 'home';

    return {
      id: taskState.taskId,
      title: taskDefinition?.title ?? taskState.taskId,
      description: `${taskDefinition?.category ?? '日常'}任务，完成后可领取 ${formatNumber(getDailyTaskGoldReward(taskState.taskId))} 金币。`,
      progressCurrent,
      progressTarget,
      progressText: buildDailyTaskProgressText(progressCurrent, progressTarget, taskState.claimed),
      rewardGold: getDailyTaskGoldReward(taskState.taskId),
      status,
      actionScene,
    };
  });
}

function syncUnlockedFieldsWithCastleLevel(): void {
  const targetUnlockedCount = getUnlockedFieldCountByCastleLevel(getCastleLevel());

  playerState.fields.forEach((field, index) => {
    if (index < targetUnlockedCount) {
      field.unlocked = true;
      if (field.status === 'empty' && field.badgeText === '待解锁') {
        field.badgeText = '空闲地块';
      }
    }
  });
}

function getCastleExtensionLevel(extensionId: ClientCastleExtensionUpgradeId): number {
  return playerState.castleExtensionLevels[extensionId] ?? 0;
}

function getCastleExtensionEffectValue(extensionId: ClientCastleExtensionUpgradeId): number {
  const currentLevel = getCastleExtensionLevel(extensionId);

  if (currentLevel <= 0) {
    return 0;
  }

  return getCastleExtensionLevelConfig(extensionId, currentLevel)?.effectValue ?? 0;
}

function formatCastleExtensionEffect(extensionId: ClientCastleExtensionUpgradeId, effectValue: number): string {
  if (extensionId === 'protectionTech') {
    return `被掠保护期 +${formatNumber(effectValue)} 分钟`;
  }

  if (extensionId === 'farmYieldTech') {
    return `田地收益 +${formatNumber(effectValue)}%`;
  }

  if (extensionId === 'ripeWindowTech') {
    return `成熟操作窗口 +${formatNumber(effectValue)} 分钟`;
  }

  return `待领取保留时长 ${formatNumber(effectValue)} 小时`;
}

function buildCastleExtensions(): ClientCastleExtensionUpgrade[] {
  const extensionIds: ClientCastleExtensionUpgradeId[] = ['protectionTech', 'farmYieldTech', 'ripeWindowTech', 'pendingClaimTech'];
  const castleLevel = getCastleLevel();

  return extensionIds.map((extensionId) => {
    const track = getCastleExtensionTrack(extensionId);
    const currentLevel = getCastleExtensionLevel(extensionId);
    const nextLevelConfig = getCastleExtensionLevelConfig(extensionId, currentLevel + 1);
    const currentEffect = getCastleExtensionEffectValue(extensionId);
    const nextEffect = nextLevelConfig?.effectValue ?? currentEffect;
    const locked = Boolean(nextLevelConfig && castleLevel < nextLevelConfig.requiredCastleLevel);

    return {
      id: extensionId,
      title: track?.title ?? extensionId,
      levelText: nextLevelConfig ? `Lv.${currentLevel} -> Lv.${currentLevel + 1}` : `Lv.${currentLevel}（已满级）`,
      description: track?.description ?? '当前未配置说明。',
      effectText: nextLevelConfig
        ? `当前 ${formatCastleExtensionEffect(extensionId, currentEffect)}，升级后 ${formatCastleExtensionEffect(extensionId, nextEffect)}。`
        : `当前已满级：${formatCastleExtensionEffect(extensionId, currentEffect)}。`,
      costText: nextLevelConfig
        ? locked
          ? `需要主城 Lv.${nextLevelConfig.requiredCastleLevel}`
          : `消耗 ${formatNumber(nextLevelConfig.upgradeCost)} 金币`
        : '已达到验证上限',
      action: buildUpgradeAction(nextLevelConfig && !locked ? '升级' : '查看条件', nextLevelConfig && !locked ? 'secondary' : 'ghost'),
      locked: !nextLevelConfig || locked,
    };
  });
}

function getPlayerProtectionDurationMinutes(): number {
  return GAME_BALANCE.raid.protectionHoursAfterRaid * 60 + getCastleExtensionEffectValue('protectionTech');
}

function getFarmYieldMultiplier(): number {
  return 1 + getCastleExtensionEffectValue('farmYieldTech') / 100;
}

function getFarmRipeWindowSeconds(): number {
  return 30 * 60 + getCastleExtensionEffectValue('ripeWindowTech') * 60;
}

function getFieldBadgeText(status: FieldState['status']): string {
  if (status === 'seeded') {
    return '播种';
  }

  if (status === 'growing') {
    return '成长';
  }

  if (status === 'mature') {
    return '丰熟';
  }

  if (status === 'withered') {
    return '枯萎';
  }

  return '空闲地块';
}

function getFieldStageTotalSeconds(field: FieldState, status: FieldState['status'] = field.status): number {
  if (!field.plantedSeedId) {
    return 1;
  }

  if (status === 'seeded' || status === 'growing') {
    return getSeedStageSeconds(field.plantedSeedId, status);
  }

  if (status === 'mature') {
    return getFarmRipeWindowSeconds();
  }

  return 1;
}

function getFallbackFieldRemainingSeconds(field: FieldState): number {
  if (field.status === 'seeded') {
    return 2535;
  }

  if (field.status === 'growing') {
    return 4690;
  }

  if (field.status === 'mature') {
    return Math.min(getFarmRipeWindowSeconds(), 20 * 60);
  }

  return 0;
}

function getFieldStageStartedAtMs(field: FieldState, nowMs: number): number {
  const parsedStartedAt = field.statusStartedAt ? new Date(field.statusStartedAt).getTime() : Number.NaN;

  if (Number.isFinite(parsedStartedAt)) {
    return parsedStartedAt;
  }

  const totalSeconds = getFieldStageTotalSeconds(field);
  const fallbackRemainingSeconds = Math.min(getFallbackFieldRemainingSeconds(field), totalSeconds);
  return nowMs - Math.max(totalSeconds - fallbackRemainingSeconds, 0) * 1000;
}

function setFieldStage(field: FieldState, status: FieldState['status'], startedAtMs: number): void {
  field.status = status;
  field.statusStartedAt = new Date(startedAtMs).toISOString();
  field.badgeText = getFieldBadgeText(status);

  if (!field.plantedSeedId || status === 'empty') {
    field.currentYield = 0;
    return;
  }

  field.currentYield = Math.round(getSeedStageGold(field.plantedSeedId, status) * getFarmYieldMultiplier());
}

function settleFieldLifecycle(field: FieldState, nowMs: number): void {
  if (!field.unlocked || field.status === 'empty' || !field.plantedSeedId) {
    return;
  }

  let startedAtMs = getFieldStageStartedAtMs(field, nowMs);
  field.statusStartedAt = new Date(startedAtMs).toISOString();

  while (true) {
    if (field.status === 'seeded') {
      const seededSeconds = getFieldStageTotalSeconds(field, 'seeded');
      const elapsedSeconds = Math.floor((nowMs - startedAtMs) / 1000);

      if (elapsedSeconds < seededSeconds) {
        field.currentYield = Math.round(getSeedStageGold(field.plantedSeedId, 'seeded') * getFarmYieldMultiplier());
        field.badgeText = getFieldBadgeText('seeded');
        return;
      }

      startedAtMs += seededSeconds * 1000;
      setFieldStage(field, 'growing', startedAtMs);
      continue;
    }

    if (field.status === 'growing') {
      const growingSeconds = getFieldStageTotalSeconds(field, 'growing');
      const elapsedSeconds = Math.floor((nowMs - startedAtMs) / 1000);

      if (elapsedSeconds < growingSeconds) {
        field.currentYield = Math.round(getSeedStageGold(field.plantedSeedId, 'growing') * getFarmYieldMultiplier());
        field.badgeText = getFieldBadgeText('growing');
        return;
      }

      startedAtMs += growingSeconds * 1000;
      setFieldStage(field, 'mature', startedAtMs);
      continue;
    }

    if (field.status === 'mature') {
      const ripeWindowSeconds = getFieldStageTotalSeconds(field, 'mature');
      const elapsedSeconds = Math.floor((nowMs - startedAtMs) / 1000);

      if (elapsedSeconds < ripeWindowSeconds) {
        field.currentYield = Math.round(getSeedStageGold(field.plantedSeedId, 'mature') * getFarmYieldMultiplier());
        field.badgeText = getFieldBadgeText('mature');
        return;
      }

      startedAtMs += ripeWindowSeconds * 1000;
      setFieldStage(field, 'withered', startedAtMs);
      return;
    }

    field.currentYield = Math.round(getSeedStageGold(field.plantedSeedId, 'withered') * getFarmYieldMultiplier());
    field.badgeText = getFieldBadgeText('withered');
    return;
  }
}

function settleAllFieldLifecycles(): void {
  const nowMs = Date.now();
  playerState.fields.forEach((field) => settleFieldLifecycle(field, nowMs));
}

function getFieldStageRemainingSeconds(field: FieldState): number {
  if (field.status !== 'seeded' && field.status !== 'growing' && field.status !== 'mature') {
    return 0;
  }

  const nowMs = Date.now();
  const startedAtMs = getFieldStageStartedAtMs(field, nowMs);
  const totalSeconds = getFieldStageTotalSeconds(field);
  const elapsedSeconds = Math.max(Math.floor((nowMs - startedAtMs) / 1000), 0);
  return Math.max(totalSeconds - elapsedSeconds, 0);
}

function getResolvedFieldYield(field: FieldState): number {
  if (!field.plantedSeedId) {
    return field.currentYield;
  }

  if (field.status === 'empty') {
    return 0;
  }

  return Math.round(getSeedStageGold(field.plantedSeedId, field.status) * getFarmYieldMultiplier());
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
      { id: 'target-1-field-1', code: '田地 01', unlocked: true, status: 'mature', plantedSeedId: 'zhanqingsi', plantedGold: 260, currentYield: 420, badgeText: '丰熟' },
      { id: 'target-1-field-2', code: '田地 02', unlocked: true, status: 'mature', plantedSeedId: 'jingdaosong', plantedGold: 280, currentYield: 460, badgeText: '丰熟' },
      { id: 'target-1-field-3', code: '田地 03', unlocked: true, status: 'growing', plantedSeedId: 'huichuncao', plantedGold: 210, currentYield: 320, badgeText: '成长' },
      { id: 'target-1-field-4', code: '田地 04', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' },
    ],
    raidableGold: 520,
    exposedFruit: '2 块成熟田 · 预计 880 金币',
    defenseStatus: '防守偏弱，驻守兵少于常见同级目标',
    seedDrop: { seedId: 'zhanqingsi', label: '斩情丝', quantity: 1, chance: 0.18 },
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
      { id: 'target-2-field-1', code: '田地 01', unlocked: true, status: 'mature', plantedSeedId: 'hundunguo', plantedGold: 200, currentYield: 420, badgeText: '丰熟' },
      { id: 'target-2-field-2', code: '田地 02', unlocked: true, status: 'seeded', plantedSeedId: 'qinglingmai', plantedGold: 120, currentYield: 180, badgeText: '播种' },
      { id: 'target-2-field-3', code: '田地 03', unlocked: true, status: 'seeded', plantedSeedId: 'xueyuehua', plantedGold: 160, currentYield: 210, badgeText: '播种' },
      { id: 'target-2-field-4', code: '田地 04', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' },
    ],
    raidableGold: 260,
    exposedFruit: '1 块成熟田 · 预计 420 金币',
    defenseStatus: '防守偏稳，仙界被掠损失减免明显',
    seedDrop: { seedId: 'hundunguo', label: '混沌果', quantity: 1, chance: 0.14 },
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
      { id: 'target-3-field-1', code: '田地 01', unlocked: true, status: 'growing', plantedSeedId: 'xueyuehua', plantedGold: 140, currentYield: 260, badgeText: '成长' },
      { id: 'target-3-field-2', code: '田地 02', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' },
      { id: 'target-3-field-3', code: '田地 03', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' },
      { id: 'target-3-field-4', code: '田地 04', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' },
    ],
    raidableGold: 180,
    exposedFruit: '1 块成长尾段田 · 预计 260 金币',
    defenseStatus: '人界经营向，防守一般，但暴露收益偏低',
    seedDrop: { seedId: 'xueyuehua', label: '雪月花', quantity: 1, chance: 0.12 },
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
      { id: 'target-4-field-1', code: '田地 01', unlocked: true, status: 'mature', plantedSeedId: 'jingdaosong', plantedGold: 250, currentYield: 510, badgeText: '丰熟' },
      { id: 'target-4-field-2', code: '田地 02', unlocked: true, status: 'growing', plantedSeedId: 'huichuncao', plantedGold: 220, currentYield: 300, badgeText: '成长' },
      { id: 'target-4-field-3', code: '田地 03', unlocked: true, status: 'growing', plantedSeedId: 'zhanqingsi', plantedGold: 240, currentYield: 340, badgeText: '成长' },
      { id: 'target-4-field-4', code: '田地 04', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' },
    ],
    raidableGold: 460,
    exposedFruit: '1 块成熟田 · 预计 510 金币',
    defenseStatus: '中等防守，战力高但驻防分散',
    seedDrop: { seedId: 'jingdaosong', label: '劲道松', quantity: 1, chance: 0.16 },
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
      { id: 'target-5-field-1', code: '田地 01', unlocked: true, status: 'mature', plantedSeedId: 'huichuncao', plantedGold: 120, currentYield: 190, badgeText: '丰熟' },
      { id: 'target-5-field-2', code: '田地 02', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' },
      { id: 'target-5-field-3', code: '田地 03', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' },
      { id: 'target-5-field-4', code: '田地 04', unlocked: true, status: 'empty', plantedGold: 0, currentYield: 0, badgeText: '空闲' },
    ],
    raidableGold: 140,
    exposedFruit: '1 块成熟田 · 预计 190 金币',
    defenseStatus: '防守偏弱，适合低损验证',
    seedDrop: { seedId: 'huichuncao', label: '回春草', quantity: 1, chance: 0.1 },
  },
];

const initialPlayerState: InMemoryPlayerState = {
  playerName: '人界领主·临川',
  factionName: '人界',
  seedInventory: {
    qinglingmai: 0,
    ninglucao: 0,
    suixinhua: 0,
    baiyulian: 0,
    yingyuezhu: 0,
    qianjiteng: 0,
    huichuncao: 0,
    xueyuehua: 0,
    jingdaosong: 0,
    hundunguo: 0,
    zhanqingsi: 0,
    wangchuanying: 0,
    zhaoyouming: 0,
  },
  globalItemInventory: {
    tianjiTalisman: 0,
  },
  unlockedSeedIds: ['qinglingmai'],
  starterSeedClaimed: false,
  tianjiTalismanClaimed: false,
  buildingLevels: {
    castle: 4,
    vault: 3,
    'field-slot': 1,
    population: 1,
    watchtower: 1,
  },
  castleExtensionLevels: {
    protectionTech: 0,
    farmYieldTech: 0,
    ripeWindowTech: 0,
    pendingClaimTech: 0,
  },
  buildingVersion: 1,
  walletVersion: 1,
  armyVersion: 1,
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
    vaultGold: 4990,
    vaultCapacity: 5000,
    taxPendingGold: 72,
    factionDividendGold: 80,
  },
  temporaryRaidClaim: null,
  dailyTaskState: {
    dateKey: '',
    tasks: [],
  },
  fields: [
    {
      id: 'field-1',
      code: '田地 01',
      unlocked: true,
      status: 'mature',
      plantedSeedId: 'qinglingmai',
      plantedGold: 600,
      currentYield: 1260,
      badgeText: '丰熟',
    },
    {
      id: 'field-2',
      code: '田地 02',
      unlocked: true,
      status: 'seeded',
      plantedSeedId: 'qinglingmai',
      plantedGold: 420,
      currentYield: 520,
      badgeText: '播种',
    },
    {
      id: 'field-3',
      code: '田地 03',
      unlocked: true,
      status: 'growing',
      plantedSeedId: 'qinglingmai',
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
  ensureDailyTasks();

  const { ledger } = playerState;
  const castleLevel = getCastleLevel();
  const taxIncomePerHour = getTaxIncomePerHour(castleLevel);
  const factionDividend = getFactionDividendPerHour();

  return {
    app: APP_NAME,
    playerName: playerState.playerName,
    factionName: playerState.factionName,
    castleLevel,
    stateVersions: {
      buildingVersion: playerState.buildingVersion,
      walletVersion: playerState.walletVersion,
      armyVersion: playerState.armyVersion,
    },
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
    dailyTasks: buildDailyTaskSummaries(),
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
      targetFarmBoardMessage: '',
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
    targetFarmBoardMessage: '',
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
  syncUnlockedFieldsWithCastleLevel();
  const castleLevel = playerState.buildingLevels.castle;
  const vaultLevel = playerState.buildingLevels.vault;
  const populationLevel = playerState.buildingLevels.population;
  const watchtowerLevel = playerState.buildingLevels.watchtower;
  const lockedFieldExists = playerState.fields.some((field) => !field.unlocked);
  const unlockedFieldCount = playerState.fields.filter((field) => field.unlocked).length;
  const nextFieldUnlockRequirement = getNextFieldUnlockRequirement(castleLevel);
  const nextPopulationLevelConfig = getPopulationLevelConfig(populationLevel);
  const populationLocked = Boolean(nextPopulationLevelConfig && castleLevel < nextPopulationLevelConfig.requiredCastleLevel);
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
        ? `当前田地位不单独收费，已随主城赠送开启 ${unlockedFieldCount} / ${playerState.fields.length} 块；下一块会在主城达到 Lv.${nextFieldUnlockRequirement ?? castleLevel} 时自动开启。`
        : `当前已随主城里程碑赠送开启全部 ${playerState.fields.length} 块田地。`,
      costText: lockedFieldExists && nextFieldUnlockRequirement ? `需要主城 Lv.${nextFieldUnlockRequirement}` : '当前已全部解锁',
      action: buildUpgradeAction('查看条件', 'ghost'),
      locked: true,
    },
    {
      id: 'population',
      title: '灵宠上限',
      description: `Lv.${populationLevel} -> Lv.${populationLevel + 1}，灵宠上限由 ${formatNumber(playerState.armyCapacity)} 提升到 ${formatNumber(playerState.armyCapacity + getPopulationCapacityGain(populationLevel))}。`,
      costText: populationLocked
        ? `需要主城 Lv.${nextPopulationLevelConfig?.requiredCastleLevel ?? castleLevel}`
        : getUpgradeCost('population')
          ? `消耗 ${formatNumber(getUpgradeCost('population') ?? 0)} 金币`
          : '已达到验证上限',
      action: buildUpgradeAction(populationLocked || !getUpgradeCost('population') ? '查看条件' : '升级灵宠上限', populationLocked || !getUpgradeCost('population') ? 'ghost' : 'secondary'),
      locked: populationLocked || !getUpgradeCost('population'),
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
  settleAllFieldLifecycles();
  syncUnlockedFieldsWithCastleLevel();
  const counts = getFieldCounts();
  const emptyUnlockedField = playerState.fields.find((field) => field.unlocked && field.status === 'empty');
  const lockedFieldExists = playerState.fields.some((field) => !field.unlocked);

  return {
    eyebrow: '田地经营',
    title: `丰熟 ${counts.mature} 块 · 成熟中 ${counts.growing} 块`,
    description: emptyUnlockedField
      ? '农场以田地为主，点击空地即可继续播种，进入丰熟后直接收取。'
      : lockedFieldExists
        ? '农场地块已排满，剩余田地会随主城等级里程碑自动开启。'
        : '农场地块已排满，可直接收取丰熟地块后继续播种。',
    action: emptyUnlockedField
      ? { label: '开始培育', target: 'farm', tone: 'primary' }
      : { label: lockedFieldExists ? '查看主城条件' : '返回主城', target: 'building', tone: 'secondary' },
  };
}

function buildFarmField(field: FieldState): ClientSceneContentResponse['farm']['fields'][number] {
  syncUnlockedFieldsWithCastleLevel();
  const cropName = field.plantedSeedId ? (seedLabelMap[field.plantedSeedId] ?? field.plantedSeedId) : undefined;

  if (!field.unlocked) {
    const nextFieldUnlockRequirement = getFieldUnlockRequirement(field.id);
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
      description: nextFieldUnlockRequirement ? `主城Lv.${nextFieldUnlockRequirement} 自动解锁` : '随主城里程碑自动解锁',
      actions: [],
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
      progressRemainingSeconds: getFieldStageRemainingSeconds(field),
      progressTotalSeconds: getFieldStageTotalSeconds(field),
      yieldGold: getResolvedFieldYield(field),
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
      yieldGold: getResolvedFieldYield(field),
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
      progressRemainingSeconds: getFieldStageRemainingSeconds(field),
      progressTotalSeconds: getSeedStageSeconds(field.plantedSeedId ?? 'qinglingmai', 'growing'),
      yieldGold: getResolvedFieldYield(field),
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
      progressRemainingSeconds: getFieldStageRemainingSeconds(field),
      progressTotalSeconds: getSeedStageSeconds(field.plantedSeedId ?? 'qinglingmai', 'seeded'),
      yieldGold: getResolvedFieldYield(field),
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
  settleAllFieldLifecycles();
  syncUnlockedFieldsWithCastleLevel();
  ensureDailyTasks();

  const factionDividend = getFactionDividendPerHour();
  const visibleRaidTargets = playerState.raidTargets.filter((target) => !isTargetProtected(target));

  return {
    app: APP_NAME,
    building: {
      upgrades: buildBuildingUpgrades(),
      extensions: buildCastleExtensions(),
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
      messageTemplates: [
        { templateId: 'steady-harvest', text: '今日借一程，来日还一礼。' },
        { templateId: 'field-well-kept', text: '田照顾得不错，我记下了。' },
        { templateId: 'next-time-guard', text: '下次记得把成熟田守紧。' },
        { templateId: 'fair-raid', text: '各凭本事，不伤和气。' },
        { templateId: 'come-again', text: '这次收下了，改日再会。' },
      ],
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
        breakdown: `金额构成：基础分红 ${formatNumber(factionDividend.base)}/小时 + 贡献加成 ${formatNumber(factionDividend.bonus)}/小时`,
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
        description: '100 金币 = 1 贡献，确认后会立即从当前总金币扣除。',
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
  target.protectionUntil = new Date(now + getPlayerProtectionDurationMinutes() * 60 * 1000).toISOString();
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
  const overflowGold = Math.max(pendingGold - claimedGold, 0);
  const acceptOverflowLoss = Boolean(input.acceptOverflowLoss);

  playerState.ledger.vaultGold += claimedGold;
  setPendingClaimAmount(input.source, acceptOverflowLoss ? 0 : overflowGold);

  const remainingPendingGold = getPendingClaimAmount(input.source);
  const sourceLabel = input.source === 'tax' ? '主城税收' : input.source === 'faction' ? '阵营分红' : '临时待领取';
  const summary = acceptOverflowLoss && overflowGold > 0
    ? `${sourceLabel}本次入账 ${formatNumber(claimedGold)} 金币，另有 ${formatNumber(overflowGold)} 已确认放弃。`
    : claimedGold > 0
      ? `${sourceLabel}本次入账 ${formatNumber(claimedGold)} 金币，剩余待领取 ${formatNumber(remainingPendingGold)}。`
      : `金币空间不足，当前没有可入账的${sourceLabel}。`;

  if (input.source === 'faction' && claimedGold > 0) {
    recordDailyTaskProgress('faction-interaction');
  }

  return {
    app: APP_NAME,
    summary,
    source: input.source,
    claimedGold,
    remainingPendingGold,
    ledger: { ...playerState.ledger },
  };
}

export function claimDailyTask(input: ClientClaimDailyTaskRequest): Omit<ClientClaimDailyTaskResponse, 'home' | 'scenes'> {
  ensureDailyTasks();

  const taskState = playerState.dailyTaskState.tasks.find((item) => item.taskId === input.taskId);
  const taskDefinition = getDailyTaskDefinition(input.taskId);

  if (!taskState || !taskDefinition) {
    return {
      app: APP_NAME,
      summary: '当前任务不存在或已过期。',
      taskId: input.taskId,
      rewardGold: 0,
      claimedGold: 0,
      overflowGold: 0,
    };
  }

  if (taskState.claimed) {
    return {
      app: APP_NAME,
      summary: '这条任务奖励已经领取过了。',
      taskId: input.taskId,
      rewardGold: 0,
      claimedGold: 0,
      overflowGold: 0,
    };
  }

  if (taskState.progress < taskDefinition.objective.count) {
    return {
      app: APP_NAME,
      summary: '当前任务尚未完成，暂时不能领取。',
      taskId: input.taskId,
      rewardGold: 0,
      claimedGold: 0,
      overflowGold: 0,
    };
  }

  const rewardGold = getDailyTaskGoldReward(input.taskId);
  const availableVaultSpace = Math.max(playerState.ledger.vaultCapacity - playerState.ledger.vaultGold, 0);
  const claimedGold = Math.min(rewardGold, availableVaultSpace);
  const overflowGold = Math.max(rewardGold - claimedGold, 0);

  if (overflowGold > 0 && !input.acceptOverflowLoss) {
    return {
      app: APP_NAME,
      summary: `${taskDefinition.title} 奖励共 ${formatNumber(rewardGold)} 金币，其中约 ${formatNumber(overflowGold)} 会因金币已满无法入账。确认后将默认放弃溢出部分。`,
      taskId: input.taskId,
      rewardGold,
      claimedGold: 0,
      overflowGold,
    };
  }

  playerState.ledger.vaultGold += claimedGold;
  taskState.claimed = true;

  return {
    app: APP_NAME,
    summary: overflowGold > 0
      ? `${taskDefinition.title} 已结算，入账 ${formatNumber(claimedGold)} 金币，另有 ${formatNumber(overflowGold)} 已确认放弃。`
      : `${taskDefinition.title} 已结算，入账 ${formatNumber(claimedGold)} 金币。`,
    taskId: input.taskId,
    rewardGold,
    claimedGold,
    overflowGold,
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
  recordDailyTaskProgress('faction-interaction');
  recordDailyTaskProgress('faction-donate');

  return buildMutationResponse(`已向阵营捐出 ${formatNumber(actualGoldAmount)} 金币，贡献值 +${formatNumber(contributionGain)}。`);
}

export function collectFieldGold(input: ClientCollectFieldRequest): ClientCollectFieldResponse {
  settleAllFieldLifecycles();
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
  const resolvedYield = getResolvedFieldYield(field);
  const depositedGold = Math.min(resolvedYield, availableVaultSpace);
  const overflowGold = Math.max(resolvedYield - depositedGold, 0);
  const rewards = buildFieldRewards(field, input.collectMode);

  playerState.ledger.vaultGold += depositedGold;
  applySeedRewards(rewards);
  field.status = 'empty';
  field.statusStartedAt = undefined;
  field.plantedSeedId = undefined;
  field.plantedGold = 0;
  field.currentYield = 0;
  field.badgeText = '空闲地块';
  if (input.collectMode === 'ripe') {
    recordDailyTaskProgress('collect-field');
  }
  recordDailyTaskProgress('farm-cycle');

  const rewardSummary = rewards.length > 0 ? `，并获得 ${rewards.map((reward) => `${reward.label} x${reward.quantity}`).join('、')}` : '';
  const summary = overflowGold > 0
    ? `${field.code} 已收取 ${formatNumber(depositedGold)} 金币，另有 ${formatNumber(overflowGold)} 因金币已满未能入账${rewardSummary}。`
    : `${field.code} 已收取 ${formatNumber(depositedGold)} 金币${rewardSummary}，可以立即再投入新一轮培育。`;

  return buildCollectFieldResponse(summary, depositedGold, overflowGold, rewards);
}

export function startCultivation(input: ClientStartCultivationRequest): ClientStateMutationResponse {
  settleAllFieldLifecycles();
  const field = playerState.fields.find((item) => item.id === input.fieldId);

  if (!field || !field.unlocked) {
    return buildMutationResponse('当前地块尚未解锁，无法开始培育。');
  }

  if (field.status !== 'empty') {
    return buildMutationResponse('当前地块已经在培育中或可直接收取。');
  }

  if (!playerState.unlockedSeedIds.includes(input.seedId)) {
    return buildMutationResponse('当前种子尚未解锁，无法开始本轮培育。');
  }

  if ((playerState.seedInventory[input.seedId] ?? 0) <= 0) {
    return buildMutationResponse('当前种子库存不足，无法开始本轮培育。');
  }

  playerState.seedInventory[input.seedId] = Math.max((playerState.seedInventory[input.seedId] ?? 0) - 1, 0);
  field.status = 'seeded';
  field.statusStartedAt = new Date().toISOString();
  field.plantedSeedId = input.seedId;
  field.plantedGold = 0;
  field.currentYield = Math.round(getSeedStageGold(input.seedId, 'seeded') * getFarmYieldMultiplier());
  field.badgeText = '播种';
  recordDailyTaskProgress('start-cultivation');
  recordDailyTaskProgress('farm-cycle');

  return buildMutationResponse(`${field.code} 已播下 ${seedLabelMap[input.seedId] ?? input.seedId}，开始新一轮培育。`);
}

export function claimStarterSeeds(): ClientStateMutationResponse {
  if (playerState.starterSeedClaimed) {
    return buildMutationResponse('今日种子已经领取过了。');
  }

  playerState.starterSeedClaimed = true;
  applySeedRewards([{ seedId: 'qinglingmai', quantity: 3 }]);

  return buildMutationResponse('今日种子已领取，获得 青灵麦 x3。');
}

export function claimTianjiTalisman(): ClientStateMutationResponse {
  if (playerState.tianjiTalismanClaimed) {
    return buildMutationResponse('今天天机符已经领取过了。');
  }

  playerState.tianjiTalismanClaimed = true;
  playerState.globalItemInventory.tianjiTalisman = (playerState.globalItemInventory.tianjiTalisman ?? 0) + 1;

  return buildMutationResponse('今天天机符已领取，获得 天机符 x1。');
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

  recordDailyTaskProgress('recruit-army', actualRecruitCount);

  return buildMutationResponse(summary);
}

export function upgradeBuilding(input: ClientUpgradeBuildingRequest): ClientStateMutationResponse {
  const targetType = input.targetType ?? 'building';

  if (targetType === 'castle-extension') {
    if (!input.extensionId) {
      return buildMutationResponse('当前升级请求缺少扩展分支标识。');
    }

    const currentLevel = getCastleExtensionLevel(input.extensionId);
    const nextLevelConfig = getCastleExtensionLevelConfig(input.extensionId, currentLevel + 1);

    if (!nextLevelConfig) {
      return buildMutationResponse('当前主城扩展分支已达到验证上限。');
    }

    if (getCastleLevel() < nextLevelConfig.requiredCastleLevel) {
      return buildMutationResponse(`当前主城等级不足，需要主城 Lv.${nextLevelConfig.requiredCastleLevel}。`);
    }

    if (playerState.ledger.vaultGold < nextLevelConfig.upgradeCost) {
      return buildMutationResponse('金币不足，当前无法完成升级。');
    }

    playerState.ledger.vaultGold -= nextLevelConfig.upgradeCost;
    playerState.castleExtensionLevels[input.extensionId] = currentLevel + 1;
    recordDailyTaskProgress('upgrade-building');

    return buildMutationResponse(`${getCastleExtensionTrack(input.extensionId)?.title ?? '主城扩展'}升级完成，当前已升至 Lv.${currentLevel + 1}。`);
  }

  if (!input.buildingId) {
    return buildMutationResponse('当前升级请求缺少建筑标识。');
  }

  if (input.buildingId === 'field-slot') {
    return buildMutationResponse('田地位不需要额外花钱购买，会在主城达到指定等级后自动开启。');
  }

  if (input.buildingId === 'population') {
    const nextPopulationLevelConfig = getPopulationLevelConfig(playerState.buildingLevels.population);

    if (nextPopulationLevelConfig && getCastleLevel() < nextPopulationLevelConfig.requiredCastleLevel) {
      return buildMutationResponse(`当前主城等级不足，需要主城 Lv.${nextPopulationLevelConfig.requiredCastleLevel}。`);
    }
  }

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
    syncUnlockedFieldsWithCastleLevel();
    recordDailyTaskProgress('upgrade-building');
    recordDailyTaskProgress('upgrade-core-line');
    recordDailyTaskProgress('upgrade-core-building');
    return buildMutationResponse(`主城升级完成，当前已升至 Lv.${playerState.buildingLevels.castle}。`);
  }

  if (input.buildingId === 'vault') {
    playerState.buildingLevels.vault += 1;
    playerState.ledger.vaultCapacity += getVaultCapacityGain(playerState.buildingLevels.vault - 1);
    recordDailyTaskProgress('upgrade-building');
    recordDailyTaskProgress('upgrade-core-line');
    recordDailyTaskProgress('upgrade-core-building');
    return buildMutationResponse(`金库升级完成，容量已提升到 ${formatNumber(playerState.ledger.vaultCapacity)}。`);
  }

  if (input.buildingId === 'population') {
    playerState.buildingLevels.population += 1;
    playerState.armyCapacity += getPopulationCapacityGain(playerState.buildingLevels.population - 1);
    recordDailyTaskProgress('upgrade-building');
    recordDailyTaskProgress('upgrade-core-line');
    return buildMutationResponse(`灵宠上限升级完成，当前灵宠上限已提升到 ${formatNumber(playerState.armyCapacity)}。`);
  }

  playerState.buildingLevels.watchtower += 1;
  recordDailyTaskProgress('upgrade-building');
  recordDailyTaskProgress('upgrade-core-line');
  return buildMutationResponse(`防守建筑升级完成，当前已升至 Lv.${playerState.buildingLevels.watchtower}。`);
}

export function resetDemoState(): ClientResetDemoStateResponse {
  const nextState = clonePlayerState(initialPlayerState);

  playerState.playerName = nextState.playerName;
  playerState.factionName = nextState.factionName;
  playerState.seedInventory = nextState.seedInventory;
  playerState.globalItemInventory = nextState.globalItemInventory;
  playerState.unlockedSeedIds = nextState.unlockedSeedIds;
  playerState.starterSeedClaimed = nextState.starterSeedClaimed;
  playerState.tianjiTalismanClaimed = nextState.tianjiTalismanClaimed;
  playerState.buildingLevels = nextState.buildingLevels;
  playerState.castleExtensionLevels = nextState.castleExtensionLevels;
  playerState.buildingVersion = nextState.buildingVersion;
  playerState.walletVersion = nextState.walletVersion;
  playerState.armyVersion = nextState.armyVersion;
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
  playerState.temporaryRaidClaim = nextState.temporaryRaidClaim;
  playerState.dailyTaskState = nextState.dailyTaskState;
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

