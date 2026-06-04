import { FullScreenToolShell } from '../common/ModalShell';
import type { ClientPlantResearchState } from '@trinitywar/shared';

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
  growthSeconds?: number;
  unlocked: boolean;
  quantity: number;
  research?: ClientPlantResearchState;
}

interface SeedSelectionScreenProps {
  fieldCode: string;
  availableFieldCount: number;
  seedGroups: Array<{
    rarity: SeedOption['rarity'];
    label: string;
    seeds: SeedOption[];
  }>;
  selectedSeedId: string | null;
  onClose: () => void;
  onSelect: (seedId: string) => void;
  onConfirm: () => void;
  onConfirmAll: () => void;
  confirming: boolean;
  confirmingAll: boolean;
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
  const { availableFieldCount, fieldCode, seedGroups, selectedSeedId, onClose, onSelect, onConfirm, onConfirmAll, confirming, confirmingAll } = props;
  const selectedSeed = seedGroups.flatMap((group) => group.seeds).find((seed) => seed.id === selectedSeedId) ?? null;
  const selectedSeedReady = Boolean(selectedSeed?.unlocked);
  const busy = confirming || confirmingAll;

  return (
    <FullScreenToolShell
      ariaLabel={`${fieldCode} 选择灵植`}
      bodyClassName="seed-selection-body seed-codex-body"
      className="seed-selection-screen"
      description="已解锁灵植可凭永久资格直接播种。"
      eyebrow="开始培育"
      onBack={onClose}
      title={`${fieldCode} 选择灵植`}
    >
        {seedGroups.map((group) => (
          <section className="panel-card seed-codex-rarity-row" key={group.rarity}>
            <div className="seed-codex-rarity-head">
              <strong>{group.label}</strong>
            </div>
            <div className="seed-codex-icon-grid">
              {group.seeds.map((seed) => {
                return (
                  <button
                    aria-pressed={seed.id === selectedSeedId}
                    className={`seed-codex-icon ${seed.unlocked ? 'is-unlocked' : 'is-locked'} ${seed.id === selectedSeedId ? 'is-selected' : ''}`}
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

        <section className={`seed-codex-detail-card seed-selection-detail-card ${selectedSeed ? '' : 'is-undiscovered'}`}>
          {selectedSeed ? (
            <>
              <div className="seed-codex-detail-head">
                <div>
                  <p className="eyebrow">{seedGroups.find((group) => group.rarity === selectedSeed.rarity)?.label ?? ''}</p>
                  <h3>{selectedSeed.name}</h3>
                </div>
                <span className="task-state-badge">{selectedSeed.unlocked ? '已解锁' : selectedSeed.research?.canUnlock ? '可解锁' : '未解锁'}</span>
              </div>
              {selectedSeed.unlocked ? (
                <>
                  <p className="seed-codex-lore">{selectedSeed.lore ?? selectedSeed.description}</p>
                  <div className="seed-codex-stats">
                    <div className="seed-codex-stat-row">
                      <strong>成长时间</strong>
                      <span>{selectedSeed.growthSeconds !== undefined ? formatDuration(selectedSeed.growthSeconds) : '待配置'}</span>
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
                <div className="seed-codex-strategy">
                  <strong>解锁条件</strong>
                  {selectedSeed.research ? <PlantUnlockRequirementRows research={selectedSeed.research} /> : <p>等待服务器返回解锁条件。</p>}
                  <p>{selectedSeed.research?.canUnlock ? '条件已满足，请到灵植图鉴中执行解锁。' : '达成条件并解锁后即可播种。'}</p>
                </div>
              )}
            </>
          ) : (
            <p className="seed-codex-undiscovered-text">请选择灵植</p>
          )}
        </section>

      <div className="seed-selection-actionbar">
        <div className="seed-selection-summary">
          <strong>{selectedSeed ? selectedSeed.name : '请选择灵植'}</strong>
          <span>{selectedSeed?.unlocked ? `已解锁可播种，当前可用空田 ${formatNumber(availableFieldCount)} 块。` : '未解锁，先查看并完成条件后再培育。'}</span>
        </div>
        <div className="seed-selection-actions">
          <button className="secondary-button" disabled={!selectedSeedReady || busy || availableFieldCount <= 1} onClick={onConfirmAll} type="button">
            {confirmingAll ? '一键培育中...' : `一键培育 ${formatNumber(availableFieldCount)} 块`}
          </button>
          <button className="primary-button" disabled={!selectedSeedReady || busy} onClick={onConfirm} type="button">
            {confirming ? '培育中...' : '确认培育'}
          </button>
        </div>
      </div>
    </FullScreenToolShell>
  );
}

function formatPlantUnlockRequirement(research: ClientPlantResearchState): string {
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

function PlantUnlockRequirementRows(props: { research: ClientPlantResearchState }): JSX.Element {
  const { research } = props;
  const hasHarvestRequirement = (research.harvestRequired ?? 0) > 0;
  const hasContributionRequirement = research.contributionRequired > 0;

  if (!hasHarvestRequirement && !hasContributionRequirement) {
    return <p>{formatPlantUnlockRequirement(research)}</p>;
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
