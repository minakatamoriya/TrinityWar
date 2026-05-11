interface SeedOption {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'legendary';
  description: string;
  unlocked: boolean;
  quantity: number;
}

interface SeedSelectionScreenProps {
  fieldCode: string;
  seedGroups: Array<{
    rarity: SeedOption['rarity'];
    label: string;
    seeds: SeedOption[];
  }>;
  selectedSeedId: string | null;
  onClose: () => void;
  onSelect: (seedId: string) => void;
  onConfirm: () => void;
  confirming: boolean;
}

function getSeedCardClassName(seed: SeedOption, selectedSeedId: string | null): string {
  const stateClassName = seed.unlocked ? 'is-unlocked' : 'is-locked';
  const selectedClassName = seed.id === selectedSeedId ? 'is-selected' : '';
  return ['seed-option-card', stateClassName, selectedClassName].filter(Boolean).join(' ');
}

export function SeedSelectionScreen(props: SeedSelectionScreenProps): JSX.Element {
  const { fieldCode, seedGroups, selectedSeedId, onClose, onSelect, onConfirm, confirming } = props;
  const selectedSeed = seedGroups.flatMap((group) => group.seeds).find((seed) => seed.id === selectedSeedId) ?? null;
  const selectedSeedReady = Boolean(selectedSeed?.unlocked && selectedSeed.quantity > 0);

  return (
    <section className="seed-selection-screen" role="dialog" aria-modal="true" aria-label={`${fieldCode} 选择种子`}>
      <div className="seed-selection-topbar">
        <div className="seed-selection-title-block">
          <p className="eyebrow">开始培育</p>
          <h3>{fieldCode} 选择种子</h3>
          <p className="seed-selection-name">当前仅已解锁种子可播种，未出现的种子统一以问号显示。</p>
        </div>
        <button className="ghost-button small" onClick={onClose} type="button">关闭</button>
      </div>

      <div className="seed-selection-body">
        {seedGroups.map((group) => (
          <article className="panel-card seed-rarity-panel" key={group.rarity}>
            <div className="panel-head">
              <h4>{group.label}</h4>
              <span className="soft-tag">{group.seeds.length} 种</span>
            </div>
            <div className="seed-option-grid">
              {group.seeds.map((seed) => {
                const disabled = !seed.unlocked;
                return (
                  <button
                    aria-pressed={seed.id === selectedSeedId}
                    className={getSeedCardClassName(seed, selectedSeedId)}
                    disabled={disabled}
                    key={seed.id}
                    onClick={() => onSelect(seed.id)}
                    type="button"
                  >
                    <div className="seed-option-topline">
                      <span className="stage-tag">{group.label}</span>
                      <span className="seed-option-count">{seed.unlocked ? `x ${seed.quantity}` : '？？'}</span>
                    </div>
                    <strong>{seed.unlocked ? seed.name : '？？'}</strong>
                    <p>{seed.unlocked ? seed.description : '尚未发现'}</p>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      <div className="seed-selection-actionbar">
        <div className="seed-selection-summary">
          <strong>{selectedSeed?.unlocked ? selectedSeed.name : '请选择种子'}</strong>
          <span>
            {selectedSeed?.unlocked
              ? selectedSeed.quantity > 0
                ? `库存 ${selectedSeed.quantity}，确认后消耗 1 颗开始培育。`
                : '库存不足，请先去首页领取或后续通过玩法获取。'
              : '初始阶段只能种植已解锁的种子。'}
          </span>
        </div>
        <button className="primary-button" disabled={!selectedSeedReady || confirming} onClick={onConfirm} type="button">
          {confirming ? '培育中...' : '确认培育'}
        </button>
      </div>
    </section>
  );
}
