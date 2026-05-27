import type { ClientFactionAdvantagePanel, ClientRaidTarget, ClientReportEntry, ClientSceneAction } from '@trinitywar/shared';
import { ReportCard } from '../ReportCard';
import { RaidTargetCard } from '../raid/RaidTargetCard';

type RaidHubTabKey = 'targets' | 'follows' | 'reports' | 'warrants';

interface FollowedRaidTargetRow {
  id: string;
  name: string;
  faction: string;
}

interface ReportSceneProps {
  activeTab: RaidHubTabKey;
  advantage?: ClientFactionAdvantagePanel;
  heroTitle: string;
  refreshLabel: string;
  refreshPending: boolean;
  targets: ClientRaidTarget[];
  followedTargetIds: string[];
  followedTargets: FollowedRaidTargetRow[];
  reportEntries: ClientReportEntry[];
  onChangeTab: (tab: RaidHubTabKey) => void;
  onOpenTarget: (target: ClientRaidTarget) => void;
  onOpenFollowedTarget: (target: FollowedRaidTargetRow) => void;
  onToggleFollowTarget: (target: ClientRaidTarget) => void;
  onRefresh: () => void;
  onAction: (action: ClientSceneAction, context?: string) => void;
}

export function ReportScene(props: ReportSceneProps): JSX.Element {
  const {
    activeTab,
    advantage,
    heroTitle,
    refreshLabel,
    refreshPending,
    targets,
    followedTargetIds,
    followedTargets,
    reportEntries,
    onChangeTab,
    onOpenTarget,
    onOpenFollowedTarget,
    onToggleFollowTarget,
    onRefresh,
    onAction,
  } = props;

  return (
    <div className="scene-shell">
      <div className="tab-row">
        <button className={`tab-button ${activeTab === 'targets' ? 'active' : ''}`} onClick={() => onChangeTab('targets')} type="button">掠夺</button>
        <button className={`tab-button ${activeTab === 'follows' ? 'active' : ''}`} onClick={() => onChangeTab('follows')} type="button">关注</button>
        <button className={`tab-button ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => onChangeTab('reports')} type="button">战报</button>
        <button className={`tab-button ${activeTab === 'warrants' ? 'active' : ''}`} onClick={() => onChangeTab('warrants')} type="button">通缉令</button>
      </div>

      {activeTab === 'targets' ? (
        <div className="scene-scroll raid-scene-scroll">
          {advantage ? (
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
          <div className="raid-toolbar panel-card compact-raid-toolbar">
            <p className="raid-toolbar-text">{heroTitle}</p>
            <button className="secondary-button" disabled={refreshPending} onClick={onRefresh} type="button">
              {refreshPending ? '刷新中...' : refreshLabel}
            </button>
          </div>

          <div className="raid-list-shell">
            <div className="target-list target-list-raid">
              {targets.map((target) => (
                <RaidTargetCard
                  followed={followedTargetIds.includes(target.id)}
                  key={target.id}
                  onSelect={onOpenTarget}
                  onToggleFollow={onToggleFollowTarget}
                  target={target}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'follows' ? (
        <div className="scene-scroll stack-panel compact">
          {followedTargets.length > 0 ? (
            <div className="followed-target-list">
              {followedTargets.map((target) => (
                <button className="followed-target-row" key={target.id} onClick={() => onOpenFollowedTarget(target)} type="button">
                  <span className="followed-target-faction">{target.faction}</span>
                  <strong>{target.name}</strong>
                </button>
              ))}
            </div>
          ) : (
            <article className="panel-card followed-target-empty">
              <div className="panel-head">
                <h4>当前还没有关注目标</h4>
              </div>
              <p className="panel-text">先在掠夺或复仇详情里点击关注，之后会收进这里，便于反复观察田地和金币状态。</p>
            </article>
          )}
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
              <h4>通缉令内容待定</h4>
              <span className="soft-tag">占位稿</span>
            </div>
            <p className="panel-text">这一栏先预留为通缉令模块，后续再按你定的规则补待接受、进行中和已结算内容。</p>
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
