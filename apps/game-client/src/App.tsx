import { useEffect, useRef, useState } from 'react';
import type {
  ClientNotificationListResponse,
  ClientCastleExtensionUpgradeId,
  ClientCollectFieldRequest,
  ClientCollectFieldResponse,
  ClientRaidActionRequest,
  ClientRaidDeepIntelResponse,
  ClientFactionDonateRequest,
  ClientBuildingUpgradeId,
  ClientRaidTarget,
  ClientRaidTargetDetailResponse,
  ClientSceneAction,
  ClientSceneKey,
  ClientFarmBoardState,
  ClientSpiritElement,
  ClientSpiritRollMode,
  ClientSpiritTraitCode,
  ClientSpiritState,
  HomeSummaryResponse,
  ClientTerritoryUpgradeId,
  ClientUpgradeBuildingRequest,
  ClientUpgradeTargetType,
} from '@trinitywar/shared';
import { breakthroughSpirit, buySpiritShopItem, claimDailyTaskReward, claimFactionStipend, claimNotification, claimSpiritAdReward, clearDevLoginSession, collectFieldEarnings, composeSpirit, deleteNotification, devLogin, dissolveSpirit, donateFactionResources, feedSpirit, getDevLoginModeLabel, getStoredDevLoginSession, loadClientViewModel, loadFarmBoard, loadNotifications, loadRaidTargetDetail, loadSpiritState, loadUnreadNotificationCount, markNotificationAsRead, raidClientTarget, recoverSpirit, resetDemoExperimentState, revealRaidTargetDeepIntel, rollSpiritTraits, setMainSpirit, startFieldCultivation, type ClientReadSourceStatus, type ClientViewModel, type DevLoginMode, type DevLoginSession, updateFarmBoard, upgradeClientBuilding } from './api';
import { NotificationCenter } from './ui/common/NotificationCenter';
import { RaidIntelScreen } from './ui/raid/RaidIntelScreen';
import { ArmyScene } from './ui/scenes/ArmyScene';
import { BuildingScene } from './ui/scenes/BuildingScene';
import { FactionScene } from './ui/scenes/FactionScene';
import { FarmScene } from './ui/scenes/FarmScene';
import { HomeScene } from './ui/scenes/HomeScene';
import { ReportScene } from './ui/scenes/ReportScene';
import { SeedSelectionScreen } from './ui/scenes/SeedSelectionScreen';
import { GlobalFeatureModal } from './ui/common/GlobalFeatureModal';
import { CharacterDialogProvider } from './dialog/CharacterDialogProvider';
import { useCharacterDialog } from './dialog/useCharacterDialog';

type RaidHubTabKey = 'targets' | 'follows' | 'reports' | 'warrants';
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
  stageSeconds: {
    seeded: number;
    growing: number;
  };
  unlockedByDefault: boolean;
}

interface SeedCodexState {
  selectedSeedId: string;
}

