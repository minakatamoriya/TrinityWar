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
  'raid-shard': '掠夺精魄',
  farm: '田地精华',
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
    <section className="seed-codex-screen resource-backpack-screen" role="dialog" aria-modal="true" aria-label="我的资源">
      <div className="seed-codex-topbar">
        <div className="seed-codex-title-block">
          <p className="eyebrow">我的资源</p>
          <p className="seed-codex-tip">查看当前拥有的灵宠材料、掠夺精魄、田地精华和其他资源</p>
        </div>
        <button className="ghost-button small" onClick={onClose} type="button">关闭</button>
      </div>

      <div className="resource-backpack-body">
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
      </div>
    </section>
  );
}
