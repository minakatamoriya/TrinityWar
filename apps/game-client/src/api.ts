import {
  API_PREFIX,
  CLIENT_API_PREFIX,
  formatSeasonLabel,
  type ClientClaimNotificationResponse,
  type ClientClaimStarterSeedRequest,
  type ClientClaimStarterSeedResponse,
  type ClientCompleteShareInviteTutorialRequest,
  type ClientCompleteShareInviteTutorialResponse,
  type ClientDeleteNotificationResponse,
  type ClientBuySpiritSoulRequest,
  type ClientBuySpiritShopItemRequest,
  type ClientBreakthroughSpiritRequest,
  type ClientBootstrapResponse,
  type ClientArmyTrainingQueue,
  type ClientClaimDailyTaskRequest,
  type ClientClaimDailyTaskResponse,
  type ClientClaimFactionStipendRequest,
  type ClientClaimFactionStipendResponse,
  type ClientClaimSpiritAdRewardRequest,
  type ClientComposeSpiritRequest,
  type ClientFeedSpiritRequest,
  type ClientRaidActionRequest,
  type ClientRaidActionResponse,
  type ClientRaidBattleReplayResponse,
  type ClientRaidDeepIntelResponse,
  type ClientDissolveSpiritRequest,
  type ClientFactionDonateRequest,
  type ClientFactionTaskSubmitRequest,
  type ClientFactionTaskSubmitResponse,
  type ClientClaimPendingRequest,
  type ClientClaimPendingResponse,
  type ClientClaimSeasonSignInResponse,
  type ClientCollectFieldRequest,
  type ClientCollectFieldResponse,
  type ClientDailyTaskSummary,
  type ClientFarmBoardState,
  type ClientFarmBoardUpdateRequest,
  type ClientFarmBoardUpdateResponse,
  type ClientFarmField,
  type ClientMarkNotificationReadResponse,
  type ClientNotificationListResponse,
  type ClientRaidTargetDetailResponse,
  type ClientRecruitArmyRequest,
  type ClientResetDemoStateResponse,
  type ClientSceneContentResponse,
  type ClientSeasonRewardsResponse,
  type ClientSeasonSignInResponse,
  type ClientStartCultivationRequest,
  type ClientStateMutationResponse,
  type ClientUnlockPlantRequest,
  type ClientUnlockPlantResponse,
  type ClientUnreadNotificationCountResponse,
  type ClientSetMainSpiritRequest,
  type ClientCreateShareAssistCampaignRequest,
  type ClientCreateShareAssistCampaignResponse,
  type ClientSpiritMutationResponse,
  type ClientSpiritState,
  type ClientSpiritStateResponse,
  type PublicShareAssistCampaignResponse,
  type PublicShareAssistConfirmRequest,
  type PublicShareAssistConfirmResponse,
  type ClientSocialAssistResponse,
  type ClientSocialFeedResponse,
  type ClientSocialFriendRequest,
  type ClientSocialFriendFieldVisitResponse,
  type ClientSocialHarvestFieldPreviewResponse,
  type ClientSocialHarvestFieldRequest,
  type ClientSocialRelationListResponse,
  type ClientSocialRelationMutationResponse,
  type ClientSocialReviveFieldRequest,
  type ClientSocialSummaryResponse,
  type ClientResolveSpiritTraitRollRequest,
  type ClientRollSpiritTraitsResponse,
  type ClientRollSpiritTraitsRequest,
  type ClientUpgradeBuildingRequest,
  type ClientUpgradeSpiritRequest,
  type HomeSummaryResponse,
} from '@trinitywar/shared';
import { mockBootstrap, mockHomeSummary, mockRaidTargetDetails, mockSceneContent } from './mockData';
import {
  cloneBootstrap,
  cloneHomeSummary,
  cloneSceneContent,
  cloneSpiritState,
  normalizeBootstrap,
  normalizeHomeSummary,
} from './apiSupport/clientSnapshot';
import {
  setStoredDevLoginSession,
  type DevFactionChoice,
  type DevLoginMode,
  type DevLoginSession,
} from './apiSupport/devAuthSession';
import { parseViteBoolean } from './apiSupport/env';
import { fetchJson, getFallbackReason } from './apiSupport/httpClient';
import { buildIdempotencyKey } from './apiSupport/idempotency';
import { clamp, formatNumber, parseCurrentAndCapacity, parseNumberText } from './apiSupport/mockNumbers';
import {
  getMockCultivationSeconds,
  getMockSeedGrowthSeconds,
  getMockSeedStageGold,
  seedLabelMap,
} from './apiSupport/mockSeedRules';
import {
  buildSourceStatus,
  type ClientReadPolicy,
  type ClientReadSources,
  type DataEnvelope,
} from './apiSupport/readPolicy';
export { ApiError } from './apiSupport/httpClient';
export type {
  ClientReadEndpoint,
  ClientReadSourceLabels,
  ClientReadSourceStatus,
  ClientReadSources,
  DataSource,
} from './apiSupport/readPolicy';
export {
  clearDevLoginSession,
  getStoredDevLoginSession,
  type DevFactionChoice,
  type DevLoginMode,
  type DevLoginSession,
} from './apiSupport/devAuthSession';

