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
    <div className="seed-reward-modal global-unlock-modal" role="status" aria-live="polite">
      <div className="seed-reward-card global-unlock-card">
        <p className="eyebrow">解锁</p>
        <h3>{title}</h3>
        <p>{summary}</p>
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
        <div className="transfer-foot-row seed-reward-actions">
          <button className="secondary-button" onClick={onConfirm} type="button">
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
