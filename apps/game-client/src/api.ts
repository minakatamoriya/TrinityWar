import {
  ARMY_RECRUIT_GOLD_COST_PER_UNIT,
  ARMY_RECRUIT_SECONDS_PER_UNIT,
  CLIENT_API_PREFIX,
  type ClientBootstrapResponse,
  type ClientArmyTrainingQueue,
  type ClientRaidActionRequest,
  type ClientRaidActionResponse,
  type ClientFactionDonateRequest,
  type ClientClaimPendingRequest,
  type ClientClaimPendingResponse,
  type ClientCollectFieldRequest,
  type ClientCollectFieldResponse,
  type ClientRaidTargetDetailResponse,
  type ClientRecruitArmyRequest,
  type ClientResetDemoStateResponse,
  type ClientSceneContentResponse,
  type ClientStartCultivationRequest,
  type ClientStateMutationResponse,
  type ClientUpgradeBuildingRequest,
  type HomeSummaryResponse,
} from '@trinitywar/shared';
import { mockBootstrap, mockHomeSummary, mockRaidTargetDetails, mockSceneContent } from './mockData';

type DataSource = 'api' | 'mock';

interface DataEnvelope<T> {
  data: T;
  source: DataSource;
}

export interface ClientViewModel {
  bootstrap: ClientBootstrapResponse;
  home: HomeSummaryResponse;
  scenes: ClientSceneContentResponse;
  usingMock: boolean;
}

function normalizeBootstrap(bootstrap: ClientBootstrapResponse): ClientBootstrapResponse {
  return {
    ...bootstrap,
    season: { ...bootstrap.season },
    backpack: {
      seedInventory: { ...bootstrap.backpack.seedInventory },
      unlockedSeedIds: [...bootstrap.backpack.unlockedSeedIds],
      starterSeedClaimed: bootstrap.backpack.starterSeedClaimed,
    },
  };
}

function cloneBootstrap(bootstrap: ClientBootstrapResponse): ClientBootstrapResponse {
  return normalizeBootstrap(bootstrap);
}

let mockBootstrapSnapshot: ClientBootstrapResponse = cloneBootstrap(mockBootstrap);
let mockHomeSnapshot: HomeSummaryResponse = cloneHomeSummary(mockHomeSummary);
let mockSceneSnapshot: ClientSceneContentResponse = cloneSceneContent(mockSceneContent);
const INITIAL_MOCK_FACTION_CONTRIBUTION = 40;
const INITIAL_MOCK_FACTION_TREASURY_GOLD = 82400;
const INITIAL_MOCK_FACTION_ARMY_POWER = 1260;
const INITIAL_MOCK_FIELD_SEED_ASSIGNMENTS: Record<string, string> = {
  'field-1': 'lingmai',
  'field-2': 'lingmai',
  'field-3': 'lingmai',
};
let mockFactionContribution = INITIAL_MOCK_FACTION_CONTRIBUTION;
let mockFactionTreasuryGold = INITIAL_MOCK_FACTION_TREASURY_GOLD;
let mockFactionArmyPower = INITIAL_MOCK_FACTION_ARMY_POWER;
let mockFieldSeedAssignments: Record<string, string> = { ...INITIAL_MOCK_FIELD_SEED_ASSIGNMENTS };

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

function normalizeHomeSummary(home: HomeSummaryResponse): HomeSummaryResponse {
  return {
    ...home,
    protectedUntil: home.protectedUntil ?? null,
    resources: (home.resources ?? []).map((resource) => ({ ...resource })),
    pendingClaims: (home.pendingClaims ?? []).map((claim) => ({ ...claim })),
    primaryActions: (home.primaryActions ?? []).map((action) => ({ ...action })),
  };
}

function cloneHomeSummary(home: HomeSummaryResponse): HomeSummaryResponse {
  return normalizeHomeSummary(home);
}

