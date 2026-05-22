import {
  CLIENT_API_PREFIX,
  type ClientClaimNotificationResponse,
  type ClientDeleteNotificationResponse,
  type ClientBuySpiritSoulRequest,
  type ClientBootstrapResponse,
  type ClientArmyTrainingQueue,
  type ClientClaimDailyTaskRequest,
  type ClientClaimDailyTaskResponse,
  type ClientComposeSpiritRequest,
  type ClientRaidActionRequest,
  type ClientRaidActionResponse,
  type ClientRaidDeepIntelResponse,
  type ClientDissolveSpiritRequest,
  type ClientFactionDonateRequest,
  type ClientClaimPendingRequest,
  type ClientClaimPendingResponse,
  type ClientCollectFieldRequest,
  type ClientCollectFieldResponse,
  type ClientDailyTaskSummary,
  type ClientFarmField,
  type ClientMarkNotificationReadResponse,
  type ClientNotificationListResponse,
  type ClientRaidTargetDetailResponse,
  type ClientRecoverSpiritRequest,
  type ClientRecruitArmyRequest,
  type ClientResetDemoStateResponse,
  type ClientSceneContentResponse,
  type ClientStartCultivationRequest,
  type ClientStateMutationResponse,
  type ClientUnreadNotificationCountResponse,
  type ClientSetMainSpiritRequest,
  type ClientSpiritMutationResponse,
  type ClientSpiritState,
  type ClientSpiritStateResponse,
  type ClientUpgradeBuildingRequest,
  type ClientUpgradeSpiritRequest,
  type HomeSummaryResponse,
} from '@trinitywar/shared';
import { mockBootstrap, mockHomeSummary, mockRaidTargetDetails, mockSceneContent } from './mockData';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
const forceMockReads = parseViteBoolean(import.meta.env.VITE_FORCE_MOCK_READS);
const allowMockReadFallback = parseViteBoolean(import.meta.env.VITE_ALLOW_MOCK_READ_FALLBACK);
const forceMockCommands = parseViteBoolean(import.meta.env.VITE_FORCE_MOCK_COMMANDS);
const AUTH_STORAGE_KEY = 'trinitywar.devAuth';

type DataSource = 'api' | 'mock';
type ClientReadEndpoint = 'bootstrap' | 'home' | 'scenes';
export type DevLoginMode = 'new-user' | 'existing-user' | 'test-user-1' | 'test-user-2';

export interface DevLoginSession {
  accessToken: string;
  expiresAt: string;
  player: {
    id: string;
    nickname: string;
    castleLevel: number;
  };
  mode: DevLoginMode;
}

interface DevLoginResponse {
  accessToken: string;
  expiresAt: string;
  player: {
    id: string;
    nickname: string;
    castleLevel: number;
  };
}

interface DataEnvelope<T> {
  data: T;
  source: DataSource;
  fallbackReason?: string;
}

interface ClientReadPolicy<T> {
  endpoint: ClientReadEndpoint;
  path: string;
  fallback: T;
  allowFallback: boolean;
}

export interface ClientReadSourceStatus {
  source: DataSource;
  fallbackReason?: string;
}

export type ClientReadSources = Record<ClientReadEndpoint, ClientReadSourceStatus>;

export interface ClientReadSourceLabels {
  bootstrap: string;
  home: string;
  scenes: string;
}

export interface ClientViewModel {
  bootstrap: ClientBootstrapResponse;
  home: HomeSummaryResponse;
  scenes: ClientSceneContentResponse;
  usingMock: boolean;
  sources: ClientReadSources;
}

function normalizeBootstrap(bootstrap: ClientBootstrapResponse): ClientBootstrapResponse {
  return {
    ...bootstrap,
    season: { ...bootstrap.season },
    backpack: {
      seedInventory: { ...bootstrap.backpack.seedInventory },
      globalItemInventory: { ...bootstrap.backpack.globalItemInventory },
      unlockedSeedIds: [...bootstrap.backpack.unlockedSeedIds],
      starterSeedClaimed: bootstrap.backpack.starterSeedClaimed,
      tianjiTalismanClaimed: bootstrap.backpack.tianjiTalismanClaimed,
      spiritSoulClaimed: bootstrap.backpack.spiritSoulClaimed,
      dailySpiritSoulAmount: bootstrap.backpack.dailySpiritSoulAmount,
    },
  };
}

function cloneBootstrap(bootstrap: ClientBootstrapResponse): ClientBootstrapResponse {
  return normalizeBootstrap(bootstrap);
}

let mockBootstrapSnapshot: ClientBootstrapResponse = cloneBootstrap(mockBootstrap);
let mockHomeSnapshot: HomeSummaryResponse = cloneHomeSummary(mockHomeSummary);
let mockSceneSnapshot: ClientSceneContentResponse = cloneSceneContent(mockSceneContent);
let devLoginSession: DevLoginSession | null = readStoredDevLoginSession();
const INITIAL_MOCK_FACTION_CONTRIBUTION = 40;
const INITIAL_MOCK_FACTION_TREASURY_GOLD = 82400;
const INITIAL_MOCK_FACTION_ARMY_POWER = 1260;
const MOCK_FACTION_DIVIDEND_BASE_PER_HOUR = 8;
const MOCK_FACTION_CONTRIBUTION_STEP = 10;
const MOCK_FACTION_DIVIDEND_BONUS_PER_STEP_PER_HOUR = 3;
const INITIAL_MOCK_FIELD_SEED_ASSIGNMENTS: Record<string, string> = {
  'field-1': 'qinglingmai',
  'field-2': 'qinglingmai',
  'field-3': 'qinglingmai',
};
const MOCK_RIPE_WINDOW_SECONDS = 30 * 60;
let mockFactionContribution = INITIAL_MOCK_FACTION_CONTRIBUTION;
let mockFactionTreasuryGold = INITIAL_MOCK_FACTION_TREASURY_GOLD;
let mockFactionArmyPower = INITIAL_MOCK_FACTION_ARMY_POWER;
let mockFieldSeedAssignments: Record<string, string> = { ...INITIAL_MOCK_FIELD_SEED_ASSIGNMENTS };

