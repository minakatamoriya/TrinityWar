import {
  CLIENT_API_PREFIX,
  type ClientBootstrapResponse,
  type ClientClaimPendingRequest,
  type ClientClaimPendingResponse,
  type ClientCollectFieldRequest,
  type ClientResetDemoStateResponse,
  type ClientSceneContentResponse,
  type ClientStartCultivationRequest,
  type ClientStateMutationResponse,
  type ClientTransferGoldRequest,
  type ClientUpgradeBuildingRequest,
  type HomeSummaryResponse,
} from '@trinitywar/shared';
import { mockBootstrap, mockHomeSummary, mockSceneContent } from './mockData';

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

let mockHomeSnapshot: HomeSummaryResponse = cloneHomeSummary(mockHomeSummary);
let mockSceneSnapshot: ClientSceneContentResponse = cloneSceneContent(mockSceneContent);

function normalizeHomeSummary(home: HomeSummaryResponse): HomeSummaryResponse {
  return {
    ...home,
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
  const [bootstrap, home, scenes] = await Promise.all([
    fetchWithFallback<ClientBootstrapResponse>(`${CLIENT_API_PREFIX}/bootstrap`, mockBootstrap),
    fetchWithFallback<HomeSummaryResponse>(`${CLIENT_API_PREFIX}/home-summary`, mockHomeSnapshot),
    fetchWithFallback<ClientSceneContentResponse>(`${CLIENT_API_PREFIX}/scene-content`, mockSceneSnapshot),
  ]);

  return {
    bootstrap: bootstrap.data,
    home: normalizeHomeSummary(home.data),
    scenes: scenes.data,
    usingMock: bootstrap.source === 'mock' || home.source === 'mock' || scenes.source === 'mock',
  };
}

function parseNumberText(value: string): number {
  return Number(value.replace(/,/g, '').trim());
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
  const match = description.match(/(?:可收|返还)\s([\d,]+)/);
  return match ? parseNumberText(match[1]) : 0;
}

function updateMockFieldStatus(): void {
  const matureCount = mockSceneSnapshot.farm.fields.filter((field) => field.tone === 'ripe').length;
  const growingCount = mockSceneSnapshot.farm.fields.filter((field) => field.tone === 'growing').length;

  mockHomeSnapshot.fieldStatus = `成熟外场 ${matureCount} 块，成长中 ${growingCount} 块`;
  mockSceneSnapshot.farm.hero.title = `成熟 ${matureCount} 块 · 成长中 ${growingCount} 块`;
  mockSceneSnapshot.farm.hero.description = mockSceneSnapshot.farm.fields.some((field) => field.tone === 'empty' && field.title !== '未解锁')
    ? '农场页已接入真实收取与培育写接口，可以直接验证产出和再投入循环。'
    : '当前没有空闲地块，建议先收取成熟外场或升级外场位继续扩产。';
  mockSceneSnapshot.farm.hero.action = mockSceneSnapshot.farm.fields.some((field) => field.tone === 'empty' && field.title !== '未解锁')
    ? { label: '开始培育', target: 'farm', tone: 'primary' }
    : { label: '查看说明', target: 'farm', tone: 'ghost' };
}

function buildMockMutation(summary: string): ClientStateMutationResponse {
  updateMockFieldStatus();

  return {
    app: mockHomeSnapshot.app,
    summary,
    home: cloneHomeSummary(mockHomeSnapshot),
    scenes: cloneSceneContent(mockSceneSnapshot),
  };
}

function applyVaultGoldDelta(delta: number): void {
  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.label === '金库');
  if (!vaultResource) {
    return;
  }

  const vault = parseCurrentAndCapacity(vaultResource.value);
  const nextVaultGold = Math.max(vault.current + delta, 0);
  vaultResource.value = `${formatNumber(nextVaultGold)} / ${formatNumber(vault.capacity)}`;
}

function findMockPendingClaim(source: ClientClaimPendingRequest['source']): HomeSummaryResponse['pendingClaims'][number] | undefined {
  return mockHomeSnapshot.pendingClaims.find((claim) => claim.source === source);
}

function updateMockFactionHero(): void {
  const factionClaim = findMockPendingClaim('faction');
  const nextValue = factionClaim?.value ?? '0';
  mockSceneSnapshot.faction.hero.title = `当前待领取分红 ${nextValue}`;
}

function setVaultCapacity(nextCapacity: number): void {
  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.label === '金库');
  if (!vaultResource) {
    return;
  }

  const vault = parseCurrentAndCapacity(vaultResource.value);
  vaultResource.value = `${formatNumber(vault.current)} / ${formatNumber(nextCapacity)}`;
}

