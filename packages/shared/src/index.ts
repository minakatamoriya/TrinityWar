import { SPIRIT_BATTLE_INNATE_RULES } from './spiritBattleRules.js';
import type { AnySpiritBattleTraitCode, SpiritBattleInnateRule } from './spiritBattleRules.js';

export const APP_NAME = 'TrinityWar';
export const API_PREFIX = '/api';
export const CLIENT_API_PREFIX = `${API_PREFIX}/client`;
export const ADMIN_API_PREFIX = `${API_PREFIX}/admin`;
export const DOCS_ROUTE = '/docs';
export const ARMY_RECRUIT_GOLD_COST_PER_UNIT = 100;
export const ARMY_RECRUIT_SECONDS_PER_UNIT = 60;

export function formatSeasonLabel(seasonNumber: number): string {
  const normalizedSeasonNumber = Number.isFinite(seasonNumber) ? Math.max(Math.floor(seasonNumber), 1) : 1;
  return `第${normalizedSeasonNumber}赛季`;
}

export type ClientSpiritRarity = 'common' | 'rare' | 'legendary';
export type ClientSpiritRole = 'attack' | 'balanced' | 'health';
export type ClientSpiritElement = 'metal' | 'wood' | 'water' | 'fire' | 'earth';
export type ClientCodexState = 'hidden' | 'visible-progress' | 'unlocked';
export type ClientSceneVisibility = 'masked' | 'named';
export type ClientSpiritTraitCode = AnySpiritBattleTraitCode;
export type ClientSpiritActiveRollMode = 'basic' | 'normal' | 'advanced';
export type ClientSpiritRollMode = ClientSpiritActiveRollMode;
export type ClientSpiritTraitRollMaterial = 'gold' | 'lingsui' | 'lingyu';
export type ClientSpiritFeedActionType = 'feed_once' | 'fill_full';

export interface ClientSpiritTraitRollRule {
  mode: ClientSpiritActiveRollMode;
  label: string;
  badge: string;
  summary: string;
  confirmLabel: string;
  unlockBreakthroughStage: number;
  unlockLevel: number;
  candidateCount: number;
  cost: { marrow: number; jade: number; gold: number };
}

export const CLIENT_SPIRIT_TRAIT_ROLL_RULES: Record<ClientSpiritActiveRollMode, ClientSpiritTraitRollRule> = {
  basic: {
    mode: 'basic',
    label: '金币重铸',
    badge: '全随机',
    summary: '只消耗金币，随机覆盖全部已解锁词条。',
    confirmLabel: '金币重铸',
    unlockBreakthroughStage: 1,
    unlockLevel: 10,
    candidateCount: 0,
    cost: { marrow: 0, jade: 0, gold: 1000 },
  },
  normal: {
    mode: 'normal',
    label: '灵髓定向',
    badge: '7 选 1',
    summary: '选择 1 个槽位，从常规候选池中生成 7 个可替换结果。',
    confirmLabel: '灵髓定向',
    unlockBreakthroughStage: 2,
    unlockLevel: 20,
    candidateCount: 7,
    cost: { marrow: 5, jade: 0, gold: 500 },
  },
  advanced: {
    mode: 'advanced',
    label: '灵玉高级',
    badge: '高级 3 选 1',
    summary: '选择 1 个槽位，从高级候选池中生成 3 个结果，可消耗灵玉换一组。',
    confirmLabel: '灵玉高级',
    unlockBreakthroughStage: 3,
    unlockLevel: 30,
    candidateCount: 3,
    cost: { marrow: 0, jade: 1, gold: 1000 },
  },
};

export const CLIENT_SPIRIT_TRAIT_ROLL_PLAN_ORDER: ClientSpiritActiveRollMode[] = ['basic', 'normal', 'advanced'];

export function getBasicSpiritTraitRollGoldCost(level: number): number {
  if (level < 10) {
    return CLIENT_SPIRIT_TRAIT_ROLL_RULES.basic.cost.gold;
  }
  if (level < 20) {
    return 200;
  }
  if (level < 30) {
    return 400;
  }
  if (level < 40) {
    return 600;
  }
  if (level < 50) {
    return 800;
  }
  return 1000;
}

export interface ClientSpiritDefinition {
  spiritId: string;
  label: string;
  rarity: ClientSpiritRarity;
  factionAffinity: 'human' | 'immortal' | 'demon';
  role: ClientSpiritRole;
  shardName: string;
  shardUnlockRequired: number;
  baseAttack: number;
  baseHp: number;
  growthAttack: number;
  growthHp: number;
  lore: string | null;
}

export interface ClientSpiritAppearance {
  skinId: string | null;
  frameId: string | null;
  cardBackId: string | null;
  effectId: string | null;
}

export interface ClientSpiritInnateTrait {
  spiritId: string;
  label: string;
  description: string;
  effects: Array<{
    stat: 'attack' | 'damage' | 'maxHp' | 'damageTaken' | 'crit' | 'lifesteal' | 'bloodLoss';
    valueType: 'percent';
    value: number;
  }>;
}

export const CLIENT_SPIRIT_INNATE_TRAITS: Record<string, ClientSpiritInnateTrait> = Object.fromEntries(
  Object.entries(SPIRIT_BATTLE_INNATE_RULES).map(([spiritId, rules]) => [
    spiritId,
    {
      spiritId,
      label: rules[0]?.label ?? spiritId,
      description: [...new Set(rules.map((rule) => rule.description))].join('；'),
      effects: rules.flatMap(toClientSpiritInnateEffects),
    },
  ]),
) as Record<string, ClientSpiritInnateTrait>;

function toClientSpiritInnateEffects(rule: SpiritBattleInnateRule): ClientSpiritInnateTrait['effects'] {
  const effects: ClientSpiritInnateTrait['effects'] = [];
  if (typeof rule.attackPercent === 'number') effects.push({ stat: 'attack', valueType: 'percent', value: rule.attackPercent });
  if (typeof rule.damagePercent === 'number') effects.push({ stat: 'damage', valueType: 'percent', value: rule.damagePercent });
  if (typeof rule.maxHpPercent === 'number') effects.push({ stat: 'maxHp', valueType: 'percent', value: rule.maxHpPercent });
  if (typeof rule.damageTakenPercent === 'number') effects.push({ stat: 'damageTaken', valueType: 'percent', value: rule.damageTakenPercent });
  if (typeof rule.critPercent === 'number') effects.push({ stat: 'crit', valueType: 'percent', value: rule.critPercent });
  if (typeof rule.lifestealPercent === 'number') effects.push({ stat: 'lifesteal', valueType: 'percent', value: rule.lifestealPercent });
  if (typeof rule.bloodLossReductionRatio === 'number') effects.push({ stat: 'bloodLoss', valueType: 'percent', value: -Math.round(rule.bloodLossReductionRatio * 100) });
  if (typeof rule.fixedHealRatio === 'number') effects.push({ stat: 'maxHp', valueType: 'percent', value: Math.round(rule.fixedHealRatio * 100) });
  return effects;
}