function cloneSceneContent(scenes: ClientSceneContentResponse): ClientSceneContentResponse {
  return structuredClone(scenes);
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const response = await fetch(path, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchWithFallback<T>(path: string, fallback: T): Promise<DataEnvelope<T>> {
  try {
    return {
      data: await fetchJson<T>(path),
      source: 'api',
    };
  } catch {
    return {
      data: fallback,
      source: 'mock',
    };
  }
}

export async function loadClientViewModel(): Promise<ClientViewModel> {
  syncMockArmyTrainingQueue();

  const [bootstrap, home, scenes] = await Promise.all([
    fetchWithFallback<ClientBootstrapResponse>(`${CLIENT_API_PREFIX}/bootstrap`, mockBootstrapSnapshot),
    fetchWithFallback<HomeSummaryResponse>(`${CLIENT_API_PREFIX}/home-summary`, mockHomeSnapshot),
    fetchWithFallback<ClientSceneContentResponse>(`${CLIENT_API_PREFIX}/scene-content`, mockSceneSnapshot),
  ]);

  return {
    bootstrap: normalizeBootstrap(bootstrap.data),
    home: normalizeHomeSummary(home.data),
    scenes: scenes.data,
    usingMock: bootstrap.source === 'mock' || home.source === 'mock' || scenes.source === 'mock',
  };
}

function parseNumberText(value: string): number {
  const normalized = value.replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  return normalized ? Number(normalized) : 0;
}

function parseCurrentAndCapacity(value: string): { current: number; capacity: number } {
  const [currentText = '0', capacityText = '0'] = value.split('/');

  return {
    current: parseNumberText(currentText),
    capacity: parseNumberText(capacityText),
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function parseFieldYield(description: string): number {
  const match = description.match(/(?:可收|返还|收取金额)\s([\d,]+)/);
  return match ? parseNumberText(match[1]) : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function updateMockFieldStatus(): void {
  const matureCount = mockSceneSnapshot.farm.fields.filter((field) => field.tone === 'mature' || field.tone === 'withered').length;
  const growingCount = mockSceneSnapshot.farm.fields.filter((field) => field.tone === 'seeded' || field.tone === 'growing').length;

  mockHomeSnapshot.fieldStatus = `丰熟田地 ${matureCount} 块，成熟中 ${growingCount} 块`;
  mockSceneSnapshot.farm.hero.title = `丰熟 ${matureCount} 块 · 成熟中 ${growingCount} 块`;
  mockSceneSnapshot.farm.hero.description = mockSceneSnapshot.farm.fields.some((field) => field.tone === 'empty')
    ? '农场以田地为主，点击空地即可继续播种，进入丰熟后直接收取。'
    : '农场地块已排满，可直接收取丰熟地块或解锁新田位。';
  mockSceneSnapshot.farm.hero.action = mockSceneSnapshot.farm.fields.some((field) => field.tone === 'empty')
    ? { label: '开始培育', target: 'farm', tone: 'primary' }
    : { label: '解锁田地', target: 'farm', tone: 'secondary' };
}

function applyMockSeedRewards(rewards: Array<{ seedId: string; quantity: number }>): void {
  rewards.forEach((reward) => {
    mockBootstrapSnapshot.backpack.seedInventory[reward.seedId] = (mockBootstrapSnapshot.backpack.seedInventory[reward.seedId] ?? 0) + reward.quantity;
    if (!mockBootstrapSnapshot.backpack.unlockedSeedIds.includes(reward.seedId)) {
      mockBootstrapSnapshot.backpack.unlockedSeedIds.push(reward.seedId);
    }
  });
}

function buildMockMutation(summary: string): ClientStateMutationResponse {
  syncMockArmyTrainingQueue();
  updateMockFieldStatus();
  syncMockFactionScene();

  return {
    app: mockHomeSnapshot.app,
    summary,
    home: cloneHomeSummary(mockHomeSnapshot),
    scenes: cloneSceneContent(mockSceneSnapshot),
  };
}

function buildMockCollectResponse(summary: string, collectedGold: number, overflowGold: number, rewards: ClientCollectFieldResponse['result']['rewards']): ClientCollectFieldResponse {
  syncMockArmyTrainingQueue();
  updateMockFieldStatus();
  syncMockFactionScene();

  return {
    app: mockHomeSnapshot.app,
    summary,
    home: cloneHomeSummary(mockHomeSnapshot),
    scenes: cloneSceneContent(mockSceneSnapshot),
    result: {
      collectedGold,
      overflowGold,
      rewards,
    },
  };
}

function getMockArmyQueue(): ClientArmyTrainingQueue | null {
  return mockSceneSnapshot.army.queue;
}

function syncMockArmyTrainingQueue(): void {
  const queue = getMockArmyQueue();

  if (!queue) {
    return;
  }

  const remainingSeconds = Math.max(Math.ceil((new Date(queue.readyAt).getTime() - Date.now()) / 1000), 0);

  if (remainingSeconds <= 0) {
    applyArmyCountDelta(queue.queuedUnits);
    mockSceneSnapshot.army.queue = null;
    return;
  }

  mockSceneSnapshot.army.queue = {
    ...queue,
    remainingSeconds,
  };
}

function applyVaultGoldDelta(delta: number): void {
  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'vault');
  if (!vaultResource) {
    return;
  }

  const vault = parseCurrentAndCapacity(vaultResource.value);
  const nextVaultGold = Math.max(vault.current + delta, 0);
  vaultResource.value = `${formatNumber(nextVaultGold)} / ${formatNumber(vault.capacity)}`;
}

function applyArmyCountDelta(delta: number): void {
  const armyResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'army');
  if (!armyResource) {
    return;
  }

  const army = parseCurrentAndCapacity(armyResource.value);
  const nextArmyCount = Math.min(Math.max(army.current + delta, 0), army.capacity);
  armyResource.value = `${formatNumber(nextArmyCount)} / ${formatNumber(army.capacity)}`;
}

function findMockPendingClaim(source: ClientClaimPendingRequest['source']): HomeSummaryResponse['pendingClaims'][number] | undefined {
  return mockHomeSnapshot.pendingClaims.find((claim) => claim.source === source);
}

function syncMockFactionScene(): void {
  const factionClaim = findMockPendingClaim('faction');
  const baseDividend = 160;
  const bonusDividend = mockFactionContribution;
  const totalDividend = baseDividend + bonusDividend;

  if (factionClaim) {
    factionClaim.description = `当前每小时可分到 ${formatNumber(totalDividend)} 金币，其中基础分红 ${formatNumber(baseDividend)}，贡献加成 ${formatNumber(bonusDividend)}。`;
  }

  mockSceneSnapshot.faction.hero = {
    eyebrow: '阵营面板',
    title: '人界阵营',
    description: `当前每小时分红 ${formatNumber(totalDividend)}，先上缴再领取会更划算。`,
    advantage: '人界优势：更擅长把上缴资源转成贡献与分红，适合平衡运营。',
    breakdown: `金额构成：基础分红 ${formatNumber(baseDividend)} + 贡献加成 ${formatNumber(bonusDividend)}`,
    action: { label: '领取分红', target: 'faction', tone: 'primary' },
  };
  mockSceneSnapshot.faction.contribution = {
    title: '当前贡献值',
    value: formatNumber(mockFactionContribution),
    description: '100 金币 = 1 贡献，1 兵 = 1 贡献。捐献后会立刻反馈到贡献值与分红构成。',
  };
  mockSceneSnapshot.faction.comparison = [
    { faction: '人界', advantage: '贡献转化更稳，适合分红运营。', gold: formatNumber(mockFactionTreasuryGold), power: formatNumber(mockFactionArmyPower), isCurrent: true },
    { faction: '仙界', advantage: '被掠损失减少 10%，更适合稳守。', gold: '79,600', power: '1,180' },
    { faction: '魔界', advantage: '掠夺收益增加 10%，但战损更高。', gold: '85,300', power: '1,340' },
  ];
  mockSceneSnapshot.faction.donate = {
    title: '捐钱捐部队',
    description: '金币按 100 为一步，确认后会立即从当前总金币和总兵力扣除。',
    goldStep: 100,
    contributionRule: '100 金币 = 1 贡献，1 兵 = 1 贡献。',
  };
  mockSceneSnapshot.faction.rankings = [
    { label: '1. 烬牙', value: '86', note: '魔界' },
    { label: '2. 玄潮', value: '72', note: '魔界' },
    { label: '3. 云栖', value: '65', note: '仙界' },
    { label: '4. 你', value: formatNumber(mockFactionContribution), note: '人界' },
  ].sort((left, right) => parseNumberText(right.value) - parseNumberText(left.value)).map((entry, index) => ({
    ...entry,
    label: `${index + 1}. ${entry.label.replace(/^\d+\.\s*/, '')}`,
  }));
}

function setVaultCapacity(nextCapacity: number): void {
  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'vault');
  if (!vaultResource) {
    return;
  }

  const vault = parseCurrentAndCapacity(vaultResource.value);
  vaultResource.value = `${formatNumber(vault.current)} / ${formatNumber(nextCapacity)}`;
}

function applyMockClaimPending(input: ClientClaimPendingRequest): ClientClaimPendingResponse {
  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'vault');
  const pendingClaim = findMockPendingClaim(input.source);

  if (!vaultResource || !pendingClaim) {
    throw new Error('Mock home summary is missing required resources.');
  }

  const vault = parseCurrentAndCapacity(vaultResource.value);
  const pendingClaimGold = parseNumberText(pendingClaim.value);
  const claimableGold = Math.min(Math.max(vault.capacity - vault.current, 0), pendingClaimGold);
  const nextVaultGold = vault.current + claimableGold;
  const remainingPendingGold = pendingClaimGold - claimableGold;
  const sourceLabel = input.source === 'tax' ? '主城税收' : '阵营分红';

  vaultResource.value = `${formatNumber(nextVaultGold)} / ${formatNumber(vault.capacity)}`;
  pendingClaim.value = formatNumber(remainingPendingGold);
  syncMockFactionScene();

  const summary = claimableGold > 0
    ? `${sourceLabel}本次入库 ${formatNumber(claimableGold)} 金币，剩余待领取 ${formatNumber(remainingPendingGold)}。`
    : `金币空间不足，当前没有可入账的${sourceLabel}。`;

  return {
    app: mockHomeSnapshot.app,
    summary,
    source: input.source,
    claimedGold: claimableGold,
    remainingPendingGold,
    ledger: {
      vaultGold: nextVaultGold,
      vaultCapacity: vault.capacity,
      taxPendingGold: parseNumberText(findMockPendingClaim('tax')?.value ?? '0'),
      factionDividendGold: parseNumberText(findMockPendingClaim('faction')?.value ?? '0'),
    },
    home: cloneHomeSummary(mockHomeSnapshot),
    scenes: cloneSceneContent(mockSceneSnapshot),
  };
}

export async function claimPendingEarnings(input: ClientClaimPendingRequest): Promise<ClientClaimPendingResponse> {
  try {
    const response = await fetchJson<ClientClaimPendingResponse>(`${CLIENT_API_PREFIX}/actions/claim-pending`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    mockHomeSnapshot = cloneHomeSummary(response.home);
    mockSceneSnapshot = cloneSceneContent(response.scenes);
    return response;
  } catch {
    return applyMockClaimPending(input);
  }
}

function applyMockCollectField(input: ClientCollectFieldRequest): ClientCollectFieldResponse {
  const field = mockSceneSnapshot.farm.fields.find((item) => item.id === input.fieldId);
  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'vault');

  if (!field || !vaultResource || field.title === '未解锁') {
    return buildMockCollectResponse('当前地块不可操作，请先解锁对应田地位。', 0, 0, []);
  }

  if (input.collectMode === 'ripe' && field.tone !== 'mature' && field.tone !== 'withered') {
    return buildMockCollectResponse('这块地当前不在成熟收取阶段。', 0, 0, []);
  }

  if (input.collectMode === 'early' && field.tone !== 'growing') {
    return buildMockCollectResponse('这块地当前不支持提前收取。', 0, 0, []);
  }

  const vault = parseCurrentAndCapacity(vaultResource.value);
  const fieldYield = parseFieldYield(field.description);
  const depositedGold = Math.min(fieldYield, Math.max(vault.capacity - vault.current, 0));
  const overflowGold = Math.max(fieldYield - depositedGold, 0);
  const plantedSeedId = mockFieldSeedAssignments[input.fieldId];
  const rewards = input.collectMode === 'ripe' && field.tone === 'mature' && plantedSeedId
    ? [{ seedId: plantedSeedId, label: seedLabelMap[plantedSeedId] ?? plantedSeedId, quantity: 1 }]
    : [];

  applyVaultGoldDelta(depositedGold);
  applyMockSeedRewards(rewards);
  field.title = '可培育';
  field.badge = '空闲地块';
  field.tone = 'empty';
  field.description = '收取金额 0 金币';
  field.actions = [{ label: '开始培育', target: 'farm', tone: 'primary' }];
  delete mockFieldSeedAssignments[input.fieldId];

  const rewardSummary = rewards.length > 0 ? `，并获得 ${rewards.map((reward) => `${reward.label} x${reward.quantity}`).join('、')}` : '';
  return buildMockCollectResponse(
    overflowGold > 0
      ? `${field.code} 已收取 ${formatNumber(depositedGold)} 金币，另有 ${formatNumber(overflowGold)} 因金币已满未能入账${rewardSummary}。`
      : `${field.code} 已收取 ${formatNumber(depositedGold)} 金币${rewardSummary}，可以立即再投入新一轮培育。`,
    depositedGold,
    overflowGold,
    rewards,
  );
}

function applyMockStartCultivation(input: ClientStartCultivationRequest): ClientStateMutationResponse {
  const field = mockSceneSnapshot.farm.fields.find((item) => item.id === input.fieldId);
  const cultivationCost = 520;
  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'vault');

  if (!field || !vaultResource || field.tone === 'locked') {
    return buildMockMutation('当前地块尚未解锁，无法开始培育。');
  }

  if (field.tone !== 'empty') {
    return buildMockMutation('当前地块已经在培育中或可直接收取。');
  }

  const vault = parseCurrentAndCapacity(vaultResource.value);
  if (vault.current < cultivationCost) {
    return buildMockMutation('金币不足，无法开始本轮培育。');
  }

  if (!mockBootstrapSnapshot.backpack.unlockedSeedIds.includes(input.seedId)) {
    return buildMockMutation('当前种子尚未解锁，无法开始本轮培育。');
  }

  if ((mockBootstrapSnapshot.backpack.seedInventory[input.seedId] ?? 0) <= 0) {
    return buildMockMutation('当前种子库存不足，无法开始本轮培育。');
  }

  applyVaultGoldDelta(-cultivationCost);
  mockBootstrapSnapshot.backpack.seedInventory[input.seedId] = Math.max((mockBootstrapSnapshot.backpack.seedInventory[input.seedId] ?? 0) - 1, 0);
  field.title = '播种期';
  field.badge = '播种';
  field.tone = 'seeded';
  field.description = '收取金额 520 金币';
  mockFieldSeedAssignments[input.fieldId] = input.seedId;
  field.actions = [
    { label: '查看阶段', target: 'farm', tone: 'ghost' },
  ];

  return buildMockMutation(`${field.code} 已投入 ${formatNumber(cultivationCost)} 金币，播下 ${seedLabelMap[input.seedId] ?? input.seedId}，开始新一轮培育。`);
}

