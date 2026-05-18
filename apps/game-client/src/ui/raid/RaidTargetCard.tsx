import type { ClientRaidTarget } from '@trinitywar/shared';

interface RaidTargetCardProps {
  target: ClientRaidTarget;
  onSelect: (target: ClientRaidTarget) => void;
}

export function RaidTargetCard(props: RaidTargetCardProps): JSX.Element {
  const { target, onSelect } = props;

  return (
    <button className="target-card target-card-shell" onClick={() => onSelect(target)} type="button">
      <div className="target-head">
        <div>
          <strong>{target.name}</strong>
          <span>{target.faction} · 主城 Lv.{target.level}</span>
        </div>
        <span className="risk-pill">{target.risk}</span>
      </div>
      <div className="target-card-line">
        <span>{target.summary}</span>
        <strong>主宠 Lv.{target.level}</strong>
      </div>
      <div className="target-card-subline">
        <span>默认情报：可见等级与品种</span>
        <em>{target.loot}</em>
      </div>
    </button>
  );
}