export function getClientSpiritInnateTrait(spiritId: string | null | undefined): ClientSpiritInnateTrait | null {
  if (!spiritId) {
    return null;
  }

  return CLIENT_SPIRIT_INNATE_TRAITS[spiritId] ?? null;
}

export interface ClientFactionAdvantageModifiers {
  farmMatureYieldBonusPercent: number;
  farmCollectWindowBonusPercent: number;
  farmMatureSecondsReductionPercent: number;
  farmHarvestSpiritRootBonusPercent: number;
  spiritTraitRollGoldCostReductionPercent: number;
  spiritBreakthroughSoulCostReductionPercent: number;
  spiritPassiveExpBonusPercent: number;
  spiritFeedDurationBonusPercent: number;
  battleDefenseLootLossReductionPercent: number;
  battleDefenseMainSpiritMaxHpBonusPercent: number;
  battleAttackBonusPercent: number;
  battlePostRecoveryLostHpPercent: number;
  battleAttackBonusAppliesToRaidAttackOnly: boolean;
}

export interface ClientFactionAdvantagePanel {
  factionCode: 'human' | 'immortal' | 'demon';
  factionName: string;
  title: string;
  summary: string;
  details: string[];
  modifiers: ClientFactionAdvantageModifiers;
}

export interface ClientSpiritSlot {
  spiritInstanceId?: string | null;
  slotIndex: number;
  spiritId: string | null;
  isMain: boolean;
  level: number;
  exp: number;
  currentLevelExpRequired?: number;
  isAtBreakthroughNode?: boolean;
  breakthroughStage?: number;
  lastExpSettledAt?: string | null;
  satiatedUntil?: string | null;
  satiatedRemainingSeconds?: number;
  satiatedExpBonusPercent?: number;
  element: ClientSpiritElement | null;
  maxHp: number;
  traits?: ClientSpiritTrait[];
  unlockedTraitSlots?: number;
  breakthroughRequirement?: ClientSpiritBreakthroughRequirement | null;
  slotVersion: number;
  appearance?: ClientSpiritAppearance | null;
}

export interface ClientSpiritTrait {
  slotIndex: number;
  traitCode: ClientSpiritTraitCode;
  label: string;
  description: string;
  value: number;
  sourceType: string;
}

export interface ClientSpiritBreakthroughRequirement {
  stage: number;
  level: number;
  quality: 'ordinary' | 'rare' | 'legendary';
  label: string;
  required: number;
  owned: number;
  canBreakthrough: boolean;
}

export interface ClientSpiritShopItem {
  itemId: string;
  label: string;
  description: string;
  priceTianjiTalisman: number;
  limitLabel: string;
  remainingPurchases: number | null;
  rewards: Array<{
    kind: 'spirit-root' | 'spirit-marrow' | 'spirit-jade' | 'ordinary-soul' | 'rare-soul' | 'legendary-soul';
    label: string;
    quantity: number;
  }>;
}

export interface ClientSpiritCodexEntry {
  spiritId: string;
  hasSeen: boolean;
  shardCount: number;
  readyToCompose: boolean;
  ownedCurrent: boolean;
  ownedEver: boolean;
  codexState: ClientCodexState;
  sceneVisibility: ClientSceneVisibility;
  displayName: string;
  definition: ClientSpiritDefinition;
}

export type ClientCodexPromptType =
  | 'spirit-codex-visible'
  | 'spirit-compose-ready'
  | 'plant-discovered'
  | 'plant-unlocked';

export interface ClientCodexPrompt {
  type: ClientCodexPromptType;
  subjectId: string;
  label: string;
  message: string;
  current?: number;
  required?: number;
}

export interface ClientSpiritState {
  spiritSoul: number;
  spiritRoot?: number;
  spiritMarrow?: number;
  spiritJade?: number;
  ordinarySoul?: number;
  rareSoul?: number;
  legendarySoul?: number;
  tianjiTalisman: number;
  dailyIntelFreeUsed: number;
  dailyIntelTalismanUsed: number;
  resourceVersion: number;
  mainSlot: ClientSpiritSlot | null;
  slots: ClientSpiritSlot[];
  codex: ClientSpiritCodexEntry[];
  readyToCompose: ClientSpiritCodexEntry[];
  factionAdvantage?: ClientFactionAdvantagePanel;
  breakthroughRequirement?: ClientSpiritBreakthroughRequirement | null;
  shop?: {
    items: ClientSpiritShopItem[];
    adReward: {
      dailyLimit: number;
      usedToday: number;
      tianjiTalisman: number;
      bonusPool: string[];
    };
  };
}

export interface ClientSpiritStateResponse {
  app: string;
  spirit: ClientSpiritState;
}

export type ClientSpiritPublicViewerRelation = 'self' | 'friend' | 'following' | 'none';

export interface ClientSpiritPublicSlot {
  spiritInstanceId: string | null;
  slotIndex: number;
  spiritId: string | null;
  label: string;
  rarity: ClientSpiritDefinition['rarity'] | null;
  level: number;
  isMain: boolean;
  element: ClientSpiritElement | null;
  maxHp: number;
  traits: ClientSpiritTrait[];
  appearance?: ClientSpiritAppearance | null;
}