function applyMockClaimStarterSeeds(): ClientStateMutationResponse {
  if (mockBootstrapSnapshot.backpack.starterSeedClaimed) {
    return buildMockMutation('今日种子已经领取过了。');
  }

  mockBootstrapSnapshot.backpack.starterSeedClaimed = true;
  applyMockSeedRewards([{ seedId: 'lingmai', quantity: 3 }]);

  return buildMockMutation('今日种子已领取，获得 灵麦 x3。');
}

function applyMockUpgradeBuilding(input: ClientUpgradeBuildingRequest): ClientStateMutationResponse {
  const upgrade = mockSceneSnapshot.building.upgrades.find((item) => item.id === input.buildingId);
  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'vault');

  if (!upgrade || !vaultResource || upgrade.locked) {
    return buildMockMutation('当前建筑不满足升级条件，或已达到验证上限。');
  }

  const vault = parseCurrentAndCapacity(vaultResource.value);
  const cost = parseNumberText(upgrade.costText.replace('消耗', '').replace('金币', ''));

  if (vault.current < cost) {
    return buildMockMutation('金币不足，当前无法完成升级。');
  }

  applyVaultGoldDelta(-cost);

  if (input.buildingId === 'castle') {
    mockHomeSnapshot.castleLevel += 1;
    upgrade.description = `Lv.${mockHomeSnapshot.castleLevel} -> Lv.${mockHomeSnapshot.castleLevel + 1}，解锁更高税收与建筑上限。`;
    const watchtowerUpgrade = mockSceneSnapshot.building.upgrades.find((item) => item.id === 'watchtower');
    if (watchtowerUpgrade) {
      watchtowerUpgrade.locked = false;
      watchtowerUpgrade.costText = '消耗 760 金币';
      watchtowerUpgrade.action = { label: '升级防守建筑', target: 'building', tone: 'secondary' };
    }
    return buildMockMutation(`主城升级完成，当前已升至 Lv.${mockHomeSnapshot.castleLevel}。`);
  }

  if (input.buildingId === 'vault') {
    setVaultCapacity(vault.capacity + 1600);
    upgrade.description = `Lv.4 -> Lv.5，容量由 ${formatNumber(vault.capacity + 1600)} 提升到 ${formatNumber(vault.capacity + 3200)}。`;
    return buildMockMutation(`金库升级完成，容量已提升到 ${formatNumber(vault.capacity + 1600)}。`);
  }

  if (input.buildingId === 'field-slot') {
    const lockedField = mockSceneSnapshot.farm.fields.find((field) => field.tone === 'locked');
    if (lockedField) {
      lockedField.title = '可培育';
      lockedField.badge = '空闲地块';
      lockedField.tone = 'empty';
      lockedField.description = '收取金额 0 金币';
      lockedField.actions = [{ label: '开始培育', target: 'farm', tone: 'primary' }];
    }
    upgrade.locked = true;
    upgrade.costText = '当前已全部解锁';
    upgrade.action = { label: '查看条件', target: 'building', tone: 'ghost' };
    upgrade.description = 'Lv.2，当前验证版田地位已全部解锁。';
    return buildMockMutation('田地位升级完成，新地块已经开放，可直接开始培育。');
  }

  if (input.buildingId === 'population') {
    const armyResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'army');

    if (!armyResource) {
      return buildMockMutation('当前缺少人口上限资源数据，请稍后重试。');
    }

    const army = parseCurrentAndCapacity(armyResource.value);
    const nextCapacity = army.capacity + 100;
    armyResource.value = `${formatNumber(army.current)} / ${formatNumber(nextCapacity)}`;
    upgrade.description = `Lv.2 -> Lv.3，人口上限由 ${formatNumber(nextCapacity)} 提升到 ${formatNumber(nextCapacity + 100)}。`;
    upgrade.costText = '消耗 1,180 金币';
    return buildMockMutation(`人口上限升级完成，当前人口上限已提升到 ${formatNumber(nextCapacity)}。`);
  }

  upgrade.description = 'Lv.2 -> Lv.3，进一步降低余额与田地被掠损失。';
  return buildMockMutation('防守建筑升级完成，当前已完成一轮验证内升级。');
}

