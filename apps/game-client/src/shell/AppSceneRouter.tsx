import type {
  ClientCastleExtensionUpgradeId,
  ClientBuildingUpgradeId,
  ClientFarmBoardState,
  ClientFarmField,
  ClientRaidTarget,
  ClientSceneAction,
  ClientSceneKey,
  ClientSocialFeedItem,
  ClientSocialFriendFieldVisitResponse,
  ClientSocialRelationItem,
  ClientSocialSummaryResponse,
  ClientSpiritElement,
  ClientRollSpiritTraitsResponse,
  ClientSpiritRollMode,
  ClientSpiritState,
  ClientSpiritTraitCode,
  ClientSpiritTraitRollMaterial,
  ClientUpgradeTargetType,
} from '@trinitywar/shared';
import type { ClientViewModel } from '../api';
import { ArmyScene } from '../ui/scenes/ArmyScene';
import { BuildingScene } from '../ui/scenes/BuildingScene';
import { FactionScene } from '../ui/scenes/FactionScene';
import { FarmScene } from '../ui/scenes/FarmScene';
import { HomeScene } from '../ui/scenes/HomeScene';
import { ReportScene } from '../ui/scenes/ReportScene';
import { SocialScene, type SocialTabKey } from '../ui/scenes/SocialScene';
import type { TutorialTask, TutorialUiRules } from '../tutorial/tutorialFlow';
import type { FactionTabKey, FarmCollectPresentationState, RaidHubTabKey } from './appStateTypes';

interface AppSceneRouterProps {
  activeScene: ClientSceneKey;
  factionTab: FactionTabKey;
  farmBoard: ClientFarmBoardState | null;
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
  raidHubTab: RaidHubTabKey;
  reportEntries: ClientViewModel['scenes']['report']['attack'];
  scenes: ClientViewModel['scenes'];
  socialError: string | null;
  socialFeed: ClientSocialFeedItem[];
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
  onAcceptFriendRequest: (relationId: string) => void;
  onAssistAllSocialFields: () => void;
  onAssistSocialFriend: (targetPlayerId: string) => void;
  onBreakthroughSpirit: (slotIndex: number, slotVersion: number, targetStage?: number) => void;
  onBuildingUpgradeAction: (
    action: ClientSceneAction,
    upgradeId: ClientBuildingUpgradeId | ClientCastleExtensionUpgradeId,
    context: string,
    targetType: ClientUpgradeTargetType,
    costText: string,
  ) => void;
  onChangeFactionTab: (tab: FactionTabKey) => void;
  onChangeRaidHubTab: (tab: RaidHubTabKey) => void;
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
  onOpenFarmBoard: () => void;
  onOpenRaidTarget: (target: ClientRaidTarget) => void;
  onOpenSocialFieldVisit: (targetPlayerId: string) => void;
  onRaidAction: (action: ClientSceneAction, context?: string) => void;
  onRefreshRaidTargets: () => void;
  onRefreshSocial: () => void;
  onRejectFriendRequest: (relationId: string) => void;
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
  onNavigate: (scene: ClientSceneKey, nextRaidHubTab?: RaidHubTabKey) => void;
  onCloseSocialFieldVisit: () => void;
  onUnfollowSocialTarget: (targetPlayerId: string) => void;
}

