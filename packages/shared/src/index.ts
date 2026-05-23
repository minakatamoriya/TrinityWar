export const APP_NAME = 'TrinityWar';
export const API_PREFIX = '/api';
export const CLIENT_API_PREFIX = `${API_PREFIX}/client`;
export const ADMIN_API_PREFIX = `${API_PREFIX}/admin`;
export const DOCS_ROUTE = '/docs';
export const ARMY_RECRUIT_GOLD_COST_PER_UNIT = 100;
export const ARMY_RECRUIT_SECONDS_PER_UNIT = 60;

export type ClientSpiritRarity = 'common' | 'rare' | 'legendary';
export type ClientSpiritRole = 'attack' | 'defense' | 'balanced' | 'health';
export type ClientSpiritElement = 'metal' | 'wood' | 'water' | 'fire' | 'earth';
export type ClientSpiritStatus = 'active' | 'wounded' | 'resting' | 'dissolved';

export interface ClientSpiritDefinition {
  spiritId: string;
  label: string;
  rarity: ClientSpiritRarity;
  factionAffinity: 'human' | 'immortal' | 'demon';
  role: ClientSpiritRole;
  shardName: string;
  shardUnlockRequired: number;
  lore: string | null;
}

export interface ClientSpiritSlot {
  slotIndex: number;
  spiritId: string | null;
  isMain: boolean;
  level: number;
  exp: number;
  element: ClientSpiritElement | null;
  currentHp: number;
  maxHp: number;
  status: ClientSpiritStatus;
  slotVersion: number;
}

export interface ClientSpiritCodexEntry {
  spiritId: string;
  hasSeen: boolean;
  shardCount: number;
  readyToCompose: boolean;
  ownedCurrent: boolean;
  ownedEver: boolean;
  definition: ClientSpiritDefinition;
}

export interface ClientSpiritState {
  spiritSoul: number;
  tianjiTalisman: number;
  dailyRecoveryUsed: number;
  dailyIntelFreeUsed: number;
  dailyIntelTalismanUsed: number;
  resourceVersion: number;
  mainSlot: ClientSpiritSlot | null;
  slots: ClientSpiritSlot[];
  codex: ClientSpiritCodexEntry[];
  readyToCompose: ClientSpiritCodexEntry[];
}

export interface ClientSpiritStateResponse {
  app: string;
  spirit: ClientSpiritState;
}