function applyMockRecruitArmy(input: ClientRecruitArmyRequest): ClientStateMutationResponse {
  syncMockArmyTrainingQueue();

  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'vault');
  const armyResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'army');

  if (!vaultResource || !armyResource) {
    return buildMockMutation('当前缺少造兵所需资源数据，请稍后重试。');
  }

  const requestedCount = Math.max(Math.floor(input.recruitCount), 0);
  if (requestedCount <= 0) {
    return buildMockMutation('请输入有效的造兵数量。');
  }

  const vault = parseCurrentAndCapacity(vaultResource.value);
  const army = parseCurrentAndCapacity(armyResource.value);
  const queuedArmyCount = mockSceneSnapshot.army.queue?.queuedUnits ?? 0;
  const availableArmySpace = Math.max(army.capacity - army.current - queuedArmyCount, 0);

  if (availableArmySpace <= 0) {
    return buildMockMutation('当前战力已满，请先扩充上限后再继续造兵。');
  }

  const affordableCount = Math.floor(vault.current / ARMY_RECRUIT_GOLD_COST_PER_UNIT);
  if (affordableCount <= 0) {
    return buildMockMutation('金币不足，当前无法开始造兵。');
  }

  const actualRecruitCount = Math.min(requestedCount, availableArmySpace, affordableCount);
  const totalCost = actualRecruitCount * ARMY_RECRUIT_GOLD_COST_PER_UNIT;
  const currentQueue = mockSceneSnapshot.army.queue;
  const remainingSeconds = currentQueue
    ? Math.max(Math.ceil((new Date(currentQueue.readyAt).getTime() - Date.now()) / 1000), 0)
    : 0;
  const nextTotalSeconds = remainingSeconds + actualRecruitCount * ARMY_RECRUIT_SECONDS_PER_UNIT;

  applyVaultGoldDelta(-totalCost);
  mockSceneSnapshot.army.queue = {
    queuedUnits: (currentQueue?.queuedUnits ?? 0) + actualRecruitCount,
    totalCost: (currentQueue?.totalCost ?? 0) + totalCost,
    startedAt: new Date().toISOString(),
    readyAt: new Date(Date.now() + nextTotalSeconds * 1000).toISOString(),
    totalSeconds: nextTotalSeconds,
    remainingSeconds: nextTotalSeconds,
  };

  return buildMockMutation(
    actualRecruitCount < requestedCount
      ? `本次新增 ${formatNumber(actualRecruitCount)} 名士兵进入训练队列，已立即扣除 ${formatNumber(totalCost)} 金币；其余部分受金币或兵力上限限制。`
      : currentQueue
        ? `已追加 ${formatNumber(actualRecruitCount)} 名士兵到当前训练队列，金币已立即扣除，剩余训练时间已重算。`
        : `已开始训练 ${formatNumber(actualRecruitCount)} 名士兵，金币已立即扣除，倒计时结束后才会增加战力。`,
  );
}

