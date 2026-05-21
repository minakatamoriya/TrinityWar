import type { AdminOverviewResponse, AdminSystemStatusResponse } from '@trinitywar/shared';
import { InfoSection } from '../components/InfoSection';
import { MetricGrid } from '../components/MetricGrid';
import { TableSection } from '../components/TableSection';
import { getLabel } from '../domain/labels';

export function SystemView(props: { overview: AdminOverviewResponse | null; status: AdminSystemStatusResponse | null }): JSX.Element {
  return (
    <div className="view-stack">
      <MetricGrid metrics={[
        { label: '数据库', value: props.status?.database.status ?? '-', tone: props.status?.database.status === 'up' ? 'ok' : 'bad' },
        { label: '环境', value: props.status?.environment ?? '-', tone: 'neutral' },
        { label: '版本', value: props.status?.version ?? '-', tone: 'neutral' },
        { label: '调试头', value: props.status?.featureFlags.adminDebugKeyEnabled ? '已启用' : '未启用', tone: props.status?.featureFlags.adminDebugKeyEnabled ? 'ok' : 'neutral' },
      ]} />
      <InfoSection
        title="系统信息"
        rows={[
          { label: '应用', field: 'app', value: props.overview?.app },
          { label: '文档地址', field: 'docs', value: props.overview?.docs },
          { label: '服务时间', field: 'time', value: props.status?.time },
          { label: '数据库状态', field: 'database.status', value: props.status?.database.status },
        ]}
      />
      <TableSection
        title="Worker"
        columns={[
          { label: '名称 / name', key: 'name' },
          { label: '状态 / status', key: 'status' },
        ]}
        rows={props.status?.workers ?? []}
      />
      <TableSection
        title="功能开关"
        columns={[
          { label: '中文说明 / label', key: 'label' },
          { label: '英文字段 / field', key: 'field' },
          { label: '值 / value', key: 'value' },
        ]}
        rows={Object.entries(props.status?.featureFlags ?? {}).map(([field, value]) => ({
          label: getLabel(field),
          field,
          value,
        }))}
      />
      <TableSection
        title="开放模块"
        columns={[
          { label: '模块 / module', key: 'module' },
        ]}
        rows={(props.overview?.modules ?? []).map((module) => ({ module }))}
      />
    </div>
  );
}
