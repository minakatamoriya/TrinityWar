import { createPortal } from 'react-dom';
import { useState } from 'react';
import type {
  ClientFactionSpiritInstanceLeaderboardEntry,
  ClientFactionStipendSummary,
  ClientSceneContentResponse,
} from '@trinitywar/shared';
import type { TutorialFactionUiRules } from '../../tutorial/tutorialFlow';
import { SpiritCardShowcaseModal } from '../common/SpiritCardShowcaseModal';

interface FactionSceneProps {
  hero: ClientSceneContentResponse['faction']['hero'];
  contribution: ClientSceneContentResponse['faction']['contribution'];
  stipend: ClientFactionStipendSummary | undefined;
  claimingStipend: boolean;
  factionTab: 'rank' | 'spirit';
  followedTargetIds: string[];
  friendTargetIds: string[];
  rankings: ClientSceneContentResponse['faction']['rankings'];
  spiritRankings?: ClientFactionSpiritInstanceLeaderboardEntry[];
  portalTarget: HTMLElement | null;
  uiRules: TutorialFactionUiRules;
  onClaimStipend: () => void;
  onChangeTab: (tab: 'rank' | 'spirit') => void;
  onContributionGuide: () => void;
  onFollowRankingPlayer: (targetPlayerId: string) => void;
  onOpenSpiritProfile: (targetPlayerId: string) => void;
  onUnfollowRankingPlayer: (targetPlayerId: string) => void;
}

interface SpiritLeaderboardRow {
  spiritInstanceId: string;
  spiritName: string;
  rarity: ClientFactionSpiritInstanceLeaderboardEntry['rarity'];
  element: ClientFactionSpiritInstanceLeaderboardEntry['element'];
  winRateLabel: string;
  recordLabel: string;
  innateTraitItems: Array<{ label: string; description: string }>;
  traitItems: Array<{ label: string; description: string }>;
}

export function FactionScene(props: FactionSceneProps): JSX.Element {
  const {
    hero,
    contribution,
    stipend,
    claimingStipend,
    factionTab,
    followedTargetIds,
    friendTargetIds,
    rankings,
    spiritRankings = [],
    portalTarget,
    uiRules,
    onClaimStipend,
    onChangeTab,
    onContributionGuide,
    onFollowRankingPlayer,
    onOpenSpiritProfile,
    onUnfollowRankingPlayer,
  } = props;

  const canClaimStipend = stipend?.status === 'available';
  const followedTargetIdSet = new Set(followedTargetIds);
  const friendTargetIdSet = new Set(friendTargetIds);
  const stipendButtonLabel = stipend?.status === 'claimed' ? '已领取' : '领取俸禄';
  const [showcaseSpiritRow, setShowcaseSpiritRow] = useState<SpiritLeaderboardRow | null>(null);

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
          <button className={`tab-button ${factionTab === 'rank' ? 'active' : ''}`} onClick={() => onChangeTab('rank')} type="button">
            贡献排行
          </button>
          <button className={`tab-button ${factionTab === 'spirit' ? 'active' : ''}`} onClick={() => onChangeTab('spirit')} type="button">
            灵宠胜率榜
          </button>
        </div>
      ) : null}

      <div className="scene-scroll">
        {factionTab === 'rank' && uiRules.showRankings ? (
          <article className="panel-card ranking-card faction-ranking-card">
            {rankings.length > 0 ? rankings.map((item) => {
              const playerId = item.playerId;
              const isFollowing = Boolean(playerId && followedTargetIdSet.has(playerId));
              const isFriend = Boolean(playerId && friendTargetIdSet.has(playerId));
              const avatarGlyph = Array.from(item.label.trim())[0] ?? '人';

              return (
                <div className="faction-ranking-row" key={playerId ?? item.label}>
                  <div className="faction-ranking-avatar" aria-hidden="true">
                    <span>{avatarGlyph}</span>
                  </div>
                  <div className="faction-ranking-player">
                    <span>{item.label}</span>
                  </div>
                  <div className="faction-ranking-actions">
                    {playerId ? (
                      <button
                        className="ghost-button faction-ranking-follow-button"
                        onClick={() => onOpenSpiritProfile(playerId)}
                        type="button"
                      >
                        搭配
                      </button>
                    ) : null}
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
                </div>
              );
            }) : (
              <p className="muted">本阵营暂无贡献排行。</p>
            )}
          </article>
        ) : null}

        {factionTab === 'spirit' ? (
          <article className="panel-card faction-spirit-board-card">
            <div className="panel-head">
              <h4>灵宠胜率榜</h4>
              <span className="soft-tag">真实实例榜</span>
            </div>
            <div className="faction-spirit-preview-list">
              {spiritRankings.length > 0 ? spiritRankings.slice(0, 10).map((row) => (
                <article className="faction-spirit-preview-row" key={row.spiritInstanceId}>
                  <button className="faction-spirit-preview-entry" onClick={() => setShowcaseSpiritRow(toShowcaseRow(row))} type="button">
                    <div className="faction-spirit-preview-avatar" aria-hidden="true">
                      <span>{row.label.slice(0, 1)}</span>
                    </div>
                    <div className="faction-spirit-preview-main">
                      <div className="faction-spirit-preview-head">
                        <strong>{row.label}</strong>
                        <span className="soft-tag">{row.winRatePercent}%</span>
                      </div>
                      <p>{formatRecordLabel(row.winCount, row.lossCount, row.drawCount)}</p>
                    </div>
                  </button>
                </article>
              )) : (
                <p className="muted">本阵营暂时还没有达到上榜门槛的灵宠实例。</p>
              )}
            </div>
          </article>
        ) : null}
      </div>

      {showcaseSpiritRow ? renderShowcase(showcaseSpiritRow, portalTarget, () => setShowcaseSpiritRow(null)) : null}
    </div>
  );
}

function renderShowcase(
  row: SpiritLeaderboardRow,
  portalTarget: HTMLElement | null,
  onClose: () => void,
): JSX.Element {
  const modal = (
    <SpiritCardShowcaseModal
      data={{
        label: row.spiritName,
        rarity: row.rarity,
        element: row.element,
        detailTitle: '灵宠详情',
        detailSummary: `胜率：${row.winRateLabel}    ${row.recordLabel}`,
        detailSections: [
          {
            title: '特质',
            items: row.innateTraitItems,
          },
          {
            title: '词条',
            items: row.traitItems,
          },
        ],
        emptyDetailTitle: '暂无词条',
        emptyDetailText: '这只灵宠当前没有可展示的词条信息。',
        compactDetail: true,
      }}
      onClose={onClose}
    />
  );

  return portalTarget ? createPortal(modal, portalTarget) : modal;
}

function toShowcaseRow(row: ClientFactionSpiritInstanceLeaderboardEntry): SpiritLeaderboardRow {
  return {
    spiritInstanceId: row.spiritInstanceId,
    spiritName: row.label,
    rarity: row.rarity,
    element: row.element,
    winRateLabel: `${row.winRatePercent}%`,
    recordLabel: formatRecordLabel(row.winCount, row.lossCount, row.drawCount),
    innateTraitItems: row.innateTraitItems,
    traitItems: row.traitItems,
  };
}

function formatRecordLabel(winCount: number, lossCount: number, drawCount: number): string {
  return `${winCount}胜/${lossCount}负/${drawCount}平`;
}
