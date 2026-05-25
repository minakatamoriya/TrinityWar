import type { ClientRaidBattleStep } from '@trinitywar/shared';
import type { BattlePlaybackState, RaidBattlePhase, RaidBattleReplay } from './battleTypes';

export const initialBattlePlaybackState = (replay: RaidBattleReplay): BattlePlaybackState => ({
  phase: 'enter',
  attackerHp: replay.attacker.hpBefore,
  defenderHp: replay.defender.hpBefore,
  floatingTexts: [],
  resultVisible: false,
});

export function getPhaseForStep(step: ClientRaidBattleStep): RaidBattlePhase {
  if (step.type === 'clash') {
    return 'clash';
  }
  if (step.type === 'floatingText' || step.type === 'hpChange') {
    return 'damage';
  }
  if (step.type === 'return') {
    return 'return';
  }
  if (step.type === 'result') {
    return 'result';
  }
  return 'enter';
}

export function applyBattleStep(
  current: BattlePlaybackState,
  step: ClientRaidBattleStep,
  index: number,
): BattlePlaybackState {
  const phase = getPhaseForStep(step);

  if (step.type === 'floatingText') {
    return {
      ...current,
      phase,
      floatingTexts: [
        ...current.floatingTexts,
        {
          id: `${index}-${step.side}-${step.text}`,
          side: step.side,
          text: step.text,
          tone: step.tone,
        },
      ].slice(-4),
    };
  }

  if (step.type === 'hpChange') {
    const delta = step.from - step.to;
    const floatingText = delta > 0
      ? [{
          id: `${index}-${step.side}-hp-${step.from}-${step.to}`,
          side: step.side,
          text: `-${Math.round(delta)}`,
          tone: 'damage' as const,
        }]
      : [];

    return {
      ...current,
      phase,
      attackerHp: step.side === 'attacker' ? step.to : current.attackerHp,
      defenderHp: step.side === 'defender' ? step.to : current.defenderHp,
      floatingTexts: [...current.floatingTexts, ...floatingText].slice(-6),
    };
  }

  if (step.type === 'result') {
    return {
      ...current,
      phase,
      resultVisible: true,
    };
  }

  return {
    ...current,
    phase,
  };
}