function applyMockClaimPending(input: ClientClaimPendingRequest): ClientClaimPendingResponse {
  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.label === '金库');
  const walletResource = mockHomeSnapshot.resources.find((resource) => resource.label === '余额');
  const pendingClaim = findMockPendingClaim(input.source);

  if (!vaultResource || !walletResource || !pendingClaim) {
    throw new Error('Mock home summary is missing required resources.');
  }

  const vault = parseCurrentAndCapacity(vaultResource.value);
  const wallet = parseCurrentAndCapacity(walletResource.value);
  const pendingClaimGold = parseNumberText(pendingClaim.value);
  const claimableGold = Math.min(Math.max(vault.capacity - vault.current, 0), pendingClaimGold);
  const nextVaultGold = vault.current + claimableGold;
  const remainingPendingGold = pendingClaimGold - claimableGold;
  const sourceLabel = input.source === 'tax' ? '主城税收' : '阵营分红';

  vaultResource.value = `${formatNumber(nextVaultGold)} / ${formatNumber(vault.capacity)}`;
  pendingClaim.value = formatNumber(remainingPendingGold);
  updateMockFactionHero();

  const summary = claimableGold > 0
    ? `${sourceLabel}本次入库 ${formatNumber(claimableGold)} 金币，剩余待领取 ${formatNumber(remainingPendingGold)}。`
    : `金库空间不足，当前没有可入库的${sourceLabel}。`;

  return {
    app: mockHomeSnapshot.app,
    summary,
    source: input.source,
    claimedGold: claimableGold,
    remainingPendingGold,
    ledger: {
      vaultGold: nextVaultGold,
      vaultCapacity: vault.capacity,
      walletGold: wallet.current,
      walletCapacity: wallet.capacity,
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

function applyMockCollectField(input: ClientCollectFieldRequest): ClientStateMutationResponse {
  const field = mockSceneSnapshot.farm.fields.find((item) => item.id === input.fieldId);
  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.label === '金库');

  if (!field || !vaultResource || field.title === '未解锁') {
    return buildMockMutation('当前地块不可操作，请先解锁对应外场位。');
  }

  if (input.collectMode === 'ripe' && field.tone !== 'ripe') {
    return buildMockMutation('这块地当前不在成熟收取阶段。');
  }

  if (input.collectMode === 'early' && field.tone !== 'growing') {
    return buildMockMutation('这块地当前不支持提前收取。');
  }

  const vault = parseCurrentAndCapacity(vaultResource.value);
  const fieldYield = parseFieldYield(field.description);
  const depositedGold = Math.min(fieldYield, Math.max(vault.capacity - vault.current, 0));
  const overflowGold = Math.max(fieldYield - depositedGold, 0);

  applyVaultGoldDelta(depositedGold);
  field.title = '可培育';
  field.badge = '空闲地块';
  field.tone = 'empty';
  field.description = '投入 520 金币后开始新一轮培育，成熟后可以继续收取再投入。';
  field.actions = [{ label: '开始培育', target: 'farm', tone: 'primary' }];

  return buildMockMutation(
    overflowGold > 0
      ? `${field.code} 已收取 ${formatNumber(depositedGold)} 金币，另有 ${formatNumber(overflowGold)} 因金库满额未能入库。`
      : `${field.code} 已收取 ${formatNumber(depositedGold)} 金币，可以立即再投入新一轮培育。`,
  );
}

function applyMockStartCultivation(input: ClientStartCultivationRequest): ClientStateMutationResponse {
  const field = mockSceneSnapshot.farm.fields.find((item) => item.id === input.fieldId);
  const cultivationCost = 520;
  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.label === '金库');

  if (!field || !vaultResource || field.title === '未解锁') {
    return buildMockMutation('当前地块尚未解锁，无法开始培育。');
  }

  if (field.tone !== 'empty' || field.title === '未解锁') {
    return buildMockMutation('当前地块已经在培育中或可直接收取。');
  }

  const vault = parseCurrentAndCapacity(vaultResource.value);
  if (vault.current < cultivationCost) {
    return buildMockMutation('金库余额不足，无法开始本轮培育。');
  }

  applyVaultGoldDelta(-cultivationCost);
  field.title = '成长期';
  field.badge = '01:42 后成熟';
  field.tone = 'growing';
  field.description = '投入 520 金币，当前提前收取仅返还 660 金币。';
  field.actions = [
    { label: '提前收取', target: 'farm', tone: 'secondary' },
    { label: '阶段说明', target: 'farm', tone: 'ghost' },
  ];

  return buildMockMutation(`${field.code} 已投入 ${formatNumber(cultivationCost)} 金币，开始新一轮培育。`);
}

