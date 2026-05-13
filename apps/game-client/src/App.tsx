import { useEffect, useState } from 'react';
import type {
  ClientArmyTrainingQueue,
  ClientCastleExtensionUpgradeId,
  ClientCollectFieldRequest,
  ClientCollectFieldResponse,
  ClientRaidActionRequest,
  ClientRecruitArmyRequest,
  ClientFactionDonateRequest,
  ClientBuildingUpgradeId,
  ClientClaimPendingRequest,
  ClientRaidTarget,
  ClientRaidTargetDetailResponse,
  ClientSceneAction,
  ClientSceneKey,
  HomeSummaryResponse,
} from '@trinitywar/shared';
import { claimDailyTaskReward, claimPendingEarnings, claimStarterSeedPack, claimTianjiTalismanItem, collectFieldEarnings, donateFactionResources, loadClientViewModel, loadRaidTargetDetail, raidClientTarget, recruitArmyUnits, resetDemoExperimentState, startFieldCultivation, type ClientViewModel, upgradeClientBuilding } from './api';
import { RaidIntelScreen } from './ui/raid/RaidIntelScreen';
import { ArmyScene } from './ui/scenes/ArmyScene';
import { BuildingScene } from './ui/scenes/BuildingScene';
import { FactionScene } from './ui/scenes/FactionScene';
import { FarmScene } from './ui/scenes/FarmScene';
import { HomeScene } from './ui/scenes/HomeScene';
import { ReportScene } from './ui/scenes/ReportScene';
import { SeedSelectionScreen } from './ui/scenes/SeedSelectionScreen';
import { GlobalFeatureModal } from './ui/common/GlobalFeatureModal';

type RaidHubTabKey = 'targets' | 'follows' | 'reports' | 'warrants';
type FactionTabKey = 'overview' | 'donate' | 'rank';

interface ToastState {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface RaidTargetModalState {
  targetId: string;
  targetName: string;
  mode: 'raid' | 'revenge';
}

type SeedRarity = 'common' | 'rare' | 'legendary';

interface SeedCatalogItem {
  id: string;
  name: string;
  rarity: SeedRarity;
  description: string;
  unlockedByDefault: boolean;
}

interface SeedRewardModalState {
  title: string;
  summary: string;
  confirmAction?: 'claim-starter-seeds' | 'claim-tianji-talisman';
  items: Array<{
    seedId?: string;
    itemId?: string;
    quantity: number;
    label?: string;
  }>;
}

interface SeedSelectionState {
  fieldId: string;
  fieldCode: string;
}

interface CollectOverflowState {
  fieldId: string;
  fieldCode: string;
  collectMode: ClientCollectFieldRequest['collectMode'];
  pendingYield: number;
  overflowGold: number;
}

interface PendingClaimOverflowState {
  source: ClientClaimPendingRequest['source'];
  title: string;
  pendingYield: number;
  overflowGold: number;
}

interface FarmCollectPresentationState {
  fieldId: string;
  tier: 'harvest' | 'critical';
  showSeeds: boolean;
}

interface FollowedRaidTargetSummary {
  id: string;
  name: string;
  faction: string;
}

interface GlobalFeatureModalState {
  title: string;
  eyebrow?: string;
  description?: string;
}

const seedCatalog: SeedCatalogItem[] = [
  { id: 'qinglingmai', name: '青灵麦', rarity: 'common', description: '普通、标准稳收基准种，初始默认可培育。', unlockedByDefault: true },
  { id: 'ninglucao', name: '凝露草', rarity: 'common', description: '普通、短线抢收种，适合高频上线卡成熟。', unlockedByDefault: false },
  { id: 'suixinhua', name: '碎心花', rarity: 'common', description: '普通、高折损高回报种，丰熟收益波动很强。', unlockedByDefault: false },
  { id: 'baiyulian', name: '白玉莲', rarity: 'common', description: '普通、低频保值种，错过窗口也不容易血亏。', unlockedByDefault: false },
  { id: 'yingyuezhu', name: '影月竹', rarity: 'common', description: '普通、稳健中速种，适合平衡型经营。', unlockedByDefault: false },
  { id: 'qianjiteng', name: '牵机藤', rarity: 'common', description: '普通、丰熟爆发种，适合做等还是收的选择题。', unlockedByDefault: false },
  { id: 'huichuncao', name: '回春草', rarity: 'rare', description: '稀有、回种保值种，上线不稳时更稳。', unlockedByDefault: false },
  { id: 'xueyuehua', name: '雪月花', rarity: 'rare', description: '稀有、高丰熟倍率种，卡点收益很高。', unlockedByDefault: false },
  { id: 'jingdaosong', name: '劲道松', rarity: 'rare', description: '稀有、长周期高保值种，适合重仓慢收。', unlockedByDefault: false },
  { id: 'hundunguo', name: '混沌果', rarity: 'rare', description: '稀有、后期抽水种，中后段高价值诱盗目标。', unlockedByDefault: false },
  { id: 'zhanqingsi', name: '斩情丝', rarity: 'legendary', description: '传说、高风险斩杀种，高收益也高失败代价。', unlockedByDefault: false },
  { id: 'wangchuanying', name: '忘川影', rarity: 'legendary', description: '传说、长周期隐性暴利种，后段重投入慢兑现。', unlockedByDefault: false },
  { id: 'zhaoyouming', name: '照幽冥', rarity: 'legendary', description: '传说、极限丰熟回种种，终局上限最高之一。', unlockedByDefault: false },
];

const FARM_COLLECT_PRESENTATION_MS = 1250;

const seedRarityLabels: Record<SeedRarity, string> = {
  common: '普通',
  rare: '稀有',
  legendary: '传说',
};

const defaultUnlockedSeedIds = seedCatalog.filter((seed) => seed.unlockedByDefault).map((seed) => seed.id);

const emptySeedInventory = seedCatalog.reduce<Record<string, number>>((inventory, seed) => {
  inventory[seed.id] = 0;
  return inventory;
}, {});

const emptyGlobalItemInventory: Record<string, number> = {
  tianjiTalisman: 0,
};

interface ResourcePulseState {
  vaultTone: 'gain' | 'spend' | null;
  vaultToken: number;
  armyTone: 'gain' | 'spend' | null;
  armyToken: number;
}

interface ResourceProgressValue {
  current: number;
  capacity: number;
  ratio: number;
}

const sceneNavLabels: Record<ClientSceneKey, string> = {
  home: '首页',
  building: '主城',
  farm: '农场',
  raid: '灵宠',
  report: '掠夺',
  faction: '阵营',
};

const sceneKeys: ClientSceneKey[] = ['home', 'building', 'farm', 'raid', 'report', 'faction'];

const factionBackgroundMap: Record<string, string> = {
  人界: '/assets/backgrounds/renjie.png',
  仙界: '/assets/backgrounds/xianjie.png',
  魔界: '/assets/backgrounds/mojie.png',
};

const sceneBackgroundMap: Record<Exclude<ClientSceneKey, 'home'>, string> = {
  building: '/assets/backgrounds/jianzhu.png',
  farm: '/assets/backgrounds/nongchang.png',
  raid: '/assets/backgrounds/lueduo.png',
  report: '/assets/backgrounds/zhanbao.png',
  faction: '/assets/backgrounds/zhenying.png',
};

function normalizeScene(scene: string): ClientSceneKey {
  if (scene === 'field') {
    return 'farm';
  }

  if (scene === 'home' || scene === 'building' || scene === 'farm' || scene === 'raid' || scene === 'report' || scene === 'faction') {
    return scene;
  }

  return 'home';
}

function parseHourlyTax(description?: string): number {
  if (!description) {
    return 0;
  }

  const match = description.match(/每小时(?:产出|可分到)\s([\d,]+)/);
  return match ? Number(match[1].replace(/,/g, '')) : 0;
}

function formatServerTime(serverTime: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(serverTime));
}