export interface ClientSpiritPublicProfileResponse {
  app: string;
  viewerRelation: ClientSpiritPublicViewerRelation;
  player: {
    playerId: string;
    nickname: string;
    factionName: string | null;
    castleLevel: number;
  };
  mainSlot: ClientSpiritPublicSlot | null;
  slots: ClientSpiritPublicSlot[];
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

export interface ClientSpiritTraitRollCandidate {
  candidateId: string;
  traitCode: ClientSpiritTraitCode;
  label: string;
  description: string;
  value: number;
}

export interface ClientSpiritTraitRollPreview {
  rollLogId: string;
  slotIndex: number;
  targetSlotIndex: number;
  mode: ClientSpiritActiveRollMode;
  material: ClientSpiritTraitRollMaterial;
  currentTrait: ClientSpiritTraitRollCandidate | null;
  candidates: ClientSpiritTraitRollCandidate[];
  excludeCandidateIds?: string[];
}

export interface ClientRollSpiritTraitsResponse extends ClientSpiritMutationResponse {
  traitRoll?: ClientSpiritTraitRollPreview;
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
  sceneVisibility: ClientSceneVisibility;
  displayName: string;
  label: string;
  level: number;
  rarity: ClientSpiritRarity | null;
  avatarGlyph: string;
}

export interface ClientRaidSpiritIntel {
  element: ClientSpiritElement | null;
  attackRating: string;
  healthStatus: string;
  traits?: ClientSpiritTrait[];
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
  /**
   * @deprecated Planting no longer consumes seed stock. Use unlockedPlantIds
   * and plantResearch for player-facing plant access.
   */
  seedInventory: Record<string, number>;
  /**
   * @deprecated Plant essence inventory is retired from the current farming loop.
   */
  essenceInventory?: Record<string, number>;
  globalItemInventory: Record<string, number>;
  /**
   * @deprecated Use unlockedPlantIds for new UI.
   */
  unlockedSeedIds: string[];
  unlockedPlantIds?: string[];
  plantResearch?: Record<string, ClientPlantResearchState>;
  starterSeedClaimed: boolean;
  tianjiTalismanClaimed: boolean;
  spiritSoulClaimed: boolean;
  dailySpiritSoulAmount: number;
}

export interface ClientFeedSpiritRequest {
  slotIndex: number;
  actionType: ClientSpiritFeedActionType;
  slotVersion?: number;
  resourceVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientBreakthroughSpiritRequest {
  slotIndex: number;
  targetStage?: number;
  slotVersion?: number;
  resourceVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientRollSpiritTraitsRequest {
  slotIndex: number;
  mode: ClientSpiritRollMode;
  targetSlotIndex?: number;
  material?: ClientSpiritTraitRollMaterial;
  candidateCount?: number;
  lockedTraitSlotIndexes?: number[];
  excludeCandidateIds?: string[];
  slotVersion?: number;
  walletVersion?: number;
  resourceVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientResolveSpiritTraitRollRequest {
  rollLogId: string;
  selectedTraitCode?: ClientSpiritTraitCode | null;
  slotVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientBuySpiritShopItemRequest {
  itemId: string;
  resourceVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientClaimSpiritAdRewardRequest {
  resourceVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientSeasonStatus {
  seasonNumber: number;
  currentWeek: number;
  totalWeeks: number;
  startsAt: string;
  endsAt: string;
  transition?: ClientSeasonTransition;
  startup?: ClientSeasonStartupState;
}

export type ClientFactionChoiceStatus = 'not_needed' | 'available' | 'used' | 'expired';

export interface ClientSeasonTransition {
  currentSeasonNumber: number;
  previousSeasonNumber: number | null;
  resetApplied: boolean;
  refreshRequired: boolean;
  seasonStartsAt: string;
  seasonEndsAt: string;
  factionChoiceStatus: ClientFactionChoiceStatus;
  factionChoiceDeadlineAt: string | null;
}

export type ClientSeasonStartupStepType = 'season-intro' | 'faction-confirm';

export interface ClientSeasonStartupState {
  seasonNumber: number;
  blocking: boolean;
  completed: boolean;
  currentStep: ClientSeasonStartupStepType | null;
  availableSteps: ClientSeasonStartupStepType[];
  introConfirmed: boolean;
  factionChoiceStatus: ClientFactionChoiceStatus;
  factionChoiceDeadlineAt: string | null;
}

export interface ClientSeasonStartupActionResponse {
  app: string;
  summary: string;
  season: ClientSeasonStatus;
  startup: ClientSeasonStartupState;
}

export interface ClientConfirmSeasonFactionRequest {
  mode: 'keep-current';
}

export interface ClientChangeSeasonFactionRequest {
  factionCode: 'human' | 'immortal' | 'demon';
}

export interface ClientSeasonSignInDay {
  day: number;
  reward: number;
  claimed: boolean;
  current: boolean;
  future: boolean;
  missed: boolean;
}

export interface ClientSeasonSignInMilestone {
  dayCount: number;
  title: string;
  reached: boolean;
  remainingDays: number;
  claimed: boolean;
  claimable: boolean;
  debugUnlocked: boolean;
  rewards: ClientSeasonRewardItem[];
}

export interface ClientSeasonSignInState {
  seasonNumber: number;
  currentDay: number;
  claimedDays: number[];
  totalTianjiReward: number;
  todayReward: number;
  claimedToday: boolean;
  days: ClientSeasonSignInDay[];
  milestones: ClientSeasonSignInMilestone[];
}

export interface ClientSeasonSignInResponse extends ClientSeasonSignInState {}

export interface ClientClaimSeasonSignInResponse {
  app: string;
  summary: string;
  rewardTianjiTalisman: number;
  tianjiTalisman: number;
  resourceVersion: number;
  signIn: ClientSeasonSignInState;
}

export interface ClientClaimSeasonSignInMilestoneRequest {
  dayCount: number;
  requestIdempotencyKey?: string;
}

export interface ClientClaimSeasonSignInMilestoneResponse {
  app: string;
  summary: string;
  rewards: ClientSeasonRewardItem[];
  signIn: ClientSeasonSignInState;
}

export type ClientSeasonRewardGrantStatus = 'generated' | 'notified' | 'claimed' | 'voided';

export interface ClientSeasonRewardItem {
  kind: 'tianjiTalisman' | 'spiritSoul' | 'ordinarySoul' | 'rareSoul' | 'legendarySoul' | 'spiritShard' | 'medal';
  quantity: number;
  label: string;
  name?: string;
  nameEn?: string;
  essenceType?: string;
  spiritId?: string;
  medalKey?: string;
  domain?: string;
}

export interface ClientSeasonRewardGrant {
  id: string;
  seasonNumber: number;
  rewardType: string;
  rewardTier: string | null;
  status: ClientSeasonRewardGrantStatus;
  contributionSnapshot: number;
  signInDays: number;
  loginDays: number;
  harvestCount: number;
  raidCount: number;
  rewards: ClientSeasonRewardItem[];
  claimedAt: string | null;
  createdAt: string;
}

export interface ClientSeasonMedal {
  id: string;
  seasonNumber: number;
  domain: string;
  achievementKey: string;
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  rewardGrantId: string | null;
  rewardType: string | null;
  rewardTier: string | null;
  rewardStatus: ClientSeasonRewardGrantStatus | null;
  statSnapshot: Record<string, unknown>;
  createdAt: string;
}

export interface ClientSeasonMedalCabinet {
  currentSeasonNumber: number;
  currentSeasonTitle: string;
  medals: ClientSeasonMedal[];
  medalsBySeason: Array<{
    seasonNumber: number;
    title: string;
    medals: ClientSeasonMedal[];
  }>;
}

export interface ClientSeasonRewardsResponse {
  app: string;
  currentSeasonNumber: number;
  items: ClientSeasonRewardGrant[];
  claimableCount: number;
  medalCabinet: ClientSeasonMedalCabinet;
}

export interface AdminOverviewResponse {
  app: string;
  docs: string;
  modules: string[];
  adminCapabilities?: {
    readonly: string[];
    configWrite: string[];
    notificationWrite: string[];
    dangerousWrite: string[];
    auth: {
      readHeader: 'x-admin-debug-key';
      writeHeader: 'x-admin-write-debug-key';
      writeHeaderRequiredInProduction: boolean;
    };
  };
}

export type NotificationCategory = 'system' | 'announcement' | 'maintenance' | 'reward' | 'compensation';

export type PlayerNotificationClaimStatus = 'none' | 'unclaimed' | 'claimed' | 'expired';

export type NotificationAttachmentKind = 'gold' | 'tianjiTalisman' | 'spiritSoul' | 'ordinarySoul' | 'rareSoul' | 'legendarySoul' | 'spiritShard' | 'medal';

export interface AdminPagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface NotificationAttachment {
  kind: NotificationAttachmentKind;
  quantity: number;
  /**
   * @deprecated Notification seed attachments are retired. Plant access should
   * be granted by unlock state, not stock or essence.
   */
  seedId?: string;
  /**
   * @deprecated Plant essence is retired from season and notification rewards.
   */
  essenceType?: string;
  spiritId?: string;
  medalKey?: string;
  domain?: string;
  sourceType?: string;
  sourceId?: string;
  name?: string;
  nameEn?: string;
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
  reason?: string;
  confirmText?: string;
  attachments?: Array<{
    kind: NotificationAttachmentKind;
    quantity: number;
    /**
     * @deprecated Notification seed attachments are retired.
     */
    seedId?: string;
    /**
     * @deprecated Plant essence is retired from rewards.
     */
    essenceType?: string;
    spiritId?: string;
    medalKey?: string;
    domain?: string;
  }>;
}

export interface AdminDangerousOperationRequest {
  reason?: string;
  confirmText?: string;
}

export interface AdminAdjustPlayerResourcesRequest {
  reason?: string;
  goldDelta?: number;
  tianjiTalismanDelta?: number;
  spiritSoulDelta?: number;
  ordinarySoulDelta?: number;
  rareSoulDelta?: number;
  legendarySoulDelta?: number;
  contributionDelta?: number;
}

export interface AdminAdjustPlayerResourcesResponse {
  playerId: string;
  adjusted: boolean;
  changes: Array<{
    resource: string;
    before: number;
    delta: number;
    after: number;
  }>;
  auditLogId: string;
}

export interface AdminOperationAuditLogItem {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  adminActor: string;
  reason: string;
  confirmText: string;
  metadataJson: unknown;
  createdAt: string;
}

export interface AdminRobotDashboardResponse {
  rule: Record<string, unknown>;
  status: Record<string, unknown>;
  automation?: {
    loop?: unknown;
    config?: Record<string, unknown>;
    configs?: {
      items: Array<Record<string, unknown>>;
    };
    jobs?: {
      items: Array<Record<string, unknown>>;
    };
    season?: {
      config?: Record<string, unknown>;
      session?: Record<string, unknown>;
    };
  };
  runs: {
    items: Array<Record<string, unknown>>;
  };
  stats?: Record<string, unknown>;
  dayReports?: {
    items: Array<Record<string, unknown>>;
  };
  robots: {
    items: Array<Record<string, unknown>>;
  };
  recentActions: {
    items: Array<Record<string, unknown>>;
  };
  recentErrors: {
    items: Array<Record<string, unknown>>;
  };
  errorSummary: {
    items: Array<Record<string, unknown>>;
    exportMarkdown: string;
  };
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
  readAt: string;
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
  resources?: Record<string, unknown> | null;
  spell?: Record<string, unknown> | null;
  wallet: Record<string, unknown> | null;
  building: Record<string, unknown> | null;
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

export type AdminDesignDocMetricTone = 'neutral' | 'ok' | 'warn' | 'bad';

export interface AdminDesignDocMetric {
  label: string;
  value: string | number;
  tone?: AdminDesignDocMetricTone;
}

export interface AdminDesignDocFact {
  label: string;
  key: string;
  value: unknown;
}

export interface AdminDesignDocTableColumn {
  key: string;
  label: string;
}

export interface AdminDesignDocTable {
  key: string;
  title: string;
  description: string;
  columns: AdminDesignDocTableColumn[];
  rows: Array<Record<string, unknown>>;
}

export interface AdminDesignDocCard {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  source: string;
  summary: string;
  tags: string[];
  metrics: AdminDesignDocMetric[];
  facts: AdminDesignDocFact[];
  notes: string[];
}

export interface AdminDesignDocSection {
  key: string;
  title: string;
  description: string;
  metrics: AdminDesignDocMetric[];
  cards: AdminDesignDocCard[];
  tables: AdminDesignDocTable[];
}

export interface AdminDesignDocResponse {
  generatedAt: string;
  overview: {
    title: string;
    summary: string;
    metrics: AdminDesignDocMetric[];
  };
  sections: AdminDesignDocSection[];
}

export type HomeResourceTone = 'vault' | 'army';

export interface HomeResourceSummary {
  label: string;
  value: string;
  tone: HomeResourceTone;
  capacityValue?: string | null;
}

/**
 * @deprecated Gold capacity, tax pending and raid overflow claims are being retired
 * in the 2026-05-24 lightweight economy redesign.
 */
export type ClientPendingClaimSource = 'tax' | 'faction' | 'raid-overflow';

/**
 * @deprecated Raid overflow temporary claims are retired. Raid gold should deposit directly.
 */
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

export type ClientLandDeedKey = 'field-2' | 'field-3' | 'field-4';
export type ClientLandDeedStatus = 'locked' | 'in-progress' | 'completed' | 'claimed';

export interface ClientLandDeedRequirementProgress {
  key: string;
  label: string;
  current: number;
  target: number;
  completed: boolean;
}

export interface ClientLandDeedProgress {
  deedKey: ClientLandDeedKey;
  title: string;
  description: string;
  status: ClientLandDeedStatus;
  targetFieldSlotIndex: number;
  requirements: ClientLandDeedRequirementProgress[];
  alternativeRequirements?: ClientLandDeedRequirementProgress[];
  canClaim: boolean;
  claimedAt: string | null;
}

export type ClientFactionStipendStatus = 'available' | 'claimed' | 'unavailable';

export type ClientFactionStipendRewardKind = 'gold' | 'spirit-root' | 'spirit-marrow' | 'spirit-jade' | 'spirit-shard' | 'ordinary-soul' | 'rare-soul' | 'legendary-soul' | 'seed';

export interface ClientFactionStipendReward {
  kind: ClientFactionStipendRewardKind;
  label: string;
  quantity: number;
  seedId?: string;
  essenceType?: string;
  spiritId?: string;
}

export type ClientPlantResearchStatus = 'undiscovered' | 'discovered' | 'ready' | 'unlocked';

export interface ClientPlantResearchState {
  plantType: string;
  discovered: boolean;
  unlocked: boolean;
  status: ClientPlantResearchStatus;
  essenceRequired: number;
  essenceOwned: number;
  harvestRequired?: number;
  harvestOwned?: number;
  contributionRequired: number;
  contributionOwned: number;
  canUnlock: boolean;
}

export interface ClientFactionStipendSummary {
  title: string;
  description: string;
  status: ClientFactionStipendStatus;
  dateKey: string;
  contribution: number;
  tierKey: string;
  tierLabel: string;
  rewards: ClientFactionStipendReward[];
  claimedAt: string | null;
  action: ClientSceneAction | null;
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

export type ClientFactionTaskType = 'essence-submit-basic' | 'essence-submit-focus' | 'conflict-raid';

export interface ClientHomeFactionTaskSummary {
  id: string;
  type: ClientFactionTaskType;
  title: string;
  description: string;
  progressCurrent: number;
  progressTarget: number;
  progressText: string;
  rewardContribution: number;
  requiredEssenceType: string | null;
  requiredEssenceLabel: string | null;
  currentEssenceQuantity: number;
  status: ClientDailyTaskStatus;
  action: ClientSceneAction;
}

export interface HomeSummaryResponse {
  app: string;
  playerName: string;
  factionName: string;
  /**
   * @deprecated Main city level is no longer a core feature gate.
   */
  castleLevel: number;
  stateVersions: ClientStateVersions;
  staminaStatus: string;
  fieldStatus: string;
  reportStatus: string;
  protectedUntil: string | null;
  resources: HomeResourceSummary[];
  /**
   * @deprecated Tax, hourly faction dividend and raid-overflow pending claims are retired.
   */
  pendingClaims: ClientPendingClaimSummary[];
  /**
   * @deprecated Raid overflow temporary claims are retired.
   */
  temporaryClaim: ClientTemporaryClaimSummary | null;
  dailyTasks: ClientDailyTaskSummary[];
  factionTasks: ClientHomeFactionTaskSummary[];
  todayContribution: number;
  primaryActions: HomeActionItem[];
}

export interface ClientStateVersions {
  buildingVersion: number;
  walletVersion: number;
  armyVersion: number;
}

export interface ClientResourceLedger {
  vaultGold: number;
  /**
   * @deprecated Gold storage is unlimited in the lightweight economy redesign.
   */
  vaultCapacity: number;
  /**
   * @deprecated Main city tax is retired.
   */
  taxPendingGold: number;
  /**
   * @deprecated Hourly faction dividend is retired. Use faction stipend DTOs.
   */
  factionDividendGold: number;
}

/**
 * @deprecated Pending gold claim flow is retired for tax and raid overflow.
 * Faction rewards should use daily stipend claim.
 */
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
  /**
   * @deprecated Gold capacity overflow is retired.
   */
  acceptOverflowLoss?: boolean;
  taskDateKey?: string;
  walletVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientClaimStarterSeedRequest {
  requestIdempotencyKey?: string;
}

export interface ClientClaimDailyTaskResponse {
  app: string;
  summary: string;
  taskId: string;
  rewardGold: number;
  claimedGold: number;
  /**
   * @deprecated Gold capacity overflow is retired and should remain 0 during migration.
   */
  overflowGold: number;
  home: HomeSummaryResponse;
  scenes: ClientSceneContentResponse;
}

/**
 * @deprecated Main city, vault and field-slot upgrades are retired from the first release.
 * Use territory tech upgrades instead.
 */
export type ClientBuildingUpgradeId = 'castle' | 'vault' | 'field-slot' | 'watchtower';
export type ClientTerritoryUpgradeId = 'protectionTech' | 'farmYieldTech' | 'collectWindowTech' | 'factionOfferingTech';
/**
 * @deprecated Castle extension naming is kept temporarily for compatibility.
 * `pendingClaimTech` is retired; new code should use ClientTerritoryUpgradeId.
 */
export type ClientCastleExtensionUpgradeId = ClientTerritoryUpgradeId | 'pendingClaimTech';
export type ClientUpgradeTargetType = 'building' | 'castle-extension' | 'territory-tech';

export interface ClientStateMutationResponse {
  app: string;
  summary: string;
  home: HomeSummaryResponse;
  scenes: ClientSceneContentResponse;
}

export interface ClientClaimStarterSeedResponse extends ClientStateMutationResponse {
  bootstrap: ClientBootstrapResponse;
}

export interface ClientCollectFieldRequest {
  fieldId: string;
  collectMode: 'ripe' | 'early';
  fieldVersion?: number;
  walletVersion?: number;
  requestIdempotencyKey?: string;
}

export type ClientCollectRewardKind = 'seed' | 'essence' | 'spirit-root' | 'spirit-marrow' | 'spirit-jade';

export interface ClientCollectRewardItem {
  kind?: ClientCollectRewardKind;
  seedId?: string;
  essenceType?: string;
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
    /**
     * @deprecated Gold capacity overflow is retired and should remain 0 during migration.
     */
    overflowGold: number;
    rewards: ClientCollectRewardItem[];
  };
}

export interface ClientStartCultivationRequest {
  fieldId: string;
  /**
   * @deprecated Use plantType for new UI.
   */
  seedId?: string;
  plantType?: string;
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
  attackerSpiritInstanceId?: string | null;
  armyVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientRaidRewardItem {
  seedId: string;
  label: string;
  quantity: number;
  kind?: 'seed' | 'essence';
  essenceType?: string;
}

export interface ClientRaidBattleEvent {
  type: 'dodge' | 'execute' | 'element' | 'critical' | 'lifesteal' | 'counter' | 'damage' | 'soul-drop' | 'status' | 'blood' | 'trait';
  label: string;
  description: string;
}

export type ClientRaidBattleSide = 'attacker' | 'defender';
export type ClientRaidBattleFloatingTone = 'damage' | 'miss' | 'crit' | 'buff' | 'blood' | 'element';

export interface ClientRaidBattleUnitSnapshot {
  side: ClientRaidBattleSide;
  playerName: string;
  spiritId: string | null;
  sceneVisibility: ClientSceneVisibility;
  displayName: string;
  spiritName: string;
  rarity: string | null;
  element: ClientSpiritElement | null;
  level: number;
  hpBefore: number;
  hpAfter: number;
  maxHp: number;
  attack: number;
  healthStatus?: 'normal' | 'low' | 'injured' | 'down';
  healthStatusLabel?: string;
  attackCoefficient?: number;
  traits?: Array<{
    code: string;
    label: string;
    value: number;
    valueType: 'percent' | 'flat' | 'ratio';
    source: 'spirit' | 'equipment' | 'buff' | 'faction' | 'temporary';
    visible: boolean;
  }>;
}

export type ClientRaidBattleStep =
  | { type: 'enter'; durationMs: number }
  | { type: 'clash'; durationMs: number; round?: number }
  | { type: 'notice'; title: string; summary?: string; tone?: 'default' | 'blood'; durationMs: number }
  | { type: 'floatingText'; side: ClientRaidBattleSide; text: string; tone: ClientRaidBattleFloatingTone; durationMs: number; round?: number; bloodRound?: number }
  | { type: 'hpChange'; side: ClientRaidBattleSide; from: number; to: number; max: number; durationMs: number; floatingText?: string | false; floatingTone?: ClientRaidBattleFloatingTone; round?: number; bloodRound?: number }
  | { type: 'return'; durationMs: number }
  | { type: 'result'; title: string; summary: string; durationMs: number };

export interface ClientRaidBattleReplay {
  orderId: string;
  result: 'WIN' | 'LOSS' | 'DRAW';
  title: string;
  summary: string;
  attacker: ClientRaidBattleUnitSnapshot;
  defender: ClientRaidBattleUnitSnapshot;
  events: ClientRaidBattleEvent[];
  steps: ClientRaidBattleStep[];
  rewardsPreview: {
    goldLoot: number;
    items: ClientRaidRewardItem[];
  };
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
    /**
     * @deprecated Gold capacity overflow is retired and should remain 0 during migration.
     */
    overflowGold: number;
    /**
     * @deprecated Raid overflow temporary claims are retired.
     */
    temporaryClaimExpiresAt: string | null;
    casualties: number;
    rewards: ClientRaidRewardItem[];
    codexPrompts?: ClientCodexPrompt[];
    contributionGain?: number;
    battleEvents?: ClientRaidBattleEvent[];
    battleReplay?: ClientRaidBattleReplay;
    attackerHpAfter?: number | null;
    defenderHpAfter?: number | null;
    protectedUntil: string;
    reportSummary: string;
  };
}

export interface ClientUpgradeBuildingRequest {
  targetType: ClientUpgradeTargetType;
  buildingId?: ClientBuildingUpgradeId;
  extensionId?: ClientCastleExtensionUpgradeId;
  territoryUpgradeId?: ClientTerritoryUpgradeId;
  buildingVersion?: number;
  walletVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientClaimFactionStipendRequest {
  walletVersion?: number;
  requestIdempotencyKey?: string;
}

export interface ClientClaimFactionStipendResponse {
  app: string;
  summary: string;
  stipend: ClientFactionStipendSummary;
  rewards: ClientFactionStipendReward[];
  codexPrompts?: ClientCodexPrompt[];
  bootstrap?: ClientBootstrapResponse;
  home: HomeSummaryResponse;
  scenes: ClientSceneContentResponse;
}

export interface ClientResetDemoStateResponse {
  app: string;
  summary: string;
  home: HomeSummaryResponse;
  scenes: ClientSceneContentResponse;
}

export interface ClientDevelopmentSeasonControlResponse {
  app: string;
  summary: string;
  serverTime: string;
  season: ClientSeasonStatus;
  overrideActive: boolean;
}

export type ClientSceneKey = 'home' | 'building' | 'farm' | 'raid' | 'report' | 'faction' | 'social';

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

export interface ClientTerritoryUpgrade {
  id: ClientTerritoryUpgradeId;
  title: string;
  levelText: string;
  description: string;
  effectText: string;
  costText: string;
  action: ClientSceneAction;
  locked?: boolean;
}

/**
 * @deprecated Castle extension naming is kept temporarily for compatibility.
 * Use ClientTerritoryUpgrade for new code.
 */
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
  tone: 'growing' | 'mature' | 'withered' | 'empty' | 'locked';
  progressRemainingSeconds: number;
  progressTotalSeconds: number;
  yieldGold: number;
  expectedEssenceYield?: number;
  stolenEssenceYield?: number;
  harvestableEssenceYield?: number;
  essenceLabel?: string | null;
  description: string;
  actions: ClientSceneAction[];
}

export interface ClientPlantInventoryItem {
  plantType: string;
  essenceType: string;
  plantName: string;
  essenceLabel: string | null;
  rarity: ClientSpiritRarity;
  unlocked: boolean;
  discovered?: boolean;
  researchStatus?: ClientPlantResearchStatus;
  unlockEssenceRequired?: number;
  unlockHarvestRequired?: number;
  unlockHarvestOwned?: number;
  unlockContributionRequired?: number;
  unlockContributionOwned?: number;
  canUnlock?: boolean;
  essenceQuantity: number;
  growSeconds: number;
  matureSeconds: number;
  expectedEssenceYield: number;
}

export interface ClientRaidTarget {
  id: string;
  targetPlayerId: string;
  name: string;
  faction: string;
  level: number;
  tutorialTarget?: boolean;
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
  tutorialTarget?: boolean;
  combatPower: string;
  /**
   * @deprecated Raid detail is now spirit-only. Farm preview should not be used in new code.
   */
  fieldPreviewTone?: ClientFarmField['tone'];
  /**
   * @deprecated Raid detail is now spirit-only. Farm preview should not be used in new code.
   */
  fieldStatus?: string;
  /**
   * @deprecated Raid detail is now spirit-only. Farm preview should not be used in new code.
   */
  fields?: ClientFarmField[];
  /**
   * @deprecated Raid detail no longer exposes pre-estimated loot in new code.
   */
  raidableGold?: string;
  /**
   * @deprecated Raid detail no longer exposes farm-based reward hints in new code.
   */
  exposedFruit?: string;
  raidRule: string;
  defenseStatus: string;
  protectionStatus: string;
  /**
   * @deprecated Raid detail is now spirit-only. Farm board message should not be used in new code.
   */
  targetFarmBoardMessage?: string;
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
  orderId?: string;
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
  rewards?: ClientRaidRewardItem[];
  contributionGain?: number;
  unread?: boolean;
  revengeable?: boolean;
  raidMessage?: ClientRaidMessageSnapshot | null;
  battleReplayAvailable?: boolean;
  actions: ClientSceneAction[];
}

export interface ClientRaidBattleReplayResponse {
  app: string;
  replay: ClientRaidBattleReplay;
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
  totalContribution?: string;
  /**
   * @deprecated Faction treasury is no longer a visible rule. Use totalContribution.
   */
  gold?: string;
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
  playerId?: string;
  rank?: number;
  label: string;
  value: string;
  note?: string;
  factionName?: string;
  contributionScore?: number;
  castleLevel?: number;
  isCurrentPlayer?: boolean;
}

export interface ClientFactionSpiritInstanceLeaderboardEntry {
  playerId: string;
  spiritInstanceId: string;
  spiritId: string;
  label: string;
  rarity: ClientSpiritRarity;
  element: ClientSpiritElement | null;
  battleCount: number;
  winCount: number;
  lossCount: number;
  drawCount: number;
  winRatePercent: number;
  isMain: boolean;
  traitItems: Array<{
    label: string;
    description: string;
  }>;
  innateTraitItems: Array<{
    label: string;
    description: string;
  }>;
}

export interface ClientFactionDonateRequest {
  /**
   * @deprecated 旧版兼容入口已停用，当前贡献来自日常行为。
   */
  goldAmount: number;
}

export interface ClientFactionTaskSubmitRequest {
  taskId: string;
  amount?: number;
  requestIdempotencyKey?: string;
}

export interface ClientFactionTaskSubmitResponse extends ClientStateMutationResponse {
  task: ClientHomeFactionTaskSummary;
}

export type ClientSocialRelationType = 'friend' | 'following' | 'enemy' | 'blocked';
export type ClientSocialRelationStatus = 'active' | 'pending' | 'muted';
export type ClientSocialFeedType =
  | 'friend_watered_field'
  | 'friend_revived_field'
  | 'friend_guarded_field'
  | 'friend_requested'
  | 'friend_accepted'
  | 'friend_rejected'
  | 'friend_deleted'
  | 'team_challenge_invited'
  | 'team_challenge_accepted'
  | 'enemy_raided'
  | 'revenge_available'
  | 'faction_help_requested';
export type ClientSocialAssistType = 'water_field' | 'revive_field' | 'harvest_field' | 'guard_field' | 'recover_spirit' | 'faction_task_help';
export type ClientTeamChallengeStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'settled';

export interface ClientSocialPlayerSummary {
  playerId: string;
  nickname: string;
  factionId?: string | null;
  factionName: string | null;
  castleLevel: number;
  lastActiveAt: string | null;
}

export interface ClientSocialRelationItem {
  id: string;
  relationType: ClientSocialRelationType;
  status: ClientSocialRelationStatus;
  sourceType: string;
  intimacy: number;
  lastInteractedAt: string | null;
  createdAt: string;
  target: ClientSocialPlayerSummary;
  assistSummary?: {
    revivableCount: number;
    harvestableCount: number;
    availableCount: number;
  };
}

export interface ClientSocialFeedItem {
  id: string;
  feedType: ClientSocialFeedType;
  summary: string;
  isRead: boolean;
  createdAt: string;
  expiresAt: string | null;
  actor: ClientSocialPlayerSummary | null;
  actions: Array<{
    label: string;
    action: 'accept_friend' | 'reject_friend' | 'revenge' | 'follow' | 'team_challenge' | 'view_report' | 'ignore';
    targetPlayerId?: string;
    relatedEntityId?: string;
  }>;
}

export interface ClientSocialSummaryResponse {
  app: string;
  counts: {
    feedUnread: number;
    friends: number;
    friendLimit: number;
    friendMaxLimit: number;
    following: number;
    followingLimit: number;
    followingMaxLimit: number;
    enemies: number;
    pendingTeamChallenges: number;
  };
  quickActions: ClientSocialFeedItem[];
}

export interface ClientSocialFeedResponse {
  app: string;
  items: ClientSocialFeedItem[];
  pagination: AdminPagination;
}

export interface ClientSocialRelationListResponse {
  app: string;
  items: ClientSocialRelationItem[];
  pagination: AdminPagination;
}

export interface ClientSocialFollowRequest {
  targetPlayerId: string;
}

export interface ClientSocialFriendRequest {
  targetPlayerId: string;
  sourceType?: string;
}

export interface ClientSocialRelationMutationResponse {
  app: string;
  summary: string;
  relation: ClientSocialRelationItem;
  reverseRelation?: ClientSocialRelationItem;
}

export interface ClientSocialReviveFieldRequest {
  targetPlayerId: string;
  fieldSlotId?: string;
  requestIdempotencyKey?: string;
}

export interface ClientSocialHarvestFieldPreviewRequest {
  targetPlayerId: string;
}

export type ClientSocialFriendFieldStatus = 'LOCKED' | 'EMPTY' | 'GROWING' | 'MATURE' | 'WITHERED';

export interface ClientSocialFriendFieldVisitField {
  fieldSlotId: string;
  fieldCode: string;
  slotIndex: number;
  status: ClientSocialFriendFieldStatus;
  tone: ClientFarmField['tone'];
  badge: string;
  title: string;
  cropName: string | null;
  cropRarity: string | null;
  canRevive: boolean;
  canHarvest: boolean;
  nextAction: 'harvest' | 'revive' | null;
  unavailableReason: string | null;
  rewardPreview: {
    gold: number;
  } | null;
  progressRemainingSeconds: number;
  progressTotalSeconds: number;
  yieldGold: number;
}

export interface ClientSocialFriendFieldVisitResponse {
  app: string;
  friend: ClientSocialPlayerSummary;
  fields: ClientSocialFriendFieldVisitField[];
  ruleText: string;
}

export interface ClientSocialHarvestableFieldPreview {
  fieldSlotId: string;
  fieldCode: string;
  status: 'MATURE';
  cropName: string;
  cropRarity: string;
  rewardPreview: {
    gold: number;
  };
}

export interface ClientSocialHarvestFieldPreviewResponse {
  app: string;
  friend: ClientSocialPlayerSummary;
  fields: ClientSocialHarvestableFieldPreview[];
  ruleText: string;
}

export interface ClientSocialHarvestFieldRequest {
  targetPlayerId: string;
  fieldSlotId?: string;
  requestIdempotencyKey?: string;
}

export interface ClientSocialAssistResponse {
  app: string;
  summary: string;
  assist: {
    id: string;
    assistType: ClientSocialAssistType;
    targetPlayerId: string;
    targetEntityType: string | null;
    targetEntityId: string | null;
    effectValue: number;
    dateKey: string;
    createdAt: string;
  };
  intimacyGain: number;
  field?: {
    fieldSlotId: string;
    status: 'GROWING' | 'MATURE' | 'WITHERED' | 'EMPTY' | 'LOCKED';
    effectSeconds: number;
    beforeStageEndsAt: string;
    afterStageEndsAt: string;
    fieldVersion: number;
  };
  rewards?: Array<{
    kind: 'gold';
    quantity: number;
    label: string;
  }>;
  counts: ClientSocialSummaryResponse['counts'];
}

export type ClientShareAssistCampaignType = 'water' | 'friend_invite';
export type ClientShareAssistCampaignStatus = 'active' | 'full' | 'expired' | 'cancelled';
export type ClientShareAssistAudience = 'new-user' | 'returning-user';
export type ClientShareAssistRecordStatus = 'confirmed' | 'bound' | 'rewarded' | 'rejected';

export interface ClientCreateShareAssistCampaignRequest {
  campaignType: ClientShareAssistCampaignType;
  targetEntityId?: string;
  maxAssistCount?: number;
  requestIdempotencyKey?: string;
}

export interface ClientShareAssistCampaignView {
  id: string;
  campaignType: ClientShareAssistCampaignType;
  status: ClientShareAssistCampaignStatus;
  owner: ClientSocialPlayerSummary;
  targetEntityType: string | null;
  targetEntityId: string | null;
  maxAssistCount: number;
  currentAssistCount: number;
  remainingAssistCount: number;
  expiresAt: string;
  createdAt: string;
}

export interface ClientCreateShareAssistCampaignResponse {
  app: string;
  summary: string;
  campaign: ClientShareAssistCampaignView;
  sharePath: string;
}

export interface PublicShareAssistCampaignResponse {
  app: string;
  campaign: ClientShareAssistCampaignView;
  copy: {
    title: string;
    description: string;
    actionLabel: string;
  };
}

export interface PublicShareAssistConfirmRequest {
  audience: ClientShareAssistAudience;
  helperPlayerId?: string;
  helperOpenidHash?: string;
  helperDeviceHash?: string;
  requestIdempotencyKey?: string;
}

export interface PublicShareAssistConfirmResponse {
  app: string;
  summary: string;
  campaign: ClientShareAssistCampaignView;
  record: {
    id: string;
    audience: ClientShareAssistAudience;
    status: ClientShareAssistRecordStatus;
    helperPlayerId: string | null;
    createdAt: string;
  };
  socialAssist?: ClientSocialAssistResponse;
  deliveredEffect: {
    applied: boolean;
    shortenedSeconds: number;
    reason: 'delivered' | 'no_active_field' | 'already_complete';
  };
  invitePending: boolean;
  nextAction: 'start_tutorial' | 'enter_game' | 'already_assisted' | 'expired' | 'full';
}

export interface ClientCompleteShareInviteTutorialRequest {
  campaignId?: string;
  helperOpenidHash?: string;
  helperDeviceHash?: string;
  requestIdempotencyKey?: string;
}

export interface ClientCompleteShareInviteTutorialResponse {
  app: string;
  summary: string;
  bound: boolean;
  rewarded: boolean;
  notificationId: string | null;
}

export interface ClientTeamChallengeRequest {
  allyPlayerId: string;
  targetPlayerId: string;
  requestIdempotencyKey?: string;
}

export interface ClientTeamChallengeItem {
  id: string;
  status: ClientTeamChallengeStatus;
  initiator: ClientSocialPlayerSummary;
  ally: ClientSocialPlayerSummary;
  target: ClientSocialPlayerSummary;
  assistEfficiencyBps: number;
  result: string | null;
  reward: Record<string, unknown> | null;
  expiresAt: string;
  createdAt: string;
  settledAt: string | null;
}

export interface ClientTeamChallengeResponse {
  app: string;
  summary: string;
  challenge: ClientTeamChallengeItem;
}

export interface ClientUnlockPlantRequest {
  plantType: string;
  requestIdempotencyKey?: string;
}

export interface ClientUnlockPlantResponse extends ClientStateMutationResponse {
  plant: ClientPlantInventoryItem;
  bootstrap: ClientBootstrapResponse;
}

export * from './spiritCollisionBattle.js';
export * from './spiritBattleRules.js';

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
  advantage?: ClientFactionAdvantagePanel;
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
    advantage?: ClientFactionAdvantagePanel;
    fields: ClientFarmField[];
    plants?: ClientPlantInventoryItem[];
    landDeeds?: ClientLandDeedProgress[];
    guide: ClientGuideSection;
  };
  raid: {
    hero: ClientFarmHero;
    advantage?: ClientFactionAdvantagePanel;
    daily?: {
      dateKey: string;
      attemptLimit: number;
      attemptsUsed: number;
      attemptsRemaining: number;
      refreshLimit: number;
      refreshesUsed: number;
      refreshesRemaining: number;
    };
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
    tasks: ClientHomeFactionTaskSummary[];
    contributionLogs?: Array<{
      id: string;
      sourceType: string;
      sourceLabel: string;
      contributionDelta: number;
      createdAt: string;
    }>;
    stipend?: ClientFactionStipendSummary;
    rankings: ClientFactionLeaderboardEntry[];
    spiritRankings?: ClientFactionSpiritInstanceLeaderboardEntry[];
  };
}
