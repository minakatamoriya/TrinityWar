import { useEffect, useState } from 'react';
import type {
  ClientBuildingUpgradeId,
  ClientClaimPendingRequest,
  ClientRaidTarget,
  ClientRaidTargetDetailResponse,
  ClientSceneAction,
  ClientSceneKey,
  HomeSummaryResponse,
} from '@trinitywar/shared';
import { claimPendingEarnings, collectFieldEarnings, loadClientViewModel, loadRaidTargetDetail, resetDemoExperimentState, startFieldCultivation, type ClientViewModel, upgradeClientBuilding } from './api';
import { RaidIntelScreen } from './ui/raid/RaidIntelScreen';
import { RaidScene } from './ui/raid/RaidScene';
import { BuildingScene } from './ui/scenes/BuildingScene';
import { FactionScene } from './ui/scenes/FactionScene';
import { FarmScene } from './ui/scenes/FarmScene';
import { HomeScene } from './ui/scenes/HomeScene';
import { ReportScene } from './ui/scenes/ReportScene';
import { SeedSelectionScreen } from './ui/scenes/SeedSelectionScreen';

type ReportTabKey = 'defense' | 'attack';
type FactionTabKey = 'overview' | 'donate' | 'rank';

interface ToastState {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface RaidResultState {
  targetName: string;
  summary: string;
  loot: string;
}

interface RaidTargetModalState {
  targetId: string;
  targetName: string;
  mode: 'raid' | 'revenge';
}

interface HomeTaskItem {
  id: string;
  title: string;
  description: string;
  scene: ClientSceneKey;
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
  items: Array<{
    seedId: string;
    quantity: number;
  }>;
}

interface SeedSelectionState {
  fieldId: string;
  fieldCode: string;
}

const homeTaskItems: HomeTaskItem[] = [
  {
    id: 'claim-tax',
    title: '领取主城税收',
    description: '先把待领取税收入库，保证后续升级和播种不断档。',
    scene: 'home',
  },
  {
    id: 'collect-farm',
    title: '收取成熟田地',
    description: '直接前往农场收菜，成熟地块收回后可继续播种。',
    scene: 'farm',
  },
  {
    id: 'raid-target',
    title: '发起一次掠夺',
    description: '跳转到掠夺页，直接查看匿名目标并验证出兵。',
    scene: 'raid',
  },
];

const seedCatalog: SeedCatalogItem[] = [
  { id: 'lingmai', name: '灵麦', rarity: 'common', description: '普通、金币型、短线，初始唯一可培育种子。', unlockedByDefault: true },
  { id: 'yingdou', name: '影豆', rarity: 'common', description: '普通、速熟型、短线，适合高频上线。', unlockedByDefault: false },
  { id: 'chihu', name: '赤葫', rarity: 'common', description: '普通、金币型、标准，收益稳。', unlockedByDefault: false },
  { id: 'yuzhe', name: '玉蔗', rarity: 'common', description: '普通、爆发型、标准，丰熟收益高。', unlockedByDefault: false },
  { id: 'xuanSu', name: '玄粟', rarity: 'common', description: '普通、金币型、长线，适合低频上线。', unlockedByDefault: false },
  { id: 'yaokui', name: '曜葵', rarity: 'rare', description: '稀有、金币型、标准，中期主力。', unlockedByDefault: false },
  { id: 'hanmei', name: '寒莓', rarity: 'rare', description: '稀有、速熟型、短线，循环效率高。', unlockedByDefault: false },
  { id: 'chijiao', name: '炽椒', rarity: 'rare', description: '稀有、爆发型、标准，容易成为目标。', unlockedByDefault: false },
  { id: 'yuelan', name: '月兰', rarity: 'rare', description: '稀有、收藏型、长线，图鉴价值高。', unlockedByDefault: false },
  { id: 'longteng', name: '龙藤', rarity: 'legendary', description: '传说、爆发型、长线，全服热度目标。', unlockedByDefault: false },
  { id: 'xiaolian', name: '霄莲', rarity: 'legendary', description: '传说、收藏型、标准，身份价值最高。', unlockedByDefault: false },
];

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

interface ResourcePulseState {
  vaultTone: 'gain' | 'spend' | null;
  vaultToken: number;
}

const sceneNavLabels: Record<ClientSceneKey, string> = {
  home: '主城',
  building: '建筑',
  farm: '农场',
  raid: '掠夺',
  report: '战报',
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

function parseVaultValue(value: string): { current: number; capacity: number; ratio: number } {
  const parts = value.split('/').map((part) => Number(part.replace(/,/g, '').trim()));
  const current = parts[0] ?? 0;
  const capacity = parts[1] ?? 1;
  const ratio = capacity > 0 ? Math.min(current / capacity, 1) : 0;

  return { current, capacity, ratio };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function findResource(label: string, resources: HomeSummaryResponse['resources']): HomeSummaryResponse['resources'][number] | undefined {
  return resources.find((resource) => resource.label === label);
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

function App(): JSX.Element {
  const [viewModel, setViewModel] = useState<ClientViewModel | null>(null);
  const [activeScene, setActiveScene] = useState<ClientSceneKey>('home');
  const [reportTab, setReportTab] = useState<ReportTabKey>('defense');
  const [factionTab, setFactionTab] = useState<FactionTabKey>('overview');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [selectedRaidTargetId, setSelectedRaidTargetId] = useState<string>('');
  const [raidTargetModal, setRaidTargetModal] = useState<RaidTargetModalState | null>(null);
  const [raidTargetDetail, setRaidTargetDetail] = useState<ClientRaidTargetDetailResponse | null>(null);
  const [raidTargetDetailLoading, setRaidTargetDetailLoading] = useState(false);
  const [raidTargetDetailError, setRaidTargetDetailError] = useState<string | null>(null);
  const [raidResult, setRaidResult] = useState<RaidResultState | null>(null);
  const [claimingSource, setClaimingSource] = useState<ClientClaimPendingRequest['source'] | null>(null);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [farmTick, setFarmTick] = useState(0);
  const [resourcePulse, setResourcePulse] = useState<ResourcePulseState>({
    vaultTone: null,
    vaultToken: 0,
  });
  const [seedInventory, setSeedInventory] = useState<Record<string, number>>(emptySeedInventory);
  const [unlockedSeedIds, setUnlockedSeedIds] = useState<string[]>(defaultUnlockedSeedIds);
  const [starterSeedClaimed, setStarterSeedClaimed] = useState(false);
  const [seedRewardModal, setSeedRewardModal] = useState<SeedRewardModalState | null>(null);
  const [seedSelectionState, setSeedSelectionState] = useState<SeedSelectionState | null>(null);
  const [selectedSeedId, setSelectedSeedId] = useState<string>('lingmai');
  const [fieldSeedAssignments, setFieldSeedAssignments] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    void loadClientViewModel().then((data) => {
      if (!active) {
        return;
      }

      setViewModel(data);
      setSelectedRaidTargetId(data.scenes.raid.targets[0]?.id ?? '');
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!viewModel) {
      return;
    }

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
    if (!seedRewardModal) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSeedRewardModal(null);
    }, 2200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [seedRewardModal]);

  useEffect(() => {
    if (!raidTargetModal) {
      setRaidTargetDetail(null);
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
  }, [raidTargetModal]);

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
  const activeReportEntries = reportTab === 'defense' ? scenes.report.defense : scenes.report.attack;
  const activeBackgroundImage = `url(${getSceneBackground(activeScene, home.factionName)})`;
  const vaultResource = findResource('我的金币', home.resources);
  const pendingClaims = home.pendingClaims ?? [];
  const taxPending = pendingClaims.find((claim) => claim.source === 'tax');
  const factionPending = pendingClaims.find((claim) => claim.source === 'faction');
  const totalPending = pendingClaims.reduce((sum, claim) => sum + Number(claim.value.replace(/,/g, '')), 0);
  const vaultProgress = vaultResource ? parseVaultValue(vaultResource.value) : null;
  const seasonProgress = buildSeasonProgress(bootstrap.season);
  const hourlyTax = parseHourlyTax(taxPending?.description);
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
  const starterSeedCount = seedInventory.lingmai ?? 0;
  const farmFields = scenes.farm.fields.map((field) => {
    const assignedSeedId = fieldSeedAssignments[field.id];
    const assignedSeed = assignedSeedId ? seedCatalogMap.get(assignedSeedId) : undefined;

    if (!assignedSeed || (field.tone !== 'seeded' && field.tone !== 'growing' && field.tone !== 'mature' && field.tone !== 'withered')) {
      return field;
    }

    return {
      ...field,
      badge: `${field.badge} · ${assignedSeed.name}`,
      description: `本轮培育：${assignedSeed.name}。${field.description}`,
    };
  });

  const showToast = (message: string, tone: ToastState['tone'] = 'info'): void => {
    setToast({
      id: Date.now(),
      message,
      tone,
    });
  };

  const triggerResourcePulse = (nextHome: HomeSummaryResponse): void => {
    const currentVaultAmount = vaultResource ? parseVaultValue(vaultResource.value).current : 0;
    const nextVaultResource = findResource('我的金币', nextHome.resources);
    const nextVaultAmount = nextVaultResource ? parseVaultValue(nextVaultResource.value).current : 0;

    setResourcePulse((current) => ({
      vaultTone: nextVaultAmount === currentVaultAmount ? current.vaultTone : nextVaultAmount > currentVaultAmount ? 'gain' : 'spend',
      vaultToken: nextVaultAmount === currentVaultAmount ? current.vaultToken : current.vaultToken + 1,
    }));
  };

  const handleClaimPending = async (source: ClientClaimPendingRequest['source']): Promise<void> => {
    if (claimingSource === source) {
      return;
    }

    setClaimingSource(source);

    try {
      const result = await claimPendingEarnings({ source });
      applyMutationResult(result);
    } catch {
      showToast('当前无法完成收益入库，请稍后重试。', 'error');
    } finally {
      setClaimingSource(null);
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
      setReportTab('defense');
      setFactionTab('overview');
      setRaidResult(null);
      setSeedInventory(emptySeedInventory);
      setUnlockedSeedIds(defaultUnlockedSeedIds);
      setStarterSeedClaimed(false);
      setSeedRewardModal(null);
      setSeedSelectionState(null);
      setSelectedSeedId('lingmai');
      setFieldSeedAssignments({});
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

  const findRaidTargetByContext = (context?: string): ClientRaidTarget | null => {
    if (!context) {
      return scenes.raid.targets[0] ?? null;
    }

    const matchedTarget = scenes.raid.targets.find((target) => context.includes(target.name));
    return matchedTarget ?? scenes.raid.targets[0] ?? null;
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

  const handleBuildingAction = async (action: ClientSceneAction, buildingId: ClientBuildingUpgradeId, context: string): Promise<void> => {
    if (action.label.includes('升级')) {
      const actionKey = `building:${buildingId}`;
      if (pendingActionKey === actionKey) {
        return;
      }

      setPendingActionKey(actionKey);

      try {
        const result = await upgradeClientBuilding({ buildingId });
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

    if (action.label.includes('解锁')) {
      setPendingActionKey(actionKey);

      try {
        const result = await upgradeClientBuilding({ buildingId: 'field-slot' });
        applyMutationResult(result);
      } catch {
        showToast(`${context} 当前无法完成解锁，请稍后重试。`, 'error');
      } finally {
        setPendingActionKey(null);
      }
      return;
    }

    if (action.label === '开始培育') {
      setSelectedSeedId('lingmai');
      setSeedSelectionState({
        fieldId,
        fieldCode: context,
      });
      return;
    }

    if (action.label.includes('收取')) {
      setPendingActionKey(actionKey);

      try {
        const result = await collectFieldEarnings({
          fieldId,
          collectMode: action.label.includes('提前') ? 'early' : 'ripe',
        });
        applyMutationResult(result);
        setFieldSeedAssignments((current) => {
          const nextAssignments = { ...current };
          delete nextAssignments[fieldId];
          return nextAssignments;
        });
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
    const actionLoot = selectedRaidTarget?.loot ?? '待结算';

    if ((action.label === '确认出兵' || action.label === '发起掠夺') && actionContext) {
      setRaidResult({
        targetName: actionContext,
        summary: `你对${actionContext}发起了一次验证版出兵。`,
        loot: actionLoot,
      });
      setActiveScene('report');
      setReportTab('attack');
      setRaidTargetModal(null);
      showToast(`目标 ${actionContext}，预估可得 ${actionLoot}。`, 'success');
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
      setActiveScene(normalizeScene(action.target));
    }

    showToast(buildActionMessage(action.label, actionContext), 'info');
  };

  const handleClaimStarterSeeds = (): void => {
    if (starterSeedClaimed) {
      return;
    }

    setSeedInventory((current) => ({
      ...current,
      lingmai: (current.lingmai ?? 0) + 3,
    }));
    setUnlockedSeedIds((current) => current.includes('lingmai') ? current : [...current, 'lingmai']);
    setStarterSeedClaimed(true);
    setSeedRewardModal({
      title: '领取成功',
      summary: '已入库新手种子，可直接前往农场开始第一轮培育。',
      items: [{ seedId: 'lingmai', quantity: 3 }],
    });
    showToast('已领取 3 颗灵麦种子。', 'success');
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
      const result = await startFieldCultivation({ fieldId: seedSelectionState.fieldId });
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
            {homeTaskItems.map((item) => (
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
          <button className="rail-alert" onClick={() => showToast('最近 1 次被掠已解锁免费复仇，可直接跳到掠夺页验证复仇链路。')} type="button">
            战报未读 2
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
          <header className="top-bar">
            <div className="top-action-group">
              <div className="season-progress-inline" aria-label="赛季进度">
                <span className="season-progress-inline-label">{seasonProgress.label}</span>
                <span className="season-progress-inline-detail">{seasonProgress.detail}</span>
              </div>
              <button className="ghost-button top-action-button" onClick={() => showToast('验证版先预留好友入口，后续可继续补好友列表。')} type="button">
                好友
              </button>
              <button className="ghost-button top-action-button" onClick={() => showToast('验证版先预留商城入口，后续可继续补礼包、月卡和折扣链路。')} type="button">
                商城
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
              {vaultResource && vaultProgress ? (
                <div className={`resource-dock-card resource-dock-card-vault ${resourcePulse.vaultTone ? `pulse-${resourcePulse.vaultTone}` : ''}`} key={`${vaultResource.label}-${resourcePulse.vaultToken}`}>
                  <div className="resource-dock-head">
                    <span className="resource-name">{vaultResource.label}</span>
                    <span className="resource-dock-capacity">上限 {formatNumber(vaultProgress.capacity)}</span>
                  </div>
                  <strong className="resource-dock-amount">{formatNumber(vaultProgress.current)}</strong>
                  <div className="resource-dock-progress" aria-hidden="true">
                    <div className="resource-dock-progress-fill resource-dock-progress-fill-vault" style={{ width: `${vaultProgress.ratio * 100}%` }} />
                  </div>
                  <div className="resource-dock-foot">
                    <span>当前持有</span>
                    <span>{Math.round(vaultProgress.ratio * 100)}%</span>
                  </div>
                </div>
              ) : null}
            </section>
          </section>

          <section className={`screen-body scene-${activeScene}`}>
            {activeScene === 'home' ? (
              <HomeScene
                castleLevel={home.castleLevel}
                claimingTax={claimingSource === 'tax'}
                hourlyTax={hourlyTax}
                onClaimTax={() => {
                  void handleClaimPending('tax');
                }}
                onClaimStarterSeeds={handleClaimStarterSeeds}
                onNavigate={setActiveScene}
                starterSeedClaimed={starterSeedClaimed}
                starterSeedCount={starterSeedCount}
                taxPending={taxPending}
              />
            ) : null}

            {activeScene === 'building' ? (
              <BuildingScene
                onUpgradeAction={(action, buildingId, context) => {
                  void handleBuildingAction(action, buildingId, context);
                }}
                upgrades={scenes.building.upgrades}
              />
            ) : null}

            {activeScene === 'farm' ? (
              <FarmScene
                farmTick={farmTick}
                fields={farmFields}
                onAction={(action, fieldId, fieldCode) => {
                  void handleFarmAction(action, fieldId, fieldCode);
                }}
              />
            ) : null}

            {activeScene === 'raid' ? (
              <RaidScene
                heroTitle={scenes.raid.hero.title}
                onOpenTarget={handleOpenRaidTargetModal}
                onRefresh={() => {
                  void handleRefreshRaidTargets();
                }}
                refreshLabel={scenes.raid.hero.action.label}
                refreshPending={pendingActionKey === 'raid:refresh-targets'}
                targets={scenes.raid.targets}
              />
            ) : null}

            {activeScene === 'report' ? (
              <ReportScene
                actions={scenes.report.actions}
                activeEntries={activeReportEntries}
                onAction={handleSceneAction}
                onChangeTab={setReportTab}
                onDismissResult={() => setRaidResult(null)}
                raidResult={raidResult}
                reportTab={reportTab}
              />
            ) : null}

            {activeScene === 'faction' ? (
              <FactionScene
                claiming={claimingSource === 'faction'}
                donate={scenes.faction.donate}
                factionPending={factionPending}
                factionTab={factionTab}
                hero={scenes.faction.hero}
                onAction={handleSceneAction}
                onChangeTab={setFactionTab}
                onClaim={() => {
                  void handleClaimPending('faction');
                }}
                overview={scenes.faction.overview}
                rankings={scenes.faction.rankings}
              />
            ) : null}
          </section>

          <footer className="bottom-dock">
            {sceneKeys.map((scene) => (
              <button className={`nav-item ${activeScene === scene ? 'active' : ''}`} key={scene} onClick={() => setActiveScene(scene)} type="button">
                {sceneNavLabels[scene]}
              </button>
            ))}
          </footer>

          {raidTargetModal ? (
            <RaidIntelScreen
              detail={raidTargetDetail}
              error={raidTargetDetailError}
              loading={raidTargetDetailLoading}
              mode={raidTargetModal.mode}
              onAction={(action) => handleSceneAction(action, raidTargetDetail?.name)}
              onClose={() => setRaidTargetModal(null)}
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

          {seedRewardModal ? (
            <div className="seed-reward-modal" role="status" aria-live="polite">
              <div className="seed-reward-card">
                <p className="eyebrow">{seedRewardModal.title}</p>
                <h3>种子入库</h3>
                <p>{seedRewardModal.summary}</p>
                <div className="seed-reward-list">
                  {seedRewardModal.items.map((item) => {
                    const seed = seedCatalogMap.get(item.seedId);
                    return (
                      <div className="seed-reward-item" key={item.seedId}>
                        <strong>{seed?.name ?? item.seedId}</strong>
                        <span>x {item.quantity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

    </main>
  );
}

export default App;