function applyMockRaidTarget(input: ClientRaidActionRequest): ClientRaidActionResponse {
  const target = mockSceneSnapshot.raid.targets.find((item) => item.id === input.targetId);
  const targetDetail = mockRaidTargetDetails[input.targetId];
  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'vault');
  const armyResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'army');

  if (!target || !targetDetail || !vaultResource || !armyResource) {
    return {
      app: mockHomeSnapshot.app,
      summary: '当前目标不存在或已离开目标池。',
      home: cloneHomeSummary(mockHomeSnapshot),
      scenes: cloneSceneContent(mockSceneSnapshot),
      result: {
        targetId: input.targetId,
        targetName: '未知目标',
        goldLoot: 0,
        casualties: 0,
        rewards: [],
        protectedUntil: new Date().toISOString(),
        reportSummary: '当前目标不存在或已离开目标池。',
      },
    };
  }

  const vault = parseCurrentAndCapacity(vaultResource.value);
  const army = parseCurrentAndCapacity(armyResource.value);
  const combatPower = parseNumberText(target.combatPower);
  const raidableGold = parseNumberText(targetDetail.raidableGold);
  const powerRatio = army.current / Math.max(combatPower, 1);
  const successChance = clamp(0.18 + powerRatio * 0.72, 0.18, 0.88);
  const success = Math.random() < successChance;
  const lootRatio = clamp(0.08 + powerRatio * 0.22 + (success ? 0.08 : 0), 0.05, 0.4);
  const rawGoldLoot = Math.max(Math.round(raidableGold * lootRatio), 20);
  const depositedGold = Math.min(rawGoldLoot, Math.max(vault.capacity - vault.current, 0));
  const casualtyRatio = clamp(0.1 + (combatPower / Math.max(army.current, 1)) * 0.04 - (success ? 0.03 : 0), 0.08, 0.42);
  const casualties = Math.min(Math.max(Math.ceil(army.current * casualtyRatio), 1), army.current);
  const rewardMap: Record<string, { seedId: string; label: string; quantity: number; chance: number }> = {
    'target-1': { seedId: 'longteng', label: '龙藤', quantity: 1, chance: 0.18 },
    'target-2': { seedId: 'yuelan', label: '月兰', quantity: 1, chance: 0.14 },
    'target-3': { seedId: 'hanmei', label: '寒莓', quantity: 1, chance: 0.12 },
    'target-4': { seedId: 'chijiao', label: '炽椒', quantity: 1, chance: 0.16 },
    'target-5': { seedId: 'yaokui', label: '曜葵', quantity: 1, chance: 0.1 },
  };
  const rewardConfig = rewardMap[input.targetId];
  const rewards = rewardConfig && Math.random() < clamp(rewardConfig.chance + (powerRatio < 0.35 ? 0.08 : 0) + (success ? 0.05 : 0), 0.1, 0.55)
    ? [{ seedId: rewardConfig.seedId, label: rewardConfig.label, quantity: rewardConfig.quantity }]
    : [];

  applyVaultGoldDelta(depositedGold);
  applyMockSeedRewards(rewards);
  applyArmyCountDelta(-casualties);
  mockSceneSnapshot.raid.targets = mockSceneSnapshot.raid.targets.filter((item) => item.id !== input.targetId);
  mockSceneSnapshot.report.attack.unshift({
    title: `${target.faction} · ${target.name}`,
    tag: success ? '掠夺成功' : '强袭试探',
    tone: success ? 'success' : 'neutral',
    createdAt: new Date().toISOString(),
    summary: `你对${target.name}发起黑盒掠夺，带回 ${formatNumber(depositedGold)} 金币，战损 ${formatNumber(casualties)} 兵${rewards.length > 0 ? `，额外获得 ${rewards.map((reward) => `${reward.label} x${reward.quantity}`).join('、')}` : ''}。目标已进入 1 小时防护。`,
    actions: [{ label: '查看详情', target: 'report', tone: 'ghost' }],
  });
  mockSceneSnapshot.report.attack = mockSceneSnapshot.report.attack.slice(0, 6);
  if (input.mode === 'revenge') {
    const defenseReport = mockSceneSnapshot.report.defense.find((entry) => entry.title === `${target.faction} · ${target.name}`);
    if (defenseReport) {
      defenseReport.tag = '已复仇';
      defenseReport.unread = false;
      defenseReport.revengeable = false;
      defenseReport.summary = '已完成复仇，目标进入防护中。';
      defenseReport.actions = [{ label: '查看详情', target: 'report', tone: 'ghost' }];
    }
  }
  targetDetail.protectionStatus = '防护中，约 60 分钟后解除';
  targetDetail.actions = [{ label: '保护中', target: 'raid', tone: 'ghost' }];
  const remainingRaidCount = Math.max(mockSceneSnapshot.raid.targets.length, 0);
  mockSceneSnapshot.raid.hero.title = `剩余可掠夺目标 ${formatNumber(remainingRaidCount)} 个`;
  const protectedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  mockHomeSnapshot.protectedUntil = protectedUntil;

  const rewardSummary = rewards.length > 0 ? `，额外获得 ${rewards.map((reward) => `${reward.label} x${reward.quantity}`).join('、')}` : '';
  const reportSummary = `你对${target.name}发起黑盒掠夺，带回 ${formatNumber(depositedGold)} 金币，战损 ${formatNumber(casualties)} 兵${rewardSummary}。`;
  return {
    app: mockHomeSnapshot.app,
    summary: `${target.name} 已进入 1 小时防护，本次获得 ${formatNumber(depositedGold)} 金币，战损 ${formatNumber(casualties)} 兵${rewardSummary}。`,
    home: cloneHomeSummary(mockHomeSnapshot),
    scenes: cloneSceneContent(mockSceneSnapshot),
    result: {
      targetId: input.targetId,
      targetName: target.name,
      goldLoot: depositedGold,
      casualties,
      rewards,
      protectedUntil,
      reportSummary,
    },
  };
}

