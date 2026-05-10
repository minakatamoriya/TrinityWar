import type { ClientPendingClaimSummary, ClientSceneAction, ClientSceneContentResponse } from '@trinitywar/shared';
import { GuideCard } from '../GuideCard';

interface FactionSceneProps {
  hero: ClientSceneContentResponse['faction']['hero'];
  factionPending: ClientPendingClaimSummary | undefined;
  claiming: boolean;
  factionTab: 'overview' | 'donate' | 'rank';
  overview: ClientSceneContentResponse['faction']['overview'];
  donate: ClientSceneContentResponse['faction']['donate'];
  rankings: ClientSceneContentResponse['faction']['rankings'];
  onClaim: () => void;
  onChangeTab: (tab: 'overview' | 'donate' | 'rank') => void;
  onAction: (action: ClientSceneAction) => void;
}

export function FactionScene(props: FactionSceneProps): JSX.Element {
  const { hero, factionPending, claiming, factionTab, overview, donate, rankings, onClaim, onChangeTab, onAction } = props;

  return (
    <div className="scene-shell">
      <section className="hero-panel parchment compact-hero">
        <div>
          <p className="eyebrow">{hero.eyebrow}</p>
          <h3>{hero.title}</h3>
          <p className="muted">{hero.description}</p>
        </div>
        <button className="pending-claim-button pending-claim-button-faction" onClick={onClaim} type="button">
          <span>{factionPending?.label ?? '阵营分红'}</span>
          <strong>{factionPending?.value ?? '0'}</strong>
          <em>{claiming ? '领取中...' : '领取入库'}</em>
        </button>
      </section>

      <div className="tab-row">
        <button className={`tab-button ${factionTab === 'overview' ? 'active' : ''}`} onClick={() => onChangeTab('overview')} type="button">阵营总览</button>
        <button className={`tab-button ${factionTab === 'donate' ? 'active' : ''}`} onClick={() => onChangeTab('donate')} type="button">上缴与分红</button>
        <button className={`tab-button ${factionTab === 'rank' ? 'active' : ''}`} onClick={() => onChangeTab('rank')} type="button">排行榜</button>
      </div>

      <div className="scene-scroll">
        {factionTab === 'overview' ? (
          <article className="panel-card stats-card">
            {overview.map((item) => (
              <div className="stat-row" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </article>
        ) : null}

        {factionTab === 'donate' ? <GuideCard onAction={onAction} section={donate} /> : null}

        {factionTab === 'rank' ? (
          <article className="panel-card ranking-card">
            {rankings.map((item) => (
              <div className="stat-row" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </article>
        ) : null}
      </div>
    </div>
  );
}