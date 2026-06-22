import { useMemo, useState } from 'react';
import { formatSeasonLabel, type ClientSeasonMedal, type ClientSeasonMedalCabinet } from '@trinitywar/shared';

interface SeasonMedalCabinetViewProps {
  cabinet: ClientSeasonMedalCabinet | null;
  loadingText?: string;
}

export function SeasonMedalCabinetView(props: SeasonMedalCabinetViewProps): JSX.Element {
  const [selectedMedalId, setSelectedMedalId] = useState<string | null>(null);
  const seasons = useMemo(() => (
    props.cabinet?.medalsBySeason.map((season) => ({
      ...season,
      medals: season.medals.filter((medal) => medal.rewardStatus !== 'voided'),
    })) ?? []
  ), [props.cabinet]);
  const medals = useMemo(() => seasons.flatMap((season) => season.medals), [seasons]);
  const selectedMedal = selectedMedalId ? medals.find((medal) => medal.id === selectedMedalId) ?? null : null;

  if (!props.cabinet) {
    return <p className="season-medal-empty-text">{props.loadingText ?? '正在读取奖章陈列柜。'}</p>;
  }

  return (
    <div className="season-medal-cabinet">
      <div className="season-medal-season-list">
        {seasons.map((season) => (
          <section className="season-medal-season" key={season.seasonNumber}>
            <div className="season-medal-season-head">
              <strong>{formatSeasonLabel(season.seasonNumber)}</strong>
              <span>{season.medals.length} 枚</span>
            </div>
            {season.medals.length <= 0 ? (
              <p className="season-medal-empty-text">本赛季暂未获得奖章。</p>
            ) : (
              <div className="season-medal-icon-grid" aria-label={`${formatSeasonLabel(season.seasonNumber)}奖章`}>
                {season.medals.map((medal) => (
                  <button
                    aria-label={`查看${medal.title}`}
                    className={`season-medal-icon-button${selectedMedal?.id === medal.id ? ' is-selected' : ''}`}
                    key={medal.id}
                    onClick={() => setSelectedMedalId(medal.id)}
                    title={medal.title}
                    type="button"
                  >
                    <span className="season-medal-icon-glyph" aria-hidden="true">{getMedalDomainGlyph(medal.domain)}</span>
                    <span className="season-medal-icon-rank">{getMedalTierShortLabel(medal.rewardTier)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <section className="season-medal-detail-card" aria-live="polite">
        {selectedMedal ? <SeasonMedalDetail medal={selectedMedal} /> : (
          <p className="season-medal-empty-text">选择一个奖章查看详情。</p>
        )}
      </section>
    </div>
  );
}

function SeasonMedalDetail(props: { medal: ClientSeasonMedal }): JSX.Element {
  const medal = props.medal;

  return (
    <>
      <div className="season-medal-detail-head">
        <span className="season-medal-detail-icon" aria-hidden="true">{getMedalDomainGlyph(medal.domain)}</span>
        <div>
          <strong>{medal.title}</strong>
          <span>{formatSeasonLabel(medal.seasonNumber)} · {getMedalDomainLabel(medal.domain)}</span>
        </div>
      </div>
      <dl className="season-medal-detail-list">
        <div>
          <dt>状态</dt>
          <dd>{getRewardStatusLabel(medal.rewardStatus)}</dd>
        </div>
        <div>
          <dt>来源</dt>
          <dd>{getRewardSourceLabel(medal)}</dd>
        </div>
        <div>
          <dt>说明</dt>
          <dd>{medal.description}</dd>
        </div>
      </dl>
    </>
  );
}

function getMedalDomainGlyph(domain: string): string {
  if (domain === 'farming') {
    return '耕';
  }
  if (domain === 'spirit') {
    return '灵';
  }
  if (domain === 'combat') {
    return '战';
  }
  if (domain === 'contribution') {
    return '贡';
  }
  return '章';
}

function getMedalDomainLabel(domain: string): string {
  if (domain === 'farming') {
    return '种田领域';
  }
  if (domain === 'spirit') {
    return '养宠领域';
  }
  if (domain === 'combat') {
    return '探索战斗领域';
  }
  if (domain === 'contribution') {
    return '贡献领域';
  }
  return '赛季成就';
}

function getMedalTierShortLabel(rewardTier: string | null): string {
  if (!rewardTier) {
    return '章';
  }
  if (rewardTier.endsWith('-gold') || rewardTier.endsWith('-3000')) {
    return '金';
  }
  if (rewardTier.endsWith('-silver') || rewardTier.endsWith('-1500')) {
    return '银';
  }
  if (rewardTier.endsWith('-bronze') || rewardTier.endsWith('-800')) {
    return '铜';
  }
  if (rewardTier.endsWith('-200')) {
    return '银';
  }
  if (rewardTier.endsWith('-150')) {
    return '铜';
  }
  if (rewardTier.endsWith('-300')) {
    return '金';
  }
  if (rewardTier.endsWith('-100')) {
    return '入';
  }
  if (rewardTier.endsWith('-50')) {
    return '始';
  }
  return '章';
}

function getRewardStatusLabel(status: ClientSeasonMedal['rewardStatus']): string {
  if (status === 'claimed') {
    return '已领取';
  }
  if (status === 'notified') {
    return '待领取';
  }
  if (status === 'generated') {
    return '待发放';
  }
  return '成就记录';
}

function getRewardSourceLabel(medal: ClientSeasonMedal): string {
  if (medal.rewardTier && rewardTierLabels[medal.rewardTier]) {
    return rewardTierLabels[medal.rewardTier];
  }
  if (medal.rewardType) {
    return getRewardTypeLabel(medal.rewardType);
  }
  return '赛季成就';
}

function getRewardTypeLabel(rewardType: string): string {
  if (rewardType === 'participation') {
    return '赛季参与奖励';
  }
  if (rewardType === 'domain_farming') {
    return '种田领域奖励';
  }
  if (rewardType === 'domain_spirit') {
    return '养宠领域奖励';
  }
  if (rewardType === 'domain_combat') {
    return '探索战斗领域奖励';
  }
  if (rewardType === 'contribution_tier') {
    return '贡献领域奖励';
  }
  return '赛季奖励';
}

const rewardTierLabels: Record<string, string> = {
  'season-participation': '赛季参与奖励',
  'season-farming-bronze': '种田领域铜档',
  'season-farming-silver': '种田领域银档',
  'season-farming-gold': '种田领域金档',
  'season-spirit-bronze': '养宠领域铜档',
  'season-spirit-silver': '养宠领域银档',
  'season-spirit-gold': '养宠领域金档',
  'season-combat-bronze': '探索战斗领域铜档',
  'season-combat-silver': '探索战斗领域银档',
  'season-combat-gold': '探索战斗领域金档',
  'season-contribution-50': '贡献领域起步档',
  'season-contribution-100': '贡献领域入门档',
  'season-contribution-150': '贡献领域铜档',
  'season-contribution-200': '贡献领域银档',
  'season-contribution-300': '贡献领域金档',
};
