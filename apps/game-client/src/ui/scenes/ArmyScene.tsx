import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  ClientSpiritCodexEntry,
  ClientSpiritElement,
  ClientFactionAdvantagePanel,
  ClientSpiritRarity,
  ClientSpiritRole,
  ClientSpiritRollMode,
  ClientSpiritSlot,
  ClientSpiritState,
  ClientSpiritTraitCode,
} from '@trinitywar/shared';
import type { TutorialArmyUiRules } from '../../tutorial/tutorialFlow';
import { FullScreenToolShell } from '../common/ModalShell';

interface ArmySceneProps {
  advantage?: ClientFactionAdvantagePanel;
  playerFaction: string;
  spirit: ClientSpiritState;
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
    options?: { lockedSlotIndex?: number; targetSlotIndex?: number; targetTraitCode?: ClientSpiritTraitCode },
  ) => void;
}

type DisplayRarity = '普通' | '稀有' | '传说';
type DisplayElement = '金' | '木' | '水' | '火' | '土';
type SpiritPetActionTab = 'overview' | 'growth' | 'breakthrough' | 'traits' | 'manage';
type SpiritComposeStep = 'choose-spirit' | 'choose-element';

const elementChoices: Array<{ value: ClientSpiritElement; label: DisplayElement }> = [
  { value: 'metal', label: '金' },
  { value: 'wood', label: '木' },
  { value: 'water', label: '水' },
  { value: 'fire', label: '火' },
  { value: 'earth', label: '土' },
];

const codexRarityGroups = [
  { key: 'common', label: '普通', rarity: 'common' as const },
  { key: 'rare', label: '稀有', rarity: 'rare' as const },
  { key: 'legend', label: '传说', rarity: 'legendary' as const },
];

const DAILY_FREE_RECOVERY_LIMIT = 3;
const DAILY_TALISMAN_RECOVERY_LIMIT = 3;
const MAX_QUICK_RECOVERY_PER_DAY = DAILY_FREE_RECOVERY_LIMIT + DAILY_TALISMAN_RECOVERY_LIMIT;
const SPIRIT_MAX_LEVEL = 50;
const STARTER_SPIRIT_IDS = ['canglang', 'linglu', 'qingyuan'];
const traitChoices: Array<{ code: ClientSpiritTraitCode; label: string }> = [
  { code: 'claw', label: '利爪' },
  { code: 'thick_skin', label: '厚皮' },
  { code: 'crit', label: '暴击' },
  { code: 'crit_damage', label: '爆伤' },
  { code: 'dodge', label: '闪避' },
  { code: 'counter', label: '反击' },
  { code: 'lifesteal', label: '吸血' },
  { code: 'tenacity', label: '韧性' },
];

