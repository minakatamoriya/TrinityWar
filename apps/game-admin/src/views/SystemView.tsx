import type { AdminListResponse, AdminOverviewResponse, AdminSystemStatusResponse } from '@trinitywar/shared';
import { InfoSection } from '../components/InfoSection';
import { MetricGrid } from '../components/MetricGrid';
import { TableSection } from '../components/TableSection';
import { getLabel } from '../domain/labels';
import type { AdminRecord } from '../types';

export function SystemView(props: {
  auditAction: string;
  auditLogs: AdminListResponse<AdminRecord> | null;
  auditTargetId: string;
  busy: string;
  onAuditActionChange: (value: string) => void;
  onAuditPageChange: (page: number) => void;
  onAuditRefresh: () => void;
  onAuditTargetIdChange: (value: string) => void;
  overview: AdminOverviewResponse | null;
  status: AdminSystemStatusResponse | null;
}): JSX.Element {
  return (
    <div className="view-stack">
      <MetricGrid metrics={[
        { label: '数据库', value: props.status?.database.status ?? '-', tone: props.status?.database.status === 'up' ? 'ok' : 'bad' },
        { label: '环境', value: props.status?.environment ?? '-', tone: 'neutral' },
        { label: '版本', value: props.status?.version ?? '-', tone: 'neutral' },
        { label: '调试 Key', value: props.status?.featureFlags.adminDebugKeyEnabled ? '已启用' : '未启用', tone: props.status?.featureFlags.adminDebugKeyEnabled ? 'ok' : 'neutral' },
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
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Audit</p>
            <h3>后台审计记录</h3>
          </div>
          <div className="inline-form audit-filter-form">
            <input
              onChange={(event) => props.onAuditTargetIdChange(event.target.value)}
              placeholder="目标 ID / 玩家 ID"
              value={props.auditTargetId}
            />
            <input
              onChange={(event) => props.onAuditActionChange(event.target.value)}
              placeholder="动作，例如 adjust-player-resources"
              value={props.auditAction}
            />
            <button className="primary-button" disabled={props.busy === 'audit-logs'} onClick={props.onAuditRefresh} type="button">查询</button>
          </div>
        </div>
      </section>
      <TableSection
        title="最近审计"
        columns={[
          { label: '时间 / createdAt', key: 'createdAt' },
          { label: '动作 / action', key: 'action' },
          { label: '目标类型 / targetType', key: 'targetType' },
          { label: '目标 ID / targetId', key: 'targetId' },
          { label: '原因 / reason', key: 'reason' },
          { label: '操作者 / adminActor', key: 'adminActor' },
          { label: '附加信息 / metadataJson', key: 'metadataJson' },
        ]}
        rows={props.auditLogs?.items ?? []}
        pagination={props.auditLogs?.pagination ?? null}
        paginationBusy={props.busy === 'audit-logs'}
        onPageChange={props.onAuditPageChange}
      />
    </div>
  );
}
