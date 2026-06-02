import { useEffect, useRef, useState } from 'react';
import { buildSpiritCollisionBattleReplay } from '@trinitywar/shared';
import type {
  ClientCastleExtensionUpgradeId,
  ClientCollectFieldRequest,
  ClientCollectFieldResponse,
  ClientRaidActionRequest,
  ClientRaidDeepIntelResponse,
  ClientRaidBattleReplay,
  ClientFactionDonateRequest,
  ClientBuildingUpgradeId,
  ClientRaidTarget,
  ClientSceneAction,
  ClientSceneKey,
  ClientPlantResearchState,
  ClientFarmBoardState,
  ClientSpiritElement,
  ClientSpiritRollMode,
  ClientSpiritTraitCode,
  ClientSpiritState,
  ClientSeasonSignInState,
  HomeSummaryResponse,
  ClientUpgradeTargetType,
} from '@trinitywar/shared';
import { ApiError, breakthroughSpirit, buySpiritShopItem, claimFactionStipend, claimSeasonSignIn, claimSpiritAdReward, claimStarterSeeds, clearDevLoginSession, collectFieldEarnings, composeSpirit, completeShareInviteTutorial, confirmPublicShareAssist, createShareAssistCampaign, devLogin, dissolveSpirit, donateFactionResources, feedSpirit, getStoredDevLoginSession, loadClientViewModel, loadFarmBoard, loadPublicShareAssistCampaign, loadRaidBattleReplay, loadRaidTargetDetail, loadSeasonSignIn, loadSpiritState, raidClientTarget, recoverSpirit, refreshRaidTargets, resetDemoExperimentState, revealRaidTargetDeepIntel, rollSpiritTraits, setMainSpirit, startFieldCultivation, type ClientViewModel, type DevFactionChoice, type DevLoginMode, type DevLoginSession, unlockPlant, updateFarmBoard, upgradeClientBuilding } from './api';
import { NotificationCenter } from './ui/common/NotificationCenter';
import type { SocialRelationFilter, SocialTabKey } from './ui/scenes/SocialScene';
import type { ShareAssistAudience } from './ui/share/ShareAssistPage';
import { CharacterDialogProvider } from './dialog/CharacterDialogProvider';
import { useCharacterDialog } from './dialog/useCharacterDialog';
import { RaidBattleScreen } from './battle/RaidBattleScreen';
import {
  TUTORIAL_STARTER_SEED_ID,
  buildTutorialTask,
  canOpenSceneInTutorial,
  getInitialTutorialStage,
  getLockedSceneMessage,
  getTutorialFlowActions,
  getTutorialStageStorageKey,
  type TutorialFlowAction,
  type TutorialStage,
} from './tutorial/tutorialFlow';
import {
  defaultUnlockedSeedIds,
  emptySeedInventory,
} from './config/seedCatalog';
import {
  FRIEND_INVITE_DEMO_INVITER,
  factionCodeByName,
} from './config/sceneConfig';
import {
  formatNumber,
  parseTianjiCostText,
} from './utils/format';
import { getMillisecondsUntilNextChinaMidnight } from './utils/time';
import {
  FARM_COLLECT_PRESENTATION_MS,
} from './modules/farm/farmPresentation';
import {
  shouldCloseFarmBoardEditorWithoutSaving,
  validateFarmBoardMessage,
} from './modules/farm/farmBoardState';
import {
  applyFarmSeedRewardsToInventory,
  applyFarmSeedRewardsToUnlockedSeedIds,
  applySpiritMaterialRewardDelta,
  buildSpiritMaterialRewardDelta,
} from './modules/farm/farmRewardState';
import {
  type FactionTabKey,
  type FarmBoardEditorState,
  type FarmCollectPresentationState,
  type GlobalFeatureModalState,
  type GlobalUnlockModalState,
  type PendingFriendInviteState,
  type PendingShareInviteState,
  type RaidHubTabKey,
  type ReturningFriendInvitePromptState,
  type SeedCodexState,
  type SeedRewardModalState,
  type SeedSelectionState,
  type ShareAssistDemoState,
  type TopResourcePanel,
} from './shell/appStateTypes';
import { normalizeScene } from './shell/navigation';
import { buildActionMessage } from './shell/actionMessages';
import {
  buildSeedBackpackState,
  emptyGlobalItemInventory,
  getPreferredSeedId,
} from './modules/backpack/backpackState';
import { buildUpgradeRequest } from './modules/building/buildingRequests';
import { buildFactionContributionTiers } from './modules/faction/factionPresentation';
import { applyFactionStipendSoulRewards } from './modules/faction/factionRewardState';
import { getRewardBubbleTone, isDisplayableFarmReward } from './modules/rewards/rewardPresentation';
import { resolveRaidTargetByContext } from './modules/raid/raidSelectors';
import {
  applyRaidTargetDetailToViewModel,
  patchRaidTargetPreviewInViewModel,
} from './modules/raid/raidViewModel';
import {
  applyRaidRewardsToSeedInventory,
  applyRaidRewardsToUnlockedSeedIds,
} from './modules/raid/raidRewardState';
import { buildSettledRaidRewardModal } from './modules/raid/raidRewardPresentation';
import { readCampaignIdFromFriendInviteUrl } from './modules/share/shareLinks';
import {
  applyShareAssistConfirmResultToDemoState,
  buildFriendInviteDemoLinks,
  buildShareAssistDemoState,
} from './modules/share/shareAssistState';
import {
  buildNotificationClaimRewardModal,
} from './modules/notifications/notificationPresentation';
import { useNotificationCenter } from './modules/notifications/useNotificationCenter';
import { useRaidIntelState } from './modules/raid/useRaidIntelState';
import { useSocialSceneState } from './modules/social/useSocialSceneState';
import {
  applyTianjiTalismanToSpiritState,
  spendLocalTianjiTalisman,
  syncTianjiTalismanInInventory,
} from './modules/spirit/spiritState';
import { buildSpiritComposeUnlockModal } from './modules/spirit/spiritPresentation';
import { buildAppDerivedState } from './shell/appDerivedState';
import { AppSceneRouter } from './shell/AppSceneRouter';
import { applyClientViewModelScenePatch } from './shell/clientViewModelState';
import { AuthEntryScreen } from './shell/AuthEntryScreen';
import { BottomDock } from './shell/BottomDock';
import { CollectionModalLayer } from './shell/CollectionModalLayer';
import { CombatAndFeedbackLayer } from './shell/CombatAndFeedbackLayer';
import { DesktopStatusRail } from './shell/DesktopStatusRail';
import { FarmModalLayer } from './shell/FarmModalLayer';
import { GlobalFeatureModalHost } from './shell/GlobalFeatureModalHost';
import { GlobalResourceBar } from './shell/GlobalResourceBar';
import { GlobalUnlockModalHost } from './shell/GlobalUnlockModalHost';
import { LoadingScreen } from './shell/LoadingScreen';
import { RaidIntelModalHost } from './shell/RaidIntelModalHost';
import { ReturningFriendInvitePrompt } from './shell/ReturningFriendInvitePrompt';
import { SeedRewardModalHost } from './shell/SeedRewardModalHost';
import { SettingsModal } from './shell/SettingsModal';
import { ShareAssistDemoScreen } from './shell/ShareAssistDemoScreen';
import { TopDock } from './shell/TopDock';
import { useFeedbackLayer } from './shell/useFeedbackLayer';