function applyMockFactionDonate(input: ClientFactionDonateRequest): ClientStateMutationResponse {
  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'vault');
  const armyResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'army');

  if (!vaultResource || !armyResource) {
    throw new Error('Mock home summary is missing faction donate resources.');
  }

  const goldStep = mockSceneSnapshot.faction.donate.goldStep;
  const vault = parseCurrentAndCapacity(vaultResource.value);
  const army = parseCurrentAndCapacity(armyResource.value);
  const actualGoldAmount = Math.min(Math.max(Math.floor(input.goldAmount / goldStep) * goldStep, 0), Math.floor(vault.current / goldStep) * goldStep);
  const actualArmyAmount = Math.min(Math.max(Math.floor(input.armyAmount), 0), army.current);

  if (actualGoldAmount <= 0 && actualArmyAmount <= 0) {
    return buildMockMutation('请先选择要捐出的金币或部队。');
  }

  const contributionGain = actualGoldAmount / goldStep + actualArmyAmount;
  applyVaultGoldDelta(-actualGoldAmount);
  applyArmyCountDelta(-actualArmyAmount);
  mockFactionContribution += contributionGain;
  mockFactionTreasuryGold += actualGoldAmount;
  mockFactionArmyPower += actualArmyAmount;

  return buildMockMutation(`已向阵营捐出 ${formatNumber(actualGoldAmount)} 金币、${formatNumber(actualArmyAmount)} 兵，贡献值 +${formatNumber(contributionGain)}。`);
}

