import type { ClientRaidBattleReplay, ClientRaidBattleUnitSnapshot } from '@trinitywar/shared';
import type {
  BattleCanvasPlaybackSnapshot,
  BattleCanvasResultState,
  BattleCanvasUnitState,
} from './types.js';

export function createBattleCanvasBaseScene(
  replay: ClientRaidBattleReplay,
  totalDurationMs: number,
): BattleCanvasPlaybackSnapshot {
  return {
    phase: 'enter',
    round: null,
    bloodRound: null,
    elapsedMs: 0,
    totalDurationMs,
    enteredBloodMode: false,
    completed: false,
    impactTone: 'default',
    attacker: createUnitState(replay.attacker),
    defender: createUnitState(replay.defender),
    floatingTexts: [],
    sideCallouts: [],
    notice: null,
    result: createResultState(replay),
  };
}

export function cloneBattleCanvasScene(scene: BattleCanvasPlaybackSnapshot): BattleCanvasPlaybackSnapshot {
  return {
    ...scene,
    attacker: { ...scene.attacker },
    defender: { ...scene.defender },
    floatingTexts: scene.floatingTexts.map((item) => ({ ...item })),
    sideCallouts: scene.sideCallouts.map((item) => ({ ...item })),
    notice: scene.notice ? { ...scene.notice } : null,
    result: { ...scene.result },
  };
}

function createUnitState(snapshot: ClientRaidBattleUnitSnapshot): BattleCanvasUnitState {
  return {
    side: snapshot.side,
    playerName: snapshot.playerName,
    displayName: snapshot.displayName,
    spiritName: snapshot.spiritName,
    rarity: snapshot.rarity,
    element: snapshot.element,
    level: snapshot.level,
    attack: snapshot.attack,
    maxHp: snapshot.maxHp,
    finalHp: snapshot.hpAfter,
    displayHp: snapshot.hpBefore,
    traits: (snapshot.traits ?? []).filter((trait) => trait.visible).map((trait) => trait.label),
    advance: 0,
    scale: 1,
    opacity: 1,
    defeated: false,
  };
}

function createResultState(replay: ClientRaidBattleReplay): BattleCanvasResultState {
  return {
    visible: false,
    title: replay.title,
    summary: replay.summary,
    outcome: replay.result,
    progress: 0,
  };
}