interface MockFieldTimingState {
  statusStartedAt: string;
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

const mockSeedStageGold: Record<string, { seeded: number; growing: number; mature: number; withered: number }> = {
  qinglingmai: { seeded: 100, growing: 100, mature: 200, withered: 100 },
  ninglucao: { seeded: 100, growing: 100, mature: 140, withered: 40 },
  suixinhua: { seeded: 120, growing: 120, mature: 300, withered: 50 },
  baiyulian: { seeded: 160, growing: 160, mature: 220, withered: 180 },
  yingyuezhu: { seeded: 150, growing: 150, mature: 230, withered: 140 },
  qianjiteng: { seeded: 170, growing: 170, mature: 360, withered: 120 },
  huichuncao: { seeded: 320, growing: 320, mature: 480, withered: 380 },
  xueyuehua: { seeded: 300, growing: 300, mature: 760, withered: 180 },
  jingdaosong: { seeded: 450, growing: 450, mature: 620, withered: 520 },
  hundunguo: { seeded: 420, growing: 420, mature: 880, withered: 260 },
  zhanqingsi: { seeded: 520, growing: 520, mature: 1200, withered: 200 },
  wangchuanying: { seeded: 760, growing: 760, mature: 1200, withered: 960 },
  zhaoyouming: { seeded: 700, growing: 700, mature: 1600, withered: 680 },
};

const mockSeedStageSeconds: Record<string, { seeded: number; growing: number }> = {
  qinglingmai: { seeded: 7200, growing: 3600 },
  ninglucao: { seeded: 5400, growing: 1800 },
  suixinhua: { seeded: 7200, growing: 3600 },
  baiyulian: { seeded: 10800, growing: 5400 },
  yingyuezhu: { seeded: 9000, growing: 3600 },
  qianjiteng: { seeded: 9000, growing: 3600 },
  huichuncao: { seeded: 10800, growing: 3600 },
  xueyuehua: { seeded: 9000, growing: 3600 },
  jingdaosong: { seeded: 14400, growing: 3600 },
  hundunguo: { seeded: 14400, growing: 5400 },
  zhanqingsi: { seeded: 10800, growing: 3600 },
  wangchuanying: { seeded: 18000, growing: 3600 },
  zhaoyouming: { seeded: 14400, growing: 3600 },
};

function getMockSeedStageSeconds(seedId: string, stage: 'seeded' | 'growing'): number {
  return mockSeedStageSeconds[seedId]?.[stage] ?? (stage === 'seeded' ? 7200 : 3600);
}

function buildInitialMockFieldTimingStates(): Record<string, MockFieldTimingState> {
  const nowMs = Date.now();
  return mockSceneContent.farm.fields.reduce<Record<string, MockFieldTimingState>>((table, field) => {
    const seedId = INITIAL_MOCK_FIELD_SEED_ASSIGNMENTS[field.id];

    if (!seedId || (field.tone !== 'seeded' && field.tone !== 'growing' && field.tone !== 'mature')) {
      return table;
    }

    const totalSeconds = field.tone === 'mature'
      ? MOCK_RIPE_WINDOW_SECONDS
      : getMockSeedStageSeconds(seedId, field.tone);
    const fallbackRemainingSeconds = field.tone === 'mature'
      ? Math.min(totalSeconds, 20 * 60)
      : Math.min(field.progressRemainingSeconds, totalSeconds);

    table[field.id] = {
      statusStartedAt: new Date(nowMs - Math.max(totalSeconds - fallbackRemainingSeconds, 0) * 1000).toISOString(),
    };

    return table;
  }, {});
}

let mockFieldTimingState: Record<string, MockFieldTimingState> = buildInitialMockFieldTimingStates();

function getMockSeedStageGold(seedId: string, stage: 'seeded' | 'growing' | 'mature' | 'withered'): number {
  return mockSeedStageGold[seedId]?.[stage] ?? 520;
}

function normalizeHomeSummary(home: HomeSummaryResponse): HomeSummaryResponse {
  return {
    ...home,
    stateVersions: {
      buildingVersion: home.stateVersions?.buildingVersion ?? 1,
      walletVersion: home.stateVersions?.walletVersion ?? 1,
      armyVersion: home.stateVersions?.armyVersion ?? 1,
    },
    protectedUntil: home.protectedUntil ?? null,
    resources: (home.resources ?? []).map((resource) => ({ ...resource })),
    pendingClaims: (home.pendingClaims ?? []).map((claim) => ({ ...claim })),
    temporaryClaim: home.temporaryClaim ? { ...home.temporaryClaim } : null,
    dailyTasks: (home.dailyTasks ?? []).map((task) => ({ ...task })),
    primaryActions: (home.primaryActions ?? []).map((action) => ({ ...action })),
  };
}

function updateMockDailyTask(taskId: string, amount = 1): void {
  const task = mockHomeSnapshot.dailyTasks.find((item) => item.id === taskId);
  if (!task || task.status === 'claimed') {
    return;
  }

  task.progressCurrent = Math.min(task.progressCurrent + amount, task.progressTarget);
  task.status = task.progressCurrent >= task.progressTarget ? 'completed' : 'in-progress';
  task.progressText = task.status === 'completed' ? '可领取' : `${task.progressCurrent}/${task.progressTarget}`;
}

function claimMockDailyTask(taskId: string): ClientDailyTaskSummary | null {
  const task = mockHomeSnapshot.dailyTasks.find((item) => item.id === taskId);
  if (!task || task.status !== 'completed') {
    return null;
  }

  task.status = 'claimed';
  task.progressText = '已领取';
  return task;
}

function cloneHomeSummary(home: HomeSummaryResponse): HomeSummaryResponse {
  return normalizeHomeSummary(home);
}

function cloneSceneContent(scenes: ClientSceneContentResponse): ClientSceneContentResponse {
  return structuredClone(scenes);
}

function cloneSpiritState(spirit: ClientSpiritState): ClientSpiritState {
  return {
    ...spirit,
    mainSlot: spirit.mainSlot ? { ...spirit.mainSlot } : null,
    slots: spirit.slots.map((slot) => ({ ...slot })),
    codex: spirit.codex.map((entry) => ({
      ...entry,
      definition: { ...entry.definition },
    })),
    readyToCompose: spirit.readyToCompose.map((entry) => ({
      ...entry,
      definition: { ...entry.definition },
    })),
  };
}

function parseViteBoolean(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

function createRaidDetailField(field: Partial<ClientFarmField> & Pick<ClientFarmField, 'id' | 'code' | 'title' | 'badge' | 'tone' | 'description'>): ClientFarmField {
  return {
    progressRemainingSeconds: 0,
    progressTotalSeconds: 1,
    yieldGold: 0,
    actions: [],
    ...field,
  };
}

function buildFallbackRaidFields(detail: ClientRaidTargetDetailResponse): ClientFarmField[] {
  const fieldTones: Array<{ label: string; tone: ClientFarmField['tone']; badge: string }> = [
    { label: '成熟田', tone: 'mature', badge: '丰熟' },
    { label: '成长期', tone: 'growing', badge: '成长' },
    { label: '播种田', tone: 'seeded', badge: '播种' },
    { label: '空闲田', tone: 'empty', badge: '空闲' },
    { label: '枯萎田', tone: 'withered', badge: '过熟' },
  ];
  const fields: ClientFarmField[] = [];

  fieldTones.forEach(({ label, tone, badge }) => {
    const match = detail.fieldStatus.match(new RegExp(`${label}\s*(\\d+)\s*块`));
    const count = match ? Number(match[1]) : 0;

    for (let index = 0; index < count; index += 1) {
      fields.push(createRaidDetailField({
        id: `${detail.targetId}-field-${fields.length + 1}`,
        code: `田地 ${String(fields.length + 1).padStart(2, '0')}`,
        title: badge,
        badge,
        tone,
        description: detail.exposedFruit,
      }));
    }
  });

  if (fields.length > 0) {
    while (fields.length < 4) {
      fields.push(createRaidDetailField({
        id: `${detail.targetId}-field-${fields.length + 1}`,
        code: `田地 ${String(fields.length + 1).padStart(2, '0')}`,
        title: '空闲期',
        badge: '空闲',
        tone: 'empty',
        description: '暂未播种，暂无外露收益',
      }));
    }

    return fields;
  }

  return [
    createRaidDetailField({
      id: `${detail.targetId}-field-1`,
      code: '田地 01',
      title: detail.fieldStatus,
      badge: '田地',
      tone: detail.fieldPreviewTone,
      description: detail.exposedFruit,
    }),
    createRaidDetailField({
      id: `${detail.targetId}-field-2`,
      code: '田地 02',
      title: '空闲期',
      badge: '空闲',
      tone: 'empty',
      description: '暂未播种，暂无外露收益',
    }),
    createRaidDetailField({
      id: `${detail.targetId}-field-3`,
      code: '田地 03',
      title: '空闲期',
      badge: '空闲',
      tone: 'empty',
      description: '暂未播种，暂无外露收益',
    }),
    createRaidDetailField({
      id: `${detail.targetId}-field-4`,
      code: '田地 04',
      title: '空闲期',
      badge: '空闲',
      tone: 'empty',
      description: '暂未播种，暂无外露收益',
    }),
  ];
}

function normalizeRaidTargetDetail(detail: ClientRaidTargetDetailResponse): ClientRaidTargetDetailResponse {
  return {
    ...detail,
    remainingFreeIntel: detail.remainingFreeIntel ?? 0,
    remainingTalismanIntel: detail.remainingTalismanIntel ?? 0,
    fields: Array.isArray(detail.fields) && detail.fields.length > 0 ? detail.fields.map((field) => ({
      ...field,
      actions: [...field.actions],
    })) : buildFallbackRaidFields(detail),
  };
}

function buildApiUrl(path: string): string {
  if (!apiBaseUrl) {
    return path;
  }

  return path.startsWith('/') ? `${apiBaseUrl}${path}` : `${apiBaseUrl}/${path}`;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (devLoginSession?.accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${devLoginSession.accessToken}`);
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message?.trim() || `HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchReadEndpoint<T>(policy: ClientReadPolicy<T>): Promise<DataEnvelope<T>> {
  if (forceMockReads) {
    return {
      data: policy.fallback,
      source: 'mock',
      fallbackReason: 'forced by VITE_FORCE_MOCK_READS',
    };
  }

  try {
    return {
      data: await fetchJson<T>(policy.path),
      source: 'api',
    };
  } catch (error) {
    if (!policy.allowFallback) {
      throw new Error(`${policy.endpoint} read requires real API but failed: ${getFallbackReason(error)}`);
    }

    return {
      data: policy.fallback,
      source: 'mock',
      fallbackReason: getFallbackReason(error),
    };
  }
}

function getFallbackReason(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'request failed';
}

export async function loadClientViewModel(): Promise<ClientViewModel> {
  if (forceMockReads || allowMockReadFallback) {
    syncMockArmyTrainingQueue();
    syncMockFieldLifecycle();
  }

  const [bootstrap, home, scenes] = await Promise.all([
    fetchReadEndpoint<ClientBootstrapResponse>({
      endpoint: 'bootstrap',
      path: `${CLIENT_API_PREFIX}/bootstrap`,
      fallback: mockBootstrapSnapshot,
      allowFallback: allowMockReadFallback,
    }),
    fetchReadEndpoint<HomeSummaryResponse>({
      endpoint: 'home',
      path: `${CLIENT_API_PREFIX}/home-summary`,
      fallback: mockHomeSnapshot,
      allowFallback: allowMockReadFallback,
    }),
    fetchReadEndpoint<ClientSceneContentResponse>({
      endpoint: 'scenes',
      path: `${CLIENT_API_PREFIX}/scene-content`,
      fallback: mockSceneSnapshot,
      allowFallback: allowMockReadFallback,
    }),
  ]);

  const sources: ClientReadSources = {
    bootstrap: buildSourceStatus(bootstrap),
    home: buildSourceStatus(home),
    scenes: buildSourceStatus(scenes),
  };

  return {
    bootstrap: normalizeBootstrap(bootstrap.data),
    home: normalizeHomeSummary(home.data),
    scenes: cloneSceneContent(scenes.data),
    usingMock: Object.values(sources).some((status) => status.source === 'mock'),
    sources,
  };
}

export async function loadSpiritState(): Promise<ClientSpiritState> {
  const response = await fetchJson<ClientSpiritStateResponse>(`${CLIENT_API_PREFIX}/spirit`);
  return cloneSpiritState(response.spirit);
}

export async function loadNotifications(page = 1, pageSize = 10): Promise<ClientNotificationListResponse> {
  try {
    return await fetchJson<ClientNotificationListResponse>(`${CLIENT_API_PREFIX}/notifications?page=${page}&pageSize=${pageSize}`);
  } catch (error) {
    if (forceMockReads || allowMockReadFallback) {
      return {
        items: [],
        pagination: { page, pageSize, total: 0 },
        unreadCount: 0,
      };
    }

    throw error;
  }
}

export async function loadUnreadNotificationCount(): Promise<ClientUnreadNotificationCountResponse> {
  try {
    return await fetchJson<ClientUnreadNotificationCountResponse>(`${CLIENT_API_PREFIX}/notifications/unread-count`);
  } catch (error) {
    if (forceMockReads || allowMockReadFallback) {
      return { unreadCount: 0 };
    }

    throw error;
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<ClientMarkNotificationReadResponse> {
  if (forceMockReads) {
    return {
      id: notificationId,
      read: true,
      readAt: new Date().toISOString(),
      unreadCount: 0,
    };
  }

  return fetchJson<ClientMarkNotificationReadResponse>(`${CLIENT_API_PREFIX}/notifications/${notificationId}/read`, {
    method: 'POST',
  });
}

export async function claimNotification(notificationId: string): Promise<ClientClaimNotificationResponse> {
  if (forceMockReads) {
    return {
      id: notificationId,
      claimStatus: 'claimed',
      claimedAt: new Date().toISOString(),
      unreadCount: 0,
      summary: '模拟模式下已领取附件。',
    };
  }

  return fetchJson<ClientClaimNotificationResponse>(`${CLIENT_API_PREFIX}/notifications/${notificationId}/claim`, {
    method: 'POST',
  });
}

export async function deleteNotification(notificationId: string): Promise<ClientDeleteNotificationResponse> {
  if (forceMockReads) {
    return {
      id: notificationId,
      deleted: true,
      unreadCount: 0,
    };
  }

  return fetchJson<ClientDeleteNotificationResponse>(`${CLIENT_API_PREFIX}/notifications/${notificationId}`, {
    method: 'DELETE',
  });
}

function buildSourceStatus<T>(envelope: DataEnvelope<T>): ClientReadSourceStatus {
  return {
    source: envelope.source,
    fallbackReason: envelope.fallbackReason,
  };
}

function buildIdempotencyKey(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getMockFieldStageStartedAtMs(fieldId: string, totalSeconds: number, fallbackRemainingSeconds: number): number {
  const startedAt = mockFieldTimingState[fieldId]?.statusStartedAt;
  const parsedStartedAt = startedAt ? new Date(startedAt).getTime() : Number.NaN;

  if (Number.isFinite(parsedStartedAt)) {
    return parsedStartedAt;
  }

  return Date.now() - Math.max(totalSeconds - fallbackRemainingSeconds, 0) * 1000;
}

function setMockFieldTiming(fieldId: string, startedAtMs: number): void {
  mockFieldTimingState[fieldId] = {
    statusStartedAt: new Date(startedAtMs).toISOString(),
  };
}

function clearMockFieldTiming(fieldId: string): void {
  delete mockFieldTimingState[fieldId];
}

function setMockFieldPresentation(field: ClientFarmField, tone: ClientFarmField['tone'], seedId?: string, remainingSeconds = 0): void {
  field.cropName = seedId ? (seedLabelMap[seedId] ?? seedId) : undefined;

  if (tone === 'seeded' && seedId) {
    field.title = '播种期';
    field.badge = '播种';
    field.tone = 'seeded';
    field.progressTotalSeconds = getMockSeedStageSeconds(seedId, 'seeded');
    field.progressRemainingSeconds = remainingSeconds;
    field.yieldGold = getMockSeedStageGold(seedId, 'seeded');
    field.description = '播种刚完成，等待进入成长后再决定是否抢收。';
    field.actions = [];
    return;
  }

  if (tone === 'growing' && seedId) {
    field.title = '成熟期';
    field.badge = '成长';
    field.tone = 'growing';
    field.progressTotalSeconds = getMockSeedStageSeconds(seedId, 'growing');
    field.progressRemainingSeconds = remainingSeconds;
    field.yieldGold = getMockSeedStageGold(seedId, 'growing');
    field.description = '可抢收，点击后直接结算一轮提前收取结果。';
    field.actions = [{ label: '提前收取', target: 'farm', tone: 'secondary' }];
    return;
  }

  if (tone === 'mature' && seedId) {
    field.title = '丰熟期';
    field.badge = '丰熟';
    field.tone = 'mature';
    field.progressTotalSeconds = MOCK_RIPE_WINDOW_SECONDS;
    field.progressRemainingSeconds = remainingSeconds;
    field.yieldGold = getMockSeedStageGold(seedId, 'mature');
    field.description = '点击收取，触发爆金币并结算本轮成熟收益。';
    field.actions = [{ label: '成熟收取', target: 'farm', tone: 'primary' }];
    return;
  }

  if (tone === 'withered' && seedId) {
    field.title = '枯萎期';
    field.badge = '枯萎';
    field.tone = 'withered';
    field.progressTotalSeconds = 1;
    field.progressRemainingSeconds = 0;
    field.yieldGold = getMockSeedStageGold(seedId, 'withered');
    field.description = '点击收取，收益已进入衰减段，但仍能爆出金币和种子。';
    field.actions = [{ label: '枯萎收取', target: 'farm', tone: 'secondary' }];
    return;
  }

  field.title = '可培育';
  field.badge = '空闲地块';
  field.cropName = undefined;
  field.tone = 'empty';
  field.progressTotalSeconds = 1;
  field.progressRemainingSeconds = 0;
  field.yieldGold = 0;
  field.description = '点击中央入口，选择种子后立刻开始新一轮培育。';
  field.actions = [{ label: '开始培育', target: 'farm', tone: 'primary' }];
}

function syncMockFieldLifecycle(): void {
  const nowMs = Date.now();

  mockSceneSnapshot.farm.fields.forEach((field) => {
    const seedId = mockFieldSeedAssignments[field.id];

    if (!seedId || field.tone === 'empty' || field.tone === 'locked' || field.tone === 'withered') {
      if (field.tone === 'withered' && seedId) {
        setMockFieldPresentation(field, 'withered', seedId, 0);
      }
      return;
    }

    if (field.tone === 'seeded') {
      const totalSeconds = getMockSeedStageSeconds(seedId, 'seeded');
      const startedAtMs = getMockFieldStageStartedAtMs(field.id, totalSeconds, Math.min(field.progressRemainingSeconds, totalSeconds));
      const elapsedSeconds = Math.max(Math.floor((nowMs - startedAtMs) / 1000), 0);

      if (elapsedSeconds < totalSeconds) {
        setMockFieldTiming(field.id, startedAtMs);
        setMockFieldPresentation(field, 'seeded', seedId, totalSeconds - elapsedSeconds);
        return;
      }

      const nextStartedAtMs = startedAtMs + totalSeconds * 1000;
      setMockFieldTiming(field.id, nextStartedAtMs);
      setMockFieldPresentation(field, 'growing', seedId, getMockSeedStageSeconds(seedId, 'growing'));
    }

    if (field.tone === 'growing') {
      const totalSeconds = getMockSeedStageSeconds(seedId, 'growing');
      const startedAtMs = getMockFieldStageStartedAtMs(field.id, totalSeconds, Math.min(field.progressRemainingSeconds, totalSeconds));
      const elapsedSeconds = Math.max(Math.floor((nowMs - startedAtMs) / 1000), 0);

      if (elapsedSeconds < totalSeconds) {
        setMockFieldTiming(field.id, startedAtMs);
        setMockFieldPresentation(field, 'growing', seedId, totalSeconds - elapsedSeconds);
        return;
      }

      const nextStartedAtMs = startedAtMs + totalSeconds * 1000;
      setMockFieldTiming(field.id, nextStartedAtMs);
      setMockFieldPresentation(field, 'mature', seedId, MOCK_RIPE_WINDOW_SECONDS);
    }

    if (field.tone === 'mature') {
      const startedAtMs = getMockFieldStageStartedAtMs(field.id, MOCK_RIPE_WINDOW_SECONDS, Math.min(field.progressRemainingSeconds || 20 * 60, MOCK_RIPE_WINDOW_SECONDS));
      const elapsedSeconds = Math.max(Math.floor((nowMs - startedAtMs) / 1000), 0);

      if (elapsedSeconds < MOCK_RIPE_WINDOW_SECONDS) {
        setMockFieldTiming(field.id, startedAtMs);
        setMockFieldPresentation(field, 'mature', seedId, MOCK_RIPE_WINDOW_SECONDS - elapsedSeconds);
        return;
      }

      clearMockFieldTiming(field.id);
      setMockFieldPresentation(field, 'withered', seedId, 0);
    }
  });
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
  syncMockFieldLifecycle();
  updateMockFieldStatus();
  syncMockFactionScene();

  return {
    app: mockHomeSnapshot.app,
    summary,
    home: cloneHomeSummary(mockHomeSnapshot),
    scenes: cloneSceneContent(mockSceneSnapshot),
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

function settleMockTemporaryClaim(): void {
  if (!mockHomeSnapshot.temporaryClaim) {
    return;
  }

  if (Date.now() >= new Date(mockHomeSnapshot.temporaryClaim.expiresAt).getTime()) {
    mockHomeSnapshot.temporaryClaim = null;
  }
}

function getMockFactionDividendPerHour(factionContribution: number): { base: number; bonus: number; total: number } {
  const contributionTier = Math.floor(Math.max(Math.floor(factionContribution), 0) / MOCK_FACTION_CONTRIBUTION_STEP);
  const base = MOCK_FACTION_DIVIDEND_BASE_PER_HOUR;
  const bonus = contributionTier * MOCK_FACTION_DIVIDEND_BONUS_PER_STEP_PER_HOUR;
  return {
    base,
    bonus,
    total: base + bonus,
  };
}

function syncMockFactionScene(): void {
  const factionClaim = findMockPendingClaim('faction');
  const { base: baseDividend, bonus: bonusDividend, total: totalDividend } = getMockFactionDividendPerHour(mockFactionContribution);

  if (factionClaim) {
    factionClaim.description = `当前每小时可分到 ${formatNumber(totalDividend)} 金币，其中基础分红 ${formatNumber(baseDividend)}，贡献加成 ${formatNumber(bonusDividend)}。`;
  }

  mockSceneSnapshot.faction.hero = {
    eyebrow: '阵营面板',
    title: '人界阵营',
    description: `当前每小时分红 ${formatNumber(totalDividend)}，先上缴再领取会更划算。`,
    advantage: '人界优势：更擅长把上缴资源转成贡献与分红，适合平衡运营。',
    breakdown: `金额构成：基础分红 ${formatNumber(baseDividend)}/小时 + 贡献加成 ${formatNumber(bonusDividend)}/小时`,
    action: { label: '领取分红', target: 'faction', tone: 'primary' },
  };
  mockSceneSnapshot.faction.contribution = {
    title: '当前贡献值',
    value: formatNumber(mockFactionContribution),
    description: '100 金币 = 1 贡献，捐献后会立刻反馈到贡献值与分红构成。',
  };
  mockSceneSnapshot.faction.comparison = [
    { faction: '人界', advantage: '贡献转化更稳，适合分红运营。', gold: formatNumber(mockFactionTreasuryGold), power: formatNumber(mockFactionArmyPower), isCurrent: true },
    { faction: '仙界', advantage: '被掠损失减少 10%，更适合稳守。', gold: '79,600', power: '1,180' },
    { faction: '魔界', advantage: '掠夺收益增加 10%，但战损更高。', gold: '85,300', power: '1,340' },
  ];
  mockSceneSnapshot.faction.donate = {
    title: '捐钱捐灵宠',
    description: '100 金币 = 1 贡献，确认后会立即从当前总金币和当前灵宠扣除。',
    goldStep: 100,
    contributionRule: '100 金币 = 1 贡献。',
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

function applyMockClaimPending(input: ClientClaimPendingRequest): ClientClaimPendingResponse {
  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'vault');
  settleMockTemporaryClaim();
  const pendingClaim = input.source === 'raid-overflow' ? undefined : findMockPendingClaim(input.source);

  if (!vaultResource || (input.source !== 'raid-overflow' && !pendingClaim)) {
    throw new Error('Mock home summary is missing required resources.');
  }

  const vault = parseCurrentAndCapacity(vaultResource.value);
  const pendingClaimGold = input.source === 'raid-overflow'
    ? mockHomeSnapshot.temporaryClaim?.goldAmount ?? 0
    : parseNumberText(pendingClaim?.value ?? '0');
  const claimableGold = Math.min(Math.max(vault.capacity - vault.current, 0), pendingClaimGold);
  const nextVaultGold = vault.current + claimableGold;
  const overflowGold = Math.max(pendingClaimGold - claimableGold, 0);
  const remainingPendingGold = input.acceptOverflowLoss ? 0 : overflowGold;
  const sourceLabel = input.source === 'tax' ? '主城税收' : input.source === 'faction' ? '阵营分红' : '临时待领取';

  vaultResource.value = `${formatNumber(nextVaultGold)} / ${formatNumber(vault.capacity)}`;
  if (input.source === 'raid-overflow') {
    mockHomeSnapshot.temporaryClaim = remainingPendingGold > 0 && mockHomeSnapshot.temporaryClaim
      ? {
          ...mockHomeSnapshot.temporaryClaim,
          goldAmount: remainingPendingGold,
        }
      : null;
  } else if (pendingClaim) {
    pendingClaim.value = formatNumber(remainingPendingGold);
  }
  syncMockFactionScene();
  if (input.source === 'faction' && claimableGold > 0) {
    updateMockDailyTask('daily-faction-touch');
  }

  const summary = input.acceptOverflowLoss && overflowGold > 0
    ? `${sourceLabel}本次入库 ${formatNumber(claimableGold)} 金币，另有 ${formatNumber(overflowGold)} 已确认放弃。`
    : claimableGold > 0
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
  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('claim-pending');
  const response = await fetchJson<ClientClaimPendingResponse>(`${CLIENT_API_PREFIX}/actions/claim-pending`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      ...input,
      requestIdempotencyKey: idempotencyKey,
    }),
  });

  mockHomeSnapshot = cloneHomeSummary(response.home);
  mockSceneSnapshot = cloneSceneContent(response.scenes);
  return response;
}

function applyMockClaimDailyTask(input: ClientClaimDailyTaskRequest): ClientClaimDailyTaskResponse {
  const task = mockHomeSnapshot.dailyTasks.find((item) => item.id === input.taskId);
  const rewardGold = task?.rewardGold ?? 0;

  if (!task || task.status !== 'completed') {
    return {
      app: mockHomeSnapshot.app,
      summary: '当前任务尚未完成，暂时不能领取。',
      taskId: input.taskId,
      rewardGold: 0,
      claimedGold: 0,
      overflowGold: 0,
      home: cloneHomeSummary(mockHomeSnapshot),
      scenes: cloneSceneContent(mockSceneSnapshot),
    };
  }

  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'vault');
  const vault = vaultResource ? parseCurrentAndCapacity(vaultResource.value) : null;
  const availableVaultSpace = vault ? Math.max(vault.capacity - vault.current, 0) : 0;
  const claimedGold = Math.min(rewardGold, availableVaultSpace);
  const overflowGold = Math.max(rewardGold - claimedGold, 0);

  if (overflowGold > 0 && !input.acceptOverflowLoss) {
    return {
      app: mockHomeSnapshot.app,
      summary: `${task.title} 奖励共 ${formatNumber(rewardGold)} 金币，其中约 ${formatNumber(overflowGold)} 会因金币已满无法入账。确认后将默认放弃溢出部分。`,
      taskId: input.taskId,
      rewardGold,
      claimedGold: 0,
      overflowGold,
      home: cloneHomeSummary(mockHomeSnapshot),
      scenes: cloneSceneContent(mockSceneSnapshot),
    };
  }

  claimMockDailyTask(input.taskId);
  applyVaultGoldDelta(claimedGold);

  return {
    app: mockHomeSnapshot.app,
    summary: overflowGold > 0
      ? `${task.title} 已结算，入账 ${formatNumber(claimedGold)} 金币，另有 ${formatNumber(overflowGold)} 已确认放弃。`
      : `${task.title} 已结算，入账 ${formatNumber(claimedGold)} 金币。`,
    taskId: input.taskId,
    rewardGold,
    claimedGold,
    overflowGold,
    home: cloneHomeSummary(mockHomeSnapshot),
    scenes: cloneSceneContent(mockSceneSnapshot),
  };
}

export async function claimDailyTaskReward(input: ClientClaimDailyTaskRequest): Promise<ClientClaimDailyTaskResponse> {
  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('claim-daily-task');
  const response = await fetchJson<ClientClaimDailyTaskResponse>(`${CLIENT_API_PREFIX}/actions/claim-daily-task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      ...input,
      requestIdempotencyKey: idempotencyKey,
    }),
  });

  mockHomeSnapshot = cloneHomeSummary(response.home);
  mockSceneSnapshot = cloneSceneContent(response.scenes);
  return response;
}

function applyMockStartCultivation(input: ClientStartCultivationRequest): ClientStateMutationResponse {
  syncMockFieldLifecycle();
  const field = mockSceneSnapshot.farm.fields.find((item) => item.id === input.fieldId);
  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'vault');

  if (!field || !vaultResource || field.tone === 'locked') {
    return buildMockMutation('当前地块尚未解锁，无法开始培育。');
  }

  if (field.tone !== 'empty') {
    return buildMockMutation('当前地块已经在培育中或可直接收取。');
  }

  if (!mockBootstrapSnapshot.backpack.unlockedSeedIds.includes(input.seedId)) {
    return buildMockMutation('当前种子尚未解锁，无法开始本轮培育。');
  }

  if ((mockBootstrapSnapshot.backpack.seedInventory[input.seedId] ?? 0) <= 0) {
    return buildMockMutation('当前种子库存不足，无法开始本轮培育。');
  }

  mockBootstrapSnapshot.backpack.seedInventory[input.seedId] = Math.max((mockBootstrapSnapshot.backpack.seedInventory[input.seedId] ?? 0) - 1, 0);
  setMockFieldTiming(input.fieldId, Date.now());
  setMockFieldPresentation(field, 'seeded', input.seedId, getMockSeedStageSeconds(input.seedId, 'seeded'));
  mockFieldSeedAssignments[input.fieldId] = input.seedId;
  updateMockDailyTask('daily-start-cultivation');

  return buildMockMutation(`${field.code} 已播下 ${seedLabelMap[input.seedId] ?? input.seedId}，开始新一轮培育。`);
}

function applyMockClaimStarterSeeds(): ClientStateMutationResponse {
  if (mockBootstrapSnapshot.backpack.starterSeedClaimed) {
    return buildMockMutation('今日种子已经领取过了。');
  }

  mockBootstrapSnapshot.backpack.starterSeedClaimed = true;
  applyMockSeedRewards([{ seedId: 'qinglingmai', quantity: 3 }]);

  return buildMockMutation('今日种子已领取，获得 青灵麦 x3。');
}

function applyMockClaimTianjiTalisman(): ClientStateMutationResponse {
  if (mockBootstrapSnapshot.backpack.tianjiTalismanClaimed) {
    return buildMockMutation('今天天机符已经领取过了。');
  }

  mockBootstrapSnapshot.backpack.tianjiTalismanClaimed = true;
  mockBootstrapSnapshot.backpack.globalItemInventory.tianjiTalisman = (mockBootstrapSnapshot.backpack.globalItemInventory.tianjiTalisman ?? 0) + 1;

  return buildMockMutation('今天天机符已领取，获得 天机符 x1。');
}

function applyMockClaimSpiritSoul(): ClientStateMutationResponse {
  if (mockBootstrapSnapshot.backpack.spiritSoulClaimed) {
    return buildMockMutation('今天兽魂已经领取过了。');
  }

  const amount = Math.max(mockBootstrapSnapshot.backpack.dailySpiritSoulAmount ?? mockHomeSnapshot.castleLevel ?? 1, 1);
  mockBootstrapSnapshot.backpack.spiritSoulClaimed = true;
  mockBootstrapSnapshot.backpack.globalItemInventory.spiritSoul = (mockBootstrapSnapshot.backpack.globalItemInventory.spiritSoul ?? 0) + amount;

  return buildMockMutation(`今日兽魂已领取，获得 兽魂 x${amount}。`);
}

function applyMockRecruitArmy(input: ClientRecruitArmyRequest): ClientStateMutationResponse {
  syncMockArmyTrainingQueue();

  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'vault');
  const armyResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'army');

  if (!vaultResource || !armyResource) {
    return buildMockMutation('当前缺少灵宠培育所需资源数据，请稍后重试。');
  }

  const requestedCount = Math.max(Math.floor(input.recruitCount), 0);
  if (requestedCount <= 0) {
    return buildMockMutation('请输入有效的灵宠培育数量。');
  }

  const vault = parseCurrentAndCapacity(vaultResource.value);
  const army = parseCurrentAndCapacity(armyResource.value);
  const queuedArmyCount = mockSceneSnapshot.army.queue?.queuedUnits ?? 0;
  const availableArmySpace = Math.max(army.capacity - army.current - queuedArmyCount, 0);
  const unitCostGold = mockSceneSnapshot.army.unitCostGold;
  const unitTrainingSeconds = mockSceneSnapshot.army.unitTrainingSeconds;

  if (availableArmySpace <= 0) {
    return buildMockMutation('当前灵宠已满，请先扩充上限后再继续培育。');
  }

  const affordableCount = unitCostGold > 0 ? Math.floor(vault.current / unitCostGold) : 0;
  if (affordableCount <= 0) {
    return buildMockMutation('金币不足，当前无法开始培育灵宠。');
  }

  const actualRecruitCount = Math.min(requestedCount, availableArmySpace, affordableCount);
  const totalCost = actualRecruitCount * unitCostGold;
  const currentQueue = mockSceneSnapshot.army.queue;
  const remainingSeconds = currentQueue
    ? Math.max(Math.ceil((new Date(currentQueue.readyAt).getTime() - Date.now()) / 1000), 0)
    : 0;
  const nextTotalSeconds = remainingSeconds + actualRecruitCount * unitTrainingSeconds;

  applyVaultGoldDelta(-totalCost);
  mockSceneSnapshot.army.queue = {
    queuedUnits: (currentQueue?.queuedUnits ?? 0) + actualRecruitCount,
    totalCost: (currentQueue?.totalCost ?? 0) + totalCost,
    startedAt: new Date().toISOString(),
    readyAt: new Date(Date.now() + nextTotalSeconds * 1000).toISOString(),
    totalSeconds: nextTotalSeconds,
    remainingSeconds: nextTotalSeconds,
  };
  updateMockDailyTask('daily-upgrade-spirit', actualRecruitCount > 0 ? 1 : 0);

  return buildMockMutation(
    actualRecruitCount < requestedCount
      ? `本次新增 ${formatNumber(actualRecruitCount)} 只灵宠进入培育队列，已立即扣除 ${formatNumber(totalCost)} 金币；其余部分受金币或灵宠上限限制。`
      : currentQueue
        ? `已追加 ${formatNumber(actualRecruitCount)} 只灵宠到当前培育队列，金币已立即扣除，剩余培育时间已重算。`
        : `已开始培育 ${formatNumber(actualRecruitCount)} 只灵宠，金币已立即扣除，倒计时结束后才会增加守护灵宠。`,
  );
}

function applyMockRaidTarget(input: ClientRaidActionRequest): ClientRaidActionResponse {
void claimMockDailyTask;
void applyMockClaimPending;
void applyMockClaimDailyTask;
void applyMockRecruitArmy;

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
        depositedGold: 0,
        overflowGold: 0,
        temporaryClaimExpiresAt: null,
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
  const overflowGold = Math.max(rawGoldLoot - depositedGold, 0);
  const casualtyRatio = clamp(0.1 + (combatPower / Math.max(army.current, 1)) * 0.04 - (success ? 0.03 : 0), 0.08, 0.42);
  const casualties = Math.min(Math.max(Math.ceil(army.current * casualtyRatio), 1), army.current);
  const rewardMap: Record<string, { seedId: string; label: string; quantity: number; chance: number }> = {
    'target-1': { seedId: 'zhanqingsi', label: '斩情丝', quantity: 1, chance: 0.18 },
    'target-2': { seedId: 'hundunguo', label: '混沌果', quantity: 1, chance: 0.14 },
    'target-3': { seedId: 'xueyuehua', label: '雪月花', quantity: 1, chance: 0.12 },
    'target-4': { seedId: 'jingdaosong', label: '劲道松', quantity: 1, chance: 0.16 },
    'target-5': { seedId: 'huichuncao', label: '回春草', quantity: 1, chance: 0.1 },
  };
  const rewardConfig = rewardMap[input.targetId];
  const rewards = rewardConfig && Math.random() < clamp(rewardConfig.chance + (powerRatio < 0.35 ? 0.08 : 0) + (success ? 0.05 : 0), 0.1, 0.55)
    ? [{ seedId: rewardConfig.seedId, label: rewardConfig.label, quantity: rewardConfig.quantity }]
    : [];

  applyVaultGoldDelta(depositedGold);
  if (overflowGold > 0) {
    settleMockTemporaryClaim();
    mockHomeSnapshot.temporaryClaim = {
      source: 'raid-overflow',
      label: '待领取',
      goldAmount: (mockHomeSnapshot.temporaryClaim?.goldAmount ?? 0) + overflowGold,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      description: '掠夺时金库已满，超出的金币会临时保留在这里，过期后消失。',
    };
  }
  applyMockSeedRewards(rewards);
  applyArmyCountDelta(-casualties);
  mockSceneSnapshot.raid.targets = mockSceneSnapshot.raid.targets.filter((item) => item.id !== input.targetId);
  mockSceneSnapshot.report.attack.unshift({
    title: `${target.faction} · ${target.name}`,
    tag: success ? '掠夺成功' : '强袭试探',
    tone: success ? 'success' : 'neutral',
    createdAt: new Date().toISOString(),
    summary: `你对${target.name}发起黑盒掠夺，带回 ${formatNumber(rawGoldLoot)} 金币，其中 ${formatNumber(depositedGold)} 已入库${overflowGold > 0 ? `，另有 ${formatNumber(overflowGold)} 已转入待领取` : ''}，折损 ${formatNumber(casualties)} 只灵宠${rewards.length > 0 ? `，额外获得 ${rewards.map((reward) => `${reward.label} x${reward.quantity}`).join('、')}` : ''}。目标已进入 1 小时防护。`,
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
  const reportSummary = `你对${target.name}发起黑盒掠夺，带回 ${formatNumber(rawGoldLoot)} 金币，其中 ${formatNumber(depositedGold)} 已入库${overflowGold > 0 ? `，另有 ${formatNumber(overflowGold)} 已转入待领取` : ''}，折损 ${formatNumber(casualties)} 只灵宠${rewardSummary}。`;
  return {
    app: mockHomeSnapshot.app,
    summary: overflowGold > 0
      ? `${target.name} 已进入 1 小时防护，本次掠夺 ${formatNumber(rawGoldLoot)} 金币，其中 ${formatNumber(depositedGold)} 已入库，另有 ${formatNumber(overflowGold)} 转入待领取，折损 ${formatNumber(casualties)} 只灵宠${rewardSummary}。`
      : `${target.name} 已进入 1 小时防护，本次获得 ${formatNumber(rawGoldLoot)} 金币，折损 ${formatNumber(casualties)} 只灵宠${rewardSummary}。`,
    home: cloneHomeSummary(mockHomeSnapshot),
    scenes: cloneSceneContent(mockSceneSnapshot),
    result: {
      targetId: input.targetId,
      targetName: target.name,
      goldLoot: rawGoldLoot,
      depositedGold,
      overflowGold,
      temporaryClaimExpiresAt: mockHomeSnapshot.temporaryClaim?.expiresAt ?? null,
      casualties,
      rewards,
      protectedUntil,
      reportSummary,
    },
  };
}

function applyMockFactionDonate(input: ClientFactionDonateRequest): ClientStateMutationResponse {
  const vaultResource = mockHomeSnapshot.resources.find((resource) => resource.tone === 'vault');

  if (!vaultResource) {
    throw new Error('Mock home summary is missing faction donate resources.');
  }

  const goldStep = mockSceneSnapshot.faction.donate.goldStep;
  const vault = parseCurrentAndCapacity(vaultResource.value);
  const actualGoldAmount = Math.min(Math.max(Math.floor(input.goldAmount / goldStep) * goldStep, 0), Math.floor(vault.current / goldStep) * goldStep);

  if (actualGoldAmount <= 0) {
    return buildMockMutation('请先选择要捐出的金币。');
  }

  const contributionGain = actualGoldAmount / goldStep;
  applyVaultGoldDelta(-actualGoldAmount);
  mockFactionContribution += contributionGain;
  mockFactionTreasuryGold += actualGoldAmount;
  updateMockDailyTask('daily-faction-touch');

  return buildMockMutation(`已向阵营捐出 ${formatNumber(actualGoldAmount)} 金币，贡献值 +${formatNumber(contributionGain)}。`);
}

export async function collectFieldEarnings(input: ClientCollectFieldRequest): Promise<ClientCollectFieldResponse> {
  const idempotencyKey = buildIdempotencyKey('collect-field');
  const response = await fetchJson<ClientCollectFieldResponse>(`${CLIENT_API_PREFIX}/actions/collect-field`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      ...input,
      requestIdempotencyKey: idempotencyKey,
    }),
  });

  mockHomeSnapshot = cloneHomeSummary(response.home);
  mockSceneSnapshot = cloneSceneContent(response.scenes);
  return response;
}

export async function startFieldCultivation(input: ClientStartCultivationRequest): Promise<ClientStateMutationResponse> {
  if (forceMockCommands) {
    return applyMockStartCultivation(input);
  }

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
}

export async function recruitArmyUnits(input: ClientRecruitArmyRequest): Promise<ClientStateMutationResponse> {
  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('recruit-army');
  const response = await fetchJson<ClientStateMutationResponse>(`${CLIENT_API_PREFIX}/actions/recruit-army`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      ...input,
      requestIdempotencyKey: idempotencyKey,
    }),
  });

  mockHomeSnapshot = cloneHomeSummary(response.home);
  mockSceneSnapshot = cloneSceneContent(response.scenes);
  return response;
}

export async function upgradeClientBuilding(input: ClientUpgradeBuildingRequest): Promise<ClientStateMutationResponse> {
  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('upgrade-building');
  const response = await fetchJson<ClientStateMutationResponse>(`${CLIENT_API_PREFIX}/actions/upgrade-building`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      ...input,
      requestIdempotencyKey: idempotencyKey,
    }),
  });

  mockHomeSnapshot = cloneHomeSummary(response.home);
  mockSceneSnapshot = cloneSceneContent(response.scenes);
  return response;
}

export async function donateFactionResources(input: ClientFactionDonateRequest): Promise<ClientStateMutationResponse> {
  if (forceMockCommands) {
    return applyMockFactionDonate(input);
  }

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
}

export async function claimStarterSeedPack(): Promise<ClientStateMutationResponse> {
  if (forceMockCommands) {
    return applyMockClaimStarterSeeds();
  }

  return fetchJson<ClientStateMutationResponse>(`${CLIENT_API_PREFIX}/actions/claim-starter-seeds`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
}

export async function claimTianjiTalismanItem(): Promise<ClientStateMutationResponse> {
  if (forceMockCommands) {
    return applyMockClaimTianjiTalisman();
  }

  return fetchJson<ClientStateMutationResponse>(`${CLIENT_API_PREFIX}/actions/claim-tianji-talisman`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
}

export async function claimSpiritSoulItem(): Promise<ClientStateMutationResponse> {
  if (forceMockCommands) {
    return applyMockClaimSpiritSoul();
  }

  return fetchJson<ClientStateMutationResponse>(`${CLIENT_API_PREFIX}/actions/claim-spirit-soul`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
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
    mockFieldTimingState = buildInitialMockFieldTimingStates();
    syncMockFactionScene();
    syncMockFieldLifecycle();

    return {
      app: mockHomeSnapshot.app,
      summary: '实验数据已重置到初始状态，可以重新验证领取、收取和升级链路。',
      home: cloneHomeSummary(mockHomeSnapshot),
      scenes: cloneSceneContent(mockSceneSnapshot),
    };
  };

  if (forceMockCommands) {
    return resetMockState();
  }

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
  mockFieldTimingState = buildInitialMockFieldTimingStates();
  return response;
}

export async function loadRaidTargetDetail(targetId: string): Promise<ClientRaidTargetDetailResponse> {
  const fallback = mockRaidTargetDetails[targetId];

  if (forceMockReads) {
    if (!fallback) {
      throw new Error(`Missing mock raid target detail for ${targetId}`);
    }

    return normalizeRaidTargetDetail(structuredClone(fallback));
  }

  try {
    return normalizeRaidTargetDetail(await fetchJson<ClientRaidTargetDetailResponse>(`${CLIENT_API_PREFIX}/raid-targets/${targetId}`));
  } catch (error) {
    if (!allowMockReadFallback) {
      throw new Error(`raid target detail read requires real API but failed: ${getFallbackReason(error)}`);
    }

    if (!fallback) {
      throw new Error(`Missing mock raid target detail for ${targetId}`);
    }

    return normalizeRaidTargetDetail(structuredClone(fallback));
  }
}

export async function revealRaidTargetDeepIntel(targetId: string): Promise<ClientRaidDeepIntelResponse> {
  if (forceMockReads || forceMockCommands) {
    const detail = mockRaidTargetDetails[targetId];

    if (!detail) {
      throw new Error(`Missing mock raid target detail for ${targetId}`);
    }

    return {
      app: detail.app,
      targetId,
      mainPetPreview: detail.mainPetPreview,
      intel: {
        element: 'fire',
        attackRating: 'A',
        defenseRating: 'B',
        healthStatus: '状态良好',
        remainingFreeIntel: 2,
        remainingTalismanIntel: 3,
      },
    };
  }

  return fetchJson<ClientRaidDeepIntelResponse>(`${CLIENT_API_PREFIX}/raid-targets/${targetId}/deep-intel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
}

export async function raidClientTarget(input: ClientRaidActionRequest): Promise<ClientRaidActionResponse> {
  if (forceMockCommands) {
    return applyMockRaidTarget(input);
  }

  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('raid-target');
  const response = await fetchJson<ClientRaidActionResponse>(`${CLIENT_API_PREFIX}/actions/raid-target`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      ...input,
      requestIdempotencyKey: idempotencyKey,
    }),
  });

  mockHomeSnapshot = cloneHomeSummary(response.home);
  mockSceneSnapshot = cloneSceneContent(response.scenes);
  return response;
}

export async function buySpiritSoul(input: ClientBuySpiritSoulRequest): Promise<ClientSpiritMutationResponse> {
  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('spirit-buy-soul');
  const response = await fetchJson<ClientSpiritMutationResponse>(`${CLIENT_API_PREFIX}/spirit/buy-soul`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      ...input,
      requestIdempotencyKey: idempotencyKey,
    }),
  });

  mockHomeSnapshot = cloneHomeSummary(response.home);
  mockSceneSnapshot = cloneSceneContent(response.scenes);
  return {
    ...response,
    spirit: cloneSpiritState(response.spirit),
  };
}

export async function upgradeSpirit(input: ClientUpgradeSpiritRequest): Promise<ClientSpiritMutationResponse> {
  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('spirit-upgrade');
  const response = await fetchJson<ClientSpiritMutationResponse>(`${CLIENT_API_PREFIX}/spirit/upgrade`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      ...input,
      requestIdempotencyKey: idempotencyKey,
    }),
  });

  mockHomeSnapshot = cloneHomeSummary(response.home);
  mockSceneSnapshot = cloneSceneContent(response.scenes);
  return {
    ...response,
    spirit: cloneSpiritState(response.spirit),
  };
}