export async function collectFieldEarnings(input: ClientCollectFieldRequest): Promise<ClientCollectFieldResponse> {
  try {
    const response = await fetchJson<ClientCollectFieldResponse>(`${CLIENT_API_PREFIX}/actions/collect-field`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    mockHomeSnapshot = cloneHomeSummary(response.home);
    mockSceneSnapshot = cloneSceneContent(response.scenes);
    return response;
  } catch {
    return applyMockCollectField(input);
  }
}

export async function startFieldCultivation(input: ClientStartCultivationRequest): Promise<ClientStateMutationResponse> {
  try {
    const response = await fetchJson<ClientStateMutationResponse>(`${CLIENT_API_PREFIX}/actions/start-cultivation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    mockHomeSnapshot = cloneHomeSummary(response.home);
    mockSceneSnapshot = cloneSceneContent(response.scenes);
    return response;
  } catch {
    return applyMockStartCultivation(input);
  }
}

export async function recruitArmyUnits(input: ClientRecruitArmyRequest): Promise<ClientStateMutationResponse> {
  try {
    const response = await fetchJson<ClientStateMutationResponse>(`${CLIENT_API_PREFIX}/actions/recruit-army`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    mockHomeSnapshot = cloneHomeSummary(response.home);
    mockSceneSnapshot = cloneSceneContent(response.scenes);
    return response;
  } catch {
    return applyMockRecruitArmy(input);
  }
}

export async function upgradeClientBuilding(input: ClientUpgradeBuildingRequest): Promise<ClientStateMutationResponse> {
  try {
    const response = await fetchJson<ClientStateMutationResponse>(`${CLIENT_API_PREFIX}/actions/upgrade-building`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    mockHomeSnapshot = cloneHomeSummary(response.home);
    mockSceneSnapshot = cloneSceneContent(response.scenes);
    return response;
  } catch {
    return applyMockUpgradeBuilding(input);
  }
}

export async function donateFactionResources(input: ClientFactionDonateRequest): Promise<ClientStateMutationResponse> {
  try {
    const response = await fetchJson<ClientStateMutationResponse>(`${CLIENT_API_PREFIX}/actions/faction-donate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    mockHomeSnapshot = cloneHomeSummary(response.home);
    mockSceneSnapshot = cloneSceneContent(response.scenes);
    return response;
  } catch {
    return applyMockFactionDonate(input);
  }
}

export async function claimStarterSeedPack(): Promise<ClientStateMutationResponse> {
  try {
    return await fetchJson<ClientStateMutationResponse>(`${CLIENT_API_PREFIX}/actions/claim-starter-seeds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
  } catch {
    return applyMockClaimStarterSeeds();
  }
}

export async function resetDemoExperimentState(): Promise<ClientResetDemoStateResponse> {
  const resetMockState = (): ClientResetDemoStateResponse => {
    mockBootstrapSnapshot = cloneBootstrap(mockBootstrap);
    mockHomeSnapshot = cloneHomeSummary(mockHomeSummary);
    mockSceneSnapshot = cloneSceneContent(mockSceneContent);
    mockFactionContribution = INITIAL_MOCK_FACTION_CONTRIBUTION;
    mockFactionTreasuryGold = INITIAL_MOCK_FACTION_TREASURY_GOLD;
    mockFactionArmyPower = INITIAL_MOCK_FACTION_ARMY_POWER;
    mockFieldSeedAssignments = { ...INITIAL_MOCK_FIELD_SEED_ASSIGNMENTS };
    syncMockFactionScene();

    return {
      app: mockHomeSnapshot.app,
      summary: '实验数据已重置到初始状态，可以重新验证领取、收取和升级链路。',
      home: cloneHomeSummary(mockHomeSnapshot),
      scenes: cloneSceneContent(mockSceneSnapshot),
    };
  };

  try {
    const response = await fetchJson<ClientResetDemoStateResponse>(`${CLIENT_API_PREFIX}/actions/reset-demo-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    mockBootstrapSnapshot = cloneBootstrap(mockBootstrap);
    mockHomeSnapshot = cloneHomeSummary(response.home);
    mockSceneSnapshot = cloneSceneContent(response.scenes);
    return response;
  } catch {
    return resetMockState();
  }
}

export async function loadRaidTargetDetail(targetId: string): Promise<ClientRaidTargetDetailResponse> {
  try {
    return await fetchJson<ClientRaidTargetDetailResponse>(`${CLIENT_API_PREFIX}/raid-targets/${targetId}`);
  } catch {
    const fallback = mockRaidTargetDetails[targetId];
    if (!fallback) {
      throw new Error(`Missing mock raid target detail for ${targetId}`);
    }

    return structuredClone(fallback);
  }
}

export async function raidClientTarget(input: ClientRaidActionRequest): Promise<ClientRaidActionResponse> {
  try {
    const response = await fetchJson<ClientRaidActionResponse>(`${CLIENT_API_PREFIX}/actions/raid-target`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    mockHomeSnapshot = cloneHomeSummary(response.home);
    mockSceneSnapshot = cloneSceneContent(response.scenes);
    return response;
  } catch {
    return applyMockRaidTarget(input);
  }
}