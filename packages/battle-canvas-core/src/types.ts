import type {
  ClientRaidBattleFloatingTone,
  ClientRaidBattleReplay,
  ClientRaidBattleSide,
  ClientRaidBattleStep,
  ClientRaidBattleUnitSnapshot,
} from '@trinitywar/shared';

export type BattleCanvasPhase =
  | 'enter'
  | 'notice'
  | 'round_ready'
  | 'round_dash'
  | 'round_impact'
  | 'round_damage'
  | 'round_return'
  | 'blood_damage'
  | 'result';

export type BattleCanvasImpactTone = 'default' | ClientRaidBattleFloatingTone;

export interface BattleCanvasTiming {
  battleStartDelayMs: number;
  roundGapMs: number;
  readyMs: number;
  dashMs: number;
  impactFreezeMs: number;
  hpTweenMs: number;
  returnMs: number;
  resultHoldMs: number;
  bloodNoticeMs: number;
  bloodTickMs: number;
  deathPauseMs: number;
}

export interface BattleCanvasFloatingTextState {
  id: string;
  side: ClientRaidBattleSide;
  text: string;
  tone: ClientRaidBattleFloatingTone;
  progress: number;
  opacity: number;
}

export interface BattleCanvasSideCalloutState {
  id: string;
  side: ClientRaidBattleSide;
  text: string;
  tone: BattleCanvasImpactTone;
  progress: number;
  opacity: number;
}

export interface BattleCanvasNoticeState {
  title: string;
  summary?: string;
  tone: 'default' | 'blood';
  progress: number;
}

export interface BattleCanvasResultState {
  visible: boolean;
  title: string;
  summary: string;
  outcome: ClientRaidBattleReplay['result'];
  progress: number;
}

export interface BattleCanvasUnitState {
  side: ClientRaidBattleSide;
  playerName: string;
  displayName: string;
  spiritName: string;
  rarity: string | null;
  element: ClientRaidBattleUnitSnapshot['element'];
  level: number;
  attack: number;
  maxHp: number;
  finalHp: number;
  displayHp: number;
  traits: string[];
  advance: number;
  scale: number;
  opacity: number;
  defeated: boolean;
}

export interface BattleCanvasPlaybackSnapshot {
  phase: BattleCanvasPhase;
  round: number | null;
  bloodRound: number | null;
  elapsedMs: number;
  totalDurationMs: number;
  enteredBloodMode: boolean;
  completed: boolean;
  impactTone: BattleCanvasImpactTone;
  attacker: BattleCanvasUnitState;
  defender: BattleCanvasUnitState;
  floatingTexts: BattleCanvasFloatingTextState[];
  sideCallouts: BattleCanvasSideCalloutState[];
  notice: BattleCanvasNoticeState | null;
  result: BattleCanvasResultState;
}

export interface BattleCanvasTimelineSegment {
  phase: BattleCanvasPhase;
  stepIndex: number;
  startMs: number;
  durationMs: number;
  endMs: number;
  round: number | null;
  bloodRound: number | null;
  step: ClientRaidBattleStep;
}

export interface BattleCanvasController {
  readonly replay: ClientRaidBattleReplay;
  readonly timing: BattleCanvasTiming;
  readonly timeline: readonly BattleCanvasTimelineSegment[];
  getTotalDurationMs(): number;
  sampleAt(elapsedMs: number): BattleCanvasPlaybackSnapshot;
}
