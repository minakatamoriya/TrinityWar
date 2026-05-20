import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  ClientSpiritCodexEntry,
  ClientSpiritElement,
  ClientSpiritRarity,
  ClientSpiritRole,
  ClientSpiritSlot,
  ClientSpiritState,
} from '@trinitywar/shared';

interface ArmySceneProps {
  currentArmy: number;
  currentGold: number;
  playerFaction: string;
  spirit: ClientSpiritState;
  unitCostGold: number;
  busy: boolean;
  onBuySoul: () => void;
  onUpgrade: (slotIndex: number, slotVersion: number) => void;
  onSetMain: (slotIndex: number, slotVersion: number) => void;
  onRecover: (slotIndex: number, slotVersion: number) => void;
  onDissolve: (slotIndex: number, slotVersion: number) => void;
  onCompose: (spiritId: string, slotIndex: number, element: ClientSpiritElement) => void;
}

type DisplayRarity = '普通' | '稀有' | '传说';
type DisplayElement = '金' | '木' | '水' | '火' | '土';

const elementChoices: Array<{ value: ClientSpiritElement; label: DisplayElement }> = [
  { value: 'metal', label: '金' },
  { value: 'wood', label: '木' },
  { value: 'water', label: '水' },
  { value: 'fire', label: '火' },
  { value: 'earth', label: '土' },
];

const codexRarityGroups = [
  { key: 'common', label: '普通', rarity: 'common' as const },
  { key: 'rare', label: '稀有', rarity: 'rare' as const },
  { key: 'legend', label: '传说', rarity: 'legendary' as const },
];

const MAX_QUICK_RECOVERY_PER_DAY = 3;

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function getElementLabel(element: ClientSpiritElement | null): DisplayElement | '' {
  if (element === 'metal') {
    return '金';
  }
  if (element === 'wood') {
    return '木';
  }
  if (element === 'water') {
    return '水';
  }
  if (element === 'fire') {
    return '火';
  }
  if (element === 'earth') {
    return '土';
  }
  return '';
}

function getElementClass(element: ClientSpiritElement | DisplayElement | null): string {
  if (element === 'metal' || element === '金') {
    return 'spirit-element-metal';
  }
  if (element === 'wood' || element === '木') {
    return 'spirit-element-wood';
  }
  if (element === 'water' || element === '水') {
    return 'spirit-element-water';
  }
  if (element === 'fire' || element === '火') {
    return 'spirit-element-fire';
  }
  if (element === 'earth' || element === '土') {
    return 'spirit-element-earth';
  }
  return 'spirit-element-wood';
}

function getRarityLabel(rarity: ClientSpiritRarity): DisplayRarity {
  if (rarity === 'legendary') {
    return '传说';
  }
  if (rarity === 'rare') {
    return '稀有';
  }
  return '普通';
}

function getRarityClass(rarity: DisplayRarity): string {
  if (rarity === '传说') {
    return 'spirit-rarity-legend';
  }
  if (rarity === '稀有') {
    return 'spirit-rarity-rare';
  }
  return 'spirit-rarity-common';
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
  if (role === 'defense') {
    return '防御型';
  }
  if (role === 'health') {
    return '血量型';
  }
  return '均衡型';
}

function getPhaseForLevel(level: number): string {
  if (level >= 50) {
    return '归真圆满';
  }
  if (level >= 40) {
    return '神异觉醒期';
  }
  if (level >= 30) {
    return '真形期';
  }
  if (level >= 20) {
    return '化形期';
  }
  if (level >= 10) {
    return '幼灵期';
  }
  return '灵胎期';
}

