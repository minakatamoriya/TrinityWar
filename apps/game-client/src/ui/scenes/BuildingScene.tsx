import type { ClientBuildingUpgrade, ClientBuildingUpgradeId, ClientSceneAction } from '@trinitywar/shared';
import { ActionButton } from '../ActionButton';

interface BuildingSceneProps {
  upgrades: ClientBuildingUpgrade[];
  onUpgradeAction: (action: ClientSceneAction, buildingId: ClientBuildingUpgradeId, context: string) => void;
}

export function BuildingScene(props: BuildingSceneProps): JSX.Element {
  const { upgrades, onUpgradeAction } = props;

  return (
    <div className="scene-shell">
      <div className="scene-scroll card-grid compact-grid building-upgrade-list">
        {upgrades.map((upgrade) => (
          <article className={`upgrade-card building-upgrade-item ${upgrade.locked ? 'locked' : ''}`} key={upgrade.title}>
            <div className="building-upgrade-copy">
              <h4>{upgrade.title}</h4>
              <p>{upgrade.description}</p>
            </div>
            <div className="cost-box">
              <span>{upgrade.costText}</span>
              <ActionButton action={upgrade.action} onClick={(action) => {
                onUpgradeAction(action, upgrade.id, upgrade.title);
              }} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}