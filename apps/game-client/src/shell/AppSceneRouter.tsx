import type {
  ClientFarmField,
  ClientRaidTarget,
  ClientSceneAction,
  ClientSocialFriendFieldVisitResponse,
  ClientSocialRelationItem,
  ClientSocialSummaryResponse,
  ClientSpiritElement,
  ClientRollSpiritTraitsResponse,
  ClientSpiritRollMode,
  ClientSpiritState,
  ClientSpiritTraitCode,
  ClientSpiritTraitRollMaterial,
} from '@trinitywar/shared';
import type { ClientViewModel } from '../api';
import { ArmyScene } from '../ui/scenes/ArmyScene';
import { FactionScene } from '../ui/scenes/FactionScene';
import { FarmScene } from '../ui/scenes/FarmScene';
import { ReportScene } from '../ui/scenes/ReportScene';
import { SocialScene, type SocialTabKey } from '../ui/scenes/SocialScene';
import type { TutorialTask, TutorialUiRules } from '../tutorial/tutorialFlow';
import type { AppSceneKey } from '../config/sceneConfig';
import type { FactionTabKey, FarmCollectPresentationState } from './appStateTypes';

interface AppSceneRouterProps {
  activeScene: AppSceneKey;
  factionTab: FactionTabKey;
  farmCollectPresentation: FarmCollectPresentationState | null;
  farmFields: ClientFarmField[];
  followedTargetIds: string[];
  friendInviteNewUserUrl: string | null;
  home: ClientViewModel['home'];
  isTutorialUser: boolean;
  pendingActionKey: string | null;
  portalTarget: HTMLElement | null;
  raidBattleLimit: number;
  raidBattleUsed: number;
  scenes: ClientViewModel['scenes'];
  socialError: string | null;
  socialFieldVisit: ClientSocialFriendFieldVisitResponse | null;
  socialFollowing: ClientSocialRelationItem[];
  socialFriends: ClientSocialRelationItem[];
  socialLoading: boolean;
  socialSummary: ClientSocialSummaryResponse | null;
  socialTab: SocialTabKey;
  spiritState: ClientSpiritState | null;
  targets: ClientRaidTarget[];
  tutorialTask: TutorialTask | null;
  tutorialUiRules: TutorialUiRules;
  vaultGold: number;
  onAssistAllSocialFields: () => void;
  onAssistSocialFriend: (targetPlayerId: string) => void;
  onBreakthroughSpirit: (slotIndex: number, slotVersion: number, targetStage?: number) => void;
  onChangeFactionTab: (tab: FactionTabKey) => void;
  onChangeSocialTab: (tab: SocialTabKey) => void;
  onClaimFactionStipend: () => void;
  onComposeSpirit: (spiritId: string, slotIndex: number, element: ClientSpiritElement) => void;
  onCopyFriendInviteUrl: (url: string) => void;
  onCreateFriendInvite: () => void;
  onDeleteSocialFriend: (targetPlayerId: string) => void;
  onDissolveSpirit: (slotIndex: number, slotVersion: number) => void;
  onFarmAction: (action: ClientSceneAction, fieldId: string, fieldCode: string) => void;
  onFeedSpirit: (slotIndex: number, slotVersion: number, actionType: 'feed_once' | 'fill_full') => void;
  onFollowSocialTarget: (targetPlayerId: string) => void;
  onOpenContributionGuide: () => void;
  onOpenRaidTarget: (target: ClientRaidTarget) => void;
  onOpenSocialFieldVisit: (targetPlayerId: string) => void;
  onOpenSpiritPublicProfile: (targetPlayerId: string) => void;
  onRefreshRaidTargets: () => void;
  onRefreshSocial: () => void;
  onRequestFriend: (targetPlayerId: string) => void;
  onRollSpiritTraits: (
    slotIndex: number,
    slotVersion: number,
    mode: ClientSpiritRollMode,
    options?: {
      candidateCount?: number;
      excludeCandidateIds?: string[];
      lockedTraitSlotIndexes?: number[];
      material?: ClientSpiritTraitRollMaterial;
      targetSlotIndex?: number;
    },
  ) => Promise<ClientRollSpiritTraitsResponse | null>;
  onResolveSpiritTraitRoll: (rollLogId: string, selectedTraitCode: ClientSpiritTraitCode | null, slotVersion: number) => Promise<boolean>;
  onSetMainSpirit: (slotIndex: number, slotVersion: number) => void;
  onOpenSpiritUnlockSurface: () => void;
  onToggleFollowTarget: (target: ClientRaidTarget) => void;
  onTutorialAction: () => void;
  onCloseSocialFieldVisit: () => void;
  onUnfollowSocialTarget: (targetPlayerId: string) => void;
}

