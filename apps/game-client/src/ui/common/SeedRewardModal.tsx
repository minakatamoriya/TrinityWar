import { CenteredModalShell } from './ModalShell';

export interface SeedRewardModalItem {
  seedId?: string;
  itemId?: string;
  quantity: number;
  label?: string;
}

interface SeedRewardModalProps {
  title: string;
  summary: string;
  footerHint?: string;
  items: SeedRewardModalItem[];
  confirming: boolean;
  getItemLabel: (item: SeedRewardModalItem) => string;
  onConfirm: () => void;
}

export function SeedRewardModal(props: SeedRewardModalProps): JSX.Element {
  const {
    title,
    summary,
    footerHint,
    items,
    confirming,
    getItemLabel,
    onConfirm,
  } = props;

  return (
    <CenteredModalShell
      className="seed-reward-card"
      description={summary}
      footer={(
        <button className="secondary-button" disabled={confirming} onClick={onConfirm} type="button">
          {confirming ? '领取中...' : '确认'}
        </button>
      )}
      title={title}
    >
      <div className="seed-reward-list">
        {items.map((item) => (
          <div className="seed-reward-item" key={`${item.seedId ?? item.itemId ?? item.label ?? 'default'}-${item.quantity}`}>
            <strong>{getItemLabel(item)}</strong>
            <span>x {item.quantity}</span>
          </div>
        ))}
      </div>
      {footerHint ? <p className="seed-reward-hint">{footerHint}</p> : null}
    </CenteredModalShell>
  );
}
