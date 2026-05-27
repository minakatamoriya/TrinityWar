import type { ClientDailyTaskSummary, ClientHomeFactionTaskSummary, ClientSceneKey } from '@trinitywar/shared';

interface HomeSceneProps {
  claimingTaskId: string | null;
  dailyTasks: ClientDailyTaskSummary[];
  factionTasks: ClientHomeFactionTaskSummary[];
  todayContribution: number;
  tutorialTask?: {
    title: string;
    description: string;
    actionLabel: string;
  } | null;
  onClaimTask: (taskId: string) => void;
  onSubmitFactionTask: (task: ClientHomeFactionTaskSummary) => void;
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
    factionTasks,
    todayContribution,
    tutorialTask,
    onClaimTask,
    onSubmitFactionTask,
    onNavigate,
    onTutorialAction,
  } = props;

  return (
    <div className="scene-shell scene-shell-home">
      <div className="scene-scroll scene-scroll-home">
        {tutorialTask ? (
          <article className="panel-card home-tutorial-card">
            <div className="panel-head">
              <h4>{'\u65b0\u624b\u4efb\u52a1'}</h4>
              <span className="soft-tag">{'\u5f53\u524d\u76ee\u6807'}</span>
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
              <h4>{'\u6bcf\u65e5\u4efb\u52a1'}</h4>
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
                          <span className="task-state-badge task-state-badge-completed">{'\u5df2\u5b8c\u6210'}</span>
                          <button className="text-link task-link task-link-claim" disabled={claimingTaskId === item.id} onClick={() => onClaimTask(item.id)} type="button">
                            {claimingTaskId === item.id ? '\u9886\u53d6\u4e2d' : '\u9886\u53d6'}
                          </button>
                        </>
                      ) : (
                        <button className="text-link task-link" disabled={item.status === 'claimed'} onClick={() => onNavigate(item.actionScene)} type="button">
                          {item.status === 'claimed' ? '\u5df2\u9886\u53d6' : '\u524d\u5f80'}
                        </button>
                      )}
                    </div>
                    <p>{item.description}</p>
                    <p className="task-progress-line">{'\u8fdb\u5ea6'} {item.progressText} / {'\u5956\u52b1'} {formatNumber(item.rewardGold)} {'\u91d1\u5e01'}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ) : null}
        {factionTasks.length > 0 ? (
          <article className="panel-card home-task-card">
            <div className="panel-head">
              <h4>今日阵营任务</h4>
              <span className="soft-tag">今日贡献 {formatNumber(todayContribution)}</span>
            </div>
            <div className="task-list">
              {factionTasks.map((item, index) => (
                <div className={`task-row task-row-${item.status}`} key={item.id}>
                  <span className="task-index">0{index + 1}</span>
                  <div>
                    <div className="task-row-head">
                      <strong>{item.title}</strong>
                      <span className={`task-state-badge${item.status === 'completed' || item.status === 'claimed' ? ' task-state-badge-completed' : ''}`}>
                        {item.status === 'claimed' ? '已完成' : item.progressText}
                      </span>
                      <button
                        className="text-link task-link"
                        disabled={item.status === 'claimed'}
                        onClick={() => {
                          if (item.action.label === '上缴') {
                            onSubmitFactionTask(item);
                            return;
                          }
                          onNavigate(item.action.target);
                        }}
                        type="button"
                      >
                        {item.action.label}
                      </button>
                    </div>
                    <p>{item.description}</p>
                    <p className="task-progress-line">
                      进度 {item.progressText} / 奖励 {formatNumber(item.rewardContribution)} 贡献
                      {item.requiredEssenceLabel ? ` / 库存 ${item.requiredEssenceLabel} x${formatNumber(item.currentEssenceQuantity)}` : ''}
                    </p>
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
