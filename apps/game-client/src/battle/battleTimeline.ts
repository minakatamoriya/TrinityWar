import type { ClientRaidBattleStep } from '@trinitywar/shared';
import type { BattlePlaybackState, RaidBattlePhase, RaidBattleReplay } from './battleTypes';

export const initialBattlePlaybackState = (replay: RaidBattleReplay): BattlePlaybackState => ({
  phase: 'enter',
  attackerHp: replay.attacker.hpBefore,
  defenderHp: replay.defender.hpBefore,
  floatingTexts: [],
  notice: null,
  resultVisible: false,
});

export function getPhaseForStep(step: ClientRaidBattleStep): RaidBattlePhase {
  if (step.type === 'clash') {
    return 'clash';
  }
  if (step.type === 'notice') {
    return 'notice';
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

  if (step.type === 'notice') {
    return {
      ...current,
      phase,
      notice: {
        title: step.title,
        summary: step.summary,
        tone: step.tone ?? 'default',
      },
      floatingTexts: [],
    };
  }

  if (step.type === 'clash') {
    return {
      ...current,
      phase,
      notice: null,
      floatingTexts: [],
    };
  }

  if (step.type === 'floatingText') {
    const nextTexts = appendSideText(current.floatingTexts, {
      id: `${index}-${step.side}-${step.text}`,
      side: step.side,
      text: step.text,
      tone: step.tone,
    });

    return {
      ...current,
      phase,
      notice: null,
      floatingTexts: nextTexts,
    };
  }

  if (step.type === 'hpChange') {
    const delta = step.from - step.to;
    const shouldShowHpText = delta > 0 && step.floatingText !== false && (step.floatingTone === 'blood' || typeof step.floatingText === 'string');
    const floatingText = shouldShowHpText
      ? {
          id: `${index}-${step.side}-hp-${step.from}-${step.to}`,
          side: step.side,
          text: typeof step.floatingText === 'string' ? step.floatingText : `-${Math.round(delta)}`,
          tone: step.floatingTone ?? 'damage' as const,
        }
      : null;
    const nextTexts = floatingText ? appendSideText(current.floatingTexts, floatingText) : current.floatingTexts;

    return {
      ...current,
      phase,
      notice: null,
      attackerHp: step.side === 'attacker' ? step.to : current.attackerHp,
      defenderHp: step.side === 'defender' ? step.to : current.defenderHp,
      floatingTexts: nextTexts,
    };
  }

  if (step.type === 'result') {
    return {
      ...current,
      phase,
      notice: null,
      floatingTexts: current.floatingTexts,
      resultVisible: true,
    };
  }

  return {
    ...current,
    phase,
    notice: null,
  };
}

type FloatingText = BattlePlaybackState['floatingTexts'][number];

function appendSideText(current: FloatingText[], next: FloatingText): FloatingText[] {
  const sameSide = current.filter((item) => item.side === next.side);
  const otherSide = current.filter((item) => item.side !== next.side);
  return [...otherSide, ...sameSide, next]
    .filter((item, _, list) => {
      const sideItems = list.filter((candidate) => candidate.side === item.side);
      return sideItems.indexOf(item) >= Math.max(sideItems.length - 3, 0);
    });
}
