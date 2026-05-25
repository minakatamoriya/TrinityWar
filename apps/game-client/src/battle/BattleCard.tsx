import type { ClientRaidBattleUnitSnapshot } from '@trinitywar/shared';

interface BattleCardProps {
  unit: ClientRaidBattleUnitSnapshot;
  position: 'top' | 'bottom';
}

export function BattleCard(props: BattleCardProps): JSX.Element {
  const { unit, position } = props;

  return (
    <article className={`battle-card battle-avatar-card ${position}`} aria-label={unit.spiritName}>
      <div className="battle-portrait" aria-hidden="true">
        <span>{unit.spiritName.slice(0, 1)}</span>
      </div>
    </article>
  );
}
