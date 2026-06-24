import { FullScreenToolShell } from './ModalShell';

interface ContributionLogItem {
  id: string;
  sourceLabel: string;
  contributionDelta: number;
  createdAt: string;
}

interface FactionContributionLogModalProps {
  entries: ContributionLogItem[];
  onClose: () => void;
}

export function FactionContributionLogModal(props: FactionContributionLogModalProps): JSX.Element {
  const { entries, onClose } = props;

  return (
    <FullScreenToolShell
      ariaLabel="今日贡献记录"
      bodyClassName="faction-log-modal-body"
      className="faction-log-modal-screen"
      description="只记录今天已经入账的贡献来源"
      onBack={onClose}
      title="贡献记录"
    >
      {entries.length > 0 ? (
        <div className="faction-log-list">
          {entries.map((entry) => (
            <article className="panel-card faction-log-item" key={entry.id}>
              <div className="faction-log-head">
                <strong>{entry.sourceLabel}</strong>
                <span>{formatLogTime(entry.createdAt)}</span>
              </div>
              <div className="faction-log-gain">
                <span>贡献入账</span>
                <strong>{`+${entry.contributionDelta}`}</strong>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel-card faction-log-empty">
          <p>今天还没有新的贡献记录。</p>
        </div>
      )}
    </FullScreenToolShell>
  );
}

function formatLogTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