export async function setMainSpirit(input: ClientSetMainSpiritRequest): Promise<ClientSpiritMutationResponse> {
  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('spirit-set-main');
  const response = await fetchJson<ClientSpiritMutationResponse>(`${CLIENT_API_PREFIX}/spirit/set-main`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      ...input,
      requestIdempotencyKey: idempotencyKey,
    }),
  });

  mockHomeSnapshot = cloneHomeSummary(response.home);
  mockSceneSnapshot = cloneSceneContent(response.scenes);
  return {
    ...response,
    spirit: cloneSpiritState(response.spirit),
  };
}

export async function recoverSpirit(input: ClientRecoverSpiritRequest): Promise<ClientSpiritMutationResponse> {
  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('spirit-recover');
  const response = await fetchJson<ClientSpiritMutationResponse>(`${CLIENT_API_PREFIX}/spirit/recover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      ...input,
      requestIdempotencyKey: idempotencyKey,
    }),
  });

  mockHomeSnapshot = cloneHomeSummary(response.home);
  mockSceneSnapshot = cloneSceneContent(response.scenes);
  return {
    ...response,
    spirit: cloneSpiritState(response.spirit),
  };
}

export async function dissolveSpirit(input: ClientDissolveSpiritRequest): Promise<ClientSpiritMutationResponse> {
  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('spirit-dissolve');
  const response = await fetchJson<ClientSpiritMutationResponse>(`${CLIENT_API_PREFIX}/spirit/dissolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      ...input,
      requestIdempotencyKey: idempotencyKey,
    }),
  });

  mockHomeSnapshot = cloneHomeSummary(response.home);
  mockSceneSnapshot = cloneSceneContent(response.scenes);
  return {
    ...response,
    spirit: cloneSpiritState(response.spirit),
  };
}

