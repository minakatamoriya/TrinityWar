import type { BattleCanvasTiming } from './types.js';

export const DEFAULT_BATTLE_CANVAS_TIMING: BattleCanvasTiming = {
  battleStartDelayMs: 160,
  roundGapMs: 80,
  readyMs: 90,
  dashMs: 140,
  impactFreezeMs: 70,
  hpTweenMs: 260,
  returnMs: 130,
  resultHoldMs: 500,
  bloodNoticeMs: 520,
  bloodTickMs: 240,
  deathPauseMs: 120,
};

export function resolveBattleCanvasTiming(overrides?: Partial<BattleCanvasTiming>): BattleCanvasTiming {
  return {
    ...DEFAULT_BATTLE_CANVAS_TIMING,
    ...overrides,
  };
}
