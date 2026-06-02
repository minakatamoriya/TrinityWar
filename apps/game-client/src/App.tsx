import { useEffect, useRef, useState } from 'react';
import { buildSpiritCollisionBattleReplay } from '@trinitywar/shared';
import type {
  ClientNotificationListResponse,
  ClientNotificationItem,
  ClientCastleExtensionUpgradeId,
  ClientCollectFieldRequest,
  ClientCollectFieldResponse,
  ClientRaidActionRequest,
  ClientRaidDeepIntelResponse,
  ClientRaidBattleReplay,
  ClientFactionDonateRequest,
  ClientBuildingUpgradeId,
  ClientSocialFriendFieldVisitResponse,
  ClientRaidTarget,
  ClientRaidTargetDetailResponse,
  ClientSceneAction,
  ClientSceneKey,
  ClientPlantResearchState,
  ClientFarmBoardState,
  ClientSocialFeedItem,
  ClientSocialRelationItem,
  ClientSocialSummaryResponse,
  ClientSpiritElement,
  ClientSpiritRollMode,
  ClientSpiritTraitCode,
  ClientSpiritState,
  ClientSeasonSignInState,
  PublicShareAssistCampaignResponse,
  HomeSummaryResponse,
  ClientTerritoryUpgradeId,
  ClientUpgradeBuildingRequest,
  ClientUpgradeTargetType,
} from '@trinitywar/shared';
import { acceptSocialFriendRequest, ApiError, breakthroughSpirit, buySpiritShopItem, claimFactionStipend, claimNotification, claimSeasonSignIn, claimSpiritAdReward, claimStarterSeeds, clearDevLoginSession, collectFieldEarnings, composeSpirit, completeShareInviteTutorial, confirmPublicShareAssist, createShareAssistCampaign, deleteNotification, deleteSocialFriend, devLogin, dissolveSpirit, donateFactionResources, feedSpirit, getDevLoginModeLabel, getStoredDevLoginSession, harvestSocialField, loadClientViewModel, loadFarmBoard, loadNotifications, loadPublicShareAssistCampaign, loadRaidBattleReplay, loadRaidTargetDetail, loadSeasonSignIn, loadSocialFeed, loadSocialRelations, loadSocialSummary, loadSpiritState, loadUnreadNotificationCount, markNotificationAsRead, raidClientTarget, recoverSpirit, refreshRaidTargets, rejectSocialFriendRequest, requestSocialFriend, resetDemoExperimentState, revealRaidTargetDeepIntel, rollSpiritTraits, setMainSpirit, startFieldCultivation, type ClientReadSourceStatus, type ClientViewModel, type DevFactionChoice, type DevLoginMode, type DevLoginSession, unlockPlant, updateFarmBoard, upgradeClientBuilding, visitSocialFriendFields, waterSocialField } from './api';
import { NotificationCenter } from './ui/common/NotificationCenter';
import { RaidIntelScreen } from './ui/raid/RaidIntelScreen';
import { ArmyScene } from './ui/scenes/ArmyScene';
import { BuildingScene } from './ui/scenes/BuildingScene';
import { FactionScene } from './ui/scenes/FactionScene';
import { FarmScene } from './ui/scenes/FarmScene';
import { HomeScene } from './ui/scenes/HomeScene';
import { ReportScene } from './ui/scenes/ReportScene';
import { SeedSelectionScreen } from './ui/scenes/SeedSelectionScreen';
import { SocialScene, type SocialRelationFilter, type SocialTabKey } from './ui/scenes/SocialScene';
import { GlobalFeatureModal } from './ui/common/GlobalFeatureModal';
import { FarmBoardEditorModal } from './ui/common/FarmBoardEditorModal';
import { GlobalFeatureModalContent } from './ui/common/GlobalFeatureModalContent';
import { GlobalUnlockModal, type GlobalUnlockItem } from './ui/common/GlobalUnlockModal';
import { CenteredModalShell } from './ui/common/ModalShell';
import { PlantCodexModal } from './ui/common/PlantCodexModal';
import { ResourceBackpackModal, type BackpackResourceItem } from './ui/common/ResourceBackpackModal';
import { RewardBubbleStack, type RewardBubbleItem } from './ui/common/RewardBubbleStack';
import { SpiritCodexModal } from './ui/common/SpiritCodexModal';
import { SeedRewardModal, type SeedRewardModalItem } from './ui/common/SeedRewardModal';
import { ShareAssistPage, type ShareAssistAudience, type ShareAssistKind, type ShareAssistStatus } from './ui/share/ShareAssistPage';
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
  getTutorialUiRules,
  isNewUserInTutorial,
  type TutorialFlowAction,
  type TutorialStage,
} from './tutorial/tutorialFlow';

type RaidHubTabKey = 'targets' | 'reports';
type FactionTabKey = 'overview' | 'donate' | 'rank';

interface ToastState {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface RaidTargetModalState {
  targetId: string;
  targetName: string;
  mode: 'raid' | 'revenge';
}

type SeedRarity = 'common' | 'rare' | 'legendary';

interface SeedCatalogItem {
  id: string;
  name: string;
  rarity: SeedRarity;
  sortOrder: number;
  description: string;
  lore: string;
  stageGold: {
    growing: number;
    mature: number;
    withered: number;
  };
  growthSeconds: number;
  unlockedByDefault: boolean;
}

interface SeedCodexState {
  selectedSeedId: string;
}

type TopResourcePanel = 'spirit-codex' | 'resources';

interface SeedRewardModalState {
  title: string;
  summary: string;
  confirmAction?: 'claim-faction-stipend' | 'claim-starter-seeds' | 'claim-notification';
  notificationId?: string;
  afterConfirmActions?: TutorialFlowAction[];
  items: SeedRewardModalItem[];
}

interface SeedSelectionState {
  fieldId: string;
  fieldCode: string;
}

interface FarmCollectPresentationState {
  fieldId: string;
  tier: 'harvest' | 'critical';
  showSeeds: boolean;
}

interface FarmBoardEditorState {
  initialMessage: string;
  message: string;
  saving: boolean;
}

interface GlobalUnlockModalState {
  title: string;
  summary: string;
  items: GlobalUnlockItem[];
  afterConfirmActions?: TutorialFlowAction[];
  completionKind?: 'friend-invite';
}

interface ShareAssistDemoState {
  audience: ShareAssistAudience;
  kind: ShareAssistKind;
  status: ShareAssistStatus;
  campaignId: string;
  campaign: PublicShareAssistCampaignResponse | null;
  error: string | null;
}

interface PendingShareInviteState {
  campaignId: string;
  helperOpenidHash: string;
  helperDeviceHash: string;
}

interface PendingFriendInviteState {
  campaignId?: string;
  inviterName: string;
  inviterFactionCode: DevFactionChoice;
  inviterFactionName: string;
  boundFriend?: boolean;
  notificationId?: string | null;
}

interface ReturningFriendInvitePromptState {
  campaignId: string;
  inviterName: string;
  inviterFactionName: string;
  helperPlayerId: string;
}

interface GlobalFeatureModalState {
  title: string;
  eyebrow?: string;
  description?: string;
  contributionTiers?: FactionContributionTier[];
  seasonResetRules?: boolean;
  tianjiShop?: boolean;
  seasonSignIn?: boolean;
}

interface FactionContributionTier {
  threshold: string;
  label: string;
  rewards: string[];
}

interface FactionChoiceCard {
  code: DevFactionChoice;
  name: string;
  title: string;
  traits: string[];
  leaderSummary: string;
}

interface LocalFarmFieldPresentation {
  title: string;
  badge: string;
  tone: 'growing' | 'mature' | 'withered' | 'empty' | 'locked';
  description: string;
  actions: ClientSceneAction[];
  progressRemainingSeconds: number;
  progressTotalSeconds: number;
  fieldVersionOffset: number;
}

const seedCatalog: SeedCatalogItem[] = [
  { id: 'qilingya', name: '启灵芽', rarity: 'common', sortOrder: 1, description: '新手教程种，10 秒完成第一轮收获。', lore: '只在开荒时授予的一枚灵芽，破土极快，用来帮新人从零点亮第一笔资金。', stageGold: { growing: 20, mature: 50, withered: 50 }, growthSeconds: 10, unlockedByDefault: true },
  { id: 'qinglingmai', name: '青灵麦', rarity: 'common', sortOrder: 10, description: '免费开放的基础稳收种，适合进入日常经营。', lore: '田野间最常见的灵粮，穗头泛淡青光泽，脱壳后熬粥清香回甘。凡人食之强身，修士食之略养经脉。春种秋收，从不妖异。', stageGold: { growing: 100, mature: 200, withered: 100 }, growthSeconds: 10800, unlockedByDefault: true },
  { id: 'xunyamai', name: '风云稻', rarity: 'common', sortOrder: 20, description: '免费开放的基础快收种，适合切碎片时间。', lore: '稻芒起势极快，晨起沾露便能成势，半个时辰内就能完成一轮收益。', stageGold: { growing: 100, mature: 200, withered: 100 }, growthSeconds: 1800, unlockedByDefault: true },
  { id: 'ninglucao', name: '凝露草', rarity: 'common', sortOrder: 30, description: '普通、短线快收种，适合高频上线卡成熟。', lore: '叶尖常凝夜露，晨时如泪珠滚落，有清心明目之效。低阶弟子多用其露水研磨朱砂画符，成功率能稍许提升。', stageGold: { growing: 100, mature: 140, withered: 40 }, growthSeconds: 7200, unlockedByDefault: false },
  { id: 'suixinhua', name: '碎心花', rarity: 'common', sortOrder: 40, description: '普通、高折损高回报种，成熟收益高但枯萎折损明显。', lore: '花瓣薄如蝉翼，嫣红带紫纹，看似艳丽。但有微毒，采摘时指尖会传来一阵短暂的钻心刺痛，故名。可入麻醉类丹药。', stageGold: { growing: 120, mature: 300, withered: 50 }, growthSeconds: 10800, unlockedByDefault: false },
  { id: 'baiyulian', name: '白玉莲', rarity: 'common', sortOrder: 50, description: '普通、低频保值种，错过窗口也不容易血亏。', lore: '纯白无瑕，瓣如凝脂，生于清澈浅塘。花心微黄，清香远溢。凡人供于佛前，修士取其花瓣泡茶，可净体内杂气。', stageGold: { growing: 160, mature: 220, withered: 180 }, growthSeconds: 16200, unlockedByDefault: false },
  { id: 'yingyuezhu', name: '影月竹', rarity: 'common', sortOrder: 60, description: '普通、稳健中速种，适合平衡型经营。', lore: '竹身乌青，夜来月光下会在地上投出淡淡银影，竹节修长如剑。常种于书斋窗外，能助人凝神夜读，抵御睡魔。', stageGold: { growing: 150, mature: 230, withered: 140 }, growthSeconds: 12600, unlockedByDefault: false },
  { id: 'qianjiteng', name: '牵机藤', rarity: 'common', sortOrder: 70, description: '普通、高成熟收益种，适合稳定等到成熟后收取。', lore: '藤蔓天生细密纹路，如牵机阵法。缠绕古木或篱笆，可束缚小妖、守护庭院，是低阶阵法师最喜搭配的活体材料。', stageGold: { growing: 170, mature: 360, withered: 120 }, growthSeconds: 12600, unlockedByDefault: false },
  { id: 'huichuncao', name: '回春草', rarity: 'rare', sortOrder: 110, description: '稀有、回种保值种，上线不稳时更稳。', lore: '通体碧玉，全草如翡翠，五十年才成熟一株。煮水内服可愈沉疴暗伤，对外伤亦有奇效。一株值百金，药农视若性命。', stageGold: { growing: 320, mature: 480, withered: 380 }, growthSeconds: 14400, unlockedByDefault: false },
  { id: 'xueyuehua', name: '雪月花', rarity: 'rare', sortOrder: 120, description: '稀有、高成熟收益种，适合准时收取。', lore: '只在高寒雪山顶的月圆之夜盛开，花瓣冰白带银纹，花蕊一点淡蓝。盛开时方圆十丈飘雪，花谢后雪融。可炼“寒魄丹”，助冰系功法。', stageGold: { growing: 300, mature: 760, withered: 180 }, growthSeconds: 12600, unlockedByDefault: false },
  { id: 'jingdaosong', name: '劲道松', rarity: 'rare', sortOrder: 130, description: '稀有、长周期高保值种，适合重仓慢收。', lore: '矮松，树皮龟裂如铁，松针短而刚硬。长在罡风口的悬崖上，木质极密、韧性惊人。折断一松枝制成剑胚，便是不错的筑基法器。', stageGold: { growing: 450, mature: 620, withered: 520 }, growthSeconds: 18000, unlockedByDefault: false },
  { id: 'hundunguo', name: '混沌果', rarity: 'rare', sortOrder: 140, description: '稀有、后期抽水种，中后段高价值诱盗目标。', lore: '拳头大的圆果，灰蒙蒙无纹，剖开内里一片浑浊。罕见地生长在灵脉与地脉交错的混乱处。炼化后可让修士短暂进入“混沌”状态，免疫五行术法一炷香。', stageGold: { growing: 420, mature: 880, withered: 260 }, growthSeconds: 19800, unlockedByDefault: false },
  { id: 'zhanqingsi', name: '斩情丝', rarity: 'legendary', sortOrder: 210, description: '传说、高风险斩杀种，高收益也高失败代价。', lore: '茎如金丝，赤红纤细，一旦被它缠住手指，便会暂时斩断某人对另一人的爱慕或怨恨。传说上古有大能以此草炼制“绝情丹”，后被各派联手销毁，仅余深山数株。', stageGold: { growing: 520, mature: 1200, withered: 200 }, growthSeconds: 14400, unlockedByDefault: false },
  { id: 'wangchuanying', name: '忘川影', rarity: 'legendary', sortOrder: 220, description: '传说、长周期隐性暴利种，后段重投入慢兑现。', lore: '水边黑色丝状藻类，夜来投影如人影晃动。用它泡水喝下，会看到一段不属于自己的前世片段，往往是最痛苦的那一瞬。邪修常用其拷问死者的秘密。', stageGold: { growing: 760, mature: 1200, withered: 960 }, growthSeconds: 21600, unlockedByDefault: false },
  { id: 'zhaoyouming', name: '照幽冥', rarity: 'legendary', sortOrder: 230, description: '传说、极限成熟收益种，终局上限最高之一。', lore: '通体漆黑的矮草，夜里发出微弱青光，能照亮脚下三尺的地气与亡魂足迹。相传若手握此草走进刚死之人的屋子，可看见死者徘徊不去的淡影，并与之做最后交谈。', stageGold: { growing: 700, mature: 1600, withered: 680 }, growthSeconds: 18000, unlockedByDefault: false },
];

const FARM_COLLECT_PRESENTATION_MS = 1250;

const seedRarityLabels: Record<SeedRarity, string> = {
  common: '普通',
  rare: '稀有',
  legendary: '传说',
};

function compareSeedCatalogItems(left: SeedCatalogItem, right: SeedCatalogItem): number {
  return left.sortOrder - right.sortOrder || left.id.localeCompare(right.id);
}

function buildLocalPlantResearchState(plantType: string, unlocked: boolean, essenceOwned: number): ClientPlantResearchState {
  return {
    plantType,
    discovered: unlocked || essenceOwned > 0,
    unlocked,
    status: unlocked ? 'unlocked' : essenceOwned > 0 ? 'discovered' : 'undiscovered',
    essenceRequired: 0,
    essenceOwned,
    contributionRequired: 0,
    contributionOwned: 0,
    canUnlock: false,
  };
}

function buildLiveFarmFieldPresentation(
  field: ClientViewModel['scenes']['farm']['fields'][number],
  elapsedSeconds: number,
): LocalFarmFieldPresentation | null {
  if (field.tone !== 'growing' && field.tone !== 'mature') {
    return null;
  }

  if (field.tone === 'mature') {
    return {
      title: field.title,
      badge: field.badge,
      tone: field.tone,
      description: field.description,
      actions: field.actions,
      progressRemainingSeconds: Math.max(field.progressRemainingSeconds - elapsedSeconds, 0),
      progressTotalSeconds: field.progressTotalSeconds,
      fieldVersionOffset: 0,
    };
  }

  let remainingElapsedSeconds = elapsedSeconds;
  let stageTone: LocalFarmFieldPresentation['tone'] = field.tone;
  let stageIndexOffset = 0;
  let stageDurationSeconds = Math.max(field.progressTotalSeconds, 1);
  let stageRemainingSeconds = Math.max(field.progressRemainingSeconds, 0);

  while (remainingElapsedSeconds > 0 && stageTone === 'growing') {
    if (remainingElapsedSeconds < stageRemainingSeconds) {
      stageRemainingSeconds -= remainingElapsedSeconds;
      remainingElapsedSeconds = 0;
      break;
    }

    remainingElapsedSeconds -= stageRemainingSeconds;
    stageIndexOffset = 1;

    stageTone = 'mature';
    stageDurationSeconds = 1;
    stageRemainingSeconds = 0;
    break;
  }

  if (stageIndexOffset === 0) {
    return {
      title: field.title,
      badge: field.badge,
      tone: field.tone,
      description: field.description,
      actions: field.actions,
      progressRemainingSeconds: stageRemainingSeconds,
      progressTotalSeconds: field.progressTotalSeconds,
      fieldVersionOffset: 0,
    };
  }

  if (stageTone === 'growing') {
    return {
      title: '培育中',
      badge: '培育',
      tone: 'growing',
      description: '作物仍在培育中，成熟后即可收取完整收益。',
      actions: [],
      progressRemainingSeconds: stageRemainingSeconds,
      progressTotalSeconds: stageDurationSeconds,
      fieldVersionOffset: 1,
    };
  }

  return {
    title: '成熟期',
    badge: '成熟',
    tone: 'mature',
    description: '已经成熟，可以直接收取完整收益。',
    actions: [{ label: '收取', target: 'farm', tone: 'primary' }],
    progressRemainingSeconds: 0,
    progressTotalSeconds: 1,
    fieldVersionOffset: 1,
  };
}

const defaultUnlockedSeedIds = seedCatalog
  .filter((seed) => seed.unlockedByDefault)
  .sort(compareSeedCatalogItems)
  .map((seed) => seed.id);

const emptySeedInventory = seedCatalog.reduce<Record<string, number>>((inventory, seed) => {
  inventory[seed.id] = 0;
  return inventory;
}, {});

const emptyGlobalItemInventory: Record<string, number> = {
  tianjiTalisman: 0,
};

interface ResourceProgressValue {
  current: number;
  capacity: number;
  ratio: number;
}

const sceneNavLabels: Record<ClientSceneKey, string> = {
  home: '首页',
  building: '法术',
  farm: '农场',
  raid: '灵宠',
  report: '探索',
  faction: '阵营',
  social: '社交',
};

const sceneKeys: ClientSceneKey[] = ['home', 'farm', 'raid', 'report', 'faction', 'social'];
const playableSeedCatalog = seedCatalog.filter((seed) => seed.id !== TUTORIAL_STARTER_SEED_ID);

const factionBackgroundMap: Record<string, string> = {
  人界: '/assets/backgrounds/renjie.png',
  仙界: '/assets/backgrounds/xianjie.png',
  魔界: '/assets/backgrounds/mojie.png',
};

const sceneBackgroundMap: Record<Exclude<ClientSceneKey, 'home'>, string> = {
  building: '/assets/backgrounds/jianzhu.png',
  farm: '/assets/backgrounds/nongchang.png',
  raid: '/assets/backgrounds/lueduo.png',
  report: '/assets/backgrounds/zhanbao.png',
  faction: '/assets/backgrounds/zhenying.png',
  social: '/assets/backgrounds/zhenying.png',
};

const factionChoiceCards: FactionChoiceCard[] = [
  {
    code: 'human',
    name: '人界',
    title: '种田更强',
    traits: ['更适合种田经营', '收菜节奏更稳', '适合长期发展'],
    leaderSummary: '人界更擅长经营灵田，收成更稳，种田节奏也更从容。前期更容易靠稳定资源养起整条成长线，适合喜欢慢慢铺开的玩家。',
  },
  {
    code: 'immortal',
    name: '仙界',
    title: '养宠更强',
    traits: ['更适合灵宠成长', '养成推进更顺', '主宠提升更明显'],
    leaderSummary: '仙界更擅长培育灵宠，主宠成长更快，养成推进也更顺手。更容易把第一只灵宠尽快养成主力，适合喜欢围绕灵宠持续投入的玩家。',
  },
  {
    code: 'demon',
    name: '魔界',
    title: '战斗更强',
    traits: ['更适合主动战斗', '出手更狠', '连续作战更有优势'],
    leaderSummary: '仙界更擅长培育灵宠，主宠成长更快，养成推进也更顺手。更容易把第一只灵宠尽快养成主力，适合喜欢围绕灵宠持续投入的玩家。',
  },
];

const FRIEND_INVITE_DEMO_INVITER = {
  name: '测试好友',
  factionCode: 'human' as const,
  factionName: '人界',
};

const factionCodeByName: Record<string, DevFactionChoice> = {
  人界: 'human',
  仙界: 'immortal',
  魔界: 'demon',
};

function normalizeScene(scene: string): ClientSceneKey {
  if (scene === 'field') {
    return 'farm';
  }

  if (scene === 'home' || scene === 'building' || scene === 'farm' || scene === 'raid' || scene === 'report' || scene === 'faction' || scene === 'social') {
    return scene;
  }

  return 'home';
}

function formatServerTime(serverTime: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(serverTime));
}