export function AppSceneRouter(props: AppSceneRouterProps): JSX.Element {
  const {
    activeScene,
    factionTab,
    farmBoard,
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
    raidHubTab,
    reportEntries,
    scenes,
    socialError,
    socialFeed,
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
    onAcceptFriendRequest,
    onAssistAllSocialFields,
    onAssistSocialFriend,
    onBreakthroughSpirit,
    onBuildingUpgradeAction,
    onChangeFactionTab,
    onChangeRaidHubTab,
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
    onOpenFarmBoard,
    onOpenRaidTarget,
    onOpenSocialFieldVisit,
    onRaidAction,
    onRefreshRaidTargets,
    onRefreshSocial,
    onRejectFriendRequest,
    onRequestFriend,
    onResolveSpiritTraitRoll,
    onRollSpiritTraits,
    onSetMainSpirit,
    onOpenSpiritUnlockSurface,
    onToggleFollowTarget,
    onTutorialAction,
    onNavigate,
    onCloseSocialFieldVisit,
    onUnfollowSocialTarget,
  } = props;

  return (
    <section className={`screen-body scene-${activeScene}`}>
      {activeScene === 'home' ? (
        <HomeScene
          home={home}
          scenes={scenes}
          socialSummary={socialSummary}
          spirit={spiritState}
          tutorialTask={tutorialTask}
          onNavigate={onNavigate}
          onTutorialAction={onTutorialAction}
        />
      ) : null}

      {activeScene === 'building' ? (
        <BuildingScene
          onUpgradeAction={onBuildingUpgradeAction}
          extensions={scenes.building.extensions}
          upgrades={scenes.building.upgrades}
        />
      ) : null}

      {activeScene === 'farm' ? (
        <FarmScene
          advantage={scenes.farm.advantage}
          collectPresentation={farmCollectPresentation}
          farmBoardMessage={farmBoard?.farmBoardMessage ?? ''}
          farmBoardUpdatedAt={farmBoard?.farmBoardUpdatedAt ?? null}
          fields={farmFields}
          uiRules={tutorialUiRules.farm}
          onAction={onFarmAction}
          onOpenFarmBoard={onOpenFarmBoard}
        />
      ) : null}

      {activeScene === 'raid' && spiritState ? (
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

      {activeScene === 'report' ? (
        <ReportScene
          activeTab={raidHubTab}
          advantage={scenes.raid.advantage}
          battleLimit={raidBattleLimit}
          battleUsed={raidBattleUsed}
          onAction={onRaidAction}
          onChangeTab={onChangeRaidHubTab}
          followedTargetIds={followedTargetIds}
          friendTargetIds={socialFriends
            .filter((relation) => relation.status === 'active')
            .map((relation) => relation.target.playerId)}
          onOpenTarget={onOpenRaidTarget}
          onToggleFollowTarget={onToggleFollowTarget}
          onRefresh={onRefreshRaidTargets}
          refreshLabel="刷新目标"
          refreshPending={pendingActionKey === 'raid:refresh-targets'}
          reportEntries={reportEntries}
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
          onChangeTab={onChangeFactionTab}
          onContributionGuide={onOpenContributionGuide}
          onClaimStipend={onClaimFactionStipend}
          claimingStipend={pendingActionKey === 'faction:stipend'}
          stipend={scenes.faction.stipend}
          comparison={scenes.faction.comparison}
          contributionLogs={scenes.faction.contributionLogs ?? []}
          followedTargetIds={followedTargetIds}
          friendTargetIds={socialFriends
            .filter((relation) => relation.status === 'active')
            .map((relation) => relation.target.playerId)}
          rankings={scenes.faction.rankings}
          uiRules={tutorialUiRules.faction}
          onFollowRankingPlayer={onFollowSocialTarget}
          onUnfollowRankingPlayer={onUnfollowSocialTarget}
        />
      ) : null}

      {activeScene === 'social' ? (
        <SocialScene
          activeTab={socialTab}
          busy={socialLoading}
          error={socialError}
          feed={socialFeed}
          following={socialFollowing}
          friendInviteUrl={friendInviteNewUserUrl}
          friends={socialFriends}
          fieldVisit={socialFieldVisit}
          portalTarget={portalTarget}
          onAssistFriend={onAssistSocialFriend}
          onAssistAllFields={onAssistAllSocialFields}
          onAcceptFriendRequest={onAcceptFriendRequest}
          onChangeTab={onChangeSocialTab}
          onRejectFriendRequest={onRejectFriendRequest}
          onRefresh={onRefreshSocial}
          onDeleteFriend={onDeleteSocialFriend}
          onFollowTarget={onFollowSocialTarget}
          onInviteFriend={onCreateFriendInvite}
          onCopyFriendInviteUrl={onCopyFriendInviteUrl}
          onCloseFieldVisit={onCloseSocialFieldVisit}
          onRequestFriend={onRequestFriend}
          onUnfollowTarget={onUnfollowSocialTarget}
          onOpenFieldVisit={onOpenSocialFieldVisit}
          summary={socialSummary}
        />
      ) : null}
    </section>
  );
}
