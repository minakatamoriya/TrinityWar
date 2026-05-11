import type { ClientPendingClaimSummary, ClientSceneKey } from '@trinitywar/shared';

interface HomeTaskItem {
  id: string;
  title: string;
  description: string;
  scene: ClientSceneKey;
}

const homeTaskItems: HomeTaskItem[] = [
  {
    id: 'claim-tax',
    title: '领取主城税收',
    description: '先把待领取税收入库，保证后续升级和播种不断档。',
    scene: 'home',
  },
  {
    id: 'collect-farm',
    title: '收取成熟田地',
    description: '直接前往农场收菜，成熟地块收回后可继续播种。',
    scene: 'farm',
  },
  {
    id: 'raid-target',
    title: '发起一次掠夺',
    description: '跳转到新的掠夺页，在目标列表里直接挑选匿名目标。',
    scene: 'report',
  },
];

interface HomeSceneProps {
  hourlyTax: number;
  taxPending: ClientPendingClaimSummary | undefined;
  claimingTax: boolean;
  onClaimTax: () => void;
  starterSeedClaimed: boolean;
  onClaimStarterSeeds: () => void;
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
    onClaimTax,
    starterSeedClaimed,
    onClaimStarterSeeds,
    onNavigate,
  } = props;
  const taxPendingAmount = parseClaimValue(taxPending?.value);
  const canClaimTax = taxPendingAmount > 0;
  const canClaimStarterSeed = !starterSeedClaimed;
  const hasClaimableRewards = canClaimTax || canClaimStarterSeed;

  return (
    <div className="scene-shell scene-shell-home">
      <div className="scene-scroll scene-scroll-home">
        <article className="panel-card home-claim-card">
          {hasClaimableRewards ? (
            <div className="home-claim-list">
              {canClaimTax ? (
                <button className="home-claim-item home-claim-item-tax" disabled={claimingTax} onClick={onClaimTax} type="button">
                  <div className="home-claim-item-head">
                    <span className="home-claim-item-tag">金币</span>
                    <strong>领取税收</strong>
                  </div>
                  <div className="home-claim-item-body">
                    <strong className="home-claim-item-amount">{taxPending?.value}</strong>
                    <span className="home-claim-item-meta">{claimingTax ? '入库中...' : `当前可领 ${taxPending?.value}`}</span>
                  </div>
                  <em className="home-claim-item-foot">{formatNumber(hourlyTax)} / 小时，金库未满时会持续累积</em>
                </button>
              ) : null}
              {canClaimStarterSeed ? (
                <button className="home-claim-item home-claim-item-seed" onClick={onClaimStarterSeeds} type="button">
                  <div className="home-claim-item-head">
                    <span className="home-claim-item-tag">物品</span>
                    <strong>领取今日种子</strong>
                  </div>
                  <div className="home-claim-item-body">
                    <strong className="home-claim-item-amount">今日可领</strong>
                    <span className="home-claim-item-meta">点击后展示本次获得物品</span>
                  </div>
                  <em className="home-claim-item-foot">领取完成后入口自动隐藏</em>
                </button>
              ) : null}
            </div>
          ) : (
            <div className="home-claim-empty">
              <strong>当前没有可领取内容</strong>
              <p>税收、种子或后续补充的主城奖励会在可领取时显示在这里。</p>
            </div>
          )}
        </article>

        <article className="panel-card home-task-card">
          <div className="panel-head">
            <h4>任务列表</h4>
          </div>
          <div className="task-list">
            {homeTaskItems.map((item, index) => (
              <div className="task-row" key={item.id}>
                <span className="task-index">0{index + 1}</span>
                <div>
                  <div className="task-row-head">
                    <strong>{item.title}</strong>
                    <button className="text-link task-link" onClick={() => onNavigate(item.scene)} type="button">前往</button>
                  </div>
                  <p>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}