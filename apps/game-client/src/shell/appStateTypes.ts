import type { PublicShareAssistCampaignResponse } from '@trinitywar/shared';
import type { DevFactionChoice } from '../api';
import type { TutorialFlowAction } from '../tutorial/tutorialFlow';
import type { GlobalUnlockItem } from '../ui/common/GlobalUnlockModal';
import type { SeedRewardModalItem } from '../ui/common/SeedRewardModal';
import type { ShareAssistAudience, ShareAssistKind, ShareAssistStatus } from '../ui/share/ShareAssistPage';

export type RaidHubTabKey = 'targets' | 'reports';
export type FactionTabKey = 'overview' | 'donate' | 'rank';

export interface ToastState {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

export interface RaidTargetModalState {
  targetId: string;
  targetName: string;
  mode: 'raid' | 'revenge';
}

export interface SeedCodexState {
  selectedSeedId: string;
}

export type TopResourcePanel = 'spirit-codex' | 'resources';

export interface SeedRewardModalState {
  title: string;
  summary: string;
  footerHint?: string;
  confirmAction?: 'claim-faction-stipend' | 'claim-starter-seeds' | 'claim-notification';
  notificationId?: string;
  afterConfirmActions?: TutorialFlowAction[];
  items: SeedRewardModalItem[];
}

export interface SeedSelectionState {
  fieldId: string;
  fieldCode: string;
  availableFields: Array<{
    fieldId: string;
    fieldCode: string;
  }>;
}

export interface FarmCollectPresentationState {
  fieldId: string;
  tier: 'harvest' | 'critical';
  showSeeds: boolean;
}

export interface FarmBoardEditorState {
  initialMessage: string;
  message: string;
  saving: boolean;
}

export interface GlobalUnlockModalState {
  title: string;
  summary: string;
  items: GlobalUnlockItem[];
  afterConfirmActions?: TutorialFlowAction[];
  completionKind?: 'friend-invite' | 'spirit-codex-visible';
  subjectId?: string;
}

export interface ShareAssistDemoState {
  audience: ShareAssistAudience;
  kind: ShareAssistKind;
  status: ShareAssistStatus;
  campaignId: string;
  campaign: PublicShareAssistCampaignResponse | null;
  error: string | null;
}

export interface PendingShareInviteState {
  campaignId: string;
  helperOpenidHash: string;
  helperDeviceHash: string;
}

export interface PendingFriendInviteState {
  campaignId?: string;
  inviterName: string;
  inviterFactionCode: DevFactionChoice;
  inviterFactionName: string;
  boundFriend?: boolean;
  notificationId?: string | null;
}

export interface ReturningFriendInvitePromptState {
  campaignId: string;
  inviterName: string;
  inviterFactionName: string;
  helperPlayerId: string;
}

export interface GlobalFeatureModalState {
  title: string;
  eyebrow?: string;
  description?: string;
  contributionTiers?: FactionContributionTier[];
  seasonResetRules?: boolean;
  tianjiShop?: boolean;
  seasonSignIn?: boolean;
  seasonMedalCabinet?: boolean;
}

export interface FactionContributionTier {
  threshold: string;
  label: string;
  rewards: string[];
}
