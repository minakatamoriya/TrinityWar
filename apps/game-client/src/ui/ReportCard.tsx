import type { ClientReportEntry, ClientSceneAction } from '@trinitywar/shared';
import { ActionButton } from './ActionButton';

interface ReportCardProps {
  entry: ClientReportEntry;
  onAction: (action: ClientSceneAction, context?: string) => void;
}

export function ReportCard(props: ReportCardProps): JSX.Element {
  const { entry, onAction } = props;
  const resultToneClass = entry.tag.includes('完胜')
    ? 'report-result-complete-win'
    : entry.tag.includes('大胜')
      ? 'report-result-big-win'
      : entry.tag.includes('小胜')
        ? 'report-result-small-win'
        : entry.tag.includes('相持')
          ? 'report-result-draw'
          : entry.tag.includes('小败')
            ? 'report-result-small-loss'
            : entry.tag.includes('大败')
              ? 'report-result-big-loss'
              : entry.tag.includes('完败')
                ? 'report-result-complete-loss'
                : '';

  return (
    <article className={`report-card ${entry.tone}`}>
      <div className="report-head">
        <h4>{entry.title}</h4>
        <p className="report-tag-row">
          <span className={`tag-pill report-result-pill ${resultToneClass}`}>{entry.tag}</span>
          <span className={`tag-pill ${entry.unread ? 'unread' : 'read'}`}>{entry.unread ? '未读' : '已读'}</span>
          {entry.revengeable ? <span className="tag-pill revenge">可复仇</span> : null}
        </p>
      </div>
      <p className="report-summary">{entry.summary}</p>
      <div className="report-action-row">
        {entry.actions.map((action) => (
          <ActionButton action={action} key={`${entry.title}-${action.label}`} onClick={(nextAction) => onAction(nextAction, entry.title)} />
        ))}
      </div>
    </article>
  );
}
