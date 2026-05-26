import type { ClientDailyTaskSummary, ClientSceneKey } from '@trinitywar/shared';

interface HomeSceneProps {
  claimingTaskId: string | null;
  dailyTasks: ClientDailyTaskSummary[];
  tutorialTask?: {
    title: string;
    description: string;
    actionLabel: string;
  } | null;
  onClaimTask: (taskId: string) => void;
  onNavigate: (scene: ClientSceneKey) => void;
  onTutorialAction?: () => void;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

export function HomeScene(props: HomeSceneProps): JSX.Element {
  const {
    claimingTaskId,
    dailyTasks,
    tutorialTask,
    onClaimTask,
    onNavigate,
    onTutorialAction,
  } = props;

  return (
    <div className="scene-shell scene-shell-home">
      <div className="scene-scroll scene-scroll-home">
        {tutorialTask ? (
          <article className="panel-card home-tutorial-card">
            <div className="panel-head">
              <h4>新手主线</h4>
              <span className="soft-tag">当前目标</span>
            </div>
            <div className="home-tutorial-body">
              <strong>{tutorialTask.title}</strong>
              <p>{tutorialTask.description}</p>
              <button className="primary-button" onClick={onTutorialAction} type="button">
                {tutorialTask.actionLabel}
              </button>
            </div>
          </article>
        ) : null}
        {dailyTasks.length > 0 ? (
          <article className="panel-card home-task-card">
            <div className="panel-head">
              <h4>任务列表</h4>
            </div>
            <div className="task-list">
              {dailyTasks.map((item, index) => (
                <div className={`task-row task-row-${item.status}`} key={item.id}>
                  <span className="task-index">0{index + 1}</span>
                  <div>
                    <div className="task-row-head">
                      <strong>{item.title}</strong>
                      {item.status === 'completed' ? (
                        <>
                          <span className="task-state-badge task-state-badge-completed">已完成</span>
                          <button className="text-link task-link task-link-claim" disabled={claimingTaskId === item.id} onClick={() => onClaimTask(item.id)} type="button">
                            {claimingTaskId === item.id ? '领取中' : '领取'}
                          </button>
                        </>
                      ) : (
                        <button className="text-link task-link" disabled={item.status === 'claimed'} onClick={() => onNavigate(item.actionScene)} type="button">
                          {item.status === 'claimed' ? '已领取' : '前往'}
                        </button>
                      )}
                    </div>
                    <p>{item.description}</p>
                    <p className="task-progress-line">进度 {item.progressText} / 奖励 {formatNumber(item.rewardGold)} 金币</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