function getUpgradeCost(level: number): number | null {
  if (level >= 50) {
    return null;
  }
  const fixedCosts: Record<number, number> = {
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 8,
    8: 10,
    9: 12,
    10: 15,
    41: 290,
    42: 300,
    43: 320,
    44: 340,
    45: 360,
    46: 390,
    47: 420,
    48: 450,
    49: 490,
  };
  if (fixedCosts[level]) {
    return fixedCosts[level];
  }
  if (level >= 11 && level <= 15) {
    return 18 + (level - 11) * 3;
  }
  if (level >= 16 && level <= 20) {
    return 35 + (level - 16) * 5;
  }
  if (level >= 21 && level <= 25) {
    return 63 + (level - 21) * 8;
  }
  if (level >= 26 && level <= 30) {
    return 105 + (level - 26) * 10;
  }
  if (level >= 31 && level <= 35) {
    return 160 + (level - 31) * 15;
  }
  if (level >= 36 && level <= 40) {
    return 240 + (level - 36) * 20;
  }
  return 1;
}

function getHealthRatio(slot: ClientSpiritSlot): number {
  if (slot.maxHp <= 0) {
    return 0;
  }
  return Math.min(Math.max((slot.currentHp / slot.maxHp) * 100, 0), 100);
}

function getHealthText(slot: ClientSpiritSlot): string {
  return `${Math.round(getHealthRatio(slot))}%`;
}

function getHealthStatus(slot: ClientSpiritSlot): string {
  const ratio = getHealthRatio(slot);
  if (ratio >= 70) {
    return '状态正常';
  }
  if (ratio >= 30) {
    return '可出战，但会明显吃亏';
  }
  return '重伤作战，建议先恢复';
}

