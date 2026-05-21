import type { AdminOverviewResponse, AdminSystemStatusResponse } from '@trinitywar/shared';
import { KeyValueTable } from '../components/InfoSection';
import { MetricGrid } from '../components/MetricGrid';
import type { ModuleKey } from '../types';

export function DashboardView(props: {
  metrics: Array<{ label: string; value: string; tone: string }>;
  overview: AdminOverviewResponse | null;
  status: AdminSystemStatusResponse | null;
  onNavigate: (moduleKey: ModuleKey) => void;
}): JSX.Element {
  return (
    <div className="view-stack">
      <MetricGrid metrics={props.metrics} />
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Operations</p>
            <h3>常用排查入口</h3>
          </div>
        </div>
        <div className="quick-grid">
          <button type="button" onClick={() => props.onNavigate('player')}>
            <strong>查询玩家信息</strong>
            <span>查看身份、资产、建筑、田地、任务。</span>
          </button>
          <button type="button" onClick={() => props.onNavigate('order')}>
            <strong>查询订单</strong>
            <span>按订单 ID 查看结算、锁定资产和战报。</span>
          </button>
          <button type="button" onClick={() => props.onNavigate('system')}>
            <strong>检查系统状态</strong>
            <span>查看数据库、worker 和功能开关。</span>
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Backend</p>
            <h3>后台服务摘要</h3>
          </div>
        </div>
        <KeyValueTable rows={[
          { label: '应用', field: 'app', value: props.overview?.app },
          { label: '文档地址', field: 'docs', value: props.overview?.docs },
          { label: '服务时间', field: 'time', value: props.status?.time },
          { label: '已开放模块', field: 'modules', value: props.overview?.modules.join(', ') },
        ]} />
      </section>
    </div>
  );
}
