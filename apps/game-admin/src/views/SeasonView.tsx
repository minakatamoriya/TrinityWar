import { formatSeasonLabel, type AdminListResponse } from '@trinitywar/shared';
import { useState } from 'react';
import { InfoSection } from '../components/InfoSection';
import { MetricGrid } from '../components/MetricGrid';
import { TableSection } from '../components/TableSection';
import { recordRows } from '../domain/labels';
import type { AdminRecord } from '../types';

type SeasonTabKey = 'overview' | 'snapshots' | 'rewards' | 'achievements' | 'player-history';

const seasonTabs: Array<{ key: SeasonTabKey; label: string }> = [
  { key: 'overview', label: '赛季概览' },
  { key: 'snapshots', label: '赛季快照' },
  { key: 'rewards', label: '奖励发放' },
  { key: 'achievements', label: '奖章成就' },
  { key: 'player-history', label: '玩家历史' },
];

export function SeasonView(props: {
  busy: string;
  achievements: AdminListResponse<AdminRecord> | null;
  currentSeason: AdminRecord | null;
  factionSnapshots: AdminListResponse<AdminRecord> | null;
  playerHistory: AdminListResponse<AdminRecord> | null;
  playerHistoryId: string;
  playerRewardHistory: AdminListResponse<AdminRecord> | null;
  playerRewardSeasonNumber: string;
  playerSnapshots: AdminListResponse<AdminRecord> | null;
  rewardPreview: AdminRecord | null;
  rewardGrants: AdminListResponse<AdminRecord> | null;
  rewardSummary: AdminRecord | null;
  seasons: AdminListResponse<AdminRecord> | null;
  onAchievementPageChange: (page: number) => void;
  onFactionSnapshotPageChange: (page: number) => void;
  onLoadPlayerHistory: () => void;
  onLoadPlayerRewardHistory: () => void;
  onLoadRewardPreview: () => void;
  onPlayerHistoryIdChange: (value: string) => void;
  onPlayerHistoryPageChange: (page: number) => void;
  onPlayerRewardHistoryPageChange: (page: number) => void;
  onPlayerRewardSeasonNumberChange: (value: string) => void;
  onPlayerSnapshotPageChange: (page: number) => void;
  onRefresh: () => void;
  onRewardGrantPageChange: (page: number) => void;
  onSeasonPageChange: (page: number) => void;
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<SeasonTabKey>('overview');
  const currentSeasonNumber = Number(props.currentSeason?.seasonNumber ?? 0);
  const currentSeasonLabel = currentSeasonNumber > 0 ? formatSeasonLabel(currentSeasonNumber) : '-';
  const previewRules = toAdminRows(props.rewardPreview?.rules);
  const previewExistingGrants = toAdminRows(props.rewardPreview?.existingGrants);
  const previewExistingAchievements = toAdminRows(props.rewardPreview?.existingAchievements);
  const metrics = [
    { label: '当前赛季', value: currentSeasonLabel, tone: 'neutral' },
    { label: '当前周', value: `${String(props.currentSeason?.currentWeek ?? '-')}/${String(props.currentSeason?.totalWeeks ?? '-')}`, tone: 'neutral' },
    { label: '已追踪玩家', value: String(props.currentSeason?.playerStateCount ?? '-'), tone: 'ok' },
    { label: '待重置玩家', value: String(props.currentSeason?.pendingResetCount ?? '-'), tone: Number(props.currentSeason?.pendingResetCount ?? 0) > 0 ? 'bad' : 'ok' },
    { label: '奖励单', value: String(props.rewardSummary?.totalGrantCount ?? '-'), tone: 'neutral' },
    { label: '成就记录', value: String(props.rewardSummary?.totalAchievementCount ?? '-'), tone: 'neutral' },
  ];

  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">赛季运营</p>
            <h3>赛季后台</h3>
          </div>
          <button className="primary-button" disabled={props.busy === 'season'} onClick={props.onRefresh} type="button">刷新</button>
        </div>
        <MetricGrid metrics={metrics} />
        <div className="tab-list admin-section-tabs" role="tablist" aria-label="赛季后台功能分类">
          {seasonTabs.map((tab) => (
            <button
              className={`tab-button${activeTab === tab.key ? ' active' : ''}`}
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'overview' ? (
        <>
          <InfoSection
            title="当前赛季"
            rows={recordRows(props.currentSeason, [
              'seasonNumber',
              'currentWeek',
              'totalWeeks',
              'startsAt',
              'endsAt',
              'persisted',
              'playerStateCount',
              'pendingResetCount',
            ])}
          />

          <InfoSection
            title="奖励统计"
            rows={recordRows(props.rewardSummary, [
              'seasonNumber',
              'totalGrantCount',
              'totalAchievementCount',
              'rewardTypeCounts',
              'grantStatusCounts',
              'notificationClaimStatusCounts',
              'achievementDomainCounts',
            ])}
          />

          <TableSection
            title="赛季列表"
            columns={[
              { label: '赛季', key: 'seasonNumber' },
              { label: '开始时间', key: 'startsAt' },
              { label: '结束时间', key: 'endsAt' },
              { label: '当前', key: 'isCurrent' },
              { label: '更新时间', key: 'updatedAt' },
            ]}
            rows={props.seasons?.items ?? []}
            pagination={props.seasons?.pagination ?? null}
            paginationBusy={props.busy === 'season-list'}
            onPageChange={props.onSeasonPageChange}
          />
        </>
      ) : null}

      {activeTab === 'snapshots' ? (
        <>
          <TableSection
            title={`${currentSeasonLabel} 阵营快照`}
            columns={[
              { label: '阵营', key: 'factionName' },
              { label: '贡献', key: 'contributionScore' },
              { label: '成员数', key: 'memberCount' },
              { label: '排名', key: 'finalRank' },
              { label: '生成时间', key: 'createdAt' },
            ]}
            rows={props.factionSnapshots?.items ?? []}
            pagination={props.factionSnapshots?.pagination ?? null}
            paginationBusy={props.busy === 'season-faction-snapshots'}
            onPageChange={props.onFactionSnapshotPageChange}
          />

          <TableSection
            title={`${currentSeasonLabel} 玩家快照`}
            columns={[
              { label: '玩家', key: 'nickname' },
              { label: '阵营', key: 'factionName' },
              { label: '贡献', key: 'contributionScore' },
              { label: '收获', key: 'harvestCount' },
              { label: '探索战斗', key: 'raidCount' },
              { label: '排名', key: 'finalRank' },
              { label: '奖励档位', key: 'rewardTier' },
            ]}
            rows={props.playerSnapshots?.items ?? []}
            pagination={props.playerSnapshots?.pagination ?? null}
            paginationBusy={props.busy === 'season-player-snapshots'}
            onPageChange={props.onPlayerSnapshotPageChange}
          />
        </>
      ) : null}

      {activeTab === 'rewards' ? (
        <TableSection
          title={`${currentSeasonLabel} 奖励单`}
          columns={[
            { label: '玩家', key: 'nickname' },
            { label: '奖励类型', key: 'rewardType' },
            { label: '奖励档位', key: 'rewardTier' },
            { label: '奖励单状态', key: 'status' },
            { label: '通知状态', key: 'notificationClaimStatus' },
            { label: '贡献', key: 'contributionSnapshot' },
            { label: '收获', key: 'harvestCount' },
            { label: '探索战斗', key: 'raidCount' },
            { label: '奖励内容', key: 'rewardJson' },
            { label: '过期时间', key: 'expiresAt' },
          ]}
          rows={props.rewardGrants?.items ?? []}
          pagination={props.rewardGrants?.pagination ?? null}
          paginationBusy={props.busy === 'season-reward-grants'}
          onPageChange={props.onRewardGrantPageChange}
        />
      ) : null}

      {activeTab === 'achievements' ? (
        <TableSection
          title={`${currentSeasonLabel} 奖章成就`}
          columns={[
            { label: '玩家', key: 'nickname' },
            { label: '领域', key: 'domain' },
            { label: '成就', key: 'achievementKey' },
            { label: '标题', key: 'title' },
            { label: '奖励类型', key: 'rewardType' },
            { label: '奖励档位', key: 'rewardTier' },
            { label: '奖励状态', key: 'rewardStatus' },
            { label: '统计快照', key: 'statSnapshotJson' },
            { label: '生成时间', key: 'createdAt' },
          ]}
          rows={props.achievements?.items ?? []}
          pagination={props.achievements?.pagination ?? null}
          paginationBusy={props.busy === 'season-achievements'}
          onPageChange={props.onAchievementPageChange}
        />
      ) : null}

      {activeTab === 'player-history' ? (
        <>
          <section className="panel">
            <div className="panel-head compact">
              <h3>玩家赛季历史</h3>
              <div className="lookup-form season-player-lookup">
                <input onChange={(event) => props.onPlayerHistoryIdChange(event.target.value)} placeholder="输入玩家 ID" value={props.playerHistoryId} />
                <input
                  inputMode="numeric"
                  onChange={(event) => props.onPlayerRewardSeasonNumberChange(event.target.value)}
                  placeholder="赛季号"
                  value={props.playerRewardSeasonNumber}
                />
                <button className="primary-button" disabled={props.busy === 'season-player-history'} onClick={props.onLoadPlayerHistory} type="button">查快照</button>
                <button className="primary-button" disabled={props.busy === 'season-player-reward-history'} onClick={props.onLoadPlayerRewardHistory} type="button">查奖励</button>
                <button className="primary-button" disabled={props.busy === 'season-reward-preview'} onClick={props.onLoadRewardPreview} type="button">预览</button>
              </div>
            </div>
            <TableSection
              title="历史快照"
              columns={[
                { label: '赛季', key: 'seasonNumber' },
                { label: '阵营', key: 'factionName' },
                { label: '贡献', key: 'contributionScore' },
                { label: '排名', key: 'finalRank' },
                { label: '奖励档位', key: 'rewardTier' },
                { label: '生成时间', key: 'createdAt' },
              ]}
              rows={props.playerHistory?.items ?? []}
              pagination={props.playerHistory?.pagination ?? null}
              paginationBusy={props.busy === 'season-player-history'}
              onPageChange={props.onPlayerHistoryPageChange}
            />
          </section>

          <TableSection
            title="奖励历史"
            columns={[
              { label: '赛季', key: 'seasonLabel' },
              { label: '奖励类型', key: 'rewardTypeLabel' },
              { label: '奖励档位', key: 'rewardTier' },
              { label: '奖励单状态', key: 'status' },
              { label: '通知状态', key: 'notificationClaimStatus' },
              { label: '物品奖励', key: 'rewardSummary' },
              { label: '奖章', key: 'visibleAchievementTitles' },
              { label: '过期时间', key: 'expiresAt' },
              { label: '生成时间', key: 'createdAt' },
            ]}
            rows={props.playerRewardHistory?.items ?? []}
            pagination={props.playerRewardHistory?.pagination ?? null}
            paginationBusy={props.busy === 'season-player-reward-history'}
            onPageChange={props.onPlayerRewardHistoryPageChange}
          />

          <InfoSection
            title="预览摘要"
            rows={recordRows(props.rewardPreview, [
              'playerId',
              'nickname',
              'seasonLabel',
              'readOnly',
              'willWrite',
              'previewAvailable',
              'reason',
              'ruleCount',
              'existingGrantCount',
              'existingAchievementCount',
              'visibleAchievementCount',
            ])}
          />

          <TableSection
            title="预览命中奖励"
            columns={[
              { label: '奖励类型', key: 'rewardTypeLabel' },
              { label: '奖励档位', key: 'rewardTier' },
              { label: '领域', key: 'domain' },
              { label: '奖章', key: 'achievementTitle' },
              { label: '物品奖励', key: 'rewardSummary' },
              { label: '已有奖励单', key: 'existingGrantId' },
              { label: '已有状态', key: 'existingGrantStatus' },
              { label: '预览结果', key: 'previewOutcome' },
            ]}
            rows={previewRules}
          />

          <TableSection
            title="预览关联奖励单"
            columns={[
              { label: '奖励类型', key: 'rewardTypeLabel' },
              { label: '奖励档位', key: 'rewardTier' },
              { label: '奖励单状态', key: 'status' },
              { label: '通知状态', key: 'notificationClaimStatus' },
              { label: '物品奖励', key: 'rewardSummary' },
              { label: '奖章数', key: 'achievementCount' },
              { label: '生成时间', key: 'createdAt' },
            ]}
            rows={previewExistingGrants}
          />

          <TableSection
            title="预览关联奖章"
            columns={[
              { label: '领域', key: 'domain' },
              { label: '奖章', key: 'title' },
              { label: '奖励档位', key: 'rewardTier' },
              { label: '奖励状态', key: 'rewardStatus' },
              { label: '前台可见', key: 'clientVisible' },
              { label: '统计快照', key: 'statSnapshotJson' },
              { label: '生成时间', key: 'createdAt' },
            ]}
            rows={previewExistingAchievements}
          />
        </>
      ) : null}
    </div>
  );
}

function toAdminRows(value: unknown): AdminRecord[] {
  return Array.isArray(value) ? value.filter((item): item is AdminRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
}
