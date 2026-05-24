import { useEffect, useState } from 'react';
import type { ClientFactionStipendSummary, ClientSceneContentResponse } from '@trinitywar/shared';

interface FactionSceneProps {
  hero: ClientSceneContentResponse['faction']['hero'];
  contribution: ClientSceneContentResponse['faction']['contribution'];
  stipend: ClientFactionStipendSummary | undefined;
  claimingStipend: boolean;
  donating: boolean;
  currentGold: number;
  factionTab: 'overview' | 'donate' | 'rank';
  comparison: ClientSceneContentResponse['faction']['comparison'];
  donate: ClientSceneContentResponse['faction']['donate'];
  rankings: ClientSceneContentResponse['faction']['rankings'];
  onClaimStipend: () => void;
  onChangeTab: (tab: 'overview' | 'donate' | 'rank') => void;
  onContributionGuide: () => void;
  onDonate: (goldAmount: number) => void;
  onTransferFaction: (factionName: string) => void;
}

export function FactionScene(props: FactionSceneProps): JSX.Element {
  const {
    hero,
    contribution,
    stipend,
    claimingStipend,
    donating,
    currentGold,
    factionTab,
    comparison,
    donate,
    rankings,
    onClaimStipend,
    onChangeTab,
    onContributionGuide,
    onDonate,
    onTransferFaction,
  } = props;
  const [donateGoldAmount, setDonateGoldAmount] = useState(0);
  const maxDonateGoldAmount = Math.floor(currentGold / donate.goldStep) * donate.goldStep;
  const contributionGain = donateGoldAmount / donate.goldStep;
  const canClaimStipend = stipend?.status === 'available';
  const stipendButtonLabel = stipend?.status === 'claimed' ? '已领取' : '领取俸禄';

  useEffect(() => {
    setDonateGoldAmount((current) => Math.min(current, maxDonateGoldAmount));
  }, [maxDonateGoldAmount]);

  return (
    <div className="scene-shell">
      <section className="hero-panel parchment compact-hero faction-overview-card">
        <div className="faction-overview-grid">
          <div className="faction-overview-column">
            <button className="pending-claim-button pending-claim-button-faction" disabled={!canClaimStipend || claimingStipend} onClick={onClaimStipend} type="button">
              <strong>{stipendButtonLabel}</strong>
            </button>
            <div className="faction-overview-note-block">
              <p className="faction-breakdown-line">{hero.advantage}</p>
              <p className="faction-breakdown-line">{hero.breakdown}</p>
            </div>
          </div>

          <div className="faction-overview-column faction-overview-column-right">
            <button className="faction-contribution-box" onClick={onContributionGuide} type="button">
              <span className="faction-contribution-title">贡献值</span>
              <strong className="faction-contribution-value">{contribution.value}</strong>
            </button>
            <div className="faction-overview-note-block">
              <p className="faction-contribution-description">{contribution.description}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="tab-row">
        <button className={`tab-button ${factionTab === 'overview' ? 'active' : ''}`} onClick={() => onChangeTab('overview')} type="button">
          阵营对比
        </button>
        <button className={`tab-button ${factionTab === 'donate' ? 'active' : ''}`} onClick={() => onChangeTab('donate')} type="button">
          增加贡献
        </button>
        <button className={`tab-button ${factionTab === 'rank' ? 'active' : ''}`} onClick={() => onChangeTab('rank')} type="button">
          贡献排行
        </button>
      </div>

      <div className="scene-scroll">
        {factionTab === 'overview' ? (
          <div className="faction-comparison-list">
            {comparison.map((item) => (
              <article className={`panel-card faction-comparison-card${item.isCurrent ? ' is-current' : ''}`} key={item.faction}>
                <div className="panel-head">
                  <h4>{item.faction}</h4>
                  {item.isCurrent ? (
                    <span className="soft-tag">当前阵营</span>
                  ) : (
                    <div className="faction-comparison-actions">
                      <button className="secondary-button" onClick={() => onTransferFaction(item.faction)} type="button">
                        转阵营
                      </button>
                    </div>
                  )}
                </div>
                <p className="muted faction-comparison-advantage">{item.advantage}</p>
                <div className="faction-comparison-metrics">
                  <div className="stat-row">
                    <span>阵营资金</span>
                    <strong>{item.gold}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {factionTab === 'donate' ? (
          <article className="panel-card faction-donate-card">
            <div className="faction-donate-copy">
              <p className="eyebrow">{donate.title}</p>
              <p className="muted">{donate.description}</p>
              <p className="muted">{donate.contributionRule}</p>
            </div>

            <div className="faction-donate-slider-group">
              <div className="faction-donate-slider-head">
                <strong>金币 {donateGoldAmount}</strong>
                <span>最大 {maxDonateGoldAmount}</span>
              </div>
              <input
                className="army-recruit-slider"
                max={maxDonateGoldAmount}
                min={0}
                onChange={(event) => setDonateGoldAmount(Number(event.target.value))}
                step={donate.goldStep}
                type="range"
                value={donateGoldAmount}
              />
            </div>

            <div className="faction-donate-footer">
              <div className="faction-donate-summary">
                <strong>本次贡献值 +{contributionGain}</strong>
              </div>
              <button className="secondary-button" disabled={donating || contributionGain <= 0} onClick={() => onDonate(donateGoldAmount)} type="button">
                {donating ? '上缴中...' : '确认上缴'}
              </button>
            </div>
          </article>
        ) : null}

        {factionTab === 'rank' ? (
          <article className="panel-card ranking-card faction-ranking-card">
            {rankings.map((item) => (
              <div className="stat-row faction-ranking-row" key={item.label}>
                <span>{item.label}{item.note ? ` · ${item.note}` : ''}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </article>
        ) : null}
      </div>
    </div>
  );
}