export async function composeSpirit(input: ClientComposeSpiritRequest): Promise<ClientSpiritMutationResponse> {
  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('spirit-compose');
  const response = await fetchJson<ClientSpiritMutationResponse>(`${CLIENT_API_PREFIX}/spirit/compose`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      ...input,
      requestIdempotencyKey: idempotencyKey,
    }),
  });

  mockHomeSnapshot = cloneHomeSummary(response.home);
  mockSceneSnapshot = cloneSceneContent(response.scenes);
  return {
    ...response,
    spirit: cloneSpiritState(response.spirit),
  };
}

function readStoredDevLoginSession(): DevLoginSession | null {
  try {
    const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as DevLoginSession;

    if (!parsed.accessToken || !parsed.expiresAt || new Date(parsed.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeStoredDevLoginSession(session: DevLoginSession): void {
  devLoginSession = session;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function getStoredDevLoginSession(): DevLoginSession | null {
  return devLoginSession;
}

export function clearDevLoginSession(): void {
  devLoginSession = null;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function devLogin(mode: DevLoginMode): Promise<DevLoginSession> {
  const loginRequest = buildDevLoginRequest(mode);
  const response = await fetchJson<DevLoginResponse>(`${CLIENT_API_PREFIX}/auth/dev-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(loginRequest),
  });

  const session: DevLoginSession = {
    accessToken: response.accessToken,
    expiresAt: response.expiresAt,
    player: response.player,
    mode,
  };

  writeStoredDevLoginSession(session);
  return session;
}

export function getDevLoginModeLabel(mode: DevLoginMode | null | undefined): string {
  if (mode === 'new-user') {
    return '新用户';
  }

  if (mode === 'existing-user') {
    return '已注册用户';
  }

  if (mode === 'test-user-1') {
    return '测试用户1';
  }

  if (mode === 'test-user-2') {
    return '测试用户2';
  }

  return '未登录';
}

function buildDevLoginRequest(mode: DevLoginMode): { providerUserId: string; nickname: string; factionCode: string } {
  if (mode === 'new-user') {
    return {
      providerUserId: `dev-ui-${Date.now()}`,
      nickname: '新测试玩家',
      factionCode: 'human',
    };
  }

  if (mode === 'existing-user') {
    return {
      providerUserId: 'dev-main-loop',
      nickname: '主循环测试号',
      factionCode: 'immortal',
    };
  }

  if (mode === 'test-user-1') {
    return {
      providerUserId: 'dev-verifier-1',
      nickname: '测试用户1',
      factionCode: 'human',
    };
  }

  return {
    providerUserId: 'dev-verifier-2',
    nickname: '测试用户2',
    factionCode: 'demon',
  };
}
