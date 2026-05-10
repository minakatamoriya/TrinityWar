export const APP_NAME = 'TrinityWar';
export const API_PREFIX = '/api';
export const CLIENT_API_PREFIX = `${API_PREFIX}/client`;
export const ADMIN_API_PREFIX = `${API_PREFIX}/admin`;
export const DOCS_ROUTE = '/docs';

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

export interface HomeResourceSummary {
  label: string;
  value: string;
  tone: 'vault';
}

export type ClientPendingClaimSource = 'tax' | 'faction';

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

export interface HomeSummaryResponse {
  app: string;
  playerName: string;
  factionName: string;
  castleLevel: number;
  staminaStatus: string;
  fieldStatus: string;
  reportStatus: string;
  resources: HomeResourceSummary[];
  pendingClaims: ClientPendingClaimSummary[];
  primaryActions: HomeActionItem[];
}

export interface ClientResourceLedger {
  vaultGold: number;
  vaultCapacity: number;
  taxPendingGold: number;
  factionDividendGold: number;
}

export interface ClientClaimPendingRequest {
  source: ClientPendingClaimSource;
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

export type ClientBuildingUpgradeId = 'castle' | 'vault' | 'field-slot' | 'watchtower';

export interface ClientStateMutationResponse {
  app: string;
  summary: string;
  home: HomeSummaryResponse;
  scenes: ClientSceneContentResponse;
}

export interface ClientCollectFieldRequest {
  fieldId: string;
  collectMode: 'ripe' | 'early';
}

export interface ClientStartCultivationRequest {
  fieldId: string;
}

export interface ClientUpgradeBuildingRequest {
  buildingId: ClientBuildingUpgradeId;
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
  code: string;
  title: string;
  badge: string;
  tone: 'seeded' | 'growing' | 'mature' | 'withered' | 'empty' | 'locked';
  progressRemainingSeconds: number;
  progressTotalSeconds: number;
  description: string;
  actions: ClientSceneAction[];
}

export interface ClientRaidTarget {
  id: string;
  name: string;
  faction: string;
  level: number;
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
  raidableGold: string;
  exposedFruit: string;
  raidRule: string;
  defenseStatus: string;
  protectionStatus: string;
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
  unread?: boolean;
  revengeable?: boolean;
  actions: ClientSceneAction[];
}

export interface ClientFactionHero {
  eyebrow: string;
  title: string;
  description: string;
  action: ClientSceneAction;
}

export interface ClientFactionLeaderboardEntry {
  label: string;
  value: string;
}

export interface ClientSceneContentResponse {
  app: string;
  building: {
    upgrades: ClientBuildingUpgrade[];
  };
  farm: {
    hero: ClientFarmHero;
    fields: ClientFarmField[];
    guide: ClientGuideSection;
  };
  raid: {
    hero: ClientFarmHero;
    targets: ClientRaidTarget[];
    detail: ClientRaidDetail;
  };
  report: {
    defense: ClientReportEntry[];
    attack: ClientReportEntry[];
    actions: ClientSceneAction[];
  };
  faction: {
    hero: ClientFactionHero;
    overview: ClientMetricRow[];
    donate: ClientGuideSection;
    rankings: ClientFactionLeaderboardEntry[];
  };
}