function buildUpgradeRequest(
  targetType: ClientUpgradeTargetType,
  upgradeId: ClientBuildingUpgradeId | ClientCastleExtensionUpgradeId,
  buildingVersion: number,
  walletVersion: number,
): ClientUpgradeBuildingRequest {
  if (targetType === 'building') {
    return {
      targetType,
      buildingId: upgradeId as ClientBuildingUpgradeId,
      buildingVersion,
      walletVersion,
    };
  }

  if (targetType === 'territory-tech') {
    return {
      targetType,
      territoryUpgradeId: upgradeId as ClientTerritoryUpgradeId,
      buildingVersion,
      walletVersion,
    };
  }

  return {
    targetType,
    extensionId: upgradeId as ClientCastleExtensionUpgradeId,
    buildingVersion,
    walletVersion,
  };
}

function parseTianjiCostText(costText: string): number {
  const match = costText.match(/^消耗\s*([\d,，]+)\s*天机符/);
  if (!match) {
    return 0;
  }

  return Math.max(Number(match[1].replace(/[，,]/g, '')) || 0, 0);
}

function getMillisecondsUntilNextChinaMidnight(): number {
  const now = Date.now();
  const chinaNow = new Date(now + 8 * 60 * 60 * 1000);
  const nextMidnightUtc = Date.UTC(
    chinaNow.getUTCFullYear(),
    chinaNow.getUTCMonth(),
    chinaNow.getUTCDate() + 1,
    -8,
    0,
    2,
  );

  return Math.max(nextMidnightUtc - now, 1000);
}

function buildSeasonProgress(status: ClientViewModel['bootstrap']['season']): {
  label: string;
  detail: string;
} {
  const safeTotalWeeks = Math.max(status.totalWeeks, 1);
  const safeCurrentWeek = Math.min(Math.max(status.currentWeek, 1), safeTotalWeeks);

  return {
    label: `S${status.seasonNumber} 赛季`,
    detail: `${safeCurrentWeek}/${safeTotalWeeks} 周`,
  };
}
function buildActionMessage(label: string, context?: string): string {
  const subject = context ? `当前目标：${context}。` : '';

  if (label.includes('领取')) {
    return `${subject}该操作会先走收益确认，再把可承接的部分并入当前库存。`;
  }

  if (label.includes('升级') || label.includes('修习')) {
    return `${subject}验证版先只确认入口、消耗文案和收益预期，具体数值以后端结算为准。`;
  }

  if (label.includes('上缴')) {
    return `${subject}上缴后会立即累积贡献值，并影响每日俸禄档位。`;
  }

  if (label.includes('说明') || label.includes('详情')) {
    return `${subject}这里先保留为说明弹窗，后续可以替换成更完整的二级信息面板。`;
  }

  if (label.includes('刷新')) {
    return `${subject}验证版先模拟目标刷新入口，后续再接真实目标池刷新接口。`;
  }

  return `${subject}该入口已经接入前端交互壳，后续可以继续补确认弹窗、接口联调和状态回写。`;
}

function buildFactionContributionTiers(): FactionContributionTier[] {
  return [
    { threshold: '0 贡献', label: '基础俸禄', rewards: ['金币 x20', '随机普通精华 x3', '普通兽魂 x2'] },
    { threshold: '100 贡献', label: '小有供奉', rewards: ['金币 x30', '随机普通精华 x5', '普通兽魂 x5'] },
    { threshold: '300 贡献', label: '稳定供奉', rewards: ['金币 x40', '指定普通精华 x8', '普通兽魂 x10'] },
    { threshold: '600 贡献', label: '阵营骨干', rewards: ['金币 x50', '随机稀有精华 x6', '稀有兽魂 x4', '普通灵宠精魄 x2'] },
    { threshold: '1000 贡献', label: '高阶供奉', rewards: ['金币 x60', '指定稀有精华 x10', '稀有兽魂 x8', '稀有灵宠精魄 x3'] },
    { threshold: '2000 贡献', label: '阵营重臣', rewards: ['金币 x80', '随机传说精华 x8', '传说兽魂 x2', '传说灵宠精魄 x2'] },
  ];
}

