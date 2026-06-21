import type { ClientRaidBattleReplay, ClientRaidBattleStep } from '@trinitywar/shared';
import { cloneBattleCanvasScene, createBattleCanvasBaseScene } from './scene.js';
import { resolveBattleCanvasTiming } from './timing.js';
import type {
  BattleCanvasController,
  BattleCanvasFloatingTextState,
  BattleCanvasImpactTone,
  BattleCanvasPlaybackSnapshot,
  BattleCanvasSideCalloutState,
  BattleCanvasTimelineSegment,
  BattleCanvasTiming,
} from './types.js';

const READY_ADVANCE = 0.14;
const IMPACT_SCALE_BOOST = 0.08;

export function createBattleCanvasController(input: {
  replay: ClientRaidBattleReplay;
  timing?: Partial<BattleCanvasTiming>;
}): BattleCanvasController {
  const timing = resolveBattleCanvasTiming(input.timing);
  const timeline = buildBattleCanvasTimeline(input.replay.steps, timing);
  const totalDurationMs = timeline.length > 0 ? timeline[timeline.length - 1].endMs : timing.battleStartDelayMs;
  const baseScene = createBattleCanvasBaseScene(input.replay, totalDurationMs);

  return {
    replay: input.replay,
    timing,
    timeline,
    getTotalDurationMs(): number {
      return totalDurationMs;
    },
    sampleAt(elapsedMs: number): BattleCanvasPlaybackSnapshot {
      return sampleBattleCanvasPlayback({
        baseScene,
        elapsedMs,
        replay: input.replay,
        timeline,
        totalDurationMs,
      });
    },
  };
}

function buildBattleCanvasTimeline(
  steps: ClientRaidBattleStep[],
  timing: BattleCanvasTiming,
): BattleCanvasTimelineSegment[] {
  const segments: BattleCanvasTimelineSegment[] = [];
  let cursorMs = 0;
  let lastRound: number | null = null;

  for (const [stepIndex, step] of steps.entries()) {
    if (step.type === 'enter') {
      cursorMs = pushSegment(segments, {
        phase: 'enter',
        step,
        stepIndex,
        startMs: cursorMs,
        durationMs: Math.max(step.durationMs, timing.battleStartDelayMs),
        round: lastRound,
        bloodRound: null,
      });
      continue;
    }

    if (step.type === 'clash') {
      const round: number = step.round ?? lastRound ?? 1;
      const clashDuration = Math.max(step.durationMs, timing.readyMs + timing.dashMs + timing.impactFreezeMs);
      const overflowMs = clashDuration - (timing.readyMs + timing.dashMs + timing.impactFreezeMs);
      lastRound = round;

      cursorMs = pushSegment(segments, {
        phase: 'round_ready',
        step,
        stepIndex,
        startMs: cursorMs,
        durationMs: timing.readyMs,
        round,
        bloodRound: null,
      });
      cursorMs = pushSegment(segments, {
        phase: 'round_dash',
        step,
        stepIndex,
        startMs: cursorMs,
        durationMs: timing.dashMs,
        round,
        bloodRound: null,
      });
      cursorMs = pushSegment(segments, {
        phase: 'round_impact',
        step,
        stepIndex,
        startMs: cursorMs,
        durationMs: timing.impactFreezeMs + overflowMs,
        round,
        bloodRound: null,
      });
      continue;
    }

    if (step.type === 'notice') {
      cursorMs = pushSegment(segments, {
        phase: 'notice',
        step,
        stepIndex,
        startMs: cursorMs,
        durationMs: Math.max(step.durationMs, step.tone === 'blood' ? timing.bloodNoticeMs : step.durationMs),
        round: lastRound,
        bloodRound: null,
      });
      continue;
    }

    if (step.type === 'floatingText') {
      lastRound = step.round ?? lastRound;
      cursorMs = pushSegment(segments, {
        phase: step.tone === 'blood' || typeof step.bloodRound === 'number' ? 'blood_damage' : 'round_damage',
        step,
        stepIndex,
        startMs: cursorMs,
        durationMs: step.durationMs,
        round: step.round ?? lastRound,
        bloodRound: step.bloodRound ?? null,
      });
      continue;
    }

    if (step.type === 'hpChange') {
      lastRound = step.round ?? lastRound;
      const isBloodStep = step.floatingTone === 'blood' || typeof step.bloodRound === 'number';
      cursorMs = pushSegment(segments, {
        phase: isBloodStep ? 'blood_damage' : 'round_damage',
        step,
        stepIndex,
        startMs: cursorMs,
        durationMs: Math.max(step.durationMs, isBloodStep ? timing.bloodTickMs : timing.hpTweenMs),
        round: step.round ?? lastRound,
        bloodRound: step.bloodRound ?? null,
      });
      continue;
    }

    if (step.type === 'return') {
      cursorMs = pushSegment(segments, {
        phase: 'round_return',
        step,
        stepIndex,
        startMs: cursorMs,
        durationMs: Math.max(step.durationMs, timing.returnMs) + timing.roundGapMs,
        round: lastRound,
        bloodRound: null,
      });
      continue;
    }

    if (step.type === 'result') {
      cursorMs = pushSegment(segments, {
        phase: 'result',
        step,
        stepIndex,
        startMs: cursorMs,
        durationMs: Math.max(step.durationMs, timing.resultHoldMs),
        round: lastRound,
        bloodRound: null,
      });
    }
  }

  return segments;
}

