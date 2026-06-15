import type {
  ClientSpiritCodexEntry,
} from '@trinitywar/shared';
import {
  formatSpiritUnlockRequirement,
  getFirstVisibleSpiritCodexId,
  getSpiritCodexName,
  getSpiritCodexRarityLabel,
  getSpiritCodexShardProgress,
  getSpiritCodexStatusLabel,
  getSpiritCodexVisibilityLabel,
  getSpiritFactionLabel,
  getSpiritRoleLabel,
  isSpiritCodexVisible,
} from '../../modules/spirit/spiritCodexPresentation';
import { FullScreenToolShell } from './ModalShell';

interface SpiritCodexModalProps {
  entries: ClientSpiritCodexEntry[];
  selectedSpiritId: string | null;
  stableFull: boolean;
  onClose: () => void;
  onSelectSpirit: (spiritId: string) => void;
}

const codexRarityGroups = [
  { key: 'common', label: '普通', rarity: 'common' as const },
  { key: 'rare', label: '稀有', rarity: 'rare' as const },
  { key: 'legend', label: '传说', rarity: 'legendary' as const },
];

export function SpiritCodexModal(props: SpiritCodexModalProps): JSX.Element | null {
  const {
    entries,
    selectedSpiritId,
    stableFull,
    onClose,
    onSelectSpirit,
  } = props;
  const codexById = new Map(entries.map((entry) => [entry.spiritId, entry]));
  const fallbackSpiritId = getFirstVisibleSpiritCodexId(entries);
  const resolvedSpiritId = selectedSpiritId && codexById.has(selectedSpiritId)
    ? selectedSpiritId
    : fallbackSpiritId;
  const selectedEntry = resolvedSpiritId ? codexById.get(resolvedSpiritId) ?? null : null;

  if (!selectedEntry) {
    return null;
  }

  const selectedVisible = isSpiritCodexVisible(selectedEntry);
  const selectedSpiritName = getSpiritCodexName(selectedEntry);
  const selectedStatusLabel = getSpiritCodexStatusLabel(selectedEntry);
  const codexGroups = codexRarityGroups.map((group) => ({
    ...group,
    pets: entries.filter((entry) => entry.definition.rarity === group.rarity),
  }));

  return (
    <FullScreenToolShell
      ariaLabel="灵宠图鉴"
      bodyClassName="seed-codex-body"
      className="spirit-codex-screen"
      description="记录灵宠的可见、收集、待合成和拥有状态"
      onBack={onClose}
      title="灵宠图鉴"
    >
        {codexGroups.map((group) => (
          <section className="panel-card seed-codex-rarity-row" key={group.key}>
            <div className="seed-codex-rarity-head">
              <strong>{group.label}</strong>
            </div>
            <div className="seed-codex-icon-grid">
              {group.pets.map((entry) => {
                const visible = isSpiritCodexVisible(entry);
                const spiritName = getSpiritCodexName(entry);
                return (
                  <button
                    aria-label={visible ? spiritName : `${group.label}未可见灵宠`}
                    className={`seed-codex-icon ${visible ? 'is-unlocked' : 'is-locked'} ${entry.spiritId === selectedEntry.spiritId ? 'is-selected' : ''}`}
                    key={entry.spiritId}
                    onClick={() => onSelectSpirit(entry.spiritId)}
                    type="button"
                  >
                    <span>{visible ? spiritName.slice(0, 2) : '？？'}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        <section className={`seed-codex-detail-card ${selectedVisible ? '' : 'is-undiscovered'}`}>
          <div className="seed-codex-detail-head">
            <div>
              <p className="eyebrow">{getSpiritCodexRarityLabel(selectedEntry.definition.rarity)}</p>
              <h3>{selectedSpiritName}</h3>
            </div>
            <span className="task-state-badge">{selectedStatusLabel}</span>
          </div>
          {selectedVisible ? (
            <>
              <p className="seed-codex-lore">{selectedEntry.definition.lore ?? '尚未补充该灵宠的额外背景描述。'}</p>
              <div className="seed-codex-stats">
                <div className="seed-codex-stat-row"><strong>可见状态</strong><span>{getSpiritCodexVisibilityLabel(selectedEntry)}</span></div>
                <div className="seed-codex-stat-row"><strong>阵营归属</strong><span>{getSpiritFactionLabel(selectedEntry.definition.factionAffinity)}</span></div>
                <div className="seed-codex-stat-row"><strong>主模板</strong><span>{getSpiritRoleLabel(selectedEntry.definition.role)}</span></div>
                <div className="seed-codex-stat-row"><strong>精魄进度</strong><span>{getSpiritCodexShardProgress(selectedEntry)}</span></div>
                <div className="seed-codex-stat-row"><strong>曾经拥有</strong><span>{selectedEntry.ownedEver ? '是' : '否'}</span></div>
                <div className="seed-codex-stat-row"><strong>五行状态</strong><span>{selectedEntry.ownedCurrent ? '已固定当前五行' : '未合成前可自选五行'}</span></div>
              </div>
            </>
          ) : (
            <p className="seed-codex-undiscovered-text">尚未获得该灵宠精魄，完整图鉴信息暂不可见。</p>
          )}
          {!selectedEntry.ownedCurrent ? (
            <div className="seed-codex-strategy">
              <strong>解锁条件</strong>
              <p>{formatSpiritUnlockRequirement(selectedEntry)}</p>
              {!selectedVisible ? (
                <div className="seed-codex-stats">
                  <div className="seed-codex-stat-row"><strong>可见状态</strong><span>{getSpiritCodexVisibilityLabel(selectedEntry)}</span></div>
                  <div className="seed-codex-stat-row"><strong>精魄进度</strong><span>{getSpiritCodexShardProgress(selectedEntry)}</span></div>
                  <div className="seed-codex-stat-row"><strong>解锁门槛</strong><span>{selectedEntry.definition.shardUnlockRequired} 个对应精魄</span></div>
                </div>
              ) : null}
              {selectedEntry.readyToCompose ? (
                <p>{stableFull ? '当前兽栏已满，需要先解散旧宠腾出栏位。图鉴只记录状态，不直接发宠。' : '精魄已满。请返回兽栏，点开一个空栏位完成合成与五行指定。'}</p>
              ) : null}
            </div>
          ) : null}
        </section>
    </FullScreenToolShell>
  );
}
