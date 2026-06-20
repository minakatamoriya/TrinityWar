import { useEffect, useMemo, useState } from 'react';
import type { ClientRaidBattleUnitSnapshot } from '@trinitywar/shared';
import { applyBattleStep, initialBattlePlaybackState } from './battleTimeline';
import type { BattlePlaybackState, RaidBattleReplay } from './battleTypes';
import { BattleCard } from './BattleCard';
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
  const impactTone = useMemo(() => resolveImpactTone(playback.floatingTexts), [playback.floatingTexts]);

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
    <section className={`raid-battle-screen phase-${playback.phase} impact-${impactTone}`} role="dialog" aria-modal="true" aria-label="战斗回放">
      <BattleUnitPanel effects={playback.floatingTexts} fallbackText={eventText} hp={playback.defenderHp} position="top" unit={replay.defender} />

      <div className="raid-battle-arena">
        <BattleCard position="top" unit={replay.defender} />

        <div className="battle-clash-line" aria-hidden="true">
          <span />
        </div>

        <BattleCard position="bottom" unit={replay.attacker} />

        {!started ? (
          <div className="battle-center-control">
            <button className="battle-control-button primary" onClick={startPlayback} type="button">
              开始
            </button>
          </div>
        ) : null}

        {playback.notice ? (
          <div className={`battle-notice-panel tone-${playback.notice.tone}`} aria-live="polite">
            <strong>{playback.notice.title}</strong>
            {playback.notice.summary ? <span>{playback.notice.summary}</span> : null}
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

      <BattleUnitPanel effects={playback.floatingTexts} fallbackText={eventText} hp={playback.attackerHp} position="bottom" unit={replay.attacker} />
    </section>
  );
}

function BattleUnitPanel(props: {
  effects: BattlePlaybackState['floatingTexts'];
  fallbackText: string;
  hp: number;
  position: 'top' | 'bottom';
  unit: ClientRaidBattleUnitSnapshot;
}): JSX.Element {
  const { effects, fallbackText, hp, position, unit } = props;
  const side = position === 'top' ? 'defender' : 'attacker';
  const traitChips = buildTraitChips(unit);
  const sideEffects = effects.filter((item) => item.side === side).slice(-3);
  const displayName = unit.displayName || unit.spiritName;

  return (
    <section className={`battle-unit-panel ${position}`}>
      <div className="battle-unit-body">
        <div className="battle-trait-rail" aria-label={`${displayName} 词条`}>
          {traitChips.length > 0 ? traitChips.map((trait, index) => (
            <span key={`${trait}-${index}`}>{trait}</span>
          )) : <span>{fallbackText}</span>}
        </div>
        <div className="battle-unit-main">
          <div className="battle-unit-line">
            <strong>{position === 'top' ? '敌方' : '我方'} · {displayName}</strong>
            <span>Lv.{unit.level} · {unit.element ? elementLabels[unit.element] : '无'} · {unit.rarity ?? '-'}</span>
          </div>
          <div className="battle-unit-line compact">
            <span>攻 {unit.attack}</span>
            <span>血 {hp}/{unit.maxHp}</span>
          </div>
          <div className="battle-health-row">
            <BattleHealthBar current={hp} max={unit.maxHp} />
            <BattleSideEffects effects={sideEffects} />
          </div>
        </div>
      </div>
    </section>
  );
}

function BattleSideEffects(props: { effects: BattlePlaybackState['floatingTexts'] }): JSX.Element {
  return (
    <div className="battle-side-effects" aria-live="polite">
      {props.effects.map((item) => (
        <span className={`battle-side-effect ${item.tone}`} key={item.id}>
          {formatSideEffectText(item.text, item.tone)}
        </span>
      ))}
    </div>
  );
}

function buildTraitChips(unit: ClientRaidBattleUnitSnapshot): string[] {
  return (unit.traits ?? [])
    .filter((trait) => trait.visible)
    .map((trait) => trait.label)
    .slice(0, 5);
}

function formatSideEffectText(text: string, tone: BattlePlaybackState['floatingTexts'][number]['tone']): string {
  if (tone === 'blood') {
    return text.replace(/\d+(?:\.\d+)?%/, '');
  }
  if (tone === 'miss') {
    return text;
  }
  if (tone === 'buff') {
    return text;
  }
  return text;
}

function buildEventText(replay: RaidBattleReplay): string {
  const labels = replay.events
    .filter((event) => event.type !== 'damage')
    .map((event) => event.label)
    .filter(Boolean)
    .slice(0, 3);

  return labels.length > 0 ? labels.join(' / ') : '无额外触发';
}

function resolveImpactTone(effects: BattlePlaybackState['floatingTexts']): 'normal' | 'crit' | 'element' | 'blood' {
  const latest = [...effects].reverse().find((item) => item.tone === 'crit' || item.tone === 'element' || item.tone === 'blood');
  if (latest?.tone === 'crit' || latest?.tone === 'element' || latest?.tone === 'blood') {
    return latest.tone;
  }
  return 'normal';
}