interface SeedRewardModalState {
  title: string;
  summary: string;
  confirmAction?: 'claim-faction-stipend' | 'claim-spirit-ad-reward';
  items: Array<{
    seedId?: string;
    itemId?: string;
    quantity: number;
    label?: string;
  }>;
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

interface FollowedRaidTargetSummary {
  id: string;
  name: string;
  faction: string;
}

interface GlobalFeatureModalState {
  title: string;
  eyebrow?: string;
  description?: string;
  contributionTiers?: FactionContributionTier[];
  tianjiShop?: boolean;
  seasonSignIn?: boolean;
}

interface FactionContributionTier {
  threshold: string;
  label: string;
  rewards: string[];
}

interface SeasonSignInRecord {
  claimedDays: number[];
  totalTianjiReward: number;
}

interface SeasonSignInDay {
  day: number;
  reward: number;
  claimed: boolean;
  current: boolean;
  future: boolean;
  missed: boolean;
}

interface SeasonSignInMilestone {
  dayCount: number;
  title: string;
  reached: boolean;
  remainingDays: number;
}

const seedCatalog: SeedCatalogItem[] = [
  { id: 'qinglingmai', name: '青灵麦', rarity: 'common', sortOrder: 10, description: '普通、标准稳收基准种，初始默认可培育。', lore: '田野间最常见的灵粮，穗头泛淡青光泽，脱壳后熬粥清香回甘。凡人食之强身，修士食之略养经脉。春种秋收，从不妖异。', stageGold: { growing: 100, mature: 200, withered: 100 }, stageSeconds: { seeded: 7200, growing: 3600 }, unlockedByDefault: true },
  { id: 'xunyamai', name: '风云稻', rarity: 'common', sortOrder: 20, description: '普通、半小时快收种，适合切碎片时间。', lore: '稻芒起势极快，晨起沾露便能成势，半个时辰内就能完成一轮收益。', stageGold: { growing: 100, mature: 200, withered: 100 }, stageSeconds: { seeded: 900, growing: 900 }, unlockedByDefault: true },
  { id: 'ninglucao', name: '凝露草', rarity: 'common', sortOrder: 30, description: '普通、短线抢收种，适合高频上线卡成熟。', lore: '叶尖常凝夜露，晨时如泪珠滚落，有清心明目之效。低阶弟子多用其露水研磨朱砂画符，成功率能稍许提升。', stageGold: { growing: 100, mature: 140, withered: 40 }, stageSeconds: { seeded: 5400, growing: 1800 }, unlockedByDefault: false },
  { id: 'suixinhua', name: '碎心花', rarity: 'common', sortOrder: 40, description: '普通、高折损高回报种，丰熟收益波动很强。', lore: '花瓣薄如蝉翼，嫣红带紫纹，看似艳丽。但有微毒，采摘时指尖会传来一阵短暂的钻心刺痛，故名。可入麻醉类丹药。', stageGold: { growing: 120, mature: 300, withered: 50 }, stageSeconds: { seeded: 7200, growing: 3600 }, unlockedByDefault: false },
  { id: 'baiyulian', name: '白玉莲', rarity: 'common', sortOrder: 50, description: '普通、低频保值种，错过窗口也不容易血亏。', lore: '纯白无瑕，瓣如凝脂，生于清澈浅塘。花心微黄，清香远溢。凡人供于佛前，修士取其花瓣泡茶，可净体内杂气。', stageGold: { growing: 160, mature: 220, withered: 180 }, stageSeconds: { seeded: 10800, growing: 5400 }, unlockedByDefault: false },
  { id: 'yingyuezhu', name: '影月竹', rarity: 'common', sortOrder: 60, description: '普通、稳健中速种，适合平衡型经营。', lore: '竹身乌青，夜来月光下会在地上投出淡淡银影，竹节修长如剑。常种于书斋窗外，能助人凝神夜读，抵御睡魔。', stageGold: { growing: 150, mature: 230, withered: 140 }, stageSeconds: { seeded: 9000, growing: 3600 }, unlockedByDefault: false },
  { id: 'qianjiteng', name: '牵机藤', rarity: 'common', sortOrder: 70, description: '普通、丰熟爆发种，适合做等还是收的选择题。', lore: '藤蔓天生细密纹路，如牵机阵法。缠绕古木或篱笆，可束缚小妖、守护庭院，是低阶阵法师最喜搭配的活体材料。', stageGold: { growing: 170, mature: 360, withered: 120 }, stageSeconds: { seeded: 9000, growing: 3600 }, unlockedByDefault: false },
  { id: 'huichuncao', name: '回春草', rarity: 'rare', sortOrder: 110, description: '稀有、回种保值种，上线不稳时更稳。', lore: '通体碧玉，全草如翡翠，五十年才成熟一株。煮水内服可愈沉疴暗伤，对外伤亦有奇效。一株值百金，药农视若性命。', stageGold: { growing: 320, mature: 480, withered: 380 }, stageSeconds: { seeded: 10800, growing: 3600 }, unlockedByDefault: false },
  { id: 'xueyuehua', name: '雪月花', rarity: 'rare', sortOrder: 120, description: '稀有、高丰熟倍率种，卡点收益很高。', lore: '只在高寒雪山顶的月圆之夜盛开，花瓣冰白带银纹，花蕊一点淡蓝。盛开时方圆十丈飘雪，花谢后雪融。可炼“寒魄丹”，助冰系功法。', stageGold: { growing: 300, mature: 760, withered: 180 }, stageSeconds: { seeded: 9000, growing: 3600 }, unlockedByDefault: false },
  { id: 'jingdaosong', name: '劲道松', rarity: 'rare', sortOrder: 130, description: '稀有、长周期高保值种，适合重仓慢收。', lore: '矮松，树皮龟裂如铁，松针短而刚硬。长在罡风口的悬崖上，木质极密、韧性惊人。折断一松枝制成剑胚，便是不错的筑基法器。', stageGold: { growing: 450, mature: 620, withered: 520 }, stageSeconds: { seeded: 14400, growing: 3600 }, unlockedByDefault: false },
  { id: 'hundunguo', name: '混沌果', rarity: 'rare', sortOrder: 140, description: '稀有、后期抽水种，中后段高价值诱盗目标。', lore: '拳头大的圆果，灰蒙蒙无纹，剖开内里一片浑浊。罕见地生长在灵脉与地脉交错的混乱处。炼化后可让修士短暂进入“混沌”状态，免疫五行术法一炷香。', stageGold: { growing: 420, mature: 880, withered: 260 }, stageSeconds: { seeded: 14400, growing: 5400 }, unlockedByDefault: false },
  { id: 'zhanqingsi', name: '斩情丝', rarity: 'legendary', sortOrder: 210, description: '传说、高风险斩杀种，高收益也高失败代价。', lore: '茎如金丝，赤红纤细，一旦被它缠住手指，便会暂时斩断某人对另一人的爱慕或怨恨。传说上古有大能以此草炼制“绝情丹”，后被各派联手销毁，仅余深山数株。', stageGold: { growing: 520, mature: 1200, withered: 200 }, stageSeconds: { seeded: 10800, growing: 3600 }, unlockedByDefault: false },
  { id: 'wangchuanying', name: '忘川影', rarity: 'legendary', sortOrder: 220, description: '传说、长周期隐性暴利种，后段重投入慢兑现。', lore: '水边黑色丝状藻类，夜来投影如人影晃动。用它泡水喝下，会看到一段不属于自己的前世片段，往往是最痛苦的那一瞬。邪修常用其拷问死者的秘密。', stageGold: { growing: 760, mature: 1200, withered: 960 }, stageSeconds: { seeded: 18000, growing: 3600 }, unlockedByDefault: false },
  { id: 'zhaoyouming', name: '照幽冥', rarity: 'legendary', sortOrder: 230, description: '传说、极限丰熟回种种，终局上限最高之一。', lore: '通体漆黑的矮草，夜里发出微弱青光，能照亮脚下三尺的地气与亡魂足迹。相传若手握此草走进刚死之人的屋子，可看见死者徘徊不去的淡影，并与之做最后交谈。', stageGold: { growing: 700, mature: 1600, withered: 680 }, stageSeconds: { seeded: 14400, growing: 3600 }, unlockedByDefault: false },
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
  report: '掠夺',
  faction: '阵营',
};

const sceneKeys: ClientSceneKey[] = ['home', 'building', 'farm', 'raid', 'report', 'faction'];

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
};

const SEASON_SIGN_IN_STORAGE_KEY_PREFIX = 'trinitywar.seasonSignIn';
const SEASON_SIGN_IN_MILESTONES: Array<Pick<SeasonSignInMilestone, 'dayCount' | 'title'>> = [
  { dayCount: 7, title: '七日宝箱' },
  { dayCount: 14, title: '十四日宝箱' },
  { dayCount: 21, title: '二十一日宝箱' },
];