export function AppSceneRouter(props: AppSceneRouterProps): JSX.Element {
  const {
    activeScene,
    factionTab,
    farmCollectPresentation,
    farmFields,
    followedTargetIds,
    friendInviteNewUserUrl,
    home,
    isTutorialUser,
    pendingActionKey,
    portalTarget,
    raidBattleLimit,
    raidBattleUsed,
    scenes,
    socialError,
    socialFieldVisit,
    socialFollowing,
    socialFriends,
    socialLoading,
    socialSummary,
    socialTab,
    spiritState,
    targets,
    tutorialTask,
    tutorialUiRules,
    vaultGold,
    onAssistAllSocialFields,
    onAssistSocialFriend,
    onBreakthroughSpirit,
    onChangeFactionTab,
    onChangeSocialTab,
    onClaimFactionStipend,
    onComposeSpirit,
    onCopyFriendInviteUrl,
    onCreateFriendInvite,
    onDeleteSocialFriend,
    onDissolveSpirit,
    onFarmAction,
    onFeedSpirit,
    onFollowSocialTarget,
    onOpenContributionGuide,
    onOpenRaidTarget,
    onOpenSocialFieldVisit,
    onOpenSpiritPublicProfile,
    onRefreshRaidTargets,
    onRefreshSocial,
    onRequestFriend,
    onResolveSpiritTraitRoll,
    onRollSpiritTraits,
    onSetMainSpirit,
    onOpenSpiritUnlockSurface,
    onToggleFollowTarget,
    onTutorialAction,
    onCloseSocialFieldVisit,
    onUnfollowSocialTarget,
  } = props;

  return (
    <section className={`screen-body scene-${activeScene}`}>
      {activeScene === 'farm' ? (
        <FarmScene
          advantage={scenes.farm.advantage}
          collectPresentation={farmCollectPresentation}
          fields={farmFields}
          tutorialTask={tutorialTask}
          uiRules={tutorialUiRules.farm}
          onAction={onFarmAction}
          onTutorialAction={onTutorialAction}
        />
      ) : null}

      {activeScene === 'spirit' && spiritState ? (
        <ArmyScene
          advantage={scenes.army.advantage}
          busy={pendingActionKey?.startsWith('spirit:') ?? false}
          uiRules={tutorialUiRules.army}
          onCompose={onComposeSpirit}
          onDissolve={onDissolveSpirit}
          onSetMain={onSetMainSpirit}
          onFeed={onFeedSpirit}
          onBreakthrough={onBreakthroughSpirit}
          onRollTraits={onRollSpiritTraits}
          onResolveTraitRoll={onResolveSpiritTraitRoll}
          onOpenSpiritUnlockSurface={onOpenSpiritUnlockSurface}
          playerFaction={home.factionName}
          spirit={spiritState}
          vaultGold={vaultGold}
        />
      ) : null}

      {activeScene === 'battle' ? (
        <ReportScene
          advantage={scenes.raid.advantage}
          battleLimit={raidBattleLimit}
          battleUsed={raidBattleUsed}
          followedTargetIds={followedTargetIds}
          friendTargetIds={socialFriends
            .filter((relation) => relation.status === 'active')
            .map((relation) => relation.target.playerId)}
          onOpenTarget={onOpenRaidTarget}
          onToggleFollowTarget={onToggleFollowTarget}
          onRefresh={onRefreshRaidTargets}
          refreshLabel="刷新目标"
          refreshPending={pendingActionKey === 'raid:refresh-targets'}
          isTutorial={isTutorialUser}
          targets={targets}
          uiRules={tutorialUiRules.raid}
        />
      ) : null}

      {activeScene === 'faction' ? (
        <FactionScene
          contribution={scenes.faction.contribution}
          factionTab={factionTab}
          hero={scenes.faction.hero}
          portalTarget={portalTarget}
          onChangeTab={onChangeFactionTab}
          onContributionGuide={onOpenContributionGuide}
          onClaimStipend={onClaimFactionStipend}
          claimingStipend={pendingActionKey === 'faction:stipend'}
          stipend={scenes.faction.stipend}
          followedTargetIds={followedTargetIds}
          friendTargetIds={socialFriends
            .filter((relation) => relation.status === 'active')
            .map((relation) => relation.target.playerId)}
          rankings={scenes.faction.rankings}
          spiritRankings={scenes.faction.spiritRankings}
          uiRules={tutorialUiRules.faction}
          onFollowRankingPlayer={onFollowSocialTarget}
          onOpenSpiritProfile={onOpenSpiritPublicProfile}
          onUnfollowRankingPlayer={onUnfollowSocialTarget}
        />
      ) : null}

      {activeScene === 'social' ? (
        <SocialScene
          activeTab={socialTab}
          busy={socialLoading}
          error={socialError}
          following={socialFollowing}
          friendInviteUrl={friendInviteNewUserUrl}
          friends={socialFriends}
          fieldVisit={socialFieldVisit}
          portalTarget={portalTarget}
          onAssistFriend={onAssistSocialFriend}
          onAssistAllFields={onAssistAllSocialFields}
          onChangeTab={onChangeSocialTab}
          onRefresh={onRefreshSocial}
          onDeleteFriend={onDeleteSocialFriend}
          onFollowTarget={onFollowSocialTarget}
          onInviteFriend={onCreateFriendInvite}
          onCopyFriendInviteUrl={onCopyFriendInviteUrl}
          onCloseFieldVisit={onCloseSocialFieldVisit}
          onRequestFriend={onRequestFriend}
          onUnfollowTarget={onUnfollowSocialTarget}
          onOpenFieldVisit={onOpenSocialFieldVisit}
          onOpenSpiritProfile={onOpenSpiritPublicProfile}
          summary={socialSummary}
        />
      ) : null}
    </section>
  );
}
