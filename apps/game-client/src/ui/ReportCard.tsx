import type { ClientReportEntry, ClientSceneAction } from '@trinitywar/shared';
import { ActionButton } from './ActionButton';

interface ReportCardProps {
  entry: ClientReportEntry;
  onAction: (action: ClientSceneAction, context?: string) => void;
}

export function ReportCard(props: ReportCardProps): JSX.Element {
  const { entry, onAction } = props;

  return (
    <article className={`report-card ${entry.tone}`}>
      <div className="report-head">
        <h4>{entry.title}</h4>
        <p className="report-tag-row">
          <span className="tag-pill">{entry.tag}</span>
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