function getMaxRecruitable(currentGold: number, currentArmy: number, armyCapacity: number, unitCostGold: number, queuedArmyCount = 0): number {
  const remainingCapacity = Math.max(armyCapacity - currentArmy - queuedArmyCount, 0);
  const affordableCount = unitCostGold > 0 ? Math.floor(currentGold / unitCostGold) : 0;

  return Math.min(remainingCapacity, affordableCount);
}

function buildSeasonProgress(status: ClientViewModel['bootstrap']['season']): {
  label: string;
  detail: string;
} {
  const safeTotalWeeks = Math.max(status.totalWeeks, 1);
  const safeCurrentWeek = Math.min(Math.max(status.currentWeek, 1), safeTotalWeeks);

  return {
    label: `S${status.seasonNumber} 赛季`,
    detail: `${safeCurrentWeek}/${safeTotalWeeks} 周`,
  };
}

function buildActionMessage(label: string, context?: string): string {
  const subject = context ? `当前目标：${context}。` : '';

  if (label.includes('领取')) {
    return `${subject}该操作会先走收益确认，再把可承接的部分并入当前库存。`;
  }

  if (label.includes('升级')) {
    return `${subject}验证版先只确认入口、消耗文案和收益预期，具体数值以后端结算为准。`;
  }

  if (label.includes('上缴')) {
    return `${subject}上缴后会立即累积贡献值，分红收益通过后续小时结算回流。`;
  }

  if (label.includes('说明') || label.includes('详情')) {
    return `${subject}这里先保留为说明弹窗，后续可以替换成更完整的二级信息面板。`;
  }

  if (label.includes('刷新')) {
    return `${subject}验证版先模拟目标刷新入口，后续再接真实目标池刷新接口。`;
  }

  return `${subject}该入口已经接入前端交互壳，后续可以继续补确认弹窗、接口联调和状态回写。`;
}

