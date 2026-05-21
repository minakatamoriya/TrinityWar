import type { AdminListResponse } from '@trinitywar/shared';
import { EmptyState } from '../components/EmptyState';
import { TableSection } from '../components/TableSection';
import type { AdminRecord } from '../types';

export function CastleLevelsView(props: {
  busy: string;
  levels: AdminListResponse<AdminRecord> | null;
  onRefresh: () => void;
}): JSX.Element {
  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Readonly</p>
            <h3>主城升级数值</h3>
          </div>
          <button className="primary-button" disabled={props.busy === 'castle-levels'} onClick={props.onRefresh} type="button">刷新</button>
        </div>
        <EmptyState text="当前先做查看：主城等级、升级消耗、累计消耗、税收和解锁内容。编辑能力后续单独接配置存储。" />
      </section>
      <TableSection
        title="主城升级表"
        columns={[
          { label: '等级 / level', key: 'level' },
          { label: '升级消耗 / upgradeCost', key: 'upgradeCost' },
          { label: '累计消耗 / cumulativeCost', key: 'cumulativeCost' },
          { label: '每小时税收 / taxPerHour', key: 'taxPerHour' },
          { label: '解锁内容 / unlocks', key: 'unlocks' },
        ]}
        rows={props.levels?.items ?? []}
      />
    </div>
  );
}
