import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  ClientSpiritTraitRollRule,
  ClientSpiritCodexEntry,
  ClientSpiritElement,
  ClientFactionAdvantagePanel,
  ClientSpiritRarity,
  ClientSpiritRole,
  ClientRollSpiritTraitsResponse,
  ClientSpiritActiveRollMode,
  ClientSpiritTraitRollMaterial,
  ClientSpiritRollMode,
  ClientSpiritSlot,
  ClientSpiritState,
  ClientSpiritTraitCode,
  ClientSpiritTraitRollPreview,
} from '@trinitywar/shared';
import { CLIENT_SPIRIT_TRAIT_ROLL_PLAN_ORDER, CLIENT_SPIRIT_TRAIT_ROLL_RULES, getBasicSpiritTraitRollGoldCost, getClientSpiritInnateTrait } from '@trinitywar/shared';
import { getFirstVisibleSpiritCodexId } from '../../modules/spirit/spiritCodexPresentation';
import type { TutorialArmyUiRules } from '../../tutorial/tutorialFlow';
import { SpiritCodexModal } from '../common/SpiritCodexModal';
import { FullScreenToolShell } from '../common/ModalShell';

interface ArmySceneProps {
  advantage?: ClientFactionAdvantagePanel;
  playerFaction: string;
  spirit: ClientSpiritState;
  vaultGold: number;
  busy: boolean;
  uiRules: TutorialArmyUiRules;
  onSetMain: (slotIndex: number, slotVersion: number) => void;
  onRecover: (slotIndex: number, slotVersion: number) => void;
  onDissolve: (slotIndex: number, slotVersion: number) => void;
  onCompose: (spiritId: string, slotIndex: number, element: ClientSpiritElement) => void;
  onFeed: (slotIndex: number, slotVersion: number, actionType: 'feed_once' | 'fill_full') => void;
  onBreakthrough: (slotIndex: number, slotVersion: number, targetStage?: number) => void;
  onRollTraits: (
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
  onResolveTraitRoll: (rollLogId: string, selectedTraitCode: ClientSpiritTraitCode | null, slotVersion: number) => Promise<boolean>;
}

type DisplayRarity = '普通' | '稀有' | '传说';
type DisplayElement = '金' | '木' | '水' | '火' | '土';
type SpiritPetActionTab = 'overview' | 'growth' | 'breakthrough' | 'traits';
type SpiritComposeStep = 'choose-spirit' | 'choose-element';

const elementChoices: Array<{ value: ClientSpiritElement; label: DisplayElement }> = [
  { value: 'metal', label: '金' },
  { value: 'wood', label: '木' },
  { value: 'water', label: '水' },
  { value: 'fire', label: '火' },
  { value: 'earth', label: '土' },
];

const DAILY_FREE_RECOVERY_LIMIT = 3;
const DAILY_TALISMAN_RECOVERY_LIMIT = 3;
const MAX_QUICK_RECOVERY_PER_DAY = DAILY_FREE_RECOVERY_LIMIT + DAILY_TALISMAN_RECOVERY_LIMIT;
const SPIRIT_MAX_LEVEL = 50;
const STARTER_SPIRIT_IDS = ['canglang', 'linglu', 'qingyuan'];
const traitRollPlans: ClientSpiritTraitRollRule[] = CLIENT_SPIRIT_TRAIT_ROLL_PLAN_ORDER.map((mode) => CLIENT_SPIRIT_TRAIT_ROLL_RULES[mode]);

const petActionTabs: Array<{ key: SpiritPetActionTab; label: string }> = [
  { key: 'overview', label: '基础' },
  { key: 'growth', label: '成长' },
  { key: 'breakthrough', label: '突破' },
  { key: 'traits', label: '洗点' },
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function getTraitRollGoldCost(baseGold: number, advantage?: ClientFactionAdvantagePanel): number {
  const reductionPercent = advantage?.modifiers.spiritTraitRollGoldCostReductionPercent ?? 0;
  return Math.ceil(Math.max(baseGold, 0) * (1 - reductionPercent / 100));
}

function formatTraitRollCost(cost: { marrow: number; jade: number; gold: number }, goldCost: number, options: { tianjiTalisman?: number } = {}): string {
  const parts: string[] = [];
  if (cost.marrow > 0) {
    parts.push(`灵髓 ${cost.marrow}`);
  }
  if (cost.jade > 0) {
    parts.push(`灵玉 ${cost.jade}`);
  }
  if ((options.tianjiTalisman ?? 0) > 0) {
    parts.push(`天机符 ${options.tianjiTalisman}`);
  }
  if (goldCost > 0) {
    parts.push(`金币 ${formatNumber(goldCost)}`);
  }
  return parts.join(' · ');
}

function getTraitSlotDisplay(slot: ClientSpiritSlot, slotIndex: number): string {
  const trait = slot.traits?.find((item) => item.slotIndex === slotIndex);
  return trait ? `${slotIndex}号 ${trait.label}` : `${slotIndex}号 空词条`;
}

function getSpiritRarityGrowthMultiplier(rarity: ClientSpiritRarity, level: number): number {
  if (rarity === 'legendary') {
    return level <= 10 ? 0.9 : level <= 30 ? 1.02 : 1.18;
  }
  if (rarity === 'rare') {
    return level <= 10 ? 0.96 : level <= 30 ? 1.06 : 1.08;
  }
  return level <= 30 ? 1 : 0.92;
}

function getSpiritAttackAtLevel(definition: ClientSpiritCodexEntry['definition'], level: number): number {
  const levelDelta = Math.max(level - 1, 0);
  const rarityMultiplier = getSpiritRarityGrowthMultiplier(definition.rarity, level);
  return Math.round(definition.baseAttack + levelDelta * definition.growthAttack * rarityMultiplier);
}

function getTraitBonusSummary(slot: ClientSpiritSlot): string {
  const traits = slot.traits ?? [];
  if (traits.length <= 0) {
    return '暂无洗点词条加成';
  }
  return traits.map((trait) => trait.description).join(' · ');
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(Math.floor(seconds), 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${hours}小时${String(minutes).padStart(2, '0')}分${String(remainingSeconds).padStart(2, '0')}秒`;
}

function getPassiveExpPerMinute(level: number): number {
  if (level <= 2) {
    return 5000;
  }
  if (level <= 10) {
    return 1000;
  }
  if (level <= 20) {
    return 500;
  }
  if (level <= 30) {
    return 250;
  }
  return 150;
}

function getBreakthroughStageForLevel(level: number): number | null {
  if (level < 9 || level >= SPIRIT_MAX_LEVEL) {
    return null;
  }

  const stage = Math.floor((level + 1) / 10);
  return stage >= 1 && stage <= 5 && level === stage * 10 - 1 ? stage : null;
}

function getCompletedBreakthroughStageForLevel(level: number): number {
  if (level >= SPIRIT_MAX_LEVEL) {
    return 5;
  }

  return Math.min(Math.max(Math.floor(level / 10), 0), 4);
}

function isAtPendingBreakthrough(level: number, breakthroughStage: number): boolean {
  const stage = getBreakthroughStageForLevel(level);
  return stage !== null && breakthroughStage < stage;
}

function applyExpGain(level: number, exp: number, breakthroughStage: number, expGain: number, currentLevelExpRequired: number): Pick<ClientSpiritSlot, 'level' | 'exp' | 'breakthroughStage' | 'isAtBreakthroughNode'> {
  let nextLevel = level;
  let nextExp = Math.max(exp + Math.max(expGain, 0), 0);
  const nextBreakthroughStage = Math.max(breakthroughStage, getCompletedBreakthroughStageForLevel(nextLevel));

  while (nextLevel < SPIRIT_MAX_LEVEL && nextExp >= currentLevelExpRequired) {
    nextExp -= currentLevelExpRequired;
    nextLevel += 1;
    if (isAtPendingBreakthrough(nextLevel, nextBreakthroughStage)) {
      nextExp = 0;
      break;
    }
  }

  if (nextLevel >= SPIRIT_MAX_LEVEL) {
    nextLevel = SPIRIT_MAX_LEVEL;
    nextExp = 0;
  }

  return {
    level: nextLevel,
    exp: nextExp,
    breakthroughStage: nextBreakthroughStage,
    isAtBreakthroughNode: isAtPendingBreakthrough(nextLevel, nextBreakthroughStage),
  };
}

function getLiveSpiritSlot(slot: ClientSpiritSlot, nowMs: number): ClientSpiritSlot {
  const currentLevelExpRequired = Math.max(slot.currentLevelExpRequired ?? 1, 1);
  const satiatedUntilMs = slot.satiatedUntil ? new Date(slot.satiatedUntil).getTime() : 0;
  const lastExpSettledAtMs = slot.lastExpSettledAt ? new Date(slot.lastExpSettledAt).getTime() : 0;
  const satiatedRemainingSeconds = satiatedUntilMs > 0
    ? Math.max(Math.floor((satiatedUntilMs - nowMs) / 1000), 0)
    : 0;

  if (slot.level >= SPIRIT_MAX_LEVEL || !lastExpSettledAtMs || slot.isAtBreakthroughNode) {
    return {
      ...slot,
      exp: slot.level >= SPIRIT_MAX_LEVEL ? 0 : Math.min(slot.exp, currentLevelExpRequired),
      satiatedRemainingSeconds,
      satiatedExpBonusPercent: satiatedRemainingSeconds > 0 ? 50 : 0,
    };
  }

  const elapsedSeconds = Math.max(Math.floor((nowMs - lastExpSettledAtMs) / 1000), 0);
  if (elapsedSeconds <= 0) {
    return {
      ...slot,
      satiatedRemainingSeconds,
      satiatedExpBonusPercent: satiatedRemainingSeconds > 0 ? 50 : 0,
    };
  }

  const satiatedSeconds = satiatedUntilMs > lastExpSettledAtMs
    ? Math.max(Math.floor((Math.min(satiatedUntilMs, nowMs) - lastExpSettledAtMs) / 1000), 0)
    : 0;
  const normalSeconds = Math.max(elapsedSeconds - satiatedSeconds, 0);
  const passiveExpPerMinute = getPassiveExpPerMinute(slot.level);
  const normalExpGain = Math.floor(passiveExpPerMinute * normalSeconds / 60);
  const satiatedExpGain = Math.floor(passiveExpPerMinute * satiatedSeconds * 15000 / 10000 / 60);
  const progressed = applyExpGain(slot.level, slot.exp, slot.breakthroughStage ?? 0, normalExpGain + satiatedExpGain, currentLevelExpRequired);

  return {
    ...slot,
    ...progressed,
    satiatedRemainingSeconds,
    satiatedExpBonusPercent: satiatedRemainingSeconds > 0 ? 50 : 0,
  };
}

function getLevelRemainingText(slot: ClientSpiritSlot): string {
  if (slot.level >= SPIRIT_MAX_LEVEL) {
    return '已达等级上限';
  }

  if (slot.isAtBreakthroughNode) {
    return '等待突破';
  }

  const required = Math.max(slot.currentLevelExpRequired ?? 1, 1);
  const remainingExp = Math.max(required - slot.exp, 0);
  if (remainingExp <= 0) {
    return '即将升级';
  }

  const bonusRate = (slot.satiatedRemainingSeconds ?? 0) > 0 ? 1.5 : 1;
  const expPerMinute = Math.max(getPassiveExpPerMinute(slot.level) * bonusRate, 1);
  return `约 ${formatDuration(Math.ceil(remainingExp / expPerMinute) * 60)} 后升级`;
}

function getExpGainText(slot: ClientSpiritSlot): string {
  if (slot.level >= SPIRIT_MAX_LEVEL) {
    return '当前已达等级上限';
  }

  if (slot.isAtBreakthroughNode) {
    return '当前待突破，突破后恢复增长';
  }

  const bonusRate = (slot.satiatedRemainingSeconds ?? 0) > 0 ? 1.5 : 1;
  const expPerMinute = Math.max(Math.floor(getPassiveExpPerMinute(slot.level) * bonusRate), 1);
  const expPerTenSeconds = Math.max(Math.floor(expPerMinute / 6), 1);
  return `每 10 秒约 +${formatNumber(expPerTenSeconds)} 经验`;
}

function getExpProgressPercent(slot: ClientSpiritSlot): number {
  if (slot.level >= SPIRIT_MAX_LEVEL) {
    return 100;
  }

  if (slot.isAtBreakthroughNode) {
    return 100;
  }

  return Math.min((slot.exp / Math.max(slot.currentLevelExpRequired ?? 1, 1)) * 100, 100);
}

const spiritResourceItems = [
  { key: 'spiritRoot', icon: '根', label: '灵根' },
  { key: 'spiritMarrow', icon: '髓', label: '灵髓' },
  { key: 'spiritJade', icon: '玉', label: '灵玉' },
  { key: 'ordinarySoul', icon: '普', label: '普通兽魂' },
  { key: 'rareSoul', icon: '稀', label: '稀有兽魂' },
  { key: 'legendarySoul', icon: '传', label: '传说兽魂' },
] as const;

function getElementLabel(element: ClientSpiritElement | null): DisplayElement | '' {
  if (element === 'metal') {
    return '金';
  }
  if (element === 'wood') {
    return '木';
  }
  if (element === 'water') {
    return '水';
  }
  if (element === 'fire') {
    return '火';
  }
  if (element === 'earth') {
    return '土';
  }
  return '';
}

function getElementChoiceText(element: DisplayElement): string {
  if (element === '金') {
    return '金克木';
  }
  if (element === '木') {
    return '木克土';
  }
  if (element === '水') {
    return '水克火';
  }
  if (element === '火') {
    return '火克金';
  }
  return '土克水';
}

function getElementControlledByText(element: DisplayElement): string {
  if (element === '金') {
    return '被火克';
  }
  if (element === '木') {
    return '被金克';
  }
  if (element === '水') {
    return '被土克';
  }
  if (element === '火') {
    return '被水克';
  }
  return '被木克';
}

function getElementPositionClass(element: DisplayElement): string {
  if (element === '金') {
    return 'is-metal';
  }
  if (element === '木') {
    return 'is-wood';
  }
  if (element === '水') {
    return 'is-water';
  }
  if (element === '火') {
    return 'is-fire';
  }
  return 'is-earth';
}

function getElementClass(element: ClientSpiritElement | DisplayElement | null): string {
  if (element === 'metal' || element === '金') {
    return 'spirit-element-metal';
  }
  if (element === 'wood' || element === '木') {
    return 'spirit-element-wood';
  }
  if (element === 'water' || element === '水') {
    return 'spirit-element-water';
  }
  if (element === 'fire' || element === '火') {
    return 'spirit-element-fire';
  }
  if (element === 'earth' || element === '土') {
    return 'spirit-element-earth';
  }
  return 'spirit-element-wood';
}

function getRarityLabel(rarity: ClientSpiritRarity): DisplayRarity {
  if (rarity === 'legendary') {
    return '传说';
  }
  if (rarity === 'rare') {
    return '稀有';
  }
  return '普通';
}

function getRarityClass(rarity: DisplayRarity): string {
  if (rarity === '传说') {
    return 'spirit-rarity-legend';
  }
  if (rarity === '稀有') {
    return 'spirit-rarity-rare';
  }
  return 'spirit-rarity-common';
}

function getFactionLabel(faction: ClientSpiritCodexEntry['definition']['factionAffinity']): string {
  if (faction === 'immortal') {
    return '仙界';
  }
  if (faction === 'demon') {
    return '魔界';
  }
  return '人界';
}

function getRoleLabel(role: ClientSpiritRole): string {
  if (role === 'attack') {
    return '攻击型';
  }
  if (role === 'health') {
    return '血量型';
  }
  return '均衡型';
}

function getPhaseForLevel(level: number): string {
  if (level >= 50) {
    return '归真圆满';
  }
  if (level >= 40) {
    return '神异觉醒期';
  }
  if (level >= 30) {
    return '真形期';
  }
  if (level >= 20) {
    return '化形期';
  }
  if (level >= 10) {
    return '幼灵期';
  }
  return '灵胎期';
}

function getHealthRatio(slot: ClientSpiritSlot): number {
  if (slot.maxHp <= 0) {
    return 0;
  }
  return Math.min(Math.max((slot.currentHp / slot.maxHp) * 100, 0), 100);
}

function getHealthText(slot: ClientSpiritSlot): string {
  return `${Math.round(getHealthRatio(slot))}%`;
}

function getHealthStatus(slot: ClientSpiritSlot): string {
  const ratio = getHealthRatio(slot);
  if (ratio <= 0) {
    return '不可出战';
  }
  if (ratio >= 70) {
    return '正常：攻击 100%';
  }
  if (ratio >= 30) {
    return '低迷：攻击 70%';
  }
  return '重伤：攻击 30%';
}

function getRecoveryPlan(dailyRecoveryUsed: number): {
  freeRemaining: number;
  talismanRemaining: number;
  nextTalismanCost: number;
  totalRemaining: number;
} {
  const used = Math.min(Math.max(Math.floor(dailyRecoveryUsed), 0), MAX_QUICK_RECOVERY_PER_DAY);
  const freeRemaining = Math.max(DAILY_FREE_RECOVERY_LIMIT - used, 0);
  const talismanUsed = Math.max(used - DAILY_FREE_RECOVERY_LIMIT, 0);
  const talismanRemaining = Math.max(DAILY_TALISMAN_RECOVERY_LIMIT - talismanUsed, 0);
  const nextTalismanCost = freeRemaining > 0 || talismanRemaining <= 0 ? 0 : talismanUsed + 1;

  return {
    freeRemaining,
    talismanRemaining,
    nextTalismanCost,
    totalRemaining: freeRemaining + talismanRemaining,
  };
}

function getRecoveryButtonText(plan: ReturnType<typeof getRecoveryPlan>): string {
  if (plan.freeRemaining > 0) {
    return '免费恢复';
  }
  if (plan.nextTalismanCost > 0) {
    return `天机符恢复 x${plan.nextTalismanCost}`;
  }
  return '今日恢复已用完';
}

function getFactionBonusLabel(faction: string): string {
  if (faction === '仙界') {
    return '生命 +8%';
  }
  if (faction === '魔界') {
    return '攻击 +8%';
  }
  if (faction === '人界') {
    return '血量 +8%';
  }
  return '未触发';
}

function SpiritStageCard(props: {
  name: string;
  phase: string;
  level: number;
  element?: DisplayElement;
  rarity: DisplayRarity;
  flash?: boolean;
}): JSX.Element {
  const { name, phase, level, element, rarity, flash = false } = props;

  return (
    <div className={`spirit-stage-card${flash ? ' is-level-up-flash' : ''}`}>
      <div className="spirit-stage-art" aria-hidden="true">
        <span>{name.slice(0, 1)}</span>
      </div>
      <div className="spirit-stage-meta">
        <p className="eyebrow">{phase}</p>
        <h4>{name}</h4>
        <div className="spirit-tag-row">
          <span className={`spirit-rarity ${getRarityClass(rarity)}`}>{rarity}</span>
          {element ? <span className={`spirit-element-chip ${getElementClass(element)}`}>{element}</span> : null}
          <span className="soft-tag">Lv.{level}</span>
        </div>
      </div>
    </div>
  );
}

export function ArmyScene(props: ArmySceneProps): JSX.Element {
  const { advantage, playerFaction, spirit, vaultGold, busy, uiRules, onSetMain, onRecover, onDissolve, onCompose, onFeed, onBreakthrough, onRollTraits, onResolveTraitRoll } = props;
  const [codexOpen, setCodexOpen] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [selectedCodexSpiritId, setSelectedCodexSpiritId] = useState<string | null>(() => getFirstVisibleSpiritCodexId(spirit.codex));
  const [selectedComposeSpiritId, setSelectedComposeSpiritId] = useState<string>(() => spirit.readyToCompose.find((entry) => !entry.ownedCurrent)?.spiritId ?? '');
  const [composeElement, setComposeElement] = useState<ClientSpiritElement>('wood');
  const [composeStep, setComposeStep] = useState<SpiritComposeStep>('choose-spirit');
  const [targetTraitSlot, setTargetTraitSlot] = useState(1);
  const [lockedTraitSlots, setLockedTraitSlots] = useState<number[]>([]);
  const [selectedTraitRollMode, setSelectedTraitRollMode] = useState<ClientSpiritActiveRollMode>('basic');
  const [pendingTraitRoll, setPendingTraitRoll] = useState<ClientSpiritTraitRollPreview | null>(null);
  const [goldReforgeConfirmOpen, setGoldReforgeConfirmOpen] = useState(false);
  const [goldReforgeSkipChecked, setGoldReforgeSkipChecked] = useState(false);
  const [goldReforgeSkipForSession, setGoldReforgeSkipForSession] = useState(false);
  const [selectedPetTab, setSelectedPetTab] = useState<SpiritPetActionTab>('overview');
  const [liveNowMs, setLiveNowMs] = useState(() => Date.now());
  const [expFloat, setExpFloat] = useState<{ id: number; text: string } | null>(null);
  const [levelFlashToken, setLevelFlashToken] = useState(0);
  const [resumeHint, setResumeHint] = useState<{ id: number; text: string } | null>(null);
  const previousSelectedSlotRef = useRef<ClientSpiritSlot | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLiveNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const portalTarget = typeof document === 'undefined' ? null : document.querySelector('.phone-frame');
  const slots = useMemo(
    () => [...spirit.slots]
      .map((slot) => getLiveSpiritSlot(slot, liveNowMs))
      .sort((left, right) => left.slotIndex - right.slotIndex),
    [liveNowMs, spirit.slots],
  );
  const codexById = useMemo(() => new Map(spirit.codex.map((entry) => [entry.spiritId, entry])), [spirit.codex]);
  const mainSlot = slots.find((slot) => slot.isMain && slot.spiritId !== null) ?? spirit.mainSlot;
  const mainEntry = mainSlot?.spiritId ? codexById.get(mainSlot.spiritId) ?? null : null;
  const stableSlots = slots.filter((slot) => !slot.isMain && slot.slotIndex > 1);
  const selectedSlot = selectedSlotIndex === null ? null : slots.find((slot) => slot.slotIndex === selectedSlotIndex) ?? null;
  const selectedSlotEntry = selectedSlot?.spiritId ? codexById.get(selectedSlot.spiritId) ?? null : null;
  const hasOwnedStarterEver = spirit.codex.some((entry) => STARTER_SPIRIT_IDS.includes(entry.spiritId) && entry.ownedEver);
  const starterComposePets = !mainSlot && !hasOwnedStarterEver
    ? spirit.codex.filter((entry) => STARTER_SPIRIT_IDS.includes(entry.spiritId) && entry.hasSeen && !entry.ownedCurrent)
    : [];
  const composePetById = new Map(
    [...spirit.readyToCompose.filter((entry) => !entry.ownedCurrent), ...starterComposePets].map((entry) => [entry.spiritId, entry]),
  );
  const availableComposePets = Array.from(composePetById.values());
  const selectedComposeEntry = availableComposePets.find((entry) => entry.spiritId === selectedComposeSpiritId) ?? availableComposePets[0] ?? null;
  const occupiedCount = slots.filter((slot) => slot.spiritId).length;
  const isStableFull = occupiedCount >= slots.length;
  const canOpenOwnedPetDetail = uiRules.allowOwnedPetDetail;
  const selectedComposeElementLabel = getElementLabel(composeElement) || '木';
  const availableTianjiTalisman = spirit.tianjiTalisman;
  const recoveryPlan = getRecoveryPlan(spirit.dailyRecoveryUsed);
  const selectedSlotIsOnlyOwnedSpirit = occupiedCount <= 1;
  const selectedSlotCanDissolve = selectedSlot ? !selectedSlot.isMain && !selectedSlotIsOnlyOwnedSpirit : false;
  const selectedSlotDissolveLabel = selectedSlot?.isMain
    ? selectedSlotIsOnlyOwnedSpirit
      ? '唯一灵宠不可解散'
      : '先更换主位'
    : '解散（返还 35% 兽魂）';
  const selectedSlotCanFeed = selectedSlot
    ? selectedSlot.level < SPIRIT_MAX_LEVEL
      && !selectedSlot.isAtBreakthroughNode
      && (spirit.spiritRoot ?? 0) >= 10
    : false;
  const selectedSlotFeedLabel = !selectedSlot
    ? '投喂 10 灵根'
    : selectedSlot.level >= SPIRIT_MAX_LEVEL
    ? '已满级'
    : selectedSlot.isAtBreakthroughNode
    ? '待突破'
    : (spirit.spiritRoot ?? 0) < 10
    ? '灵根不足'
    : '投喂 10 灵根';
  const selectedSlotAttack = selectedSlot && selectedSlotEntry ? getSpiritAttackAtLevel(selectedSlotEntry.definition, selectedSlot.level) : 0;
  const selectedSlotInnateTrait = getClientSpiritInnateTrait(selectedSlot?.spiritId);
  const selectedSlotFactionName = selectedSlotEntry ? getFactionLabel(selectedSlotEntry.definition.factionAffinity) : '';
  const selectedSlotSameFaction = selectedSlotFactionName === playerFaction;
  const selectedSlotFactionStatusText = selectedSlotEntry
    ? selectedSlotSameFaction
      ? `已触发 ${getFactionBonusLabel(selectedSlotFactionName)}`
      : `未触发，当前阵营为${playerFaction}`
    : '';
  const selectedTraitRollPlan = traitRollPlans.find((plan) => plan.mode === selectedTraitRollMode) ?? traitRollPlans[0];
  const selectedTraitRollGoldCost = getTraitRollGoldCost(
    selectedTraitRollPlan.mode === 'basic'
      ? getBasicSpiritTraitRollGoldCost(selectedSlot?.level ?? 10)
      : selectedTraitRollPlan.cost.gold,
    advantage,
  );
  const unlockedTraitSlotCount = selectedSlot?.unlockedTraitSlots ?? 0;
  const lockedTraitSlotCount = selectedTraitRollPlan.mode === 'basic' ? lockedTraitSlots.length : 0;
  const selectedTraitRollTianjiCost = lockedTraitSlotCount;
  const selectedTraitRollCostText = formatTraitRollCost(
    selectedTraitRollPlan.mode === 'basic'
      ? { ...selectedTraitRollPlan.cost, gold: getBasicSpiritTraitRollGoldCost(selectedSlot?.level ?? 10) }
      : selectedTraitRollPlan.cost,
    selectedTraitRollGoldCost,
    { tianjiTalisman: selectedTraitRollTianjiCost },
  );
  const selectedBreakthroughStage = selectedSlot?.breakthroughStage ?? 0;
  const selectedTraitRollHasSlots = unlockedTraitSlotCount > 0;
  const selectedTraitRollUnlocked = selectedBreakthroughStage >= selectedTraitRollPlan.unlockBreakthroughStage;
  const selectedTraitRollHasMaterials = (spirit.spiritMarrow ?? 0) >= selectedTraitRollPlan.cost.marrow
    && (spirit.spiritJade ?? 0) >= selectedTraitRollPlan.cost.jade
    && spirit.tianjiTalisman >= selectedTraitRollTianjiCost
    && vaultGold >= selectedTraitRollGoldCost;
  const selectedTraitRollLockFeatureUnlocked = (selectedSlot?.level ?? 0) >= 50;
  const selectedTraitRollLocksValid = selectedTraitRollPlan.mode !== 'basic'
    || (lockedTraitSlotCount === 0)
    || (selectedTraitRollLockFeatureUnlocked && lockedTraitSlotCount < unlockedTraitSlotCount);
  const selectedTraitRollDisabled = busy || !selectedTraitRollHasSlots || !selectedTraitRollUnlocked || !selectedTraitRollHasMaterials || !selectedTraitRollLocksValid || Boolean(pendingTraitRoll);
  const selectedTraitRollNeedsSlot = selectedTraitRollPlan.mode !== 'basic';
  const selectedTraitRollOptions = selectedTraitRollNeedsSlot
    ? {
      candidateCount: selectedTraitRollPlan.candidateCount,
      material: selectedTraitRollPlan.mode === 'normal' ? 'lingsui' as const : 'lingyu' as const,
      targetSlotIndex: targetTraitSlot,
    }
    : {
      candidateCount: selectedTraitRollPlan.candidateCount,
      lockedTraitSlotIndexes: lockedTraitSlots,
      material: 'gold' as const,
    };
  const advancedRerollGoldCost = getTraitRollGoldCost(CLIENT_SPIRIT_TRAIT_ROLL_RULES.advanced.cost.gold, advantage);
  const canRerollAdvancedTraitRoll = Boolean(pendingTraitRoll && pendingTraitRoll.mode === 'advanced')
    && !busy
    && (spirit.spiritJade ?? 0) >= CLIENT_SPIRIT_TRAIT_ROLL_RULES.advanced.cost.jade
    && vaultGold >= advancedRerollGoldCost;
  const isLevelFlashActive = Date.now() - levelFlashToken < 700;
  const toggleLockedTraitSlot = (slotIndex: number): void => {
    setLockedTraitSlots((current) => {
      if (current.includes(slotIndex)) {
        return current.filter((item) => item !== slotIndex);
      }

      const maxLockableSlots = Math.min(3, Math.max(unlockedTraitSlotCount - 1, 0));
      if (current.length >= maxLockableSlots) {
        return current;
      }

      return [...current, slotIndex].sort((left, right) => left - right);
    });
  };
  const runSelectedTraitRoll = async (): Promise<void> => {
    if (!selectedSlot) {
      return;
    }

    const result = await onRollTraits(selectedSlot.slotIndex, selectedSlot.slotVersion, selectedTraitRollPlan.mode, selectedTraitRollOptions);
    if (result?.traitRoll) {
      setPendingTraitRoll(result.traitRoll);
    } else {
      setPendingTraitRoll(null);
    }
  };
  const rerollAdvancedTraitGroup = async (): Promise<void> => {
    if (!selectedSlot || !pendingTraitRoll || pendingTraitRoll.mode !== 'advanced') {
      return;
    }

    const excludeCandidateIds = pendingTraitRoll.excludeCandidateIds && pendingTraitRoll.excludeCandidateIds.length > 0
      ? pendingTraitRoll.excludeCandidateIds
      : pendingTraitRoll.candidates.map((candidate) => candidate.candidateId);
    const result = await onRollTraits(selectedSlot.slotIndex, selectedSlot.slotVersion, 'advanced', {
      candidateCount: CLIENT_SPIRIT_TRAIT_ROLL_RULES.advanced.candidateCount,
      excludeCandidateIds,
      material: 'lingyu',
      targetSlotIndex: pendingTraitRoll.targetSlotIndex,
    });
    if (result?.traitRoll) {
      setPendingTraitRoll(result.traitRoll);
    }
  };

  useEffect(() => {
    if (!selectedSlot?.spiritId) {
      previousSelectedSlotRef.current = selectedSlot ?? null;
      return;
    }

    const previousSlot = previousSelectedSlotRef.current;
    if (!previousSlot || previousSlot.slotIndex !== selectedSlot.slotIndex) {
      previousSelectedSlotRef.current = selectedSlot;
      return;
    }

    const currentLevelExpRequired = Math.max(selectedSlot.currentLevelExpRequired ?? 1, 1);
    const levelGain = selectedSlot.level - previousSlot.level;
    const expGain = levelGain > 0
      ? levelGain * currentLevelExpRequired + selectedSlot.exp - previousSlot.exp
      : selectedSlot.exp - previousSlot.exp;

    if (selectedSlot.level < SPIRIT_MAX_LEVEL && expGain > 0) {
      setExpFloat({ id: Date.now(), text: `+${formatNumber(expGain)} \u7ecf\u9a8c` });
    }

    if (selectedSlot.level < SPIRIT_MAX_LEVEL && levelGain > 0) {
      setLevelFlashToken(Date.now());
      setResumeHint({ id: Date.now(), text: `\u5347\u7ea7\u6210\u529f\uff0c\u5f53\u524d Lv.${selectedSlot.level}` });
    }

    if (previousSlot.isAtBreakthroughNode && !selectedSlot.isAtBreakthroughNode) {
      setResumeHint({ id: Date.now(), text: '突破成功，继续挂机中' });
    }

    previousSelectedSlotRef.current = selectedSlot;
  }, [selectedSlot]);

  useEffect(() => {
    setSelectedPetTab('overview');
    setComposeStep('choose-spirit');
  }, [selectedSlotIndex]);

  useEffect(() => {
    const unlockedSlots = selectedSlot?.unlockedTraitSlots ?? 0;
    if (unlockedSlots <= 0) {
      setTargetTraitSlot(1);
      setLockedTraitSlots([]);
      setSelectedTraitRollMode('basic');
      setPendingTraitRoll(null);
      setGoldReforgeConfirmOpen(false);
      return;
    }

    setTargetTraitSlot((current) => Math.min(Math.max(current, 1), unlockedSlots));
    setLockedTraitSlots((current) => current.filter((slotIndex) => slotIndex <= unlockedSlots));
    setPendingTraitRoll(null);
    setGoldReforgeConfirmOpen(false);
  }, [selectedSlot?.slotIndex, selectedSlot?.unlockedTraitSlots]);

  useEffect(() => {
    setGoldReforgeConfirmOpen(false);
    if (selectedTraitRollMode !== 'basic') {
      setLockedTraitSlots([]);
    }
  }, [selectedTraitRollMode]);

  useEffect(() => {
    const fallbackPlan = traitRollPlans.find((plan) => selectedBreakthroughStage >= plan.unlockBreakthroughStage) ?? traitRollPlans[0];
    if (selectedBreakthroughStage < selectedTraitRollPlan.unlockBreakthroughStage) {
      setSelectedTraitRollMode(fallbackPlan.mode);
    }
  }, [selectedBreakthroughStage, selectedTraitRollPlan.unlockBreakthroughStage]);

  useEffect(() => {
    if (!expFloat) {
      return;
    }

    const timer = window.setTimeout(() => {
      setExpFloat((current) => current?.id === expFloat.id ? null : current);
    }, 900);

    return () => {
      window.clearTimeout(timer);
    };
  }, [expFloat]);

  useEffect(() => {
    if (!resumeHint) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResumeHint((current) => current?.id === resumeHint.id ? null : current);
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [resumeHint]);

  return (
    <div className="scene-shell">
      <div className="scene-scroll spirit-scene-scroll">
        {advantage && uiRules.showFactionAdvantage ? (
          <article className="panel-card faction-advantage-panel">
            <div className="panel-head">
              <h4>{advantage.factionName}优势</h4>
              <span className="soft-tag">{advantage.title}</span>
            </div>
            <p className="panel-text">{advantage.summary}</p>
            {advantage.details.length > 0 ? (
              <ul className="mini-list">
                {advantage.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ) : null}
        {uiRules.showCodexButton ? (
        <section className="spirit-top-actions">
          <button className="spirit-codex-button-card" onClick={() => setCodexOpen(true)} type="button">
            <span>灵宠图鉴</span>
            <strong>打开图鉴</strong>
          </button>
        </section>
        ) : null}

        {uiRules.showResourcePanel ? (
        <section className="panel-card spirit-growth-card">
          <div className="panel-head">
            <h4>养成资源</h4>
            <span className="soft-tag">种田养成 · 战斗突破</span>
          </div>
          <div className="spirit-resource-icon-row">
            {spiritResourceItems.map((item) => (
              <div className="spirit-resource-chip" key={item.key} title={item.label}>
                <span aria-hidden="true">{item.icon}</span>
                <strong>{formatNumber(spirit[item.key] ?? 0)}</strong>
              </div>
            ))}
          </div>
        </section>
        ) : null}

        <section className="spirit-main-row">
          {mainSlot && mainEntry ? (
            <article
              className={`spirit-profile-card spirit-profile-card-horizontal${canOpenOwnedPetDetail ? '' : ' is-tutorial-locked'}`}
              onClick={canOpenOwnedPetDetail ? () => setSelectedSlotIndex(mainSlot.slotIndex) : undefined}
              role={canOpenOwnedPetDetail ? 'button' : undefined}
              tabIndex={canOpenOwnedPetDetail ? 0 : undefined}
            >
              <div className="spirit-main-photo" aria-hidden="true">
                <div className={`spirit-portrait spirit-main-portrait ${getElementClass(mainSlot.element)}`}>
                  <span>{mainEntry.definition.label.slice(0, 1)}</span>
                </div>
              </div>
              <div className="spirit-profile-main spirit-main-info">
                <div className="spirit-name-row">
                  <div>
                    <p className="eyebrow">主位灵宠</p>
                    <h4>{mainEntry.definition.label}</h4>
                  </div>
                  <strong>{canOpenOwnedPetDetail ? `Lv.${mainSlot.level}` : '已结契'}</strong>
                </div>
                <div className="spirit-tag-row">
                  <span className={`spirit-rarity ${getRarityClass(getRarityLabel(mainEntry.definition.rarity))}`}>{getRarityLabel(mainEntry.definition.rarity)}</span>
                  <span className="faction-badge">{getFactionLabel(mainEntry.definition.factionAffinity)}</span>
                  {mainSlot.element ? <span className={`spirit-element-chip ${getElementClass(mainSlot.element)}`}>{getElementLabel(mainSlot.element)}</span> : null}
                  <span className="soft-tag">{getRoleLabel(mainEntry.definition.role)}</span>
                  <span className="soft-tag">{canOpenOwnedPetDetail ? getPhaseForLevel(mainSlot.level) : '养成稍后开放'}</span>
                  {getFactionLabel(mainEntry.definition.factionAffinity) === playerFaction ? <span className="soft-tag">同阵营 {getFactionBonusLabel(getFactionLabel(mainEntry.definition.factionAffinity))}</span> : null}
                </div>
              </div>
            </article>
          ) : (
            <button className="spirit-empty-main-card" onClick={() => setSelectedSlotIndex(slots[0]?.slotIndex ?? null)} type="button">
              <span className="spirit-empty-main-plus">+</span>
              <strong>当前暂无主位灵宠</strong>
              <span>请先在空栏位中完成合成，再设为主位</span>
            </button>
          )}
        </section>

        {uiRules.showStableSlots ? (
        <section className="panel-card spirit-stable-card">
          <div className="panel-head">
            <h4>兽栏</h4>
            <span className="soft-tag">单宠出战 · 多宠收藏</span>
          </div>
          <div className="spirit-stable-grid">
            {stableSlots.map((slot) => {
              const entry = slot.spiritId ? codexById.get(slot.spiritId) ?? null : null;

              return (
                <article className={`spirit-stable-slot${slot.spiritId && entry ? '' : ' spirit-stable-slot-empty'}`} key={slot.slotIndex} onClick={() => setSelectedSlotIndex(slot.slotIndex)} role="button" tabIndex={0}>
                  <strong>{slot.spiritId && entry ? `${entry.definition.label} Lv.${slot.level}` : '空栏位'}</strong>
                  <span>{slot.spiritId && entry ? `副位 ${slot.slotIndex - 1} · ${getElementLabel(slot.element)} · ${getHealthText(slot)}` : `副位 ${slot.slotIndex - 1}`}</span>
                  <small>{slot.spiritId && entry ? `${getPhaseForLevel(slot.level)} · ${getHealthStatus(slot)}` : '可合成新宠'}</small>
                </article>
              );
            })}
          </div>
        </section>
        ) : null}
      </div>

      {selectedSlot && portalTarget ? createPortal((
        <FullScreenToolShell
          ariaLabel="灵宠操作"
          bodyClassName={`seed-codex-body${selectedSlotEntry ? ' spirit-pet-action-body' : ''}`}
          className="spirit-pet-action-screen"
          eyebrow={selectedSlot.isMain ? '主位' : `副位 ${selectedSlot.slotIndex - 1}`}
          onBack={() => setSelectedSlotIndex(null)}
          title={selectedSlotEntry?.definition.label ?? '灵宠操作'}
        >
            <section className={`seed-codex-detail-card${selectedSlotEntry ? ' spirit-pet-detail-card' : ''}`}>
              {selectedSlotEntry && uiRules.allowOwnedPetDetail && uiRules.showPetActionTabs ? (
                <>
                  <SpiritStageCard
                    element={getElementLabel(selectedSlot.element) || undefined}
                    flash={isLevelFlashActive}
                    level={selectedSlot.level}
                    name={selectedSlotEntry.definition.label}
                    phase={getPhaseForLevel(selectedSlot.level)}
                    rarity={getRarityLabel(selectedSlotEntry.definition.rarity)}
                  />
                  <div className="spirit-pet-card-actions">
                    {!selectedSlot.isMain ? (
                      <button className="primary-button" disabled={busy} onClick={() => onSetMain(selectedSlot.slotIndex, selectedSlot.slotVersion)} type="button">设为主位</button>
                    ) : null}
                    <button className="ghost-button" disabled={busy || !selectedSlotCanDissolve} onClick={() => onDissolve(selectedSlot.slotIndex, selectedSlot.slotVersion)} type="button">{selectedSlotDissolveLabel}</button>
                  </div>
                  {resumeHint ? <p className="spirit-live-hint">{resumeHint.text}</p> : null}
                  <div className="spirit-progress-block">
                    <div className="spirit-progress-head">
                      <span>{'\u8840\u91cf'}</span>
                      <div className="spirit-progress-head-side">
                        <strong>{getHealthText(selectedSlot)}</strong>
                        <button className="secondary-button spirit-progress-action-button" disabled={busy || getHealthRatio(selectedSlot) >= 100 || recoveryPlan.totalRemaining <= 0 || availableTianjiTalisman < recoveryPlan.nextTalismanCost} onClick={() => onRecover(selectedSlot.slotIndex, selectedSlot.slotVersion)} type="button">{getRecoveryButtonText(recoveryPlan)}</button>
                      </div>
                    </div>
                    <div className="spirit-progress-track" aria-hidden="true">
                      <div className="spirit-progress-fill spirit-progress-fill-health" style={{ width: `${getHealthRatio(selectedSlot)}%` }} />
                    </div>
                  </div>
                  <div className="spirit-progress-block spirit-progress-block-live">
                    <div className="spirit-progress-head">
                      <span>{'\u7ecf\u9a8c'}</span>
                      <div className="spirit-progress-head-side">
                        <strong>
                          {selectedSlot.level >= SPIRIT_MAX_LEVEL
                            ? '已封顶'
                            : selectedSlot.isAtBreakthroughNode
                            ? '\u5f85\u7a81\u7834'
                            : `${formatNumber(selectedSlot.exp)} / ${formatNumber(Math.max(selectedSlot.currentLevelExpRequired ?? 1, 1))} \u00b7 ${Math.floor(getExpProgressPercent(selectedSlot))}%`}
                        </strong>
                        <button className="secondary-button spirit-progress-action-button" disabled={busy || !selectedSlotCanFeed} onClick={() => onFeed(selectedSlot.slotIndex, selectedSlot.slotVersion, 'feed_once')} type="button">{selectedSlotFeedLabel}</button>
                      </div>
                    </div>
                    <div className="spirit-progress-track" aria-hidden="true">
                      <div className="spirit-progress-fill" style={{ width: `${getExpProgressPercent(selectedSlot)}%` }} />
                    </div>
                    {expFloat ? <span className="spirit-exp-float">{expFloat.text}</span> : null}
                  </div>
                  <div className="spirit-pet-tab-row" role="tablist" aria-label="灵宠操作分组">
                    {petActionTabs.map((tab) => (
                      <button
                        aria-selected={selectedPetTab === tab.key}
                        className={`spirit-pet-tab ${selectedPetTab === tab.key ? 'is-active' : ''}`}
                        key={tab.key}
                        onClick={() => setSelectedPetTab(tab.key)}
                        role="tab"
                        type="button"
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="spirit-pet-tab-panel" role="tabpanel">
                    {selectedPetTab === 'overview' ? (
                      <section className="spirit-overview-panel">
                        <div className="spirit-attribute-grid">
                          <div className="spirit-attribute-card">
                            <span>攻击</span>
                            <strong>{formatNumber(selectedSlotAttack)}</strong>
                            <small>当前等级基础攻击</small>
                          </div>
                          <div className="spirit-attribute-card">
                            <span>血量</span>
                            <strong>{formatNumber(selectedSlot.maxHp)}</strong>
                            <small>{getHealthText(selectedSlot)} · {getHealthStatus(selectedSlot)}</small>
                          </div>
                        </div>

                        <div className="spirit-bonus-panel">
                          <div className="panel-head">
                            <h4>特性</h4>
                            <span className="soft-tag">先天</span>
                          </div>
                          <div className={`spirit-bonus-row${selectedSlotInnateTrait ? '' : ' is-muted'}`}>
                            <strong>{selectedSlotInnateTrait?.label ?? '特性待开放'}</strong>
                            <span>{selectedSlotInnateTrait?.description ?? '后续会接入每只灵宠的专属特性'}</span>
                          </div>
                        </div>

                        <div className="spirit-bonus-panel">
                          <div className="panel-head">
                            <h4>加成</h4>
                            <span className="soft-tag">Buff</span>
                          </div>
                          <div className="spirit-bonus-list">
                            <div className={`spirit-bonus-row${selectedSlotSameFaction ? '' : ' is-muted'}`}>
                              <strong>阵营加成</strong>
                              <span>{selectedSlotFactionName} · {selectedSlotFactionStatusText}</span>
                            </div>
                            <div className="spirit-bonus-row">
                              <strong>词条加成</strong>
                              <span>{getTraitBonusSummary(selectedSlot)}</span>
                            </div>
                            {advantage?.details.map((detail) => (
                              <div className="spirit-bonus-row" key={detail}>
                                <strong>{advantage.factionName}</strong>
                                <span>{detail}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>
                    ) : null}
                    {selectedPetTab === 'growth' ? (
                      <section className="spirit-growth-panel">
                        <div className="panel-head">
                          <h4>成长</h4>
                          <span className="soft-tag">{selectedSlot.isAtBreakthroughNode ? '待突破' : '挂机成长中'}</span>
                        </div>
                        <div className="seed-codex-stats">
                          <div className="seed-codex-stat-row"><strong>灵根库存</strong><span>{formatNumber(spirit.spiritRoot ?? 0)}</span></div>
                          <div className="seed-codex-stat-row"><strong>升级预估</strong><span>{getLevelRemainingText(selectedSlot)}</span></div>
                          <div className="seed-codex-stat-row"><strong>当前经验速度</strong><span>{getExpGainText(selectedSlot)}</span></div>
                          <div className="seed-codex-stat-row"><strong>自动加速</strong><span>{(selectedSlot.satiatedRemainingSeconds ?? 0) > 0 ? '自动加速中' : '未加速'}</span></div>
                          <div className="seed-codex-stat-row"><strong>剩余加速时间</strong><span>{formatDuration(selectedSlot.satiatedRemainingSeconds ?? 0)}</span></div>
                          <div className="seed-codex-stat-row"><strong>每次投喂</strong><span>固定消耗 10 灵根，追加 2 小时自动加速，可重复叠加</span></div>
                        </div>
                        {selectedSlot.isAtBreakthroughNode ? <p className="panel-text">突破后会立刻恢复挂机。投喂现在只负责续上自动加速，不再瞬间增加经验。</p> : <p className="panel-text">灵根只负责续上自动加速，经验按时间持续增长。粮食快用完时再来补就行。</p>}
                      </section>
                    ) : null}
                    {selectedPetTab === 'breakthrough' ? (
                      <section className="spirit-growth-panel">
                        <div className="panel-head">
                          <h4>突破</h4>
                          <span className="soft-tag">只消耗兽魂</span>
                        </div>
                        {selectedSlot.isAtBreakthroughNode && spirit.breakthroughRequirement ? (
                          <>
                            <p className="panel-text">Lv.{spirit.breakthroughRequirement.level} 满经验突破后升至 Lv.{spirit.breakthroughRequirement.level + 1}，需要 {spirit.breakthroughRequirement.label} x{spirit.breakthroughRequirement.required}，当前 {spirit.breakthroughRequirement.owned}。</p>
                            <button className="primary-button spirit-full-button" disabled={busy || !spirit.breakthroughRequirement.canBreakthrough} onClick={() => onBreakthrough(selectedSlot.slotIndex, selectedSlot.slotVersion, spirit.breakthroughRequirement?.stage)} type="button">手动突破</button>
                          </>
                        ) : (
                          <p className="panel-text">未到突破节点。Lv.9/19/29/39/49 满经验时需要手动突破，经验不会缓存溢出。</p>
                        )}
                      </section>
                    ) : null}
                    {selectedPetTab === 'traits' ? (
                      <section className="spirit-growth-panel">
                        <div className="trait-roll-current">
                          <div className="trait-roll-current-head">
                            <strong>当前词条</strong>
                            <span>重复叠加</span>
                          </div>
                          {Array.from({ length: 5 }, (_, index) => index + 1).map((slotIndex) => {
                            const trait = selectedSlot.traits?.find((item) => item.slotIndex === slotIndex);
                            const unlocked = slotIndex <= (selectedSlot.unlockedTraitSlots ?? 0);
                            const unlockLevel = slotIndex * 10;
                            const breakthroughLevel = unlockLevel - 1;
                            return (
                              <div className={`trait-roll-current-slot${unlocked ? '' : ' is-locked'}`} key={slotIndex}>
                                <span>{slotIndex}</span>
                                <strong>{trait ? trait.label : unlocked ? '待洗' : `Lv.${breakthroughLevel}`}</strong>
                                <small>{trait?.description ?? (unlocked ? '可洗练' : '突破开')}</small>
                              </div>
                            );
                          })}
                        </div>
                        {(selectedSlot.unlockedTraitSlots ?? 0) <= 0 ? <p className="panel-text">第一个词条会在 Lv.9 满经验完成突破后随机生成。</p> : null}
                        <div className="trait-roll-workflow">
                          <div className="trait-roll-resource-bar">
                            <span>灵髓 {formatNumber(spirit.spiritMarrow ?? 0)}</span>
                            <span>灵玉 {formatNumber(spirit.spiritJade ?? 0)}</span>
                            <span>天机符 {formatNumber(spirit.tianjiTalisman)}</span>
                            <span>金币 {formatNumber(vaultGold)}</span>
                          </div>
                          <div className="trait-roll-step-head">
                            <span>1</span>
                            <strong>选择方式</strong>
                          </div>
                          <div className="trait-roll-plan-grid" role="radiogroup" aria-label="洗练方式">
                            {traitRollPlans.map((plan) => {
                              const goldCost = plan.mode === 'basic'
                                ? getTraitRollGoldCost(getBasicSpiritTraitRollGoldCost(selectedSlot?.level ?? 10), advantage)
                                : getTraitRollGoldCost(plan.cost.gold, advantage);
                              const isSelected = selectedTraitRollMode === plan.mode;
                              const isUnlocked = selectedBreakthroughStage >= plan.unlockBreakthroughStage;
                              return (
                                <button
                                  aria-checked={isSelected}
                                  className={`trait-roll-plan${isSelected ? ' is-selected' : ''}${isUnlocked ? '' : ' is-locked'}`}
                                  disabled={!isUnlocked || Boolean(pendingTraitRoll)}
                                  key={plan.mode}
                                  onClick={() => setSelectedTraitRollMode(plan.mode)}
                                  role="radio"
                                  type="button"
                                >
                                  <span className="trait-roll-plan-head">
                                    <strong>{plan.label}</strong>
                                    <small>{isUnlocked ? plan.badge : `Lv.${plan.unlockLevel} 开`}</small>
                                  </span>
                                  <em>{formatTraitRollCost(plan.cost, goldCost)}</em>
                                </button>
                              );
                            })}
                          </div>

                          <div className="trait-roll-setup-panel">
                            <div className="trait-roll-step-head">
                              <span>2</span>
                              <strong>{selectedTraitRollNeedsSlot ? '选择槽位' : '选择锁定'}</strong>
                            </div>
                            <p className="trait-roll-mode-summary">{selectedTraitRollPlan.summary}</p>
                            {selectedTraitRollNeedsSlot ? (
                              <div className="trait-roll-slot-grid">
                                {Array.from({ length: selectedSlot.unlockedTraitSlots ?? 0 }, (_, index) => index + 1).map((slotIndex) => (
                                  <button
                                    className={`trait-roll-slot-button${targetTraitSlot === slotIndex ? ' is-selected' : ''}`}
                                    disabled={Boolean(pendingTraitRoll)}
                                    key={`target-${slotIndex}`}
                                    onClick={() => setTargetTraitSlot(slotIndex)}
                                    type="button"
                                  >
                                    {getTraitSlotDisplay(selectedSlot, slotIndex)}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="trait-roll-lock-grid">
                                {Array.from({ length: selectedSlot.unlockedTraitSlots ?? 0 }, (_, index) => index + 1).map((slotIndex) => {
                                  const isLocked = lockedTraitSlots.includes(slotIndex);
                                  const canAddLock = selectedTraitRollLockFeatureUnlocked && lockedTraitSlots.length < Math.min(3, Math.max(unlockedTraitSlotCount - 1, 0));
                                  return (
                                    <button
                                      className={`trait-roll-lock-button${isLocked ? ' is-selected' : ''}`}
                                      disabled={Boolean(pendingTraitRoll) || (!isLocked && !canAddLock)}
                                      key={`lock-${slotIndex}`}
                                      onClick={() => toggleLockedTraitSlot(slotIndex)}
                                      type="button"
                                    >
                                      <span>{getTraitSlotDisplay(selectedSlot, slotIndex)}</span>
                                      <small>{isLocked ? '已锁定' : canAddLock ? '可锁定' : selectedTraitRollLockFeatureUnlocked ? '不可再锁' : 'Lv.50 开放锁定'}</small>
                                    </button>
                                  );
                                })}
                                <p className="trait-roll-selection-note">
                                  {selectedTraitRollLockFeatureUnlocked ? (
                                    lockedTraitSlots.length > 0
                                      ? `本次保留 ${lockedTraitSlots.length} 条，额外消耗天机符 ${lockedTraitSlots.length}。`
                                      : '不锁定时会重洗全部已解锁词条。'
                                  ) : (
                                    '锁定功能 Lv.50 开放，当前仅可重洗全部已解锁词条。'
                                  )}
                                </p>
                              </div>
                            )}
                            {pendingTraitRoll ? (
                              <div className="trait-roll-result-panel">
                                <div className="trait-roll-step-head">
                                  <span>3</span>
                                  <strong>选择结果</strong>
                                </div>
                                <p className="trait-roll-selection-note">
                                  原词条：{pendingTraitRoll.currentTrait?.label ?? '空词条'}
                                </p>
                                <div className="trait-roll-candidate-grid">
                                  {pendingTraitRoll.candidates.map((candidate) => (
                                    <button
                                      className="trait-roll-candidate-button"
                                      disabled={busy}
                                      key={candidate.traitCode}
                                      onClick={async () => {
                                        const resolved = await onResolveTraitRoll(pendingTraitRoll.rollLogId, candidate.traitCode, selectedSlot.slotVersion);
                                        if (resolved) {
                                          setPendingTraitRoll(null);
                                        }
                                      }}
                                      type="button"
                                    >
                                      <strong>{candidate.label}</strong>
                                      <span>{candidate.description}</span>
                                    </button>
                                  ))}
                                </div>
                                {pendingTraitRoll.mode === 'advanced' ? (
                                  <button
                                    className="secondary-button trait-roll-keep-button"
                                    disabled={!canRerollAdvancedTraitRoll}
                                    onClick={rerollAdvancedTraitGroup}
                                    type="button"
                                  >
                                    换一组（灵玉 1 + 金币 {formatNumber(advancedRerollGoldCost)}）
                                  </button>
                                ) : null}
                                <button
                                  className="secondary-button trait-roll-keep-button"
                                  disabled={busy}
                                  onClick={async () => {
                                    const resolved = await onResolveTraitRoll(pendingTraitRoll.rollLogId, null, selectedSlot.slotVersion);
                                    if (resolved) {
                                      setPendingTraitRoll(null);
                                    }
                                  }}
                                  type="button"
                                >
                                  保留原词条
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="trait-roll-step-head">
                                  <span>3</span>
                                  <strong>{selectedTraitRollNeedsSlot ? '生成候选' : '执行洗练'}</strong>
                                </div>
                                {goldReforgeConfirmOpen && selectedTraitRollPlan.mode === 'basic' ? (
                                  <div className="trait-roll-warning-panel">
                                    <strong>确认金币重铸</strong>
                                    <p>{lockedTraitSlots.length > 0 ? `金币重铸会保留已锁定的 ${lockedTraitSlots.length} 条词条，其余已解锁词条会被随机替换。` : '金币重铸会随机替换全部已解锁词条，已洗好的词条也会被覆盖。'}</p>
                                    <label className="trait-roll-checkbox-row">
                                      <input
                                        checked={goldReforgeSkipChecked}
                                        onChange={(event) => setGoldReforgeSkipChecked(event.currentTarget.checked)}
                                        type="checkbox"
                                      />
                                      <span>本次登录不再提示</span>
                                    </label>
                                    <div className="trait-roll-warning-actions">
                                      <button className="secondary-button" onClick={() => setGoldReforgeConfirmOpen(false)} type="button">取消</button>
                                      <button
                                        className="primary-button"
                                        disabled={busy}
                                        onClick={async () => {
                                          if (goldReforgeSkipChecked) {
                                            setGoldReforgeSkipForSession(true);
                                          }
                                          setGoldReforgeConfirmOpen(false);
                                          await runSelectedTraitRoll();
                                        }}
                                        type="button"
                                      >
                                        重铸全部
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                                <button
                                  className="primary-button spirit-full-button trait-roll-confirm-button"
                                  disabled={selectedTraitRollDisabled}
                                  onClick={async () => {
                                    if (selectedTraitRollPlan.mode === 'basic' && !goldReforgeSkipForSession) {
                                      setGoldReforgeConfirmOpen(true);
                                      return;
                                    }
                                    await runSelectedTraitRoll();
                                  }}
                                  type="button"
                                >
                                  {selectedTraitRollHasSlots
                                    ? !selectedTraitRollUnlocked
                                      ? `Lv.${selectedTraitRollPlan.unlockLevel} 开放${selectedTraitRollPlan.label}`
                                      : selectedTraitRollHasMaterials
                                      ? selectedTraitRollPlan.confirmLabel
                                      : `资源不足：需要 ${selectedTraitRollCostText}`
                                    : '暂无可洗练词条槽'}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </section>
                    ) : null}
                  </div>
                </>
              ) : !selectedSlotEntry ? (
                <>
                  <div className="seed-codex-detail-head">
                    <div>
                      <p className="eyebrow">空栏位</p>
                      <h3>{selectedSlot.isMain || selectedSlot.slotIndex === 1 ? '主位' : `副位 ${selectedSlot.slotIndex - 1}`}</h3>
                    </div>
                  </div>
                  {availableComposePets.length > 0 ? (
                    <>
                      {composeStep === 'choose-spirit' ? (
                      <div className="spirit-compose-picker">
                        <div className="panel-head">
                          <h4>选择灵宠</h4>
                          <span className="soft-tag">第一只灵宠将入主位</span>
                        </div>
                        <div className="seed-codex-icon-grid spirit-compose-icon-grid">
                          {availableComposePets.map((entry) => (
                            <div className="spirit-compose-icon-item" key={entry.spiritId}>
                              <button
                                aria-label={`选择${entry.definition.label}`}
                                className={`seed-codex-icon spirit-compose-icon is-unlocked${selectedComposeEntry?.spiritId === entry.spiritId ? ' is-selected' : ''}`}
                                onClick={() => setSelectedComposeSpiritId(entry.spiritId)}
                                type="button"
                              >
                                <span>{entry.definition.label.slice(0, 2)}</span>
                              </button>
                              {uiRules.allowOwnedPetDetail ? <small>{entry.shardCount} / {entry.definition.shardUnlockRequired}</small> : <small>可结契</small>}
                            </div>
                          ))}
                        </div>
                        <button className="primary-button spirit-full-button" disabled={!selectedComposeEntry} onClick={() => setComposeStep('choose-element')} type="button">选定灵宠</button>
                      </div>
                      ) : selectedComposeEntry ? (
                        <div className="spirit-element-ritual">
                          <div className="panel-head">
                            <h4>注入五行灵力</h4>
                            <span className="soft-tag">五行相克时，战斗属性翻倍</span>
                          </div>
                          <div className="five-element-star" aria-label="五行相克图">
                            <div className="five-element-lines" aria-hidden="true" />
                            <div className={`five-element-center ${getElementClass(selectedComposeElementLabel)}`}>
                              <span>已选</span>
                              <strong>{selectedComposeElementLabel}</strong>
                            </div>
                            {elementChoices.map((element) => (
                              <button
                                aria-label={`注入${element.label}灵力`}
                                className={`five-element-node ${getElementClass(element.label)} ${getElementPositionClass(element.label)} ${composeElement === element.value ? 'is-selected' : ''}`}
                                key={element.value}
                                onClick={() => setComposeElement(element.value)}
                                type="button"
                              >
                                {element.label}
                              </button>
                            ))}
                          </div>
                          <div className="five-element-explain">
                            <strong>{selectedComposeElementLabel}灵力</strong>
                            <span>{getElementChoiceText(selectedComposeElementLabel)}，{getElementControlledByText(selectedComposeElementLabel)}。</span>
                            <small>战斗中若形成五行克制，相关战斗属性按翻倍计算。</small>
                          </div>
                          <div className="spirit-pet-action-grid">
                            <button className="ghost-button" disabled={busy} onClick={() => setComposeStep('choose-spirit')} type="button">重选灵宠</button>
                            <button className="primary-button" disabled={busy} onClick={() => onCompose(selectedComposeEntry.spiritId, selectedSlot.slotIndex, composeElement)} type="button">注入{selectedComposeElementLabel}灵力</button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="seed-codex-strategy">
                      <strong>暂无待合成灵宠</strong>
                      <p>继续通过战斗和主城赠送收集精魄。达到对应灵宠的合成门槛后，会在这里出现可合成项。</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="seed-codex-undiscovered-text">新手引导完成后开放灵宠养成详情。</p>
              )}
            </section>
        </FullScreenToolShell>
      ), portalTarget) : null}

      {codexOpen && portalTarget ? createPortal((
        <SpiritCodexModal
          entries={spirit.codex}
          onClose={() => setCodexOpen(false)}
          onSelectSpirit={setSelectedCodexSpiritId}
          selectedSpiritId={selectedCodexSpiritId}
          stableFull={isStableFull}
        />
      ), portalTarget) : null}
    </div>
  );
}
