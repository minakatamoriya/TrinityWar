import type { ClientFactionStipendSummary, ClientSceneContentResponse } from '@trinitywar/shared';
import type { TutorialFactionUiRules } from '../../tutorial/tutorialFlow';

interface FactionSceneProps {
  hero: ClientSceneContentResponse['faction']['hero'];
  contribution: ClientSceneContentResponse['faction']['contribution'];
  stipend: ClientFactionStipendSummary | undefined;
  claimingStipend: boolean;
  factionTab: 'overview' | 'donate' | 'rank';
  comparison: ClientSceneContentResponse['faction']['comparison'];
  contributionLogs?: NonNullable<ClientSceneContentResponse['faction']['contributionLogs']>;
  followedTargetIds: string[];
  friendTargetIds: string[];
  rankings: ClientSceneContentResponse['faction']['rankings'];
  uiRules: TutorialFactionUiRules;
  onClaimStipend: () => void;
  onChangeTab: (tab: 'overview' | 'donate' | 'rank') => void;
  onContributionGuide: () => void;
  onFollowRankingPlayer: (targetPlayerId: string) => void;
  onUnfollowRankingPlayer: (targetPlayerId: string) => void;
}

export function FactionScene(props: FactionSceneProps): JSX.Element {
  const {
    hero,
    contribution,
    stipend,
    claimingStipend,
    factionTab,
    comparison,
    contributionLogs = [],
    followedTargetIds,
    friendTargetIds,
    rankings,
    uiRules,
    onClaimStipend,
    onChangeTab,
    onContributionGuide,
    onFollowRankingPlayer,
    onUnfollowRankingPlayer,
  } = props;
  const canClaimStipend = stipend?.status === 'available';
  const followedTargetIdSet = new Set(followedTargetIds);
  const friendTargetIdSet = new Set(friendTargetIds);
  const stipendButtonLabel = stipend?.status === 'claimed' ? '已领取' : '领取俸禄';

  return (
    <div className="scene-shell">
      <section className="hero-panel parchment compact-hero faction-overview-card">
        <div className="faction-overview-grid">
          <div className="faction-overview-column">
            <button className="pending-claim-button pending-claim-button-faction" disabled={!canClaimStipend || claimingStipend} onClick={onClaimStipend} type="button">
              <strong>{stipendButtonLabel}</strong>
            </button>
            {uiRules.showHeroNotes ? (
              <div className="faction-overview-note-block">
                <p className="faction-breakdown-line">{hero.advantage}</p>
                <p className="faction-breakdown-line">{hero.breakdown}</p>
              </div>
            ) : null}
          </div>

          {uiRules.showContributionPanel ? (
            <div className="faction-overview-column faction-overview-column-right">
              <button className="faction-contribution-box" onClick={onContributionGuide} type="button">
                <span className="faction-contribution-title">贡献值</span>
                <strong className="faction-contribution-value">{contribution.value}</strong>
              </button>
              <div className="faction-overview-note-block">
                <p className="faction-contribution-description">{contribution.description}</p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {uiRules.showTabs ? (
        <div className="tab-row">
          <button className={`tab-button ${factionTab === 'overview' ? 'active' : ''}`} onClick={() => onChangeTab('overview')} type="button">
            阵营对比
          </button>
          <button className={`tab-button ${factionTab === 'donate' ? 'active' : ''}`} onClick={() => onChangeTab('donate')} type="button">
            贡献记录
          </button>
          <button className={`tab-button ${factionTab === 'rank' ? 'active' : ''}`} onClick={() => onChangeTab('rank')} type="button">
            贡献排行
          </button>
        </div>
      ) : null}

      <div className="scene-scroll">
        {factionTab === 'overview' && uiRules.showComparison ? (
          <div className="faction-comparison-list">
            {comparison.map((item) => (
              <article className={`panel-card faction-comparison-card${item.isCurrent ? ' is-current' : ''}`} key={item.faction}>
                <div className="panel-head">
                  <h4>{item.faction}</h4>
                  {item.isCurrent ? <span className="soft-tag">当前阵营</span> : null}
                </div>
                <div className="faction-comparison-metrics">
                  <div className="stat-row">
                    <span>阵营总贡献</span>
                    <strong>{item.totalContribution ?? item.power}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {factionTab === 'donate' && uiRules.showTodayTasks ? (
          <>
            {contributionLogs.length > 0 && uiRules.showContributionLogs ? (
              <article className="panel-card">
                <div className="panel-head">
                  <h4>贡献记录</h4>
                </div>
                {contributionLogs.map((log) => (
                  <div className="stat-row" key={log.id}>
                    <span>{log.sourceLabel}</span>
                    <strong>+{log.contributionDelta}</strong>
                  </div>
                ))}
              </article>
            ) : (
              <p className="muted">暂无贡献记录。</p>
            )}
          </>
        ) : null}

        {factionTab === 'rank' && uiRules.showRankings ? (
          <article className="panel-card ranking-card faction-ranking-card">
            {rankings.length > 0 ? rankings.map((item) => {
              const playerId = item.playerId;
              const isFollowing = Boolean(playerId && followedTargetIdSet.has(playerId));
              const isFriend = Boolean(playerId && friendTargetIdSet.has(playerId));

              return (
                <div className="faction-ranking-row" key={playerId ?? item.label}>
                  <div className="faction-ranking-player">
                    <span>{item.label}</span>
                    {item.note ? <small>{item.note}</small> : null}
                  </div>
                  <strong>{item.value}</strong>
                  {item.isCurrentPlayer ? (
                    <span className="soft-tag">自己</span>
                  ) : isFriend ? (
                    <span className="soft-tag">好友</span>
                  ) : playerId ? (
                    <button
                      className={isFollowing ? 'ghost-button faction-ranking-follow-button' : 'secondary-button faction-ranking-follow-button'}
                      onClick={() => {
                        if (isFollowing) {
                          onUnfollowRankingPlayer(playerId);
                        } else {
                          onFollowRankingPlayer(playerId);
                        }
                      }}
                      type="button"
                    >
                      {isFollowing ? '已关注' : '关注'}
                    </button>
                  ) : null}
                </div>
              );
            }) : (
              <p className="muted">本阵营暂无贡献排行。</p>
            )}
          </article>
        ) : null}
      </div>
    </div>
  );
}