export interface ClientBuySpiritSoulRequest {
  goldAmount: number;
  walletVersion?: number;
  resourceVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientUpgradeSpiritRequest {
  slotIndex: number;
  slotVersion?: number;
  resourceVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientSetMainSpiritRequest {
  slotIndex: number;
  slotVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientRecoverSpiritRequest {
  slotIndex: number;
  slotVersion?: number;
  resourceVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientDissolveSpiritRequest {
  slotIndex: number;
  slotVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientComposeSpiritRequest {
  spiritId: string;
  slotIndex: number;
  element: ClientSpiritElement;
  codexVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientSpiritMutationResponse {
  app: string;
  summary: string;
  spirit: ClientSpiritState;
  home: HomeSummaryResponse;
  scenes: ClientSceneContentResponse;
}

export interface ClientFarmBoardState {
  farmBoardMessage: string;
  farmBoardUpdatedAt: string | null;
  farmBoardVersion: number;
}

export interface ClientFarmBoardUpdateRequest {
  message: string;
  farmBoardVersion?: number;
}

export interface ClientFarmBoardUpdateResponse {
  app: string;
  summary: string;
  board: ClientFarmBoardState;
}

export interface ClientRaidMessageTemplate {
  templateId: string;
  text: string;
}

export interface ClientRaidMessageSnapshot {
  messageTemplateId: string;
  messageEmojiId: null;
  messageTextSnapshot: string;
}

export interface ClientRaidSpiritPreview {
  spiritId: string | null;
  label: string;
  level: number;
  rarity: ClientSpiritRarity | null;
  avatarGlyph: string;
}

export interface ClientRaidSpiritIntel {
  element: ClientSpiritElement | null;
  attackRating: string;
  defenseRating: string;
  healthStatus: string;
  remainingFreeIntel: number;
  remainingTalismanIntel: number;
}

export interface ClientRaidDeepIntelResponse {
  app: string;
  targetId: string;
  mainPetPreview: ClientRaidSpiritPreview | null;
  intel: ClientRaidSpiritIntel;
}

export interface ClientRaidOrderMessageRequest {
  messageTemplateId: string;
}

export interface ClientRaidOrderMessageResponse {
  app: string;
  summary: string;
  raidMessage: ClientRaidMessageSnapshot;
  templates: ClientRaidMessageTemplate[];
}

export interface HealthResponse {
  app: string;
  status: 'ok';
  now: string;
}

export interface ClientBootstrapResponse {
  app: string;
  env: 'local';
  version: string;
  serverTime: string;
  season: ClientSeasonStatus;
  backpack: ClientSeedBackpack;
}

export interface ClientSeedBackpack {
  seedInventory: Record<string, number>;
  globalItemInventory: Record<string, number>;
  unlockedSeedIds: string[];
  starterSeedClaimed: boolean;
  tianjiTalismanClaimed: boolean;
  spiritSoulClaimed: boolean;
  dailySpiritSoulAmount: number;
}

export interface ClientSeasonStatus {
  seasonNumber: number;
  currentWeek: number;
  totalWeeks: number;
}

export interface AdminOverviewResponse {
  app: string;
  docs: string;
  modules: string[];
}

export type NotificationCategory = 'system' | 'announcement' | 'maintenance' | 'reward' | 'compensation';

export type PlayerNotificationClaimStatus = 'none' | 'unclaimed' | 'claimed' | 'expired';

export type NotificationAttachmentKind = 'gold' | 'seed' | 'tianjiTalisman' | 'spiritSoul';

export interface AdminPagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface NotificationAttachment {
  kind: NotificationAttachmentKind;
  quantity: number;
  seedId?: string;
  label: string;
}

export interface ClientNotificationItem {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  claimStatus: PlayerNotificationClaimStatus;
  read: boolean;
  deleted: boolean;
  hasAttachment: boolean;
  attachments: NotificationAttachment[];
  canClaim: boolean;
  canDelete: boolean;
  createdAt: string;
  readAt: string | null;
  claimedAt: string | null;
  expiresAt: string | null;
}

export interface ClientNotificationListResponse {
  items: ClientNotificationItem[];
  pagination: AdminPagination;
  unreadCount: number;
}

export interface ClientUnreadNotificationCountResponse {
  unreadCount: number;
}

export interface ClientMarkNotificationReadResponse {
  id: string;
  read: true;
  readAt: string;
  unreadCount: number;
}

export interface ClientDeleteNotificationResponse {
  id: string;
  deleted: true;
  unreadCount: number;
}

export interface AdminCreateNotificationRequest {
  title?: string;
  body?: string;
  category?: NotificationCategory;
  expiresAt?: string | null;
  attachments?: Array<{
    kind: NotificationAttachmentKind;
    quantity: number;
    seedId?: string;
  }>;
}

export interface AdminCreateNotificationResponse {
  notificationId: string;
  audience: 'global' | 'player';
  playerCount: number;
  title: string;
  category: NotificationCategory;
  attachmentCount: number;
  createdAt: string;
  expiresAt: string | null;
}

export interface ClientClaimNotificationResponse {
  id: string;
  claimStatus: 'claimed';
  claimedAt: string;
  unreadCount: number;
  summary: string;
}

export interface AdminNotificationHistoryItem {
  notificationId: string;
  title: string;
  body: string;
  audience: 'global' | 'player';
  category: NotificationCategory;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  attachmentCount: number;
  playerCount: number;
}

export interface AdminPlayerNotificationItem {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  claimStatus: PlayerNotificationClaimStatus;
  attachments: NotificationAttachment[];
  readAt: string | null;
  claimedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface AdminSystemStatusResponse {
  app: string;
  environment: string;
  version: string;
  time: string;
  database: { status: 'up' | 'down' };
  workers: Array<{ name: string; status: 'registered' }>;
  featureFlags: Record<string, boolean>;
}

export interface AdminPlayerSearchResponse {
  items: Array<{
    playerId: string;
    nickname: string;
    faction: string | null;
    castleLevel: number;
    lastLoginAt: string | null;
    tags: string[];
  }>;
  pagination: AdminPagination;
}

export interface AdminDeletePlayerResponse {
  playerId: string;
  nickname: string;
  deleted: boolean;
}

export interface AdminListResponse<T> {
  items: T[];
  pagination: AdminPagination;
}

export interface AdminPlayerOverviewResponse {
  identity: Record<string, unknown>;
  wallet: Record<string, unknown> | null;
  building: Record<string, unknown> | null;
  army: Record<string, unknown> | null;
  spirit: {
    resource: Record<string, unknown> | null;
    mainSlot: Record<string, unknown> | null;
    slots: Array<Record<string, unknown>>;
    codex: Array<Record<string, unknown>>;
  };
  fields: Array<Record<string, unknown>>;
  seedInventory: Record<string, unknown>;
  dailyTasks: Array<Record<string, unknown>>;
  recentReports: Array<Record<string, unknown>>;
}

export interface AdminRaidOrderDetailResponse {
  order: Record<string, unknown>;
  settlement: Record<string, unknown> | null;
  reports: Array<Record<string, unknown>>;
  assetLocks: Array<Record<string, unknown>>;
}

export type HomeResourceTone = 'vault' | 'army';

export interface HomeResourceSummary {
  label: string;
  value: string;
  tone: HomeResourceTone;
}

export type ClientPendingClaimSource = 'tax' | 'faction' | 'raid-overflow';

export interface ClientTemporaryClaimSummary {
  source: 'raid-overflow';
  label: string;
  goldAmount: number;
  expiresAt: string;
  description: string;
}

export interface ClientPendingClaimSummary {
  source: ClientPendingClaimSource;
  label: string;
  value: string;
  description: string;
}

export interface HomeActionItem {
  key: string;
  title: string;
  description: string;
}

export type ClientDailyTaskStatus = 'in-progress' | 'completed' | 'claimed';

export interface ClientDailyTaskSummary {
  id: string;
  title: string;
  description: string;
  progressCurrent: number;
  progressTarget: number;
  progressText: string;
  rewardGold: number;
  status: ClientDailyTaskStatus;
  actionScene: ClientSceneKey;
}

export interface HomeSummaryResponse {
  app: string;
  playerName: string;
  factionName: string;
  castleLevel: number;
  stateVersions: ClientStateVersions;
  staminaStatus: string;
  fieldStatus: string;
  reportStatus: string;
  protectedUntil: string | null;
  resources: HomeResourceSummary[];
  pendingClaims: ClientPendingClaimSummary[];
  temporaryClaim: ClientTemporaryClaimSummary | null;
  dailyTasks: ClientDailyTaskSummary[];
  primaryActions: HomeActionItem[];
}

export interface ClientStateVersions {
  buildingVersion: number;
  walletVersion: number;
  armyVersion: number;
}

export interface ClientResourceLedger {
  vaultGold: number;
  vaultCapacity: number;
  taxPendingGold: number;
  factionDividendGold: number;
}

export interface ClientClaimPendingRequest {
  source: ClientPendingClaimSource;
  acceptOverflowLoss?: boolean;
  walletVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientClaimPendingResponse {
  app: string;
  summary: string;
  source: ClientPendingClaimSource;
  claimedGold: number;
  remainingPendingGold: number;
  ledger: ClientResourceLedger;
  home: HomeSummaryResponse;
  scenes: ClientSceneContentResponse;
}

export interface ClientClaimDailyTaskRequest {
  taskId: string;
  acceptOverflowLoss?: boolean;
  taskDateKey?: string;
  walletVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientClaimDailyTaskResponse {
  app: string;
  summary: string;
  taskId: string;
  rewardGold: number;
  claimedGold: number;
  overflowGold: number;
  home: HomeSummaryResponse;
  scenes: ClientSceneContentResponse;
}

export type ClientBuildingUpgradeId = 'castle' | 'vault' | 'field-slot' | 'watchtower';
export type ClientCastleExtensionUpgradeId = 'protectionTech' | 'farmYieldTech' | 'ripeWindowTech' | 'pendingClaimTech';
export type ClientUpgradeTargetType = 'building' | 'castle-extension';

export interface ClientStateMutationResponse {
  app: string;
  summary: string;
  home: HomeSummaryResponse;
  scenes: ClientSceneContentResponse;
}

export interface ClientCollectFieldRequest {
  fieldId: string;
  collectMode: 'ripe' | 'early';
  fieldVersion?: number;
  walletVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientCollectRewardItem {
  seedId: string;
  label: string;
  quantity: number;
}

export interface ClientCollectFieldResponse {
  app: string;
  summary: string;
  home: HomeSummaryResponse;
  scenes: ClientSceneContentResponse;
  result: {
    collectedGold: number;
    overflowGold: number;
    rewards: ClientCollectRewardItem[];
  };
}

export interface ClientStartCultivationRequest {
  fieldId: string;
  seedId: string;
}

export interface ClientRecruitArmyRequest {
  recruitCount: number;
  armyVersion?: number;
  walletVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientRaidActionRequest {
  targetId: string;
  mode?: 'raid' | 'revenge';
  armyVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientRaidRewardItem {
  seedId: string;
  label: string;
  quantity: number;
}

export interface ClientRaidActionResponse {
  app: string;
  summary: string;
  home: HomeSummaryResponse;
  scenes: ClientSceneContentResponse;
  result: {
    orderId?: string;
    settlementStatus?: 'queued' | 'settling' | 'settled' | 'failed';
    settleAt?: string;
    targetId: string;
    targetName: string;
    goldLoot: number;
    depositedGold: number;
    overflowGold: number;
    temporaryClaimExpiresAt: string | null;
    casualties: number;
    rewards: ClientRaidRewardItem[];
    protectedUntil: string;
    reportSummary: string;
  };
}

export interface ClientUpgradeBuildingRequest {
  targetType: ClientUpgradeTargetType;
  buildingId?: ClientBuildingUpgradeId;
  extensionId?: ClientCastleExtensionUpgradeId;
  buildingVersion?: number;
  walletVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientResetDemoStateResponse {
  app: string;
  summary: string;
  home: HomeSummaryResponse;
  scenes: ClientSceneContentResponse;
}

export type ClientSceneKey = 'home' | 'building' | 'farm' | 'raid' | 'report' | 'faction';

export type ClientButtonTone = 'primary' | 'secondary' | 'ghost';

export interface ClientSceneAction {
  label: string;
  target: ClientSceneKey;
  tone: ClientButtonTone;
  context?: string;
}

export interface ClientMetricRow {
  label: string;
  value: string;
}

export interface ClientBuildingUpgrade {
  id: ClientBuildingUpgradeId;
  title: string;
  description: string;
  costText: string;
  action: ClientSceneAction;
  locked?: boolean;
}

export interface ClientCastleExtensionUpgrade {
  id: ClientCastleExtensionUpgradeId;
  title: string;
  levelText: string;
  description: string;
  effectText: string;
  costText: string;
  action: ClientSceneAction;
  locked?: boolean;
}

export interface ClientGuideSection {
  title: string;
  description: string;
  actions: ClientSceneAction[];
}

export interface ClientFarmHero {
  eyebrow: string;
  title: string;
  description: string;
  action: ClientSceneAction;
}

export interface ClientFarmField {
  id: string;
  fieldVersion?: number;
  code: string;
  title: string;
  badge: string;
  cropName?: string;
  tone: 'seeded' | 'growing' | 'mature' | 'withered' | 'empty' | 'locked';
  progressRemainingSeconds: number;
  progressTotalSeconds: number;
  yieldGold: number;
  description: string;
  actions: ClientSceneAction[];
}

export interface ClientRaidTarget {
  id: string;
  name: string;
  faction: string;
  level: number;
  mainPetPreview: ClientRaidSpiritPreview | null;
  combatPower: string;
  summary: string;
  loot: string;
  risk: string;
  detail: string;
  action: ClientSceneAction;
}

export interface ClientRaidTargetDetailResponse {
  app: string;
  targetId: string;
  name: string;
  faction: string;
  level: number;
  combatPower: string;
  fieldPreviewTone: ClientFarmField['tone'];
  fieldStatus: string;
  fields: ClientFarmField[];
  raidableGold: string;
  exposedFruit: string;
  raidRule: string;
  defenseStatus: string;
  protectionStatus: string;
  targetFarmBoardMessage: string;
  mainPetPreview: ClientRaidSpiritPreview | null;
  remainingFreeIntel: number;
  remainingTalismanIntel: number;
  detail: string;
  actions: ClientSceneAction[];
}

export interface ClientRaidDetail {
  advice: string;
  actions: ClientSceneAction[];
}

export interface ClientReportEntry {
  title: string;
  tag: string;
  tone: 'danger' | 'success' | 'neutral';
  summary: string;
  createdAt: string;
  occurredAtText?: string;
  opponentName?: string;
  metrics?: {
    gold: string;
    ownDamage: string;
    opponentDamage: string;
  };
  unread?: boolean;
  revengeable?: boolean;
  raidMessage?: ClientRaidMessageSnapshot | null;
  actions: ClientSceneAction[];
}

export interface ClientFactionHero {
  eyebrow: string;
  title: string;
  description: string;
  advantage: string;
  breakdown: string;
  action: ClientSceneAction;
}

export interface ClientFactionContributionSummary {
  title: string;
  value: string;
  description: string;
}

export interface ClientFactionComparisonEntry {
  faction: string;
  advantage: string;
  gold: string;
  power: string;
  isCurrent?: boolean;
}

export interface ClientFactionDonatePanel {
  title: string;
  description: string;
  goldStep: number;
  contributionRule: string;
}

export interface ClientFactionLeaderboardEntry {
  label: string;
  value: string;
  note?: string;
}

export interface ClientFactionDonateRequest {
  goldAmount: number;
}

export interface ClientArmyTrainingQueue {
  queuedUnits: number;
  totalCost: number;
  startedAt: string;
  readyAt: string;
  totalSeconds: number;
  remainingSeconds: number;
}

export interface ClientArmySceneContent {
  unitCostGold: number;
  unitTrainingSeconds: number;
  queue: ClientArmyTrainingQueue | null;
}

export interface ClientSceneContentResponse {
  app: string;
  building: {
    upgrades: ClientBuildingUpgrade[];
    extensions: ClientCastleExtensionUpgrade[];
  };
  army: ClientArmySceneContent;
  farm: {
    hero: ClientFarmHero;
    fields: ClientFarmField[];
    guide: ClientGuideSection;
  };
  raid: {
    hero: ClientFarmHero;
    targets: ClientRaidTarget[];
    detail: ClientRaidDetail;
    messageTemplates: ClientRaidMessageTemplate[];
  };
  report: {
    defense: ClientReportEntry[];
    attack: ClientReportEntry[];
    actions: ClientSceneAction[];
  };
  faction: {
    hero: ClientFactionHero;
    contribution: ClientFactionContributionSummary;
    comparison: ClientFactionComparisonEntry[];
    donate: ClientFactionDonatePanel;
    rankings: ClientFactionLeaderboardEntry[];
  };
}