function normalizeScene(scene: string): ClientSceneKey {
  if (scene === 'field') {
    return 'farm';
  }

  if (scene === 'home' || scene === 'building' || scene === 'farm' || scene === 'raid' || scene === 'report' || scene === 'faction') {
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

function getSeasonSignInDay(): number {
  const chinaNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const seasonStartUtc = Date.UTC(chinaNow.getUTCFullYear(), 0, 1);
  const chinaTodayUtc = Date.UTC(chinaNow.getUTCFullYear(), chinaNow.getUTCMonth(), chinaNow.getUTCDate());
  const dayOfYear = Math.floor((chinaTodayUtc - seasonStartUtc) / 86_400_000) + 1;

  return ((dayOfYear - 1) % 28) + 1;
}

function getSeasonSignInReward(cumulativeClaimCount: number): number {
  if (cumulativeClaimCount >= 21) {
    return 4;
  }

  if (cumulativeClaimCount >= 14) {
    return 3;
  }

  if (cumulativeClaimCount >= 7) {
    return 2;
  }

  return 1;
}

function getSeasonSignInClaimOrder(claimedDays: number[], day: number): number {
  return claimedDays.filter((claimedDay) => claimedDay <= day).length;
}

function buildSeasonSignInDays(record: SeasonSignInRecord, currentDay: number): SeasonSignInDay[] {
  const claimed = new Set(record.claimedDays);
  let projectedClaimCount = record.claimedDays.length;

  return Array.from({ length: 28 }, (_, index) => {
    const day = index + 1;
    const isClaimed = claimed.has(day);
    const future = day > currentDay;
    const missed = day < currentDay && !isClaimed;
    let claimOrder = isClaimed ? getSeasonSignInClaimOrder(record.claimedDays, day) : getSeasonSignInClaimOrder(record.claimedDays, day - 1) + 1;

    if (!isClaimed && day >= currentDay) {
      projectedClaimCount += 1;
      claimOrder = projectedClaimCount;
    }

    return {
      day,
      reward: getSeasonSignInReward(claimOrder),
      claimed: isClaimed,
      current: day === currentDay,
      future,
      missed,
    };
  });
}

function buildSeasonSignInMilestones(claimedDayCount: number): SeasonSignInMilestone[] {
  return SEASON_SIGN_IN_MILESTONES.map((milestone) => ({
    ...milestone,
    reached: claimedDayCount >= milestone.dayCount,
    remainingDays: Math.max(milestone.dayCount - claimedDayCount, 0),
  }));
}

function getSeasonSignInStorageKey(playerId?: string): string {
  return `${SEASON_SIGN_IN_STORAGE_KEY_PREFIX}:${playerId ?? 'anonymous'}`;
}

function readSeasonSignInRecord(playerId?: string): SeasonSignInRecord {
  if (typeof window === 'undefined') {
    return { claimedDays: [], totalTianjiReward: 0 };
  }

  try {
    const raw = window.localStorage.getItem(getSeasonSignInStorageKey(playerId));
    const parsed = raw ? JSON.parse(raw) as Partial<SeasonSignInRecord> : null;
    const claimedDays = Array.isArray(parsed?.claimedDays)
      ? Array.from(new Set(parsed.claimedDays.map((day) => Math.floor(Number(day))).filter((day) => day >= 1 && day <= 28))).sort((left, right) => left - right)
      : [];

    return {
      claimedDays,
      totalTianjiReward: Math.max(Math.floor(Number(parsed?.totalTianjiReward ?? 0)), 0),
    };
  } catch {
    return { claimedDays: [], totalTianjiReward: 0 };
  }
}

function writeSeasonSignInRecord(playerId: string | undefined, record: SeasonSignInRecord): void {
  window.localStorage.setItem(getSeasonSignInStorageKey(playerId), JSON.stringify(record));
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
    { threshold: '0 贡献', label: '基础俸禄', rewards: ['金币 x20', '随机普通种子 x1', '普通兽魂 x2'] },
    { threshold: '100 贡献', label: '小有供奉', rewards: ['金币 x30', '随机普通种子 x2', '普通兽魂 x5'] },
    { threshold: '300 贡献', label: '稳定供奉', rewards: ['金币 x40', '随机普通种子 x2', '普通兽魂 x10'] },
    { threshold: '600 贡献', label: '阵营骨干', rewards: ['金币 x50', '随机稀有种子 x1', '稀有兽魂 x4'] },
    { threshold: '1000 贡献', label: '高阶供奉', rewards: ['金币 x60', '随机稀有种子 x2', '稀有兽魂 x8'] },
    { threshold: '2000 贡献', label: '阵营重臣', rewards: ['金币 x80', '随机传说种子 x1', '传说兽魂 x2'] },
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

function App(): JSX.Element {
  const [viewModel, setViewModel] = useState<ClientViewModel | null>(null);
  const [spiritState, setSpiritState] = useState<ClientSpiritState | null>(null);
  const [loginSession, setLoginSession] = useState<DevLoginSession | null>(() => getStoredDevLoginSession());
  const [loginLoadingMode, setLoginLoadingMode] = useState<DevLoginMode | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeScene, setActiveScene] = useState<ClientSceneKey>('home');
  const [raidHubTab, setRaidHubTab] = useState<RaidHubTabKey>('targets');
  const [factionTab, setFactionTab] = useState<FactionTabKey>('overview');
  const [toast, setToast] = useState<ToastState | null>(null);
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
  const [unlockedSeedIds, setUnlockedSeedIds] = useState<string[]>(defaultUnlockedSeedIds);
  const [seedRewardModal, setSeedRewardModal] = useState<SeedRewardModalState | null>(null);
  const [seedSelectionState, setSeedSelectionState] = useState<SeedSelectionState | null>(null);
  const [seedCodexState, setSeedCodexState] = useState<SeedCodexState | null>(null);
  const [armyQueueRefreshReadyAt, setArmyQueueRefreshReadyAt] = useState<string | null>(null);
  const [selectedSeedId, setSelectedSeedId] = useState<string>('qinglingmai');
  const [fieldSeedAssignments, setFieldSeedAssignments] = useState<Record<string, string>>({});
  const [farmCollectPresentation, setFarmCollectPresentation] = useState<FarmCollectPresentationState | null>(null);
  const [farmBoard, setFarmBoard] = useState<ClientFarmBoardState | null>(null);
  const [farmBoardEditor, setFarmBoardEditor] = useState<FarmBoardEditorState | null>(null);
  const [followedTargetIds, setFollowedTargetIds] = useState<string[]>([]);
  const [raidTargetDetailsById, setRaidTargetDetailsById] = useState<Record<string, ClientRaidTargetDetailResponse>>({});
  const [globalFeatureModal, setGlobalFeatureModal] = useState<GlobalFeatureModalState | null>(null);
  const [seasonSignInRecord, setSeasonSignInRecord] = useState<SeasonSignInRecord>(() => readSeasonSignInRecord(getStoredDevLoginSession()?.player.id));
  const characterDialog = useCharacterDialog();
  const { playDialogScene } = characterDialog;
  const characterDialogPortalRef = useRef<HTMLDivElement | null>(null);
  const welcomeDialogSessionIdRef = useRef<string | null>(null);
  const farmEnterDialogRef = useRef<{ sceneId: string; at: number } | null>(null);

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
    const mergedUnlockedSeedIds = Array.from(new Set([...defaultUnlockedSeedIds, ...backpack.unlockedSeedIds]));

    setSeedInventory({
      ...emptySeedInventory,
      ...backpack.seedInventory,
    });
    setGlobalItemInventory({
      ...emptyGlobalItemInventory,
      ...backpack.globalItemInventory,
    });
    setUnlockedSeedIds(mergedUnlockedSeedIds);
    if (!mergedUnlockedSeedIds.includes(selectedSeedId)) {
      setSelectedSeedId(mergedUnlockedSeedIds[0] ?? 'qinglingmai');
    }
  };

  const applyClientViewModel = (data: ClientViewModel): void => {
    setViewModel(data);
    setSelectedRaidTargetId(data.scenes.raid.targets[0]?.id ?? '');
    syncSeedBackpackState(data.bootstrap.backpack);
  };

  const applyClientBundle = (data: { viewModel: ClientViewModel; spirit: ClientSpiritState; farmBoard: ClientFarmBoardState }): void => {
    const signInPlayerId = loginSession?.player.id ?? getStoredDevLoginSession()?.player.id;
    const signInBonus = readSeasonSignInRecord(signInPlayerId).totalTianjiReward;
    const spiritWithSignInBonus = {
      ...data.spirit,
      tianjiTalisman: data.spirit.tianjiTalisman + signInBonus,
    };

    applyClientViewModel(data.viewModel);
    setSpiritState(spiritWithSignInBonus);
    setGlobalItemInventory((current) => ({
      ...current,
      tianjiTalisman: spiritWithSignInBonus.tianjiTalisman,
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

  const handleClaimNotification = async (notificationId: string): Promise<void> => {
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

  const loadClientBundle = async (): Promise<{ viewModel: ClientViewModel; spirit: ClientSpiritState; farmBoard: ClientFarmBoardState }> => {
    const [nextViewModel, nextSpirit, nextFarmBoard] = await Promise.all([
      loadClientViewModel(),
      loadSpiritState(),
      loadFarmBoard(),
    ]);

    return {
      viewModel: nextViewModel,
      spirit: nextSpirit,
      farmBoard: nextFarmBoard,
    };
  };

  const handleDevLogin = async (mode: DevLoginMode): Promise<void> => {
    setLoginLoadingMode(mode);
    setLoginError(null);

    try {
      const session = await devLogin(mode);
      const data = await loadClientBundle();
      setSeasonSignInRecord(readSeasonSignInRecord(session.player.id));
      setLoginSession(session);
      applyClientBundle(data);
    } catch {
      setLoginError('无法连接开发登录接口，请确认后端已启动，并且 VITE_API_BASE_URL 指向正确地址。');
    } finally {
      setLoginLoadingMode(null);
    }
  };

  const handleSwitchDevUser = (): void => {
    setSettingsOpen(false);
    clearDevLoginSession();
    setLoginSession(null);
    setSeasonSignInRecord(readSeasonSignInRecord());
    setViewModel(null);
    setSpiritState(null);
    setFarmBoard(null);
    setFarmBoardEditor(null);
    setActiveScene('home');
    setRaidHubTab('targets');
    setFactionTab('overview');
    setSelectedRaidTargetId('');
    setRaidTargetModal(null);
    setRaidTargetDetail(null);
    setRaidTargetDetailError(null);
    setSeedRewardModal(null);
    setSeedSelectionState(null);
    setSeedCodexState(null);
    setFarmCollectPresentation(null);
    setGlobalFeatureModal(null);
    setPendingActionKey(null);
    resetNotificationState();
    setLoginError(null);
    welcomeDialogSessionIdRef.current = null;
    farmEnterDialogRef.current = null;
  };

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
      setSpiritState(null);
      setLoginError('登录已失效或真实接口不可用，请重新选择测试账号。');
    });

    return () => {
      active = false;
    };
  }, [loginSession]);

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

    welcomeDialogSessionIdRef.current = loginSession.player.id;
    playDialogScene('home.welcome.fox');
  }, [loginSession, playDialogScene, viewModel]);

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
    if (!loginSession) {
      return (
        <main className="loading-shell auth-shell">
          <section className="loading-panel auth-panel">
            <p className="eyebrow">TRINITY WAR</p>
            <h1>选择测试账号</h1>
            <p className="panel-text">用于验证登录、建档和真实读接口。新用户会创建一个全新的开发账号，已注册用户会复用固定测试账号。</p>
            <div className="auth-choice-grid">
              <button
                className="auth-choice-button primary-choice"
                disabled={loginLoadingMode !== null}
                onClick={() => {
                  void handleDevLogin('new-user');
                }}
                type="button"
              >
                <span>我是新用户</span>
                <strong>{loginLoadingMode === 'new-user' ? '创建中...' : '创建新档案'}</strong>
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
            {loginError ? <p className="auth-error">{loginError}</p> : null}
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
  const mergedReportEntries = [...scenes.report.attack, ...scenes.report.defense]
    .filter((entry) => entry.title !== '系统结算')
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const activeBackgroundImage = `url(${getSceneBackground(activeScene, home.factionName)})`;
  const vaultResource = findResourceByTone('vault', home.resources);
  const devLoginModeLabel = getDevLoginModeLabel(loginSession?.mode);
  const currentAccountName = loginSession?.player.nickname ?? home.playerName;
  const dailyTasks = home.dailyTasks ?? [];
  const vaultProgress = vaultResource ? parseCapacityResourceValue(vaultResource.value) : { current: 0, capacity: 0, ratio: 0 };
  const seasonProgress = buildSeasonProgress(bootstrap.season);
  const seasonSignInDay = getSeasonSignInDay();
  const seasonSignInDays = buildSeasonSignInDays(seasonSignInRecord, seasonSignInDay);
  const seasonSignInClaimedToday = seasonSignInRecord.claimedDays.includes(seasonSignInDay);
  const seasonSignInTodayClaimOrder = seasonSignInClaimedToday
    ? getSeasonSignInClaimOrder(seasonSignInRecord.claimedDays, seasonSignInDay)
    : seasonSignInRecord.claimedDays.length + 1;
  const seasonSignInTodayReward = getSeasonSignInReward(seasonSignInTodayClaimOrder);
  const seasonSignInMilestones = buildSeasonSignInMilestones(seasonSignInRecord.claimedDays.length);
  const tianjiTalismanCount = spiritState?.tianjiTalisman ?? globalItemInventory.tianjiTalisman ?? 0;
  const seedCatalogMap = new Map(seedCatalog.map((seed) => [seed.id, seed]));
  const seedGroups = (['common', 'rare', 'legendary'] as const).map((rarity) => ({
    rarity,
    label: seedRarityLabels[rarity],
    seeds: seedCatalog.filter((seed) => seed.rarity === rarity).sort(compareSeedCatalogItems).map((seed) => ({
      ...seed,
      unlocked: unlockedSeedIds.includes(seed.id),
      quantity: seedInventory[seed.id] ?? 0,
    })),
  }));
  const selectedSeedCodexItem = seedCodexState
    ? seedGroups.flatMap((group) => group.seeds).find((seed) => seed.id === seedCodexState.selectedSeedId) ?? null
    : null;
  const farmFields = scenes.farm.fields.map((field) => {
    const assignedSeedId = fieldSeedAssignments[field.id];
    const assignedSeed = assignedSeedId ? seedCatalogMap.get(assignedSeedId) : undefined;

    if (!assignedSeed || (field.tone !== 'seeded' && field.tone !== 'growing' && field.tone !== 'mature' && field.tone !== 'withered')) {
      return field;
    }

    return {
      ...field,
      cropName: assignedSeed.name,
    };
  });
  const raidTargetsById = new Map(scenes.raid.targets.map((target) => [target.id, target]));
  const followedTargets = followedTargetIds
    .map((targetId) => {
      const target = raidTargetsById.get(targetId);
      if (target) {
        return {
          id: target.id,
          name: target.name,
          faction: target.faction,
        } satisfies FollowedRaidTargetSummary;
      }

      const detail = raidTargetDetailsById[targetId];
      if (detail) {
        return {
          id: detail.targetId,
          name: detail.name,
          faction: detail.faction,
        } satisfies FollowedRaidTargetSummary;
      }

      return null;
    })
    .filter((target): target is FollowedRaidTargetSummary => Boolean(target));

  const showToast = (message: string, tone: ToastState['tone'] = 'info'): void => {
    setToast({
      id: Date.now(),
      message,
      tone,
    });
  };

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
    } catch {
      showToast('当前无法突破灵宠，请确认兽魂是否足够。', 'error');
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

  const handleClaimSeasonSignIn = (): void => {
    if (!loginSession || seasonSignInClaimedToday) {
      return;
    }

    const reward = seasonSignInTodayReward;
    const nextRecord: SeasonSignInRecord = {
      claimedDays: Array.from(new Set([...seasonSignInRecord.claimedDays, seasonSignInDay])).sort((left, right) => left - right),
      totalTianjiReward: seasonSignInRecord.totalTianjiReward + reward,
    };

    writeSeasonSignInRecord(loginSession.player.id, nextRecord);
    setSeasonSignInRecord(nextRecord);
    setGlobalItemInventory((current) => ({
      ...current,
      tianjiTalisman: (current.tianjiTalisman ?? 0) + reward,
    }));
    setSpiritState((current) => current ? {
      ...current,
      tianjiTalisman: current.tianjiTalisman + reward,
    } : current);
    showToast(`签到成功，获得天机符 x${reward}。`, 'success');
  };

  const handleClaimSpiritAdRewardAction = async (): Promise<void> => {
    if (!spiritState) {
      return;
    }

    setSeedRewardModal({
      title: '领取广告奖励',
      summary: `观看完成后，确认领取天机符 x${spiritState.shop?.adReward.tianjiTalisman ?? 0}。点击确认后才会正式入账。`,
      confirmAction: 'claim-spirit-ad-reward',
      items: [{
        itemId: 'tianji-talisman',
        label: '天机符',
        quantity: spiritState.shop?.adReward.tianjiTalisman ?? 0,
      }],
    });
  };

  const handleConfirmSpiritAdRewardClaim = async (): Promise<void> => {
    const actionKey = 'spirit:ad-reward';
    if (!spiritState || !seedRewardModal || seedRewardModal.confirmAction !== 'claim-spirit-ad-reward' || pendingActionKey === actionKey) {
      return;
    }

    setPendingActionKey(actionKey);

    try {
      const result = await claimSpiritAdReward({
        resourceVersion: spiritState.resourceVersion,
      });
      applySpiritMutationResult(result);
      setSeedRewardModal(null);
      showToast(result.summary, 'success');
    } catch {
      showToast('当前无法领取广告奖励，可能今日次数已用完。', 'error');
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
      setSeedInventory((current) => {
        const nextInventory = { ...current };
        result.rewards
          .filter((reward) => reward.kind === 'seed' && reward.seedId)
          .forEach((reward) => {
            nextInventory[reward.seedId as string] = (nextInventory[reward.seedId as string] ?? 0) + reward.quantity;
          });
        return nextInventory;
      });
      setUnlockedSeedIds((current) => {
        const nextIds = new Set(current);
        result.rewards
          .filter((reward) => reward.kind === 'seed' && reward.seedId)
          .forEach((reward) => nextIds.add(reward.seedId as string));
        return Array.from(nextIds);
      });
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
      showToast(result.summary, 'success');
    } catch {
      showToast('当前无法领取阵营俸禄，请稍后重试。', 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleClaimDailyTask = async (taskId: string): Promise<void> => {
    const actionKey = `home:daily-task:${taskId}`;
    if (pendingActionKey === actionKey) {
      return;
    }

    setPendingActionKey(actionKey);

    try {
      const result = await claimDailyTaskReward({
        taskId,
        walletVersion: home.stateVersions.walletVersion,
      });

      applyMutationResult(result);
    } catch {
      showToast('当前无法领取任务奖励，请稍后重试。', 'error');
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
      setSelectedSeedId('qinglingmai');
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
      const nextViewModel = await loadClientViewModel();
      setViewModel(nextViewModel);
      setSelectedRaidTargetId(nextViewModel.scenes.raid.targets[0]?.id ?? '');
      syncSeedBackpackState(nextViewModel.bootstrap.backpack);
      showToast('目标列表已刷新，可以重新挑选掠夺对象。', 'success');
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

  const handleOpenFollowedRaidTarget = (target: FollowedRaidTargetSummary): void => {
    setSelectedRaidTargetId(target.id);
    setRaidTargetModal({
      targetId: target.id,
      targetName: target.name,
      mode: 'raid',
    });
  };

  const handleToggleFollowTarget = (target: ClientRaidTarget): void => {
    const isFollowing = followedTargetIds.includes(target.id);

    setFollowedTargetIds((current) => isFollowing
      ? current.filter((targetId) => targetId !== target.id)
      : [...current, target.id]);
    showToast(isFollowing ? `已取消关注 ${target.name}。` : `已关注 ${target.name}，可在掠夺页的关注列表持续观察田地状态。`, 'success');
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
    setActiveScene(scene);

    if (scene === 'report' && nextRaidHubTab) {
      setRaidHubTab(nextRaidHubTab);
    }

    if (scene !== 'report' && nextRaidHubTab) {
      setRaidHubTab(nextRaidHubTab);
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

    if (action.label === '开始培育') {
      setSelectedSeedId('qinglingmai');
      setSeedSelectionState({
        fieldId,
        fieldCode: context,
      });
      return;
    }

    if (action.label.includes('收取')) {
      const collectMode: ClientCollectFieldRequest['collectMode'] = action.label.includes('提前') ? 'early' : 'ripe';
      const field = farmFields.find((item) => item.id === fieldId);

      setPendingActionKey(actionKey);

      try {
        const result: ClientCollectFieldResponse = await collectFieldEarnings({
          fieldId,
          collectMode,
          fieldVersion: field?.fieldVersion ?? 1,
          walletVersion: home.stateVersions.walletVersion,
        });
        applyMutationResult(result);
        if (result.result.rewards.length > 0) {
          setSeedInventory((current) => {
            const nextInventory = { ...current };
            result.result.rewards
              .filter((reward) => (reward.kind ?? 'seed') === 'seed' && reward.seedId)
              .forEach((reward) => {
                nextInventory[reward.seedId as string] = (nextInventory[reward.seedId as string] ?? 0) + reward.quantity;
              });
            return nextInventory;
          });
          setUnlockedSeedIds((current) => {
            const nextIds = new Set(current);
            result.result.rewards
              .filter((reward) => (reward.kind ?? 'seed') === 'seed' && reward.seedId)
              .forEach((reward) => nextIds.add(reward.seedId as string));
            return Array.from(nextIds);
          });
        }
        const rewardModalPayload: SeedRewardModalState = {
          title: '收取所得',
          summary: `获得 ${formatNumber(result.result.collectedGold)} 金币。`,
          items: [
            {
              seedId: 'field-gold',
              label: '金币',
              quantity: result.result.collectedGold,
            },
            ...result.result.rewards.map((reward) => ({
              seedId: reward.seedId,
              quantity: reward.quantity,
              label: reward.label,
            })),
          ],
        };
        setFarmCollectPresentation({
          fieldId,
          tier: result.result.rewards.length > 0 ? 'critical' : 'harvest',
          showSeeds: result.result.rewards.length > 0,
        });
        window.setTimeout(() => {
          setSeedRewardModal(rewardModalPayload);
        }, FARM_COLLECT_PRESENTATION_MS);
        setFieldSeedAssignments((current) => {
          const nextAssignments = { ...current };
          delete nextAssignments[fieldId];
          return nextAssignments;
        });
      } catch {
        showToast(`${context} 当前无法完成收取，请稍后重试。`, 'error');
      } finally {
        setPendingActionKey(null);
      }
      return;
    }

    handleSceneAction(action, context);
  };

  const handleSceneAction = (action: ClientSceneAction, context?: string): void => {
    const actionContext = context ?? raidTargetDetail?.name ?? selectedRaidTarget?.name;

    if ((action.label === '确认出兵' || action.label === '发起掠夺') && actionContext) {
      const targetId = raidTargetModal?.targetId ?? selectedRaidTarget?.id;

      if (!targetId) {
        showToast('当前缺少可掠夺目标，请先重新选择目标。', 'error');
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
          const nextSpiritState = await loadSpiritState();
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
          setSpiritState(nextSpiritState);
          setSelectedRaidTargetId(response.scenes.raid.targets[0]?.id ?? '');

          setSeedRewardModal({
            title: '掠夺所得',
            summary: response.result.overflowGold > 0
              ? `本次掠夺 ${formatNumber(response.result.goldLoot)} 金币，其中 ${formatNumber(response.result.depositedGold)} 已入库，另有 ${formatNumber(response.result.overflowGold)} 转入待领取，战损 ${formatNumber(response.result.casualties)} 兵。`
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
          });

          setSeedRewardModal((current) => current ? {
            ...current,
            title: '掠夺所得',
            summary: response.result.overflowGold > 0
              ? `本次掠夺 ${formatNumber(response.result.goldLoot)} 金币，其中 ${formatNumber(response.result.depositedGold)} 已入库，另有 ${formatNumber(response.result.overflowGold)} 转入待领取。${response.result.reportSummary}${response.result.battleEvents?.length ? ` 关键事件：${response.result.battleEvents.map((event) => event.label).join('、')}` : ''}`
              : `获得 ${formatNumber(response.result.goldLoot)} 金币。${response.result.reportSummary}${response.result.battleEvents?.length ? ` 关键事件：${response.result.battleEvents.map((event) => event.label).join('、')}` : ''}`,
            items: current.items.map((item) => item.seedId === 'raid-gold' ? { ...item, label: '金币' } : item),
          } : current);

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
        } catch {
          showToast(`${actionContext} 当前无法完成掠夺，请稍后重试。`, 'error');
        } finally {
          setPendingActionKey(null);
        }
      };

      void runRaid();
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

  const handleConfirmSeedCultivation = async (): Promise<void> => {
    if (!seedSelectionState) {
      return;
    }

    const seed = seedCatalogMap.get(selectedSeedId);
    if (!seed || !unlockedSeedIds.includes(seed.id)) {
      showToast('当前只可选择已解锁的种子。', 'error');
      return;
    }

    const currentCount = seedInventory[seed.id] ?? 0;
    if (currentCount <= 0) {
      showToast(`${seed.name} 库存不足，请先领取或获取种子。`, 'error');
      return;
    }

    const actionKey = `farm:${seedSelectionState.fieldId}:开始培育`;
    if (pendingActionKey === actionKey) {
      return;
    }

    setPendingActionKey(actionKey);

    try {
      const result = await startFieldCultivation({ fieldId: seedSelectionState.fieldId, seedId: seed.id });
      applyMutationResult(result);
      setSeedInventory((current) => ({
        ...current,
        [seed.id]: Math.max((current[seed.id] ?? 0) - 1, 0),
      }));
      setFieldSeedAssignments((current) => ({
        ...current,
        [seedSelectionState.fieldId]: seed.id,
      }));
      setSeedSelectionState(null);
      showToast(`${seedSelectionState.fieldCode} 已投入 ${seed.name}，开始培育。`, 'success');
    } catch {
      showToast(`${seedSelectionState.fieldCode} 当前无法开始培育，请稍后重试。`, 'error');
    } finally {
      setPendingActionKey(null);
    }
  };

  return (
    <CharacterDialogProvider controller={characterDialog} portalTarget={characterDialogPortalRef.current}>
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
          <p className="card-label">今日主目标</p>
          <ul className="mini-list">
            {dailyTasks.map((item) => (
              <li key={item.id}>{item.title}</li>
            ))}
          </ul>
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
            showToast('最近 1 次被掠已解锁免费复仇，已切到掠夺模块的战报页签。');
          }} type="button">
            掠夺动态 2
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
                <div className="season-progress-inline" aria-label="赛季进度">
                  <span className="season-progress-inline-label">{seasonProgress.label}</span>
                  <span className="season-progress-inline-detail">{seasonProgress.detail}</span>
                </div>
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
                    eyebrow: '活动',
                    description: '每个赛季 28 天，累计签到推进每日档位和阶段宝箱；漏签不清零。',
                    seasonSignIn: true,
                  });
                }} type="button">
                  签到
                </button>
                <button className="ghost-button top-action-button top-notification-button" onClick={handleOpenNotifications} type="button">
                  消息
                  {notificationUnreadCount > 0 ? <span className="top-notification-badge">{notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}</span> : null}
                </button>
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
              void handleClaimNotification(notificationId);
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
            <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
              <div className="modal-card transfer-card settings-panel" onClick={(event) => event.stopPropagation()}>
                <p className="eyebrow">设置</p>
                <h2>测试登录</h2>
                <div className="settings-row">
                  <span>当前账号</span>
                  <strong>{devLoginModeLabel}</strong>
                </div>
                <div className="settings-row">
                  <span>登录方式</span>
                  <strong>开发测试登录</strong>
                </div>
                <p className="panel-text">当前阶段退出登录只清理本地 token 并返回测试账号选择页，不调用后端注销接口。</p>
                <div className="settings-actions">
                  <button className="ghost-button" onClick={() => setSettingsOpen(false)} type="button">
                    关闭
                  </button>
                  <button className="secondary-button" onClick={handleSwitchDevUser} type="button">
                    退出测试登录
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {toast ? (
            <div className={`top-toast top-toast-${toast.tone}`}>
              <span>{toast.message}</span>
            </div>
          ) : null}

            <section className="global-resource-bar">
              <div className="global-resource-pill global-gold-pill">
                <span className="global-gold-icon" aria-hidden="true">金</span>
                <strong>{formatNumber(vaultProgress.current)}</strong>
              </div>
              <div className="global-resource-pill global-tianji-pill">
                <span className="global-tianji-icon" aria-hidden="true">符</span>
                <strong>{formatNumber(tianjiTalismanCount)}</strong>
              </div>
            </section>
          </section>

          <section className={`screen-body scene-${activeScene}`}>
            {activeScene === 'home' ? (
              <HomeScene
                claimingTaskId={pendingActionKey?.startsWith('home:daily-task:') ? pendingActionKey.replace('home:daily-task:', '') : null}
                dailyTasks={dailyTasks}
                onClaimTask={(taskId) => {
                  void handleClaimDailyTask(taskId);
                }}
                onNavigate={navigateToScene}
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
                collectPresentation={farmCollectPresentation}
                farmTick={farmTick}
                farmBoardMessage={farmBoard?.farmBoardMessage ?? ''}
                farmBoardUpdatedAt={farmBoard?.farmBoardUpdatedAt ?? null}
                fields={farmFields}
                landDeeds={scenes.farm.landDeeds ?? []}
                onAction={(action, fieldId, fieldCode) => {
                  void handleFarmAction(action, fieldId, fieldCode);
                }}
                onOpenFarmBoard={handleOpenFarmBoardEditor}
                onOpenSeedCodex={() => {
                  setSeedCodexState({
                    selectedSeedId: selectedSeedId || unlockedSeedIds[0] || 'qinglingmai',
                  });
                }}
              />
            ) : null}

            {activeScene === 'raid' ? (
                <ArmyScene
                busy={pendingActionKey?.startsWith('spirit:') ?? false}
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
                followedTargets={followedTargets}
                heroTitle={scenes.raid.hero.title}
                onAction={handleSceneAction}
                onChangeTab={setRaidHubTab}
                followedTargetIds={followedTargetIds}
                onOpenFollowedTarget={handleOpenFollowedRaidTarget}
                onOpenTarget={handleOpenRaidTargetModal}
                onToggleFollowTarget={handleToggleFollowTarget}
                onRefresh={() => {
                  void handleRefreshRaidTargets();
                }}
                refreshLabel={scenes.raid.hero.action.label}
                refreshPending={pendingActionKey === 'raid:refresh-targets'}
                reportEntries={mergedReportEntries}
                targets={scenes.raid.targets}
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
                    description: '每日按当前个人贡献匹配一个档位；随机种子会在确认领取时抽取为具体整种子。',
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
                rankings={scenes.faction.rankings}
              />
            ) : null}
          </section>

          <footer className="bottom-dock">
            {sceneKeys.map((scene) => (
              <button className={`nav-item ${activeScene === scene ? 'active' : ''}`} key={scene} onClick={() => navigateToScene(scene)} type="button">
                {sceneNavLabels[scene]}
              </button>
            ))}
          </footer>

          {raidTargetModal ? (
            <RaidIntelScreen
              detail={raidTargetDetail}
              error={raidTargetDetailError}
              farmTick={farmTick}
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
              {globalFeatureModal.contributionTiers ? (
                <div className="contribution-tier-list">
                  {globalFeatureModal.contributionTiers.map((tier) => (
                    <article className="contribution-tier-card" key={tier.threshold}>
                      <div>
                        <span>{tier.threshold}</span>
                        <strong>{tier.label}</strong>
                      </div>
                      <ul>
                        {tier.rewards.map((reward) => (
                          <li key={reward}>{reward}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              ) : null}
              {globalFeatureModal.seasonSignIn ? (
                <div className="season-signin-panel">
                  <div className="season-signin-summary">
                    <span>累计 {seasonSignInRecord.claimedDays.length}/28 天</span>
                    <strong>今日 x{seasonSignInTodayReward}</strong>
                  </div>
                  <div className="season-signin-milestones" aria-label="累计签到宝箱">
                    {seasonSignInMilestones.map((milestone) => (
                      <div className={`season-signin-milestone ${milestone.reached ? 'reached' : ''}`} key={milestone.dayCount}>
                        <span className="season-signin-milestone-icon" aria-hidden="true">箱</span>
                        <div>
                          <strong>{milestone.title}</strong>
                          <span>累计 {milestone.dayCount} 天</span>
                        </div>
                        <em>{milestone.reached ? '已达成' : `差 ${milestone.remainingDays} 天`}</em>
                      </div>
                    ))}
                  </div>
                  <p className="season-signin-rule">1-6 天 x1，7-13 天 x2，14-20 天 x3，21 天后 x4；宝箱奖励待定。</p>
                  <div className="season-signin-grid" aria-label="赛季签到日历">
                    {seasonSignInDays.map((day) => (
                      <div
                        className={[
                          'season-signin-day',
                          day.claimed ? 'claimed' : '',
                          day.current ? 'current' : '',
                          day.future ? 'future' : '',
                          day.missed ? 'missed' : '',
                        ].filter(Boolean).join(' ')}
                        key={day.day}
                      >
                        <span>{day.day}</span>
                        <strong>{day.missed ? '未签' : `符 x${day.reward}`}</strong>
                      </div>
                    ))}
                  </div>
                  <button className="secondary-button" disabled={seasonSignInClaimedToday} onClick={handleClaimSeasonSignIn} type="button">
                    {seasonSignInClaimedToday ? '今日已签到' : '签到领取'}
                  </button>
                </div>
              ) : null}
              {globalFeatureModal.tianjiShop && spiritState?.shop ? (
                <div className="tianji-shop-panel">
                  <button
                    className="secondary-button"
                    disabled={pendingActionKey === 'spirit:ad-reward' || spiritState.shop.adReward.usedToday >= spiritState.shop.adReward.dailyLimit}
                    onClick={() => {
                      void handleClaimSpiritAdRewardAction();
                    }}
                    type="button"
                  >
                    看广告 +{spiritState.shop.adReward.tianjiTalisman} 天机符
                  </button>
                  <p className="panel-text">今日广告 {spiritState.shop.adReward.usedToday}/{spiritState.shop.adReward.dailyLimit}，完成后会先弹出统一领奖框，确认后才入账天机符。</p>
                  <div className="task-list tianji-shop-list">
                    {spiritState.shop.items.map((item) => (
                      <div className="task-row tianji-shop-row" key={item.itemId}>
                        <span className="task-index">{item.priceTianjiTalisman}</span>
                        <div>
                          <div className="task-row-head">
                            <strong>{item.label}</strong>
                            <span className="task-state-badge">{item.limitLabel}{item.remainingPurchases === null ? '' : ` · 剩 ${item.remainingPurchases}`}</span>
                          </div>
                          <p>{item.description}</p>
                        </div>
                        <button
                          className="secondary-button small"
                          disabled={pendingActionKey === `spirit:shop:${item.itemId}` || spiritState.tianjiTalisman < item.priceTianjiTalisman || item.remainingPurchases === 0}
                          onClick={() => {
                            void handleBuySpiritShopItemAction(item.itemId);
                          }}
                          type="button"
                        >
                          兑换
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </GlobalFeatureModal>
          ) : null}
          {farmBoardEditor ? (
            <div className="modal-backdrop farm-board-backdrop" role="presentation">
              <div className="modal-card transfer-card farm-board-modal" role="dialog" aria-modal="true" aria-label="农场留言板">
                <div>
                  <div>
                    <p className="eyebrow">农场留言板</p>
                    <h3>修改留言</h3>
                  </div>
                </div>
                <textarea
                  className="farm-board-textarea"
                  maxLength={40}
                  onChange={(event) => setFarmBoardEditor((current) => current ? { ...current, message: event.target.value } : current)}
                  placeholder="写一句给来访者看的农场留言"
                  value={farmBoardEditor.message}
                />
                <div className="transfer-foot-row farm-board-modal-foot">
                  <span>{Array.from(farmBoardEditor.message).length}/40</span>
                  <button
                    className="secondary-button"
                    disabled={farmBoardEditor.saving}
                    onClick={handleCloseFarmBoardEditor}
                    type="button"
                  >
                    {farmBoardEditor.saving ? '保存中...' : '关闭'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {seedCodexState && selectedSeedCodexItem ? (
            <section className="seed-codex-screen" role="dialog" aria-modal="true" aria-label="灵植图鉴">
              <div className="seed-codex-topbar">
                <div className="seed-codex-title-block">
                  <p className="eyebrow">灵植图鉴</p>
                  <p className="seed-codex-tip">点击植物图标切换详情</p>
                </div>
                <button className="ghost-button small" onClick={() => setSeedCodexState(null)} type="button">关闭</button>
              </div>

              <div className="seed-codex-body">
                {seedGroups.map((group) => (
                  <section className="panel-card seed-codex-rarity-row" key={group.rarity}>
                    <div className="seed-codex-rarity-head">
                      <strong>{group.label}</strong>
                    </div>
                    <div className="seed-codex-icon-grid">
                      {group.seeds.map((seed) => (
                        <button
                          aria-label={seed.unlocked ? seed.name : '尚未发现'}
                          className={`seed-codex-icon ${seed.unlocked ? 'is-unlocked' : 'is-locked'} ${seed.id === selectedSeedCodexItem.id && seed.unlocked ? 'is-selected' : ''}`}
                          disabled={!seed.unlocked}
                          key={seed.id}
                          onClick={() => {
                            if (!seed.unlocked) {
                              return;
                            }

                            setSeedCodexState({ selectedSeedId: seed.id });
                          }}
                          type="button"
                        >
                          <span>{seed.unlocked ? seed.name.slice(0, 2) : '？？'}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}

                <section className={`seed-codex-detail-card ${selectedSeedCodexItem?.unlocked ? '' : 'is-undiscovered'}`}>
                  {selectedSeedCodexItem?.unlocked ? (
                    <>
                      <div className="seed-codex-detail-head">
                        <div>
                          <p className="eyebrow">{seedRarityLabels[selectedSeedCodexItem.rarity]}</p>
                          <h3>{selectedSeedCodexItem.name}</h3>
                        </div>
                      </div>
                      <p className="seed-codex-lore">{selectedSeedCodexItem.lore}</p>
                      <div className="seed-codex-stats">
                        <div className="seed-codex-stat-row">
                          <strong>成熟时间</strong>
                          <span>{formatProtectionCountdown(selectedSeedCodexItem.stageSeconds.seeded + selectedSeedCodexItem.stageSeconds.growing)}</span>
                        </div>
                        <div className="seed-codex-stat-row">
                          <strong>丰熟窗口</strong>
                          <span>基础 30 分钟，可被观星术延长</span>
                        </div>
                        <div className="seed-codex-stat-row">
                          <strong>收益</strong>
                          <span>成长 {formatNumber(selectedSeedCodexItem.stageGold.growing)} / 丰熟 {formatNumber(selectedSeedCodexItem.stageGold.mature)} / 枯萎 {formatNumber(selectedSeedCodexItem.stageGold.withered)}</span>
                        </div>
                      </div>
                      <div className="seed-codex-strategy">
                        <strong>策略建议</strong>
                        <p>{selectedSeedCodexItem.description}</p>
                      </div>
                    </>
                  ) : (
                    <p className="seed-codex-undiscovered-text">尚未发现</p>
                  )}
                </section>
              </div>
            </section>
          ) : null}
          {seedRewardModal ? (
            <div className="seed-reward-modal" role="status" aria-live="polite">
              <div className="seed-reward-card">
                <p className="eyebrow">{seedRewardModal.title}</p>
                <h3>{seedRewardModal.title}</h3>
                {seedRewardModal.summary ? <p>{seedRewardModal.summary}</p> : null}
                <div className="seed-reward-list">
                  {seedRewardModal.items.map((item) => {
                    const seed = item.seedId ? seedCatalogMap.get(item.seedId) : undefined;
                    return (
                      <div className="seed-reward-item" key={`${item.seedId ?? item.itemId ?? item.label ?? 'default'}-${item.quantity}`}>
                        <strong>{seed?.name ?? item.label ?? item.itemId ?? item.seedId ?? '奖励'}</strong>
                        <span>x {item.quantity}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="transfer-foot-row seed-reward-actions">
                  <button className="secondary-button" disabled={pendingActionKey === 'faction:stipend'} onClick={() => {
                    if (seedRewardModal.confirmAction === 'claim-faction-stipend') {
                      void handleConfirmFactionStipendClaim();
                      return;
                    }
                    if (seedRewardModal.confirmAction === 'claim-spirit-ad-reward') {
                      void handleConfirmSpiritAdRewardClaim();
                      return;
                    }

                    setSeedRewardModal(null);
                  }} type="button">{pendingActionKey === 'faction:stipend' || pendingActionKey === 'spirit:ad-reward' ? '收取中...' : '确认'}</button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      </main>
    </CharacterDialogProvider>
  );
}

export default App;