function pushSegment(
  segments: BattleCanvasTimelineSegment[],
  input: Omit<BattleCanvasTimelineSegment, 'endMs'>,
): number {
  const endMs = input.startMs + input.durationMs;
  segments.push({
    ...input,
    endMs,
  });
  return endMs;
}

function sampleBattleCanvasPlayback(input: {
  baseScene: BattleCanvasPlaybackSnapshot;
  elapsedMs: number;
  replay: ClientRaidBattleReplay;
  timeline: readonly BattleCanvasTimelineSegment[];
  totalDurationMs: number;
}): BattleCanvasPlaybackSnapshot {
  const clampedElapsedMs = clamp(input.elapsedMs, 0, input.totalDurationMs);
  const scene = cloneBattleCanvasScene(input.baseScene);
  scene.elapsedMs = clampedElapsedMs;
  scene.completed = clampedElapsedMs >= input.totalDurationMs;

  let activeSegment: BattleCanvasTimelineSegment | null = null;
  for (const segment of input.timeline) {
    if (segment.endMs <= clampedElapsedMs) {
      applyCompletedSegment(scene, segment);
      continue;
    }
    if (segment.startMs <= clampedElapsedMs) {
      activeSegment = segment;
    }
    break;
  }

  if (activeSegment) {
    const localElapsedMs = clampedElapsedMs - activeSegment.startMs;
    const progress = activeSegment.durationMs > 0 ? clamp(localElapsedMs / activeSegment.durationMs, 0, 1) : 1;
    applyActiveSegment(scene, activeSegment, progress);
    scene.sideCallouts = collectSideCallouts(input.replay, scene.phase, scene.round, scene.bloodRound, progress);
  } else {
    scene.sideCallouts = [];
  }

  scene.floatingTexts = collectFloatingTexts(input.timeline, clampedElapsedMs);
  if (!activeSegment) {
    scene.sideCallouts = [];
  }
  scene.impactTone = resolveImpactTone(scene.notice?.tone, scene.floatingTexts);
  if (scene.completed) {
    scene.result.visible = true;
    scene.result.progress = 1;
  }

  return scene;
}

function applyCompletedSegment(
  scene: BattleCanvasPlaybackSnapshot,
  segment: BattleCanvasTimelineSegment,
): void {
  scene.phase = segment.phase;
  scene.round = segment.round;
  scene.bloodRound = segment.bloodRound;
  scene.notice = null;

  if (segment.step.type === 'notice' && segment.step.tone === 'blood') {
    scene.enteredBloodMode = true;
  }

  if (segment.bloodRound !== null) {
    scene.enteredBloodMode = true;
  }

  if (segment.phase === 'round_ready') {
    setAdvance(scene, READY_ADVANCE);
    return;
  }

  if (segment.phase === 'round_dash' || segment.phase === 'round_impact' || segment.phase === 'round_damage' || segment.phase === 'blood_damage') {
    setAdvance(scene, 1);
  }

  if (segment.phase === 'round_return') {
    setAdvance(scene, 0);
    setScale(scene, 1);
  }

  if (segment.step.type === 'hpChange') {
    const unit = segment.step.side === 'attacker' ? scene.attacker : scene.defender;
    unit.displayHp = segment.step.to;
    unit.defeated = segment.step.to <= 0;
    unit.opacity = unit.defeated ? 0.42 : 1;
  }

  if (segment.phase === 'result') {
    scene.result.visible = true;
    scene.result.progress = 1;
  }
}

