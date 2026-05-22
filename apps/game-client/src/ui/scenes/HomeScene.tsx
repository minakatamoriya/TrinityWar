import type { ClientDailyTaskSummary, ClientPendingClaimSummary, ClientSceneKey } from '@trinitywar/shared';

interface HomeSceneProps {
  hourlyTax: number;
  taxPending: ClientPendingClaimSummary | undefined;
  claimingTax: boolean;
  claimingStarterSeeds: boolean;
  claimingTianjiTalisman: boolean;
  claimingSpiritSoul: boolean;
  claimingTaskId: string | null;
  dailyTasks: ClientDailyTaskSummary[];
  dailySpiritSoulAmount: number;
  onClaimTax: () => void;
  onClaimTask: (taskId: string) => void;
  starterSeedClaimed: boolean;
  onClaimStarterSeeds: () => void;
  spiritSoulClaimed: boolean;
  onClaimSpiritSoul: () => void;
  tianjiTalismanClaimed: boolean;
  onClaimTianjiTalisman: () => void;
  onNavigate: (scene: ClientSceneKey) => void;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function parseClaimValue(value?: string): number {
  return value ? Number(value.replace(/,/g, '').trim()) : 0;
}

export function HomeScene(props: HomeSceneProps): JSX.Element {
  const {
    hourlyTax,
    taxPending,
    claimingTax,
    claimingStarterSeeds,
    claimingTianjiTalisman,
    claimingSpiritSoul,
    claimingTaskId,
    dailyTasks,
    dailySpiritSoulAmount,
    onClaimTax,
    onClaimTask,
    starterSeedClaimed,
    onClaimStarterSeeds,
    spiritSoulClaimed,
    onClaimSpiritSoul,
    tianjiTalismanClaimed,
    onClaimTianjiTalisman,
    onNavigate,
  } = props;
  const taxPendingAmount = parseClaimValue(taxPending?.value);
  const canClaimTax = taxPendingAmount > 0;
  const canClaimStarterSeed = !starterSeedClaimed;
  const canClaimTianjiTalisman = !tianjiTalismanClaimed;
  const canClaimSpiritSoul = !spiritSoulClaimed;
  const hasClaimableRewards = canClaimTax || canClaimStarterSeed || canClaimTianjiTalisman || canClaimSpiritSoul;

  return (
    <div className="scene-shell scene-shell-home">
      <div className="scene-scroll scene-scroll-home">
        <article className="panel-card home-claim-card">
          {hasClaimableRewards ? (
            <div className="home-claim-list">
              {canClaimTax ? (
                <div className="home-claim-item home-claim-item-tax">
                  <div className="home-claim-item-title">
                    <span className="home-claim-item-tag">金币</span>
                    <strong>领取税收</strong>
                  </div>
                  <strong className="home-claim-item-amount">{taxPending?.value}</strong>
                  <em className="home-claim-item-foot">{formatNumber(hourlyTax)} / 小时</em>
                  {/* <em className="home-claim-item-foot">{formatNumber(hourlyTax)} / 小时</em> */}
                  <button className="secondary-button home-claim-item-button" disabled={claimingTax} onClick={onClaimTax} type="button">
                    {claimingTax ? '入库中' : '领取'}
                  </button>
                </div>
              ) : null}
              {canClaimStarterSeed ? (
                <div className="home-claim-item home-claim-item-seed">
                  <div className="home-claim-item-title">
                    <span className="home-claim-item-tag">物品</span>
                    <strong>领取种子</strong>
                  </div>
                  {/* <strong className="home-claim-item-amount">青灵麦 x3</strong> */}
                  <em className="home-claim-item-foot" />
                  <button className="secondary-button home-claim-item-button" disabled={claimingStarterSeeds} onClick={onClaimStarterSeeds} type="button">
                    {claimingStarterSeeds ? '收取中' : '领取'}
                  </button>
                </div>
              ) : null}
              {canClaimTianjiTalisman ? (
                <div className="home-claim-item home-claim-item-tianji">
                  <div className="home-claim-item-title">
                    <span className="home-claim-item-tag">物品</span>
                    <strong>每日签到</strong>
                  </div>
                  <strong className="home-claim-item-amount">天机符 x1</strong>
                  {/* <em className="home-claim-item-foot">每日 1 张</em> */}
                  <button className="secondary-button home-claim-item-button" disabled={claimingTianjiTalisman} onClick={onClaimTianjiTalisman} type="button">
                    {claimingTianjiTalisman ? '收取中' : '领取'}
                  </button>
                </div>
              ) : null}
              {canClaimSpiritSoul ? (
                <div className="home-claim-item home-claim-item-spirit-soul">
                  <div className="home-claim-item-title">
                    <span className="home-claim-item-tag">灵宠</span>
                    <strong>每日兽魂</strong>
                  </div>
                  <strong className="home-claim-item-amount">兽魂 x{formatNumber(dailySpiritSoulAmount)}</strong>
                  <em className="home-claim-item-foot">随主城等级提升</em>
                  <button className="secondary-button home-claim-item-button" disabled={claimingSpiritSoul} onClick={onClaimSpiritSoul} type="button">
                    {claimingSpiritSoul ? '收取中' : '领取'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="home-claim-empty">
              <strong>当前没有可领取内容</strong>
              <p>税收、种子、天机符或后续补充的主城奖励会在可领取时显示在这里。</p>
            </div>
          )}
        </article>

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
                  <p className="task-progress-line">进度 {item.progressText} · 奖励 {formatNumber(item.rewardGold)} 金币</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
