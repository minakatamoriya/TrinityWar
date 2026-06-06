import type { AdminRobotDashboardResponse } from '@trinitywar/shared';
import type { AdminRecord } from '../types';

type RobotDashboardViewModel = AdminRobotDashboardResponse & {
  rule: Record<string, unknown>;
  status: Record<string, unknown>;
  errorSummary: {
    items: AdminRecord[];
    exportMarkdown: string;
  };
};

export function RobotTestView(props: {
  busy: string;
  dashboard: RobotDashboardViewModel | null;
  onClearErrors: () => void;
  onExportErrors: () => void;
  onRefresh: () => void;
  onRunDaily3: () => void;
}): JSX.Element {
  const rule = props.dashboard?.rule ?? {};
  const status = props.dashboard?.status ?? {};
  const issues = props.dashboard?.errorSummary.items ?? [];
  const hardIssueCount = Number(status.hardIssueCount ?? status.totalErrorCount ?? 0);
  const progressionBlockCount = Number(status.progressionBlockCount ?? 0);
  const isBusy = props.busy === 'robot-dashboard' || props.busy === 'robot-daily-3' || props.busy === 'robot-clear-errors';

  return (
    <div className="view-stack robot-console">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Robot Console</p>
            <h3>机器人测试控制台</h3>
          </div>
          <div className="inline-form">
            <button className="primary-button" disabled={props.busy === 'robot-daily-3'} onClick={props.onRunDaily3} type="button">开始 daily-3 一轮</button>
            <button className="ghost-button" disabled={isBusy} onClick={props.onRefresh} type="button">刷新</button>
            <button className="ghost-button" disabled={props.busy === 'robot-clear-errors'} onClick={props.onClearErrors} type="button">清空问题</button>
            <button className="ghost-button" disabled={issues.length <= 0} onClick={props.onExportErrors} type="button">导出问题</button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head compact">
          <div>
            <p className="eyebrow">Rule</p>
            <h3>{stringValue(rule.name, '3 阵营日常循环')}</h3>
          </div>
        </div>
        <div className="robot-rule-grid">
          <RuleItem label="机器人" value={stringValue(rule.robots, '-')} />
          <RuleItem label="行为" value={stringValue(rule.actions, '-')} />
          <RuleItem label="掠夺关系" value={stringValue(rule.raidRelation, '-')} />
          <RuleItem label="成熟处理" value={stringValue(rule.maturityPolicy, '-')} />
          <RuleItem label="资源来源" value={stringValue(rule.resourcePolicy, '-')} />
        </div>
      </section>

      <section className="panel">
        <div className="metric-grid compact">
          <div className={stringValue(status.state, 'IDLE') === 'SUCCESS' && hardIssueCount <= 0 ? 'metric-card ok' : hardIssueCount > 0 ? 'metric-card bad' : 'metric-card neutral'}>
            <span>运行状态</span>
            <strong>{stringValue(status.state, 'IDLE')}</strong>
          </div>
          <div className="metric-card ok">
            <span>成功动作</span>
            <strong>{stringValue(status.successActionCount, '0')}</strong>
          </div>
          <div className={hardIssueCount > 0 ? 'metric-card bad' : 'metric-card neutral'}>
            <span>硬错误</span>
            <strong>{String(hardIssueCount)}</strong>
          </div>
          <div className={progressionBlockCount > 0 ? 'metric-card warn' : 'metric-card neutral'}>
            <span>成长卡点</span>
            <strong>{String(progressionBlockCount)}</strong>
          </div>
        </div>
        <div className="robot-status-line">
          <span>最新任务：{stringValue(status.latestRunId, '-')}</span>
          <span>最后运行：{formatDateTime(status.latestRunAt)}</span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head compact">
          <div>
            <p className="eyebrow">Issues</p>
            <h3>问题收集箱</h3>
          </div>
          <span className={hardIssueCount > 0 ? 'status-pill bad' : progressionBlockCount > 0 ? 'status-pill warn' : 'status-pill ok'}>
            {issues.length > 0 ? `${issues.length} 类问题` : '无问题'}
          </span>
        </div>
        {issues.length <= 0 ? (
          <div className="empty-block">当前没有机器人问题。</div>
        ) : (
          <div className="robot-error-list">
            {issues.map((issue: AdminRecord, index: number) => (
              <article className={`robot-error-card ${getIssueClass(issue.issueType)}`} key={`${stringValue(issue.robotRole, '-')}-${stringValue(issue.actionName, '-')}-${index}`}>
                <div>
                  <p className="eyebrow">{getIssueTypeLabel(issue.issueType)} {index + 1}</p>
                  <h4>{getActionLabel(issue.actionName)} · {getErrorCodeLabel(issue.errorCode)}</h4>
                </div>
                <p>{getErrorMessageLabel(issue.errorMessage)}</p>
                <div className="robot-error-meta">
                  <span>严重程度：{getSeverityLabel(issue.severity)}</span>
                  <span>角色：{getRoleLabel(issue.robotRole)}</span>
                  <span>次数：{stringValue(issue.count, '0')}</span>
                  <span>最近：{formatDateTime(issue.lastSeenAt)}</span>
                </div>
                <div className="robot-issue-suggestion">{stringValue(issue.suggestion, '等待后续观察。')}</div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RuleItem(props: { label: string; value: string }): JSX.Element {
  return (
    <div className="robot-rule-item">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function stringValue(value: unknown, fallback: string): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return String(value);
}

function getRoleLabel(value: unknown): string {
  const key = String(value ?? '');
  if (key === 'farmer') return '种田';
  if (key === 'spirit') return '养宠';
  if (key === 'raid') return '掠夺';
  if (key === 'daily') return '日常循环';
  return key || '-';
}

function getActionLabel(value: unknown): string {
  const key = String(value ?? '');
  if (key === 'collect-field') return '收菜';
  if (key === 'start-cultivation') return '种植';
  if (key === 'claim-faction-stipend') return '领取俸禄';
  if (key === 'buy-spirit-soul') return '购买升级兽魂';
  if (key === 'upgrade-spirit') return '灵宠升级';
  if (key === 'breakthrough-spirit') return '灵宠突破';
  if (key === 'spirit-growth') return '灵宠成长';
  if (key === 'set-main-spirit') return '设置主宠';
  if (key === 'raid-target') return '发起掠夺';
  if (key === 'farmer') return '种田';
  if (key === 'spirit') return '养宠';
  if (key === 'raid') return '掠夺';
  return key || '-';
}

function getErrorCodeLabel(value: unknown): string {
  const key = String(value ?? '');
  if (key === 'CONFLICT') return '状态冲突';
  if (key === 'PROGRESSION_BLOCK') return '成长卡点';
  if (key === 'INSUFFICIENT_RESOURCE') return '资源不足';
  if (key === 'INSUFFICIENT_SPIRIT_SOUL') return '兽魂不足';
  if (key === 'RAID_NOT_ALLOWED') return '掠夺受限';
  if (key === 'STATE_VERSION_CONFLICT') return '状态版本冲突';
  if (key === 'ROBOT_ACTION_FAILED') return '机器人动作失败';
  return key || '-';
}

function getIssueTypeLabel(value: unknown): string {
  const key = String(value ?? '');
  if (key === 'system_error') return '系统错误';
  if (key === 'rule_error') return '规则错误';
  if (key === 'progression_block') return '成长卡点';
  return '问题';
}

function getSeverityLabel(value: unknown): string {
  const key = String(value ?? '');
  if (key === 'observe') return '观察';
  if (key === 'warning') return '警告';
  if (key === 'error') return '错误';
  return key || '-';
}

function getIssueClass(value: unknown): string {
  const key = String(value ?? '');
  if (key === 'progression_block') return 'progression';
  if (key === 'rule_error') return 'warning';
  return 'error';
}

function getErrorMessageLabel(value: unknown): string {
  const text = String(value ?? '');
  if (text === 'Insufficient spirit soul.') return '升级兽魂不足，当前无法继续升级灵宠。';
  if (text === 'Target is under raid protection.') return '目标处于保护期，当前不能发起掠夺。';
  if (text === 'fieldVersion conflict.') return '田地状态版本已变化，需要刷新后重试。';
  return text || '-';
}

function formatDateTime(value: unknown): string {
  const text = String(value ?? '');
  if (!text) {
    return '-';
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}