function parseCapacityResourceValue(value: string): ResourceProgressValue {
  const parts = value.split('/').map((part) => Number(part.replace(/,/g, '').trim()));
  const current = parts[0] ?? 0;
  const capacity = parts[1] ?? 1;
  const ratio = capacity > 0 ? Math.min(current / capacity, 1) : 0;

  return { current, capacity, ratio };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatSocialAssistSummary(input: {
  wateredCount: number;
  harvestedCount: number;
  rewardGold: number;
  intimacyGain: number;
}): string[] {
  return [
    input.wateredCount > 0 ? `浇水 ${input.wateredCount} 块` : null,
    input.harvestedCount > 0 ? `采摘 ${input.harvestedCount} 块` : null,
    input.rewardGold > 0 ? `金币 +${formatNumber(input.rewardGold)}` : null,
    input.intimacyGain > 0 ? `亲密度 +${formatNumber(input.intimacyGain)}` : null,
  ].filter((part): part is string => Boolean(part));
}

function isDisplayableFarmReward(reward: { kind?: string; seedId?: string }): boolean {
  return !(reward.kind === 'essence' && reward.seedId === TUTORIAL_STARTER_SEED_ID);
}

function getRewardBubbleTone(reward: { kind?: string }): RewardBubbleItem['tone'] {
  if (reward.kind === 'essence' || reward.kind === 'seed') {
    return 'essence';
  }
  if (reward.kind?.startsWith('spirit-') || reward.kind?.includes('soul')) {
    return 'spirit';
  }
  return 'item';
}

function formatProtectionCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(totalSeconds, 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function findResourceByTone(tone: HomeSummaryResponse['resources'][number]['tone'], resources: HomeSummaryResponse['resources']): HomeSummaryResponse['resources'][number] | undefined {
  return resources.find((resource) => resource.tone === tone);
}

function formatReadSource(status: ClientReadSourceStatus): string {
  return status.source === 'api' ? '实时接口' : `本地演示数据${status.fallbackReason ? `（${status.fallbackReason}）` : ''}`;
}

function getFactionBackground(factionName: string): string {
  return factionBackgroundMap[factionName] ?? factionBackgroundMap['人界'];
}

function getSceneBackground(scene: ClientSceneKey, factionName: string): string {
  if (scene === 'home') {
    return getFactionBackground(factionName);
  }

  return sceneBackgroundMap[scene];
}

function resolveRaidTargetByContext(targets: ClientRaidTarget[], context?: string): ClientRaidTarget | null {
  if (!context) {
    return targets[0] ?? null;
  }

  const matchedTarget = targets.find((target) => target.id === context || context.includes(target.name));
  return matchedTarget ?? targets[0] ?? null;
}

function readCampaignIdFromFriendInviteUrl(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).searchParams.get('campaignId');
  } catch {
    return null;
  }
}

