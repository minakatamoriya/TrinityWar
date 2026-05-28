import type {
  ClientSocialFeedItem,
  ClientSocialRelationItem,
  ClientSocialSummaryResponse,
} from '@trinitywar/shared';

type SocialTabKey = 'feed' | 'friends' | 'following' | 'enemies';

interface SocialSceneProps {
  activeTab: SocialTabKey;
  busy: boolean;
  error: string | null;
  summary: ClientSocialSummaryResponse | null;
  feed: ClientSocialFeedItem[];
  friends: ClientSocialRelationItem[];
  following: ClientSocialRelationItem[];
  enemies: ClientSocialRelationItem[];
  onChangeTab: (tab: SocialTabKey) => void;
  onRefresh: () => void;
  onAssistBack: (targetPlayerId: string) => void;
}

const tabLabels: Record<SocialTabKey, string> = {
  feed: '动态',
  friends: '好友',
  following: '关注',
  enemies: '仇敌',
};

export function SocialScene({
  activeTab,
  busy,
  error,
  summary,
  feed,
  friends,
  following,
  enemies,
  onChangeTab,
  onRefresh,
  onAssistBack,
}: SocialSceneProps): JSX.Element {
  const activeRelations = activeTab === 'friends' ? friends : activeTab === 'following' ? following : enemies;

  return (
    <div className="scene-scroll social-scene">
      <section className="hero-panel social-hero-panel">
        <div>
          <p className="eyebrow">社交</p>
          <h3>今天可以互相帮什么</h3>
          <p>先聚合动态、关系和助力入口，后续再接入真实田地缩时和组队结算。</p>
        </div>
        <button className="secondary-button" disabled={busy} onClick={onRefresh} type="button">
          {busy ? '刷新中' : '刷新'}
        </button>
      </section>

      {summary ? (
        <section className="social-metric-grid">
          <Metric label="未读动态" value={summary.counts.feedUnread} />
          <Metric label="好友" value={summary.counts.friends} />
          <Metric label="关注" value={summary.counts.following} />
          <Metric label="仇敌" value={summary.counts.enemies} />
          <Metric label="浇水" value={`${summary.counts.todayWaterUsed}/${summary.counts.todayWaterLimit}`} />
        </section>
      ) : null}

      {error ? <p className="social-error">{error}</p> : null}

      <section className="tab-row social-tab-row">
        {(Object.keys(tabLabels) as SocialTabKey[]).map((tab) => (
          <button
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            key={tab}
            onClick={() => onChangeTab(tab)}
            type="button"
          >
            {tabLabels[tab]}
          </button>
        ))}
      </section>

      {activeTab === 'feed' ? (
        <section className="social-list">
          {feed.length > 0 ? feed.map((item) => (
            <article className="panel-card social-feed-card" key={item.id}>
              <div className="panel-head">
                <span className="soft-tag">{item.actor?.nickname ?? '系统'}</span>
                <span className="card-label">{formatDateTime(item.createdAt)}</span>
              </div>
              <p>{item.summary}</p>
              <div className="button-row">
                {item.actions.map((action) => (
                  <button
                    className="ghost-button"
                    disabled={!action.targetPlayerId || busy}
                    key={`${item.id}-${action.action}`}
                    onClick={() => {
                      if (action.action === 'assist_back' && action.targetPlayerId) {
                        onAssistBack(action.targetPlayerId);
                      }
                    }}
                    type="button"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </article>
          )) : <EmptySocialState text="还没有新的社交动态。" />}
        </section>
      ) : (
        <section className="social-list">
          {activeRelations.length > 0 ? activeRelations.map((relation) => (
            <article className="panel-card social-relation-card" key={relation.id}>
              <div>
                <h4>{relation.target.nickname}</h4>
                <p>{relation.target.factionName ?? '未加入阵营'} · {relation.target.castleLevel} 级 · 亲密度 {relation.intimacy}</p>
              </div>
              <button
                className="ghost-button"
                disabled={busy}
                onClick={() => onAssistBack(relation.target.playerId)}
                type="button"
              >
                浇水
              </button>
            </article>
          )) : <EmptySocialState text={`暂无${tabLabels[activeTab]}关系。`} />}
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }): JSX.Element {
  return (
    <div className="social-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptySocialState({ text }: { text: string }): JSX.Element {
  return (
    <div className="panel-card social-empty-state">
      <p>{text}</p>
    </div>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type { SocialTabKey };