function applyActiveSegment(
  scene: BattleCanvasPlaybackSnapshot,
  segment: BattleCanvasTimelineSegment,
  progress: number,
): void {
  scene.phase = segment.phase;
  scene.round = segment.round;
  scene.bloodRound = segment.bloodRound;
  scene.notice = null;

  if (segment.step.type === 'notice') {
    scene.notice = {
      title: segment.step.title,
      summary: segment.step.summary,
      tone: segment.step.tone ?? 'default',
      progress,
    };
    if (segment.step.tone === 'blood') {
      scene.enteredBloodMode = true;
    }
  }

  if (segment.bloodRound !== null || (segment.step.type === 'hpChange' && segment.step.floatingTone === 'blood')) {
    scene.enteredBloodMode = true;
  }

  if (segment.phase === 'round_ready') {
    setAdvance(scene, READY_ADVANCE * easeOutCubic(progress));
    setScale(scene, 1);
    return;
  }

  if (segment.phase === 'round_dash') {
    setAdvance(scene, READY_ADVANCE + (1 - READY_ADVANCE) * easeInCubic(progress));
    return;
  }

  if (segment.phase === 'round_impact') {
    setAdvance(scene, 1);
    setScale(scene, 1 + IMPACT_SCALE_BOOST * impactPulse(progress));
    return;
  }

  if (segment.phase === 'round_damage' || segment.phase === 'blood_damage') {
    setAdvance(scene, 1);
    setScale(scene, 1);

    if (segment.step.type === 'hpChange') {
      const unit = segment.step.side === 'attacker' ? scene.attacker : scene.defender;
      unit.displayHp = lerp(segment.step.from, segment.step.to, easeInOutCubic(progress));
      unit.defeated = unit.displayHp <= 0;
      unit.opacity = unit.defeated ? 0.42 : 1;
    }
    return;
  }

  if (segment.phase === 'round_return') {
    setAdvance(scene, 1 - easeInOutCubic(progress));
    setScale(scene, 1);
    return;
  }

  if (segment.phase === 'result') {
    scene.result.visible = true;
    scene.result.progress = progress;
  }
}

function collectFloatingTexts(
  timeline: readonly BattleCanvasTimelineSegment[],
  elapsedMs: number,
): BattleCanvasFloatingTextState[] {
  const items: BattleCanvasFloatingTextState[] = [];

  for (const segment of timeline) {
    if (elapsedMs < segment.startMs || elapsedMs > segment.endMs) {
      continue;
    }

    const progress = segment.durationMs > 0
      ? clamp((elapsedMs - segment.startMs) / segment.durationMs, 0, 1)
      : 1;

    if (segment.step.type === 'floatingText') {
      items.push({
        id: `${segment.stepIndex}-${segment.step.side}-${segment.step.text}`,
        side: segment.step.side,
        text: segment.step.text,
        tone: segment.step.tone,
        progress,
        opacity: 1 - progress * 0.35,
      });
      continue;
    }

    if (segment.step.type === 'hpChange' && typeof segment.step.floatingText === 'string') {
      items.push({
        id: `${segment.stepIndex}-${segment.step.side}-hp`,
        side: segment.step.side,
        text: segment.step.floatingText,
        tone: segment.step.floatingTone ?? 'damage',
        progress,
        opacity: 1 - progress * 0.4,
      });
    }
  }

  return items.slice(-4);
}

function collectSideCallouts(
  replay: ClientRaidBattleReplay,
  phase: BattleCanvasPlaybackSnapshot['phase'],
  round: number | null,
  bloodRound: number | null,
  progress: number,
): BattleCanvasSideCalloutState[] {
  if (phase !== 'round_damage' && phase !== 'blood_damage') {
    return [];
  }

  const callouts: BattleCanvasSideCalloutState[] = [];

  if (phase === 'blood_damage' && bloodRound !== null) {
    callouts.push(
      {
        id: `blood-attacker-${round}-${bloodRound}`,
        side: 'attacker',
        text: '燃血',
        tone: 'blood',
        progress,
        opacity: 0.96,
      },
      {
        id: `blood-defender-${round}-${bloodRound}`,
        side: 'defender',
        text: '燃血',
        tone: 'blood',
        progress,
        opacity: 0.96,
      },
    );
  }

  if (round === null) {
    return callouts;
  }

  const sideHints = extractEventHintsForRound(replay, round);
  for (const hint of sideHints) {
    callouts.push({
      id: `${hint.side}-${round}-${hint.text}`,
      side: hint.side,
      text: hint.text,
      tone: hint.tone,
      progress,
      opacity: 0.96,
    });
  }

  return dedupeSideCallouts(callouts).slice(0, 2);
}

