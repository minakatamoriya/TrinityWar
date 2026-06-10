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
    season?: {
      config?: Record<string, unknown>;
      session?: Record<string, unknown>;
    };
  };
  rule: Record<string, unknown>;
  stats?: Record<string, unknown>;
  dayReports?: {
    items?: AdminRecord[];
  };
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
  onRunSeasonSimV1Day: () => void;
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
  onStartSeasonSimV1Loop: (input: { intervalSeconds: number; totalDays: number; actionDelayMs?: number }) => void;
  onStopLoop: () => void;
  onStopSeasonSimV1Loop: () => void;
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
  const [seasonTotalDays, setSeasonTotalDays] = useState('28');
  const [seasonIntervalSeconds, setSeasonIntervalSeconds] = useState('1');
  const [seasonActionDelayMs, setSeasonActionDelayMs] = useState('0');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [hiddenLogIds, setHiddenLogIds] = useState<Set<string>>(() => new Set());
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const consoleRef = useRef<HTMLDivElement | null>(null);

  const rule = props.dashboard?.rule ?? {};
  const activityProfiles = toRecordArray(rule.activityProfiles);
  const activityMatrix = toRecordArray(rule.activityMatrix);
  const stats = toRecord(props.dashboard?.stats);
  const statTotals = toRecord(stats.totals);
  const factionStats = toRecordArray(stats.byFaction);
  const playerStats = toRecordArray(stats.players).slice(0, 9);
  const dayReports = toRecordArray(props.dashboard?.dayReports?.items);
  const selectedDayReport = dayReports.find((item) => Number(item.dayIndex) === selectedDayIndex) ?? dayReports[dayReports.length - 1] ?? {};
  const selectedDayTotals = toRecord(selectedDayReport.totals);
  const selectedDayValidation = toRecord(selectedDayReport.validation);
  const selectedDayFactions = toRecordArray(selectedDayReport.byFaction);
  const selectedDayPlayers = toRecordArray(selectedDayReport.players);
  const status = props.dashboard?.status ?? {};
  const loop = toRecord(props.dashboard?.automation?.loop);
  const automationConfig = toRecord(props.dashboard?.automation?.config);
  const automationConfigs = props.dashboard?.automation?.configs?.items ?? [];
  const dailyAutomationConfig = toRecord(automationConfigs.find((item) => String(item.mode ?? '') === 'daily-3') ?? automationConfig);
  const socialAutomationConfig = toRecord(automationConfigs.find((item) => String(item.mode ?? '') === 'social-3'));
  const playerSimAutomationConfig = toRecord(automationConfigs.find((item) => String(item.mode ?? '') === 'player-sim-v1'));
  const seasonAutomationConfig = toRecord(automationConfigs.find((item) => String(item.mode ?? '') === 'season-sim-v1') ?? props.dashboard?.automation?.season?.config);
  const seasonSession = toRecord(props.dashboard?.automation?.season?.session);
  const automationJobs = props.dashboard?.automation?.jobs?.items ?? [];
  const latestRun = toRecord(props.dashboard?.runs?.items?.[0]);
  const issues = props.dashboard?.errorSummary.items ?? [];
  const recentActions = props.dashboard?.recentActions.items ?? [];
  const latestActionId = String(recentActions[0]?.id ?? '');
  const hardIssueCount = Number(status.hardIssueCount ?? status.totalErrorCount ?? 0);
  const progressionBlockCount = Number(status.progressionBlockCount ?? 0);
  const loopRunning = Boolean(loop.running);
  const seasonRunning = Boolean(seasonSession.running);
  const loopMode = String(loop.mode ?? '');
  const latestRunSummary = stringValue(status.latestRunSummary ?? latestRun.summary, '');
  const latestRunMode = status.latestRunMode ?? latestRun.mode;
  const latestRunFinishedAt = status.latestRunFinishedAt ?? latestRun.finishedAt;
  const seasonLastSummary = toRecord(seasonSession.lastSummary);
  const isBusy = props.busy === 'robot-dashboard'
    || props.busy === 'robot-daily-3'
    || props.busy === 'robot-season-day'
    || props.busy === 'robot-player-sim-v1'
    || props.busy === 'robot-social-3'
    || props.busy === 'robot-clear-errors'
    || props.busy === 'robot-config-save'
    || props.busy === 'robot-loop-start'
    || props.busy === 'robot-loop-stop'
    || props.busy === 'robot-season-loop-start'
    || props.busy === 'robot-season-loop-stop';

  const consoleLines = useMemo(() => buildConsoleLines(recentActions, loop, seasonSession, hiddenLogIds), [recentActions, loop, seasonSession, hiddenLogIds]);
  const scrollToBottom = useCallback(() => {
    window.requestAnimationFrame(() => {
      if (consoleRef.current) {
        consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    if (!autoRefresh || (!loopRunning && !seasonRunning)) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      props.onRefresh();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loopRunning, seasonRunning, props]);

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
    if (seasonRunning || Object.keys(seasonAutomationConfig).length <= 0) {
      return;
    }
    setSeasonTotalDays(stringValue(seasonAutomationConfig.maxRounds, '28'));
    setSeasonIntervalSeconds(stringValue(seasonAutomationConfig.intervalSeconds, '1'));
  }, [seasonAutomationConfig, seasonRunning]);

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [autoScroll, latestActionId, consoleLines.length, props.dashboard, scrollToBottom]);

  useEffect(() => {
    if (dayReports.length <= 0) {
      setSelectedDayIndex(null);
      return;
    }
    if (selectedDayIndex && dayReports.some((item) => Number(item.dayIndex) === selectedDayIndex)) {
      return;
    }
    setSelectedDayIndex(Number(dayReports[dayReports.length - 1]?.dayIndex ?? 1));
  }, [dayReports, selectedDayIndex]);

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

  const startSeasonLoop = (): void => {
    props.onStartSeasonSimV1Loop({
      intervalSeconds: Math.max(1, Number(seasonIntervalSeconds) || 1),
      totalDays: Math.max(1, Number(seasonTotalDays) || 28),
      actionDelayMs: Math.max(0, Number(seasonActionDelayMs) || 0),
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
            <button className="ghost-button" disabled={isBusy || loopRunning || seasonRunning} onClick={props.onRunSeasonSimV1Day} type="button">重置后运行第 1 天</button>
            <button className="primary-button" disabled={isBusy || loopRunning || seasonRunning} onClick={startSeasonLoop} type="button">启动赛季模拟</button>
            <button className="ghost-button" disabled={isBusy || !seasonRunning} onClick={props.onStopSeasonSimV1Loop} type="button">停止模拟</button>
            <button className="ghost-button" disabled={props.busy === 'robot-clear-errors'} onClick={props.onClearErrors} type="button">清空问题</button>
            <button className="ghost-button" disabled={issues.length <= 0} onClick={props.onExportErrors} type="button">导出问题</button>
          </div>
        </div>
        <div className="robot-config-grid compact">
          <label>
            赛季天数
            <input disabled={seasonRunning} min="1" onChange={(event) => setSeasonTotalDays(event.target.value)} type="number" value={seasonTotalDays} />
          </label>
          <label>
            日间隔秒数
            <input disabled={seasonRunning} min="1" onChange={(event) => setSeasonIntervalSeconds(event.target.value)} type="number" value={seasonIntervalSeconds} />
          </label>
          <label>
            动作延迟毫秒
            <input disabled={seasonRunning} min="0" onChange={(event) => setSeasonActionDelayMs(event.target.value)} type="number" value={seasonActionDelayMs} />
          </label>
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
          <span>赛季：{seasonRunning ? formatSeasonProgress(seasonSession) : '未运行'}</span>
          <span>已跑轮数：{stringValue(loop.completedRounds, '0')} / {stringValue(loop.maxRounds, '-')}</span>
          <span>下次运行：{formatDateTime(seasonRunning ? seasonSession.nextRunAt : loop.nextRunAt)}</span>
        </div>
      </section>

      <section className="panel robot-run-summary">
        <div className="panel-head compact">
          <div>
            <p className="eyebrow">Run Summary</p>
            <h3>最近统计</h3>
          </div>
          <span className={getJobStatusClass(status.rawState ?? latestRun.status)}>
            {getJobStatusLabel(status.rawState ?? latestRun.status)}
          </span>
        </div>
        <div className="robot-summary-body">
          <p>{latestRunSummary || (seasonRunning ? '赛季模拟正在运行，完成后会生成最终统计。' : '还没有可显示的运行统计。')}</p>
          {seasonRunning ? (
            <div className="robot-summary-live">
              <span>当前进度：{formatSeasonProgress(seasonSession)}</span>
              <span>最近模拟日：{stringValue(seasonLastSummary.dateKey, '-')}</span>
              <span>累计成功：{stringValue(seasonSession.totalSuccessActionCount, '0')}</span>
              <span>累计硬错误：{stringValue(seasonSession.totalFailedActionCount, '0')}</span>
              <span>累计卡点：{stringValue(seasonSession.totalBlockedActionCount, '0')}</span>
            </div>
          ) : null}
        </div>
        <div className="robot-summary-grid">
          <RuleItem label="模式" value={getModeLabel(latestRunMode)} />
          <RuleItem label="最新任务" value={stringValue(status.latestRunId ?? latestRun.id, '-')} />
          <RuleItem label="开始时间" value={formatDateTime(status.latestRunAt ?? latestRun.startedAt)} />
          <RuleItem label="结束时间" value={formatDateTime(latestRunFinishedAt)} />
          <RuleItem label="成功动作" value={stringValue(status.successActionCount ?? latestRun.successActionCount, '0')} />
          <RuleItem label="失败动作" value={stringValue(status.failedActionCount ?? latestRun.failedActionCount, '0')} />
        </div>
        {Number(stats.playerCount ?? 0) > 0 ? (
          <>
            <div className="robot-summary-grid">
              <RuleItem label="快照玩家" value={`${stringValue(stats.playerCount, '0')} 人 / ${stringValue(stats.snapshotCount, '0')} 条快照`} />
              <RuleItem label="金库存量" value={stringValue(statTotals.vaultGold, '0')} />
              <RuleItem label="钱包金币" value={stringValue(statTotals.walletGold, '0')} />
              <RuleItem label="贡献总量" value={stringValue(statTotals.contributionScore, '0')} />
              <RuleItem label="灵根库存" value={stringValue(statTotals.spiritRoot, '0')} />
              <RuleItem label="兽魂材料" value={`普通 ${stringValue(statTotals.ordinarySoul, '0')} / 稀有 ${stringValue(statTotals.rareSoul, '0')} / 传说 ${stringValue(statTotals.legendarySoul, '0')}`} />
            </div>
            <div className="robot-faction-stats">
              {factionStats.map((item) => (
                <article key={stringValue(item.factionCode, 'unknown')}>
                  <strong>{stringValue(item.factionName, getFactionLabel(item.factionCode))}</strong>
                  <span>玩家 {stringValue(item.playerCount, '0')}，金库 {stringValue(item.vaultGold, '0')}，灵根 {stringValue(item.spiritRoot, '0')}</span>
                  <span>动作 成功 {stringValue(item.successActionCount, '0')} / 卡点 {stringValue(item.blockedActionCount, '0')} / 失败 {stringValue(item.failedActionCount, '0')}</span>
                </article>
              ))}
            </div>
            <div className="robot-player-stats">
              {playerStats.map((item) => (
                <article key={stringValue(item.robotKey, '')}>
                  <strong>{stringValue(item.nickname, item.robotKey ? String(item.robotKey) : '-')}（{stringValue(item.factionName, getFactionLabel(item.factionCode))}）</strong>
                  <span>活跃度 {stringValue(item.activityProfileLabel, '-')}，预期动作 {stringValue(item.expectedActionCount, '-')} 次/日</span>
                  <span>金库 {stringValue(item.vaultGold, '0')}，灵宠 Lv.{stringValue(item.mainSpiritLevel, '-')}，阶段 {stringValue(item.mainSpiritStage, '-')}</span>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="panel robot-day-report">
        <div className="panel-head compact">
          <div>
            <p className="eyebrow">Day Report</p>
            <h3>按天统计</h3>
          </div>
          <span className={Boolean(selectedDayValidation.ok) ? 'status-pill ok' : dayReports.length > 0 ? 'status-pill warn' : 'status-pill neutral'}>
            {dayReports.length > 0 ? Boolean(selectedDayValidation.ok) ? '校验通过' : `${stringValue(selectedDayValidation.issueCount, '0')} 个校验问题` : '暂无日报'}
          </span>
        </div>
        {dayReports.length <= 0 ? (
          <div className="empty-block">运行第 1 天验证或 28 天赛季模拟后生成 Day Report。</div>
        ) : (
          <div className="robot-day-layout">
            <div className="robot-day-list">
              {dayReports.map((report) => {
                const validation = toRecord(report.validation);
                const isActive = Number(report.dayIndex) === Number(selectedDayReport.dayIndex);
                return (
                  <button className={isActive ? 'robot-day-tab active' : 'robot-day-tab'} key={stringValue(report.dayIndex, '')} onClick={() => setSelectedDayIndex(Number(report.dayIndex))} type="button">
                    <strong>Day {stringValue(report.dayIndex, '-')}</strong>
                    <span>{stringValue(report.dateKey, '-')}</span>
                    <small>{Boolean(validation.ok) ? 'OK' : `${stringValue(validation.issueCount, '0')} issues`}</small>
                  </button>
                );
              })}
            </div>
            <div className="robot-day-detail">
              <div className="robot-summary-grid">
                <RuleItem label="模拟日" value={`Day ${stringValue(selectedDayReport.dayIndex, '-')} · ${stringValue(selectedDayReport.dateKey, '-')}`} />
                <RuleItem label="快照" value={`${stringValue(selectedDayReport.snapshotCount, '0')} / ${stringValue(selectedDayValidation.expectedPlayers, '9')}`} />
                <RuleItem label="种田收入" value={stringValue(selectedDayTotals.farmGoldIncome, '0')} />
                <RuleItem label="俸禄领取" value={`${stringValue(selectedDayTotals.stipendClaimCount, '0')} 次`} />
                <RuleItem label="投喂次数" value={stringValue(selectedDayTotals.feedCount, '0')} />
                <RuleItem label="好友互助" value={`采摘 ${stringValue(selectedDayTotals.socialHarvestCount, '0')} / 浇水 ${stringValue(selectedDayTotals.socialWaterCount, '0')} / 空转 ${stringValue(selectedDayTotals.socialNoopCount, '0')}`} />
                <RuleItem label="互助收益" value={`${stringValue(selectedDayTotals.socialGoldIncome, '0')} 金币 / ${stringValue(selectedDayTotals.socialShortenedSeconds, '0')} 秒`} />
                <RuleItem label="掠夺" value={`${stringValue(selectedDayTotals.raidWinCount, '0')} 胜 / ${stringValue(selectedDayTotals.raidCount, '0')} 次`} />
                <RuleItem label="A 掠夺收入" value={stringValue(selectedDayTotals.attackerGainGold, '0')} />
                <RuleItem label="B 防守损失" value={stringValue(selectedDayTotals.defenderLostGold, '0')} />
                <RuleItem label="净金币变化" value={stringValue(selectedDayTotals.netGoldDelta, '0')} />
                <RuleItem label="动作" value={`成功 ${stringValue(selectedDayTotals.successActionCount, '0')} / 卡点 ${stringValue(selectedDayTotals.blockedActionCount, '0')} / 失败 ${stringValue(selectedDayTotals.failedActionCount, '0')}`} />
              </div>
              <div className="robot-day-subgrid">
                {selectedDayFactions.map((item) => (
                  <article key={stringValue(item.factionCode, 'unknown')}>
                    <strong>{stringValue(item.factionName, getFactionLabel(item.factionCode))}</strong>
                    <span>{stringValue(item.buffExplanation, '-')}</span>
                    <span>种田 {stringValue(item.farmGoldIncome, '0')}，掠夺收入 {stringValue(item.attackerGainGold, '0')}，防守损失 {stringValue(item.defenderLostGold, '0')}</span>
                    <span>互助采摘 {stringValue(item.socialHarvestCount, '0')}，浇水 {stringValue(item.socialWaterCount, '0')}，收益 {stringValue(item.socialGoldIncome, '0')}</span>
                    <span>灵根 {stringValue(item.stipendSpiritRoot, '0')}，普通/稀有/传说兽魂 {stringValue(item.stipendOrdinarySoul, '0')} / {stringValue(item.stipendRareSoul, '0')} / {stringValue(item.stipendLegendarySoul, '0')}</span>
                  </article>
                ))}
              </div>
              <div className="robot-day-player-table">
                {selectedDayPlayers.map((item) => (
                  <article key={stringValue(item.playerId, '')}>
                    <strong>{stringValue(item.nickname, item.robotKey ? String(item.robotKey) : '-')}（{stringValue(item.factionName, getFactionLabel(item.factionCode))}）</strong>
                    <span>种田 {stringValue(item.farmGoldIncome, '0')}，掠夺 +{stringValue(item.attackerGainGold, '0')} / -{stringValue(item.defenderLostGold, '0')}，净 {stringValue(item.netGoldDelta, '0')}</span>
                    <span>互助采摘 {stringValue(item.socialHarvestCount, '0')}，浇水 {stringValue(item.socialWaterCount, '0')}，空转 {stringValue(item.socialNoopCount, '0')}</span>
                    <span>动作 {stringValue(item.actionCount, '0')} 次，成功 {stringValue(item.successActionCount, '0')}，卡点 {stringValue(item.blockedActionCount, '0')}，失败 {stringValue(item.failedActionCount, '0')}</span>
                    <span>日末灵宠 Lv.{stringValue(toRecord(item.endState).mainSpiritLevel, '-')}，金库 {stringValue(toRecord(item.endState).vaultGold, '0')}</span>
                  </article>
                ))}
              </div>
              {!Boolean(selectedDayValidation.ok) ? (
                <div className="robot-day-issues">
                  {toRecordArray(selectedDayValidation.issues).map((issue, index) => (
                    <span key={`${stringValue(issue.code, 'issue')}-${index}`}>{stringValue(issue.message, stringValue(issue.code, '未知校验问题'))}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <details className="panel legacy-robot-tools">
        <summary>
          <span>
            <strong>旧验证工具</strong>
            <small>日常三阵营、社交助力、勤奋玩家模拟保留为接口冒烟和回归检查</small>
          </span>
          <span className="status-pill neutral">可展开</span>
        </summary>
        <section className="robot-scenario-grid">
          <RobotScenarioPanel
            autoStart={configAutoStart}
            busy={isBusy || seasonRunning}
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
            busy={isBusy || seasonRunning}
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
            busy={isBusy || seasonRunning}
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
      </details>

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
            <h3>{stringValue(rule.name, '勤奋玩家赛季模拟 v1')}</h3>
          </div>
        </div>
        <div className="robot-rule-grid">
          {getRuleItems(rule).map((item) => (
            <RuleItem key={item.key} label={item.label} value={item.value} />
          ))}
        </div>
        {activityProfiles.length > 0 ? (
          <div className="robot-day-subgrid">
            {activityProfiles.map((profile) => (
              <article key={stringValue(profile.key, '')}>
                <strong>{stringValue(profile.label, '-')}</strong>
                <span>{stringValue(profile.description, '-')}</span>
                <span>上线 {formatHourList(profile.loginHours)}，互助 {formatHourList(profile.socialAssistHours)}</span>
                <span>掠夺 {stringValue(profile.raidCount, '0')} 次，预期动作 {stringValue(profile.expectedActionCount, '0')} 次/日</span>
              </article>
            ))}
          </div>
        ) : null}
        {activityMatrix.length > 0 ? (
          <div className="robot-player-stats">
            {activityMatrix.map((item) => (
              <article key={stringValue(item.robotKey, '')}>
                <strong>{stringValue(item.nickname, item.robotKey ? String(item.robotKey) : '-')}（{stringValue(item.factionName, getFactionLabel(item.factionCode))}）</strong>
                <span>活跃度 {stringValue(item.activityProfileLabel, '-')}，上线 {formatHourList(item.loginHours)}</span>
                <span>预期动作 {stringValue(item.expectedActionCount, '0')} 次/日</span>
              </article>
            ))}
          </div>
        ) : null}
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

function buildConsoleLines(actions: Array<Record<string, unknown>>, loop: Record<string, unknown>, seasonSession: Record<string, unknown>, hiddenLogIds: Set<string>): ConsoleLine[] {
  const lines = actions
    .filter((item) => !hiddenLogIds.has(String(item.id ?? '')))
    .slice()
    .reverse()
    .map((item) => {
      const status = String(item.status ?? '');
      const actionName = String(item.actionName ?? '');
      const result = toRecord(item.resultSummaryJson);
      const errorMessage = String(item.errorMessage ?? '');
      const summary = String(result.summary ?? result.sourceSummary ?? '');
      const actor = formatRobotActor(item);
      const target = actionName === 'raid-target' && result.defenderNickname
        ? ` -> ${String(result.defenderNickname)}（${getFactionLabel(result.defenderFactionCode)}）`
        : '';
      return {
        id: String(item.id ?? `${item.runId}-${item.actionName}-${item.createdAt}`),
        at: String(item.createdAt ?? ''),
        tone: getConsoleTone(status),
        text: `${actor}${target}：${getActionLabel(actionName)} ${getStatusLabel(status)}${errorMessage ? `，${getErrorMessageLabel(errorMessage)}` : summary ? `，${summary}` : ''}`,
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

  if (Boolean(seasonSession.running)) {
    const lastSummary = toRecord(seasonSession.lastSummary);
    const runKindLabel = String(seasonSession.runKind ?? '') === 'single-day' ? '单日模拟' : '赛季模拟';
    lines.push({
      id: `season-running-${String(seasonSession.runId ?? '')}-${String(seasonSession.currentDayIndex ?? '0')}`,
      at: String(seasonSession.lastDayAt ?? seasonSession.startedAt ?? ''),
      tone: 'info',
      text: `${runKindLabel}运行中：${formatSeasonProgress(seasonSession)}，最后状态 ${stringValue(seasonSession.lastStatus, '等待执行')}${lastSummary.dateKey ? `，模拟日期 ${String(lastSummary.dateKey)}` : ''}。`,
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

function formatSeasonProgress(seasonSession: Record<string, unknown>): string {
  const completedDays = Math.max(Number(seasonSession.currentDayIndex ?? 0), 0);
  const totalDays = Math.max(Number(seasonSession.totalDays ?? 28), 1);
  if (completedDays <= 0) {
    return `准备第 1 天 / 共 ${totalDays} 天`;
  }
  if (completedDays >= totalDays) {
    return `已完成 ${totalDays} / ${totalDays} 天`;
  }
  return `已完成 ${completedDays} 天，准备第 ${completedDays + 1} 天 / 共 ${totalDays} 天`;
}
function getModeLabel(value: unknown): string {
  const key = String(value ?? '');
  if (key === 'daily-3') return '日常三阵营';
  if (key === 'social-3') return '社交助力';
  if (key === 'player-sim-v1') return '勤奋玩家模拟';
  if (key === 'season-sim-v1') return '赛季模拟';
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

function toRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(toRecord).filter((item) => Object.keys(item).length > 0);
}

function getRuleItems(rule: Record<string, unknown>): Array<{ key: string; label: string; value: string }> {
  const labels: Record<string, string> = {
    robots: '机器人',
    clock: '模拟时钟',
    dailyFlow: '每日流程',
    raidRelation: '掠夺规则',
    factionBuffs: '阵营 BUFF',
    dataPolicy: '统计口径',
  };

  return Object.entries(labels).map(([key, label]) => ({
    key,
    label,
    value: stringValue(rule[key], '-'),
  }));
}

function formatRobotActor(item: Record<string, unknown>): string {
  const factionName = stringValue(item.factionName, getFactionLabel(item.factionCode));
  const nickname = stringValue(item.robotNickname, stringValue(item.robotKey, '-'));
  const role = getRoleLabel(item.robotRole);
  return `${nickname}（${factionName}，${role}）`;
}

function getFactionLabel(value: unknown): string {
  const key = String(value ?? '');
  if (key === 'human') return '人界';
  if (key === 'immortal') return '仙界';
  if (key === 'demon') return '魔界';
  return key || '未知阵营';
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

function formatHourList(value: unknown): string {
  if (!Array.isArray(value)) {
    return '-';
  }
  const hours = value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item))
    .map((item) => `${String(Math.floor(item)).padStart(2, '0')}:00`);
  return hours.length > 0 ? hours.join(' / ') : '-';
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
