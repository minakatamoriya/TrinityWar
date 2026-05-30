import { CenteredModalShell } from './ModalShell';

export interface GlobalUnlockItem {
  id: string;
  label: string;
  kind: 'plant' | 'spirit' | 'feature';
  description?: string;
}

interface GlobalUnlockModalProps {
  title: string;
  summary: string;
  items: GlobalUnlockItem[];
  onConfirm: () => void;
}

const kindLabels: Record<GlobalUnlockItem['kind'], string> = {
  plant: '灵植',
  spirit: '灵宠',
  feature: '功能',
};

export function GlobalUnlockModal(props: GlobalUnlockModalProps): JSX.Element {
  const {
    title,
    summary,
    items,
    onConfirm,
  } = props;

  return (
    <CenteredModalShell
      className="seed-reward-card global-unlock-card"
      description={summary}
      eyebrow="解锁"
      footer={(
        <button className="secondary-button" onClick={onConfirm} type="button">
          确认
        </button>
      )}
      title={title}
    >
      <div className="seed-reward-list global-unlock-list">
        {items.map((item) => (
          <div className="seed-reward-item global-unlock-item" key={item.id}>
            <div>
              <strong>{item.label}</strong>
              {item.description ? <small>{item.description}</small> : null}
            </div>
            <span>{kindLabels[item.kind]}</span>
          </div>
        ))}
      </div>
    </CenteredModalShell>
  );
}
