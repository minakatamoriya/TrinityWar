import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AdminRobotDashboardResponse } from '@trinitywar/shared';
import type { AdminRecord } from '../types';

type RobotDashboardViewModel = AdminRobotDashboardResponse & {
  automation?: {
    loop?: unknown;
    config?: Record<string, unknown>;
    configs?: {
      items?: AdminRecord[];
    };
    jobs?: {
      items?: AdminRecord[];
    };
  };
  rule: Record<string, unknown>;
  status: Record<string, unknown>;
  errorSummary: {
    items: AdminRecord[];
    exportMarkdown: string;
  };
};

type ConsoleLine = {
  id: string;
  at: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  text: string;
};

export function RobotTestView(props: {
  busy: string;
  dashboard: RobotDashboardViewModel | null;
  onClearErrors: () => void;
  onExportErrors: () => void;
  onRefresh: () => void;
  onRunDaily3: () => void;
  onRunPlayerSimV1: () => void;
  onRunSocial3: () => void;
  onSaveAutomationConfig: (input: {
    enabled: boolean;
    intervalSeconds: number;
    maxRounds: number;
    hardErrorLimit: number;
    autoStartOnBoot: boolean;
  }) => void;
  onSaveSocialAutomationConfig: (input: {
    enabled: boolean;
    intervalSeconds: number;
    maxRounds: number;
    hardErrorLimit: number;
    autoStartOnBoot: boolean;
  }) => void;
  onSavePlayerSimV1AutomationConfig: (input: {
    enabled: boolean;
    intervalSeconds: number;
    maxRounds: number;
    hardErrorLimit: number;
    autoStartOnBoot: boolean;
  }) => void;
  onStartLoop: (input: { intervalSeconds: number; maxRounds: number; hardErrorLimit: number }) => void;
  onStartSocialLoop: (input: { intervalSeconds: number; maxRounds: number; hardErrorLimit: number }) => void;
  onStartPlayerSimV1Loop: (input: { intervalSeconds: number; maxRounds: number; hardErrorLimit: number }) => void;
  onStopLoop: () => void;
}): JSX.Element {
  const [configEnabled, setConfigEnabled] = useState(false);
  const [configAutoStart, setConfigAutoStart] = useState(false);
  const [configIntervalSeconds, setConfigIntervalSeconds] = useState('10');
  const [configMaxRounds, setConfigMaxRounds] = useState('20');
  const [configHardErrorLimit, setConfigHardErrorLimit] = useState('3');
  const [configTouched, setConfigTouched] = useState(false);
  const [socialConfigEnabled, setSocialConfigEnabled] = useState(false);
  const [socialConfigAutoStart, setSocialConfigAutoStart] = useState(false);
  const [socialConfigIntervalSeconds, setSocialConfigIntervalSeconds] = useState('10');
  const [socialConfigMaxRounds, setSocialConfigMaxRounds] = useState('20');
  const [socialConfigHardErrorLimit, setSocialConfigHardErrorLimit] = useState('3');
  const [socialConfigTouched, setSocialConfigTouched] = useState(false);
  const [playerSimConfigEnabled, setPlayerSimConfigEnabled] = useState(false);
  const [playerSimConfigAutoStart, setPlayerSimConfigAutoStart] = useState(false);
  const [playerSimConfigIntervalSeconds, setPlayerSimConfigIntervalSeconds] = useState('5');
  const [playerSimConfigMaxRounds, setPlayerSimConfigMaxRounds] = useState('0');
  const [playerSimConfigHardErrorLimit, setPlayerSimConfigHardErrorLimit] = useState('3');
  const [playerSimConfigTouched, setPlayerSimConfigTouched] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [hiddenLogIds, setHiddenLogIds] = useState<Set<string>>(() => new Set());
  const consoleRef = useRef<HTMLDivElement | null>(null);

  const rule = props.dashboard?.rule ?? {};
  const status = props.dashboard?.status ?? {};
  const loop = toRecord(props.dashboard?.automation?.loop);
  const automationConfig = toRecord(props.dashboard?.automation?.config);
  const automationConfigs = props.dashboard?.automation?.configs?.items ?? [];
  const dailyAutomationConfig = toRecord(automationConfigs.find((item) => String(item.mode ?? '') === 'daily-3') ?? automationConfig);
  const socialAutomationConfig = toRecord(automationConfigs.find((item) => String(item.mode ?? '') === 'social-3'));
  const playerSimAutomationConfig = toRecord(automationConfigs.find((item) => String(item.mode ?? '') === 'player-sim-v1'));
  const automationJobs = props.dashboard?.automation?.jobs?.items ?? [];
  const issues = props.dashboard?.errorSummary.items ?? [];
  const recentActions = props.dashboard?.recentActions.items ?? [];
  const latestActionId = String(recentActions[0]?.id ?? '');
  const hardIssueCount = Number(status.hardIssueCount ?? status.totalErrorCount ?? 0);
  const progressionBlockCount = Number(status.progressionBlockCount ?? 0);
  const loopRunning = Boolean(loop.running);
  const loopMode = String(loop.mode ?? '');
  const isBusy = props.busy === 'robot-dashboard'
    || props.busy === 'robot-daily-3'
    || props.busy === 'robot-player-sim-v1'
    || props.busy === 'robot-social-3'
    || props.busy === 'robot-clear-errors'
    || props.busy === 'robot-config-save'
    || props.busy === 'robot-loop-start'
    || props.busy === 'robot-loop-stop';

  const consoleLines = useMemo(() => buildConsoleLines(recentActions, loop, hiddenLogIds), [recentActions, loop, hiddenLogIds]);
  const scrollToBottom = useCallback(() => {
    window.requestAnimationFrame(() => {
      if (consoleRef.current) {
        consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    if (!autoRefresh || !loopRunning) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      props.onRefresh();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loopRunning, props]);

  useEffect(() => {
    if (configTouched || Object.keys(automationConfig).length <= 0) {
      return;
    }
    setConfigEnabled(Boolean(dailyAutomationConfig.enabled));
    setConfigAutoStart(Boolean(dailyAutomationConfig.autoStartOnBoot));
    setConfigIntervalSeconds(stringValue(dailyAutomationConfig.intervalSeconds, '10'));
    setConfigMaxRounds(stringValue(dailyAutomationConfig.maxRounds, '20'));
    setConfigHardErrorLimit(stringValue(dailyAutomationConfig.hardErrorLimit, '3'));
  }, [dailyAutomationConfig, configTouched]);

  useEffect(() => {
    if (socialConfigTouched || Object.keys(socialAutomationConfig).length <= 0) {
      return;
    }
    setSocialConfigEnabled(Boolean(socialAutomationConfig.enabled));
    setSocialConfigAutoStart(Boolean(socialAutomationConfig.autoStartOnBoot));
    setSocialConfigIntervalSeconds(stringValue(socialAutomationConfig.intervalSeconds, '10'));
    setSocialConfigMaxRounds(stringValue(socialAutomationConfig.maxRounds, '20'));
    setSocialConfigHardErrorLimit(stringValue(socialAutomationConfig.hardErrorLimit, '3'));
  }, [socialAutomationConfig, socialConfigTouched]);

  useEffect(() => {
    if (playerSimConfigTouched || Object.keys(playerSimAutomationConfig).length <= 0) {
      return;
    }
    setPlayerSimConfigEnabled(Boolean(playerSimAutomationConfig.enabled));
    setPlayerSimConfigAutoStart(Boolean(playerSimAutomationConfig.autoStartOnBoot));
    setPlayerSimConfigIntervalSeconds(stringValue(playerSimAutomationConfig.intervalSeconds, '5'));
    setPlayerSimConfigMaxRounds(stringValue(playerSimAutomationConfig.maxRounds, '0'));
    setPlayerSimConfigHardErrorLimit(stringValue(playerSimAutomationConfig.hardErrorLimit, '3'));
  }, [playerSimAutomationConfig, playerSimConfigTouched]);

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [autoScroll, latestActionId, consoleLines.length, props.dashboard, scrollToBottom]);

  const startLoop = (): void => {
    props.onStartLoop({
      intervalSeconds: Number(configIntervalSeconds) || 10,
      maxRounds: Number(configMaxRounds) || 20,
      hardErrorLimit: Number(configHardErrorLimit) || 3,
    });
  };

  const startSocialLoop = (): void => {
    props.onStartSocialLoop({
      intervalSeconds: Number(socialConfigIntervalSeconds) || 10,
      maxRounds: Number(socialConfigMaxRounds) || 20,
      hardErrorLimit: Number(socialConfigHardErrorLimit) || 3,
    });
  };

  const startPlayerSimLoop = (): void => {
    props.onStartPlayerSimV1Loop({
      intervalSeconds: Number(playerSimConfigIntervalSeconds) || 5,
      maxRounds: Number(playerSimConfigMaxRounds),
      hardErrorLimit: Number(playerSimConfigHardErrorLimit) || 3,
    });
  };

  const clearConsole = (): void => {
    setHiddenLogIds(new Set(recentActions.map((item) => String(item.id ?? ''))));
  };

  const saveAutomationConfig = (): void => {
    props.onSaveAutomationConfig({
      enabled: configEnabled,
      intervalSeconds: Number(configIntervalSeconds) || 10,
      maxRounds: Number(configMaxRounds) || 20,
      hardErrorLimit: Number(configHardErrorLimit) || 3,
      autoStartOnBoot: configAutoStart,
    });
    setConfigTouched(false);
  };

  const saveSocialAutomationConfig = (): void => {
    props.onSaveSocialAutomationConfig({
      enabled: socialConfigEnabled,
      intervalSeconds: Number(socialConfigIntervalSeconds) || 10,
      maxRounds: Number(socialConfigMaxRounds) || 20,
      hardErrorLimit: Number(socialConfigHardErrorLimit) || 3,
      autoStartOnBoot: socialConfigAutoStart,
    });
    setSocialConfigTouched(false);
  };

  const savePlayerSimAutomationConfig = (): void => {
    props.onSavePlayerSimV1AutomationConfig({
      enabled: playerSimConfigEnabled,
      intervalSeconds: Number(playerSimConfigIntervalSeconds) || 5,
      maxRounds: Number(playerSimConfigMaxRounds),
      hardErrorLimit: Number(playerSimConfigHardErrorLimit) || 3,
      autoStartOnBoot: playerSimConfigAutoStart,
    });
    setPlayerSimConfigTouched(false);
  };

  const markConfigTouched = (): void => {
    setConfigTouched(true);
  };

  const markSocialConfigTouched = (): void => {
    setSocialConfigTouched(true);
  };

  const markPlayerSimConfigTouched = (): void => {
    setPlayerSimConfigTouched(true);
  };

  return (
    <div className="view-stack robot-console">
      <section className="panel robot-hero">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Robot Console</p>
            <h3>机器人测试控制台</h3>
          </div>
          <div className="robot-toolbar">
            <button className="ghost-button" disabled={isBusy} onClick={props.onRefresh} type="button">刷新</button>
            <button className="primary-button" disabled={isBusy || loopRunning} onClick={props.onRunPlayerSimV1} type="button">勤奋模拟 1 轮</button>
            <button className="ghost-button" disabled={props.busy === 'robot-clear-errors'} onClick={props.onClearErrors} type="button">清空问题</button>
            <button className="ghost-button" disabled={issues.length <= 0} onClick={props.onExportErrors} type="button">导出问题</button>
          </div>
        </div>
        <div className="robot-overview">
          <div className={stringValue(status.state, 'IDLE') === 'SUCCESS' && hardIssueCount <= 0 ? 'robot-overview-card ok' : hardIssueCount > 0 ? 'robot-overview-card bad' : 'robot-overview-card neutral'}>
            <span>运行状态</span>
            <strong>{stringValue(status.state, 'IDLE')}</strong>
          </div>
          <div className="robot-overview-card ok">
            <span>成功动作</span>
            <strong>{stringValue(status.successActionCount, '0')}</strong>
          </div>
          <div className={hardIssueCount > 0 ? 'robot-overview-card bad' : 'robot-overview-card neutral'}>
            <span>硬错误</span>
            <strong>{String(hardIssueCount)}</strong>
          </div>
          <div className={progressionBlockCount > 0 ? 'robot-overview-card warn' : 'robot-overview-card neutral'}>
            <span>成长卡点</span>
            <strong>{String(progressionBlockCount)}</strong>
          </div>
        </div>
        <div className="robot-status-line">
          <span>最新任务：{stringValue(status.latestRunId, '-')}</span>
          <span>最后运行：{formatDateTime(status.latestRunAt)}</span>
          <span>循环：{loopRunning ? `${getModeLabel(loopMode)} 运行中` : '未运行'}</span>
          <span>已跑轮数：{stringValue(loop.completedRounds, '0')} / {stringValue(loop.maxRounds, '-')}</span>
          <span>下次运行：{formatDateTime(loop.nextRunAt)}</span>
        </div>
      </section>

      <section className="robot-scenario-grid">
        <RobotScenarioPanel
          autoStart={configAutoStart}
          busy={isBusy}
          configTouched={configTouched}
          enabled={configEnabled}
          hardErrorLimit={configHardErrorLimit}
          loopRunning={loopRunning}
          maxRounds={configMaxRounds}
          mode="daily-3"
          onAutoStartChange={(value) => {
            markConfigTouched();
            setConfigAutoStart(value);
          }}
          onEnabledChange={(value) => {
            markConfigTouched();
            setConfigEnabled(value);
          }}
          onHardErrorLimitChange={(value) => {
            markConfigTouched();
            setConfigHardErrorLimit(value);
          }}
          onIntervalChange={(value) => {
            markConfigTouched();
            setConfigIntervalSeconds(value);
          }}
          onMaxRoundsChange={(value) => {
            markConfigTouched();
            setConfigMaxRounds(value);
          }}
          onRunOnce={props.onRunDaily3}
          onSave={saveAutomationConfig}
          onStartLoop={startLoop}
          onStopLoop={props.onStopLoop}
          intervalSeconds={configIntervalSeconds}
          updatedAt={dailyAutomationConfig.updatedAt}
        />
        <RobotScenarioPanel
          autoStart={socialConfigAutoStart}
          busy={isBusy}
          configTouched={socialConfigTouched}
          enabled={socialConfigEnabled}
          hardErrorLimit={socialConfigHardErrorLimit}
          loopRunning={loopRunning}
          maxRounds={socialConfigMaxRounds}
          mode="social-3"
          onAutoStartChange={(value) => {
            markSocialConfigTouched();
            setSocialConfigAutoStart(value);
          }}
          onEnabledChange={(value) => {
            markSocialConfigTouched();
            setSocialConfigEnabled(value);
          }}
          onHardErrorLimitChange={(value) => {
            markSocialConfigTouched();
            setSocialConfigHardErrorLimit(value);
          }}
          onIntervalChange={(value) => {
            markSocialConfigTouched();
            setSocialConfigIntervalSeconds(value);
          }}
          onMaxRoundsChange={(value) => {
            markSocialConfigTouched();
            setSocialConfigMaxRounds(value);
          }}
          onRunOnce={props.onRunSocial3}
          onSave={saveSocialAutomationConfig}
          onStartLoop={startSocialLoop}
          onStopLoop={props.onStopLoop}
          intervalSeconds={socialConfigIntervalSeconds}
          updatedAt={socialAutomationConfig.updatedAt}
        />
        <RobotScenarioPanel
          autoStart={playerSimConfigAutoStart}
          busy={isBusy}
          configTouched={playerSimConfigTouched}
          enabled={playerSimConfigEnabled}
          hardErrorLimit={playerSimConfigHardErrorLimit}
          loopRunning={loopRunning}
          maxRounds={playerSimConfigMaxRounds}
          mode="player-sim-v1"
          onAutoStartChange={(value) => {
            markPlayerSimConfigTouched();
            setPlayerSimConfigAutoStart(value);
          }}
          onEnabledChange={(value) => {
            markPlayerSimConfigTouched();
            setPlayerSimConfigEnabled(value);
          }}
          onHardErrorLimitChange={(value) => {
            markPlayerSimConfigTouched();
            setPlayerSimConfigHardErrorLimit(value);
          }}
          onIntervalChange={(value) => {
            markPlayerSimConfigTouched();
            setPlayerSimConfigIntervalSeconds(value);
          }}
          onMaxRoundsChange={(value) => {
            markPlayerSimConfigTouched();
            setPlayerSimConfigMaxRounds(value);
          }}
          onRunOnce={props.onRunPlayerSimV1}
          onSave={savePlayerSimAutomationConfig}
          onStartLoop={startPlayerSimLoop}
          onStopLoop={props.onStopLoop}
          intervalSeconds={playerSimConfigIntervalSeconds}
          updatedAt={playerSimAutomationConfig.updatedAt}
        />
      </section>

      <section className="panel">
        <div className="panel-head compact">
          <div>
            <p className="eyebrow">History</p>
            <h3>自动任务历史</h3>
          </div>
        </div>
        {automationJobs.length <= 0 ? (
          <div className="empty-block">还没有后台自动循环任务。</div>
        ) : (
          <div className="robot-job-list">
            {automationJobs.map((job) => (
              <article className="robot-job-row" key={String(job.id ?? '')}>
                <div>
                  <strong>{stringValue(job.name, '机器人循环任务')}</strong>
                  <span>{formatDateTime(job.startedAt)} 至 {formatDateTime(job.stoppedAt)}</span>
                </div>
                <div className="robot-job-meta">
                  <span className={getJobStatusClass(job.status)}>{getJobStatusLabel(job.status)}</span>
                  <span>轮数 {stringValue(job.completedRounds, '0')} / {stringValue(job.maxRounds, '-')}</span>
                  <span>硬错误 {stringValue(job.consecutiveHardErrors, '0')} / {stringValue(job.hardErrorLimit, '-')}</span>
                  <span>{stringValue(job.stopReason, '-')}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head compact">
          <div>
            <p className="eyebrow">Live Log</p>
            <h3>运行控制台</h3>
          </div>
          <div className="inline-form">
            <label className="checkbox-line">
              <input checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} type="checkbox" />
              <span>自动刷新</span>
            </label>
            <label className="checkbox-line">
              <input checked={autoScroll} onChange={(event) => setAutoScroll(event.target.checked)} type="checkbox" />
              <span>自动滚动</span>
            </label>
            <button className="ghost-button" onClick={scrollToBottom} type="button">滚到底部</button>
            <button className="ghost-button" disabled={recentActions.length <= 0} onClick={clearConsole} type="button">清空控制台</button>
          </div>
        </div>
        <div className="robot-log-hint">最新消息在底部。自动滚动开启时，每次刷新都会跳到最新日志。</div>
        <div className="robot-log-console" ref={consoleRef}>
          {consoleLines.length <= 0 ? (
            <div className="robot-log-empty">等待机器人任务运行。</div>
          ) : consoleLines.map((line) => (
            <div className={`robot-log-line ${line.tone}`} key={line.id}>
              <span>{formatTime(line.at)}</span>
              <strong>{line.text}</strong>
            </div>
          ))}
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

function RobotScenarioPanel(props: {
  autoStart: boolean;
  busy: boolean;
  configTouched: boolean;
  enabled: boolean;
  hardErrorLimit: string;
  intervalSeconds: string;
  loopRunning: boolean;
  maxRounds: string;
  mode: 'daily-3' | 'social-3' | 'player-sim-v1';
  onAutoStartChange: (value: boolean) => void;
  onEnabledChange: (value: boolean) => void;
  onHardErrorLimitChange: (value: string) => void;
  onIntervalChange: (value: string) => void;
  onMaxRoundsChange: (value: string) => void;
  onRunOnce: () => void;
  onSave: () => void;
  onStartLoop: () => void;
  onStopLoop: () => void;
  updatedAt: unknown;
}): JSX.Element {
  return (
    <section className="panel robot-scenario-card">
      <div className="panel-head compact">
        <div>
          <p className="eyebrow">{props.mode}</p>
          <h3>{getModeLabel(props.mode)}</h3>
        </div>
        <span className={props.enabled && props.autoStart ? 'status-pill ok' : props.enabled ? 'status-pill warn' : 'status-pill neutral'}>
          {props.enabled && props.autoStart ? '自启' : props.enabled ? '启用' : '关闭'}
        </span>
      </div>
      <div className="robot-scenario-actions">
        <button className="primary-button" disabled={props.busy || props.loopRunning} onClick={props.onRunOnce} type="button">跑 1 轮</button>
        <button className="ghost-button" disabled={props.busy || props.loopRunning} onClick={props.onStartLoop} type="button">开始循环</button>
        <button className="ghost-button" disabled={props.busy || !props.loopRunning} onClick={props.onStopLoop} type="button">停止循环</button>
      </div>
      <div className="robot-toggle-row">
        <label className="checkbox-line">
          <input checked={props.enabled} onChange={(event) => props.onEnabledChange(event.target.checked)} type="checkbox" />
          <span>启用调度</span>
        </label>
        <label className="checkbox-line">
          <input checked={props.autoStart} onChange={(event) => props.onAutoStartChange(event.target.checked)} type="checkbox" />
          <span>服务启动后自动开始</span>
        </label>
      </div>
      <div className="robot-config-grid compact">
        <label className="field compact-field">
          <span>间隔秒数</span>
          <input min="3" onChange={(event) => props.onIntervalChange(event.target.value)} type="number" value={props.intervalSeconds} />
        </label>
        <label className="field compact-field">
          <span>最大轮数</span>
          <input min="0" onChange={(event) => props.onMaxRoundsChange(event.target.value)} type="number" value={props.maxRounds} />
        </label>
        <label className="field compact-field">
          <span>硬错误阈值</span>
          <input max="20" min="1" onChange={(event) => props.onHardErrorLimitChange(event.target.value)} type="number" value={props.hardErrorLimit} />
        </label>
      </div>
      <div className="robot-card-footer">
        <span>更新：{formatDateTime(props.updatedAt)}</span>
        <button className="primary-button" disabled={props.busy || !props.configTouched} onClick={props.onSave} type="button">保存调度</button>
      </div>
    </section>
  );
}

function buildConsoleLines(actions: Array<Record<string, unknown>>, loop: Record<string, unknown>, hiddenLogIds: Set<string>): ConsoleLine[] {
  const lines = actions
    .filter((item) => !hiddenLogIds.has(String(item.id ?? '')))
    .slice()
    .reverse()
    .map((item) => {
      const status = String(item.status ?? '');
      const actionName = String(item.actionName ?? '');
      const role = String(item.robotRole ?? '');
      const result = toRecord(item.resultSummaryJson);
      const errorMessage = String(item.errorMessage ?? '');
      const summary = String(result.summary ?? result.sourceSummary ?? '');
      return {
        id: String(item.id ?? `${item.runId}-${item.actionName}-${item.createdAt}`),
        at: String(item.createdAt ?? ''),
        tone: getConsoleTone(status),
        text: `${getRoleLabel(role)}：${getActionLabel(actionName)} ${getStatusLabel(status)}${errorMessage ? `，${getErrorMessageLabel(errorMessage)}` : summary ? `，${summary}` : ''}`,
      };
    });

  const loopStartedAt = String(loop.startedAt ?? '');
  if (Boolean(loop.running) && loopStartedAt) {
    lines.push({
      id: `loop-running-${loopStartedAt}-${String(loop.completedRounds ?? '0')}`,
      at: loopStartedAt,
      tone: 'info',
      text: `循环任务运行中：已跑 ${stringValue(loop.completedRounds, '0')} / ${stringValue(loop.maxRounds, '-')} 轮，下次运行 ${formatDateTime(loop.nextRunAt)}。`,
    });
  } else if (loop.stoppedAt) {
    lines.push({
      id: `loop-stopped-${String(loop.stoppedAt)}`,
      at: String(loop.stoppedAt),
      tone: 'info',
      text: `循环任务已停止：${stringValue(loop.stopReason, '未知原因')}。`,
    });
  }

  return lines.slice(-100);
}

function getConsoleTone(status: string): ConsoleLine['tone'] {
  if (status === 'SUCCESS') return 'success';
  if (status === 'BLOCKED') return 'warning';
  if (status === 'FAILED') return 'error';
  return 'info';
}

function getStatusLabel(status: string): string {
  if (status === 'SUCCESS') return '成功';
  if (status === 'BLOCKED') return '卡点';
  if (status === 'FAILED') return '失败';
  return status || '-';
}

function getModeLabel(value: unknown): string {
  const key = String(value ?? '');
  if (key === 'daily-3') return '日常三阵营';
  if (key === 'social-3') return '社交助力';
  if (key === 'player-sim-v1') return '勤奋玩家模拟';
  return key || '-';
}

function stringValue(value: unknown, fallback: string): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return String(value);
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function getRoleLabel(value: unknown): string {
  const key = String(value ?? '');
  if (key === 'farmer') return '种田';
  if (key === 'spirit') return '养宠';
  if (key === 'raid') return '掠夺';
  if (key === 'daily') return '日常循环';
  if (key === 'social') return '社交';
  if (key === 'sim') return '勤奋玩家';
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
  if (key === 'friend-link') return '好友关系';
  if (key === 'friend-field-assist') return '灵田助力';
  if (key === 'recruit-army') return '练兵';
  if (key === 'farmer') return '种田';
  if (key === 'spirit') return '养宠';
  if (key === 'raid') return '掠夺';
  if (key === 'social') return '社交';
  if (key === 'sim') return '勤奋玩家';
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

function getJobStatusLabel(value: unknown): string {
  const key = String(value ?? '');
  if (key === 'RUNNING') return '运行中';
  if (key === 'COMPLETED') return '已完成';
  if (key === 'FAILED') return '已失败';
  if (key === 'STOPPED') return '已停止';
  if (key === 'INTERRUPTED') return '已中断';
  return key || '-';
}

function getJobStatusClass(value: unknown): string {
  const key = String(value ?? '');
  if (key === 'COMPLETED') return 'status-pill ok';
  if (key === 'FAILED' || key === 'INTERRUPTED') return 'status-pill bad';
  if (key === 'RUNNING') return 'status-pill warn';
  return 'status-pill neutral';
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

function formatTime(value: unknown): string {
  const text = String(value ?? '');
  if (!text) {
    return '--:--:--';
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}
