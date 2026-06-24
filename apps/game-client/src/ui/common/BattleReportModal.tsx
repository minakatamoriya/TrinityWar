import type { ClientReportEntry, ClientSceneAction } from '@trinitywar/shared';
import { ReportCard } from '../ReportCard';
import { FullScreenToolShell } from './ModalShell';

interface BattleReportModalProps {
  entries: ClientReportEntry[];
  onAction: (action: ClientSceneAction, context?: string) => void;
  onClose: () => void;
}

export function BattleReportModal(props: BattleReportModalProps): JSX.Element {
  const { entries, onAction, onClose } = props;

  return (
    <FullScreenToolShell
      ariaLabel="战报"
      bodyClassName="battle-report-modal-body"
      className="battle-report-screen"
      description="查看最近的战斗结果、回放与复仇入口"
      onBack={onClose}
      title="战报"
    >
      {entries.length > 0 ? (
        entries.map((entry, index) => (
          <ReportCard
            entry={entry}
            key={`${entry.title}-${entry.createdAt}-${index}`}
            onAction={onAction}
          />
        ))
      ) : (
        <section className="panel-card battle-report-empty-state">
          <p className="eyebrow">暂无新内容</p>
          <h4>当前没有可查看的战报</h4>
          <p className="panel-text">完成一次战斗后，回放、收益与复仇信息都会收进这里。</p>
        </section>
      )}
    </FullScreenToolShell>
  );
}
