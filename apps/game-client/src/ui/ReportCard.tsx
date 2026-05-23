import type { ClientReportEntry, ClientSceneAction } from '@trinitywar/shared';
import { ActionButton } from './ActionButton';

interface ReportCardProps {
  entry: ClientReportEntry;
  onAction: (action: ClientSceneAction, context?: string) => void;
}

export function ReportCard(props: ReportCardProps): JSX.Element {
  const { entry, onAction } = props;
  const resultLabel = entry.tag.split(' · ')[0] || entry.tag;
  const resultToneClass = getResultToneClass(resultLabel);
  const opponentLabel = entry.opponentName ? `对方：${entry.opponentName}` : '对方：未知';
  const timeLabel = entry.occurredAtText ?? new Date(entry.createdAt).toLocaleString('zh-CN', { hour12: false });

  return (
    <article className={`report-card compact-report-card ${entry.tone}`}>
      <div className="report-head">
        <div>
          <h4>{resultLabel}</h4>
          <p className="report-meta-line">{timeLabel} · {opponentLabel}</p>
        </div>
        <p className="report-tag-row">
          <span className={`tag-pill report-result-pill ${resultToneClass}`}>{resultLabel}</span>
          {entry.revengeable ? <span className="tag-pill revenge">可复仇</span> : null}
        </p>
      </div>

      {entry.metrics ? (
        <div className="report-metric-row">
          <span>金币 <strong>{entry.metrics.gold}</strong></span>
          <span>我方伤害 <strong>{entry.metrics.ownDamage}</strong></span>
          <span>对方伤害 <strong>{entry.metrics.opponentDamage}</strong></span>
        </div>
      ) : null}

      {entry.raidMessage ? (
        <p className="report-summary">留言：{entry.raidMessage.messageTextSnapshot}</p>
      ) : null}

      <div className="report-action-row">
        {entry.actions.map((action) => (
          <ActionButton action={action} key={`${entry.title}-${action.label}`} onClick={(nextAction) => onAction(nextAction, nextAction.context ?? entry.title)} />
        ))}
      </div>
    </article>
  );
}

function getResultToneClass(resultLabel: string): string {
  if (resultLabel.includes('完胜')) {
    return 'report-result-complete-win';
  }

  if (resultLabel.includes('大胜')) {
    return 'report-result-big-win';
  }

  if (resultLabel.includes('小胜')) {
    return 'report-result-small-win';
  }

  if (resultLabel.includes('相持')) {
    return 'report-result-draw';
  }

  if (resultLabel.includes('小败')) {
    return 'report-result-small-loss';
  }

  if (resultLabel.includes('大败')) {
    return 'report-result-big-loss';
  }

  if (resultLabel.includes('完败')) {
    return 'report-result-complete-loss';
  }

  return '';
}