function applyMockUpgradeBuilding(input: ClientUpgradeBuildingRequest): ClientStateMutationResponse {
  const upgrade = mockSceneSnapshot.building.upgrades.find((item) => item.id === input.buildingId);
  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.label === '金库');

  if (!upgrade || !vaultResource || upgrade.locked) {
    return buildMockMutation('当前建筑不满足升级条件，或已达到验证上限。');
  }

  const vault = parseCurrentAndCapacity(vaultResource.value);
  const cost = parseNumberText(upgrade.costText.replace('消耗', '').replace('金币', ''));

  if (vault.current < cost) {
    return buildMockMutation('金库余额不足，当前无法完成升级。');
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
    const lockedField = mockSceneSnapshot.farm.fields.find((field) => field.title === '未解锁');
    if (lockedField) {
      lockedField.title = '可培育';
      lockedField.badge = '空闲地块';
      lockedField.description = '投入 520 金币后开始新一轮培育，成熟后可以继续收取再投入。';
      lockedField.actions = [{ label: '开始培育', target: 'farm', tone: 'primary' }];
    }
    upgrade.locked = true;
    upgrade.costText = '当前已全部解锁';
    upgrade.action = { label: '查看条件', target: 'building', tone: 'ghost' };
    upgrade.description = 'Lv.2，当前验证版外场位已全部解锁。';
    return buildMockMutation('外场位升级完成，新地块已经开放，可直接开始培育。');
  }

  upgrade.description = 'Lv.2 -> Lv.3，进一步降低余额与外场被掠损失。';
  return buildMockMutation('防守建筑升级完成，当前已完成一轮验证内升级。');
}

export async function collectFieldEarnings(input: ClientCollectFieldRequest): Promise<ClientStateMutationResponse> {
  try {
    const response = await fetchJson<ClientStateMutationResponse>(`${CLIENT_API_PREFIX}/actions/collect-field`, {
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

function applyMockTransferGold(input: ClientTransferGoldRequest): ClientStateMutationResponse {
  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.label === '金库');
  const walletResource = mockHomeSnapshot.resources.find((resource) => resource.label === '余额');

  if (!vaultResource || !walletResource) {
    return buildMockMutation('当前资金数据缺失，无法完成转账。');
  }

  const vault = parseCurrentAndCapacity(vaultResource.value);
  const wallet = parseCurrentAndCapacity(walletResource.value);
  const requestedAmount = Math.max(Math.floor(input.amount), 0);

  if (requestedAmount <= 0) {
    return buildMockMutation('请输入大于 0 的转账金额。');
  }

  if (input.from === 'vault') {
    const transferableGold = Math.min(requestedAmount, vault.current, Math.max(wallet.capacity - wallet.current, 0));
    if (transferableGold <= 0) {
      return buildMockMutation('余额已满或金库可转金额不足，当前无法转入余额。');
    }

    vaultResource.value = `${formatNumber(vault.current - transferableGold)} / ${formatNumber(vault.capacity)}`;
    walletResource.value = `${formatNumber(wallet.current + transferableGold)} / ${formatNumber(wallet.capacity)}`;
    return buildMockMutation(`已从金库转出 ${formatNumber(transferableGold)} 金币到余额。`);
  }

  const transferableGold = Math.min(requestedAmount, wallet.current, Math.max(vault.capacity - vault.current, 0));
  if (transferableGold <= 0) {
    return buildMockMutation('金库已满或余额可转金额不足，当前无法转回金库。');
  }

  vaultResource.value = `${formatNumber(vault.current + transferableGold)} / ${formatNumber(vault.capacity)}`;
  walletResource.value = `${formatNumber(wallet.current - transferableGold)} / ${formatNumber(wallet.capacity)}`;
  return buildMockMutation(`已从余额转入 ${formatNumber(transferableGold)} 金币到金库。`);
}

export async function transferClientGold(input: ClientTransferGoldRequest): Promise<ClientStateMutationResponse> {
  try {
    const response = await fetchJson<ClientStateMutationResponse>(`${CLIENT_API_PREFIX}/actions/transfer-gold`, {
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
    return applyMockTransferGold(input);
  }
}

export async function resetDemoExperimentState(): Promise<ClientResetDemoStateResponse> {
  const resetMockState = (): ClientResetDemoStateResponse => {
    mockHomeSnapshot = cloneHomeSummary(mockHomeSummary);
    mockSceneSnapshot = cloneSceneContent(mockSceneContent);

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

    mockHomeSnapshot = cloneHomeSummary(response.home);
    mockSceneSnapshot = cloneSceneContent(response.scenes);
    return response;
  } catch {
    return resetMockState();
  }
}