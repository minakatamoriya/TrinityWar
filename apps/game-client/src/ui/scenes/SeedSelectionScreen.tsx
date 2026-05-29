interface SeedOption {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'legendary';
  description: string;
  lore?: string;
  stageGold?: {
    growing: number;
    mature: number;
    withered: number;
  };
  stageSeconds?: {
    seeded: number;
    growing: number;
  };
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

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(totalSeconds, 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

export function SeedSelectionScreen(props: SeedSelectionScreenProps): JSX.Element {
  const { fieldCode, seedGroups, selectedSeedId, onClose, onSelect, onConfirm, confirming } = props;
  const selectedSeed = seedGroups.flatMap((group) => group.seeds).find((seed) => seed.id === selectedSeedId) ?? null;
  const selectedSeedReady = Boolean(selectedSeed?.unlocked);

  return (
    <section className="seed-selection-screen" role="dialog" aria-modal="true" aria-label={`${fieldCode} 选择灵植`}>
      <div className="seed-selection-topbar">
        <div className="seed-selection-title-block">
          <p className="eyebrow">开始培育</p>
          <h3>{fieldCode} 选择灵植</h3>
          <p className="seed-selection-name">已解锁灵植可直接播种，播种不消耗精华库存。</p>
        </div>
        <button className="ghost-button small" onClick={onClose} type="button">关闭</button>
      </div>

      <div className="seed-selection-body seed-codex-body">
        {seedGroups.map((group) => (
          <section className="panel-card seed-codex-rarity-row" key={group.rarity}>
            <div className="seed-codex-rarity-head">
              <strong>{group.label}</strong>
            </div>
            <div className="seed-codex-icon-grid">
              {group.seeds.map((seed) => {
                const disabled = !seed.unlocked;
                return (
                  <button
                    aria-pressed={seed.id === selectedSeedId}
                    className={`seed-codex-icon ${seed.unlocked ? 'is-unlocked' : 'is-locked'} ${seed.id === selectedSeedId && seed.unlocked ? 'is-selected' : ''}`}
                    disabled={disabled}
                    key={seed.id}
                    onClick={() => onSelect(seed.id)}
                    type="button"
                  >
                    <span>{seed.unlocked ? seed.name.slice(0, 2) : '？？'}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        <section className={`seed-codex-detail-card seed-selection-detail-card ${selectedSeed?.unlocked ? '' : 'is-undiscovered'}`}>
          {selectedSeed?.unlocked ? (
            <>
              <div className="seed-codex-detail-head">
                <div>
                  <p className="eyebrow">{seedGroups.find((group) => group.rarity === selectedSeed.rarity)?.label ?? ''}</p>
                  <h3>{selectedSeed.name}</h3>
                </div>
              </div>
              <p className="seed-codex-lore">{selectedSeed.lore ?? selectedSeed.description}</p>
              <div className="seed-codex-stats">
                <div className="seed-codex-stat-row">
                  <strong>成长时间</strong>
                  <span>{selectedSeed.stageSeconds ? formatDuration(selectedSeed.stageSeconds.seeded + selectedSeed.stageSeconds.growing) : '待配置'}</span>
                </div>
                <div className="seed-codex-stat-row">
                  <strong>收获价值</strong>
                  <span>
                    {selectedSeed.stageGold
                      ? `培育中 ${formatNumber(selectedSeed.stageGold.growing)} / 成熟 ${formatNumber(selectedSeed.stageGold.mature)} / 枯萎 ${formatNumber(selectedSeed.stageGold.withered)}`
                      : '待配置'}
                  </span>
                </div>
              </div>
              <div className="seed-codex-strategy">
                <strong>描述</strong>
                <p>{selectedSeed.description}</p>
              </div>
            </>
          ) : (
            <p className="seed-codex-undiscovered-text">尚未发现</p>
          )}
        </section>
      </div>

      <div className="seed-selection-actionbar">
        <div className="seed-selection-summary">
          <strong>{selectedSeed?.unlocked ? selectedSeed.name : '请选择灵植'}</strong>
          <span>{selectedSeed?.unlocked ? '已解锁可播种，不消耗精华库存。' : '当前只能种植已解锁的灵植。'}</span>
        </div>
        <button className="primary-button" disabled={!selectedSeedReady || confirming} onClick={onConfirm} type="button">
          {confirming ? '培育中...' : '确认培育'}
        </button>
      </div>
    </section>
  );
}
