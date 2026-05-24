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
            <h3>首发轻量规则</h3>
          </div>
          <button className="primary-button" disabled={props.busy === 'castle-levels'} onClick={props.onRefresh} type="button">刷新</button>
        </div>
        <EmptyState text="这里用于核查地契开田、阵营每日俸禄和领地科技配置；主城税收、金库容量和每小时分红已退出首发口径。" />
      </section>
      <TableSection
        title="轻量规则表"
        columns={[
          { label: '类型 / type', key: 'type' },
          { label: '键 / key', key: 'key' },
          { label: '名称 / title', key: 'title' },
          { label: '条件 / requirements', key: 'requirements' },
          { label: '成本 / cost', key: 'cost' },
          { label: '效果 / effect', key: 'effect' },
          { label: '奖励 / rewards', key: 'rewards' },
        ]}
        rows={props.levels?.items ?? []}
      />
    </div>
  );
}