function parseCapacityResourceValue(value: string): ResourceProgressValue {
  const parts = value.split('/').map((part) => Number(part.replace(/,/g, '').trim()));
  const current = parts[0] ?? 0;
  const capacity = parts[1] ?? 1;
  const ratio = capacity > 0 ? Math.min(current / capacity, 1) : 0;

  return { current, capacity, ratio };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function getRemainingSeconds(dateText?: string | null): number {
  if (!dateText) {
    return 0;
  }

  return Math.max(Math.ceil((new Date(dateText).getTime() - Date.now()) / 1000), 0);
}

function formatProtectionCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(totalSeconds, 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatTemporaryClaimCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(totalSeconds, 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function findResourceByTone(tone: HomeSummaryResponse['resources'][number]['tone'], resources: HomeSummaryResponse['resources']): HomeSummaryResponse['resources'][number] | undefined {
  return resources.find((resource) => resource.tone === tone);
}

function getDefaultRecruitCount(currentGold: number, currentArmy: number, armyCapacity: number, unitCostGold: number, queuedArmyCount = 0): number {
  const remainingCapacity = Math.max(armyCapacity - currentArmy - queuedArmyCount, 0);
  const affordableCount = unitCostGold > 0 ? Math.floor(currentGold / unitCostGold) : 0;
  const maxRecruitable = Math.min(remainingCapacity, affordableCount);

  if (maxRecruitable <= 0) {
    return 0;
  }

  return Math.max(Math.floor(maxRecruitable / 2), 1);
}

function getFactionBackground(factionName: string): string {
  return factionBackgroundMap[factionName] ?? factionBackgroundMap['人界'];
}

function getSceneBackground(scene: ClientSceneKey, factionName: string): string {
  if (scene === 'home') {
    return getFactionBackground(factionName);
  }

  return sceneBackgroundMap[scene];
}

function resolveRaidTargetByContext(targets: ClientRaidTarget[], context?: string): ClientRaidTarget | null {
  if (!context) {
    return targets[0] ?? null;
  }

  const matchedTarget = targets.find((target) => context.includes(target.name));
  return matchedTarget ?? targets[0] ?? null;
}

function App(): JSX.Element {
  const [viewModel, setViewModel] = useState<ClientViewModel | null>(null);
  const [activeScene, setActiveScene] = useState<ClientSceneKey>('home');
  const [raidHubTab, setRaidHubTab] = useState<RaidHubTabKey>('targets');
  const [factionTab, setFactionTab] = useState<FactionTabKey>('overview');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [selectedRaidTargetId, setSelectedRaidTargetId] = useState<string>('');
  const [raidTargetModal, setRaidTargetModal] = useState<RaidTargetModalState | null>(null);
  const [raidTargetDetail, setRaidTargetDetail] = useState<ClientRaidTargetDetailResponse | null>(null);
  const [raidTargetDetailLoading, setRaidTargetDetailLoading] = useState(false);
  const [raidTargetDetailError, setRaidTargetDetailError] = useState<string | null>(null);
  const [claimingSource, setClaimingSource] = useState<ClientClaimPendingRequest['source'] | null>(null);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [farmTick, setFarmTick] = useState(0);
  const [resourcePulse, setResourcePulse] = useState<ResourcePulseState>({
    vaultTone: null,
    vaultToken: 0,
    armyTone: null,
    armyToken: 0,
  });
  const [seedInventory, setSeedInventory] = useState<Record<string, number>>(emptySeedInventory);
  const [globalItemInventory, setGlobalItemInventory] = useState<Record<string, number>>(emptyGlobalItemInventory);
  const [unlockedSeedIds, setUnlockedSeedIds] = useState<string[]>(defaultUnlockedSeedIds);
  const [starterSeedClaimed, setStarterSeedClaimed] = useState(false);
  const [tianjiTalismanClaimed, setTianjiTalismanClaimed] = useState(false);
  const [seedRewardModal, setSeedRewardModal] = useState<SeedRewardModalState | null>(null);
  const [seedSelectionState, setSeedSelectionState] = useState<SeedSelectionState | null>(null);
  const [armyRecruitCount, setArmyRecruitCount] = useState(0);
  const [armyQueueRefreshReadyAt, setArmyQueueRefreshReadyAt] = useState<string | null>(null);
  const [selectedSeedId, setSelectedSeedId] = useState<string>('qinglingmai');
  const [fieldSeedAssignments, setFieldSeedAssignments] = useState<Record<string, string>>({});
  const [collectOverflowState, setCollectOverflowState] = useState<CollectOverflowState | null>(null);
  const [pendingClaimOverflowState, setPendingClaimOverflowState] = useState<PendingClaimOverflowState | null>(null);
  const [farmCollectPresentation, setFarmCollectPresentation] = useState<FarmCollectPresentationState | null>(null);
  const [followedTargetIds, setFollowedTargetIds] = useState<string[]>([]);
  const [raidTargetDetailsById, setRaidTargetDetailsById] = useState<Record<string, ClientRaidTargetDetailResponse>>({});
  const [globalFeatureModal, setGlobalFeatureModal] = useState<GlobalFeatureModalState | null>(null);

  const cacheRaidTargetDetail = (detail: ClientRaidTargetDetailResponse): void => {
    setRaidTargetDetailsById((current) => ({
      ...current,
      [detail.targetId]: detail,
    }));
  };

  const syncSeedBackpackState = (backpack: ClientViewModel['bootstrap']['backpack']): void => {
    setSeedInventory({
      ...emptySeedInventory,
      ...backpack.seedInventory,
    });
    setGlobalItemInventory({
      ...emptyGlobalItemInventory,
      ...backpack.globalItemInventory,
    });
    setUnlockedSeedIds(backpack.unlockedSeedIds.length > 0 ? backpack.unlockedSeedIds : defaultUnlockedSeedIds);
    setStarterSeedClaimed(backpack.starterSeedClaimed);
    setTianjiTalismanClaimed(backpack.tianjiTalismanClaimed);
    if (!backpack.unlockedSeedIds.includes(selectedSeedId)) {
      setSelectedSeedId(backpack.unlockedSeedIds[0] ?? 'qinglingmai');
    }
  };

  useEffect(() => {
    let active = true;

    void loadClientViewModel().then((data) => {
      if (!active) {
        return;
      }

      setViewModel(data);
      setSelectedRaidTargetId(data.scenes.raid.targets[0]?.id ?? '');
      syncSeedBackpackState(data.bootstrap.backpack);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!viewModel) {
      return;
    }

    const nextVaultResource = findResourceByTone('vault', viewModel.home.resources);
    const nextArmyResource = findResourceByTone('army', viewModel.home.resources);
    const nextVaultProgress = nextVaultResource ? parseCapacityResourceValue(nextVaultResource.value) : { current: 0, capacity: 0, ratio: 0 };
    const nextArmyProgress = nextArmyResource ? parseCapacityResourceValue(nextArmyResource.value) : { current: 0, capacity: 0, ratio: 0 };
    const nextQueuedArmyCount = viewModel.scenes.army.queue?.queuedUnits ?? 0;
    const unitCostGold = viewModel.scenes.army.unitCostGold;
    const maxRecruitable = getMaxRecruitable(nextVaultProgress.current, nextArmyProgress.current, nextArmyProgress.capacity, unitCostGold, nextQueuedArmyCount);

    setArmyRecruitCount((current) => {
      if (maxRecruitable <= 0) {
        return 0;
      }

      if (current <= 0 || current > maxRecruitable) {
        return getDefaultRecruitCount(nextVaultProgress.current, nextArmyProgress.current, nextArmyProgress.capacity, unitCostGold, nextQueuedArmyCount);
      }

      return current;
    });

    setFarmTick(0);

    const timer = window.setInterval(() => {
      setFarmTick((currentTick) => currentTick + 1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [viewModel]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast((current) => current?.id === toast.id ? null : current);
    }, 2400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  useEffect(() => {
    if (!farmCollectPresentation) {
      return;
    }

    const timer = window.setTimeout(() => {
      setFarmCollectPresentation((current) => current?.fieldId === farmCollectPresentation.fieldId ? null : current);
    }, FARM_COLLECT_PRESENTATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [farmCollectPresentation]);

  useEffect(() => {
    if (!raidTargetModal) {
      setRaidTargetDetail(null);
      setRaidTargetDetailError(null);
      setRaidTargetDetailLoading(false);
      return;
    }

    const cachedDetail = raidTargetDetailsById[raidTargetModal.targetId];
    if (cachedDetail) {
      setRaidTargetDetail(cachedDetail);
      setRaidTargetDetailError(null);
      setRaidTargetDetailLoading(false);
      return;
    }

    let active = true;
    setRaidTargetDetailLoading(true);
    setRaidTargetDetailError(null);

    void loadRaidTargetDetail(raidTargetModal.targetId).then((detail) => {
      if (!active) {
        return;
      }

      cacheRaidTargetDetail(detail);
      setRaidTargetDetail(detail);
    }).catch(() => {
      if (!active) {
        return;
      }

      setRaidTargetDetailError('当前无法读取对手详情，请稍后重试。');
    }).finally(() => {
      if (!active) {
        return;
      }

      setRaidTargetDetailLoading(false);
    });

    return () => {
      active = false;
    };
  }, [raidTargetDetailsById, raidTargetModal]);

  useEffect(() => {
    const queue = viewModel?.scenes.army.queue;

    if (!queue) {
      setArmyQueueRefreshReadyAt(null);
      return;
    }

    const readyAt = queue.readyAt;
    if (Date.now() < new Date(readyAt).getTime() || armyQueueRefreshReadyAt === readyAt) {
      return;
    }

    let active = true;
    setArmyQueueRefreshReadyAt(readyAt);

    void loadClientViewModel().then((data) => {
      if (!active) {
        return;
      }

      triggerResourcePulse(data.home);
      setViewModel(data);
    }).catch(() => {
      if (!active) {
        return;
      }

      setArmyQueueRefreshReadyAt(null);
    });

    return () => {
      active = false;
    };
  }, [armyQueueRefreshReadyAt, farmTick, viewModel]);

  if (!viewModel) {
    return (
      <main className="loading-shell">
        <section className="loading-panel">
          <p className="eyebrow">TRINITY WAR</p>
          <h1>验证前端加载中</h1>
          <p className="panel-text">正在读取客户端验证数据与页面结构。</p>
        </section>
      </main>
    );
  }

  const { bootstrap, home, scenes, usingMock } = viewModel;
  const selectedRaidTarget = scenes.raid.targets.find((target) => target.id === selectedRaidTargetId) ?? scenes.raid.targets[0];
  const mergedReportEntries = [...scenes.report.attack, ...scenes.report.defense]
    .filter((entry) => entry.title !== '系统结算')
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const activeBackgroundImage = `url(${getSceneBackground(activeScene, home.factionName)})`;
  const vaultResource = findResourceByTone('vault', home.resources);
  const pendingClaims = home.pendingClaims ?? [];
  const dailyTasks = home.dailyTasks ?? [];
  const taxPending = pendingClaims.find((claim) => claim.source === 'tax');
  const factionPending = pendingClaims.find((claim) => claim.source === 'faction');
  const totalPending = pendingClaims.reduce((sum, claim) => sum + Number(claim.value.replace(/,/g, '')), 0);
  const protectionRemainingSeconds = getRemainingSeconds(home.protectedUntil);
  const isProtectionActive = protectionRemainingSeconds > 0;
  const resourceCards = home.resources.map((resource) => ({
    resource,
    progress: parseCapacityResourceValue(resource.value),
  }));
  const vaultProgress = vaultResource ? parseCapacityResourceValue(vaultResource.value) : { current: 0, capacity: 0, ratio: 0 };
  const armyResource = findResourceByTone('army', home.resources);
  const armyProgress = armyResource ? parseCapacityResourceValue(armyResource.value) : { current: 0, capacity: 0, ratio: 0 };
  const seasonProgress = buildSeasonProgress(bootstrap.season);
  const hourlyTax = parseHourlyTax(taxPending?.description);
  const armyTrainingQueue: ClientArmyTrainingQueue | null = scenes.army.queue;
  const temporaryClaim = home.temporaryClaim;
  const temporaryClaimRemainingSeconds = getRemainingSeconds(temporaryClaim?.expiresAt);
  const activeTemporaryClaim = temporaryClaim && temporaryClaim.goldAmount > 0 && temporaryClaimRemainingSeconds > 0 ? temporaryClaim : null;
  const seedCatalogMap = new Map(seedCatalog.map((seed) => [seed.id, seed]));
  const seedGroups = (['common', 'rare', 'legendary'] as const).map((rarity) => ({
    rarity,
    label: seedRarityLabels[rarity],
    seeds: seedCatalog.filter((seed) => seed.rarity === rarity).map((seed) => ({
      ...seed,
      unlocked: unlockedSeedIds.includes(seed.id),
      quantity: seedInventory[seed.id] ?? 0,
    })),
  }));
  const farmFields = scenes.farm.fields.map((field) => {
    const assignedSeedId = fieldSeedAssignments[field.id];
    const assignedSeed = assignedSeedId ? seedCatalogMap.get(assignedSeedId) : undefined;

    if (!assignedSeed || (field.tone !== 'seeded' && field.tone !== 'growing' && field.tone !== 'mature' && field.tone !== 'withered')) {
      return field;
    }

    return {
      ...field,
      cropName: assignedSeed.name,
    };
  });
  const raidTargetsById = new Map(scenes.raid.targets.map((target) => [target.id, target]));
  const followedTargets = followedTargetIds
    .map((targetId) => {
      const target = raidTargetsById.get(targetId);
      if (target) {
        return {
          id: target.id,
          name: target.name,
          faction: target.faction,
        } satisfies FollowedRaidTargetSummary;
      }

      const detail = raidTargetDetailsById[targetId];
      if (detail) {
        return {
          id: detail.targetId,
          name: detail.name,
          faction: detail.faction,
        } satisfies FollowedRaidTargetSummary;
      }

      return null;
    })
    .filter((target): target is FollowedRaidTargetSummary => Boolean(target));

  const showToast = (message: string, tone: ToastState['tone'] = 'info'): void => {
    setToast({
      id: Date.now(),
      message,
      tone,
    });
  };

  const triggerResourcePulse = (nextHome: HomeSummaryResponse): void => {
    const currentVaultAmount = vaultResource ? parseCapacityResourceValue(vaultResource.value).current : 0;
    const nextVaultResource = findResourceByTone('vault', nextHome.resources);
    const nextVaultAmount = nextVaultResource ? parseCapacityResourceValue(nextVaultResource.value).current : 0;
    const currentArmyAmount = armyResource ? parseCapacityResourceValue(armyResource.value).current : 0;
    const nextArmyResource = findResourceByTone('army', nextHome.resources);
    const nextArmyAmount = nextArmyResource ? parseCapacityResourceValue(nextArmyResource.value).current : 0;

    setResourcePulse((current) => ({
      vaultTone: nextVaultAmount === currentVaultAmount ? current.vaultTone : nextVaultAmount > currentVaultAmount ? 'gain' : 'spend',
      vaultToken: nextVaultAmount === currentVaultAmount ? current.vaultToken : current.vaultToken + 1,
      armyTone: nextArmyAmount === currentArmyAmount ? current.armyTone : nextArmyAmount > currentArmyAmount ? 'gain' : 'spend',
      armyToken: nextArmyAmount === currentArmyAmount ? current.armyToken : current.armyToken + 1,
    }));
  };

  const handleRecruitArmy = async (): Promise<void> => {
    if (pendingActionKey === 'army:recruit') {
      return;
    }

    const input: ClientRecruitArmyRequest = {
      recruitCount: armyRecruitCount,
    };

    setPendingActionKey('army:recruit');

    try {
      const result = await recruitArmyUnits(input);
      applyMutationResult(result);
    } catch {
      showToast('当前无法完成灵宠培育，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleFactionDonate = async (goldAmount: number): Promise<void> => {
    if (pendingActionKey === 'faction:donate') {
      return;
    }

    const input: ClientFactionDonateRequest = {
      goldAmount,
    };

    setPendingActionKey('faction:donate');

    try {
      const result = await donateFactionResources(input);
      applyMutationResult(result);
    } catch {
      showToast('当前无法完成阵营上缴，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleTransferFaction = (factionName: string): void => {
    showToast(`转阵营到${factionName}的功能待定，当前先保留入口。`);
  };

  const handleClaimPending = async (source: ClientClaimPendingRequest['source'], acceptOverflowLoss = false): Promise<void> => {
    if (claimingSource === source) {
      return;
    }

    setClaimingSource(source);

    try {
      const result = await claimPendingEarnings({ source, acceptOverflowLoss });
      applyMutationResult(result);
    } catch {
      showToast('当前无法完成收益入库，请稍后重试。', 'error');
    } finally {
      setClaimingSource(null);
    }
  };

  const handleConfirmStarterSeedClaim = async (): Promise<void> => {
    if (!seedRewardModal || seedRewardModal.confirmAction !== 'claim-starter-seeds') {
      return;
    }

    if (pendingActionKey === 'home:claim-starter-seeds') {
      return;
    }

    setPendingActionKey('home:claim-starter-seeds');

    try {
      const result = await claimStarterSeedPack();
      applyMutationResult(result);
      setSeedInventory((current) => ({
        ...current,
        qinglingmai: (current.qinglingmai ?? 0) + 3,
      }));
      setUnlockedSeedIds((current) => current.includes('qinglingmai') ? current : [...current, 'qinglingmai']);
      setStarterSeedClaimed(true);
      setSeedRewardModal(null);
    } catch {
      showToast('当前无法领取今日种子，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleConfirmTianjiTalismanClaim = async (): Promise<void> => {
    if (!seedRewardModal || seedRewardModal.confirmAction !== 'claim-tianji-talisman') {
      return;
    }

    if (pendingActionKey === 'home:claim-tianji-talisman') {
      return;
    }

    setPendingActionKey('home:claim-tianji-talisman');

    try {
      const result = await claimTianjiTalismanItem();
      applyMutationResult(result);
      setGlobalItemInventory((current) => ({
        ...current,
        tianjiTalisman: (current.tianjiTalisman ?? 0) + 1,
      }));
      setTianjiTalismanClaimed(true);
      setSeedRewardModal(null);
    } catch {
      showToast('当前无法领取今天天机符，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleClaimDailyTask = async (taskId: string): Promise<void> => {
    const actionKey = `home:daily-task:${taskId}`;
    if (pendingActionKey === actionKey) {
      return;
    }

    setPendingActionKey(actionKey);

    try {
      const result = await claimDailyTaskReward({ taskId });
      applyMutationResult(result);
    } catch {
      showToast('当前无法领取任务奖励，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleResetDemoState = async (): Promise<void> => {
    if (pendingActionKey === 'system:reset-demo-state') {
      return;
    }

    setPendingActionKey('system:reset-demo-state');

    try {
      const result = await resetDemoExperimentState();
      triggerResourcePulse(result.home);
      setViewModel((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          home: result.home,
          scenes: result.scenes,
        };
      });

      showToast(result.summary, 'success');
      setActiveScene('home');
      setRaidHubTab('targets');
      setFactionTab('overview');
      setSeedInventory(emptySeedInventory);
      setGlobalItemInventory(emptyGlobalItemInventory);
      setUnlockedSeedIds(defaultUnlockedSeedIds);
      setStarterSeedClaimed(false);
      setTianjiTalismanClaimed(false);
      setSeedRewardModal(null);
      setArmyRecruitCount(0);
      setArmyQueueRefreshReadyAt(null);
      setSeedSelectionState(null);
      setSelectedSeedId('qinglingmai');
      setFieldSeedAssignments({});
      setFarmCollectPresentation(null);
      setFollowedTargetIds([]);
      setRaidTargetDetailsById({});
    } catch {
      showToast('当前无法重置实验数据，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleRefreshRaidTargets = async (): Promise<void> => {
    if (pendingActionKey === 'raid:refresh-targets') {
      return;
    }

    setPendingActionKey('raid:refresh-targets');

    try {
      const nextViewModel = await loadClientViewModel();
      setViewModel(nextViewModel);
      setSelectedRaidTargetId(nextViewModel.scenes.raid.targets[0]?.id ?? '');
      syncSeedBackpackState(nextViewModel.bootstrap.backpack);
      showToast('目标列表已刷新，可以重新挑选掠夺对象。', 'success');
    } catch {
      showToast('当前无法刷新目标列表，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleOpenRaidTargetModal = (target: ClientRaidTarget): void => {
    setSelectedRaidTargetId(target.id);
    setRaidTargetModal({
      targetId: target.id,
      targetName: target.name,
      mode: 'raid',
    });
  };

  const handleOpenFollowedRaidTarget = (target: FollowedRaidTargetSummary): void => {
    setSelectedRaidTargetId(target.id);
    setRaidTargetModal({
      targetId: target.id,
      targetName: target.name,
      mode: 'raid',
    });
  };

  const handleToggleFollowTarget = (target: ClientRaidTarget): void => {
    const isFollowing = followedTargetIds.includes(target.id);

    setFollowedTargetIds((current) => isFollowing
      ? current.filter((targetId) => targetId !== target.id)
      : [...current, target.id]);
    showToast(isFollowing ? `已取消关注 ${target.name}。` : `已关注 ${target.name}，可在掠夺页的关注列表持续观察田地状态。`, 'success');
  };

  const findRaidTargetByContext = (context?: string): ClientRaidTarget | null => {
    return resolveRaidTargetByContext(scenes.raid.targets, context);
  };

  const applyMutationResult = (result: { home: HomeSummaryResponse; scenes: ClientViewModel['scenes']; summary: string }): void => {
    triggerResourcePulse(result.home);
    setViewModel((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        home: result.home,
        scenes: result.scenes,
      };
    });

    showToast(result.summary, 'success');
  };

  const navigateToScene = (scene: ClientSceneKey, nextRaidHubTab?: RaidHubTabKey): void => {
    setActiveScene(scene);

    if (scene === 'report' && nextRaidHubTab) {
      setRaidHubTab(nextRaidHubTab);
    }

    if (scene !== 'report' && nextRaidHubTab) {
      setRaidHubTab(nextRaidHubTab);
    }
  };

  const handleBuildingAction = async (action: ClientSceneAction, upgradeId: ClientBuildingUpgradeId | ClientCastleExtensionUpgradeId, context: string, targetType: 'building' | 'castle-extension'): Promise<void> => {
    if (action.label.includes('升级')) {
      const actionKey = `${targetType}:${upgradeId}`;
      if (pendingActionKey === actionKey) {
        return;
      }

      setPendingActionKey(actionKey);

      try {
        const result = await upgradeClientBuilding(targetType === 'building'
          ? { targetType, buildingId: upgradeId as ClientBuildingUpgradeId }
          : { targetType, extensionId: upgradeId as ClientCastleExtensionUpgradeId });
        applyMutationResult(result);
      } catch {
        showToast(`${context} 当前升级失败，请稍后重试。`, 'error');
      } finally {
        setPendingActionKey(null);
      }
      return;
    }

    handleSceneAction(action, context);
  };

  const handleFarmAction = async (action: ClientSceneAction, fieldId: string, context: string): Promise<void> => {
    const actionKey = `farm:${fieldId}:${action.label}`;
    if (pendingActionKey === actionKey) {
      return;
    }

    if (action.label === '开始培育') {
      setSelectedSeedId('qinglingmai');
      setSeedSelectionState({
        fieldId,
        fieldCode: context,
      });
      return;
    }

    if (action.label.includes('收取')) {
      const collectMode: ClientCollectFieldRequest['collectMode'] = action.label.includes('提前') ? 'early' : 'ripe';
      const field = farmFields.find((item) => item.id === fieldId);
      const pendingYield = field?.yieldGold ?? 0;
      const overflowGold = Math.max(vaultProgress.current + pendingYield - vaultProgress.capacity, 0);

      if (pendingYield > 0 && overflowGold > 0 && !collectOverflowState) {
        setCollectOverflowState({
          fieldId,
          fieldCode: context,
          collectMode,
          pendingYield,
          overflowGold,
        });
        return;
      }

      setPendingActionKey(actionKey);

      try {
        const result: ClientCollectFieldResponse = await collectFieldEarnings({
          fieldId,
          collectMode,
        });
        applyMutationResult(result);
        if (result.result.rewards.length > 0) {
          setSeedInventory((current) => {
            const nextInventory = { ...current };
            result.result.rewards.forEach((reward) => {
              nextInventory[reward.seedId] = (nextInventory[reward.seedId] ?? 0) + reward.quantity;
            });
            return nextInventory;
          });
          setUnlockedSeedIds((current) => {
            const nextIds = new Set(current);
            result.result.rewards.forEach((reward) => nextIds.add(reward.seedId));
            return Array.from(nextIds);
          });
        }
        const rewardModalPayload: SeedRewardModalState = {
          title: '收取所得',
          summary: result.result.overflowGold > 0
            ? `获得 ${formatNumber(result.result.collectedGold)} 金币，另有 ${formatNumber(result.result.overflowGold)} 因金币已满未能入账。`
            : `获得 ${formatNumber(result.result.collectedGold)} 金币。`,
          items: [
            {
              seedId: 'field-gold',
              label: '金币',
              quantity: result.result.collectedGold,
            },
            ...result.result.rewards.map((reward) => ({
              seedId: reward.seedId,
              quantity: reward.quantity,
              label: reward.label,
            })),
          ],
        };
        setFarmCollectPresentation({
          fieldId,
          tier: result.result.rewards.length > 0 ? 'critical' : 'harvest',
          showSeeds: result.result.rewards.length > 0,
        });
        window.setTimeout(() => {
          setSeedRewardModal(rewardModalPayload);
        }, FARM_COLLECT_PRESENTATION_MS);
        setFieldSeedAssignments((current) => {
          const nextAssignments = { ...current };
          delete nextAssignments[fieldId];
          return nextAssignments;
        });
        setCollectOverflowState(null);
      } catch {
        showToast(`${context} 当前无法完成收取，请稍后重试。`, 'error');
      } finally {
        setPendingActionKey(null);
      }
      return;
    }

    handleSceneAction(action, context);
  };

  const handleSceneAction = (action: ClientSceneAction, context?: string): void => {
    const actionContext = context ?? raidTargetDetail?.name ?? selectedRaidTarget?.name;

    if ((action.label === '确认出兵' || action.label === '发起掠夺') && actionContext) {
      const targetId = raidTargetModal?.targetId ?? selectedRaidTarget?.id;

      if (!targetId) {
        showToast('当前缺少可掠夺目标，请先重新选择目标。', 'error');
        return;
      }

      if (pendingActionKey === 'raid:execute') {
        return;
      }

      const runRaid = async (): Promise<void> => {
        const input: ClientRaidActionRequest = {
          targetId,
          mode: raidTargetModal?.mode ?? 'raid',
        };

        setPendingActionKey('raid:execute');

        try {
          const response = await raidClientTarget(input);
          triggerResourcePulse(response.home);
          setViewModel((current) => {
            if (!current) {
              return current;
            }

            return {
              ...current,
              home: response.home,
              scenes: response.scenes,
            };
          });
          setSelectedRaidTargetId(response.scenes.raid.targets[0]?.id ?? '');

          setSeedRewardModal({
            title: '掠夺所得',
            summary: response.result.overflowGold > 0
              ? `本次掠夺 ${formatNumber(response.result.goldLoot)} 金币，其中 ${formatNumber(response.result.depositedGold)} 已入库，另有 ${formatNumber(response.result.overflowGold)} 转入待领取，战损 ${formatNumber(response.result.casualties)} 兵。`
              : `获得 ${formatNumber(response.result.goldLoot)} 金币，战损 ${formatNumber(response.result.casualties)} 兵。`,
            items: [
              {
                seedId: 'raid-gold',
                label: '金币',
                quantity: response.result.goldLoot,
              },
              ...response.result.rewards.map((reward) => ({
                seedId: reward.seedId,
                quantity: reward.quantity,
                label: reward.label,
              })),
            ],
          });

          if (response.result.rewards.length > 0) {
            setSeedInventory((current) => {
              const nextInventory = { ...current };

              response.result.rewards.forEach((reward) => {
                nextInventory[reward.seedId] = (nextInventory[reward.seedId] ?? 0) + reward.quantity;
              });

              return nextInventory;
            });
            setUnlockedSeedIds((current) => {
              const nextIds = new Set(current);
              response.result.rewards.forEach((reward) => nextIds.add(reward.seedId));
              return Array.from(nextIds);
            });
          }

          setRaidTargetModal(null);
        } catch {
          showToast(`${actionContext} 当前无法完成掠夺，请稍后重试。`, 'error');
        } finally {
          setPendingActionKey(null);
        }
      };

      void runRaid();
      return;
    }

    if (action.label === '刷新目标') {
      void handleRefreshRaidTargets();
      return;
    }

    if (action.label.includes('复仇')) {
      const revengeTarget = findRaidTargetByContext(context);

      if (revengeTarget) {
        setSelectedRaidTargetId(revengeTarget.id);
        setRaidTargetModal({
          targetId: revengeTarget.id,
          targetName: revengeTarget.name,
          mode: 'revenge',
        });
        return;
      }
    }

    if (action.target !== activeScene || action.label.includes('返回') || action.label.includes('打开')) {
      navigateToScene(normalizeScene(action.target));
    }

    showToast(buildActionMessage(action.label, actionContext), 'info');
  };

  const handleClaimStarterSeeds = (): void => {
    if (starterSeedClaimed) {
      return;
    }

    setSeedRewardModal({
      title: '领取今日种子',
      summary: '确认后会把 青灵麦 x3 收进背包。',
      confirmAction: 'claim-starter-seeds',
      items: [{ seedId: 'qinglingmai', quantity: 3 }],
    });
  };

  const handleClaimTianjiTalisman = (): void => {
    if (tianjiTalismanClaimed) {
      return;
    }

    const currentTianjiTalismanCount = globalItemInventory.tianjiTalisman ?? 0;

    setSeedRewardModal({
      title: '领取天机符',
      summary: `当前库存 ${currentTianjiTalismanCount}，确认后会把 天机符 x1 收进全局物品。`,
      confirmAction: 'claim-tianji-talisman',
      items: [{ itemId: 'tianjiTalisman', label: '天机符', quantity: 1 }],
    });
  };

  const handleConfirmSeedCultivation = async (): Promise<void> => {
    if (!seedSelectionState) {
      return;
    }

    const seed = seedCatalogMap.get(selectedSeedId);
    if (!seed || !unlockedSeedIds.includes(seed.id)) {
      showToast('当前只可选择已解锁的种子。', 'error');
      return;
    }

    const currentCount = seedInventory[seed.id] ?? 0;
    if (currentCount <= 0) {
      showToast(`${seed.name} 库存不足，请先领取或获取种子。`, 'error');
      return;
    }

    const actionKey = `farm:${seedSelectionState.fieldId}:开始培育`;
    if (pendingActionKey === actionKey) {
      return;
    }

    setPendingActionKey(actionKey);

    try {
      const result = await startFieldCultivation({ fieldId: seedSelectionState.fieldId, seedId: seed.id });
      applyMutationResult(result);
      setSeedInventory((current) => ({
        ...current,
        [seed.id]: Math.max((current[seed.id] ?? 0) - 1, 0),
      }));
      setFieldSeedAssignments((current) => ({
        ...current,
        [seedSelectionState.fieldId]: seed.id,
      }));
      setSeedSelectionState(null);
      showToast(`${seedSelectionState.fieldCode} 已投入 ${seed.name}，开始培育。`, 'success');
    } catch {
      showToast(`${seedSelectionState.fieldCode} 当前无法开始培育，请稍后重试。`, 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  return (
    <main className="app-shell">
      <aside className="left-rail">
        <div className="brand-block">
          <p className="eyebrow">TRINITY WAR</p>
          <h1>阵营经营策略战争</h1>
          <p className="subline">Web 验证版前端，优先用于玩法、页面结构和接口走查。</p>
        </div>

        <div className="summary-card war-card">
          <p className="card-label">当前阵营</p>
          <div className="faction-row">
            <span className="faction-badge">{home.factionName}</span>
            <span className="soft-tag">主城 Lv.{home.castleLevel}</span>
          </div>
          <p className="muted">{home.playerName} · {home.staminaStatus}</p>
        </div>

        <div className="summary-card">
          <p className="card-label">今日主目标</p>
          <ul className="mini-list">
            {dailyTasks.map((item) => (
              <li key={item.id}>{item.title}</li>
            ))}
          </ul>
        </div>

        <div className="summary-card">
          <p className="card-label">关键提醒</p>
          <div className="rail-note rail-note-stack">
            <div className="rail-note-row">
              <strong>待领取总计</strong>
              <span>{formatNumber(totalPending)}</span>
            </div>
            <div className="rail-note-row">
              <span>主城税收</span>
              <em>{taxPending?.value ?? '0'}</em>
            </div>
            <div className="rail-note-row">
              <span>阵营分红</span>
              <em>{factionPending?.value ?? '0'}</em>
            </div>
          </div>
          <button className="rail-alert" onClick={() => {
            navigateToScene('report', 'reports');
            showToast('最近 1 次被掠已解锁免费复仇，已切到掠夺模块的战报页签。');
          }} type="button">
            掠夺动态 2
          </button>
        </div>

        <div className="summary-card meta-card">
          <p className="card-label">运行状态</p>
          <div className="meta-row"><span>环境</span><strong>{bootstrap.env}</strong></div>
          <div className="meta-row"><span>版本</span><strong>{bootstrap.version}</strong></div>
          <div className="meta-row"><span>时间</span><strong>{formatServerTime(bootstrap.serverTime)}</strong></div>
          <div className="meta-row"><span>数据源</span><strong>{usingMock ? '本地演示数据' : '实时接口'}</strong></div>
          <button className="secondary-button" onClick={() => {
            void handleResetDemoState();
          }} type="button">
            {pendingActionKey === 'system:reset-demo-state' ? '重置中...' : '重置实验数据'}
          </button>
        </div>
      </aside>

      <section className="phone-stage">
        <div
          className="phone-frame phone-frame-scene"
          style={{ ['--scene-bg-image' as string]: activeBackgroundImage } as React.CSSProperties}
        >
          <section className="top-dock">
            <header className="top-bar">
              <div className="top-action-group">
                <div className="season-progress-inline" aria-label="赛季进度">
                  <span className="season-progress-inline-label">{seasonProgress.label}</span>
                  <span className="season-progress-inline-detail">{seasonProgress.detail}</span>
                </div>
                <button className="ghost-button top-action-button top-item-button" onClick={() => {
                  setGlobalFeatureModal({
                    title: '天机符',
                    eyebrow: '全局物品',
                    description: '当前先预留二级弹框入口，后续会在这里接入看广告与奖券消耗逻辑。',
                  });
                }} type="button">
                  <span className="top-item-icon" aria-hidden="true">符</span>
                  <span className="top-item-count">{formatNumber(globalItemInventory.tianjiTalisman ?? 0)}</span>
                </button>
                <button className="ghost-button top-action-button" onClick={() => showToast('签到得奖券，日常活动。')} type="button">
                  活动
                </button>
                <button className="ghost-button top-action-button" onClick={() => showToast('验证版先预留设置入口，后续可继续补音效、账号和调试开关。')} type="button">
                  设置
                </button>
              </div>
            </header>

          {toast ? (
            <div className={`top-toast top-toast-${toast.tone}`}>
              <span>{toast.message}</span>
            </div>
          ) : null}

            <section className="global-resource-bar">
              <section className="resource-dock resource-dock-global">
                {resourceCards.map(({ resource, progress }) => {
                  const isVaultResource = resource.tone === 'vault';
                  const isProtectedVault = isVaultResource && isProtectionActive;
                  const pulseTone = resource.tone === 'vault'
                    ? resourcePulse.vaultTone
                    : resource.tone === 'army'
                      ? resourcePulse.armyTone
                      : null;
                  const pulseToken = resource.tone === 'vault'
                    ? resourcePulse.vaultToken
                    : resource.tone === 'army'
                      ? resourcePulse.armyToken
                      : 0;
                  const pulseToneClass = pulseTone ? ` pulse-${pulseTone}` : '';
                  const amountLabel = isProtectedVault ? '保护期' : resource.tone === 'army' ? '守护灵宠' : '当前持有';
                  const isArmyResource = resource.tone === 'army';
                  const footerValue = isProtectedVault
                    ? formatProtectionCountdown(protectionRemainingSeconds)
                    : `${Math.round(progress.ratio * 100)}%`;

                  const cardContent = (
                    <>
                      <div className="resource-dock-head">
                        <span className="resource-name">
                          {resource.label}
                          {isProtectedVault ? <span className="resource-protection-tag">◆ 防护中</span> : null}
                        </span>
                        <span className="resource-dock-capacity">上限 {formatNumber(progress.capacity)}</span>
                      </div>
                      <strong className="resource-dock-amount">{formatNumber(progress.current)}</strong>
                      <div className="resource-dock-progress" aria-hidden="true">
                        <div className={`resource-dock-progress-fill resource-dock-progress-fill-${resource.tone}`} style={{ width: `${progress.ratio * 100}%` }} />
                      </div>
                      <div className="resource-dock-foot">
                        <span>{amountLabel}</span>
                        <span>{footerValue}</span>
                      </div>
                    </>
                  );

                  return (
                    <div className={`resource-dock-card resource-dock-card-${resource.tone}${isProtectedVault ? ' resource-dock-card-protected' : ''}${pulseToneClass}`} key={`${resource.label}-${isVaultResource || isArmyResource ? pulseToken : 'steady'}`}>
                      {cardContent}
                    </div>
                  );
                })}
              </section>
            </section>
          </section>

          <section className={`screen-body scene-${activeScene}`}>
            {activeScene === 'home' ? (
              <HomeScene
                claimingStarterSeeds={pendingActionKey === 'home:claim-starter-seeds'}
                claimingTianjiTalisman={pendingActionKey === 'home:claim-tianji-talisman'}
                claimingTaskId={pendingActionKey?.startsWith('home:daily-task:') ? pendingActionKey.replace('home:daily-task:', '') : null}
                claimingTax={claimingSource === 'tax'}
                dailyTasks={dailyTasks}
                hourlyTax={hourlyTax}
                onClaimTax={() => {
                  const taxPendingAmount = taxPending ? Number(taxPending.value.replace(/,/g, '')) : 0;
                  const overflowGold = Math.max(vaultProgress.current + taxPendingAmount - vaultProgress.capacity, 0);

                  if (taxPendingAmount > 0 && overflowGold > 0) {
                    setPendingClaimOverflowState({
                      source: 'tax',
                      title: '主城税收',
                      pendingYield: taxPendingAmount,
                      overflowGold,
                    });
                    return;
                  }

                  void handleClaimPending('tax');
                }}
                onClaimTask={(taskId) => {
                  void handleClaimDailyTask(taskId);
                }}
                onClaimStarterSeeds={handleClaimStarterSeeds}
                onClaimTianjiTalisman={handleClaimTianjiTalisman}
                onNavigate={navigateToScene}
                starterSeedClaimed={starterSeedClaimed}
                tianjiTalismanClaimed={tianjiTalismanClaimed}
                taxPending={taxPending}
              />
            ) : null}

            {activeScene === 'building' ? (
              <BuildingScene
                castleLevel={home.castleLevel}
                onUpgradeAction={(action, upgradeId, context, targetType) => {
                  void handleBuildingAction(action, upgradeId, context, targetType);
                }}
                extensions={scenes.building.extensions}
                upgrades={scenes.building.upgrades}
              />
            ) : null}

            {activeScene === 'farm' ? (
              <FarmScene
                collectPresentation={farmCollectPresentation}
                farmTick={farmTick}
                fields={farmFields}
                onAction={(action, fieldId, fieldCode) => {
                  void handleFarmAction(action, fieldId, fieldCode);
                }}
              />
            ) : null}

            {activeScene === 'raid' ? (
              <ArmyScene
                armyCapacity={armyProgress.capacity}
                confirming={pendingActionKey === 'army:recruit'}
                currentArmy={armyProgress.current}
                currentGold={vaultProgress.current}
                onConfirm={() => {
                  void handleRecruitArmy();
                }}
                onSelectCount={setArmyRecruitCount}
                selectedCount={armyRecruitCount}
                trainingQueue={armyTrainingQueue}
                unitCostGold={scenes.army.unitCostGold}
                unitTrainingSeconds={scenes.army.unitTrainingSeconds}
              />
            ) : null}

            {activeScene === 'report' ? (
              <ReportScene
                activeTab={raidHubTab}
                followedTargets={followedTargets}
                heroTitle={scenes.raid.hero.title}
                onAction={handleSceneAction}
                onChangeTab={setRaidHubTab}
                onOpenFollowedTarget={handleOpenFollowedRaidTarget}
                onOpenTarget={handleOpenRaidTargetModal}
                onRefresh={() => {
                  void handleRefreshRaidTargets();
                }}
                refreshLabel={scenes.raid.hero.action.label}
                refreshPending={pendingActionKey === 'raid:refresh-targets'}
                reportEntries={mergedReportEntries}
                targets={scenes.raid.targets}
              />
            ) : null}

            {activeScene === 'faction' ? (
              <FactionScene
                contribution={scenes.faction.contribution}
                currentGold={vaultProgress.current}
                donate={scenes.faction.donate}
                donating={pendingActionKey === 'faction:donate'}
                factionPending={factionPending}
                factionTab={factionTab}
                hero={scenes.faction.hero}
                onChangeTab={setFactionTab}
                onClaim={() => {
                  const factionPendingAmount = factionPending ? Number(factionPending.value.replace(/,/g, '')) : 0;
                  const overflowGold = Math.max(vaultProgress.current + factionPendingAmount - vaultProgress.capacity, 0);

                  if (factionPendingAmount > 0 && overflowGold > 0) {
                    setPendingClaimOverflowState({
                      source: 'faction',
                      title: '阵营分红',
                      pendingYield: factionPendingAmount,
                      overflowGold,
                    });
                    return;
                  }

                  void handleClaimPending('faction');
                }}
                onDonate={(goldAmount) => {
                  void handleFactionDonate(goldAmount);
                }}
                onTransferFaction={handleTransferFaction}
                comparison={scenes.faction.comparison}
                rankings={scenes.faction.rankings}
              />
            ) : null}
          </section>

          <footer className="bottom-dock">
            {sceneKeys.map((scene) => (
              <button className={`nav-item ${activeScene === scene ? 'active' : ''}`} key={scene} onClick={() => navigateToScene(scene)} type="button">
                {sceneNavLabels[scene]}
              </button>
            ))}
          </footer>

          {raidTargetModal ? (
            <RaidIntelScreen
              detail={raidTargetDetail}
              error={raidTargetDetailError}
              farmTick={farmTick}
              followed={followedTargetIds.includes(raidTargetModal.targetId)}
              loading={raidTargetDetailLoading}
              mode={raidTargetModal.mode}
              onAction={(action) => handleSceneAction(action, raidTargetDetail?.name)}
              onClose={() => setRaidTargetModal(null)}
              onToggleFollow={() => {
                const target = raidTargetsById.get(raidTargetModal.targetId);
                if (target) {
                  handleToggleFollowTarget(target);
                }
              }}
              targetName={raidTargetModal.targetName}
            />
          ) : null}

          {seedSelectionState ? (
            <SeedSelectionScreen
              confirming={pendingActionKey === `farm:${seedSelectionState.fieldId}:开始培育`}
              fieldCode={seedSelectionState.fieldCode}
              onClose={() => setSeedSelectionState(null)}
              onConfirm={() => {
                void handleConfirmSeedCultivation();
              }}
              onSelect={setSelectedSeedId}
              seedGroups={seedGroups}
              selectedSeedId={selectedSeedId}
            />
          ) : null}
          {collectOverflowState ? (
            <div className="modal-backdrop collect-overflow-backdrop">
              <div className="modal-card transfer-card collect-overflow-card">
                <div>
                  <p className="eyebrow">金币将溢出</p>
                  <h3>是否继续收取？</h3>
                </div>
                <p className="panel-text">{collectOverflowState.fieldCode} 本次预计收取 {formatNumber(collectOverflowState.pendingYield)} 金币，其中约 {formatNumber(collectOverflowState.overflowGold)} 会因金币已满无法入账。你可以先去处理金币，再回来收取。</p>
                <div className="transfer-foot-row">
                  <button className="ghost-button" onClick={() => setCollectOverflowState(null)} type="button">取消</button>
                  <button className="secondary-button" onClick={() => {
                    const nextField = farmFields.find((item) => item.id === collectOverflowState.fieldId);
                    const nextAction: ClientSceneAction = {
                      label: collectOverflowState.collectMode === 'early' ? '提前收取' : '成熟收取',
                      target: 'farm',
                      tone: collectOverflowState.collectMode === 'early' ? 'secondary' : 'primary',
                    };
                    setCollectOverflowState(null);
                    void handleFarmAction(nextAction, collectOverflowState.fieldId, nextField?.code ?? collectOverflowState.fieldCode);
                  }} type="button">继续收取</button>
                </div>
              </div>
            </div>
          ) : null}
          {pendingClaimOverflowState ? (
            <div className="modal-backdrop collect-overflow-backdrop">
              <div className="modal-card transfer-card collect-overflow-card">
                <div>
                  <p className="eyebrow">金币将溢出</p>
                  <h3>是否继续领取？</h3>
                </div>
                <p className="panel-text">{pendingClaimOverflowState.title} 本次预计领取 {formatNumber(pendingClaimOverflowState.pendingYield)} 金币，其中约 {formatNumber(pendingClaimOverflowState.overflowGold)} 会因金币已满无法入账。你可以先去处理金币，再回来领取。</p>
                <div className="transfer-foot-row">
                  <button className="ghost-button" onClick={() => setPendingClaimOverflowState(null)} type="button">取消</button>
                  <button className="secondary-button" onClick={() => {
                    void handleClaimPending(pendingClaimOverflowState.source, true);
                    setPendingClaimOverflowState(null);
                  }} type="button">继续领取</button>
                </div>
              </div>
            </div>
          ) : null}
          {globalFeatureModal ? (
            <GlobalFeatureModal
              description={globalFeatureModal.description}
              eyebrow={globalFeatureModal.eyebrow}
              onClose={() => setGlobalFeatureModal(null)}
              title={globalFeatureModal.title}
            />
          ) : null}
          {seedRewardModal ? (
            <div className="seed-reward-modal" role="status" aria-live="polite">
              <div className="seed-reward-card">
                <p className="eyebrow">{seedRewardModal.title}</p>
                <h3>{seedRewardModal.title}</h3>
                {seedRewardModal.summary ? <p>{seedRewardModal.summary}</p> : null}
                <div className="seed-reward-list">
                  {seedRewardModal.items.map((item) => {
                    const seed = item.seedId ? seedCatalogMap.get(item.seedId) : undefined;
                    return (
                      <div className="seed-reward-item" key={`${item.seedId ?? item.itemId ?? item.label ?? 'default'}-${item.quantity}`}>
                        <strong>{item.label ?? seed?.name ?? item.itemId ?? item.seedId}</strong>
                        <span>x {item.quantity}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="transfer-foot-row seed-reward-actions">
                  <button className="secondary-button" disabled={pendingActionKey === 'home:claim-starter-seeds' || pendingActionKey === 'home:claim-tianji-talisman'} onClick={() => {
                    if (seedRewardModal.confirmAction === 'claim-starter-seeds') {
                      void handleConfirmStarterSeedClaim();
                      return;
                    }

                    if (seedRewardModal.confirmAction === 'claim-tianji-talisman') {
                      void handleConfirmTianjiTalismanClaim();
                      return;
                    }

                    setSeedRewardModal(null);
                  }} type="button">{pendingActionKey === 'home:claim-starter-seeds' || pendingActionKey === 'home:claim-tianji-talisman' ? '收取中...' : '确认'}</button>
                </div>
              </div>
            </div>
          ) : null}
          {activeTemporaryClaim ? (
            <button
              aria-label={`待领取 ${formatNumber(activeTemporaryClaim.goldAmount)} 金币，剩余 ${formatTemporaryClaimCountdown(temporaryClaimRemainingSeconds)}`}
              className="temporary-claim-widget"
              disabled={claimingSource === 'raid-overflow'}
              onClick={() => {
                void handleClaimPending('raid-overflow');
              }}
              type="button"
            >
              <span className="temporary-claim-countdown">{claimingSource === 'raid-overflow' ? '领取中' : formatTemporaryClaimCountdown(temporaryClaimRemainingSeconds)}</span>
              <span className="temporary-claim-icon" aria-hidden="true">
                <span className="temporary-claim-hand short" />
                <span className="temporary-claim-hand long" />
              </span>
              <span className="temporary-claim-label">待领取</span>
              <strong className="temporary-claim-amount">{formatNumber(activeTemporaryClaim.goldAmount)}</strong>
            </button>
          ) : null}
        </div>
      </section>

    </main>
  );
}

export default App;