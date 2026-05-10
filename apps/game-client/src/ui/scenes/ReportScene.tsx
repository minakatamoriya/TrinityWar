import type { ClientReportEntry, ClientSceneAction } from '@trinitywar/shared';
import { ActionButton } from '../ActionButton';
import { ReportCard } from '../ReportCard';

interface RaidResultState {
  targetName: string;
  summary: string;
  loot: string;
}

interface ReportSceneProps {
  raidResult: RaidResultState | null;
  reportTab: 'defense' | 'attack';
  activeEntries: ClientReportEntry[];
  actions: ClientSceneAction[];
  onDismissResult: () => void;
  onChangeTab: (tab: 'defense' | 'attack') => void;
  onAction: (action: ClientSceneAction, context?: string) => void;
}

export function ReportScene(props: ReportSceneProps): JSX.Element {
  const { raidResult, reportTab, activeEntries, actions, onDismissResult, onChangeTab, onAction } = props;

  return (
    <div className="scene-shell">
      {raidResult ? (
        <article className="hero-panel result-banner">
          <div>
            <p className="eyebrow">最新模拟结果</p>
            <h3>{raidResult.summary}</h3>
            <p className="muted">目标 {raidResult.targetName}，预估收益 {raidResult.loot}。</p>
          </div>
          <button className="ghost-button" onClick={onDismissResult} type="button">
            收起
          </button>
        </article>
      ) : null}

      <div className="tab-row">
        <button className={`tab-button ${reportTab === 'defense' ? 'active' : ''}`} onClick={() => onChangeTab('defense')} type="button">防守战报</button>
        <button className={`tab-button ${reportTab === 'attack' ? 'active' : ''}`} onClick={() => onChangeTab('attack')} type="button">进攻战报</button>
      </div>
      <div className="scene-scroll stack-panel compact">
        {activeEntries.map((entry) => (
          <ReportCard entry={entry} key={`${reportTab}-${entry.title}`} onAction={onAction} />
        ))}
      </div>
      <div className="button-row wrap">
        {actions.map((action) => (
          <ActionButton action={action} key={action.label} onClick={onAction} />
        ))}
      </div>
    </div>
  );
}