function extractEventHintsForRound(
  replay: ClientRaidBattleReplay,
  round: number,
): Array<{
  side: 'attacker' | 'defender';
  text: string;
  tone: BattleCanvasImpactTone;
  priority: number;
}> {
  const hints: Array<{
    side: 'attacker' | 'defender';
    text: string;
    tone: BattleCanvasImpactTone;
    priority: number;
  }> = [];

  for (const event of replay.events) {
    if (!event.label.includes(`第 ${round} 回合`)) {
      continue;
    }

    if (event.type === 'critical') {
      if (event.label.includes('攻方')) {
        hints.push({ side: 'attacker', text: '暴击', tone: 'crit', priority: 4 });
      }
      if (event.label.includes('守方')) {
        hints.push({ side: 'defender', text: '暴击', tone: 'crit', priority: 4 });
      }
      continue;
    }

    if (event.type === 'element') {
      if (event.label.includes('攻方')) {
        hints.push({ side: 'attacker', text: event.label.includes('被克') ? '被克' : '克制', tone: 'element', priority: 3 });
      }
      if (event.label.includes('守方')) {
        hints.push({ side: 'defender', text: event.label.includes('被克') ? '被克' : '克制', tone: 'element', priority: 3 });
      }
      continue;
    }

    if (event.type === 'trait') {
      const traitLabel = extractTraitLabel(event.label);
      if (!traitLabel) {
        continue;
      }
      if (event.description.includes('攻方')) {
        hints.push({ side: 'attacker', text: traitLabel, tone: 'default', priority: 2 });
      }
      if (event.description.includes('守方')) {
        hints.push({ side: 'defender', text: traitLabel, tone: 'default', priority: 2 });
      }
    }
  }

  return selectBestHintsBySide(hints);
}

function extractTraitLabel(label: string): string | null {
  const triggerMatch = label.match(/触发(.+)$/);
  if (triggerMatch?.[1]) {
    return triggerMatch[1];
  }

  const sideMatch = label.match(/回合(?:攻方|守方)(.+)$/);
  if (sideMatch?.[1]) {
    return sideMatch[1];
  }

  return null;
}

function selectBestHintsBySide(
  hints: Array<{
    side: 'attacker' | 'defender';
    text: string;
    tone: BattleCanvasImpactTone;
    priority: number;
  }>,
): Array<{
  side: 'attacker' | 'defender';
  text: string;
  tone: BattleCanvasImpactTone;
  priority: number;
}> {
  const bestBySide = new Map<'attacker' | 'defender', {
    side: 'attacker' | 'defender';
    text: string;
    tone: BattleCanvasImpactTone;
    priority: number;
  }>();

  for (const hint of hints) {
    const current = bestBySide.get(hint.side);
    if (!current || hint.priority > current.priority) {
      bestBySide.set(hint.side, hint);
    }
  }

  return [...bestBySide.values()];
}

function dedupeSideCallouts(callouts: BattleCanvasSideCalloutState[]): BattleCanvasSideCalloutState[] {
  const seen = new Set<string>();
  return callouts.filter((callout) => {
    const key = `${callout.side}-${callout.text}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function resolveImpactTone(
  noticeTone: 'default' | 'blood' | undefined,
  floatingTexts: readonly BattleCanvasFloatingTextState[],
): BattleCanvasImpactTone {
  if (noticeTone === 'blood') {
    return 'blood';
  }

  for (const tone of ['blood', 'crit', 'element'] as const) {
    if (floatingTexts.some((item) => item.tone === tone)) {
      return tone;
    }
  }

  return 'default';
}

function setAdvance(scene: BattleCanvasPlaybackSnapshot, advance: number): void {
  const clampedAdvance = clamp(advance, 0, 1);
  scene.attacker.advance = clampedAdvance;
  scene.defender.advance = clampedAdvance;
}

function setScale(scene: BattleCanvasPlaybackSnapshot, scale: number): void {
  scene.attacker.scale = scale;
  scene.defender.scale = scale;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function easeInCubic(value: number): number {
  return value * value * value;
}

function easeOutCubic(value: number): number {
  const inverse = 1 - value;
  return 1 - inverse * inverse * inverse;
}

function easeInOutCubic(value: number): number {
  if (value < 0.5) {
    return 4 * value * value * value;
  }

  const inverse = -2 * value + 2;
  return 1 - inverse * inverse * inverse / 2;
}

function impactPulse(value: number): number {
  return Math.sin(Math.PI * clamp(value, 0, 1));
}
