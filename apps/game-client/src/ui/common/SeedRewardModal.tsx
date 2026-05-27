export interface SeedRewardModalItem {
  seedId?: string;
  itemId?: string;
  quantity: number;
  label?: string;
}

interface SeedRewardModalProps {
  title: string;
  summary: string;
  items: SeedRewardModalItem[];
  confirming: boolean;
  getItemLabel: (item: SeedRewardModalItem) => string;
  onConfirm: () => void;
}

export function SeedRewardModal(props: SeedRewardModalProps): JSX.Element {
  const {
    title,
    summary,
    items,
    confirming,
    getItemLabel,
    onConfirm,
  } = props;

  return (
    <div className="seed-reward-modal" role="status" aria-live="polite">
      <div className="seed-reward-card">
        <p className="eyebrow">{title}</p>
        <h3>{title}</h3>
        {summary ? <p>{summary}</p> : null}
        <div className="seed-reward-list">
          {items.map((item) => (
            <div className="seed-reward-item" key={`${item.seedId ?? item.itemId ?? item.label ?? 'default'}-${item.quantity}`}>
              <strong>{getItemLabel(item)}</strong>
              <span>x {item.quantity}</span>
            </div>
          ))}
        </div>
        <div className="transfer-foot-row seed-reward-actions">
          <button className="secondary-button" disabled={confirming} onClick={onConfirm} type="button">
            {confirming ? '领取中...' : '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}
