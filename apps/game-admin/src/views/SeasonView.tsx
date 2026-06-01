import type { AdminListResponse } from '@trinitywar/shared';
import { InfoSection } from '../components/InfoSection';
import { MetricGrid } from '../components/MetricGrid';
import { TableSection } from '../components/TableSection';
import { recordRows } from '../domain/labels';
import type { AdminRecord } from '../types';

export function SeasonView(props: {
  busy: string;
  currentSeason: AdminRecord | null;
  factionSnapshots: AdminListResponse<AdminRecord> | null;
  playerHistory: AdminListResponse<AdminRecord> | null;
  playerHistoryId: string;
  playerSnapshots: AdminListResponse<AdminRecord> | null;
  seasons: AdminListResponse<AdminRecord> | null;
  onFactionSnapshotPageChange: (page: number) => void;
  onLoadPlayerHistory: () => void;
  onPlayerHistoryIdChange: (value: string) => void;
  onPlayerHistoryPageChange: (page: number) => void;
  onPlayerSnapshotPageChange: (page: number) => void;
  onRefresh: () => void;
  onSeasonPageChange: (page: number) => void;
}): JSX.Element {
  const metrics = [
    { label: '当前赛季', value: String(props.currentSeason?.seasonNumber ?? '-'), tone: 'neutral' },
    { label: '当前周', value: `${String(props.currentSeason?.currentWeek ?? '-')}/${String(props.currentSeason?.totalWeeks ?? '-')}`, tone: 'neutral' },
    { label: '已追踪玩家', value: String(props.currentSeason?.playerStateCount ?? '-'), tone: 'ok' },
    { label: '待重置玩家', value: String(props.currentSeason?.pendingResetCount ?? '-'), tone: Number(props.currentSeason?.pendingResetCount ?? 0) > 0 ? 'bad' : 'ok' },
  ];

  const currentSeasonNumber = Number(props.currentSeason?.seasonNumber ?? 0);

  return (
    <div className="stacked-content">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Season Ops</p>
            <h3>赛季后台</h3>
          </div>
          <button className="primary-button" disabled={props.busy === 'season'} onClick={props.onRefresh} type="button">刷新</button>
        </div>
        <MetricGrid metrics={metrics} />
      </section>

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

      <TableSection
        title={`S${currentSeasonNumber || '-'} 阵营快照`}
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
        title={`S${currentSeasonNumber || '-'} 玩家快照`}
        columns={[
          { label: '玩家', key: 'nickname' },
          { label: '阵营', key: 'factionName' },
          { label: '贡献', key: 'contributionScore' },
          { label: '收获', key: 'harvestCount' },
          { label: '掠夺', key: 'raidCount' },
          { label: '排名', key: 'finalRank' },
          { label: '奖励档', key: 'rewardTier' },
        ]}
        rows={props.playerSnapshots?.items ?? []}
        pagination={props.playerSnapshots?.pagination ?? null}
        paginationBusy={props.busy === 'season-player-snapshots'}
        onPageChange={props.onPlayerSnapshotPageChange}
      />

      <section className="panel">
        <div className="panel-head compact">
          <h3>玩家赛季历史</h3>
          <div className="lookup-form">
            <input onChange={(event) => props.onPlayerHistoryIdChange(event.target.value)} placeholder="输入玩家 ID" value={props.playerHistoryId} />
            <button className="primary-button" disabled={props.busy === 'season-player-history'} onClick={props.onLoadPlayerHistory} type="button">查询</button>
          </div>
        </div>
        <TableSection
          title="历史快照"
          columns={[
            { label: '赛季', key: 'seasonNumber' },
            { label: '阵营', key: 'factionName' },
            { label: '贡献', key: 'contributionScore' },
            { label: '排名', key: 'finalRank' },
            { label: '奖励档', key: 'rewardTier' },
            { label: '生成时间', key: 'createdAt' },
          ]}
          rows={props.playerHistory?.items ?? []}
          pagination={props.playerHistory?.pagination ?? null}
          paginationBusy={props.busy === 'season-player-history'}
          onPageChange={props.onPlayerHistoryPageChange}
        />
      </section>
    </div>
  );
}
