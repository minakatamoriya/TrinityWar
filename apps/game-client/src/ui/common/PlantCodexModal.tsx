import type { ClientPlantResearchState } from '@trinitywar/shared';
import { FullScreenToolShell } from './ModalShell';

export type PlantRarity = 'common' | 'rare' | 'legendary';

export interface PlantCodexGroup<TPlant extends PlantCodexItem> {
  rarity: PlantRarity;
  label: string;
  plants: TPlant[];
}

export interface PlantCodexItem {
  id: string;
  name: string;
  rarity: PlantRarity;
  description: string;
  lore: string;
  stageGold: {
    growing: number;
    mature: number;
    withered: number;
  };
  growthSeconds: number;
  unlocked: boolean;
  quantity?: number;
  research?: ClientPlantResearchState;
}

interface PlantCodexModalProps<TPlant extends PlantCodexItem> {
  groups: Array<PlantCodexGroup<TPlant>>;
  selectedPlant: TPlant;
  formatDuration: (seconds: number) => string;
  formatNumber: (value: number) => string;
  busyPlantId?: string | null;
  onClose: () => void;
  onSelectPlant: (plantId: string) => void;
  onUnlockPlant?: (plantId: string) => void;
}

export function PlantCodexModal<TPlant extends PlantCodexItem>(props: PlantCodexModalProps<TPlant>): JSX.Element {
  const {
    groups,
    selectedPlant,
    formatDuration,
    formatNumber,
    busyPlantId,
    onClose,
    onSelectPlant,
    onUnlockPlant,
  } = props;
  const selectedResearch = selectedPlant.research;
  const discovered = selectedPlant.unlocked || selectedResearch?.discovered || (selectedPlant.quantity ?? 0) > 0;
  const canUnlock = Boolean(selectedResearch?.canUnlock && onUnlockPlant);

  return (
    <FullScreenToolShell
      ariaLabel="灵植图鉴"
      bodyClassName="seed-codex-body"
      description="点击灵植图标切换详情"
      onBack={onClose}
      title="灵植图鉴"
    >
        {groups.map((group) => (
          <section className="panel-card seed-codex-rarity-row" key={group.rarity}>
            <div className="seed-codex-rarity-head">
              <strong>{group.label}</strong>
            </div>
            <div className="seed-codex-icon-grid">
              {group.plants.map((plant) => {
                const plantDiscovered = plant.unlocked || plant.research?.discovered || (plant.quantity ?? 0) > 0;

                return (
                  <button
                    aria-label={plantDiscovered ? plant.name : '尚未发现'}
                    className={`seed-codex-icon ${plantDiscovered ? 'is-unlocked' : 'is-locked'} ${plant.id === selectedPlant.id && plantDiscovered ? 'is-selected' : ''}`}
                    disabled={!plantDiscovered}
                    key={plant.id}
                    onClick={() => {
                      if (!plantDiscovered) {
                        return;
                      }

                      onSelectPlant(plant.id);
                    }}
                    type="button"
                  >
                    <span>{plantDiscovered ? plant.name.slice(0, 2) : '？？'}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        <section className={`seed-codex-detail-card ${discovered ? '' : 'is-undiscovered'}`}>
          {discovered ? (
            <>
              <div className="seed-codex-detail-head">
                <div>
                  <p className="eyebrow">{groups.find((group) => group.rarity === selectedPlant.rarity)?.label ?? ''}</p>
                  <h3>{selectedPlant.name}</h3>
                </div>
                <span className="task-state-badge">
                  {selectedPlant.unlocked ? '已解锁' : selectedResearch?.canUnlock ? '可解锁' : '研究中'}
                </span>
              </div>
              <p className="seed-codex-lore">{selectedPlant.lore}</p>
              <div className="seed-codex-stats">
                <div className="seed-codex-stat-row">
                  <strong>成熟时间</strong>
                  <span>{formatDuration(selectedPlant.growthSeconds)}</span>
                </div>
                <div className="seed-codex-stat-row">
                  <strong>精华库存</strong>
                  <span>{formatNumber(selectedResearch?.essenceOwned ?? selectedPlant.quantity ?? 0)}</span>
                </div>
                <div className="seed-codex-stat-row">
                  <strong>收益</strong>
                  <span>培育中 {formatNumber(selectedPlant.stageGold.growing)} / 成熟 {formatNumber(selectedPlant.stageGold.mature)} / 枯萎 {formatNumber(selectedPlant.stageGold.withered)}</span>
                </div>
              </div>
              {!selectedPlant.unlocked && selectedResearch ? (
                <div className="seed-codex-strategy">
                  <strong>解锁研究</strong>
                  <p>
                    精华 {formatNumber(selectedResearch.essenceOwned)}/{formatNumber(selectedResearch.essenceRequired)}
                    {' · '}
                    贡献 {formatNumber(selectedResearch.contributionOwned)}/{formatNumber(selectedResearch.contributionRequired)}
                  </p>
                  <button
                    className="primary-button"
                    disabled={!canUnlock || busyPlantId === selectedPlant.id}
                    onClick={() => onUnlockPlant?.(selectedPlant.id)}
                    type="button"
                  >
                    {busyPlantId === selectedPlant.id ? '解锁中' : selectedResearch.canUnlock ? '解锁灵植' : '条件不足'}
                  </button>
                </div>
              ) : null}
              <div className="seed-codex-strategy">
                <strong>策略建议</strong>
                <p>{selectedPlant.description}</p>
              </div>
            </>
          ) : (
            <p className="seed-codex-undiscovered-text">尚未发现</p>
          )}
        </section>
    </FullScreenToolShell>
  );
}