const petActionTabs: Array<{ key: SpiritPetActionTab; label: string }> = [
  { key: 'overview', label: '基础' },
  { key: 'growth', label: '成长' },
  { key: 'breakthrough', label: '突破' },
  { key: 'traits', label: '洗点' },
  { key: 'manage', label: '管理' },
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
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

function getRecoveryStatusText(plan: ReturnType<typeof getRecoveryPlan>, isFullHp: boolean): string {
  const nextCost = plan.nextTalismanCost > 0 ? ` / 下次消耗 ${plan.nextTalismanCost} 天机符` : '';
  return `${isFullHp ? '已满血 / ' : ''}免费恢复剩余 ${plan.freeRemaining} 次 / 天机符恢复剩余 ${plan.talismanRemaining} 次${nextCost}`;
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

function isDiscovered(entry: ClientSpiritCodexEntry): boolean {
  return entry.hasSeen || entry.ownedEver || entry.shardCount > 0 || entry.ownedCurrent;
}

function isReadyToCompose(entry: ClientSpiritCodexEntry): boolean {
  return entry.readyToCompose;
}

function getShardLabel(entry: ClientSpiritCodexEntry): string {
  if (entry.ownedCurrent) {
    return '已拥有';
  }
  if (entry.readyToCompose) {
    return '待合成';
  }
  return `${entry.shardCount} / ${entry.definition.shardUnlockRequired}`;
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
  const { advantage, playerFaction, spirit, busy, uiRules, onSetMain, onRecover, onDissolve, onCompose, onFeed, onBreakthrough, onRollTraits } = props;
  const [codexOpen, setCodexOpen] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [selectedCodexSpiritId, setSelectedCodexSpiritId] = useState<string | null>(() => spirit.codex.find((entry) => isDiscovered(entry))?.spiritId ?? spirit.codex[0]?.spiritId ?? null);
  const [selectedComposeSpiritId, setSelectedComposeSpiritId] = useState<string>(() => spirit.readyToCompose.find((entry) => !entry.ownedCurrent)?.spiritId ?? '');
  const [composeElement, setComposeElement] = useState<ClientSpiritElement>('wood');
  const [composeStep, setComposeStep] = useState<SpiritComposeStep>('choose-spirit');
  const [lockedTraitSlot, setLockedTraitSlot] = useState(1);
  const [targetTraitSlot, setTargetTraitSlot] = useState(1);
  const [targetTraitCode, setTargetTraitCode] = useState<ClientSpiritTraitCode>('crit');
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
  const selectedCodexEntry = selectedCodexSpiritId ? codexById.get(selectedCodexSpiritId) ?? null : null;
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
  const codexGroups = codexRarityGroups.map((group) => ({
    ...group,
    pets: spirit.codex.filter((entry) => entry.definition.rarity === group.rarity),
  }));
  const isLevelFlashActive = Date.now() - levelFlashToken < 700;
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
                  {resumeHint ? <p className="spirit-live-hint">{resumeHint.text}</p> : null}
                  <div className="spirit-progress-block">
                    <div className="spirit-progress-head">
                      <span>{'\u8840\u91cf'}</span>
                      <strong>{getHealthText(selectedSlot)}</strong>
                    </div>
                    <div className="spirit-progress-track" aria-hidden="true">
                      <div className="spirit-progress-fill spirit-progress-fill-health" style={{ width: `${getHealthRatio(selectedSlot)}%` }} />
                    </div>
                  </div>
                  <div className="spirit-progress-block spirit-progress-block-live">
                    <div className="spirit-progress-head">
                      <span>{'\u7ecf\u9a8c'}</span>
                      <strong>
                        {selectedSlot.level >= SPIRIT_MAX_LEVEL
                          ? '已封顶'
                          : selectedSlot.isAtBreakthroughNode
                          ? '\u5f85\u7a81\u7834'
                          : `${formatNumber(selectedSlot.exp)} / ${formatNumber(Math.max(selectedSlot.currentLevelExpRequired ?? 1, 1))} \u00b7 ${Math.floor(getExpProgressPercent(selectedSlot))}%`}
                      </strong>
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
                      <>
                        <div className="seed-codex-stats">
                          <div className="seed-codex-stat-row"><strong>稀有度</strong><span>{getRarityLabel(selectedSlotEntry.definition.rarity)}</span></div>
                          <div className="seed-codex-stat-row"><strong>阵营加成</strong><span>{getFactionLabel(selectedSlotEntry.definition.factionAffinity) === playerFaction ? `已触发 ${getFactionBonusLabel(getFactionLabel(selectedSlotEntry.definition.factionAffinity))}` : `未触发，当前阵营为${playerFaction}`}</span></div>
                          <div className="seed-codex-stat-row"><strong>升级方式</strong><span>挂机经验自动升级</span></div>
                          <div className="seed-codex-stat-row"><strong>突破材料</strong><span>只消耗普通/稀有/传说兽魂</span></div>
                          <div className="seed-codex-stat-row"><strong>天机符</strong><span>{formatNumber(availableTianjiTalisman)}</span></div>
                          <div className="seed-codex-stat-row"><strong>当前血量</strong><span>{getHealthText(selectedSlot)}</span></div>
                          <div className="seed-codex-stat-row"><strong>当前状态</strong><span>{getHealthStatus(selectedSlot)}</span></div>
                          <div className="seed-codex-stat-row"><strong>恢复情况</strong><span>{getRecoveryStatusText(recoveryPlan, getHealthRatio(selectedSlot) >= 100)}</span></div>
                        </div>
                      </>
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
                        <div className="spirit-pet-action-grid">
                          <button className="secondary-button" disabled={busy || (spirit.spiritRoot ?? 0) < 10} onClick={() => onFeed(selectedSlot.slotIndex, selectedSlot.slotVersion, 'feed_once')} type="button">投喂 10 灵根</button>
                        </div>
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
                        <div className="panel-head">
                          <h4>词条洗练</h4>
                          <span className="soft-tag">重复叠加不衰减</span>
                        </div>
                        <div className="task-list">
                          {Array.from({ length: 5 }, (_, index) => index + 1).map((slotIndex) => {
                            const trait = selectedSlot.traits?.find((item) => item.slotIndex === slotIndex);
                            const unlocked = slotIndex <= (selectedSlot.unlockedTraitSlots ?? 0);
                            const unlockLevel = slotIndex * 10;
                            const breakthroughLevel = unlockLevel - 1;
                            return (
                              <div className={`task-row spirit-trait-row${trait?.sourceType === 'natural' ? ' is-natural' : ''}`} key={slotIndex}>
                                <span className="task-index">{slotIndex}</span>
                                <div>
                                  <div className="task-row-head">
                                    <strong>{trait ? trait.label : unlocked ? '待洗练' : `Lv.${breakthroughLevel} 突破解锁`}</strong>
                                    <span className="task-state-badge">{unlocked ? '已解锁' : '未解锁'}</span>
                                  </div>
                                  <p>{trait?.description ?? (unlocked ? '洗练后生成词条' : `达到 Lv.${breakthroughLevel} 满经验并完成突破后解锁`)}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {(selectedSlot.unlockedTraitSlots ?? 0) <= 0 ? <p className="panel-text">第一个词条会在 Lv.9 满经验完成突破后随机生成。</p> : null}
                        <div className="spirit-element-picker">
                          {Array.from({ length: selectedSlot.unlockedTraitSlots ?? 0 }, (_, index) => index + 1).map((slotIndex) => (
                            <button className={`spirit-element-chip ${lockedTraitSlot === slotIndex ? ' is-selected' : ''}`} key={`lock-${slotIndex}`} onClick={() => setLockedTraitSlot(slotIndex)} type="button">锁 {slotIndex}</button>
                          ))}
                        </div>
                        <div className="spirit-element-picker">
                          {Array.from({ length: selectedSlot.unlockedTraitSlots ?? 0 }, (_, index) => index + 1).map((slotIndex) => (
                            <button className={`spirit-element-chip ${targetTraitSlot === slotIndex ? ' is-selected' : ''}`} key={`target-${slotIndex}`} onClick={() => setTargetTraitSlot(slotIndex)} type="button">槽 {slotIndex}</button>
                          ))}
                        </div>
                        <div className="spirit-element-picker">
                          {traitChoices.map((trait) => (
                            <button className={`spirit-element-chip ${targetTraitCode === trait.code ? ' is-selected' : ''}`} key={trait.code} onClick={() => setTargetTraitCode(trait.code)} type="button">{trait.label}</button>
                          ))}
                        </div>
                        <div className="spirit-pet-action-grid">
                          <button className="secondary-button" disabled={busy || (selectedSlot.unlockedTraitSlots ?? 0) <= 0 || (spirit.spiritMarrow ?? 0) < 5} onClick={() => onRollTraits(selectedSlot.slotIndex, selectedSlot.slotVersion, 'basic')} type="button">基础洗练 5 灵髓 + 金币</button>
                          <button className="secondary-button" disabled={busy || (selectedSlot.unlockedTraitSlots ?? 0) <= 0 || (spirit.spiritMarrow ?? 0) < 50} onClick={() => onRollTraits(selectedSlot.slotIndex, selectedSlot.slotVersion, 'batch_basic')} type="button">连续洗练 10 次</button>
                          <button className="secondary-button" disabled={busy || (selectedSlot.unlockedTraitSlots ?? 0) <= 0 || (spirit.spiritMarrow ?? 0) < 10 || (spirit.spiritJade ?? 0) < 1} onClick={() => onRollTraits(selectedSlot.slotIndex, selectedSlot.slotVersion, 'advanced', { lockedSlotIndex: lockedTraitSlot })} type="button">高级洗练 锁 1 条</button>
                          <button className="secondary-button" disabled={busy || (selectedSlot.unlockedTraitSlots ?? 0) <= 0 || (spirit.spiritMarrow ?? 0) < 20 || (spirit.spiritJade ?? 0) < 5} onClick={() => onRollTraits(selectedSlot.slotIndex, selectedSlot.slotVersion, 'ultimate', { targetSlotIndex: targetTraitSlot, targetTraitCode })} type="button">终极洗练 定向</button>
                        </div>
                      </section>
                    ) : null}
                    {selectedPetTab === 'manage' ? (
                      <div className="spirit-pet-action-grid">
                        <button className="primary-button" disabled={busy || selectedSlot.isMain} onClick={() => onSetMain(selectedSlot.slotIndex, selectedSlot.slotVersion)} type="button">设为主位</button>
                        <button className="secondary-button" disabled type="button">挂机升级中</button>
                        <button className="secondary-button" disabled={busy || getHealthRatio(selectedSlot) >= 100 || recoveryPlan.totalRemaining <= 0 || availableTianjiTalisman < recoveryPlan.nextTalismanCost} onClick={() => onRecover(selectedSlot.slotIndex, selectedSlot.slotVersion)} type="button">{getRecoveryButtonText(recoveryPlan)}</button>
                        <button className="ghost-button" disabled={busy || selectedSlot.isMain} onClick={() => onDissolve(selectedSlot.slotIndex, selectedSlot.slotVersion)} type="button">解散（返还 35% 兽魂）</button>
                      </div>
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
                      <p>继续通过战斗和主城赠送收集精魄。精魄满 100 后会在这里出现可合成项。</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="seed-codex-undiscovered-text">新手引导完成后开放灵宠养成详情。</p>
              )}
            </section>
        </FullScreenToolShell>
      ), portalTarget) : null}

      {codexOpen && selectedCodexEntry && portalTarget ? createPortal((
        <FullScreenToolShell
          ariaLabel="灵宠图鉴"
          bodyClassName="seed-codex-body"
          className="spirit-codex-screen"
          description="记录见过、解锁、待合成和曾经拥有过的灵宠"
          onBack={() => setCodexOpen(false)}
          title="灵宠图鉴"
        >
            {codexGroups.map((group) => (
              <section className="panel-card seed-codex-rarity-row" key={group.key}>
                <div className="seed-codex-rarity-head">
                  <strong>{group.label}</strong>
                </div>
                <div className="seed-codex-icon-grid">
                  {group.pets.map((entry) => {
                    const discovered = isDiscovered(entry);
                    return (
                      <button
                        aria-label={discovered ? entry.definition.label : '尚未展示'}
                        className={`seed-codex-icon ${discovered ? 'is-unlocked' : 'is-locked'} ${entry.spiritId === selectedCodexEntry.spiritId && discovered ? 'is-selected' : ''}`}
                        disabled={!discovered}
                        key={entry.spiritId}
                        onClick={() => setSelectedCodexSpiritId(entry.spiritId)}
                        type="button"
                      >
                        <span>{discovered ? entry.definition.label.slice(0, 2) : '？？'}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

            <section className={`seed-codex-detail-card ${isDiscovered(selectedCodexEntry) ? '' : 'is-undiscovered'}`}>
              {isDiscovered(selectedCodexEntry) ? (
                <>
                  <div className="seed-codex-detail-head">
                    <div>
                      <p className="eyebrow">{getRarityLabel(selectedCodexEntry.definition.rarity)}</p>
                      <h3>{selectedCodexEntry.definition.label}</h3>
                    </div>
                  </div>
                  <p className="seed-codex-lore">{selectedCodexEntry.definition.lore ?? '尚未补充该灵宠的额外背景描述。'}</p>
                  <div className="seed-codex-stats">
                    <div className="seed-codex-stat-row"><strong>阵营归属</strong><span>{getFactionLabel(selectedCodexEntry.definition.factionAffinity)}</span></div>
                    <div className="seed-codex-stat-row"><strong>主模板</strong><span>{getRoleLabel(selectedCodexEntry.definition.role)}</span></div>
                    <div className="seed-codex-stat-row"><strong>精魄进度</strong><span>{getShardLabel(selectedCodexEntry)}</span></div>
                    <div className="seed-codex-stat-row"><strong>曾经拥有</strong><span>{selectedCodexEntry.ownedEver ? '是' : '否'}</span></div>
                    <div className="seed-codex-stat-row"><strong>五行状态</strong><span>{selectedCodexEntry.ownedCurrent ? '已固定当前五行' : '未合成前可自选五行'}</span></div>
                  </div>
                  {isReadyToCompose(selectedCodexEntry) ? (
                    <div className="seed-codex-strategy">
                      <strong>待合成</strong>
                      <p>{isStableFull ? '当前兽栏已满，需要先解散旧宠腾出栏位。图鉴只记录状态，不直接发宠。' : '精魄已满。请返回兽栏，点开一个空栏位完成合成与五行指定。'}</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="seed-codex-undiscovered-text">尚未展示</p>
              )}
            </section>
        </FullScreenToolShell>
      ), portalTarget) : null}
    </div>
  );
}
