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
    description: '跳转到掠夺页，直接查看匿名目标并验证出兵。',
    scene: 'raid',
  },
];

interface HomeSceneProps {
  castleLevel: number;
  hourlyTax: number;
  taxPending: ClientPendingClaimSummary | undefined;
  claimingTax: boolean;
  onClaimTax: () => void;
  starterSeedCount: number;
  starterSeedClaimed: boolean;
  onClaimStarterSeeds: () => void;
  onNavigate: (scene: ClientSceneKey) => void;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

export function HomeScene(props: HomeSceneProps): JSX.Element {
  const {
    castleLevel,
    hourlyTax,
    taxPending,
    claimingTax,
    onClaimTax,
    starterSeedCount,
    starterSeedClaimed,
    onClaimStarterSeeds,
    onNavigate,
  } = props;

  return (
    <div className="scene-shell scene-shell-home">
      <div className="scene-scroll scene-scroll-home">
        <section className="hero-panel parchment tax-hero-card">
          <div className="tax-hero-copy">
            <h3>主城 Lv.{castleLevel}</h3>
          </div>
          {taxPending ? (
            <button className="pending-claim-button pending-claim-button-tax" onClick={onClaimTax} type="button">
              <span>税收待领取</span>
              <strong>{taxPending.value}</strong>
              <em>{claimingTax ? '入库中...' : `${formatNumber(hourlyTax)} / 小时`}</em>
            </button>
          ) : null}
        </section>

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

        <article className="panel-card starter-seed-card">
          <div className="panel-head starter-seed-head">
            <div>
              <h4>领取种子</h4>
              <p className="starter-seed-subline">初始仅开放灵麦，领取后可在农场培育弹框中使用。</p>
            </div>
            <span className="soft-tag">灵麦 x {starterSeedCount}</span>
          </div>
          <div className="starter-seed-body">
            <p>每日起手包：领取三颗灵麦种子，作为新手第一轮培育库存。</p>
            <button className="primary-button starter-seed-button" disabled={starterSeedClaimed} onClick={onClaimStarterSeeds} type="button">
              {starterSeedClaimed ? '今日已领取' : '领取三颗灵麦种子'}
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}