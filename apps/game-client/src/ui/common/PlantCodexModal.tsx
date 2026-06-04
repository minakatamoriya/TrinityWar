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
    formatNumber,
    busyPlantId,
    onClose,
    onSelectPlant,
    onUnlockPlant,
  } = props;
  const selectedResearch = selectedPlant.research;
  const discovered = selectedPlant.unlocked || selectedResearch?.discovered || (selectedPlant.quantity ?? 0) > 0;
  const canUnlock = Boolean(selectedResearch?.canUnlock && onUnlockPlant);
  const selectedStatusLabel = selectedPlant.unlocked
    ? '已解锁'
    : selectedResearch?.canUnlock
      ? '可解锁'
      : selectedResearch?.discovered
        ? '研究中'
        : '未解锁';

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
                    aria-label={plantDiscovered ? plant.name : `${plant.name}，未解锁`}
                    className={`seed-codex-icon ${plantDiscovered ? 'is-unlocked' : 'is-locked'} ${plant.id === selectedPlant.id ? 'is-selected' : ''}`}
                    key={plant.id}
                    onClick={() => onSelectPlant(plant.id)}
                    type="button"
                  >
                    <span>{plantDiscovered ? plant.name.slice(0, 2) : '？？'}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        <section className="seed-codex-detail-card">
          <>
            <div className="seed-codex-detail-head">
              <div>
                <p className="eyebrow">{groups.find((group) => group.rarity === selectedPlant.rarity)?.label ?? ''}</p>
                <h3>{selectedPlant.name}</h3>
              </div>
              <span className="task-state-badge">{selectedStatusLabel}</span>
            </div>
            {discovered ? (
              <>
              <p className="seed-codex-lore">{selectedPlant.lore}</p>
              <div className="seed-codex-stats">
                <div className="seed-codex-stat-row">
                  <strong>收益</strong>
                  <span>培育中 {formatNumber(selectedPlant.stageGold.growing)} / 成熟 {formatNumber(selectedPlant.stageGold.mature)} / 枯萎 {formatNumber(selectedPlant.stageGold.withered)}</span>
                </div>
              </div>
              <div className="seed-codex-strategy">
                <strong>策略建议</strong>
                <p>{selectedPlant.description}</p>
              </div>
              </>
            ) : (
              <p className="seed-codex-undiscovered-text">达成解锁条件后开放完整图鉴信息。</p>
            )}
            {!selectedPlant.unlocked && selectedResearch ? (
              <div className="seed-codex-strategy">
                <strong>解锁条件</strong>
                <PlantUnlockRequirementRows research={selectedResearch} formatNumber={formatNumber} />
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
          </>
        </section>
    </FullScreenToolShell>
  );
}

function formatPlantUnlockRequirement(
  research: ClientPlantResearchState,
  formatNumber: (value: number) => string,
): string {
  const requirements = [
    (research.harvestRequired ?? 0) > 0
      ? `累计收获 ${formatNumber(research.harvestOwned ?? 0)}/${formatNumber(research.harvestRequired ?? 0)} 次`
      : null,
    research.contributionRequired > 0
      ? `阵营贡献 ${formatNumber(research.contributionOwned)}/${formatNumber(research.contributionRequired)}`
      : null,
  ].filter((part): part is string => Boolean(part));

  return requirements.length > 0 ? requirements.join('，') : '随基础流程开放';
}

function PlantUnlockRequirementRows(props: {
  research: ClientPlantResearchState;
  formatNumber: (value: number) => string;
}): JSX.Element {
  const { research, formatNumber } = props;
  const hasHarvestRequirement = (research.harvestRequired ?? 0) > 0;
  const hasContributionRequirement = research.contributionRequired > 0;

  if (!hasHarvestRequirement && !hasContributionRequirement) {
    return <p>{formatPlantUnlockRequirement(research, formatNumber)}</p>;
  }

  return (
    <div className="seed-codex-stats">
      {hasHarvestRequirement ? (
        <div className="seed-codex-stat-row">
          <strong>累计收获</strong>
          <span>{formatNumber(research.harvestOwned ?? 0)} / {formatNumber(research.harvestRequired ?? 0)} 次</span>
        </div>
      ) : null}
      {hasContributionRequirement ? (
        <div className="seed-codex-stat-row">
          <strong>阵营贡献</strong>
          <span>{formatNumber(research.contributionOwned)} / {formatNumber(research.contributionRequired)}</span>
        </div>
      ) : null}
    </div>
  );
}