function mapNotificationAttachmentToRewardItem(attachment: ClientNotificationItem['attachments'][number]): SeedRewardModalItem {
  if (attachment.kind === 'seed') {
    return {
      seedId: attachment.seedId,
      label: attachment.label,
      quantity: attachment.quantity,
    };
  }

  return {
    itemId: attachment.kind,
    label: attachment.label,
    quantity: attachment.quantity,
  };
}

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
  const [socialSummary, setSocialSummary] = useState<ClientSocialSummaryResponse | null>(null);
  const [socialFeed, setSocialFeed] = useState<ClientSocialFeedItem[]>([]);
  const [socialFriends, setSocialFriends] = useState<ClientSocialRelationItem[]>([]);
  const [socialFollowing, setSocialFollowing] = useState<ClientSocialRelationItem[]>([]);
  const [socialEnemies, setSocialEnemies] = useState<ClientSocialRelationItem[]>([]);
  const [socialFieldVisit, setSocialFieldVisit] = useState<ClientSocialFriendFieldVisitResponse | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [shareAssistDemo, setShareAssistDemo] = useState<ShareAssistDemoState | null>(null);
  const [pendingShareInvite, setPendingShareInvite] = useState<PendingShareInviteState | null>(null);
  const [pendingFriendInvite, setPendingFriendInvite] = useState<PendingFriendInviteState | null>(null);
  const [returningFriendInvitePrompt, setReturningFriendInvitePrompt] = useState<ReturningFriendInvitePromptState | null>(null);
  const [friendInviteDemoLinks, setFriendInviteDemoLinks] = useState<{ newUser: string; returningUser: string } | null>(null);
  const [friendInviteNewUserUrlInput, setFriendInviteNewUserUrlInput] = useState('');
  const [friendInviteReturningUserUrlInput, setFriendInviteReturningUserUrlInput] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [rewardBubbles, setRewardBubbles] = useState<RewardBubbleItem[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationList, setNotificationList] = useState<ClientNotificationListResponse | null>(null);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [notificationActionId, setNotificationActionId] = useState<string | null>(null);
  const [selectedRaidTargetId, setSelectedRaidTargetId] = useState<string>('');
  const [raidTargetModal, setRaidTargetModal] = useState<RaidTargetModalState | null>(null);
  const [raidTargetDetail, setRaidTargetDetail] = useState<ClientRaidTargetDetailResponse | null>(null);
  const [raidTargetDetailLoading, setRaidTargetDetailLoading] = useState(false);
  const [raidTargetDetailError, setRaidTargetDetailError] = useState<string | null>(null);
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
  const [followedTargetIds, setFollowedTargetIds] = useState<string[]>([]);
  const [raidTargetDetailsById, setRaidTargetDetailsById] = useState<Record<string, ClientRaidTargetDetailResponse>>({});
  const [globalFeatureModal, setGlobalFeatureModal] = useState<GlobalFeatureModalState | null>(null);
  const [globalUnlockModal, setGlobalUnlockModal] = useState<GlobalUnlockModalState | null>(null);
  const [seasonSignInState, setSeasonSignInState] = useState<ClientSeasonSignInState | null>(null);
  const characterDialog = useCharacterDialog();
  const { playDialogScene } = characterDialog;
  const characterDialogPortalRef = useRef<HTMLDivElement | null>(null);
  const welcomeDialogSessionIdRef = useRef<string | null>(null);
  const farmEnterDialogRef = useRef<{ sceneId: string; at: number } | null>(null);
  const socialAssistBusyRef = useRef(false);

  const showToast = (message: string, tone: ToastState['tone'] = 'info'): void => {
    setToast({
      id: Date.now(),
      message,
      tone,
    });
  };

  const showRewardBubbles = (items: Array<Omit<RewardBubbleItem, 'id'>>): void => {
    const visibleItems = items.filter((item) => item.quantity > 0);
    if (visibleItems.length === 0) {
      return;
    }

    const now = Date.now();
    const nextBubbles = visibleItems.map((item, index) => ({
      ...item,
      id: now + index,
    }));
    setRewardBubbles((current) => [...current, ...nextBubbles].slice(-5));
  };

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
        const unread = await loadUnreadNotificationCount();
        setNotificationUnreadCount(unread.unreadCount);
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

  const getPreferredSeedId = (): string => (
    unlockedSeedIds.find((seedId) => seedId !== TUTORIAL_STARTER_SEED_ID && (seedInventory[seedId] ?? 0) > 0)
    ?? unlockedSeedIds.find((seedId) => seedId !== TUTORIAL_STARTER_SEED_ID)
    ?? unlockedSeedIds[0]
    ?? 'qinglingmai'
  );

  const cacheRaidTargetDetail = (detail: ClientRaidTargetDetailResponse): void => {
    setRaidTargetDetailsById((current) => ({
      ...current,
      [detail.targetId]: detail,
    }));
  };

  const patchRaidTargetPreview = (
    targetId: string,
    mainPetPreview: ClientRaidTarget['mainPetPreview'],
  ): void => {
    setViewModel((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        scenes: {
          ...current.scenes,
          raid: {
            ...current.scenes.raid,
            targets: current.scenes.raid.targets.map((target) => (
              target.id === targetId
                ? {
                  ...target,
                  mainPetPreview,
                }
                : target
            )),
          },
        },
      };
    });

    setRaidTargetDetailsById((current) => {
      const existing = current[targetId];

      if (!existing) {
        return current;
      }

      return {
        ...current,
        [targetId]: {
          ...existing,
          mainPetPreview,
        },
      };
    });

    setRaidTargetDetail((current) => (current?.targetId === targetId
      ? {
        ...current,
        mainPetPreview,
      }
      : current));
  };

  const replaceRaidTargetDetail = (detail: ClientRaidTargetDetailResponse): void => {
    cacheRaidTargetDetail(detail);
    patchRaidTargetPreview(detail.targetId, detail.mainPetPreview);

    setViewModel((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        scenes: {
          ...current.scenes,
          raid: {
            ...current.scenes.raid,
            targets: current.scenes.raid.targets.map((target) => (
              target.id === detail.targetId
                ? {
                  ...target,
                  name: detail.name,
                  faction: detail.faction,
                  level: detail.level,
                  mainPetPreview: detail.mainPetPreview,
                }
                : target
            )),
          },
        },
      };
    });
  };

  const refreshRaidTargetDetail = async (targetId: string): Promise<void> => {
    try {
      const detail = await loadRaidTargetDetail(targetId);
      replaceRaidTargetDetail(detail);
    } catch {
      // 只刷新当前目标，失败时保留旧缓存，避免影响整个列表。
    }
  };

  const syncSeedBackpackState = (backpack: ClientViewModel['bootstrap']['backpack']): void => {
    const mergedUnlockedSeedIds = Array.from(new Set(backpack.unlockedSeedIds));

    setSeedInventory({
      ...emptySeedInventory,
      ...backpack.seedInventory,
    });
    setGlobalItemInventory({
      ...emptyGlobalItemInventory,
      ...backpack.globalItemInventory,
    });
    setUnlockedSeedIds(mergedUnlockedSeedIds);
    setPlantResearchState(backpack.plantResearch ?? {});
    if (!mergedUnlockedSeedIds.includes(selectedSeedId)) {
      setSelectedSeedId(mergedUnlockedSeedIds[0] ?? 'qilingya');
    }
  };

  const applyClientViewModel = (data: ClientViewModel): void => {
    setViewModel(data);
    setSelectedRaidTargetId(data.scenes.raid.targets[0]?.id ?? '');
    syncSeedBackpackState(data.bootstrap.backpack);
  };

  const applyClientBundle = (data: { viewModel: ClientViewModel; spirit: ClientSpiritState; farmBoard: ClientFarmBoardState; seasonSignIn: ClientSeasonSignInState }): void => {
    applyClientViewModel(data.viewModel);
    setSeasonSignInState(data.seasonSignIn);
    setSpiritState(data.spirit);
    setGlobalItemInventory((current) => ({
      ...current,
      tianjiTalisman: data.spirit.tianjiTalisman,
    }));
    setFarmBoard(data.farmBoard);
  };

  const resetNotificationState = (): void => {
    setNotificationsOpen(false);
    setNotificationList(null);
    setNotificationUnreadCount(0);
    setNotificationBusy(false);
    setNotificationError(null);
    setNotificationActionId(null);
  };

  const refreshNotificationUnreadCount = async (): Promise<void> => {
    try {
      const result = await loadUnreadNotificationCount();
      setNotificationUnreadCount(result.unreadCount);
    } catch {
      setNotificationUnreadCount(0);
    }
  };

  const loadNotificationPage = async (page = 1): Promise<void> => {
    setNotificationBusy(true);
    setNotificationError(null);

    try {
      const result = await loadNotifications(page, 10);
      setNotificationList(result);
      setNotificationUnreadCount(result.unreadCount);
    } catch {
      setNotificationError('当前无法读取消息中心，请稍后重试。');
    } finally {
      setNotificationBusy(false);
    }
  };

  const handleOpenNotifications = (): void => {
    setNotificationsOpen(true);
    void loadNotificationPage(1);
  };

  const resetSocialState = (): void => {
    setSocialSummary(null);
    setSocialFeed([]);
    setSocialFriends([]);
    setSocialFollowing([]);
    setSocialEnemies([]);
    setSocialFieldVisit(null);
    setSocialError(null);
    setSocialLoading(false);
  };

  const loadSocialBundle = async (): Promise<void> => {
    setSocialLoading(true);
    setSocialError(null);

    try {
      const [summary, feedResult, friendsResult, followingResult, enemiesResult] = await Promise.all([
        loadSocialSummary(),
        loadSocialFeed(),
        loadSocialRelations('friends'),
        loadSocialRelations('following'),
        loadSocialRelations('enemies'),
      ]);

      setSocialSummary(summary);
      setSocialFeed(feedResult.items);
      setSocialFriends(friendsResult.items);
      setSocialFollowing(followingResult.items);
      setSocialEnemies(enemiesResult.items);
    } catch (error) {
      setSocialError(error instanceof Error && error.message ? error.message : '当前无法读取社交数据，请稍后重试。');
    } finally {
      setSocialLoading(false);
    }
  };

  const handleOpenSocialFieldVisit = async (targetPlayerId: string): Promise<void> => {
    if (socialLoading) {
      return;
    }

    setSocialLoading(true);
    setSocialError(null);

    try {
      const visit = await visitSocialFriendFields(targetPlayerId);
      setSocialFieldVisit(visit);
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : '当前无法查看好友灵田，请稍后重试。', 'error');
    } finally {
      setSocialLoading(false);
    }
  };

  const handleAssistAllSocialFields = async (): Promise<void> => {
    const visit = socialFieldVisit;
    const targetPlayerId = visit?.friend.playerId;
    if (!visit || !targetPlayerId || socialLoading || socialAssistBusyRef.current) {
      return;
    }

    const actionableFields = visit.fields.filter((field) => field.nextAction === 'water' || field.nextAction === 'harvest');
    if (actionableFields.length === 0) {
      showToast('好友当前没有可助力的田地。', 'info');
      return;
    }

    socialAssistBusyRef.current = true;
    setSocialLoading(true);
    setSocialError(null);

    let wateredCount = 0;
    let harvestedCount = 0;
    let rewardGold = 0;
    let intimacyGain = 0;
    let latestCounts: ClientSocialSummaryResponse['counts'] | null = null;
    const failedMessages: string[] = [];

    try {
      for (const field of actionableFields) {
        try {
          if (field.nextAction === 'water') {
            const result = await waterSocialField({ targetPlayerId, fieldSlotId: field.fieldSlotId });
            wateredCount += 1;
            intimacyGain += result.intimacyGain;
            latestCounts = result.counts;
            continue;
          }

          if (field.nextAction === 'harvest') {
            const result = await harvestSocialField({ targetPlayerId, fieldSlotId: field.fieldSlotId });
            harvestedCount += 1;
            rewardGold += result.rewards?.reduce((sum, reward) => sum + (reward.kind === 'gold' ? reward.quantity : 0), 0) ?? 0;
            intimacyGain += result.intimacyGain;
            latestCounts = result.counts;
          }
        } catch (error) {
          failedMessages.push(error instanceof Error && error.message ? error.message : `${field.fieldCode} 助力失败`);
        }
      }

      if (latestCounts) {
        const counts = latestCounts;
        setSocialSummary((current) => current ? { ...current, counts } : current);
      }
      const refreshedVisit = await visitSocialFriendFields(targetPlayerId);
      setSocialFieldVisit(refreshedVisit);

      const summaryParts = formatSocialAssistSummary({ wateredCount, harvestedCount, rewardGold, intimacyGain });

      if (summaryParts.length > 0) {
        showToast(`一键助力完成：${summaryParts.join('，')}。`, failedMessages.length > 0 ? 'info' : 'success');
      } else {
        showToast(failedMessages[0] ?? '当前没有成功助力的田地。', 'info');
      }

      if (failedMessages.length > 0 && summaryParts.length > 0) {
        showToast(`部分田地未完成：${failedMessages[0]}`, 'info');
      }

      void loadSocialBundle();
    } finally {
      socialAssistBusyRef.current = false;
      setSocialLoading(false);
    }
  };

  const handleSocialFriendRequest = async (targetPlayerId: string): Promise<void> => {
    if (socialLoading) {
      return;
    }

    setSocialLoading(true);
    setSocialError(null);

    try {
      const result = await requestSocialFriend({ targetPlayerId });
      showToast(result.summary, 'success');
      void loadSocialBundle();
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : '当前无法发送好友申请，请稍后重试。', 'error');
    } finally {
      setSocialLoading(false);
    }
  };

  const handleAcceptSocialFriendRequest = async (relationId: string): Promise<void> => {
    if (socialLoading) {
      return;
    }

    setSocialLoading(true);
    setSocialError(null);

    try {
      const result = await acceptSocialFriendRequest(relationId);
      showToast(result.summary, 'success');
      void loadSocialBundle();
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : '当前无法确认好友申请，请稍后重试。', 'error');
    } finally {
      setSocialLoading(false);
    }
  };

  const handleRejectSocialFriendRequest = async (relationId: string): Promise<void> => {
    if (socialLoading) {
      return;
    }

    setSocialLoading(true);
    setSocialError(null);

    try {
      const result = await rejectSocialFriendRequest(relationId);
      showToast(result.summary, 'success');
      void loadSocialBundle();
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : '当前无法处理好友申请，请稍后重试。', 'error');
    } finally {
      setSocialLoading(false);
    }
  };

  const handleDeleteSocialFriend = async (targetPlayerId: string): Promise<void> => {
    if (socialLoading) {
      return;
    }

    setSocialLoading(true);
    setSocialError(null);

    try {
      const result = await deleteSocialFriend(targetPlayerId);
      showToast(result.summary, 'success');
      void loadSocialBundle();
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : '当前无法删除好友，请稍后重试。', 'error');
    } finally {
      setSocialLoading(false);
    }
  };

  const handleMarkNotificationRead = async (notificationId: string): Promise<void> => {
    setNotificationActionId(`read:${notificationId}`);
    try {
      const result = await markNotificationAsRead(notificationId);
      setNotificationUnreadCount(result.unreadCount);
      setNotificationList((current) => current ? {
        ...current,
        unreadCount: result.unreadCount,
        items: current.items.map((item) => item.id === notificationId ? { ...item, read: true, readAt: result.readAt, canDelete: true } : item),
      } : current);
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : '当前无法标记消息已读，请稍后重试。', 'error');
    } finally {
      setNotificationActionId(null);
    }
  };

  const handleOpenNotificationClaim = (notificationId: string): void => {
    const notification = notificationList?.items.find((item) => item.id === notificationId);
    if (!notification || notification.attachments.length <= 0) {
      showToast('这条通知没有可领取附件。', 'error');
      return;
    }

    setNotificationsOpen(false);
    setSeedRewardModal({
      title: notification.title || '领取附件',
      summary: '确认后将以下附件入账。',
      confirmAction: 'claim-notification',
      notificationId,
      items: notification.attachments.map(mapNotificationAttachmentToRewardItem),
    });
  };

  const handleConfirmNotificationClaim = async (): Promise<void> => {
    const notificationId = seedRewardModal?.notificationId;
    if (!notificationId) {
      setSeedRewardModal(null);
      return;
    }

    setNotificationActionId(`claim:${notificationId}`);
    try {
      const result = await claimNotification(notificationId);
      const [nextViewModel, nextSpirit] = await Promise.all([
        loadClientViewModel(),
        loadSpiritState(),
      ]);

      setNotificationUnreadCount(result.unreadCount);
      setNotificationList((current) => current ? {
        ...current,
        unreadCount: result.unreadCount,
        items: current.items.map((item) => item.id === notificationId ? {
          ...item,
          claimStatus: result.claimStatus,
          claimedAt: result.claimedAt,
          canDelete: true,
        } : item),
      } : current);
      setViewModel(nextViewModel);
      syncSeedBackpackState(nextViewModel.bootstrap.backpack);
      setSpiritState(nextSpirit);
      setGlobalItemInventory((current) => ({
        ...current,
        tianjiTalisman: nextSpirit.tianjiTalisman,
      }));
      setSeedRewardModal(null);
      showToast(result.summary, 'success');
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : '当前无法领取附件，请稍后重试。', 'error');
    } finally {
      setNotificationActionId(null);
    }
  };

  const handleDeleteNotification = async (notificationId: string): Promise<void> => {
    setNotificationActionId(`delete:${notificationId}`);
    try {
      const result = await deleteNotification(notificationId);
      setNotificationUnreadCount(result.unreadCount);
      setNotificationList((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          unreadCount: result.unreadCount,
          pagination: {
            ...current.pagination,
            total: Math.max(current.pagination.total - 1, 0),
          },
          items: current.items.filter((item) => item.id !== notificationId),
        };
      });
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : '当前无法删除消息，请稍后重试。', 'error');
    } finally {
      setNotificationActionId(null);
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

  const handleAssistSocialFriend = async (targetPlayerId: string): Promise<void> => {
    if (socialLoading || socialAssistBusyRef.current) {
      return;
    }

    socialAssistBusyRef.current = true;
    setSocialLoading(true);
    setSocialError(null);

    try {
      const visit = await visitSocialFriendFields(targetPlayerId);
      const actionableFields = visit.fields.filter((field) => field.nextAction === 'water' || field.nextAction === 'harvest');
      if (actionableFields.length === 0) {
        showToast('好友当前没有可助力的田地。', 'info');
        void loadSocialBundle();
        return;
      }

      let wateredCount = 0;
      let harvestedCount = 0;
      let rewardGold = 0;
      let intimacyGain = 0;
      let latestCounts: ClientSocialSummaryResponse['counts'] | null = null;
      const failedMessages: string[] = [];

      for (const field of actionableFields) {
        try {
          if (field.nextAction === 'water') {
            const result = await waterSocialField({ targetPlayerId, fieldSlotId: field.fieldSlotId });
            wateredCount += 1;
            intimacyGain += result.intimacyGain;
            latestCounts = result.counts;
            continue;
          }

          const result = await harvestSocialField({ targetPlayerId, fieldSlotId: field.fieldSlotId });
          harvestedCount += 1;
          rewardGold += result.rewards?.reduce((sum, reward) => sum + (reward.kind === 'gold' ? reward.quantity : 0), 0) ?? 0;
          intimacyGain += result.intimacyGain;
          latestCounts = result.counts;
        } catch (error) {
          failedMessages.push(error instanceof Error && error.message ? error.message : `${field.fieldCode} 助力失败`);
        }
      }

      if (latestCounts) {
        const counts = latestCounts;
        setSocialSummary((current) => current ? { ...current, counts } : current);
      }

      const summaryParts = formatSocialAssistSummary({ wateredCount, harvestedCount, rewardGold, intimacyGain });

      if (summaryParts.length > 0) {
        showToast(`一键助力完成：${summaryParts.join('，')}。`, failedMessages.length > 0 ? 'info' : 'success');
      } else {
        showToast(failedMessages[0] ?? '当前没有成功助力的田地。', 'info');
      }

      if (failedMessages.length > 0 && summaryParts.length > 0) {
        showToast(`部分田地未完成：${failedMessages[0]}`, 'info');
      }

      void loadSocialBundle();
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : '当前无法完成一键助力，请稍后重试。', 'error');
    } finally {
      socialAssistBusyRef.current = false;
      setSocialLoading(false);
    }
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
      setShareAssistDemo({
        audience,
        kind: 'water',
        status: publicCampaign.campaign.status === 'expired' ? 'expired' : publicCampaign.campaign.status === 'full' ? 'full' : 'pending',
        campaignId: created.campaign.id,
        campaign: publicCampaign,
        error: null,
      });
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
        setShareAssistDemo({
          audience,
          kind: 'friend_invite',
          status: publicCampaign.campaign.status === 'expired' ? 'expired' : publicCampaign.campaign.status === 'full' ? 'full' : 'pending',
          campaignId,
          campaign: publicCampaign,
          error: null,
        });
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
      const baseUrl = `${origin}/?invite=friend&campaignId=${encodeURIComponent(created.campaign.id)}`;
      setFriendInviteDemoLinks({
        newUser: `${baseUrl}&audience=new-user`,
        returningUser: `${baseUrl}&audience=returning-user`,
      });
      setFriendInviteNewUserUrlInput(`${baseUrl}&audience=new-user`);
      setFriendInviteReturningUserUrlInput(`${baseUrl}&audience=returning-user`);
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
        loadSocialBundle(),
        refreshNotificationUnreadCount(),
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

      setShareAssistDemo((current) => current ? {
        ...current,
        status: result.nextAction === 'expired' ? 'expired' : result.nextAction === 'full' ? 'full' : 'completed',
        campaign: { app: result.app, campaign: result.campaign, copy: current.campaign?.copy ?? {
          title: `${result.campaign.owner.nickname}邀请你帮 TA 浇水`,
          description: '帮 TA 浇一次水，可以缩短田地成长时间。',
          actionLabel: '帮 TA 浇水',
        } },
        error: null,
      } : current);
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
    setSelectedRaidTargetId('');
    setRaidTargetModal(null);
    setRaidTargetDetail(null);
    setRaidTargetDetailError(null);
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
    resetNotificationState();
    resetSocialState();
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
      resetSocialState();
      return;
    }

    void loadSocialBundle();
  }, [loginSession]);

  useEffect(() => {
    if (!loginSession || activeScene !== 'social') {
      return;
    }

    void loadSocialBundle();
  }, [activeScene, loginSession]);

  useEffect(() => {
    if (!loginSession) {
      resetNotificationState();
      return;
    }

    void refreshNotificationUnreadCount();
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
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast((current) => current?.id === toast.id ? null : current);
    }, 2400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  useEffect(() => {
    if (rewardBubbles.length === 0) {
      return;
    }

    const oldestBubbleId = rewardBubbles[0]?.id;
    const timer = window.setTimeout(() => {
      setRewardBubbles((current) => current.filter((bubble) => bubble.id !== oldestBubbleId));
    }, 2200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [rewardBubbles]);

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
    if (!raidTargetModal) {
      setRaidTargetDetail(null);
      setRaidTargetDetailError(null);
      setRaidTargetDetailLoading(false);
      return;
    }

    const cachedDetail = raidTargetDetailsById[raidTargetModal.targetId];
    if (cachedDetail) {
      setRaidTargetDetail(cachedDetail);
      setRaidTargetDetailError(null);
      setRaidTargetDetailLoading(false);
      return;
    }

    let active = true;
    setRaidTargetDetailLoading(true);
    setRaidTargetDetailError(null);

    void loadRaidTargetDetail(raidTargetModal.targetId).then((detail) => {
      if (!active) {
        return;
      }

      cacheRaidTargetDetail(detail);
      setRaidTargetDetail(detail);
    }).catch(() => {
      if (!active) {
        return;
      }

      setRaidTargetDetailError('当前无法读取对手详情，请稍后重试。');
    }).finally(() => {
      if (!active) {
        return;
      }

      setRaidTargetDetailLoading(false);
    });

    return () => {
      active = false;
    };
  }, [raidTargetDetailsById, raidTargetModal]);

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
          <ShareAssistPage
            audience={shareAssistDemo.audience}
            campaign={shareAssistDemo.campaign}
            error={shareAssistDemo.error}
            kind={shareAssistDemo.kind}
            onBack={() => setShareAssistDemo(null)}
            onConfirm={() => {
              void handleConfirmShareAssistDemo();
            }}
            onSuccessExit={() => {
              void handleShareAssistSuccessExit(shareAssistDemo.audience);
            }}
            status={shareAssistDemo.status}
          />
        </CharacterDialogProvider>
      );
    }

    if (!loginSession) {
      return (
        <main className="loading-shell auth-shell">
          <section className="loading-panel auth-panel">
            <p className="eyebrow">TRINITY WAR</p>
            {authScreen === 'faction-select' ? (
              <>
                <h1>选择阵营</h1>
                {pendingFriendInvite ? (
                  <div className="auth-invite-faction-notice">
                    <span>邀请你的玩家</span>
                    <strong>{pendingFriendInvite.inviterName} · {pendingFriendInvite.inviterFactionName}</strong>
                    <p>这是一条单人好友邀请。选择任意阵营都可以成为好友；选择同阵营只是更方便后续阵营协作。</p>
                  </div>
                ) : (
                  <p className="panel-text">这是用户第一次进入时看到的页面。先确定阵营，再创建新档案进入首页。</p>
                )}
                <div className="auth-faction-page-grid">
                  {factionChoiceCards.map((faction) => {
                    const matchesInviteFaction = pendingFriendInvite?.inviterFactionCode === faction.code;
                    const differsFromInviteFaction = Boolean(pendingFriendInvite && !matchesInviteFaction);

                    return (
                    <article
                      key={faction.code}
                      className={`auth-faction-card auth-faction-page-card ${pendingNewUserFaction === faction.code ? 'is-selected' : ''} ${matchesInviteFaction ? 'is-invite-recommended' : ''} ${differsFromInviteFaction ? 'is-invite-mismatch' : ''}`}
                      onClick={() => {
                        if (loginLoadingMode !== null) {
                          return;
                        }
                        setPendingNewUserFaction(faction.code);
                      }}
                      onKeyDown={(event) => {
                        if (loginLoadingMode !== null || (event.key !== 'Enter' && event.key !== ' ')) {
                          return;
                        }
                        event.preventDefault();
                        setPendingNewUserFaction(faction.code);
                      }}
                      role="button"
                      tabIndex={loginLoadingMode !== null ? -1 : 0}
                    >
                      <div className="auth-faction-card-head">
                        <span>{faction.name}</span>
                        <strong>{faction.title}</strong>
                      </div>
                      {pendingFriendInvite ? (
                        <div className={`auth-faction-invite-hint ${matchesInviteFaction ? 'match' : 'mismatch'}`}>
                          {matchesInviteFaction ? '推荐：与邀请人同阵营，后续协作更顺手' : '可选：不同阵营也会成为好友'}
                        </div>
                      ) : null}
                      <p>{faction.leaderSummary}</p>
                      <ul>
                        {faction.traits.map((trait) => (
                          <li key={trait}>{trait}</li>
                        ))}
                      </ul>
                    </article>
                    );
                  })}
                </div>
                <div className="auth-faction-page-actions">
                  <button
                    className="secondary-button"
                    disabled={loginLoadingMode !== null}
                    onClick={() => {
                      setAuthScreen('account-select');
                    }}
                    type="button"
                  >
                    返回
                  </button>
                  <button
                    className="primary-button"
                    disabled={loginLoadingMode !== null}
                    onClick={() => {
                      void handleDevLogin('new-user', { factionCode: pendingNewUserFaction });
                    }}
                    type="button"
                  >
                    {loginLoadingMode === 'new-user' ? '创建中...' : `以${factionChoiceCards.find((item) => item.code === pendingNewUserFaction)?.name ?? '该阵营'}创建新档案`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="auth-browser-layout">
                  <section className="auth-account-column">
                    <h1>选择账号入口</h1>
                    <p className="panel-text">已有档案和验证账号从这里进入。新用户建档入口在阵营选择页。</p>
                    <div className="auth-choice-grid">
                      <button
                        className="auth-choice-button primary-choice"
                        disabled={loginLoadingMode !== null}
                        onClick={() => {
                          setAuthScreen('faction-select');
                        }}
                        type="button"
                      >
                        <span>新用户</span>
                        <strong>前往阵营选择</strong>
                      </button>
                      <button
                        className="auth-choice-button"
                        disabled={loginLoadingMode !== null}
                        onClick={() => {
                          void handleDevLogin('existing-user');
                        }}
                        type="button"
                      >
                        <span>我是已注册用户</span>
                        <strong>{loginLoadingMode === 'existing-user' ? '登录中...' : '进入已有档案'}</strong>
                      </button>
                      <button
                        className="auth-choice-button"
                        disabled={loginLoadingMode !== null}
                        onClick={() => {
                          void handleDevLogin('test-user-1');
                        }}
                        type="button"
                      >
                        <span>验证账号</span>
                        <strong>{loginLoadingMode === 'test-user-1' ? '登录中...' : '测试用户1'}</strong>
                      </button>
                      <button
                        className="auth-choice-button"
                        disabled={loginLoadingMode !== null}
                        onClick={() => {
                          void handleDevLogin('test-user-2');
                        }}
                        type="button"
                      >
                        <span>验证账号</span>
                        <strong>{loginLoadingMode === 'test-user-2' ? '登录中...' : '测试用户2'}</strong>
                      </button>
                    </div>
                  </section>
                  <section className="auth-share-assist-section">
                    <div>
                      <h2>战斗回放测试入口</h2>
                      <p>直接播放 10 回合灵宠互撞 demo，不需要先登录账号。</p>
                    </div>
                    <div className="auth-share-assist-grid">
                      <button className="primary-button" onClick={handleOpenBattleDemo} type="button">
                        打开战斗测试
                      </button>
                    </div>
                  </section>
                  <section className="auth-share-assist-section">
                    <div>
                      <h2>微信助力测试入口</h2>
                      <p>模拟玩家从微信分享链接进入。被助力人固定为“已注册用户”，助力者分新用户和老用户两种路径。</p>
                    </div>
                    <div className="auth-share-assist-grid">
                      <button className="primary-button" disabled={pendingActionKey === 'share-assist:create'} onClick={() => { void handleOpenShareAssistDemo('new-user'); }} type="button">
                        新用户助力浇水流程
                      </button>
                      <button className="primary-button" disabled={pendingActionKey === 'share-assist:create'} onClick={() => { void handleOpenShareAssistDemo('returning-user'); }} type="button">
                        老用户助力浇水流程
                      </button>
                    </div>
                  </section>
                  <section className="auth-share-assist-section auth-friend-invite-section">
                    <div>
                      <h2>微信好友邀请测试入口</h2>
                      <p>URL 只标识“哪位玩家发起邀请”。测试时由下面两个入口决定新玩家或老玩家；老玩家固定使用测试用户1。</p>
                    </div>
                    <div className="auth-friend-invite-paste-grid">
                      <label>
                        <span>新玩家邀请 URL</span>
                        <input
                          onChange={(event) => setFriendInviteNewUserUrlInput(event.target.value)}
                          placeholder="粘贴好友邀请 URL"
                          value={friendInviteNewUserUrlInput}
                        />
                        <button className="secondary-button" disabled={loginLoadingMode !== null} onClick={() => handleSubmitFriendInviteUrl(friendInviteNewUserUrlInput, 'new-user')} type="button">
                          新玩家接受邀请并建档
                        </button>
                      </label>
                      <label>
                        <span>老玩家邀请 URL</span>
                        <input
                          onChange={(event) => setFriendInviteReturningUserUrlInput(event.target.value)}
                          placeholder="粘贴好友邀请 URL"
                          value={friendInviteReturningUserUrlInput}
                        />
                        <button className="secondary-button" disabled={loginLoadingMode !== null} onClick={() => handleSubmitFriendInviteUrl(friendInviteReturningUserUrlInput, 'returning-user')} type="button">
                          老友回归并肩同行
                        </button>
                      </label>
                    </div>
                  </section>
                </div>
              </>
            )}
            {loginError ? <p className="auth-error">{loginError}</p> : null}
            {toast ? (
              <div className={`top-toast top-toast-${toast.tone}`}>
                <span>{toast.message}</span>
              </div>
            ) : null}
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
          </section>
        </main>
      );
    }

    return (
      <main className="loading-shell">
        <section className="loading-panel">
          <p className="eyebrow">TRINITY WAR</p>
          <h1>验证前端加载中</h1>
          <p className="panel-text">正在读取客户端验证数据与页面结构。</p>
        </section>
      </main>
    );
  }

  const { bootstrap, home, scenes, usingMock, sources } = viewModel;
  const selectedRaidTarget = scenes.raid.targets.find((target) => target.id === selectedRaidTargetId) ?? scenes.raid.targets[0];
  const isTutorialUser = isNewUserInTutorial(loginSession, tutorialStage);
  const mergedReportEntries = [...scenes.report.attack, ...scenes.report.defense]
    .filter((entry) => entry.title !== '系统结算')
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const visibleRaidTargets = scenes.raid.targets.slice(0, isTutorialUser ? 1 : 3);
  const raidBattleLimit = 5;
  const raidBattleUsed = Math.min(mergedReportEntries.length, raidBattleLimit);
  const activeBackgroundImage = `url(${getSceneBackground(activeScene, home.factionName)})`;
  const tutorialUiRules = getTutorialUiRules(tutorialStage, isTutorialUser);
  const vaultResource = findResourceByTone('vault', home.resources);
  const devLoginModeLabel = getDevLoginModeLabel(loginSession?.mode);
  const currentAccountName = loginSession?.player.nickname ?? home.playerName;
  const tutorialTask = buildTutorialTask(tutorialStage);
  const vaultProgress = vaultResource ? parseCapacityResourceValue(vaultResource.value) : { current: 0, capacity: 0, ratio: 0 };
  const seasonProgress = buildSeasonProgress(bootstrap.season);
  const seasonSignInDays = seasonSignInState?.days ?? [];
  const seasonSignInClaimedToday = seasonSignInState?.claimedToday ?? true;
  const seasonSignInTodayReward = seasonSignInState?.todayReward ?? 0;
  const seasonSignInMilestones = seasonSignInState?.milestones ?? [];
  const seasonSignInRecord = {
    claimedDays: seasonSignInState?.claimedDays ?? [],
  };
  const tianjiTalismanCount = spiritState?.tianjiTalisman ?? globalItemInventory.tianjiTalisman ?? 0;
  const visibleSeedCatalog = playableSeedCatalog;
  const seedCatalogMap = new Map(seedCatalog.map((seed) => [seed.id, seed]));
  const seedGroups = (['common', 'rare', 'legendary'] as const).map((rarity) => ({
    rarity,
    label: seedRarityLabels[rarity],
    seeds: visibleSeedCatalog.filter((seed) => seed.rarity === rarity).sort(compareSeedCatalogItems).map((seed) => ({
      ...seed,
      unlocked: unlockedSeedIds.includes(seed.id),
      quantity: seedInventory[seed.id] ?? 0,
      research: plantResearchState[seed.id] ?? buildLocalPlantResearchState(seed.id, unlockedSeedIds.includes(seed.id), seedInventory[seed.id] ?? 0),
    })),
  }));
  const selectedSeedCodexItem = seedCodexState
    ? seedGroups.flatMap((group) => group.seeds).find((seed) => seed.id === seedCodexState.selectedSeedId) ?? null
    : null;
  const firstVisibleUnlockedSeedId = seedGroups.flatMap((group) => group.seeds).find((seed) => seed.unlocked)?.id
    ?? visibleSeedCatalog[0]?.id
    ?? 'qinglingmai';
  const topSpiritCodexSelectedId = topSpiritCodexSpiritId
    ?? spiritState?.codex.find((entry) => entry.hasSeen || entry.ownedEver || entry.shardCount > 0 || entry.ownedCurrent)?.spiritId
    ?? spiritState?.codex[0]?.spiritId
    ?? null;
  const spiritStableFull = spiritState ? spiritState.slots.filter((slot) => slot.spiritId).length >= spiritState.slots.length : false;
  const raidShardResourceItems: BackpackResourceItem[] = (spiritState?.codex ?? [])
    .filter((entry) => entry.hasSeen || entry.ownedEver || entry.ownedCurrent || entry.shardCount > 0)
    .sort((left, right) => {
      const rarityOrder: Record<SeedRarity, number> = { common: 0, rare: 1, legendary: 2 };
      const rarityDiff = rarityOrder[left.definition.rarity] - rarityOrder[right.definition.rarity];
      return rarityDiff !== 0 ? rarityDiff : left.definition.label.localeCompare(right.definition.label, 'zh-Hans-CN');
    })
    .map((entry) => ({
      id: `spirit-shard-${entry.spiritId}`,
      label: entry.definition.shardName,
      quantity: entry.shardCount,
      group: 'raid-shard' as const,
      rarity: entry.definition.rarity,
    }));
  const backpackResourceItems: BackpackResourceItem[] = [
    { id: 'spirit-root', label: '灵根', quantity: spiritState?.spiritRoot ?? 0, group: 'spirit', rarity: 'common' },
    { id: 'spirit-marrow', label: '灵髓', quantity: spiritState?.spiritMarrow ?? 0, group: 'spirit', rarity: 'rare' },
    { id: 'spirit-jade', label: '灵玉', quantity: spiritState?.spiritJade ?? 0, group: 'spirit', rarity: 'legendary' },
    { id: 'ordinary-soul', label: '普通兽魂', quantity: spiritState?.ordinarySoul ?? 0, group: 'soul', rarity: 'common' },
    { id: 'rare-soul', label: '稀有兽魂', quantity: spiritState?.rareSoul ?? 0, group: 'soul', rarity: 'rare' },
    { id: 'legendary-soul', label: '传说兽魂', quantity: spiritState?.legendarySoul ?? 0, group: 'soul', rarity: 'legendary' },
    ...raidShardResourceItems,
    ...visibleSeedCatalog.filter((seed) => unlockedSeedIds.includes(seed.id)).map((seed) => ({
      id: `essence-${seed.id}`,
      label: `${seed.name}精华`,
      quantity: seedInventory[seed.id] ?? 0,
      group: 'farm' as const,
      rarity: seed.rarity,
    })),
  ];
  const farmFields = scenes.farm.fields.map((field) => {
    const assignedSeedId = fieldSeedAssignments[field.id];
    const assignedSeed = assignedSeedId ? seedCatalogMap.get(assignedSeedId) : undefined;
    const localPresentation = buildLiveFarmFieldPresentation(field, farmTick);

    if (!assignedSeed || (field.tone !== 'growing' && field.tone !== 'mature' && field.tone !== 'withered')) {
      return localPresentation ? {
        ...field,
        ...localPresentation,
      } : field;
    }

    return {
      ...field,
      ...(localPresentation ?? {}),
      cropName: assignedSeed.name,
    };
  });
  const raidTargetsById = new Map(scenes.raid.targets.map((target) => [target.id, target]));

  const handleSetMainSpiritAction = async (slotIndex: number, slotVersion: number): Promise<void> => {
    if (pendingActionKey === `spirit:set-main:${slotIndex}`) {
      return;
    }

    setPendingActionKey(`spirit:set-main:${slotIndex}`);

    try {
      const result = await setMainSpirit({
        slotIndex,
        slotVersion,
      });
      applySpiritMutationResult(result);
    } catch {
      showToast('当前无法切换主位灵宠，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleRecoverSpiritAction = async (slotIndex: number, slotVersion: number): Promise<void> => {
    if (!spiritState || pendingActionKey === `spirit:recover:${slotIndex}`) {
      return;
    }

    setPendingActionKey(`spirit:recover:${slotIndex}`);

    try {
      const result = await recoverSpirit({
        slotIndex,
        slotVersion,
        resourceVersion: spiritState.resourceVersion,
      });
      applySpiritMutationResult(result);
    } catch {
      showToast('当前无法恢复灵宠，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleDissolveSpiritAction = async (slotIndex: number, slotVersion: number): Promise<void> => {
    if (pendingActionKey === `spirit:dissolve:${slotIndex}`) {
      return;
    }

    setPendingActionKey(`spirit:dissolve:${slotIndex}`);

    try {
      const result = await dissolveSpirit({
        slotIndex,
        slotVersion,
      });
      applySpiritMutationResult(result);
    } catch {
      showToast('当前无法解散灵宠，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleComposeSpiritAction = async (spiritId: string, slotIndex: number, element: ClientSpiritElement): Promise<void> => {
    if (pendingActionKey === `spirit:compose:${slotIndex}`) {
      return;
    }

    setPendingActionKey(`spirit:compose:${slotIndex}`);

    try {
      const result = await composeSpirit({
        spiritId,
        slotIndex,
        element,
      });
      applySpiritMutationResult(result);
      if (tutorialStage === 'spirit') {
        const composedSlot = result.spirit.slots.find((slot) => slot.slotIndex === slotIndex);
        const composedEntry = result.spirit.codex.find((entry) => entry.spiritId === spiritId);
        const elementLabelMap: Record<ClientSpiritElement, string> = {
          metal: '金',
          wood: '木',
          water: '水',
          fire: '火',
          earth: '土',
        };
        setGlobalUnlockModal({
          title: '灵宠已结契',
          summary: `你获得了${elementLabelMap[element]}属性灵宠 ${composedEntry?.definition.label ?? result.spirit.mainSlot?.spiritId ?? '首只灵宠'}。`,
          items: [{
            id: spiritId,
            label: composedEntry?.definition.label ?? '第一只灵宠',
            kind: 'spirit',
            description: composedSlot?.isMain ? '已入主位' : '已结契',
          }],
          afterConfirmActions: getTutorialFlowActions('spiritAwardConfirmed'),
        });
      }
    } catch {
      showToast('当前无法合成灵宠，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
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
    if (!spiritState || pendingActionKey === actionKey) {
      return;
    }

    setPendingActionKey(actionKey);

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
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleBreakthroughSpiritAction = async (slotIndex: number, slotVersion: number, targetStage?: number): Promise<void> => {
    const actionKey = `spirit:breakthrough:${slotIndex}`;
    if (!spiritState || pendingActionKey === actionKey) {
      return;
    }

    setPendingActionKey(actionKey);

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
          setSpiritState(nextSpirit);
          setGlobalItemInventory((current) => ({
            ...current,
            tianjiTalisman: nextSpirit.tianjiTalisman,
          }));
        }
        showToast('灵宠状态刚刚发生变化，已刷新数据。请重新点击突破。', 'error');
      } else if (error instanceof ApiError && error.code === 'CONFLICT') {
        showToast('当前兽魂不足，暂时无法突破。', 'error');
      } else if (error instanceof ApiError && error.message) {
        showToast(error.message, 'error');
      } else {
        showToast('当前无法突破灵宠，请确认兽魂是否足够。', 'error');
      }
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleRollSpiritTraitsAction = async (
    slotIndex: number,
    slotVersion: number,
    mode: ClientSpiritRollMode,
    options: { lockedSlotIndex?: number; targetSlotIndex?: number; targetTraitCode?: ClientSpiritTraitCode } = {},
  ): Promise<void> => {
    const actionKey = `spirit:roll:${slotIndex}:${mode}`;
    if (!spiritState || pendingActionKey === actionKey) {
      return;
    }

    setPendingActionKey(actionKey);

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
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleBuySpiritShopItemAction = async (itemId: string): Promise<void> => {
    const actionKey = `spirit:shop:${itemId}`;
    if (!spiritState || pendingActionKey === actionKey) {
      return;
    }

    setPendingActionKey(actionKey);

    try {
      const result = await buySpiritShopItem({
        itemId,
        resourceVersion: spiritState.resourceVersion,
      });
      applySpiritMutationResult(result);
      showToast(result.summary, 'success');
    } catch {
      showToast('当前无法兑换商品，请确认天机符或限购次数。', 'error');
    } finally {
      setPendingActionKey(null);
    }
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
      setGlobalItemInventory((current) => ({
        ...current,
        tianjiTalisman: result.tianjiTalisman,
      }));
      setSpiritState((current) => current ? {
        ...current,
        tianjiTalisman: result.tianjiTalisman,
        resourceVersion: result.resourceVersion,
      } : current);
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

    if (!spiritState || pendingActionKey === actionKey || usedToday >= dailyLimit) {
      return;
    }

    setPendingActionKey(actionKey);

    try {
      const result = await claimSpiritAdReward({
        resourceVersion: spiritState.resourceVersion,
      });
      applySpiritMutationResult(result);
      showToast(result.summary, 'success');
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : '当前无法领取广告奖励，可能今日次数已用完。', 'error');
    } finally {
      setPendingActionKey(null);
    }
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
      setGlobalItemInventory((current) => {
        const nextItems = { ...current };
        result.rewards
          .filter((reward) => reward.kind === 'ordinary-soul' || reward.kind === 'rare-soul' || reward.kind === 'legendary-soul')
          .forEach((reward) => {
            nextItems[reward.kind] = (nextItems[reward.kind] ?? 0) + reward.quantity;
          });
        return nextItems;
      });
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
      setViewModel((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          home: result.home,
          scenes: result.scenes,
        };
      });
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
      setSelectedSeedId(getPreferredSeedId());
      setFieldSeedAssignments({});
      setFarmCollectPresentation(null);
      setFollowedTargetIds([]);
      setRaidTargetDetailsById({});
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
      setViewModel((current) => current
        ? {
          ...current,
          home: result.home,
          scenes: result.scenes,
        }
        : current);
      setSelectedRaidTargetId(result.scenes.raid.targets[0]?.id ?? '');
      setRaidTargetDetailsById({});
      showToast(result.summary || '目标列表已刷新，可以重新挑选战斗对象。', 'success');
    } catch {
      showToast('当前无法刷新目标列表，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleOpenRaidTargetModal = (target: ClientRaidTarget): void => {
    setSelectedRaidTargetId(target.id);
    setRaidTargetModal({
      targetId: target.id,
      targetName: target.name,
      mode: 'raid',
    });
  };

  const handleCloseRaidTargetModal = (): void => {
    const targetId = raidTargetModal?.targetId;

    if (targetId) {
      setRaidTargetDetailsById((current) => {
        if (!(targetId in current)) {
          return current;
        }

        const next = { ...current };
        delete next[targetId];
        return next;
      });

      void refreshRaidTargetDetail(targetId);
    }

    setRaidTargetModal(null);
  };

  const handleToggleFollowTarget = (target: ClientRaidTarget): void => {
    const isFollowing = followedTargetIds.includes(target.id);

    setFollowedTargetIds((current) => isFollowing
      ? current.filter((targetId) => targetId !== target.id)
      : [...current, target.id]);
    showToast(isFollowing ? `已取消关注 ${target.name}。` : `已关注 ${target.name}，可在社交页的关系列表持续观察。`, 'success');
  };

  const findRaidTargetByContext = (context?: string): ClientRaidTarget | null => {
    return resolveRaidTargetByContext(scenes.raid.targets, context);
  };

  const applyMutationResult = (result: { home: HomeSummaryResponse; scenes: ClientViewModel['scenes']; summary: string }): void => {
    setViewModel((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        home: result.home,
        scenes: result.scenes,
      };
    });

    showToast(result.summary, 'success');
  };

  const applySpiritMutationResult = (result: { home: HomeSummaryResponse; scenes: ClientViewModel['scenes']; spirit: ClientSpiritState; summary: string }): void => {
    applyMutationResult(result);
    setSpiritState(result.spirit);
    setGlobalItemInventory((current) => ({
      ...current,
      tianjiTalisman: result.spirit.tianjiTalisman,
    }));
  };

  const applyLocalTianjiSpend = (costText: string): void => {
    const tianjiCost = parseTianjiCostText(costText);
    if (tianjiCost <= 0) {
      return;
    }

    setSpiritState((current) => current ? {
      ...current,
      tianjiTalisman: Math.max(current.tianjiTalisman - tianjiCost, 0),
      resourceVersion: current.resourceVersion + 1,
    } : current);
    setGlobalItemInventory((current) => ({
      ...current,
      tianjiTalisman: Math.max((current.tianjiTalisman ?? 0) - tianjiCost, 0),
    }));
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
      setSelectedSeedId(getPreferredSeedId());
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
          setSeedInventory((current) => {
            const nextInventory = { ...current };
            displayableRewards
              .filter((reward) => (((reward.kind ?? 'seed') === 'seed' || reward.kind === 'essence') && reward.seedId && reward.seedId !== TUTORIAL_STARTER_SEED_ID))
              .forEach((reward) => {
                nextInventory[reward.seedId as string] = (nextInventory[reward.seedId as string] ?? 0) + reward.quantity;
              });
            return nextInventory;
          });
          setUnlockedSeedIds((current) => {
            const nextIds = new Set(current);
            displayableRewards
              .filter((reward) => (((reward.kind ?? 'seed') === 'seed' || reward.kind === 'essence') && reward.seedId && reward.seedId !== TUTORIAL_STARTER_SEED_ID))
              .forEach((reward) => nextIds.add(reward.seedId as string));
            return Array.from(nextIds);
          });
          const spiritRewardDelta = displayableRewards.reduce((delta, reward) => {
            if (reward.kind === 'spirit-root') {
              delta.spiritRoot += reward.quantity;
            }
            if (reward.kind === 'spirit-marrow') {
              delta.spiritMarrow += reward.quantity;
            }
            if (reward.kind === 'spirit-jade') {
              delta.spiritJade += reward.quantity;
            }
            return delta;
          }, { spiritRoot: 0, spiritMarrow: 0, spiritJade: 0 });
          if (spiritRewardDelta.spiritRoot > 0 || spiritRewardDelta.spiritMarrow > 0 || spiritRewardDelta.spiritJade > 0) {
            setSpiritState((current) => current ? {
              ...current,
              spiritRoot: (current.spiritRoot ?? 0) + spiritRewardDelta.spiritRoot,
              spiritMarrow: (current.spiritMarrow ?? 0) + spiritRewardDelta.spiritMarrow,
              spiritJade: (current.spiritJade ?? 0) + spiritRewardDelta.spiritJade,
              resourceVersion: current.resourceVersion + 1,
            } : current);
          }
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
    const actionContext = context ?? raidTargetDetail?.name ?? selectedRaidTarget?.name;

    if ((action.label === '确认出兵' || action.label === '发起掠夺' || action.label === '发起战斗') && actionContext) {
      const targetId = raidTargetModal?.targetId ?? selectedRaidTarget?.id;

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
          mode: raidTargetModal?.mode ?? 'raid',
          armyVersion: home.stateVersions.armyVersion,
        };

        setPendingActionKey('raid:execute');

        try {
          const response = await raidClientTarget(input);
          const nextSpiritState = await loadSpiritState().catch(() => null);
          setViewModel((current) => {
            if (!current) {
              return current;
            }

            return {
              ...current,
              home: response.home,
              scenes: response.scenes,
            };
          });
          if (nextSpiritState) {
            setSpiritState(nextSpiritState);
            setGlobalItemInventory((current) => ({
              ...current,
              tianjiTalisman: nextSpiritState.tianjiTalisman,
            }));
          }
          setSelectedRaidTargetId(response.scenes.raid.targets[0]?.id ?? '');

          const raidRewardModal: SeedRewardModalState = {
            title: '战斗所得',
            summary: response.result.overflowGold > 0
              ? `本次战斗获得 ${formatNumber(response.result.goldLoot)} 金币，其中 ${formatNumber(response.result.depositedGold)} 已入库，另有 ${formatNumber(response.result.overflowGold)} 转入待领取，战损 ${formatNumber(response.result.casualties)} 兵。`
              : `获得 ${formatNumber(response.result.goldLoot)} 金币，战损 ${formatNumber(response.result.casualties)} 兵。`,
            items: [
              {
                seedId: 'raid-gold',
                label: '金币',
                quantity: response.result.goldLoot,
              },
              ...response.result.rewards.map((reward) => ({
                seedId: reward.seedId,
                quantity: reward.quantity,
                label: reward.label,
              })),
            ],
          };
          const settledRaidRewardModal: SeedRewardModalState = {
            ...raidRewardModal,
            title: '战斗所得',
            summary: response.result.overflowGold > 0
              ? `本次战斗获得 ${formatNumber(response.result.goldLoot)} 金币，其中 ${formatNumber(response.result.depositedGold)} 已入库，另有 ${formatNumber(response.result.overflowGold)} 转入待领取。${response.result.reportSummary}${response.result.battleEvents?.length ? ` 关键事件：${response.result.battleEvents.map((event) => event.label).join('、')}` : ''}`
              : `获得 ${formatNumber(response.result.goldLoot)} 金币。${response.result.reportSummary}${response.result.battleEvents?.length ? ` 关键事件：${response.result.battleEvents.map((event) => event.label).join('、')}` : ''}`,
            items: raidRewardModal.items.map((item) => item.seedId === 'raid-gold' ? { ...item, label: '金币' } : item),
          };

          if (response.result.rewards.length > 0) {
            setSeedInventory((current) => {
              const nextInventory = { ...current };

              response.result.rewards.forEach((reward) => {
                nextInventory[reward.seedId] = (nextInventory[reward.seedId] ?? 0) + reward.quantity;
              });

              return nextInventory;
            });
            setUnlockedSeedIds((current) => {
              const nextIds = new Set(current);
              response.result.rewards.forEach((reward) => nextIds.add(reward.seedId));
              return Array.from(nextIds);
            });
          }

          setRaidTargetModal(null);
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
        setSelectedRaidTargetId(revengeTarget.id);
        setRaidTargetModal({
          targetId: revengeTarget.id,
          targetName: revengeTarget.name,
          mode: 'revenge',
        });
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

    const nextMessage = farmBoardEditor.message.trim();
    const initialMessage = farmBoardEditor.initialMessage.trim();
    if (nextMessage === initialMessage || nextMessage.length <= 0 || Array.from(nextMessage).length > 40) {
      setFarmBoardEditor(null);
      return;
    }

    void handleSaveFarmBoard();
  };

  const handleSaveFarmBoard = async (): Promise<void> => {
    if (!farmBoardEditor || farmBoardEditor.saving) {
      return;
    }

    const nextMessage = farmBoardEditor.message.trim();
    if (nextMessage.length <= 0) {
      showToast('留言不能为空。', 'error');
      return;
    }

    if (Array.from(nextMessage).length > 40) {
      showToast('留言最多 40 个字。', 'error');
      return;
    }

    setFarmBoardEditor((current) => current ? { ...current, saving: true } : current);

    try {
      const result = await updateFarmBoard({
        message: nextMessage,
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

  const appContent = shareAssistDemo ? (
    <ShareAssistPage
      audience={shareAssistDemo.audience}
      campaign={shareAssistDemo.campaign}
      error={shareAssistDemo.error}
      kind={shareAssistDemo.kind}
      onBack={() => setShareAssistDemo(null)}
      onConfirm={() => {
        void handleConfirmShareAssistDemo();
      }}
      onSuccessExit={() => {
        void handleShareAssistSuccessExit(shareAssistDemo.audience);
      }}
      status={shareAssistDemo.status}
    />
  ) : (
    <main className="app-shell">
      <aside className="left-rail">
        <div className="brand-block">
          <p className="eyebrow">TRINITY WAR</p>
          <h1>阵营经营策略战争</h1>
          <p className="subline">Web 验证版前端，优先用于玩法、页面结构和接口走查。</p>
        </div>

        <div className="summary-card war-card">
          <p className="card-label">当前阵营</p>
          <div className="faction-row">
            <span className="faction-badge">{home.factionName}</span>
            <span className="soft-tag">领地经营</span>
          </div>
          <p className="muted">{home.playerName} · {home.staminaStatus}</p>
        </div>

        <div className="summary-card">
          <p className="card-label">关键提醒</p>
          <div className="rail-note rail-note-stack">
            <div className="rail-note-row">
              <strong>金币来源</strong>
              <span>农作物</span>
            </div>
            <div className="rail-note-row">
              <span>开田方式</span>
              <em>地契任务</em>
            </div>
            <div className="rail-note-row">
              <span>阵营收益</span>
              <em>每日俸禄</em>
            </div>
          </div>
          <button className="rail-alert" onClick={() => {
            navigateToScene('report', 'reports');
            showToast('最近 1 次被挑战已解锁免费复仇，已切到探索模块的战报页签。');
          }} type="button">
            探索动态 2
          </button>
        </div>

        <div className="summary-card meta-card">
          <p className="card-label">运行状态</p>
          <div className="meta-row"><span>环境</span><strong>{bootstrap.env}</strong></div>
          <div className="meta-row"><span>版本</span><strong>{bootstrap.version}</strong></div>
          <div className="meta-row"><span>时间</span><strong>{formatServerTime(bootstrap.serverTime)}</strong></div>
          <div className="meta-row"><span>数据源</span><strong>{usingMock ? '本地演示数据' : '实时接口'}</strong></div>
          <div className="meta-row source-row"><span>bootstrap</span><strong>{formatReadSource(sources.bootstrap)}</strong></div>
          <div className="meta-row source-row"><span>home</span><strong>{formatReadSource(sources.home)}</strong></div>
          <div className="meta-row source-row"><span>scene</span><strong>{formatReadSource(sources.scenes)}</strong></div>
          <div className="meta-row"><span>测试账号</span><strong>{currentAccountName}</strong></div>
          <button className="ghost-button" onClick={handleSwitchDevUser} type="button">
            切换测试账号
          </button>
          <button className="secondary-button" onClick={() => {
            void handleResetDemoState();
          }} type="button">
            {pendingActionKey === 'system:reset-demo-state' ? '重置中...' : '重置实验数据'}
          </button>
        </div>
      </aside>

      <section className="phone-stage">
        <div
          ref={characterDialogPortalRef}
          className="phone-frame phone-frame-scene"
          style={{ ['--scene-bg-image' as string]: activeBackgroundImage } as React.CSSProperties}
        >
          <section className="top-dock">
            <header className="top-bar">
              <div className="top-action-group">
                <button
                  aria-label="赛季进度"
                  className="season-progress-inline"
                  onClick={() => {
                    setGlobalFeatureModal({
                      title: '赛季规则',
                      eyebrow: '赛季',
                      description: '查看赛季结算与重置规则，再决定本赛季的经营重点。',
                      seasonResetRules: true,
                    });
                  }}
                  type="button"
                >
                  <span className="season-progress-inline-label">{seasonProgress.label}</span>
                  <span className="season-progress-inline-detail">{seasonProgress.detail}</span>
                </button>
                {!isTutorialUser ? (
                  <>
                    <button className="ghost-button top-action-button top-item-button" onClick={() => {
                      setGlobalFeatureModal({
                        title: '天机符商店',
                        tianjiShop: true,
                      });
                    }} type="button">
                      商店
                    </button>
                    <button className="ghost-button top-action-button" onClick={() => {
                      setGlobalFeatureModal({
                        title: '赛季签到',
                        eyebrow: '赛季',
                        description: '按天签到领取天机符，本赛季累计签到也会逐步解锁阶段奖励。',
                        seasonSignIn: true,
                      });
                    }} type="button">
                      签到
                    </button>
                    <button className="ghost-button top-action-button top-notification-button" onClick={handleOpenNotifications} type="button">
                      消息
                      {notificationUnreadCount > 0 ? <span className="top-notification-badge">{notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}</span> : null}
                    </button>
                  </>
                ) : null}
                <button className="ghost-button top-action-button" onClick={() => setSettingsOpen(true)} type="button">
                  设置
                </button>
              </div>
            </header>

          <NotificationCenter
            actionId={notificationActionId}
            busy={notificationBusy}
            data={notificationList}
            error={notificationError}
            onClaim={(notificationId) => {
              handleOpenNotificationClaim(notificationId);
            }}
            onClose={() => setNotificationsOpen(false)}
            onDelete={(notificationId) => {
              void handleDeleteNotification(notificationId);
            }}
            onMarkRead={(notificationId) => {
              void handleMarkNotificationRead(notificationId);
            }}
            onPageChange={(page) => {
              void loadNotificationPage(page);
            }}
            open={notificationsOpen}
          />

          {settingsOpen ? (
            <CenteredModalShell
              className="settings-panel"
              description="当前阶段退出登录只清理本地 token 并返回测试账号选择页，不调用后端注销接口。"
              eyebrow="设置"
              footer={(
                <>
                  <button className="ghost-button" onClick={() => setSettingsOpen(false)} type="button">
                    关闭
                  </button>
                  <button className="secondary-button" onClick={handleSwitchDevUser} type="button">
                    退出测试登录
                  </button>
                </>
              )}
              title="测试登录"
            >
              <div className="settings-row">
                <span>当前账号</span>
                <strong>{currentAccountName}</strong>
              </div>
              <div className="settings-row">
                <span>测试身份</span>
                <strong>{devLoginModeLabel}</strong>
              </div>
              <div className="settings-row">
                <span>登录方式</span>
                <strong>开发测试登录</strong>
              </div>
            </CenteredModalShell>
          ) : null}

            <section className="global-resource-bar">
              <div className="global-resource-pill global-gold-pill">
                <span className="global-gold-icon" aria-hidden="true">金</span>
                <strong>{formatNumber(vaultProgress.current)}</strong>
              </div>
              {tutorialUiRules.showTopResourceButtons ? (
              <>
              <div className="global-resource-pill global-tianji-pill">
                <span className="global-tianji-icon" aria-hidden="true">符</span>
                <strong>{formatNumber(tianjiTalismanCount)}</strong>
              </div>
              <button className="global-resource-pill global-resource-entry" onClick={() => {
                setSeedCodexState({ selectedSeedId: firstVisibleUnlockedSeedId });
              }} type="button">
                灵植图鉴
              </button>
              <button className="global-resource-pill global-resource-entry" onClick={() => {
                setTopSpiritCodexSpiritId(topSpiritCodexSelectedId);
                setTopResourcePanel('spirit-codex');
              }} type="button">
                宠物图鉴
              </button>
              <button className="global-resource-pill global-resource-entry" onClick={() => setTopResourcePanel('resources')} type="button">
                我的资源
              </button>
              </>
              ) : null}
            </section>
          </section>

          <section className={`screen-body scene-${activeScene}`}>
            {activeScene === 'home' ? (
              <HomeScene
                home={home}
                scenes={scenes}
                socialSummary={socialSummary}
                spirit={spiritState}
                tutorialTask={tutorialTask}
                onNavigate={navigateToScene}
                onTutorialAction={handleTutorialTaskAction}
              />
            ) : null}

            {activeScene === 'building' ? (
              <BuildingScene
                onUpgradeAction={(action, upgradeId, context, targetType, costText) => {
                  void handleBuildingAction(action, upgradeId, context, targetType, costText);
                }}
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
                landDeeds={scenes.farm.landDeeds ?? []}
                uiRules={tutorialUiRules.farm}
                onAction={(action, fieldId, fieldCode) => {
                  void handleFarmAction(action, fieldId, fieldCode);
                }}
                onOpenFarmBoard={handleOpenFarmBoardEditor}
              />
            ) : null}

            {activeScene === 'raid' ? (
                <ArmyScene
                advantage={scenes.army.advantage}
                busy={pendingActionKey?.startsWith('spirit:') ?? false}
                uiRules={tutorialUiRules.army}
                onCompose={(spiritId, slotIndex, element) => {
                  void handleComposeSpiritAction(spiritId, slotIndex, element);
                }}
                onDissolve={(slotIndex, slotVersion) => {
                  void handleDissolveSpiritAction(slotIndex, slotVersion);
                }}
                onRecover={(slotIndex, slotVersion) => {
                  void handleRecoverSpiritAction(slotIndex, slotVersion);
                }}
                onSetMain={(slotIndex, slotVersion) => {
                  void handleSetMainSpiritAction(slotIndex, slotVersion);
                }}
                onFeed={(slotIndex, slotVersion, actionType) => {
                  void handleFeedSpiritAction(slotIndex, slotVersion, actionType);
                }}
                onBreakthrough={(slotIndex, slotVersion, targetStage) => {
                  void handleBreakthroughSpiritAction(slotIndex, slotVersion, targetStage);
                }}
                onRollTraits={(slotIndex, slotVersion, mode, options) => {
                  void handleRollSpiritTraitsAction(slotIndex, slotVersion, mode, options);
                }}
                playerFaction={home.factionName}
                spirit={spiritState}
              />
            ) : null}

            {activeScene === 'report' ? (
              <ReportScene
                activeTab={raidHubTab}
                advantage={scenes.raid.advantage}
                battleLimit={raidBattleLimit}
                battleUsed={raidBattleUsed}
                onAction={handleSceneAction}
                onChangeTab={setRaidHubTab}
                followedTargetIds={followedTargetIds}
                onOpenTarget={handleOpenRaidTargetModal}
                onToggleFollowTarget={handleToggleFollowTarget}
                onRefresh={() => {
                  void handleRefreshRaidTargets();
                }}
                refreshLabel="刷新目标"
                refreshPending={pendingActionKey === 'raid:refresh-targets'}
                reportEntries={mergedReportEntries}
                isTutorial={isTutorialUser}
                targets={visibleRaidTargets}
                uiRules={tutorialUiRules.raid}
              />
            ) : null}

            {activeScene === 'faction' ? (
              <FactionScene
                contribution={scenes.faction.contribution}
                currentGold={vaultProgress.current}
                donate={scenes.faction.donate}
                donating={pendingActionKey === 'faction:donate'}
                factionTab={factionTab}
                hero={scenes.faction.hero}
                onChangeTab={setFactionTab}
                onContributionGuide={() => {
                  setGlobalFeatureModal({
                    title: '贡献俸禄档位',
                    eyebrow: '阵营贡献',
                    description: '每日按当前个人贡献匹配一个档位；随机精华和灵宠精魄会在确认领取时抽取为具体碎片。',
                    contributionTiers: buildFactionContributionTiers(),
                  });
                }}
                onClaimStipend={() => {
                  void handleClaimFactionStipend();
                }}
                claimingStipend={pendingActionKey === 'faction:stipend'}
                stipend={scenes.faction.stipend}
                onDonate={(goldAmount) => {
                  void handleFactionDonate(goldAmount);
                }}
                onTransferFaction={handleTransferFaction}
                comparison={scenes.faction.comparison}
                contributionLogs={scenes.faction.contributionLogs ?? []}
                rankings={scenes.faction.rankings}
                uiRules={tutorialUiRules.faction}
              />
            ) : null}

            {activeScene === 'social' ? (
              <SocialScene
                activeTab={socialTab}
                busy={socialLoading}
                enemies={socialEnemies}
                error={socialError}
                feed={socialFeed}
                following={socialFollowing}
                friendInviteUrl={friendInviteDemoLinks?.newUser ?? null}
                friends={socialFriends}
                fieldVisit={socialFieldVisit}
                playerFactionName={home.factionName}
                portalTarget={characterDialogPortalRef.current}
                onAssistFriend={(targetPlayerId) => {
                  void handleAssistSocialFriend(targetPlayerId);
                }}
                onAssistAllFields={() => {
                  void handleAssistAllSocialFields();
                }}
                onAcceptFriendRequest={(relationId) => {
                  void handleAcceptSocialFriendRequest(relationId);
                }}
                onChangeTab={setSocialTab}
                onChangeRelationFilter={setSocialRelationFilter}
                onRejectFriendRequest={(relationId) => {
                  void handleRejectSocialFriendRequest(relationId);
                }}
                onRefresh={() => {
                  void loadSocialBundle();
                }}
                onDeleteFriend={(targetPlayerId) => {
                  void handleDeleteSocialFriend(targetPlayerId);
                }}
                onInviteFriend={handleCreateFriendInvite}
                onCopyFriendInviteUrl={(url) => {
                  void copyFriendInviteUrl(url);
                }}
                onCloseFieldVisit={() => setSocialFieldVisit(null)}
                onRequestFriend={(targetPlayerId) => {
                  void handleSocialFriendRequest(targetPlayerId);
                }}
                onOpenFieldVisit={(targetPlayerId) => {
                  void handleOpenSocialFieldVisit(targetPlayerId);
                }}
                relationFilter={socialRelationFilter}
                summary={socialSummary}
              />
            ) : null}
          </section>

          <footer className="bottom-dock">
            {sceneKeys.map((scene) => {
              const unlocked = canOpenSceneInTutorial(scene, tutorialStage);

              return (
                <button
                  aria-disabled={!unlocked}
                  className={`nav-item ${activeScene === scene ? 'active' : ''} ${unlocked ? '' : 'locked'}`}
                  key={scene}
                  onClick={() => navigateToScene(scene)}
                  type="button"
                >
                  {sceneNavLabels[scene]}
                </button>
              );
            })}
          </footer>

          {raidTargetModal ? (
            <RaidIntelScreen
              allowDeepIntel={tutorialUiRules.raid.allowDeepIntel}
              allowFollow={tutorialUiRules.raid.allowFollow}
              detail={raidTargetDetail}
              error={raidTargetDetailError}
              followed={followedTargetIds.includes(raidTargetModal.targetId)}
              loading={raidTargetDetailLoading}
              mode={raidTargetModal.mode}
              onAction={(action) => handleSceneAction(action, raidTargetDetail?.name)}
              onClose={handleCloseRaidTargetModal}
              onRevealDeepIntel={async (targetId): Promise<ClientRaidDeepIntelResponse> => {
                const response = await revealRaidTargetDeepIntel(targetId);
                patchRaidTargetPreview(targetId, response.mainPetPreview);
                return response;
              }}
              onToggleFollow={() => {
                const target = raidTargetsById.get(raidTargetModal.targetId);
                if (target) {
                  handleToggleFollowTarget(target);
                }
              }}
              targetName={raidTargetModal.targetName}
            />
          ) : null}

          {seedSelectionState ? (
            <SeedSelectionScreen
              confirming={pendingActionKey === `farm:${seedSelectionState.fieldId}:开始培育`}
              fieldCode={seedSelectionState.fieldCode}
              onClose={() => setSeedSelectionState(null)}
              onConfirm={() => {
                void handleConfirmSeedCultivation();
              }}
              onSelect={setSelectedSeedId}
              seedGroups={seedGroups}
              selectedSeedId={selectedSeedId}
            />
          ) : null}
          {globalFeatureModal ? (
            <GlobalFeatureModal
              description={globalFeatureModal.tianjiShop ? undefined : globalFeatureModal.description}
              eyebrow={globalFeatureModal.tianjiShop ? undefined : globalFeatureModal.eyebrow}
              onClose={() => setGlobalFeatureModal(null)}
              title={globalFeatureModal.tianjiShop ? `天机符库存 x${formatNumber(tianjiTalismanCount)}` : globalFeatureModal.title}
            >
              <GlobalFeatureModalContent
                contributionTiers={globalFeatureModal.contributionTiers}
                seasonResetRules={globalFeatureModal.seasonResetRules ? {
                  title: '赛季结束时，重置战力与经营进度，保留长期图鉴与认知资产。',
                  retained: [
                    '已解锁的植物图鉴仍然可见',
                    '已解锁的灵宠图鉴仍然可见',
                    '灵宠碎片不清零',
                    '已见过的植物与灵宠信息继续保留',
                  ],
                  reset: [
                    '植物精华库存清零',
                    '灵宠等级清零，需要重新培养',
                    '金币清零',
                    '法术等级清零',
                    '阵营贡献清零',
                    '灵宠当前血量与战斗养成进度按赛季重开',
                  ],
                  onOpenSignIn: () => {
                    setGlobalFeatureModal({
                      title: '赛季签到',
                      eyebrow: '赛季',
                      description: '按天签到领取天机符，本赛季累计签到也会逐步解锁阶段奖励。',
                      seasonSignIn: true,
                    });
                  },
                } : undefined}
                seasonSignIn={globalFeatureModal.seasonSignIn ? {
                  record: seasonSignInRecord,
                  todayReward: seasonSignInTodayReward,
                  milestones: seasonSignInMilestones,
                  days: seasonSignInDays,
                  claimedToday: seasonSignInClaimedToday,
                  onClaim: () => {
                    void handleClaimSeasonSignIn();
                  },
                } : undefined}
                tianjiShop={globalFeatureModal.tianjiShop && spiritState?.shop ? {
                  spirit: { ...spiritState, shop: spiritState.shop },
                  pendingActionKey,
                  onClaimAdReward: () => {
                    void handleClaimSpiritAdRewardAction();
                  },
                  onBuyItem: (itemId) => {
                    void handleBuySpiritShopItemAction(itemId);
                  },
                } : undefined}
              />
            </GlobalFeatureModal>
          ) : null}
          {farmBoardEditor ? (
            <FarmBoardEditorModal
              message={farmBoardEditor.message}
              onChangeMessage={(message) => setFarmBoardEditor((current) => current ? { ...current, message } : current)}
              onClose={handleCloseFarmBoardEditor}
              saving={farmBoardEditor.saving}
            />
          ) : null}
          {returningFriendInvitePrompt ? (
            <CenteredModalShell
              className="friend-invite-confirm-card"
              description={`${returningFriendInvitePrompt.inviterName}（${returningFriendInvitePrompt.inviterFactionName}）邀请你成为好友。确认后双方都会出现在好友列表，并各自收到可领取的邀请奖励。`}
              eyebrow="好友邀请"
              footer={(
                <>
                  <button
                    className="secondary-button"
                    disabled={pendingActionKey === 'friend-invite:returning-confirm'}
                    onClick={handleRejectReturningFriendInvite}
                    type="button"
                  >
                    拒绝
                  </button>
                  <button
                    className="primary-button"
                    disabled={pendingActionKey === 'friend-invite:returning-confirm'}
                    onClick={() => {
                      void handleConfirmReturningFriendInvite();
                    }}
                    type="button"
                  >
                    {pendingActionKey === 'friend-invite:returning-confirm' ? '确认中...' : '确认成为好友'}
                  </button>
                </>
              )}
              title="确认成为好友"
            />
          ) : null}
          {globalUnlockModal ? (
            <GlobalUnlockModal
              items={globalUnlockModal.items}
              onConfirm={() => {
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
              }}
              summary={globalUnlockModal.summary}
              title={globalUnlockModal.title}
            />
          ) : null}
          {seedCodexState && selectedSeedCodexItem ? (
            <PlantCodexModal
              formatDuration={formatProtectionCountdown}
              formatNumber={formatNumber}
              groups={seedGroups.map((group) => ({ ...group, plants: group.seeds }))}
              busyPlantId={pendingActionKey?.startsWith('plant-unlock:') ? pendingActionKey.replace('plant-unlock:', '') : null}
              onClose={() => setSeedCodexState(null)}
              onSelectPlant={(plantId) => setSeedCodexState({ selectedSeedId: plantId })}
              onUnlockPlant={(plantId) => {
                void handleUnlockPlant(plantId);
              }}
              selectedPlant={selectedSeedCodexItem}
            />
          ) : null}
          {topResourcePanel === 'spirit-codex' && spiritState ? (
            <SpiritCodexModal
              entries={spiritState.codex}
              onClose={() => setTopResourcePanel(null)}
              onSelectSpirit={setTopSpiritCodexSpiritId}
              selectedSpiritId={topSpiritCodexSelectedId}
              stableFull={spiritStableFull}
            />
          ) : null}
          {topResourcePanel === 'resources' ? (
            <ResourceBackpackModal
              formatNumber={formatNumber}
              items={backpackResourceItems}
              onClose={() => setTopResourcePanel(null)}
            />
          ) : null}
          {seedRewardModal ? (
            <SeedRewardModal
              confirming={
                pendingActionKey === 'faction:stipend'
                || pendingActionKey === 'spirit:ad-reward'
                || pendingActionKey === 'tutorial:starter-seeds'
                || (seedRewardModal.confirmAction === 'claim-notification' && notificationActionId === `claim:${seedRewardModal.notificationId}`)
              }
              getItemLabel={(item) => {
                const seed = item.seedId ? seedCatalogMap.get(item.seedId) : undefined;
                if (seedRewardModal.confirmAction === 'claim-faction-stipend' && seed) {
                  return `${seed.name}精华`;
                }
                return seed?.name ?? item.label ?? item.itemId ?? item.seedId ?? '奖励';
              }}
              items={seedRewardModal.items}
              onConfirm={() => {
                if (seedRewardModal.confirmAction === 'claim-faction-stipend') {
                  void handleConfirmFactionStipendClaim();
                  return;
                }
                if (seedRewardModal.confirmAction === 'claim-starter-seeds') {
                  void handleConfirmStarterSeedClaim();
                  return;
                }
                if (seedRewardModal.confirmAction === 'claim-notification') {
                  void handleConfirmNotificationClaim();
                  return;
                }

                const afterConfirmActions = seedRewardModal.afterConfirmActions ?? [];
                setSeedRewardModal(null);
                if (afterConfirmActions.length > 0) {
                  runTutorialFlowActions(afterConfirmActions);
                }
              }}
              summary={seedRewardModal.summary}
              title={seedRewardModal.title}
            />
          ) : null}
          {raidBattleReplay ? (
            <RaidBattleScreen
              autoStart={raidBattleAutoStart}
              onComplete={() => {
                setRaidBattleReplay(null);
                if (pendingRaidRewardModal) {
                  setSeedRewardModal(pendingRaidRewardModal);
                }
                setPendingRaidRewardModal(null);
                setRaidBattleAutoStart(true);
              }}
              replay={raidBattleReplay}
            />
          ) : null}
          <RewardBubbleStack bubbles={rewardBubbles} formatNumber={formatNumber} />
          {toast ? (
            <div className={`top-toast top-toast-${toast.tone}`}>
              <span>{toast.message}</span>
            </div>
          ) : null}
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
