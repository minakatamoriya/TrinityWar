import type {
  ClientSpiritCodexEntry,
  ClientSpiritRarity,
  ClientSpiritRole,
} from '@trinitywar/shared';

type DisplayRarity = '普通' | '稀有' | '传说';

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

function getRarityLabel(rarity: ClientSpiritRarity): DisplayRarity {
  if (rarity === 'legendary') {
    return '传说';
  }
  if (rarity === 'rare') {
    return '稀有';
  }
  return '普通';
}

function getFactionLabel(faction: ClientSpiritCodexEntry['definition']['factionAffinity']): string {
  if (faction === 'immortal') {
    return '仙界';
  }
  if (faction === 'demon') {
    return '魔界';
  }
  return '人界';
}

function getRoleLabel(role: ClientSpiritRole): string {
  if (role === 'attack') {
    return '攻击型';
  }
  if (role === 'health') {
    return '血量型';
  }
  return '均衡型';
}

function isDiscovered(entry: ClientSpiritCodexEntry): boolean {
  return entry.hasSeen || entry.ownedEver || entry.shardCount > 0 || entry.ownedCurrent;
}

function isReadyToCompose(entry: ClientSpiritCodexEntry): boolean {
  return entry.readyToCompose;
}

function getShardLabel(entry: ClientSpiritCodexEntry): string {
  if (entry.ownedCurrent) {
    return '已拥有';
  }
  if (entry.readyToCompose) {
    return '待合成';
  }
  return `${entry.shardCount} / ${entry.definition.shardUnlockRequired}`;
}

export function SpiritCodexModal(props: SpiritCodexModalProps): JSX.Element | null {
  const {
    entries,
    selectedSpiritId,
    stableFull,
    onClose,
    onSelectSpirit,
  } = props;
  const codexById = new Map(entries.map((entry) => [entry.spiritId, entry]));
  const selectedEntry = selectedSpiritId
    ? codexById.get(selectedSpiritId) ?? null
    : entries.find((entry) => isDiscovered(entry)) ?? entries[0] ?? null;

  if (!selectedEntry) {
    return null;
  }

  const codexGroups = codexRarityGroups.map((group) => ({
    ...group,
    pets: entries.filter((entry) => entry.definition.rarity === group.rarity),
  }));

  return (
    <section className="seed-codex-screen spirit-codex-screen" role="dialog" aria-modal="true" aria-label="灵宠图鉴">
      <div className="seed-codex-topbar">
        <div className="seed-codex-title-block">
          <p className="eyebrow">灵宠图鉴</p>
          <p className="seed-codex-tip">记录见过、解锁、待合成和曾经拥有过的灵宠</p>
        </div>
        <button className="ghost-button small" onClick={onClose} type="button">关闭</button>
      </div>
      <div className="seed-codex-body">
        {codexGroups.map((group) => (
          <section className="panel-card seed-codex-rarity-row" key={group.key}>
            <div className="seed-codex-rarity-head">
              <strong>{group.label}</strong>
            </div>
            <div className="seed-codex-icon-grid">
              {group.pets.map((entry) => {
                const discovered = isDiscovered(entry);
                return (
                  <button
                    aria-label={discovered ? entry.definition.label : '尚未展示'}
                    className={`seed-codex-icon ${discovered ? 'is-unlocked' : 'is-locked'} ${entry.spiritId === selectedEntry.spiritId && discovered ? 'is-selected' : ''}`}
                    disabled={!discovered}
                    key={entry.spiritId}
                    onClick={() => onSelectSpirit(entry.spiritId)}
                    type="button"
                  >
                    <span>{discovered ? entry.definition.label.slice(0, 2) : '？？'}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        <section className={`seed-codex-detail-card ${isDiscovered(selectedEntry) ? '' : 'is-undiscovered'}`}>
          {isDiscovered(selectedEntry) ? (
            <>
              <div className="seed-codex-detail-head">
                <div>
                  <p className="eyebrow">{getRarityLabel(selectedEntry.definition.rarity)}</p>
                  <h3>{selectedEntry.definition.label}</h3>
                </div>
              </div>
              <p className="seed-codex-lore">{selectedEntry.definition.lore ?? '尚未补充该灵宠的额外背景描述。'}</p>
              <div className="seed-codex-stats">
                <div className="seed-codex-stat-row"><strong>阵营归属</strong><span>{getFactionLabel(selectedEntry.definition.factionAffinity)}</span></div>
                <div className="seed-codex-stat-row"><strong>主模板</strong><span>{getRoleLabel(selectedEntry.definition.role)}</span></div>
                <div className="seed-codex-stat-row"><strong>精魄进度</strong><span>{getShardLabel(selectedEntry)}</span></div>
                <div className="seed-codex-stat-row"><strong>曾经拥有</strong><span>{selectedEntry.ownedEver ? '是' : '否'}</span></div>
                <div className="seed-codex-stat-row"><strong>五行状态</strong><span>{selectedEntry.ownedCurrent ? '已固定当前五行' : '未合成前可自选五行'}</span></div>
              </div>
              {isReadyToCompose(selectedEntry) ? (
                <div className="seed-codex-strategy">
                  <strong>待合成</strong>
                  <p>{stableFull ? '当前兽栏已满，需要先解散旧宠腾出栏位。图鉴只记录状态，不直接发宠。' : '精魄已满。请返回兽栏，点开一个空栏位完成合成与五行指定。'}</p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="seed-codex-undiscovered-text">尚未展示</p>
          )}
        </section>
      </div>
    </section>
  );
}
