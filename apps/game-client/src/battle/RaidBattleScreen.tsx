import { useEffect, useMemo, useState } from 'react';
import type { ClientRaidBattleUnitSnapshot } from '@trinitywar/shared';
import { applyBattleStep, initialBattlePlaybackState } from './battleTimeline';
import type { BattlePlaybackState, RaidBattleReplay } from './battleTypes';
import { BattleCard } from './BattleCard';
import { BattleFloatingText } from './BattleFloatingText';
import { BattleHealthBar } from './BattleHealthBar';

interface RaidBattleScreenProps {
  replay: RaidBattleReplay;
  autoStart?: boolean;
  onComplete: () => void;
}

const elementLabels: Record<string, string> = {
  metal: '金',
  wood: '木',
  water: '水',
  fire: '火',
  earth: '土',
};

const BATTLE_START_DELAY_MS = 160;
const CLASH_IMPACT_MS = 220;

export function RaidBattleScreen(props: RaidBattleScreenProps): JSX.Element {
  const { replay, autoStart = true, onComplete } = props;
  const [playback, setPlayback] = useState<BattlePlaybackState>(() => initialBattlePlaybackState(replay));
  const [started, setStarted] = useState(autoStart);
  const [runId, setRunId] = useState(0);
  const eventText = useMemo(() => buildEventText(replay), [replay]);

  useEffect(() => {
    setPlayback(initialBattlePlaybackState(replay));
    setStarted(autoStart);
    setRunId(0);
  }, [autoStart, replay]);

  useEffect(() => {
    if (!started) {
      return undefined;
    }

    let cancelled = false;
    const timers: number[] = [];
    let elapsed = BATTLE_START_DELAY_MS;

    replay.steps.forEach((step, index) => {
      const timer = window.setTimeout(() => {
        if (!cancelled) {
          setPlayback((current) => applyBattleStep(current, step, index));
        }
      }, elapsed);
      timers.push(timer);
      elapsed += step.type === 'clash' ? CLASH_IMPACT_MS : step.durationMs;
    });

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [replay, runId, started]);

  useEffect(() => {
    if (!autoStart || !playback.resultVisible) {
      return undefined;
    }

    const timer = window.setTimeout(onComplete, 120);
    return () => window.clearTimeout(timer);
  }, [autoStart, onComplete, playback.resultVisible]);

  const startPlayback = (): void => {
    setPlayback(initialBattlePlaybackState(replay));
    setStarted(true);
    setRunId((current) => current + 1);
  };

  return (
    <section className={`raid-battle-screen phase-${playback.phase}`} role="dialog" aria-modal="true" aria-label="战斗回放">
      <BattleUnitPanel fallbackText={eventText} hp={playback.defenderHp} position="top" unit={replay.defender} />

      <div className="raid-battle-arena">
        <BattleFloatingText side="defender" texts={playback.floatingTexts} />
        <BattleCard position="top" unit={replay.defender} />

        <div className="battle-clash-line" aria-hidden="true">
          <span />
        </div>

        <BattleCard position="bottom" unit={replay.attacker} />
        <BattleFloatingText side="attacker" texts={playback.floatingTexts} />

        {!started ? (
          <div className="battle-center-control">
            <button className="battle-control-button primary" onClick={startPlayback} type="button">
              开始
            </button>
          </div>
        ) : null}

        {playback.resultVisible && !autoStart ? (
          <div className="battle-center-control battle-result-control">
            <strong>{replay.title}</strong>
            <div>
              <button className="battle-control-button" onClick={startPlayback} type="button">
                重播
              </button>
              <button className="battle-control-button primary" onClick={onComplete} type="button">
                关闭
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <BattleUnitPanel fallbackText={eventText} hp={playback.attackerHp} position="bottom" unit={replay.attacker} />
    </section>
  );
}

function BattleUnitPanel(props: {
  fallbackText: string;
  hp: number;
  position: 'top' | 'bottom';
  unit: ClientRaidBattleUnitSnapshot;
}): JSX.Element {
  const { fallbackText, hp, position, unit } = props;
  const traitText = buildTraitText(unit, fallbackText);
  const displayName = unit.displayName || unit.spiritName;

  return (
    <section className={`battle-unit-panel ${position}`}>
      <div className="battle-unit-line">
        <strong>{position === 'top' ? '敌方' : '我方'} · {displayName}</strong>
        <span>Lv.{unit.level} · {unit.element ? elementLabels[unit.element] : '无'} · {unit.rarity ?? '-'}</span>
      </div>
      <div className="battle-unit-line compact">
        <span>攻 {unit.attack}</span>
        <span>血 {hp}/{unit.maxHp}</span>
        <span className="battle-buff-text">{traitText}</span>
      </div>
      <BattleHealthBar current={hp} max={unit.maxHp} />
    </section>
  );
}

function buildTraitText(unit: ClientRaidBattleUnitSnapshot, fallbackText: string): string {
  const traits = (unit.traits ?? [])
    .filter((trait) => trait.visible)
    .map((trait) => `${trait.label}+${trait.value}${trait.valueType === 'percent' ? '%' : ''}`)
    .slice(0, 3);

  const statusText = unit.healthStatusLabel && unit.healthStatus !== 'normal' ? unit.healthStatusLabel : null;
  const parts = [statusText, ...traits].filter(Boolean);

  return parts.length > 0 ? parts.join(' / ') : fallbackText;
}

function buildEventText(replay: RaidBattleReplay): string {
  const labels = replay.events
    .filter((event) => event.type !== 'damage')
    .map((event) => event.label)
    .filter(Boolean)
    .slice(0, 3);

  return labels.length > 0 ? labels.join(' / ') : '无额外触发';
}
