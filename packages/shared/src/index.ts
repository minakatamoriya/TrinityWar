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
}

export interface AdminOverviewResponse {
  app: string;
  docs: string;
  modules: string[];
}

export interface HomeResourceSummary {
  label: string;
  value: string;
  tone: 'vault' | 'wallet' | 'pending';
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
  primaryActions: HomeActionItem[];
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
  code: string;
  title: string;
  badge: string;
  tone: 'ripe' | 'growing' | 'empty';
  description: string;
  actions: ClientSceneAction[];
}

export interface ClientRaidTarget {
  id: string;
  name: string;
  faction: string;
  summary: string;
  loot: string;
  risk: string;
  detail: string;
  action: ClientSceneAction;
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
    guide: ClientGuideSection;
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