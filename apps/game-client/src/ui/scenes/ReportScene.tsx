import type { ClientFactionAdvantagePanel, ClientRaidTarget, ClientReportEntry, ClientSceneAction } from '@trinitywar/shared';
import { ReportCard } from '../ReportCard';
import { RaidTargetCard } from '../raid/RaidTargetCard';
import type { TutorialRaidUiRules } from '../../tutorial/tutorialFlow';

type RaidHubTabKey = 'targets' | 'reports' | 'warrants';

interface ReportSceneProps {
  activeTab: RaidHubTabKey;
  advantage?: ClientFactionAdvantagePanel;
  refreshLabel: string;
  refreshPending: boolean;
  battleUsed: number;
  battleLimit: number;
  refreshUsed: number;
  refreshLimit: number;
  isTutorial: boolean;
  targets: ClientRaidTarget[];
  followedTargetIds: string[];
  reportEntries: ClientReportEntry[];
  uiRules: TutorialRaidUiRules;
  onChangeTab: (tab: RaidHubTabKey) => void;
  onOpenTarget: (target: ClientRaidTarget) => void;
  onToggleFollowTarget: (target: ClientRaidTarget) => void;
  onRefresh: () => void;
  onAction: (action: ClientSceneAction, context?: string) => void;
}

export function ReportScene(props: ReportSceneProps): JSX.Element {
  const {
    activeTab,
    advantage,
    refreshLabel,
    refreshPending,
    battleUsed,
    battleLimit,
    refreshUsed,
    refreshLimit,
    isTutorial,
    targets,
    followedTargetIds,
    reportEntries,
    uiRules,
    onChangeTab,
    onOpenTarget,
    onToggleFollowTarget,
    onRefresh,
    onAction,
  } = props;
  const targetLimit = uiRules.visibleTargetLimit === null ? 3 : uiRules.visibleTargetLimit;
  const visibleTargets = targets.slice(0, targetLimit);

  return (
    <div className="scene-shell">
      {uiRules.showTabs ? (
      <div className="tab-row">
        <button className={`tab-button ${activeTab === 'targets' ? 'active' : ''}`} onClick={() => onChangeTab('targets')} type="button">战斗</button>
        <button className={`tab-button ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => onChangeTab('reports')} type="button">战报</button>
        <button className={`tab-button ${activeTab === 'warrants' ? 'active' : ''}`} onClick={() => onChangeTab('warrants')} type="button">通缉</button>
      </div>
      ) : null}

      {activeTab === 'targets' ? (
        <div className="scene-scroll raid-scene-scroll">
          {advantage && uiRules.showFactionAdvantage ? (
            <article className="panel-card faction-advantage-panel">
              <div className="panel-head">
                <h4>{advantage.factionName}优势</h4>
                <span className="soft-tag">{advantage.title}</span>
              </div>
              <p className="panel-text">{advantage.summary}</p>
              {advantage.details.length > 0 ? (
                <ul className="mini-list">
                  {advantage.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ) : null}
          {uiRules.showToolbar ? (
            <div className="raid-toolbar compact-raid-toolbar">
              <div className="raid-rule-strip" aria-label="探索规则">
                {isTutorial ? (
                  <span>教程目标 · 完成一次战斗后解锁完整探索</span>
                ) : (
                  <>
                    <span>今日战斗 {battleUsed}/{battleLimit}</span>
                    <span>刷新 {refreshUsed}/{refreshLimit}</span>
                    <span>推荐目标 {visibleTargets.length}</span>
                  </>
                )}
              </div>
              <button className="secondary-button" disabled={refreshPending || (!isTutorial && refreshUsed >= refreshLimit)} onClick={onRefresh} type="button">
                {refreshPending ? '刷新中...' : refreshUsed >= refreshLimit && !isTutorial ? '刷新已用完' : refreshLabel}
              </button>
            </div>
          ) : null}

          <div className="raid-list-shell">
            <div className="target-list target-list-raid">
              {visibleTargets.map((target) => (
                <RaidTargetCard
                  followed={followedTargetIds.includes(target.id)}
                  key={target.id}
                  onSelect={onOpenTarget}
                  onToggleFollow={uiRules.allowFollow ? onToggleFollowTarget : undefined}
                  target={target}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'reports' ? (
        <div className="scene-scroll stack-panel compact">
          {reportEntries.map((entry, index) => (
            <ReportCard
              entry={entry}
              key={`${entry.title}-${index}`}
              onAction={onAction}
            />
          ))}
        </div>
      ) : null}

      {activeTab === 'warrants' ? (
        <div className="scene-scroll stack-panel compact">
          <article className="panel-card warrant-placeholder-card">
            <div className="panel-head">
              <h4>通缉内容待定</h4>
              <span className="soft-tag">占位稿</span>
            </div>
            <p className="panel-text">这一栏先预留为通缉模块，后续再按你定的规则补待接受、进行中和已结算内容。</p>
          </article>
          <article className="panel-card warrant-placeholder-card">
            <div className="panel-head">
              <h4>建议先定三块</h4>
            </div>
            <div className="warrant-placeholder-list">
              <div className="warrant-placeholder-item">
                <strong>待接受</strong>
                <span>谁发起、剩余时间、预估收益</span>
              </div>
              <div className="warrant-placeholder-item">
                <strong>进行中</strong>
                <span>参与者、锁定份额、预计结算时间</span>
              </div>
              <div className="warrant-placeholder-item">
                <strong>已结算</strong>
                <span>结果、分成、战损与保护期</span>
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </div>
  );
}
