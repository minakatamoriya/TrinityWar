import { FullScreenToolShell } from './ModalShell';

export interface BackpackResourceItem {
  id: string;
  label: string;
  quantity: number;
  group: 'spirit' | 'soul' | 'raid-shard' | 'farm' | 'other';
  rarity?: 'common' | 'rare' | 'legendary';
  description?: string;
}

interface ResourceBackpackModalProps {
  items: BackpackResourceItem[];
  formatNumber: (value: number) => string;
  onClose: () => void;
}

const groupLabels: Record<BackpackResourceItem['group'], string> = {
  spirit: '灵宠养成材料',
  soul: '兽魂突破材料',
  'raid-shard': '灵宠精魄',
  farm: '农田资源',
  other: '其他资源',
};

const groupOrder: BackpackResourceItem['group'][] = ['spirit', 'soul', 'raid-shard', 'farm', 'other'];

export function ResourceBackpackModal(props: ResourceBackpackModalProps): JSX.Element {
  const {
    items,
    formatNumber,
    onClose,
  } = props;

  return (
    <FullScreenToolShell
      ariaLabel="我的资源"
      bodyClassName="resource-backpack-body"
      className="resource-backpack-screen"
      description="查看当前拥有的灵宠材料、灵宠精魄和其他资源"
      onBack={onClose}
      title="我的资源"
    >
        {groupOrder.map((group) => {
          const groupItems = items.filter((item) => item.group === group);
          if (groupItems.length <= 0) {
            return null;
          }

          return (
            <section className="panel-card backpack-group-card" key={group}>
              <div className="seed-codex-rarity-head">
                <strong>{groupLabels[group]}</strong>
              </div>
              <div className="backpack-item-grid">
                {groupItems.map((item) => (
                  <article className={`backpack-item-card backpack-rarity-${item.rarity ?? 'common'}`} key={item.id}>
                    <div className="backpack-item-icon" aria-hidden="true">{item.label.slice(0, 1)}</div>
                    <div>
                      <strong>{item.label}</strong>
                    </div>
                    <em>x{formatNumber(item.quantity)}</em>
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        {items.length <= 0 ? (
          <section className="seed-codex-detail-card resource-backpack-empty">
            <p className="seed-codex-undiscovered-text">暂无资源</p>
          </section>
        ) : null}
    </FullScreenToolShell>
  );
}
