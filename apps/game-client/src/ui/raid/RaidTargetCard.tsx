import type { ClientRaidTarget } from '@trinitywar/shared';

interface RaidTargetCardProps {
  target: ClientRaidTarget;
  onSelect: (target: ClientRaidTarget) => void;
  followed?: boolean;
  onToggleFollow?: (target: ClientRaidTarget) => void;
}

export function RaidTargetCard(props: RaidTargetCardProps): JSX.Element {
  const { target, onSelect, followed = false, onToggleFollow } = props;
  const mainPet = target.mainPetPreview;

  return (
    <article className="target-card target-card-shell">
      <button className="target-card-main" onClick={() => onSelect(target)} type="button">
        <div className="target-head">
          <div>
            <strong>{target.name}</strong>
            <span>{target.faction} · 主城 Lv.{target.level}</span>
          </div>
          <span className="risk-pill">{target.risk}</span>
        </div>
        <div className="target-card-line">
          <span>{target.summary}</span>
          <strong>{mainPet ? `主宠 Lv.${mainPet.level}` : `主城 Lv.${target.level}`}</strong>
        </div>
        <div className="target-card-subline">
          <span>{mainPet ? `默认情报：${mainPet.label}` : '默认情报：未发现主宠'}</span>
          <em>{target.loot}</em>
        </div>
      </button>

      {onToggleFollow ? (
        <div className="target-card-actions">
          <span className="target-card-follow-state">{followed ? '已关注' : '未关注'}</span>
          <button className="secondary-button small" onClick={() => onToggleFollow(target)} type="button">
            {followed ? '取消关注' : '关注'}
          </button>
        </div>
      ) : null}
    </article>
  );
}