function App(): JSX.Element {
  const storedLoginSession = getStoredDevLoginSession();
  const [viewModel, setViewModel] = useState<ClientViewModel | null>(null);
  const [spiritState, setSpiritState] = useState<ClientSpiritState | null>(null);
  const [loginSession, setLoginSession] = useState<DevLoginSession | null>(() => storedLoginSession);
  const [pendingNewUserFaction, setPendingNewUserFaction] = useState<DevFactionChoice>('human');
  const [authScreen, setAuthScreen] = useState<'faction-select' | 'account-select'>('account-select');
  const [loginLoadingMode, setLoginLoadingMode] = useState<DevLoginMode | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeScene, setActiveScene] = useState<ClientSceneKey>('home');
  const [tutorialStage, setTutorialStage] = useState<TutorialStage>(() => getInitialTutorialStage(storedLoginSession));
  const [raidHubTab, setRaidHubTab] = useState<RaidHubTabKey>('targets');
  const [factionTab, setFactionTab] = useState<FactionTabKey>('overview');
  const [socialTab, setSocialTab] = useState<SocialTabKey>('feed');
  const [socialRelationFilter, setSocialRelationFilter] = useState<SocialRelationFilter>('all');
  const [shareAssistDemo, setShareAssistDemo] = useState<ShareAssistDemoState | null>(null);
  const [pendingShareInvite, setPendingShareInvite] = useState<PendingShareInviteState | null>(null);
  const [pendingFriendInvite, setPendingFriendInvite] = useState<PendingFriendInviteState | null>(null);
  const [returningFriendInvitePrompt, setReturningFriendInvitePrompt] = useState<ReturningFriendInvitePromptState | null>(null);
  const [friendInviteDemoLinks, setFriendInviteDemoLinks] = useState<{ newUser: string; returningUser: string } | null>(null);
  const [friendInviteNewUserUrlInput, setFriendInviteNewUserUrlInput] = useState('');
  const [friendInviteReturningUserUrlInput, setFriendInviteReturningUserUrlInput] = useState('');
  const {
    rewardBubbles,
    showRewardBubbles,
    showToast,
    toast,
  } = useFeedbackLayer();
  const social = useSocialSceneState({
    onToast: showToast,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const notifications = useNotificationCenter({
    onError: (message) => showToast(message, 'error'),
  });
  const raidIntel = useRaidIntelState({
    loadDetail: loadRaidTargetDetail,
    onDetailLoaded: (detail) => {
      setViewModel((current) => applyRaidTargetDetailToViewModel(current, detail));
    },
    onToast: showToast,
  });
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [farmTick, setFarmTick] = useState(0);
  const [seedInventory, setSeedInventory] = useState<Record<string, number>>(emptySeedInventory);
  const [globalItemInventory, setGlobalItemInventory] = useState<Record<string, number>>(emptyGlobalItemInventory);
  const [unlockedSeedIds, setUnlockedSeedIds] = useState<string[]>([]);
  const [plantResearchState, setPlantResearchState] = useState<Record<string, ClientPlantResearchState>>({});
  const [seedRewardModal, setSeedRewardModal] = useState<SeedRewardModalState | null>(null);
  const [pendingRaidRewardModal, setPendingRaidRewardModal] = useState<SeedRewardModalState | null>(null);
  const [raidBattleReplay, setRaidBattleReplay] = useState<ClientRaidBattleReplay | null>(null);
  const [raidBattleAutoStart, setRaidBattleAutoStart] = useState(true);
  const [seedSelectionState, setSeedSelectionState] = useState<SeedSelectionState | null>(null);
  const [seedCodexState, setSeedCodexState] = useState<SeedCodexState | null>(null);
  const [topResourcePanel, setTopResourcePanel] = useState<TopResourcePanel | null>(null);
  const [topSpiritCodexSpiritId, setTopSpiritCodexSpiritId] = useState<string | null>(null);
  const [armyQueueRefreshReadyAt, setArmyQueueRefreshReadyAt] = useState<string | null>(null);
  const [selectedSeedId, setSelectedSeedId] = useState<string>('qilingya');
  const [fieldSeedAssignments, setFieldSeedAssignments] = useState<Record<string, string>>({});
  const [farmCollectPresentation, setFarmCollectPresentation] = useState<FarmCollectPresentationState | null>(null);
  const [farmBoard, setFarmBoard] = useState<ClientFarmBoardState | null>(null);
  const [farmBoardEditor, setFarmBoardEditor] = useState<FarmBoardEditorState | null>(null);
  const [globalFeatureModal, setGlobalFeatureModal] = useState<GlobalFeatureModalState | null>(null);
  const [globalUnlockModal, setGlobalUnlockModal] = useState<GlobalUnlockModalState | null>(null);
  const [seasonSignInState, setSeasonSignInState] = useState<ClientSeasonSignInState | null>(null);
  const characterDialog = useCharacterDialog();
  const { playDialogScene } = characterDialog;
  const characterDialogPortalRef = useRef<HTMLDivElement | null>(null);
  const welcomeDialogSessionIdRef = useRef<string | null>(null);
  const farmEnterDialogRef = useRef<{ sceneId: string; at: number } | null>(null);

  const handleOpenBattleDemo = (): void => {
    const replay = buildSpiritCollisionBattleReplay({
      orderId: `demo-collision-${Date.now()}`,
      seed: Date.now() % 2147483647,
      goldPool: 1000,
      attacker: {
        side: 'attacker',
        playerName: loginSession?.player.nickname ?? '测试玩家',
        spiritId: 'demo-attacker',
        spiritName: '赤焰灵狐',
        rarity: 'rare',
        element: 'fire',
        level: 18,
        attack: 132,
        maxHp: 760,
        traits: [
          { code: 'claw', label: '利爪', value: 8 },
          { code: 'crit', label: '暴击', value: 18 },
          { code: 'crit_damage', label: '暴伤', value: 20 },
        ],
      },
      defender: {
        side: 'defender',
        playerName: '守田者',
        spiritId: 'demo-defender',
        spiritName: '玄甲石灵',
        rarity: 'common',
        element: 'earth',
        level: 18,
        attack: 104,
        maxHp: 980,
        traits: [
          { code: 'thick_skin', label: '厚皮', value: 10 },
          { code: 'counter', label: '反击', value: 6 },
        ],
      },
    });

    setPendingRaidRewardModal(null);
    setRaidBattleAutoStart(false);
    setRaidBattleReplay(replay);
    showToast('已生成 10 回合互撞测试。', 'info');
  };

  const advanceTutorialStage = (nextStage: TutorialStage): void => {
    setTutorialStage(nextStage);
    if (loginSession?.mode === 'new-user' && typeof window !== 'undefined') {
      window.localStorage.setItem(getTutorialStageStorageKey(loginSession.player.id), nextStage);
    }
  };

  const completePendingShareInviteTutorial = async (): Promise<void> => {
    const campaignId = pendingShareInvite?.campaignId ?? pendingFriendInvite?.campaignId;
    if (!campaignId || !loginSession || loginSession.mode !== 'new-user') {
      return;
    }

    const invite = pendingShareInvite;
    const friendInvite = pendingFriendInvite;
    setPendingShareInvite(null);

    try {
      const result = await completeShareInviteTutorial({
        campaignId,
        helperOpenidHash: invite?.helperOpenidHash,
        helperDeviceHash: invite?.helperDeviceHash,
      });
      if (result.rewarded) {
        setPendingFriendInvite(null);
        if (friendInvite) {
          setPendingFriendInvite({
            ...friendInvite,
            boundFriend: true,
            notificationId: result.notificationId,
          });
        }
        showToast(result.summary, 'success');
        await notifications.refreshUnreadCount();
      } else {
        setPendingFriendInvite(null);
      }
    } catch (error) {
      setPendingFriendInvite(null);
      showToast(error instanceof Error && error.message ? error.message : '当前无法绑定助力奖励，请稍后在通知中查看。', 'error');
    }
  };

  const runTutorialFlowActions = (actions: TutorialFlowAction[]): void => {
    actions.forEach((action) => {
      if (action.type === 'setStage') {
        advanceTutorialStage(action.stage);
        if (action.stage === 'completed') {
          void completePendingShareInviteTutorial();
        }
        return;
      }

      if (action.type === 'navigate') {
        setActiveScene(action.scene);
        if (action.raidHubTab) {
          setRaidHubTab(action.raidHubTab);
        }
        if (action.factionTab) {
          setFactionTab(action.factionTab);
        }
        return;
      }

      if (action.type === 'dialog') {
        window.setTimeout(() => {
          playDialogScene(action.sceneId, {
            force: action.force ?? true,
            onComplete: action.onCompleteActions
              ? () => runTutorialFlowActions(action.onCompleteActions ?? [])
              : undefined,
          });
        }, action.delayMs ?? 0);
        return;
      }

      setGlobalUnlockModal({
        ...action.modal,
        afterConfirmActions: action.afterConfirmActions,
      });
    });
  };

  const patchRaidTargetPreview = (
    targetId: string,
    mainPetPreview: ClientRaidTarget['mainPetPreview'],
  ): void => {
    raidIntel.patchCachedPreview(targetId, mainPetPreview);
    setViewModel((current) => patchRaidTargetPreviewInViewModel(current, targetId, mainPetPreview));
  };

  const syncSeedBackpackState = (backpack: ClientViewModel['bootstrap']['backpack']): void => {
    const nextState = buildSeedBackpackState({
      backpack,
      currentSelectedSeedId: selectedSeedId,
    });

    setSeedInventory(nextState.seedInventory);
    setGlobalItemInventory(nextState.globalItemInventory);
    setUnlockedSeedIds(nextState.unlockedSeedIds);
    setPlantResearchState(nextState.plantResearchState);
    setSelectedSeedId(nextState.selectedSeedId);
  };

  const applySpiritState = (nextSpiritState: ClientSpiritState): void => {
    setSpiritState(nextSpiritState);
    setGlobalItemInventory((current) => syncTianjiTalismanInInventory(current, nextSpiritState.tianjiTalisman));
  };

  const applyTianjiTalismanState = (input: { resourceVersion: number; tianjiTalisman: number }): void => {
    setGlobalItemInventory((current) => syncTianjiTalismanInInventory(current, input.tianjiTalisman));
    setSpiritState((current) => applyTianjiTalismanToSpiritState(current, input));
  };

  const applyClientViewModel = (data: ClientViewModel): void => {
    setViewModel(data);
    raidIntel.setSelectedTargetId(data.scenes.raid.targets[0]?.id ?? '');
    syncSeedBackpackState(data.bootstrap.backpack);
  };

  const applyClientBundle = (data: { viewModel: ClientViewModel; spirit: ClientSpiritState; farmBoard: ClientFarmBoardState; seasonSignIn: ClientSeasonSignInState }): void => {
    applyClientViewModel(data.viewModel);
    setSeasonSignInState(data.seasonSignIn);
    applySpiritState(data.spirit);
    setFarmBoard(data.farmBoard);
  };

  const handleOpenNotificationClaim = (notificationId: string): void => {
    const notification = notifications.list?.items.find((item) => item.id === notificationId);
    if (!notification || notification.attachments.length <= 0) {
      showToast('这条通知没有可领取附件。', 'error');
      return;
    }

    notifications.close();
    setSeedRewardModal(buildNotificationClaimRewardModal(notification));
  };

  const handleConfirmNotificationClaim = async (): Promise<void> => {
    const notificationId = seedRewardModal?.notificationId;
    if (!notificationId) {
      setSeedRewardModal(null);
      return;
    }

    try {
      const result = await notifications.claim(notificationId);
      const [nextViewModel, nextSpirit] = await Promise.all([
        loadClientViewModel(),
        loadSpiritState(),
      ]);

      setViewModel(nextViewModel);
      syncSeedBackpackState(nextViewModel.bootstrap.backpack);
      applySpiritState(nextSpirit);
      setSeedRewardModal(null);
      showToast(result.summary, 'success');
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : '当前无法领取附件，请稍后重试。', 'error');
    }
  };

  const loadClientBundle = async (): Promise<{ viewModel: ClientViewModel; spirit: ClientSpiritState; farmBoard: ClientFarmBoardState; seasonSignIn: ClientSeasonSignInState }> => {
    const [nextViewModel, nextSpirit, nextFarmBoard, nextSeasonSignIn] = await Promise.all([
      loadClientViewModel(),
      loadSpiritState(),
      loadFarmBoard(),
      loadSeasonSignIn(),
    ]);

    return {
      viewModel: nextViewModel,
      spirit: nextSpirit,
      farmBoard: nextFarmBoard,
      seasonSignIn: nextSeasonSignIn,
    };
  };

  const handleDevLogin = async (mode: DevLoginMode, options?: { factionCode?: DevFactionChoice }): Promise<void> => {
    setLoginLoadingMode(mode);
    setLoginError(null);

    try {
      const session = await devLogin(mode, options);
      const data = await loadClientBundle();
      setTutorialStage(getInitialTutorialStage(session));
      setLoginSession(session);
      applyClientBundle(data);
    } catch {
      setLoginError('无法连接开发登录接口，请确认后端已启动，并且 VITE_API_BASE_URL 指向正确地址。');
    } finally {
      setLoginLoadingMode(null);
    }
  };

  const handleShareAssistSuccessExit = async (audience: ShareAssistAudience): Promise<void> => {
    setShareAssistDemo(null);

    if (audience === 'new-user') {
      setAuthScreen('faction-select');
      return;
    }

    await handleDevLogin('existing-user');
  };

  const handleOpenShareAssistDemo = async (audience: ShareAssistAudience): Promise<void> => {
    if (pendingActionKey === 'share-assist:create') {
      return;
    }

    setPendingActionKey('share-assist:create');
    setLoginError(null);

    try {
      let ownerSession = getStoredDevLoginSession();
      if (!ownerSession) {
        ownerSession = await devLogin('existing-user');
      }

      const created = await createShareAssistCampaign({ campaignType: 'water' });
      const publicCampaign = await loadPublicShareAssistCampaign(created.campaign.id);
      setShareAssistDemo(buildShareAssistDemoState({
        audience,
        campaign: publicCampaign,
        campaignId: created.campaign.id,
        kind: 'water',
      }));
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '当前无法创建浇水助力链接，请稍后重试。';
      setLoginError(message);
    } finally {
      setPendingActionKey(null);
    }
  };

  const openFriendInviteCampaign = async (campaignId: string, audience: ShareAssistAudience): Promise<void> => {
    setLoginError(null);

    try {
      const publicCampaign = await loadPublicShareAssistCampaign(campaignId);
      const owner = publicCampaign.campaign.owner;

      if (audience === 'new-user') {
        setShareAssistDemo(buildShareAssistDemoState({
          audience,
          campaign: publicCampaign,
          campaignId,
          kind: 'friend_invite',
        }));
        return;
      }

      const helperSession = await devLogin('test-user-1');
      const data = await loadClientBundle();
      setTutorialStage(getInitialTutorialStage(helperSession));
      setLoginSession(helperSession);
      applyClientBundle(data);
      setReturningFriendInvitePrompt({
        campaignId,
        inviterName: owner.nickname,
        inviterFactionName: owner.factionName ?? '未知阵营',
        helperPlayerId: helperSession.player.id,
      });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '当前无法读取好友邀请，请稍后重试。';
      setLoginError(message);
      showToast(message, 'error');
    }
  };

  const handleCreateFriendInvite = async (): Promise<void> => {
    if (pendingActionKey === 'friend-invite:create') {
      return;
    }

    setPendingActionKey('friend-invite:create');
    setLoginError(null);

    try {
      const created = await createShareAssistCampaign({ campaignType: 'friend_invite' });
      const origin = typeof window === 'undefined' ? 'http://localhost:5175' : window.location.origin;
      const inviteLinks = buildFriendInviteDemoLinks({
        campaignId: created.campaign.id,
        origin,
      });
      setFriendInviteDemoLinks(inviteLinks);
      setFriendInviteNewUserUrlInput(inviteLinks.newUser);
      setFriendInviteReturningUserUrlInput(inviteLinks.returningUser);
      showToast(`${created.campaign.owner.nickname}的好友邀请已生成。你可以复制 URL 或直接打开模拟入口。`, 'success');
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '当前无法生成好友邀请，请稍后重试。';
      setLoginError(message);
      showToast(message, 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const copyFriendInviteUrl = async (url: string): Promise<void> => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      showToast('当前浏览器不支持自动复制，请手动复制显示的 URL。', 'info');
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast('模拟邀请链接已复制。', 'success');
    } catch {
      showToast('复制失败，请手动复制显示的 URL。', 'error');
    }
  };

  const handleSubmitFriendInviteUrl = (url: string, audience: ShareAssistAudience): void => {
    const campaignId = readCampaignIdFromFriendInviteUrl(url.trim());
    if (!campaignId) {
      showToast('请粘贴有效的好友邀请 URL。', 'error');
      return;
    }

    void openFriendInviteCampaign(campaignId, audience);
  };

  const handleConfirmReturningFriendInvite = async (): Promise<void> => {
    if (!returningFriendInvitePrompt || pendingActionKey === 'friend-invite:returning-confirm') {
      return;
    }

    setPendingActionKey('friend-invite:returning-confirm');

    try {
      const result = await confirmPublicShareAssist(returningFriendInvitePrompt.campaignId, {
        audience: 'returning-user',
        helperPlayerId: returningFriendInvitePrompt.helperPlayerId,
      });
      const data = await loadClientBundle();
      applyClientBundle(data);
      setReturningFriendInvitePrompt(null);
      await Promise.all([
        social.loadBundle(),
        notifications.refreshUnreadCount(),
      ]);
      showToast(result.summary, 'success');
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : '当前无法确认好友邀请，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleRejectReturningFriendInvite = (): void => {
    setReturningFriendInvitePrompt(null);
    showToast('已拒绝好友邀请，未建立好友关系。', 'info');
  };

  const handleConfirmShareAssistDemo = async (): Promise<void> => {
    if (!shareAssistDemo || pendingActionKey === 'share-assist:confirm') {
      return;
    }

    setPendingActionKey('share-assist:confirm');
    setShareAssistDemo((current) => current ? { ...current, error: null } : current);

    try {
      let helperPlayerId: string | undefined;
      if (shareAssistDemo.audience === 'returning-user') {
        const helperSession = await devLogin('test-user-2');
        helperPlayerId = helperSession.player.id;
      }

      const helperOpenidHash = shareAssistDemo.audience === 'new-user' ? `dev-new-user-${shareAssistDemo.campaignId}` : undefined;
      const helperDeviceHash = shareAssistDemo.audience === 'new-user' ? `dev-device-${shareAssistDemo.campaignId}` : undefined;
      const result = await confirmPublicShareAssist(shareAssistDemo.campaignId, {
        audience: shareAssistDemo.audience,
        helperPlayerId,
        helperOpenidHash,
        helperDeviceHash,
      });

      if (shareAssistDemo.audience === 'new-user' && result.invitePending && helperOpenidHash && helperDeviceHash) {
        if (shareAssistDemo.kind === 'friend_invite') {
          const owner = result.campaign.owner;
          const inviterFactionName = owner.factionName ?? FRIEND_INVITE_DEMO_INVITER.factionName;
          const inviterFactionCode = factionCodeByName[inviterFactionName] ?? FRIEND_INVITE_DEMO_INVITER.factionCode;
          setPendingFriendInvite({
            campaignId: shareAssistDemo.campaignId,
            inviterName: owner.nickname,
            inviterFactionCode,
            inviterFactionName,
          });
          setPendingNewUserFaction(inviterFactionCode);
        } else {
          setPendingShareInvite({
            campaignId: shareAssistDemo.campaignId,
            helperOpenidHash,
            helperDeviceHash,
          });
        }
      }

      setShareAssistDemo((current) => applyShareAssistConfirmResultToDemoState(current, result));
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '当前无法完成微信助力，请稍后重试。';
      setShareAssistDemo((current) => current ? { ...current, error: message } : current);
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleSwitchDevUser = (): void => {
    setSettingsOpen(false);
    clearDevLoginSession();
    setLoginSession(null);
    setTutorialStage('completed');
    setSeasonSignInState(null);
    setViewModel(null);
    setSpiritState(null);
    setFarmBoard(null);
    setFarmBoardEditor(null);
    setActiveScene('home');
    setRaidHubTab('targets');
    setFactionTab('overview');
    setSocialTab('feed');
    setSocialRelationFilter('all');
    raidIntel.reset();
    setSeedRewardModal(null);
    setSeedSelectionState(null);
    setSeedCodexState(null);
    setShareAssistDemo(null);
    setPendingShareInvite(null);
    setPendingFriendInvite(null);
    setReturningFriendInvitePrompt(null);
    setFriendInviteDemoLinks(null);
    setFriendInviteNewUserUrlInput('');
    setFriendInviteReturningUserUrlInput('');
    setFarmCollectPresentation(null);
    setGlobalFeatureModal(null);
    setGlobalUnlockModal(null);
    setPendingActionKey(null);
    setAuthScreen('account-select');
    notifications.reset();
    social.reset();
    setLoginError(null);
    welcomeDialogSessionIdRef.current = null;
    farmEnterDialogRef.current = null;
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && !loginSession) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('invite') === 'friend') {
        const campaignId = params.get('campaignId');
        const audience = params.get('audience') === 'returning-user' ? 'returning-user' : 'new-user';
        if (campaignId) {
          void openFriendInviteCampaign(campaignId, audience);
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    }
  }, [loginSession]);

  useEffect(() => {
    if (!loginSession) {
      return;
    }

    let active = true;

    void loadClientBundle().then((data) => {
      if (!active) {
        return;
      }

      applyClientBundle(data);
    }).catch(() => {
      if (!active) {
        return;
      }

      clearDevLoginSession();
      setLoginSession(null);
      setTutorialStage('completed');
      setSpiritState(null);
      setAuthScreen('account-select');
      setLoginError('登录已失效或真实接口不可用，请重新选择测试账号。');
    });

    return () => {
      active = false;
    };
  }, [loginSession]);

  useEffect(() => {
    if (!canOpenSceneInTutorial(activeScene, tutorialStage)) {
      setActiveScene('home');
    }
  }, [activeScene, tutorialStage]);

  useEffect(() => {
    if (!loginSession) {
      social.reset();
      return;
    }

    void social.loadBundle();
  }, [loginSession]);

  useEffect(() => {
    if (!loginSession || activeScene !== 'social') {
      return;
    }

    void social.loadBundle();
  }, [activeScene, loginSession]);

  useEffect(() => {
    if (!loginSession) {
      notifications.reset();
      return;
    }

    void notifications.refreshUnreadCount();
  }, [loginSession]);

  useEffect(() => {
    if (!loginSession) {
      return;
    }

    let active = true;
    let timer: number | null = null;

    const scheduleNextRefresh = (): void => {
      timer = window.setTimeout(() => {
        void loadClientBundle().then((data) => {
          if (!active) {
            return;
          }

          applyClientBundle(data);
          scheduleNextRefresh();
        }).catch(() => {
          if (!active) {
            return;
          }

          scheduleNextRefresh();
        });
      }, getMillisecondsUntilNextChinaMidnight());
    };

    scheduleNextRefresh();

    return () => {
      active = false;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [loginSession]);

  useEffect(() => {
    if (!loginSession || !viewModel) {
      return;
    }

    if (welcomeDialogSessionIdRef.current === loginSession.player.id) {
      return;
    }

    if (loginSession.mode === 'new-user') {
      return;
    }

    welcomeDialogSessionIdRef.current = loginSession.player.id;
    playDialogScene('home.welcome.fox');
  }, [loginSession, playDialogScene, tutorialStage, viewModel]);

  useEffect(() => {
    if (activeScene !== 'farm' || !viewModel) {
      return;
    }

    const ripeField = viewModel.scenes.farm.fields.find((field) => field.tone === 'mature' || field.tone === 'withered');
    if (!ripeField) {
      return;
    }

    const now = Date.now();
    const lastShown = farmEnterDialogRef.current;
    if (lastShown && lastShown.sceneId === 'farm.enter.ripe-crop' && now - lastShown.at < 120000) {
      return;
    }

    const shown = playDialogScene('farm.enter.ripe-crop');
    if (shown) {
      farmEnterDialogRef.current = { sceneId: 'farm.enter.ripe-crop', at: now };
    }
  }, [activeScene, playDialogScene, viewModel]);

  useEffect(() => {
    if (!viewModel) {
      return;
    }

    setFarmTick(0);

    const timer = window.setInterval(() => {
      setFarmTick((currentTick) => currentTick + 1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [viewModel]);

  useEffect(() => {
    if (!farmCollectPresentation) {
      return;
    }

    const timer = window.setTimeout(() => {
      setFarmCollectPresentation((current) => current?.fieldId === farmCollectPresentation.fieldId ? null : current);
    }, FARM_COLLECT_PRESENTATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [farmCollectPresentation]);

  useEffect(() => {
    const queue = viewModel?.scenes.army.queue;

    if (!queue) {
      setArmyQueueRefreshReadyAt(null);
      return;
    }

    const readyAt = queue.readyAt;
    if (Date.now() < new Date(readyAt).getTime() || armyQueueRefreshReadyAt === readyAt) {
      return;
    }

    let active = true;
    setArmyQueueRefreshReadyAt(readyAt);

    void loadClientViewModel().then((data) => {
      if (!active) {
        return;
      }

      setViewModel(data);
    }).catch(() => {
      if (!active) {
        return;
      }

      setArmyQueueRefreshReadyAt(null);
    });

    return () => {
      active = false;
    };
  }, [armyQueueRefreshReadyAt, farmTick, viewModel]);

  if (!viewModel || !spiritState) {
    if (shareAssistDemo) {
      return (
        <CharacterDialogProvider controller={characterDialog} portalTarget={characterDialogPortalRef.current}>
          <ShareAssistDemoScreen
            demo={shareAssistDemo}
            onBack={() => setShareAssistDemo(null)}
            onConfirm={() => {
              void handleConfirmShareAssistDemo();
            }}
            onSuccessExit={(audience) => {
              void handleShareAssistSuccessExit(audience);
            }}
          />
        </CharacterDialogProvider>
      );
    }

    if (!loginSession) {
      return (
        <>
          <AuthEntryScreen
            authScreen={authScreen}
            friendInviteNewUserUrlInput={friendInviteNewUserUrlInput}
            friendInviteReturningUserUrlInput={friendInviteReturningUserUrlInput}
            loginError={loginError}
            loginLoadingMode={loginLoadingMode}
            pendingActionKey={pendingActionKey}
            pendingFriendInvite={pendingFriendInvite}
            pendingNewUserFaction={pendingNewUserFaction}
            toast={toast}
            onChangeAuthScreen={setAuthScreen}
            onChangeFriendInviteNewUserUrlInput={setFriendInviteNewUserUrlInput}
            onChangeFriendInviteReturningUserUrlInput={setFriendInviteReturningUserUrlInput}
            onChangePendingNewUserFaction={setPendingNewUserFaction}
            onDevLogin={(mode, options) => {
              void handleDevLogin(mode, options);
            }}
            onOpenBattleDemo={handleOpenBattleDemo}
            onOpenShareAssistDemo={(audience) => {
              void handleOpenShareAssistDemo(audience);
            }}
            onSubmitFriendInviteUrl={handleSubmitFriendInviteUrl}
          />
            {raidBattleReplay ? (
              <RaidBattleScreen
                autoStart={raidBattleAutoStart}
                onComplete={() => {
                  setRaidBattleReplay(null);
                  setRaidBattleAutoStart(true);
                }}
                replay={raidBattleReplay}
              />
            ) : null}
        </>
      );
    }

    return <LoadingScreen />;
  }

  const { home, scenes } = viewModel;
  const {
    activeBackgroundImage,
    backpackResourceItems,
    currentAccountName,
    devLoginModeLabel,
    farmFields,
    firstVisibleUnlockedSeedId,
    isTutorialUser,
    mergedReportEntries,
    raidBattleLimit,
    raidBattleUsed,
    raidTargetsById,
    seasonProgress,
    seasonSignInClaimedToday,
    seasonSignInDays,
    seasonSignInMilestones,
    seasonSignInRecord,
    seasonSignInTodayReward,
    seedCatalogMap,
    seedGroups,
    selectedRaidTarget,
    selectedSeedCodexItem,
    spiritStableFull,
    tianjiTalismanCount,
    topSpiritCodexSelectedId,
    tutorialTask,
    tutorialUiRules,
    vaultProgress,
    visibleRaidTargets,
  } = buildAppDerivedState({
    activeScene,
    farmTick,
    fieldSeedAssignments,
    globalItemInventory,
    loginSession,
    plantResearchState,
    seasonSignInState,
    seedCodexState,
    seedInventory,
    selectedRaidTargetId: raidIntel.selectedTargetId,
    spiritState,
    topSpiritCodexSpiritId,
    tutorialStage,
    unlockedSeedIds,
    viewModel,
  });

  const runPendingAction = async (actionKey: string, action: () => Promise<void>): Promise<void> => {
    if (pendingActionKey === actionKey) {
      return;
    }

    setPendingActionKey(actionKey);

    try {
      await action();
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleSetMainSpiritAction = async (slotIndex: number, slotVersion: number): Promise<void> => {
    await runPendingAction(`spirit:set-main:${slotIndex}`, async () => {
      try {
        const result = await setMainSpirit({
          slotIndex,
          slotVersion,
        });
        applySpiritMutationResult(result);
      } catch {
        showToast('当前无法切换主位灵宠，请稍后重试。', 'error');
      }
    });
  };

  const handleRecoverSpiritAction = async (slotIndex: number, slotVersion: number): Promise<void> => {
    if (!spiritState) {
      return;
    }

    await runPendingAction(`spirit:recover:${slotIndex}`, async () => {
      try {
        const result = await recoverSpirit({
          slotIndex,
          slotVersion,
          resourceVersion: spiritState.resourceVersion,
        });
        applySpiritMutationResult(result);
      } catch {
        showToast('当前无法恢复灵宠，请稍后重试。', 'error');
      }
    });
  };

  const handleDissolveSpiritAction = async (slotIndex: number, slotVersion: number): Promise<void> => {
    await runPendingAction(`spirit:dissolve:${slotIndex}`, async () => {
      try {
        const result = await dissolveSpirit({
          slotIndex,
          slotVersion,
        });
        applySpiritMutationResult(result);
      } catch {
        showToast('当前无法解散灵宠，请稍后重试。', 'error');
      }
    });
  };

  const handleComposeSpiritAction = async (spiritId: string, slotIndex: number, element: ClientSpiritElement): Promise<void> => {
    await runPendingAction(`spirit:compose:${slotIndex}`, async () => {
      try {
        const result = await composeSpirit({
          spiritId,
          slotIndex,
          element,
        });
        applySpiritMutationResult(result);
        if (tutorialStage === 'spirit') {
          setGlobalUnlockModal(buildSpiritComposeUnlockModal({
            afterConfirmActions: getTutorialFlowActions('spiritAwardConfirmed'),
            element,
            slotIndex,
            spirit: result.spirit,
            spiritId,
          }));
        }
      } catch {
        showToast('当前无法合成灵宠，请稍后重试。', 'error');
      }
    });
  };

  const handleFactionDonate = async (goldAmount: number): Promise<void> => {
    if (pendingActionKey === 'faction:donate') {
      return;
    }

    const input: ClientFactionDonateRequest = {
      goldAmount,
    };

    setPendingActionKey('faction:donate');

    try {
      const result = await donateFactionResources(input);
      applyMutationResult(result);
    } catch {
      showToast('当前无法完成阵营上缴，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
  };


  const handleUnlockPlant = async (plantId: string): Promise<void> => {
    const actionKey = `plant-unlock:${plantId}`;
    if (pendingActionKey === actionKey) {
      return;
    }

    setPendingActionKey(actionKey);
    try {
      const result = await unlockPlant({ plantType: plantId });
      applyMutationResult(result);
      syncSeedBackpackState(result.bootstrap.backpack);
      showToast(result.summary, 'success');
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '当前无法解锁灵植，请稍后重试。';
      showToast(message, 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleFeedSpiritAction = async (slotIndex: number, slotVersion: number, actionType: 'feed_once' | 'fill_full'): Promise<void> => {
    const actionKey = `spirit:feed:${slotIndex}:${actionType}`;
    if (!spiritState) {
      return;
    }

    await runPendingAction(actionKey, async () => {
      try {
        const result = await feedSpirit({
          slotIndex,
          actionType,
          slotVersion,
          resourceVersion: spiritState.resourceVersion,
        });
        applySpiritMutationResult(result);
        showToast(result.summary, 'success');
      } catch {
        showToast('当前无法投喂灵宠，请稍后重试。', 'error');
      }
    });
  };

  const handleBreakthroughSpiritAction = async (slotIndex: number, slotVersion: number, targetStage?: number): Promise<void> => {
    const actionKey = `spirit:breakthrough:${slotIndex}`;
    if (!spiritState) {
      return;
    }

    await runPendingAction(actionKey, async () => {
      try {
        const result = await breakthroughSpirit({
          slotIndex,
          targetStage,
          slotVersion,
          resourceVersion: spiritState.resourceVersion,
        });
        applySpiritMutationResult(result);
        showToast(result.summary, 'success');
      } catch (error) {
        if (error instanceof ApiError && error.code === 'STATE_VERSION_CONFLICT') {
          const nextSpirit = await loadSpiritState().catch(() => null);
          if (nextSpirit) {
            applySpiritState(nextSpirit);
          }
          showToast('灵宠状态刚刚发生变化，已刷新数据。请重新点击突破。', 'error');
        } else if (error instanceof ApiError && error.code === 'CONFLICT') {
          showToast('当前兽魂不足，暂时无法突破。', 'error');
        } else if (error instanceof ApiError && error.message) {
          showToast(error.message, 'error');
        } else {
          showToast('当前无法突破灵宠，请确认兽魂是否足够。', 'error');
        }
      }
    });
  };

  const handleRollSpiritTraitsAction = async (
    slotIndex: number,
    slotVersion: number,
    mode: ClientSpiritRollMode,
    options: { lockedSlotIndex?: number; targetSlotIndex?: number; targetTraitCode?: ClientSpiritTraitCode } = {},
  ): Promise<void> => {
    const actionKey = `spirit:roll:${slotIndex}:${mode}`;
    if (!spiritState) {
      return;
    }

    await runPendingAction(actionKey, async () => {
      try {
        const result = await rollSpiritTraits({
          slotIndex,
          mode,
          ...options,
          slotVersion,
          walletVersion: home.stateVersions.walletVersion,
          resourceVersion: spiritState.resourceVersion,
        });
        applySpiritMutationResult(result);
        showToast(result.summary, 'success');
      } catch {
        showToast('当前无法洗练词条，请确认材料是否足够。', 'error');
      }
    });
  };

  const handleBuySpiritShopItemAction = async (itemId: string): Promise<void> => {
    const actionKey = `spirit:shop:${itemId}`;
    if (!spiritState) {
      return;
    }

    await runPendingAction(actionKey, async () => {
      try {
        const result = await buySpiritShopItem({
          itemId,
          resourceVersion: spiritState.resourceVersion,
        });
        applySpiritMutationResult(result);
        showToast(result.summary, 'success');
      } catch {
        showToast('当前无法兑换商品，请确认天机符或限购次数。', 'error');
      }
    });
  };

  const handleClaimSeasonSignIn = async (): Promise<void> => {
    const actionKey = 'season:sign-in';
    if (!loginSession || seasonSignInClaimedToday || pendingActionKey === actionKey) {
      return;
    }

    setPendingActionKey(actionKey);
    try {
      const result = await claimSeasonSignIn();
      setSeasonSignInState(result.signIn);
      applyTianjiTalismanState({
        resourceVersion: result.resourceVersion,
        tianjiTalisman: result.tianjiTalisman,
      });
      showToast(result.summary, 'success');
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : '当前无法完成赛季签到，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleClaimSpiritAdRewardAction = async (): Promise<void> => {
    const actionKey = 'spirit:ad-reward';
    const usedToday = spiritState?.shop?.adReward.usedToday ?? 0;
    const dailyLimit = spiritState?.shop?.adReward.dailyLimit ?? 0;

    if (!spiritState || usedToday >= dailyLimit) {
      return;
    }

    await runPendingAction(actionKey, async () => {
      try {
        const result = await claimSpiritAdReward({
          resourceVersion: spiritState.resourceVersion,
        });
        applySpiritMutationResult(result);
        showToast(result.summary, 'success');
      } catch (error) {
        showToast(error instanceof Error && error.message ? error.message : '当前无法领取广告奖励，可能今日次数已用完。', 'error');
      }
    });
  };

  const handleClaimFactionStipend = (): void => {
    const stipend = scenes.faction.stipend;

    if (!stipend || stipend.status !== 'available') {
      return;
    }

    setSeedRewardModal({
      title: '领取阵营俸禄',
      summary: `当前贡献 ${formatNumber(stipend.contribution)}，档位：${stipend.tierLabel}。确认后将以下奖励入账。`,
      confirmAction: 'claim-faction-stipend',
      items: stipend.rewards.map((reward) => ({
        seedId: reward.seedId,
        itemId: reward.kind,
        label: reward.label,
        quantity: reward.quantity,
      })),
    });
  };

  const handleTransferFaction = (factionName: string): void => {
    showToast(`转阵营到${factionName}的功能待定，当前先保留入口。`);
  };

  const handleConfirmFactionStipendClaim = async (): Promise<void> => {
    if (!seedRewardModal || seedRewardModal.confirmAction !== 'claim-faction-stipend') {
      return;
    }

    if (pendingActionKey === 'faction:stipend') {
      return;
    }

    setPendingActionKey('faction:stipend');

    try {
      const result = await claimFactionStipend({
        walletVersion: home.stateVersions.walletVersion,
      });
      applyMutationResult(result);
      if (result.bootstrap?.backpack) {
        syncSeedBackpackState(result.bootstrap.backpack);
      }
      setGlobalItemInventory((current) => applyFactionStipendSoulRewards(current, result.rewards));
      setSeedRewardModal(null);
      showToast(
        tutorialStage === 'faction'
          ? '阵营俸禄已领取，奖励已入库。'
          : result.summary,
        'success',
      );
      if (tutorialStage === 'faction') {
        runTutorialFlowActions(getTutorialFlowActions('factionStipendClaimed'));
      }
    } catch {
      showToast('当前无法领取阵营俸禄，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleResetDemoState = async (): Promise<void> => {
    if (pendingActionKey === 'system:reset-demo-state') {
      return;
    }

    setPendingActionKey('system:reset-demo-state');

    try {
      const result = await resetDemoExperimentState();
      const nextSpiritState = await loadSpiritState();
      setViewModel((current) => applyClientViewModelScenePatch(current, result));
      setSpiritState(nextSpiritState);

      showToast(result.summary, 'success');
      setActiveScene('home');
      setRaidHubTab('targets');
      setFactionTab('overview');
      setSeedInventory(emptySeedInventory);
      setGlobalItemInventory(emptyGlobalItemInventory);
      setUnlockedSeedIds(defaultUnlockedSeedIds);
      setSeedRewardModal(null);
      farmEnterDialogRef.current = null;
      setArmyQueueRefreshReadyAt(null);
      setSeedSelectionState(null);
      setSelectedSeedId(getPreferredSeedId({
        seedInventory: emptySeedInventory,
        tutorialStarterSeedId: TUTORIAL_STARTER_SEED_ID,
        unlockedSeedIds: defaultUnlockedSeedIds,
      }));
      setFieldSeedAssignments({});
      setFarmCollectPresentation(null);
      raidIntel.reset();
    } catch {
      showToast('当前无法重置实验数据，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleRefreshRaidTargets = async (): Promise<void> => {
    if (pendingActionKey === 'raid:refresh-targets') {
      return;
    }

    setPendingActionKey('raid:refresh-targets');

    try {
      const result = await refreshRaidTargets();
      setViewModel((current) => applyClientViewModelScenePatch(current, result));
      raidIntel.setSelectedTargetId(result.scenes.raid.targets[0]?.id ?? '');
      raidIntel.clearDetails();
      showToast(result.summary || '目标列表已刷新，可以重新挑选战斗对象。', 'success');
    } catch {
      showToast('当前无法刷新目标列表，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const findRaidTargetByContext = (context?: string): ClientRaidTarget | null => {
    return resolveRaidTargetByContext(scenes.raid.targets, context);
  };

  const applyMutationResult = (result: { home: HomeSummaryResponse; scenes: ClientViewModel['scenes']; summary: string }): void => {
    setViewModel((current) => applyClientViewModelScenePatch(current, result));

    showToast(result.summary, 'success');
  };

  const applySpiritMutationResult = (result: { home: HomeSummaryResponse; scenes: ClientViewModel['scenes']; spirit: ClientSpiritState; summary: string }): void => {
    applyMutationResult(result);
    applySpiritState(result.spirit);
  };

  const applyLocalTianjiSpend = (costText: string): void => {
    const tianjiCost = parseTianjiCostText(costText);
    if (tianjiCost <= 0) {
      return;
    }

    setSpiritState((currentSpiritState) => spendLocalTianjiTalisman({
      cost: tianjiCost,
      globalItemInventory,
      spiritState: currentSpiritState,
    }).spiritState);
    setGlobalItemInventory((currentGlobalItemInventory) => (
      spendLocalTianjiTalisman({
        cost: tianjiCost,
        globalItemInventory: currentGlobalItemInventory,
        spiritState: null,
      }).globalItemInventory
    ));
  };

  const navigateToScene = (scene: ClientSceneKey, nextRaidHubTab?: RaidHubTabKey): void => {
    if (!canOpenSceneInTutorial(scene, tutorialStage)) {
      showToast(getLockedSceneMessage(scene), 'info');
      return;
    }

    setActiveScene(scene);

    if (scene === 'report' && nextRaidHubTab) {
      setRaidHubTab(nextRaidHubTab);
    }

    if (scene !== 'report' && nextRaidHubTab) {
      setRaidHubTab(nextRaidHubTab);
    }
  };

  const handleConfirmStarterSeedClaim = async (): Promise<void> => {
    if (pendingActionKey === 'tutorial:starter-seeds') {
      return;
    }
    if (!viewModel) {
      return;
    }

    setPendingActionKey('tutorial:starter-seeds');
    try {
      const result = await claimStarterSeeds({
        requestIdempotencyKey: `starter-seeds-${Date.now()}`,
      });
      setSeedRewardModal(null);
      applyClientViewModel({
        ...viewModel,
        bootstrap: result.bootstrap,
        home: result.home,
        scenes: result.scenes,
      });
      showToast(result.summary, 'success');
      runTutorialFlowActions(getTutorialFlowActions('starterSeedsClaimed'));
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '当前无法领取启灵芽，请稍后重试。';
      showToast(message, 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleTutorialTaskAction = (): void => {
    const task = buildTutorialTask(tutorialStage);
    if (!task) {
      return;
    }

    if (tutorialStage === 'home') {
      setSeedRewardModal({
        title: '领取启灵芽',
        summary: '引导者交付启灵芽 x1。确认后会开放第一块田的可种植资格。',
        confirmAction: 'claim-starter-seeds',
        items: [
          {
            seedId: 'qilingya',
            label: '启灵芽',
            quantity: 1,
          },
        ],
      });
      return;
    }

    if (tutorialStage === 'farm') {
      setActiveScene('farm');
      return;
    }

    if (tutorialStage === 'spirit') {
      setActiveScene('raid');
      return;
    }

    if (tutorialStage === 'raid') {
      setActiveScene('report');
      setRaidHubTab('targets');
      return;
    }

    if (tutorialStage === 'faction') {
      setActiveScene('faction');
      setFactionTab('overview');
      return;
    }

  };

  const handleBuildingAction = async (action: ClientSceneAction, upgradeId: ClientBuildingUpgradeId | ClientCastleExtensionUpgradeId, context: string, targetType: ClientUpgradeTargetType, costText: string): Promise<void> => {
    if (action.label.includes('升级') || action.label.includes('修习')) {
      const actionKey = `${targetType}:${upgradeId}`;
      if (pendingActionKey === actionKey) {
        return;
      }

      setPendingActionKey(actionKey);

      try {
        const result = await upgradeClientBuilding(buildUpgradeRequest(targetType, upgradeId, home.stateVersions.buildingVersion, home.stateVersions.walletVersion));
        applyMutationResult(result);
        applyLocalTianjiSpend(costText);
      } catch {
        showToast(`${context} 当前修习失败，请稍后重试。`, 'error');
      } finally {
        setPendingActionKey(null);
      }
      return;
    }

    handleSceneAction(action, context);
  };

  const handleFarmAction = async (action: ClientSceneAction, fieldId: string, context: string): Promise<void> => {
    const actionKey = `farm:${fieldId}:${action.label}`;
    if (pendingActionKey === actionKey) {
      return;
    }

    const field = farmFields.find((item) => item.id === fieldId) as (typeof farmFields[number] & { fieldVersionOffset?: number }) | undefined;
    const isStartCultivationAction = action.label === '开始培育' || (action.target === 'farm' && field?.tone === 'empty');
    const isCollectAction = action.label.includes('收取') || (action.target === 'farm' && (field?.tone === 'mature' || field?.tone === 'withered'));

    if (isStartCultivationAction) {
      setSelectedSeedId(getPreferredSeedId({
        seedInventory,
        tutorialStarterSeedId: TUTORIAL_STARTER_SEED_ID,
        unlockedSeedIds,
      }));
      if (tutorialStage === 'farm') {
        void handleStartCultivation(fieldId, context, TUTORIAL_STARTER_SEED_ID);
        return;
      }

      if (isTutorialUser) {
        showToast('先完成阵营俸禄领取，之后就可以自由安排基础种植。', 'info');
        if (tutorialStage === 'faction') {
          setActiveScene('faction');
          setFactionTab('overview');
        }
        return;
      }

      setSeedSelectionState({
        fieldId,
        fieldCode: context,
      });
      return;
    }

    if (isCollectAction) {
      const collectMode: ClientCollectFieldRequest['collectMode'] = 'ripe';

      setPendingActionKey(actionKey);

      try {
        const result: ClientCollectFieldResponse = await collectFieldEarnings({
          fieldId,
          collectMode,
          fieldVersion: (field?.fieldVersion ?? 1) + (field?.fieldVersionOffset ?? 0),
          walletVersion: home.stateVersions.walletVersion,
        });
        applyMutationResult(result);
        const displayableRewards = result.result.rewards.filter(isDisplayableFarmReward);
        if (displayableRewards.length > 0) {
          setSeedInventory((current) => applyFarmSeedRewardsToInventory(current, displayableRewards, TUTORIAL_STARTER_SEED_ID));
          setUnlockedSeedIds((current) => applyFarmSeedRewardsToUnlockedSeedIds(current, displayableRewards, TUTORIAL_STARTER_SEED_ID));
          setSpiritState((current) => applySpiritMaterialRewardDelta(current, buildSpiritMaterialRewardDelta(displayableRewards)));
        }
        setFarmCollectPresentation({
          fieldId,
          tier: displayableRewards.length > 0 ? 'critical' : 'harvest',
          showSeeds: displayableRewards.length > 0,
        });
        showRewardBubbles([
          {
            label: '金币',
            quantity: result.result.collectedGold,
            tone: 'gold',
          },
          ...displayableRewards.map((reward) => ({
            label: reward.label,
            quantity: reward.quantity,
            tone: getRewardBubbleTone(reward),
          })),
        ]);
        if (tutorialStage === 'farm') {
          runTutorialFlowActions(getTutorialFlowActions('farmRewardConfirmed'));
        }
        setFieldSeedAssignments((current) => {
          const nextAssignments = { ...current };
          delete nextAssignments[fieldId];
          return nextAssignments;
        });
      } catch (error) {
        if (error instanceof ApiError && error.code === 'STATE_VERSION_CONFLICT') {
          const nextViewModel = await loadClientViewModel().catch(() => null);
          if (nextViewModel) {
            applyClientViewModel(nextViewModel);
          }
          showToast('田地状态刚刚发生变化，已刷新数据。请重新收取。', 'error');
        } else {
          showToast(`${context} 当前无法完成收取，请稍后重试。`, 'error');
        }
      } finally {
        setPendingActionKey(null);
      }
      return;
    }

    handleSceneAction(action, context);
  };

  const handleSceneAction = (action: ClientSceneAction, context?: string): void => {
    const actionContext = context ?? raidIntel.detail?.name ?? selectedRaidTarget?.name;

    if ((action.label === '确认出兵' || action.label === '发起掠夺' || action.label === '发起战斗') && actionContext) {
      const targetId = raidIntel.modal?.targetId ?? selectedRaidTarget?.id;

      if (!targetId) {
        showToast('当前缺少可战斗目标，请先重新选择目标。', 'error');
        return;
      }

      if (pendingActionKey === 'raid:execute') {
        return;
      }

      const runRaid = async (): Promise<void> => {
        const input: ClientRaidActionRequest = {
          targetId,
          mode: raidIntel.modal?.mode ?? 'raid',
          armyVersion: home.stateVersions.armyVersion,
        };

        setPendingActionKey('raid:execute');

        try {
          const response = await raidClientTarget(input);
          const nextSpiritState = await loadSpiritState().catch(() => null);
          setViewModel((current) => applyClientViewModelScenePatch(current, response));
          if (nextSpiritState) {
            applySpiritState(nextSpiritState);
          }
          raidIntel.setSelectedTargetId(response.scenes.raid.targets[0]?.id ?? '');

          const settledRaidRewardModal = buildSettledRaidRewardModal(response.result);

          if (response.result.rewards.length > 0) {
            setSeedInventory((current) => applyRaidRewardsToSeedInventory(current, response.result.rewards));
            setUnlockedSeedIds((current) => applyRaidRewardsToUnlockedSeedIds(current, response.result.rewards));
          }

          raidIntel.dismissModal();
          if (tutorialStage === 'raid') {
            const tutorialRewardModal: SeedRewardModalState = {
              ...settledRaidRewardModal,
              afterConfirmActions: getTutorialFlowActions('raidSettled'),
            };
            if (response.result.battleReplay) {
              setPendingRaidRewardModal(tutorialRewardModal);
              setRaidBattleAutoStart(true);
              setRaidBattleReplay(response.result.battleReplay);
            } else {
              setSeedRewardModal(tutorialRewardModal);
            }
          } else if (response.result.battleReplay) {
            setPendingRaidRewardModal(settledRaidRewardModal);
            setRaidBattleAutoStart(true);
            setRaidBattleReplay(response.result.battleReplay);
          } else {
            setSeedRewardModal(settledRaidRewardModal);
          }
        } catch (error) {
          if (error instanceof ApiError && error.code === 'RAID_NOT_ALLOWED') {
            showToast(error.message, 'error');
          } else {
            showToast(`${actionContext} 当前无法完成战斗，请稍后重试。`, 'error');
          }
        } finally {
          setPendingActionKey(null);
        }
      };

      void runRaid();
      return;
    }

    if (action.label === '战斗回放' && action.context) {
      const runReplay = async (): Promise<void> => {
        if (pendingActionKey === 'raid:battle-replay') {
          return;
        }

        setPendingActionKey('raid:battle-replay');
        try {
          const response = await loadRaidBattleReplay(action.context ?? '');
          setPendingRaidRewardModal(null);
          setRaidBattleAutoStart(false);
          setRaidBattleReplay(response.replay);
        } catch {
          showToast('当前无法读取战斗回放，请稍后重试。', 'error');
        } finally {
          setPendingActionKey(null);
        }
      };

      void runReplay();
      return;
    }

    if (action.label === '刷新目标') {
      void handleRefreshRaidTargets();
      return;
    }

    if (action.label.includes('复仇')) {
      const revengeTarget = findRaidTargetByContext(context);

      if (revengeTarget) {
        raidIntel.openTarget(revengeTarget, 'revenge');
        return;
      }
    }

    if (action.target !== activeScene || action.label.includes('返回') || action.label.includes('打开')) {
      navigateToScene(normalizeScene(action.target));
    }

    showToast(buildActionMessage(action.label, actionContext), 'info');
  };

  const handleOpenFarmBoardEditor = (): void => {
    const currentMessage = farmBoard?.farmBoardMessage ?? '';
    setFarmBoardEditor({
      initialMessage: currentMessage,
      message: currentMessage,
      saving: false,
    });
  };

  const handleCloseFarmBoardEditor = (): void => {
    if (!farmBoardEditor || farmBoardEditor.saving) {
      return;
    }

    if (shouldCloseFarmBoardEditorWithoutSaving({
      initialMessage: farmBoardEditor.initialMessage,
      message: farmBoardEditor.message,
    })) {
      setFarmBoardEditor(null);
      return;
    }

    void handleSaveFarmBoard();
  };

  const handleSaveFarmBoard = async (): Promise<void> => {
    if (!farmBoardEditor || farmBoardEditor.saving) {
      return;
    }

    const validation = validateFarmBoardMessage(farmBoardEditor.message);
    if (!validation.valid && validation.reason === 'empty') {
      showToast('留言不能为空。', 'error');
      return;
    }

    if (!validation.valid && validation.reason === 'too-long') {
      showToast('留言最多 40 个字。', 'error');
      return;
    }

    setFarmBoardEditor((current) => current ? { ...current, saving: true } : current);

    try {
      const result = await updateFarmBoard({
        message: validation.message,
        farmBoardVersion: farmBoard?.farmBoardVersion,
      });
      setFarmBoard(result.board);
      setFarmBoardEditor(null);
      showToast(result.summary, 'success');
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : '当前无法修改留言，请稍后重试。', 'error');
      setFarmBoardEditor((current) => current ? { ...current, saving: false } : current);
    }
  };

  const handleStartCultivation = async (fieldId: string, fieldCode: string, seedId: string): Promise<void> => {
    const seed = seedCatalogMap.get(seedId);
    if (!seed || !unlockedSeedIds.includes(seed.id)) {
      showToast('当前只可选择已解锁的灵植。', 'error');
      return;
    }

    const actionKey = `farm:${fieldId}:开始培育`;
    if (pendingActionKey === actionKey) {
      return;
    }

    setPendingActionKey(actionKey);

    try {
      const result = await startFieldCultivation({ fieldId, seedId: seed.id, plantType: seed.id });
      applyMutationResult(result);
      setFarmTick(0);
      setFieldSeedAssignments((current) => ({
        ...current,
        [fieldId]: seed.id,
      }));
      setSeedSelectionState(null);
      showToast(`${fieldCode} 已投入 ${seed.name}，开始培育。`, 'success');
      if (tutorialStage === 'farm') {
        runTutorialFlowActions(getTutorialFlowActions('fieldCultivationStarted'));
      }
    } catch {
      showToast(`${fieldCode} 当前无法开始培育，请稍后重试。`, 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleConfirmSeedCultivation = async (): Promise<void> => {
    if (!seedSelectionState) {
      return;
    }
    await handleStartCultivation(seedSelectionState.fieldId, seedSelectionState.fieldCode, selectedSeedId);
  };

  const handleConfirmGlobalUnlock = (): void => {
    if (!globalUnlockModal) {
      return;
    }

    if (pendingFriendInvite && pendingFriendInvite.boundFriend === undefined && globalUnlockModal.completionKind !== 'friend-invite') {
      showToast('正在确认好友邀请，请稍候。', 'info');
      return;
    }

    if (pendingFriendInvite?.boundFriend && globalUnlockModal.completionKind !== 'friend-invite') {
      setGlobalUnlockModal({
        title: '你们已成为好友',
        summary: `你已和 ${pendingFriendInvite.inviterName} 成为好友。新友奖励已发送到通知中心，请在通知附件中确认领取。接下来先去好友页查看这位好友。`,
        completionKind: 'friend-invite',
        items: [
          {
            id: 'social-friends',
            label: '社交 · 好友',
            kind: 'feature',
            description: '查看好友关系；新用户帮好友浇水会在后续版本接入。',
          },
          {
            id: pendingFriendInvite.notificationId ?? 'friend-invite-reward',
            label: '通知附件奖励',
            kind: 'feature',
            description: '奖励不会自动入账，需要在通知中心点击领取并确认。',
          },
        ],
        afterConfirmActions: [
          { type: 'navigate', scene: 'social' },
        ],
      });
      return;
    }

    const afterConfirmActions = globalUnlockModal.afterConfirmActions ?? [];
    setGlobalUnlockModal(null);
    if (globalUnlockModal.completionKind === 'friend-invite') {
      setPendingFriendInvite(null);
      setSocialTab('friends');
    }
    if (afterConfirmActions.length > 0) {
      runTutorialFlowActions(afterConfirmActions);
    }
  };

  const appContent = shareAssistDemo ? (
    <ShareAssistDemoScreen
      demo={shareAssistDemo}
      onBack={() => setShareAssistDemo(null)}
      onConfirm={() => {
        void handleConfirmShareAssistDemo();
      }}
      onSuccessExit={(audience) => {
        void handleShareAssistSuccessExit(audience);
      }}
    />
  ) : (
    <main className="app-shell">
      <DesktopStatusRail
        currentAccountName={currentAccountName}
        pendingActionKey={pendingActionKey}
        viewModel={viewModel}
        onNavigate={navigateToScene}
        onResetDemoState={() => {
          void handleResetDemoState();
        }}
        onShowToast={(message) => showToast(message)}
        onSwitchDevUser={handleSwitchDevUser}
      />

      <section className="phone-stage">
        <div
          ref={characterDialogPortalRef}
          className="phone-frame phone-frame-scene"
          style={{ ['--scene-bg-image' as string]: activeBackgroundImage } as React.CSSProperties}
        >
          <TopDock
            isTutorialUser={isTutorialUser}
            notificationUnreadCount={notifications.unreadCount}
            seasonProgress={seasonProgress}
            onOpenNotifications={notifications.openCenter}
            onOpenSeasonResetRules={() => {
              setGlobalFeatureModal({
                title: '赛季规则',
                eyebrow: '赛季',
                description: '查看赛季结算与重置规则，再决定本赛季的经营重点。',
                seasonResetRules: true,
              });
            }}
            onOpenSeasonSignIn={() => {
              setGlobalFeatureModal({
                title: '赛季签到',
                eyebrow: '赛季',
                description: '按天签到领取天机符，本赛季累计签到也会逐步解锁阶段奖励。',
                seasonSignIn: true,
              });
            }}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenTianjiShop={() => {
              setGlobalFeatureModal({
                title: '天机符商店',
                tianjiShop: true,
              });
            }}
          />

          <NotificationCenter
            actionId={notifications.actionId}
            busy={notifications.busy}
            data={notifications.list}
            error={notifications.error}
            onClaim={(notificationId) => {
              handleOpenNotificationClaim(notificationId);
            }}
            onClose={notifications.close}
            onDelete={(notificationId) => {
              void notifications.deleteItem(notificationId);
            }}
            onMarkRead={(notificationId) => {
              void notifications.markRead(notificationId);
            }}
            onPageChange={(page) => {
              void notifications.loadPage(page);
            }}
            open={notifications.open}
          />

          <SettingsModal
            currentAccountName={currentAccountName}
            devLoginModeLabel={devLoginModeLabel}
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            onSwitchDevUser={handleSwitchDevUser}
          />

          <GlobalResourceBar
            gold={vaultProgress.current}
            showTopResourceButtons={tutorialUiRules.showTopResourceButtons}
            tianjiTalisman={tianjiTalismanCount}
            onOpenResources={() => setTopResourcePanel('resources')}
            onOpenSeedCodex={() => {
              setSeedCodexState({ selectedSeedId: firstVisibleUnlockedSeedId });
            }}
            onOpenSpiritCodex={() => {
              setTopSpiritCodexSpiritId(topSpiritCodexSelectedId);
              setTopResourcePanel('spirit-codex');
            }}
          />

          <AppSceneRouter
            activeScene={activeScene}
            factionTab={factionTab}
            farmBoard={farmBoard}
            farmCollectPresentation={farmCollectPresentation}
            farmFields={farmFields}
            followedTargetIds={raidIntel.followedTargetIds}
            friendInviteNewUserUrl={friendInviteDemoLinks?.newUser ?? null}
            home={home}
            isTutorialUser={isTutorialUser}
            pendingActionKey={pendingActionKey}
            portalTarget={characterDialogPortalRef.current}
            raidBattleLimit={raidBattleLimit}
            raidBattleUsed={raidBattleUsed}
            raidHubTab={raidHubTab}
            reportEntries={mergedReportEntries}
            scenes={scenes}
            socialEnemies={social.enemies}
            socialError={social.error}
            socialFeed={social.feed}
            socialFieldVisit={social.fieldVisit}
            socialFollowing={social.following}
            socialFriends={social.friends}
            socialLoading={social.loading}
            socialRelationFilter={socialRelationFilter}
            socialSummary={social.summary}
            socialTab={socialTab}
            spiritState={spiritState}
            targets={visibleRaidTargets}
            tutorialTask={tutorialTask}
            tutorialUiRules={tutorialUiRules}
            vaultGold={vaultProgress.current}
            onAcceptFriendRequest={(relationId) => {
              void social.acceptFriendRequest(relationId);
            }}
            onAssistAllSocialFields={() => {
              void social.assistAllFields();
            }}
            onAssistSocialFriend={(targetPlayerId) => {
              void social.assistFriend(targetPlayerId);
            }}
            onBreakthroughSpirit={(slotIndex, slotVersion, targetStage) => {
              void handleBreakthroughSpiritAction(slotIndex, slotVersion, targetStage);
            }}
            onBuildingUpgradeAction={(action, upgradeId, context, targetType, costText) => {
              void handleBuildingAction(action, upgradeId, context, targetType, costText);
            }}
            onChangeFactionTab={setFactionTab}
            onChangeRaidHubTab={setRaidHubTab}
            onChangeSocialRelationFilter={setSocialRelationFilter}
            onChangeSocialTab={setSocialTab}
            onClaimFactionStipend={() => {
              void handleClaimFactionStipend();
            }}
            onCloseSocialFieldVisit={social.closeFieldVisit}
            onComposeSpirit={(spiritId, slotIndex, element) => {
              void handleComposeSpiritAction(spiritId, slotIndex, element);
            }}
            onCopyFriendInviteUrl={(url) => {
              void copyFriendInviteUrl(url);
            }}
            onCreateFriendInvite={handleCreateFriendInvite}
            onDeleteSocialFriend={(targetPlayerId) => {
              void social.deleteFriend(targetPlayerId);
            }}
            onDissolveSpirit={(slotIndex, slotVersion) => {
              void handleDissolveSpiritAction(slotIndex, slotVersion);
            }}
            onDonateFaction={(goldAmount) => {
              void handleFactionDonate(goldAmount);
            }}
            onFarmAction={(action, fieldId, fieldCode) => {
              void handleFarmAction(action, fieldId, fieldCode);
            }}
            onFeedSpirit={(slotIndex, slotVersion, actionType) => {
              void handleFeedSpiritAction(slotIndex, slotVersion, actionType);
            }}
            onNavigate={navigateToScene}
            onOpenContributionGuide={() => {
              setGlobalFeatureModal({
                title: '贡献俸禄档位',
                eyebrow: '阵营贡献',
                description: '每日按当前个人贡献匹配一个档位；随机精华和灵宠精魄会在确认领取时抽取为具体碎片。',
                contributionTiers: buildFactionContributionTiers(),
              });
            }}
            onOpenFarmBoard={handleOpenFarmBoardEditor}
            onOpenRaidTarget={raidIntel.openTarget}
            onOpenSocialFieldVisit={(targetPlayerId) => {
              void social.openFieldVisit(targetPlayerId);
            }}
            onRaidAction={handleSceneAction}
            onRecoverSpirit={(slotIndex, slotVersion) => {
              void handleRecoverSpiritAction(slotIndex, slotVersion);
            }}
            onRefreshRaidTargets={() => {
              void handleRefreshRaidTargets();
            }}
            onRefreshSocial={() => {
              void social.loadBundle();
            }}
            onRejectFriendRequest={(relationId) => {
              void social.rejectFriendRequest(relationId);
            }}
            onRequestFriend={(targetPlayerId) => {
              void social.requestFriend(targetPlayerId);
            }}
            onRollSpiritTraits={(slotIndex, slotVersion, mode, options) => {
              void handleRollSpiritTraitsAction(slotIndex, slotVersion, mode, options);
            }}
            onSetMainSpirit={(slotIndex, slotVersion) => {
              void handleSetMainSpiritAction(slotIndex, slotVersion);
            }}
            onToggleFollowTarget={raidIntel.toggleFollowTarget}
            onTransferFaction={handleTransferFaction}
            onTutorialAction={handleTutorialTaskAction}
          />

          <BottomDock
            activeScene={activeScene}
            tutorialStage={tutorialStage}
            onNavigate={navigateToScene}
          />

          <RaidIntelModalHost
            allowDeepIntel={tutorialUiRules.raid.allowDeepIntel}
            allowFollow={tutorialUiRules.raid.allowFollow}
            detail={raidIntel.detail}
            error={raidIntel.error}
            followedTargetIds={raidIntel.followedTargetIds}
            loading={raidIntel.loading}
            modal={raidIntel.modal}
            raidTargetsById={raidTargetsById}
            onAction={handleSceneAction}
            onClose={raidIntel.closeModal}
            onRevealDeepIntel={async (targetId): Promise<ClientRaidDeepIntelResponse> => {
              const response = await revealRaidTargetDeepIntel(targetId);
              patchRaidTargetPreview(targetId, response.mainPetPreview);
              return response;
            }}
            onToggleFollowTarget={raidIntel.toggleFollowTarget}
          />

          <FarmModalLayer
            farmBoardEditor={farmBoardEditor}
            pendingActionKey={pendingActionKey}
            seedGroups={seedGroups}
            seedSelectionState={seedSelectionState}
            selectedSeedId={selectedSeedId}
            onChangeFarmBoardMessage={(message) => setFarmBoardEditor((current) => current ? { ...current, message } : current)}
            onCloseFarmBoardEditor={handleCloseFarmBoardEditor}
            onCloseSeedSelection={() => setSeedSelectionState(null)}
            onConfirmSeedCultivation={() => {
              void handleConfirmSeedCultivation();
            }}
            onSelectSeed={setSelectedSeedId}
          />
          <GlobalFeatureModalHost
            modal={globalFeatureModal}
            pendingActionKey={pendingActionKey}
            seasonSignInClaimedToday={seasonSignInClaimedToday}
            seasonSignInDays={seasonSignInDays}
            seasonSignInMilestones={seasonSignInMilestones}
            seasonSignInRecord={seasonSignInRecord}
            seasonSignInTodayReward={seasonSignInTodayReward}
            spiritState={spiritState}
            tianjiTalismanCount={tianjiTalismanCount}
            onBuySpiritShopItem={(itemId) => {
              void handleBuySpiritShopItemAction(itemId);
            }}
            onClaimSeasonSignIn={() => {
              void handleClaimSeasonSignIn();
            }}
            onClaimSpiritAdReward={() => {
              void handleClaimSpiritAdRewardAction();
            }}
            onClose={() => setGlobalFeatureModal(null)}
            onOpenSeasonSignIn={() => {
              setGlobalFeatureModal({
                title: '赛季签到',
                eyebrow: '赛季',
                description: '按天签到领取天机符，本赛季累计签到也会逐步解锁阶段奖励。',
                seasonSignIn: true,
              });
            }}
          />
          <ReturningFriendInvitePrompt
            confirming={pendingActionKey === 'friend-invite:returning-confirm'}
            prompt={returningFriendInvitePrompt}
            onConfirm={() => {
              void handleConfirmReturningFriendInvite();
            }}
            onReject={handleRejectReturningFriendInvite}
          />
          <GlobalUnlockModalHost
            modal={globalUnlockModal}
            onConfirm={handleConfirmGlobalUnlock}
          />
          <CollectionModalLayer
            backpackResourceItems={backpackResourceItems}
            pendingActionKey={pendingActionKey}
            seedGroups={seedGroups}
            selectedSeedCodexItem={seedCodexState ? selectedSeedCodexItem : null}
            spiritStableFull={spiritStableFull}
            spiritState={spiritState}
            topResourcePanel={topResourcePanel}
            topSpiritCodexSelectedId={topSpiritCodexSelectedId}
            onCloseResourcePanel={() => setTopResourcePanel(null)}
            onCloseSeedCodex={() => setSeedCodexState(null)}
            onSelectPlant={(plantId) => setSeedCodexState({ selectedSeedId: plantId })}
            onSelectSpirit={setTopSpiritCodexSpiritId}
            onUnlockPlant={(plantId) => {
              void handleUnlockPlant(plantId);
            }}
          />
          <SeedRewardModalHost
            modal={seedRewardModal}
            notificationActionId={notifications.actionId}
            pendingActionKey={pendingActionKey}
            seedCatalogMap={seedCatalogMap}
            onClaimFactionStipend={() => {
              void handleConfirmFactionStipendClaim();
            }}
            onClaimNotification={() => {
              void handleConfirmNotificationClaim();
            }}
            onClaimStarterSeeds={() => {
              void handleConfirmStarterSeedClaim();
            }}
            onClear={() => setSeedRewardModal(null)}
            onRunAfterConfirmActions={() => {
              const afterConfirmActions = seedRewardModal?.afterConfirmActions ?? [];
              if (afterConfirmActions.length > 0) {
                runTutorialFlowActions(afterConfirmActions);
              }
            }}
          />
          <CombatAndFeedbackLayer
            raidBattleAutoStart={raidBattleAutoStart}
            raidBattleReplay={raidBattleReplay}
            rewardBubbles={rewardBubbles}
            toast={toast}
            onRaidBattleComplete={() => {
              setRaidBattleReplay(null);
              if (pendingRaidRewardModal) {
                setSeedRewardModal(pendingRaidRewardModal);
              }
              setPendingRaidRewardModal(null);
              setRaidBattleAutoStart(true);
            }}
          />
        </div>
      </section>

      </main>
  );

  return (
    <CharacterDialogProvider controller={characterDialog} portalTarget={characterDialogPortalRef.current}>
      {appContent}
    </CharacterDialogProvider>
  );
}

export default App;
