import type { ClientRaidBattleUnitSnapshot } from '@trinitywar/shared';

interface BattleCardProps {
  unit: ClientRaidBattleUnitSnapshot;
  position: 'top' | 'bottom';
}

export function BattleCard(props: BattleCardProps): JSX.Element {
  const { unit, position } = props;
  const displayName = unit.displayName || unit.spiritName;

  return (
    <article className={`battle-card battle-avatar-card ${position}`} aria-label={displayName}>
      <div className="battle-portrait" aria-hidden="true">
        <span>{displayName.slice(0, 1)}</span>
      </div>
    </article>
  );
}
