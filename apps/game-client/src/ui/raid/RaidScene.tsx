import type { ClientRaidTarget } from '@trinitywar/shared';
import { RaidTargetCard } from './RaidTargetCard';

interface RaidSceneProps {
  heroTitle: string;
  refreshLabel: string;
  refreshPending: boolean;
  targets: ClientRaidTarget[];
  onRefresh: () => void;
  onOpenTarget: (target: ClientRaidTarget) => void;
}

export function RaidScene(props: RaidSceneProps): JSX.Element {
  const { heroTitle, refreshLabel, refreshPending, targets, onRefresh, onOpenTarget } = props;

  return (
    <div className="scene-shell raid-scene-shell">
      <div className="scene-scroll raid-scene-scroll">
        <div className="raid-toolbar panel-card compact-raid-toolbar">
          <p className="raid-toolbar-text">{heroTitle}</p>
          <button className="secondary-button" disabled={refreshPending} onClick={onRefresh} type="button">
            {refreshPending ? '刷新中...' : refreshLabel}
          </button>
        </div>

        <div className="raid-list-shell">
          <div className="target-list target-list-raid">
            {targets.map((target) => (
              <RaidTargetCard key={target.id} onSelect={onOpenTarget} target={target} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}