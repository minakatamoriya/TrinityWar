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
        <div>
          <h4>{entry.title}</h4>
          <p className="report-tag-row">
            <span className="tag-pill">{entry.tag}</span>
            {entry.unread ? <span className="tag-pill unread">未读</span> : null}
            {entry.revengeable ? <span className="tag-pill revenge">可复仇</span> : null}
          </p>
        </div>
      </div>
      <p className="panel-text">{entry.summary}</p>
      <div className="button-row wrap">
        {entry.actions.map((action) => (
          <ActionButton action={action} key={`${entry.title}-${action.label}`} onClick={(nextAction) => onAction(nextAction, entry.title)} />
        ))}
      </div>
    </article>
  );
}