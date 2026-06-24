import type { ClientFactionAdvantagePanel, ClientRaidTarget } from '@trinitywar/shared';
import { FactionAdvantageTip } from '../common/FactionAdvantageTip';
import { RaidTargetCard } from '../raid/RaidTargetCard';
import type { TutorialRaidUiRules } from '../../tutorial/tutorialFlow';

interface ReportSceneProps {
  advantage?: ClientFactionAdvantagePanel;
  refreshLabel: string;
  refreshPending: boolean;
  battleUsed: number;
  battleLimit: number;
  isTutorial: boolean;
  targets: ClientRaidTarget[];
  followedTargetIds: string[];
  friendTargetIds: string[];
  uiRules: TutorialRaidUiRules;
  onOpenTarget: (target: ClientRaidTarget) => void;
  onToggleFollowTarget: (target: ClientRaidTarget) => void;
  onRefresh: () => void;
}

export function ReportScene(props: ReportSceneProps): JSX.Element {
  const {
    advantage,
    refreshLabel,
    refreshPending,
    battleUsed,
    battleLimit,
    isTutorial,
    targets,
    followedTargetIds,
    friendTargetIds,
    uiRules,
    onOpenTarget,
    onToggleFollowTarget,
    onRefresh,
  } = props;
  const targetLimit = uiRules.visibleTargetLimit === null ? 3 : uiRules.visibleTargetLimit;
  const visibleTargets = targets.slice(0, targetLimit);

  return (
    <div className="scene-shell">
      <div className="scene-scroll raid-scene-scroll">
        {advantage && uiRules.showFactionAdvantage ? <FactionAdvantageTip advantage={advantage} /> : null}
        {uiRules.showToolbar ? (
          <div className="raid-toolbar compact-raid-toolbar">
            <div className="raid-rule-strip" aria-label="战斗规则">
              {isTutorial ? (
                <span>推荐目标 · 完成一次战斗后解锁完整战斗模块</span>
              ) : (
                <>
                  <span>今日战斗 {battleUsed}/{battleLimit}</span>
                  <span>推荐目标 {visibleTargets.length}</span>
                </>
              )}
            </div>
            <button className="secondary-button" disabled={refreshPending} onClick={onRefresh} type="button">
              {refreshPending ? '刷新中...' : refreshLabel}
            </button>
          </div>
        ) : null}

        <div className="raid-list-shell">
          <div className="target-list target-list-raid">
            {visibleTargets.map((target) => (
              <RaidTargetCard
                followed={followedTargetIds.includes(target.targetPlayerId)}
                friend={friendTargetIds.includes(target.targetPlayerId)}
                key={target.id}
                onSelect={onOpenTarget}
                onToggleFollow={uiRules.allowFollow && !friendTargetIds.includes(target.targetPlayerId) ? onToggleFollowTarget : undefined}
                target={target}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