const forceMockReads = parseViteBoolean(import.meta.env.VITE_FORCE_MOCK_READS);
const allowMockReadFallback = parseViteBoolean(import.meta.env.VITE_ALLOW_MOCK_READ_FALLBACK);
const forceMockCommands = parseViteBoolean(import.meta.env.VITE_FORCE_MOCK_COMMANDS);
const PUBLIC_API_PREFIX = `${API_PREFIX}/public`;

interface DevLoginResponse {
  accessToken: string;
  expiresAt: string;
  player: {
    id: string;
    nickname: string;
    castleLevel: number;
    faction?: {
      code: DevFactionChoice;
    } | null;
  };
}

export interface ClientViewModel {
  bootstrap: ClientBootstrapResponse;
  home: HomeSummaryResponse;
  scenes: ClientSceneContentResponse;
  usingMock: boolean;
  sources: ClientReadSources;
}

let mockBootstrapSnapshot: ClientBootstrapResponse = cloneBootstrap(mockBootstrap);
let mockHomeSnapshot: HomeSummaryResponse = cloneHomeSummary(mockHomeSummary);
let mockSceneSnapshot: ClientSceneContentResponse = cloneSceneContent(mockSceneContent);
const INITIAL_MOCK_FACTION_CONTRIBUTION = 40;
const INITIAL_MOCK_FACTION_ARMY_POWER = 1260;
const INITIAL_MOCK_FIELD_SEED_ASSIGNMENTS: Record<string, string> = {
  'field-1': 'qilingya',
  'field-2': 'qinglingmai',
  'field-3': 'qinglingmai',
};
const MOCK_collect_window_SECONDS = 30 * 60;
let mockFactionContribution = INITIAL_MOCK_FACTION_CONTRIBUTION;
let mockFactionArmyPower = INITIAL_MOCK_FACTION_ARMY_POWER;
let mockFieldSeedAssignments: Record<string, string> = { ...INITIAL_MOCK_FIELD_SEED_ASSIGNMENTS };

interface MockFieldTimingState {
  statusStartedAt: string;
}