function getFactionBonusLabel(faction: string): string {
  if (faction === '仙界') {
    return '防御 +8%';
  }
  if (faction === '魔界') {
    return '攻击 +8%';
  }
  if (faction === '人界') {
    return '血量 +8%';
  }
  return '未触发';
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

function SpiritStageCard(props: {
  name: string;
  phase: string;
  level: number;
  element?: DisplayElement;
  rarity: DisplayRarity;
}): JSX.Element {
  const { name, phase, level, element, rarity } = props;

  return (
    <div className="spirit-stage-card">
      <div className="spirit-stage-art" aria-hidden="true">
        <span>{name.slice(0, 1)}</span>
      </div>
      <div className="spirit-stage-meta">
        <p className="eyebrow">{phase}</p>
        <h4>{name}</h4>
        <div className="spirit-tag-row">
          <span className={`spirit-rarity ${getRarityClass(rarity)}`}>{rarity}</span>
          {element ? <span className={`spirit-element-chip ${getElementClass(element)}`}>{element}</span> : null}
          <span className="soft-tag">Lv.{level}</span>
        </div>
      </div>
    </div>
  );
}

export function ArmyScene(props: ArmySceneProps): JSX.Element {
  const { currentArmy, currentGold, playerFaction, spirit, unitCostGold, busy, onBuySoul, onUpgrade, onSetMain, onRecover, onDissolve, onCompose } = props;
  const [codexOpen, setCodexOpen] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [selectedCodexSpiritId, setSelectedCodexSpiritId] = useState<string | null>(() => spirit.codex.find((entry) => isDiscovered(entry))?.spiritId ?? spirit.codex[0]?.spiritId ?? null);
  const [selectedComposeSpiritId, setSelectedComposeSpiritId] = useState<string>(() => spirit.readyToCompose.find((entry) => !entry.ownedCurrent)?.spiritId ?? '');
  const [composeElement, setComposeElement] = useState<ClientSpiritElement>('wood');

  const portalTarget = typeof document === 'undefined' ? null : document.querySelector('.phone-frame');
  const slots = useMemo(() => [...spirit.slots].sort((left, right) => left.slotIndex - right.slotIndex), [spirit.slots]);
  const codexById = useMemo(() => new Map(spirit.codex.map((entry) => [entry.spiritId, entry])), [spirit.codex]);
  const mainSlot = spirit.mainSlot;
  const mainEntry = mainSlot?.spiritId ? codexById.get(mainSlot.spiritId) ?? null : null;
  const stableSlots = slots.filter((slot) => !slot.isMain);
  const selectedSlot = selectedSlotIndex === null ? null : slots.find((slot) => slot.slotIndex === selectedSlotIndex) ?? null;
  const selectedSlotEntry = selectedSlot?.spiritId ? codexById.get(selectedSlot.spiritId) ?? null : null;
  const selectedCodexEntry = selectedCodexSpiritId ? codexById.get(selectedCodexSpiritId) ?? null : null;
  const availableComposePets = spirit.readyToCompose.filter((entry) => !entry.ownedCurrent);
  const selectedComposeEntry = availableComposePets.find((entry) => entry.spiritId === selectedComposeSpiritId) ?? availableComposePets[0] ?? null;
  const occupiedCount = slots.filter((slot) => slot.spiritId).length;
  const isStableFull = occupiedCount >= slots.length;
  const availableSoul = spirit.spiritSoul;
  const availableTianjiTalisman = spirit.tianjiTalisman;
  const quickRecoverRemaining = Math.max(MAX_QUICK_RECOVERY_PER_DAY - spirit.dailyRecoveryUsed, 0);
  const selectedUpgradeCost = selectedSlot && selectedSlotEntry ? getUpgradeCost(selectedSlot.level) : null;
  const codexGroups = codexRarityGroups.map((group) => ({
    ...group,
    pets: spirit.codex.filter((entry) => entry.definition.rarity === group.rarity),
  }));

  return (
    <div className="scene-shell">
      <div className="scene-scroll spirit-scene-scroll">
        <section className="spirit-top-actions">
          <button className="spirit-codex-button-card" onClick={() => setCodexOpen(true)} type="button">
            <span>灵宠图鉴</span>
            <strong>打开图鉴</strong>
          </button>
          <article className="spirit-soul-quick-card">
            <div>
              <span>兽魂库存</span>
              <strong>{formatNumber(availableSoul)}</strong>
              <small>金币 {formatNumber(currentGold)} · 统兵 {formatNumber(currentArmy)}</small>
            </div>
            <button className="primary-button small" disabled={busy || currentGold < unitCostGold} onClick={onBuySoul} type="button">
              {busy ? '购买中' : '购买兽魂'}
            </button>
          </article>
        </section>

        <section className="spirit-main-row">
          {mainSlot && mainEntry ? (
            <article className="spirit-profile-card spirit-profile-card-horizontal" onClick={() => setSelectedSlotIndex(mainSlot.slotIndex)} role="button" tabIndex={0}>
              <div className={`spirit-portrait ${getElementClass(mainSlot.element)}`} aria-hidden="true">
                <span>{mainEntry.definition.label.slice(0, 1)}</span>
              </div>
              <div className="spirit-profile-main">
                <div className="spirit-name-row">
                  <div>
                    <p className="eyebrow">主位灵宠</p>
                    <h4>{mainEntry.definition.label}</h4>
                  </div>
                  <strong>Lv.{mainSlot.level}</strong>
                </div>
                <div className="spirit-tag-row">
                  <span className={`spirit-rarity ${getRarityClass(getRarityLabel(mainEntry.definition.rarity))}`}>{getRarityLabel(mainEntry.definition.rarity)}</span>
                  <span className="faction-badge">{getFactionLabel(mainEntry.definition.factionAffinity)}</span>
                  {mainSlot.element ? <span className={`spirit-element-chip ${getElementClass(mainSlot.element)}`}>{getElementLabel(mainSlot.element)}</span> : null}
                  <span className="soft-tag">{getRoleLabel(mainEntry.definition.role)}</span>
                  <span className="soft-tag">{getPhaseForLevel(mainSlot.level)}</span>
                  {getFactionLabel(mainEntry.definition.factionAffinity) === playerFaction ? <span className="soft-tag">同阵营 {getFactionBonusLabel(getFactionLabel(mainEntry.definition.factionAffinity))}</span> : null}
                </div>
              </div>
            </article>
          ) : (
            <button className="spirit-empty-main-card" onClick={() => setSelectedSlotIndex(slots[0]?.slotIndex ?? null)} type="button">
              <span className="spirit-empty-main-plus">+</span>
              <strong>当前暂无主位灵宠</strong>
              <span>请先在空栏位中完成合成，再设为主位</span>
            </button>
          )}
        </section>

        <section className="panel-card spirit-stable-card">
          <div className="panel-head">
            <h4>兽栏</h4>
            <span className="soft-tag">单宠出战 · 多宠收藏</span>
          </div>
          <div className="spirit-stable-grid">
            {stableSlots.map((slot) => {
              const entry = slot.spiritId ? codexById.get(slot.spiritId) ?? null : null;

              return (
                <article className={`spirit-stable-slot${slot.spiritId && entry ? '' : ' spirit-stable-slot-empty'}`} key={slot.slotIndex} onClick={() => setSelectedSlotIndex(slot.slotIndex)} role="button" tabIndex={0}>
                  <strong>{slot.spiritId && entry ? `${entry.definition.label} Lv.${slot.level}` : '空栏位'}</strong>
                  <span>{slot.spiritId && entry ? `副位 ${slot.slotIndex - 1} · ${getElementLabel(slot.element)} · ${getHealthText(slot)}` : `副位 ${slot.slotIndex - 1}`}</span>
                  <small>{slot.spiritId && entry ? `${getPhaseForLevel(slot.level)} · ${getHealthStatus(slot)}` : '可合成新宠'}</small>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {selectedSlot && portalTarget ? createPortal((
        <section className="seed-codex-screen spirit-pet-action-screen" role="dialog" aria-modal="true" aria-label="灵宠操作">
          <div className="seed-codex-topbar">
            <div className="seed-codex-title-block">
              <p className="eyebrow">{selectedSlot.isMain ? '主位' : `副位 ${selectedSlot.slotIndex - 1}`}</p>
              <p className="seed-codex-tip">{selectedSlotEntry ? `${selectedSlotEntry.definition.label} Lv.${selectedSlot.level}` : '空栏位'}</p>
            </div>
            <button className="ghost-button small" onClick={() => setSelectedSlotIndex(null)} type="button">关闭</button>
          </div>
          <div className="seed-codex-body">
            <section className="seed-codex-detail-card">
              {selectedSlotEntry ? (
                <>
                  <div className="seed-codex-detail-head">
                    <div>
                      <p className="eyebrow">{getElementLabel(selectedSlot.element)} · {getPhaseForLevel(selectedSlot.level)}</p>
                      <h3>{selectedSlotEntry.definition.label}</h3>
                    </div>
                  </div>
                  <SpiritStageCard
                    element={getElementLabel(selectedSlot.element) || undefined}
                    level={selectedSlot.level}
                    name={selectedSlotEntry.definition.label}
                    phase={getPhaseForLevel(selectedSlot.level)}
                    rarity={getRarityLabel(selectedSlotEntry.definition.rarity)}
                  />
                  <div className="seed-codex-stats">
                    <div className="seed-codex-stat-row"><strong>稀有度</strong><span>{getRarityLabel(selectedSlotEntry.definition.rarity)}</span></div>
                    <div className="seed-codex-stat-row"><strong>阵营加成</strong><span>{getFactionLabel(selectedSlotEntry.definition.factionAffinity) === playerFaction ? `已触发 ${getFactionBonusLabel(getFactionLabel(selectedSlotEntry.definition.factionAffinity))}` : `未触发，当前阵营为${playerFaction}`}</span></div>
                    <div className="seed-codex-stat-row"><strong>升级需求</strong><span>{selectedUpgradeCost ? `${selectedUpgradeCost} 兽魂` : '已满级'}</span></div>
                    <div className="seed-codex-stat-row"><strong>剩余兽魂</strong><span>{formatNumber(availableSoul)}</span></div>
                    <div className="seed-codex-stat-row"><strong>天机符</strong><span>{formatNumber(availableTianjiTalisman)}</span></div>
                    <div className="seed-codex-stat-row"><strong>当前血量</strong><span>{getHealthText(selectedSlot)}</span></div>
                    <div className="seed-codex-stat-row"><strong>当前状态</strong><span>{getHealthStatus(selectedSlot)}</span></div>
                    <div className="seed-codex-stat-row"><strong>恢复情况</strong><span>{getHealthRatio(selectedSlot) >= 100 ? `自然满血 / 今日快速恢复剩余 ${quickRecoverRemaining} 次` : `今日快速恢复剩余 ${quickRecoverRemaining} 次`}</span></div>
                  </div>
                  <div className="spirit-progress-block">
                    <div className="spirit-progress-head">
                      <span>血量</span>
                      <strong>{getHealthText(selectedSlot)}</strong>
                    </div>
                    <div className="spirit-progress-track" aria-hidden="true">
                      <div className="spirit-progress-fill spirit-progress-fill-health" style={{ width: `${getHealthRatio(selectedSlot)}%` }} />
                    </div>
                  </div>
                  <div className="spirit-pet-action-grid">
                    <button className="primary-button" disabled={busy || selectedSlot.isMain} onClick={() => onSetMain(selectedSlot.slotIndex, selectedSlot.slotVersion)} type="button">设为主位</button>
                    <button className="secondary-button" disabled={busy || !selectedUpgradeCost || availableSoul < selectedUpgradeCost} onClick={() => onUpgrade(selectedSlot.slotIndex, selectedSlot.slotVersion)} type="button">{selectedUpgradeCost ? `升级（需 ${selectedUpgradeCost}）` : '已满级'}</button>
                    <button className="secondary-button" disabled={busy || getHealthRatio(selectedSlot) >= 100 || quickRecoverRemaining <= 0 || availableTianjiTalisman <= 0} onClick={() => onRecover(selectedSlot.slotIndex, selectedSlot.slotVersion)} type="button">天机符恢复</button>
                    <button className="ghost-button" disabled={busy || selectedSlot.isMain} onClick={() => onDissolve(selectedSlot.slotIndex, selectedSlot.slotVersion)} type="button">解散（返还 35% 兽魂）</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="seed-codex-detail-head">
                    <div>
                      <p className="eyebrow">空栏位</p>
                      <h3>{selectedSlot.isMain ? '主位' : `副位 ${selectedSlot.slotIndex - 1}`}</h3>
                    </div>
                  </div>
                  {availableComposePets.length > 0 ? (
                    <>
                      <div className="spirit-compose-picker">
                        <div className="seed-codex-icon-grid spirit-compose-icon-grid">
                          {availableComposePets.map((entry) => (
                            <div className="spirit-compose-icon-item" key={entry.spiritId}>
                              <button
                                aria-label={`选择${entry.definition.label}`}
                                className={`seed-codex-icon spirit-compose-icon is-unlocked${selectedComposeEntry?.spiritId === entry.spiritId ? ' is-selected' : ''}`}
                                onClick={() => setSelectedComposeSpiritId(entry.spiritId)}
                                type="button"
                              >
                                <span>{entry.definition.label.slice(0, 2)}</span>
                              </button>
                              <small>{entry.shardCount} / {entry.definition.shardUnlockRequired}</small>
                            </div>
                          ))}
                        </div>
                      </div>
                      {selectedComposeEntry ? (
                        <>
                          <SpiritStageCard
                            level={1}
                            name={selectedComposeEntry.definition.label}
                            phase="灵胎期"
                            rarity={getRarityLabel(selectedComposeEntry.definition.rarity)}
                          />
                          <div className="spirit-element-picker">
                            {elementChoices.map((element) => (
                              <button className={`spirit-element-chip ${getElementClass(element.label)} ${composeElement === element.value ? ' is-selected' : ''}`} key={element.value} onClick={() => setComposeElement(element.value)} type="button">
                                {element.label}
                              </button>
                            ))}
                          </div>
                          <button className="primary-button spirit-full-button" disabled={busy} onClick={() => onCompose(selectedComposeEntry.spiritId, selectedSlot.slotIndex, composeElement)} type="button">确认合成并入栏</button>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <div className="seed-codex-strategy">
                      <strong>暂无待合成灵宠</strong>
                      <p>继续通过掠夺和主城赠送收集精魄。精魄满 100 后会在这里出现可合成项。</p>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </section>
      ), portalTarget) : null}

      {codexOpen && selectedCodexEntry && portalTarget ? createPortal((
        <section className="seed-codex-screen spirit-codex-screen" role="dialog" aria-modal="true" aria-label="灵宠图鉴">
          <div className="seed-codex-topbar">
            <div className="seed-codex-title-block">
              <p className="eyebrow">灵宠图鉴</p>
              <p className="seed-codex-tip">记录见过、解锁、待合成和曾经拥有过的灵宠</p>
            </div>
            <button className="ghost-button small" onClick={() => setCodexOpen(false)} type="button">关闭</button>
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
                        className={`seed-codex-icon ${discovered ? 'is-unlocked' : 'is-locked'} ${entry.spiritId === selectedCodexEntry.spiritId && discovered ? 'is-selected' : ''}`}
                        disabled={!discovered}
                        key={entry.spiritId}
                        onClick={() => setSelectedCodexSpiritId(entry.spiritId)}
                        type="button"
                      >
                        <span>{discovered ? entry.definition.label.slice(0, 2) : '？？'}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

            <section className={`seed-codex-detail-card ${isDiscovered(selectedCodexEntry) ? '' : 'is-undiscovered'}`}>
              {isDiscovered(selectedCodexEntry) ? (
                <>
                  <div className="seed-codex-detail-head">
                    <div>
                      <p className="eyebrow">{getRarityLabel(selectedCodexEntry.definition.rarity)}</p>
                      <h3>{selectedCodexEntry.definition.label}</h3>
                    </div>
                  </div>
                  <p className="seed-codex-lore">{selectedCodexEntry.definition.lore ?? '尚未补充该灵宠的额外背景描述。'}</p>
                  <div className="seed-codex-stats">
                    <div className="seed-codex-stat-row"><strong>阵营归属</strong><span>{getFactionLabel(selectedCodexEntry.definition.factionAffinity)}</span></div>
                    <div className="seed-codex-stat-row"><strong>主模板</strong><span>{getRoleLabel(selectedCodexEntry.definition.role)}</span></div>
                    <div className="seed-codex-stat-row"><strong>精魄进度</strong><span>{getShardLabel(selectedCodexEntry)}</span></div>
                    <div className="seed-codex-stat-row"><strong>曾经拥有</strong><span>{selectedCodexEntry.ownedEver ? '是' : '否'}</span></div>
                    <div className="seed-codex-stat-row"><strong>五行状态</strong><span>{selectedCodexEntry.ownedCurrent ? '已固定当前五行' : '未合成前可自选五行'}</span></div>
                  </div>
                  {isReadyToCompose(selectedCodexEntry) ? (
                    <div className="seed-codex-strategy">
                      <strong>待合成</strong>
                      <p>{isStableFull ? '当前兽栏已满，需要先解散旧宠腾出栏位。图鉴只记录状态，不直接发宠。' : '精魄已满。请返回兽栏，点开一个空栏位完成合成与五行指定。'}</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="seed-codex-undiscovered-text">尚未展示</p>
              )}
            </section>
          </div>
        </section>
      ), portalTarget) : null}
    </div>
  );
}
