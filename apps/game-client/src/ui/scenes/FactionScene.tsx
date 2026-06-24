import { createPortal } from 'react-dom';
import { useState } from 'react';
import { getSpiritBattleInnateRules } from '@trinitywar/shared';
import type {
  ClientFactionSpiritLeaderboardEntry,
  ClientFactionStipendSummary,
  ClientSceneContentResponse,
  ClientSpiritElement,
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
  spiritRankings?: ClientFactionSpiritLeaderboardEntry[];
  portalTarget: HTMLElement | null;
  uiRules: TutorialFactionUiRules;
  onClaimStipend: () => void;
  onChangeTab: (tab: 'rank' | 'spirit') => void;
  onContributionGuide: () => void;
  onFollowRankingPlayer: (targetPlayerId: string) => void;
  onOpenSpiritProfile: (targetPlayerId: string) => void;
  onUnfollowRankingPlayer: (targetPlayerId: string) => void;
}

interface SpiritWinRatePreviewRow {
  spiritName: string;
  spiritId: string;
  rarity: 'common' | 'rare' | 'legendary';
  element: ClientSpiritElement;
  winRateLabel: string;
  recordLabel: string;
  traitItems: Array<{ label: string; description: string }>;
  statTraitItems: Array<{ label: string; description: string }>;
}

const spiritPreviewCatalog: Array<{
  spiritId: string;
  spiritName: string;
  rarity: 'common' | 'rare' | 'legendary';
  element: ClientSpiritElement;
  statTraitItems: Array<{ label: string; description: string }>;
}> = [
  {
    spiritId: 'canglang',
    spiritName: '苍狼',
    rarity: 'common',
    element: 'fire',
    statTraitItems: [
      { label: '利爪', description: '攻击+12%' },
      { label: '暴击', description: '暴击率+8%' },
      { label: '暴伤', description: '暴击伤害+25%' },
      { label: '收割', description: '目标生命低于50%时，伤害+18%' },
      { label: '吸血', description: '造成伤害的12%回复自身' },
    ],
  },
  {
    spiritId: 'chenghuang',
    spiritName: '乘黄',
    rarity: 'rare',
    element: 'metal',
    statTraitItems: [
      { label: '厚皮', description: '最大生命+12%' },
      { label: '吸血', description: '造成伤害的12%回复自身' },
      { label: '闪避', description: '闪避率+6%' },
      { label: '压制', description: '目标攻击-8%' },
      { label: '铁骨', description: '最大生命+30%，攻击-10%' },
    ],
  },
  {
    spiritId: 'qingyuan',
    spiritName: '青猿',
    rarity: 'common',
    element: 'water',
    statTraitItems: [
      { label: '背水', description: '自身生命低于50%时，攻击+25%' },
      { label: '吸血', description: '造成伤害的12%回复自身' },
      { label: '暴击', description: '暴击率+8%' },
      { label: '暴伤', description: '暴击伤害+25%' },
      { label: '利爪', description: '攻击+12%' },
    ],
  },
  {
    spiritId: 'xuanhu',
    spiritName: '玄虎',
    rarity: 'common',
    element: 'wood',
    statTraitItems: [
      { label: '利爪', description: '攻击+12%' },
      { label: '利刃', description: '攻击+30%，最大生命-10%' },
      { label: '暴击', description: '暴击率+8%' },
      { label: '暴伤', description: '暴击伤害+25%' },
      { label: '吸血', description: '造成伤害的12%回复自身' },
    ],
  },
  {
    spiritId: 'shuanghu',
    spiritName: '霜狐',
    rarity: 'common',
    element: 'fire',
    statTraitItems: [
      { label: '闪避', description: '闪避率+6%' },
      { label: '闪避', description: '闪避率+6%' },
      { label: '闪避', description: '闪避率+6%' },
      { label: '暴击', description: '暴击率+8%' },
      { label: '吸血', description: '造成伤害的12%回复自身' },
    ],
  },
  {
    spiritId: 'yingbao',
    spiritName: '影豹',
    rarity: 'common',
    element: 'fire',
    statTraitItems: [
      { label: '收割', description: '目标生命低于50%时，伤害+18%' },
      { label: '利爪', description: '攻击+12%' },
      { label: '暴击', description: '暴击率+8%' },
      { label: '暴伤', description: '暴击伤害+25%' },
      { label: '闪避', description: '闪避率+6%' },
    ],
  },
  {
    spiritId: 'hegui',
    spiritName: '岩龟',
    rarity: 'common',
    element: 'earth',
    statTraitItems: [
      { label: '厚皮', description: '最大生命+12%' },
      { label: '厚皮', description: '最大生命+12%' },
      { label: '铁骨', description: '最大生命+30%，攻击-10%' },
      { label: '吸血', description: '造成伤害的12%回复自身' },
      { label: '炽燃', description: '目标受到燃血伤害+3%最大生命' },
    ],
  },
  {
    spiritId: 'xueyan',
    spiritName: '血魇',
    rarity: 'legendary',
    element: 'water',
    statTraitItems: [
      { label: '利爪', description: '攻击+12%' },
      { label: '暴击', description: '暴击率+8%' },
      { label: '暴伤', description: '暴击伤害+25%' },
      { label: '吸血', description: '造成伤害的12%回复自身' },
      { label: '利刃', description: '攻击+30%，最大生命-10%' },
    ],
  },
];

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
  const spiritPreviewRows = buildSpiritWinRateRows(spiritRankings, rankings);
  const [showcaseSpiritRow, setShowcaseSpiritRow] = useState<SpiritWinRatePreviewRow | null>(null);

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
              const avatarGlyph = Array.from(item.label.trim())[0] ?? '将';

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
              <span className="soft-tag">{spiritRankings.length > 0 ? '真实榜单' : '预览'}</span>
            </div>
            <div className="faction-spirit-preview-list">
              {spiritPreviewRows.map((row) => (
                <article className="faction-spirit-preview-row" key={`${row.spiritId}-${row.winRateLabel}`}>
                  <button className="faction-spirit-preview-entry" onClick={() => setShowcaseSpiritRow(row)} type="button">
                    <div className="faction-spirit-preview-avatar" aria-hidden="true">
                      <span>{row.spiritName.slice(0, 1)}</span>
                    </div>
                    <div className="faction-spirit-preview-main">
                      <div className="faction-spirit-preview-head">
                        <strong>{row.spiritName}</strong>
                        <span className="soft-tag">{row.winRateLabel}</span>
                      </div>
                      <p>{row.recordLabel}</p>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          </article>
        ) : null}
      </div>

      {showcaseSpiritRow ? (portalTarget ? createPortal(
        <SpiritCardShowcaseModal
          data={{
            label: showcaseSpiritRow.spiritName,
            rarity: showcaseSpiritRow.rarity,
            element: showcaseSpiritRow.element,
            detailTitle: '特质词条',
            detailSummary: `胜率：${showcaseSpiritRow.winRateLabel}    ${showcaseSpiritRow.recordLabel}`,
            detailSections: [
              {
                title: '特质',
                items: showcaseSpiritRow.traitItems,
              },
              {
                title: '词条',
                items: showcaseSpiritRow.statTraitItems,
              },
            ],
            emptyDetailTitle: '暂无特质',
            emptyDetailText: '这只灵宠暂时没有可展示的先天特性。',
            compactDetail: true,
          }}
          onClose={() => setShowcaseSpiritRow(null)}
        />,
        portalTarget,
      ) : (
        <SpiritCardShowcaseModal
          data={{
            label: showcaseSpiritRow.spiritName,
            rarity: showcaseSpiritRow.rarity,
            element: showcaseSpiritRow.element,
            detailTitle: '特质词条',
            detailSummary: `胜率：${showcaseSpiritRow.winRateLabel}    ${showcaseSpiritRow.recordLabel}`,
            detailSections: [
              {
                title: '特质',
                items: showcaseSpiritRow.traitItems,
              },
              {
                title: '词条',
                items: showcaseSpiritRow.statTraitItems,
              },
            ],
            emptyDetailTitle: '暂无特质',
            emptyDetailText: '这只灵宠暂时没有可展示的先天特性。',
            compactDetail: true,
          }}
          onClose={() => setShowcaseSpiritRow(null)}
        />
      )) : null}
    </div>
  );
}

