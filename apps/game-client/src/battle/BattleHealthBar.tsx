interface BattleHealthBarProps {
  current: number;
  max: number;
}

export function BattleHealthBar(props: BattleHealthBarProps): JSX.Element {
  const max = Math.max(Math.floor(props.max), 1);
  const current = Math.min(Math.max(Math.floor(props.current), 0), max);
  const ratio = Math.max(Math.min(current / max, 1), 0);

  return (
    <div className="battle-health">
      <div className="battle-health-track">
        <span className="battle-health-fill" style={{ width: `${ratio * 100}%` }} />
      </div>
      <strong>{current} / {max}</strong>
    </div>
  );
}