function buildInitialMockFieldTimingStates(): Record<string, MockFieldTimingState> {
  const nowMs = Date.now();
  return mockSceneContent.farm.fields.reduce<Record<string, MockFieldTimingState>>((table, field) => {
    const seedId = INITIAL_MOCK_FIELD_SEED_ASSIGNMENTS[field.id];

    if (!seedId || (field.tone !== 'growing' && field.tone !== 'mature')) {
      return table;
    }

    const totalSeconds = field.tone === 'mature'
      ? MOCK_collect_window_SECONDS
      : getMockSeedGrowthSeconds(seedId);
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

function normalizeRaidTargetDetail(detail: ClientRaidTargetDetailResponse): ClientRaidTargetDetailResponse {
  return {
    ...detail,
    remainingFreeIntel: detail.remainingFreeIntel ?? 0,
    remainingTalismanIntel: detail.remainingTalismanIntel ?? 0,
  };
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

export async function loadFarmBoard(): Promise<ClientFarmBoardState> {
  if (forceMockReads) {
    return {
      farmBoardMessage: '成熟田可看，手快者得。',
      farmBoardUpdatedAt: null,
      farmBoardVersion: 1,
    };
  }

  return fetchJson<ClientFarmBoardState>(`${CLIENT_API_PREFIX}/profile/farm-board`);
}

export async function loadSeasonSignIn(): Promise<ClientSeasonSignInResponse> {
  if (forceMockReads) {
    return buildMockSeasonSignIn();
  }

  try {
    return await fetchJson<ClientSeasonSignInResponse>(`${CLIENT_API_PREFIX}/season/sign-in`);
  } catch (error) {
    if (allowMockReadFallback) {
      return buildMockSeasonSignIn();
    }

    throw error;
  }
}

export async function loadSeasonRewards(): Promise<ClientSeasonRewardsResponse> {
  if (forceMockReads) {
    return buildMockSeasonRewards();
  }

  try {
    return await fetchJson<ClientSeasonRewardsResponse>(`${CLIENT_API_PREFIX}/season/rewards`);
  } catch (error) {
    if (allowMockReadFallback) {
      return buildMockSeasonRewards();
    }

    throw error;
  }
}

export async function claimSeasonSignIn(): Promise<ClientClaimSeasonSignInResponse> {
  if (forceMockCommands) {
    const signIn = buildMockSeasonSignIn([buildMockSeasonSignIn().currentDay]);
    const rewardTianjiTalisman = signIn.todayReward;
    mockBootstrapSnapshot.backpack.globalItemInventory.tianjiTalisman = (mockBootstrapSnapshot.backpack.globalItemInventory.tianjiTalisman ?? 0) + rewardTianjiTalisman;
    return {
      app: mockBootstrapSnapshot.app,
      summary: `签到成功，获得天机符 x${rewardTianjiTalisman}。`,
      rewardTianjiTalisman,
      tianjiTalisman: mockBootstrapSnapshot.backpack.globalItemInventory.tianjiTalisman,
      resourceVersion: 1,
      signIn,
    };
  }

  return fetchJson<ClientClaimSeasonSignInResponse>(`${CLIENT_API_PREFIX}/actions/claim-season-sign-in`, {
    method: 'POST',
  });
}

export async function updateFarmBoard(input: ClientFarmBoardUpdateRequest): Promise<ClientFarmBoardUpdateResponse> {
  if (forceMockCommands) {
    return {
      app: mockHomeSnapshot.app,
      summary: '留言板已更新。',
      board: {
        farmBoardMessage: input.message.trim(),
        farmBoardUpdatedAt: new Date().toISOString(),
        farmBoardVersion: (input.farmBoardVersion ?? 1) + 1,
      },
    };
  }

  return fetchJson<ClientFarmBoardUpdateResponse>(`${CLIENT_API_PREFIX}/profile/farm-board`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
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
  if (forceMockCommands) {
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
  if (forceMockCommands) {
    const claimedAt = new Date().toISOString();
    return {
      id: notificationId,
      claimStatus: 'claimed',
      claimedAt,
      readAt: claimedAt,
      unreadCount: 0,
      summary: '模拟模式下已领取附件。',
    };
  }

  return fetchJson<ClientClaimNotificationResponse>(`${CLIENT_API_PREFIX}/notifications/${notificationId}/claim`, {
    method: 'POST',
  });
}

export async function deleteNotification(notificationId: string): Promise<ClientDeleteNotificationResponse> {
  if (forceMockCommands) {
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

  if (tone === 'growing' && seedId) {
    field.title = '培育中';
    field.badge = '培育';
    field.tone = 'growing';
    field.progressTotalSeconds = getMockSeedGrowthSeconds(seedId);
    field.progressRemainingSeconds = remainingSeconds;
    field.yieldGold = getMockSeedStageGold(seedId, 'growing');
    field.description = '作物仍在培育中，成熟后即可收取完整收益。';
    field.actions = [];
    return;
  }

  if (tone === 'mature' && seedId) {
    field.title = '成熟期';
    field.badge = '成熟';
    field.tone = 'mature';
    field.progressTotalSeconds = MOCK_collect_window_SECONDS;
    field.progressRemainingSeconds = remainingSeconds;
    field.yieldGold = getMockSeedStageGold(seedId, 'mature');
    field.description = '点击收取，触发爆金币并结算本轮成熟收益。';
    field.actions = [{ label: '收取', target: 'farm', tone: 'primary' }];
    return;
  }

  if (tone === 'withered' && seedId) {
    field.title = '枯萎期';
    field.badge = '枯萎';
    field.tone = 'withered';
    field.progressTotalSeconds = 1;
    field.progressRemainingSeconds = 0;
    field.yieldGold = getMockSeedStageGold(seedId, 'withered');
    field.description = '点击收取，收益已进入衰减段，但仍能获得金币。';
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
  field.description = '点击中央入口，选择灵植后立刻开始新一轮培育。';
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

    if (field.tone === 'growing') {
      const totalSeconds = getMockSeedGrowthSeconds(seedId);
      const startedAtMs = getMockFieldStageStartedAtMs(field.id, totalSeconds, Math.min(field.progressRemainingSeconds, totalSeconds));
      const elapsedSeconds = Math.max(Math.floor((nowMs - startedAtMs) / 1000), 0);

      if (elapsedSeconds < totalSeconds) {
        setMockFieldTiming(field.id, startedAtMs);
        setMockFieldPresentation(field, 'growing', seedId, totalSeconds - elapsedSeconds);
        return;
      }

      const nextStartedAtMs = startedAtMs + totalSeconds * 1000;
      setMockFieldTiming(field.id, nextStartedAtMs);
      setMockFieldPresentation(field, 'mature', seedId, MOCK_collect_window_SECONDS);
    }

    if (field.tone === 'mature') {
      const startedAtMs = getMockFieldStageStartedAtMs(field.id, MOCK_collect_window_SECONDS, Math.min(field.progressRemainingSeconds || 20 * 60, MOCK_collect_window_SECONDS));
      const elapsedSeconds = Math.max(Math.floor((nowMs - startedAtMs) / 1000), 0);

      if (elapsedSeconds < MOCK_collect_window_SECONDS) {
        setMockFieldTiming(field.id, startedAtMs);
        setMockFieldPresentation(field, 'mature', seedId, MOCK_collect_window_SECONDS - elapsedSeconds);
        return;
      }

      clearMockFieldTiming(field.id);
      setMockFieldPresentation(field, 'withered', seedId, 0);
    }
  });
}

function updateMockFieldStatus(): void {
  const matureCount = mockSceneSnapshot.farm.fields.filter((field) => field.tone === 'mature' || field.tone === 'withered').length;
  const growingCount = mockSceneSnapshot.farm.fields.filter((field) => field.tone === 'growing').length;

  mockHomeSnapshot.fieldStatus = `成熟田地 ${matureCount} 块，培育中 ${growingCount} 块`;
  mockSceneSnapshot.farm.hero.title = `成熟 ${matureCount} 块 · 培育中 ${growingCount} 块`;
  mockSceneSnapshot.farm.hero.description = mockSceneSnapshot.farm.fields.some((field) => field.tone === 'empty')
    ? '农场以田地为主，点击空地即可继续播种，成熟后直接收取。'
    : '农场地块已排满，可直接收取成熟地块或等待下一轮安排。';
  mockSceneSnapshot.farm.hero.action = mockSceneSnapshot.farm.fields.some((field) => field.tone === 'empty')
    ? { label: '开始培育', target: 'farm', tone: 'primary' }
    : { label: '查看田地', target: 'farm', tone: 'secondary' };
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

function syncMockFactionScene(): void {
  mockSceneSnapshot.faction.hero = {
    eyebrow: '阵营面板',
    title: '人界阵营',
    description: '完成日常行为积累个人贡献，每日按贡献档位领取材料俸禄。',
    advantage: '今日俸禄档位：入门俸禄',
    breakdown: '预计每日俸禄：金币 x20、灵根 x20、普通兽魂 x5',
    action: { label: '领取俸禄', target: 'faction', tone: 'primary' },
  };
  mockSceneSnapshot.faction.contribution = {
    title: '当前贡献值',
    value: formatNumber(mockFactionContribution),
    description: '贡献用于提升每日俸禄档位，俸禄以金币、随机灵宠碎片和分档兽魂为主。',
  };
  mockSceneSnapshot.faction.comparison = [
    { faction: '人界', advantage: `总贡献 ${formatNumber(mockFactionArmyPower)}`, totalContribution: formatNumber(mockFactionArmyPower), power: formatNumber(mockFactionArmyPower), isCurrent: true },
    { faction: '仙界', advantage: '总贡献 1,180', totalContribution: '1,180', power: '1,180' },
    { faction: '魔界', advantage: '总贡献 1,340', totalContribution: '1,340', power: '1,340' },
  ];
  mockSceneSnapshot.faction.donate = {
    title: '阵营贡献',
    description: '贡献主要来自种田、灵宠、互助和对战行为，旧版资源兑换入口已停用。',
    goldStep: 100,
    contributionRule: '当前没有资源兑换入口，贡献由日常行为积累。',
  };
  mockSceneSnapshot.faction.stipend = {
    title: '每日阵营俸禄',
    description: '每日可按当前贡献档位领取一次，材料为主、少量金币为辅。',
    status: 'available',
    dateKey: new Date().toISOString().slice(0, 10),
    contribution: mockFactionContribution,
    tierKey: 'contribution-0',
    tierLabel: '入门俸禄',
    rewards: [
      { kind: 'gold', label: '金币', quantity: 20 },
      { kind: 'spirit-root', label: '灵根', quantity: 20 },
      { kind: 'ordinary-soul', label: '普通兽魂', quantity: 5 },
    ],
    claimedAt: null,
    action: { label: '领取俸禄', target: 'faction', tone: 'primary' },
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
  const plantType = (input.plantType ?? input.seedId ?? '').trim();

  if (!field || !vaultResource || field.tone === 'locked') {
    return buildMockMutation('当前地块尚未解锁，无法开始培育。');
  }

  if (field.tone !== 'empty') {
    return buildMockMutation('当前地块已经在培育中或可直接收取。');
  }

  if (!plantType || !mockBootstrapSnapshot.backpack.unlockedSeedIds.includes(plantType)) {
    return buildMockMutation('当前灵植尚未解锁，无法开始本轮培育。');
  }

  setMockFieldTiming(input.fieldId, Date.now());
  setMockFieldPresentation(field, 'growing', plantType, getMockCultivationSeconds(plantType));
  mockFieldSeedAssignments[input.fieldId] = plantType;
  updateMockDailyTask('daily-start-cultivation');

  return buildMockMutation(`${field.code} 已播下 ${seedLabelMap[plantType] ?? plantType}，开始新一轮培育。`);
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
  updateMockDailyTask('daily-recruit-army', actualRecruitCount > 0 ? 1 : 0);

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
  const targetBaseReward = Math.max(target.level * 30, 60);
  const powerRatio = army.current / Math.max(combatPower, 1);
  const successChance = clamp(0.18 + powerRatio * 0.72, 0.18, 0.88);
  const success = Math.random() < successChance;
  const lootRatio = clamp(0.08 + powerRatio * 0.22 + (success ? 0.08 : 0), 0.05, 0.4);
  const rawGoldLoot = Math.max(Math.round(targetBaseReward * (0.3 + lootRatio + (success ? 0.25 : 0))), 20);
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
      description: '战斗结算时金库已满，超出的金币会临时保留在这里，过期后消失。',
    };
  }
  applyMockSeedRewards(rewards);
  applyArmyCountDelta(-casualties);
  mockSceneSnapshot.raid.targets = mockSceneSnapshot.raid.targets.filter((item) => item.id !== input.targetId);
  mockSceneSnapshot.report.attack.unshift({
    title: `${target.faction} · ${target.name}`,
    tag: success ? '战斗胜利' : '强袭试探',
    tone: success ? 'success' : 'neutral',
    createdAt: new Date().toISOString(),
    summary: `你对${target.name}发起战斗，获得 ${formatNumber(rawGoldLoot)} 金币系统奖励，其中 ${formatNumber(depositedGold)} 已入库${overflowGold > 0 ? `，另有 ${formatNumber(overflowGold)} 已转入待领取` : ''}，折损 ${formatNumber(casualties)} 只灵宠${rewards.length > 0 ? `，额外获得 ${rewards.map((reward) => `${reward.label} x${reward.quantity}`).join('、')}` : ''}。本次不会扣除对方金币。`,
    actions: [{ label: '查看详情', target: 'report', tone: 'ghost' }],
  });
  mockSceneSnapshot.report.attack = mockSceneSnapshot.report.attack.slice(0, 6);
  if (input.mode === 'revenge') {
    const defenseReport = mockSceneSnapshot.report.defense.find((entry) => entry.title === `${target.faction} · ${target.name}`);
    if (defenseReport) {
      defenseReport.tag = '已复仇';
      defenseReport.unread = false;
      defenseReport.revengeable = false;
      defenseReport.summary = '已完成复仇，本次挑战奖励由系统发放。';
      defenseReport.actions = [{ label: '查看详情', target: 'report', tone: 'ghost' }];
    }
  }
  targetDetail.protectionStatus = '普通目标改为次数限制与系统奖励结算，不再使用时间保护期。';
  targetDetail.actions = [{ label: '今日已结算', target: 'raid', tone: 'ghost' }];
  const remainingRaidCount = Math.max(mockSceneSnapshot.raid.targets.length, 0);
  mockSceneSnapshot.raid.hero.title = `剩余可探索目标 ${formatNumber(remainingRaidCount)} 个`;
  const protectedUntil = new Date().toISOString();
  mockHomeSnapshot.protectedUntil = null;

  const rewardSummary = rewards.length > 0 ? `，额外获得 ${rewards.map((reward) => `${reward.label} x${reward.quantity}`).join('、')}` : '';
  const reportSummary = `你对${target.name}发起战斗，带回 ${formatNumber(rawGoldLoot)} 金币，其中 ${formatNumber(depositedGold)} 已入库${overflowGold > 0 ? `，另有 ${formatNumber(overflowGold)} 已转入待领取` : ''}，折损 ${formatNumber(casualties)} 只灵宠${rewardSummary}。`;
  return {
    app: mockHomeSnapshot.app,
    summary: overflowGold > 0
      ? `${target.name} 本次战斗获得 ${formatNumber(rawGoldLoot)} 金币系统奖励，其中 ${formatNumber(depositedGold)} 已入库，另有 ${formatNumber(overflowGold)} 转入待领取，折损 ${formatNumber(casualties)} 只灵宠${rewardSummary}。`
      : `${target.name} 本次获得 ${formatNumber(rawGoldLoot)} 金币系统奖励，折损 ${formatNumber(casualties)} 只灵宠${rewardSummary}。`,
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

function applyMockFactionDonate(_input: ClientFactionDonateRequest): ClientStateMutationResponse {
  return buildMockMutation('旧版阵营入口已退役，当前贡献由日常行为积累。');
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

export async function claimStarterSeeds(input: ClientClaimStarterSeedRequest = {}): Promise<ClientClaimStarterSeedResponse> {
  return fetchJson<ClientClaimStarterSeedResponse>(`${CLIENT_API_PREFIX}/actions/claim-starter-seeds`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(input.requestIdempotencyKey ? { 'X-Idempotency-Key': input.requestIdempotencyKey } : {}),
    },
    body: JSON.stringify(input),
  });
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

export async function submitFactionTask(input: ClientFactionTaskSubmitRequest): Promise<ClientFactionTaskSubmitResponse> {
  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('submit-faction-task');
  const response = await fetchJson<ClientFactionTaskSubmitResponse>(`${CLIENT_API_PREFIX}/actions/submit-faction-task`, {
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

export async function unlockPlant(input: ClientUnlockPlantRequest): Promise<ClientUnlockPlantResponse> {
  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('unlock-plant');
  const response = await fetchJson<ClientUnlockPlantResponse>(`${CLIENT_API_PREFIX}/actions/unlock-plant`, {
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

export async function claimFactionStipend(input: ClientClaimFactionStipendRequest = {}): Promise<ClientClaimFactionStipendResponse> {
  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('claim-faction-stipend');
  const response = await fetchJson<ClientClaimFactionStipendResponse>(`${CLIENT_API_PREFIX}/actions/claim-faction-stipend`, {
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

export async function resetDemoExperimentState(): Promise<ClientResetDemoStateResponse> {
  const resetMockState = (): ClientResetDemoStateResponse => {
    mockBootstrapSnapshot = cloneBootstrap(mockBootstrap);
    mockHomeSnapshot = cloneHomeSummary(mockHomeSummary);
    mockSceneSnapshot = cloneSceneContent(mockSceneContent);
    mockFactionContribution = INITIAL_MOCK_FACTION_CONTRIBUTION;
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
  if (forceMockCommands) {
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

export async function refreshRaidTargets(): Promise<ClientStateMutationResponse> {
  if (forceMockCommands) {
    syncMockFieldLifecycle();
    return {
      app: mockHomeSnapshot.app,
      summary: '目标列表已刷新。',
      home: cloneHomeSummary(mockHomeSnapshot),
      scenes: cloneSceneContent(mockSceneSnapshot),
    };
  }

  const response = await fetchJson<ClientStateMutationResponse>(`${CLIENT_API_PREFIX}/actions/refresh-raid-targets`, {
    method: 'POST',
  });

  mockHomeSnapshot = cloneHomeSummary(response.home);
  mockSceneSnapshot = cloneSceneContent(response.scenes);
  return response;
}

function getMockSeasonSignInReward(day: number): number {
  if (day >= 22) {
    return 4;
  }
  if (day >= 15) {
    return 3;
  }
  if (day >= 8) {
    return 2;
  }
  return 1;
}

function getMockSeasonDay(): number {
  const safeCurrentWeek = Math.min(Math.max(Math.floor(mockBootstrapSnapshot.season.currentWeek), 1), 4);
  const chinaNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const weekday = chinaNow.getUTCDay();
  const mondayBasedDay = weekday === 0 ? 7 : weekday;

  return Math.min((safeCurrentWeek - 1) * 7 + mondayBasedDay, 28);
}

function buildMockSeasonSignIn(claimedDays: number[] = []): ClientSeasonSignInResponse {
  const currentDay = getMockSeasonDay();
  const claimedDaySet = new Set(claimedDays.filter((day) => day >= 1 && day <= 28));

  return {
    seasonNumber: mockBootstrapSnapshot.season.seasonNumber,
    currentDay,
    claimedDays: Array.from(claimedDaySet).sort((left, right) => left - right),
    totalTianjiReward: Array.from(claimedDaySet).reduce((sum, day) => sum + getMockSeasonSignInReward(day), 0),
    todayReward: getMockSeasonSignInReward(currentDay),
    claimedToday: claimedDaySet.has(currentDay),
    days: Array.from({ length: 28 }, (_, index) => {
      const day = index + 1;
      const claimed = claimedDaySet.has(day);
      return {
        day,
        reward: getMockSeasonSignInReward(day),
        claimed,
        current: day === currentDay,
        future: day > currentDay,
        missed: day < currentDay && !claimed,
      };
    }),
    milestones: [
      { dayCount: 7, title: '七日宝箱' },
      { dayCount: 14, title: '十四日宝箱' },
      { dayCount: 21, title: '二十一日宝箱' },
    ].map((milestone) => ({
      ...milestone,
      reached: claimedDaySet.size >= milestone.dayCount,
      remainingDays: Math.max(milestone.dayCount - claimedDaySet.size, 0),
    })),
  };
}

function buildMockSeasonRewards(): ClientSeasonRewardsResponse {
  const seasonNumber = mockBootstrapSnapshot.season.seasonNumber;
  const seasonLabel = formatSeasonLabel(seasonNumber);

  return {
    app: mockBootstrapSnapshot.app,
    currentSeasonNumber: seasonNumber,
    items: [],
    claimableCount: 0,
    medalCabinet: {
      currentSeasonNumber: seasonNumber,
      currentSeasonTitle: `${seasonLabel}奖章陈列柜`,
      medals: [],
      medalsBySeason: [
        {
          seasonNumber,
          title: `${seasonLabel}奖章陈列柜`,
          medals: [],
        },
      ],
    },
  };
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

export async function loadRaidBattleReplay(orderId: string): Promise<ClientRaidBattleReplayResponse> {
  return fetchJson<ClientRaidBattleReplayResponse>(`${CLIENT_API_PREFIX}/raid-orders/${encodeURIComponent(orderId)}/battle-replay`);
}

export async function loadSocialSummary(): Promise<ClientSocialSummaryResponse> {
  return fetchJson<ClientSocialSummaryResponse>(`${CLIENT_API_PREFIX}/social/summary`);
}

export async function loadSocialFeed(): Promise<ClientSocialFeedResponse> {
  return fetchJson<ClientSocialFeedResponse>(`${CLIENT_API_PREFIX}/social/feed`);
}

export async function loadSocialRelations(kind: 'friends' | 'following' | 'enemies'): Promise<ClientSocialRelationListResponse> {
  return fetchJson<ClientSocialRelationListResponse>(`${CLIENT_API_PREFIX}/social/${kind}`);
}

export async function requestSocialFriend(input: ClientSocialFriendRequest): Promise<ClientSocialRelationMutationResponse> {
  return fetchJson<ClientSocialRelationMutationResponse>(`${CLIENT_API_PREFIX}/social/friend-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function acceptSocialFriendRequest(relationId: string): Promise<ClientSocialRelationMutationResponse> {
  return fetchJson<ClientSocialRelationMutationResponse>(`${CLIENT_API_PREFIX}/social/friend-request/${encodeURIComponent(relationId)}/accept`, {
    method: 'POST',
  });
}

export async function rejectSocialFriendRequest(relationId: string): Promise<ClientSocialRelationMutationResponse> {
  return fetchJson<ClientSocialRelationMutationResponse>(`${CLIENT_API_PREFIX}/social/friend-request/${encodeURIComponent(relationId)}/reject`, {
    method: 'POST',
  });
}

export async function deleteSocialFriend(targetPlayerId: string): Promise<ClientSocialRelationMutationResponse> {
  return fetchJson<ClientSocialRelationMutationResponse>(`${CLIENT_API_PREFIX}/social/friend/${encodeURIComponent(targetPlayerId)}`, {
    method: 'DELETE',
  });
}

export async function reviveSocialField(input: ClientSocialReviveFieldRequest): Promise<ClientSocialAssistResponse> {
  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('social-revive-field');
  return fetchJson<ClientSocialAssistResponse>(`${CLIENT_API_PREFIX}/social/assist/revive-field`, {
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
}

export async function visitSocialFriendFields(targetPlayerId: string): Promise<ClientSocialFriendFieldVisitResponse> {
  return fetchJson<ClientSocialFriendFieldVisitResponse>(`${CLIENT_API_PREFIX}/social/friends/${encodeURIComponent(targetPlayerId)}/fields`);
}

export async function previewSocialHarvestField(targetPlayerId: string): Promise<ClientSocialHarvestFieldPreviewResponse> {
  return fetchJson<ClientSocialHarvestFieldPreviewResponse>(`${CLIENT_API_PREFIX}/social/friends/${encodeURIComponent(targetPlayerId)}/harvest-preview`);
}

export async function harvestSocialField(input: ClientSocialHarvestFieldRequest): Promise<ClientSocialAssistResponse> {
  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('social-harvest-field');
  return fetchJson<ClientSocialAssistResponse>(`${CLIENT_API_PREFIX}/social/assist/harvest-field`, {
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
}

export async function createShareAssistCampaign(input: ClientCreateShareAssistCampaignRequest): Promise<ClientCreateShareAssistCampaignResponse> {
  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('share-assist-campaign');
  return fetchJson<ClientCreateShareAssistCampaignResponse>(`${CLIENT_API_PREFIX}/share-assist/campaigns`, {
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
}

export async function loadPublicShareAssistCampaign(campaignId: string): Promise<PublicShareAssistCampaignResponse> {
  return fetchJson<PublicShareAssistCampaignResponse>(`${PUBLIC_API_PREFIX}/share-assist/campaigns/${encodeURIComponent(campaignId)}`);
}

export async function confirmPublicShareAssist(campaignId: string, input: PublicShareAssistConfirmRequest): Promise<PublicShareAssistConfirmResponse> {
  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('share-assist-confirm');
  return fetchJson<PublicShareAssistConfirmResponse>(`${PUBLIC_API_PREFIX}/share-assist/campaigns/${encodeURIComponent(campaignId)}/assist`, {
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
}

export async function completeShareInviteTutorial(input: ClientCompleteShareInviteTutorialRequest): Promise<ClientCompleteShareInviteTutorialResponse> {
  const idempotencyKey = input.requestIdempotencyKey ?? buildIdempotencyKey('share-invite-tutorial-complete');
  return fetchJson<ClientCompleteShareInviteTutorialResponse>(`${CLIENT_API_PREFIX}/share-assist/invite-tutorial-complete`, {
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
}

export async function feedSpirit(input: ClientFeedSpiritRequest): Promise<ClientSpiritMutationResponse> {
  const idempotencyKey = buildIdempotencyKey('spirit-feed');
  const response = await fetchJson<ClientSpiritMutationResponse>(`${CLIENT_API_PREFIX}/spirit/feed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ ...input, requestIdempotencyKey: idempotencyKey }),
  });

  return {
    ...response,
    spirit: cloneSpiritState(response.spirit),
  };
}

export async function breakthroughSpirit(input: ClientBreakthroughSpiritRequest): Promise<ClientSpiritMutationResponse> {
  const idempotencyKey = buildIdempotencyKey('spirit-breakthrough');
  const response = await fetchJson<ClientSpiritMutationResponse>(`${CLIENT_API_PREFIX}/spirit/breakthrough`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ ...input, requestIdempotencyKey: idempotencyKey }),
  });

  return {
    ...response,
    spirit: cloneSpiritState(response.spirit),
  };
}

export async function rollSpiritTraits(input: ClientRollSpiritTraitsRequest): Promise<ClientRollSpiritTraitsResponse> {
  const idempotencyKey = buildIdempotencyKey('spirit-roll-traits');
  const response = await fetchJson<ClientRollSpiritTraitsResponse>(`${CLIENT_API_PREFIX}/spirit/roll-traits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ ...input, requestIdempotencyKey: idempotencyKey }),
  });

  return {
    ...response,
    spirit: cloneSpiritState(response.spirit),
  };
}

export async function resolveSpiritTraitRoll(input: ClientResolveSpiritTraitRollRequest): Promise<ClientSpiritMutationResponse> {
  const idempotencyKey = buildIdempotencyKey('spirit-resolve-trait-roll');
  const response = await fetchJson<ClientSpiritMutationResponse>(`${CLIENT_API_PREFIX}/spirit/resolve-roll`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ ...input, requestIdempotencyKey: idempotencyKey }),
  });

  return {
    ...response,
    spirit: cloneSpiritState(response.spirit),
  };
}

export async function buySpiritShopItem(input: ClientBuySpiritShopItemRequest): Promise<ClientSpiritMutationResponse> {
  const idempotencyKey = buildIdempotencyKey('spirit-shop-buy');
  const response = await fetchJson<ClientSpiritMutationResponse>(`${CLIENT_API_PREFIX}/spirit/shop/buy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ ...input, requestIdempotencyKey: idempotencyKey }),
  });

  return {
    ...response,
    spirit: cloneSpiritState(response.spirit),
  };
}

export async function claimSpiritAdReward(input: ClientClaimSpiritAdRewardRequest): Promise<ClientSpiritMutationResponse> {
  const idempotencyKey = buildIdempotencyKey('spirit-ad-reward');
  const response = await fetchJson<ClientSpiritMutationResponse>(`${CLIENT_API_PREFIX}/spirit/shop/ad-reward`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ ...input, requestIdempotencyKey: idempotencyKey }),
  });

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

export async function devLogin(mode: DevLoginMode, options?: { factionCode?: DevFactionChoice }): Promise<DevLoginSession> {
  const loginRequest = buildDevLoginRequest(mode, options);
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
    player: {
      ...response.player,
      factionCode: response.player.faction?.code ?? options?.factionCode,
    },
    mode,
  };

  setStoredDevLoginSession(session);
  return session;
}

export function getDevLoginModeLabel(mode: DevLoginMode | null | undefined): string {
  if (mode === 'new-user') {
    return '新用户';
  }

  if (mode === 'existing-user') {
    return '已注册用户';
  }

  if (mode === 'stable-user-2') {
    return '稳定测试号2';
  }

  if (mode === 'test-user-1') {
    return '测试用户1';
  }

  if (mode === 'test-user-2') {
    return '测试用户2';
  }

  return '未登录';
}

function buildDevLoginRequest(mode: DevLoginMode, options?: { factionCode?: DevFactionChoice }): { providerUserId: string; nickname: string; factionCode: string } {
  if (mode === 'new-user') {
    const id = Date.now();
    return {
      providerUserId: `dev-ui-${id}`,
      nickname: `新用户_${id}`,
      factionCode: options?.factionCode ?? 'human',
    };
  }

  if (mode === 'existing-user') {
    return {
      providerUserId: 'dev-main-loop',
      nickname: '主循环测试号',
      factionCode: 'immortal',
    };
  }

  if (mode === 'stable-user-2') {
    return {
      providerUserId: 'dev-stable-flow-2',
      nickname: '稳定测试号2',
      factionCode: 'human',
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