function buildSpiritWinRateRows(
  spiritRankings: ClientFactionSpiritLeaderboardEntry[],
  rankings: ClientSceneContentResponse['faction']['rankings'],
): SpiritWinRatePreviewRow[] {
  if (spiritRankings.length > 0) {
    return spiritRankings.slice(0, 10).map((item) => {
      const spirit = spiritPreviewCatalog.find((entry) => entry.spiritId === item.spiritId) ?? {
        spiritId: item.spiritId,
        spiritName: item.label,
        rarity: item.rarity,
        element: 'wood' as ClientSpiritElement,
        statTraitItems: [],
      };

      return {
        spiritId: item.spiritId,
        spiritName: item.label,
        rarity: item.rarity,
        element: spirit.element,
        winRateLabel: `${item.winRatePercent}%`,
        recordLabel: `${item.winCount}胜/${item.lossCount}负/${item.drawCount}平`,
        traitItems: getSpiritBattleInnateRules(item.spiritId).map((rule) => ({
          label: rule.label,
          description: rule.description,
        })),
        statTraitItems: spirit.statTraitItems,
      };
    });
  }

  return rankings
    .filter((item) => Boolean(item.playerId))
    .slice(0, 10)
    .map((item, index) => {
      const base = Math.max(item.contributionScore ?? 0, 20);
      const battleCount = Math.max(12, Math.floor(base / 4) + index * 2);
      const drawCount = index % 3 === 0 ? 1 : 0;
      const lossCount = Math.max(2, Math.floor(battleCount * 0.18));
      const winCount = Math.max(battleCount - lossCount - drawCount, 1);
      const winRate = Math.round((winCount / battleCount) * 100);
      const spirit = spiritPreviewCatalog[index % spiritPreviewCatalog.length] ?? spiritPreviewCatalog[0];

      return {
        spiritId: spirit.spiritId,
        spiritName: spirit.spiritName,
        rarity: spirit.rarity,
        element: spirit.element,
        winRateLabel: `${winRate}%`,
        recordLabel: `${winCount}胜/${lossCount}负/${drawCount}平`,
        traitItems: getSpiritBattleInnateRules(spirit.spiritId).map((rule) => ({
          label: rule.label,
          description: rule.description,
        })),
        statTraitItems: spirit.statTraitItems,
      };
    });
}
