import type { ClientRaidTarget } from '@trinitywar/shared';

interface RaidTargetCardProps {
  target: ClientRaidTarget;
  onSelect: (target: ClientRaidTarget) => void;
}

export function RaidTargetCard(props: RaidTargetCardProps): JSX.Element {
  const { target, onSelect } = props;

  return (
    <button className="target-card" onClick={() => onSelect(target)} type="button">
      <div className="target-head">
        <div>
          <strong>{target.name}</strong>
          <span>{target.faction} · 主城 Lv.{target.level}</span>
        </div>
        <span className="risk-pill">{target.risk}</span>
      </div>
      <div className="target-card-line">
        <span>{target.summary}</span>
        <strong>战力 {target.combatPower}</strong>
      </div>
      <div className="target-card-subline">
        <span>{target.detail}</span>
        <em>{target.loot}</em>
      </div>
    </button>
  );
}