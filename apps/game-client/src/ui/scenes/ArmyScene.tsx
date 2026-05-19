import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { ClientArmyTrainingQueue } from '@trinitywar/shared';

interface ArmySceneProps {
  currentArmy: number;
  armyCapacity: number;
  currentGold: number;
  playerFaction: string;
  selectedCount: number;
  onSelectCount: (count: number) => void;
  onConfirm: () => void;
  confirming: boolean;
  trainingQueue: ClientArmyTrainingQueue | null;
  unitCostGold: number;
  unitTrainingSeconds: number;
}

interface StablePet {
  id: string;
  name: string;
  level: number;
  role: string;
  element: string;
  hp: string;
  phase: string;
  occupied: boolean;
  faction: string;
  template: string;
  rarity: '普通' | '稀有' | '传说';
  everOwned?: boolean;
}

interface CodexPet {
  id: string;
  name: string;
  rarity: '普通' | '稀有' | '传说';
  faction: string;
  template: string;
  shards: string;
  discovered: boolean;
  detail: string;
  everOwned: boolean;
  selectableElement: boolean;
}

const starterPets = [
  { id: 'starter-canglang', name: '苍狼', faction: '人界', template: '攻击型', rarity: '普通' as const, detail: '山野游猎的铁爪狼，起手快，适合承担新手第一只输出宠定位。' },
  { id: 'starter-linglu', name: '灵鹿', faction: '仙界', template: '防御型', rarity: '普通' as const, detail: '饮露纳灵的山林灵兽，站场稳，适合防守向培养。' },
  { id: 'starter-yingbao', name: '影豹', faction: '魔界', template: '攻击型', rarity: '普通' as const, detail: '突进迅猛、击杀欲强，是典型高压进攻型普通宠。' },
];

const initialStablePets: StablePet[] = [
  { id: 'slot-main', name: '', level: 0, role: '主位', element: '', hp: '', phase: '选择你的第一只灵宠', occupied: false, faction: '', template: '', rarity: '普通' },
  { id: 'linglu', name: '灵鹿', level: 10, role: '副位 1', element: '水', hp: '100%', phase: '幼灵期', occupied: true, faction: '仙界', template: '防御型', rarity: '普通', everOwned: true },
  { id: 'yingbao', name: '影豹', level: 8, role: '副位 2', element: '火', hp: '91%', phase: '灵胎期', occupied: true, faction: '魔界', template: '攻击型', rarity: '普通', everOwned: true },
  { id: 'slot-3', name: '空栏位', level: 0, role: '副位 3', element: '', hp: '', phase: '可合成新宠', occupied: false, faction: '', template: '', rarity: '普通' },
  { id: 'slot-4', name: '空栏位', level: 0, role: '副位 4', element: '', hp: '', phase: '可合成新宠', occupied: false, faction: '', template: '', rarity: '普通' },
];

const initialCodexPets: CodexPet[] = [
  { id: 'canglang', name: '苍狼', rarity: '普通', faction: '人界', template: '攻击型', shards: '74 / 100', discovered: true, detail: '山野游猎的铁爪狼，起手快，适合承担新手第一只输出宠定位。', everOwned: false, selectableElement: true },
  { id: 'xuanhu', name: '玄虎', rarity: '普通', faction: '魔界', template: '攻击型', shards: '101 / 100', discovered: true, detail: '黑纹煞虎，扑杀凶猛，强调前段爆发和压制感。', everOwned: false, selectableElement: true },
  { id: 'linglu', name: '灵鹿', rarity: '普通', faction: '仙界', template: '防御型', shards: '已拥有', discovered: true, detail: '饮露纳灵的山林灵兽，站场稳，适合防守向培养。', everOwned: true, selectableElement: false },
  { id: 'qingyuan', name: '青猿', rarity: '普通', faction: '人界', template: '均衡型', shards: '已拥有', discovered: true, detail: '善于周旋和持续缠斗，成长平滑，适合长期陪跑。', everOwned: true, selectableElement: false },
  { id: 'hegui', name: '河龟', rarity: '普通', faction: '人界', template: '防御型', shards: '0 / 100', discovered: false, detail: '', everOwned: false, selectableElement: true },
  { id: 'shuanghu', name: '霜狐', rarity: '普通', faction: '仙界', template: '均衡型', shards: '102 / 100', discovered: true, detail: '擅长拉扯与消耗，速度观感轻巧，适合侦查与反制氛围。', everOwned: false, selectableElement: true },
  { id: 'yingbao', name: '影豹', rarity: '普通', faction: '魔界', template: '攻击型', shards: '已拥有', discovered: true, detail: '突进迅猛、击杀欲强，是典型高压进攻型普通宠。', everOwned: true, selectableElement: false },
  { id: 'yunying', name: '云鹰', rarity: '普通', faction: '仙界', template: '攻击型', shards: '0 / 100', discovered: false, detail: '', everOwned: false, selectableElement: true },
  { id: 'shanxiong', name: '山熊', rarity: '普通', faction: '魔界', template: '血量型', shards: '0 / 100', discovered: false, detail: '', everOwned: false, selectableElement: true },
  { id: 'chenghuang', name: '乘黄', rarity: '稀有', faction: '仙界', template: '防御型', shards: '108 / 100', discovered: true, detail: '瑞兽气质鲜明，防守反制能力突出，适合作为仙界高阶门面。', everOwned: false, selectableElement: true },
  { id: 'eshou', name: '讹兽', rarity: '稀有', faction: '人界', template: '均衡型', shards: '0 / 100', discovered: false, detail: '', everOwned: false, selectableElement: true },
  { id: 'xuangui', name: '旋龟', rarity: '稀有', faction: '仙界', template: '防御型', shards: '0 / 100', discovered: false, detail: '', everOwned: false, selectableElement: true },
  { id: 'jiaoshou', name: '狡', rarity: '稀有', faction: '魔界', template: '攻击型', shards: '0 / 100', discovered: false, detail: '', everOwned: false, selectableElement: true },
  { id: 'dangkang', name: '当康', rarity: '稀有', faction: '人界', template: '血量型', shards: '0 / 100', discovered: false, detail: '', everOwned: false, selectableElement: true },
  { id: 'zhuyan', name: '朱厌', rarity: '稀有', faction: '魔界', template: '攻击型', shards: '0 / 100', discovered: false, detail: '', everOwned: false, selectableElement: true },
  { id: 'fenghuang', name: '凤皇', rarity: '传说', faction: '仙界', template: '防御型', shards: '18 / 100', discovered: true, detail: '仙界至尊灵禽，兼具威仪与护佑感，适合作为顶级防守反制型传说宠。', everOwned: false, selectableElement: true },
  { id: 'xueyan', name: '血魇', rarity: '传说', faction: '魔界', template: '攻击型', shards: '0 / 100', discovered: false, detail: '', everOwned: false, selectableElement: true },
  { id: 'yinglong', name: '应龙', rarity: '传说', faction: '人界', template: '血量型', shards: '0 / 100', discovered: false, detail: '', everOwned: false, selectableElement: true },
];

const elementChoices = ['金', '木', '水', '火', '土'] as const;

const codexRarityGroups = [
  { key: 'common', label: '普通', rarity: '普通' as const },
  { key: 'rare', label: '稀有', rarity: '稀有' as const },
  { key: 'legend', label: '传说', rarity: '传说' as const },
];

const MAX_QUICK_RECOVERY_PER_DAY = 3;

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function getElementClass(element: string): string {
  if (element === '金') {
    return 'spirit-element-metal';
  }
  if (element === '木') {
    return 'spirit-element-wood';
  }
  if (element === '水') {
    return 'spirit-element-water';
  }
  if (element === '火') {
    return 'spirit-element-fire';
  }
  if (element === '土') {
    return 'spirit-element-earth';
  }
  return 'spirit-element-wood';
}

function getRarityClass(rarity: StablePet['rarity']): string {
  if (rarity === '传说') {
    return 'spirit-rarity-legend';
  }
  if (rarity === '稀有') {
    return 'spirit-rarity-rare';
  }
  return 'spirit-rarity-common';
}

function parseShardProgress(shards: string): { current: number; target: number } | null {
  const match = shards.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) {
    return null;
  }
  return {
    current: Number(match[1]),
    target: Number(match[2]),
  };
}

function isReadyToCompose(pet: CodexPet): boolean {
  if (pet.shards === '待合成') {
    return true;
  }
  const progress = parseShardProgress(pet.shards);
  return Boolean(progress && progress.current >= progress.target);
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

function getHealthRatio(hpText: string): number {
  const value = Number(hpText.replace('%', ''));
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 100);
}

function getHealthStatus(hpText: string): string {
  const value = Number(hpText.replace('%', ''));
  if (!Number.isFinite(value)) {
    return '状态正常';
  }
  if (value >= 70) {
    return '状态正常';
  }
  if (value >= 30) {
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

function SpiritStageCard(props: {
  name: string;
  phase: string;
  level: number;
  element?: string;
  rarity: StablePet['rarity'];
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
  const { currentArmy, currentGold, playerFaction, selectedCount, onConfirm, confirming, unitCostGold } = props;
  const [stablePets, setStablePets] = useState<StablePet[]>(initialStablePets);
  const [codexPets, setCodexPets] = useState<CodexPet[]>(initialCodexPets);
  const [codexOpen, setCodexOpen] = useState(false);
  const [selectedStablePetId, setSelectedStablePetId] = useState<string | null>(null);
  const [selectedCodexPetId, setSelectedCodexPetId] = useState(() => initialCodexPets.find((pet) => pet.discovered)?.id ?? initialCodexPets[0]?.id);
  const [starterOpen, setStarterOpen] = useState(false);
  const [selectedStarterId, setSelectedStarterId] = useState<string | null>(null);
  const [starterElement, setStarterElement] = useState<(typeof elementChoices)[number]>('木');
  const [selectedComposePetId, setSelectedComposePetId] = useState(() => initialCodexPets.find((pet) => isReadyToCompose(pet))?.id ?? '');
  const [composeElement, setComposeElement] = useState<(typeof elementChoices)[number]>('木');
  const [soulSpendOffset, setSoulSpendOffset] = useState(0);
  const [quickRecoveryUsed, setQuickRecoveryUsed] = useState(0);
  const affordableCount = unitCostGold > 0 ? Math.floor(currentGold / unitCostGold) : 0;
  const actualRecruitCount = Math.min(Math.max(selectedCount, affordableCount > 0 ? 1 : 0), affordableCount);
  const canConfirm = actualRecruitCount > 0 && !confirming;
  const mainPet = stablePets[0];
  const selectedStablePet = stablePets.find((pet) => pet.id === selectedStablePetId) ?? null;
  const selectedCodexPet = codexPets.find((pet) => pet.id === selectedCodexPetId) ?? codexPets.find((pet) => pet.discovered);
  const portalTarget = typeof document === 'undefined' ? null : document.querySelector('.phone-frame');
  const occupiedCount = stablePets.filter((pet) => pet.occupied).length;
  const isStableFull = occupiedCount >= 5;
  const availableSoul = Math.max(currentArmy - soulSpendOffset, 0);
  const quickRecoverRemaining = Math.max(MAX_QUICK_RECOVERY_PER_DAY - quickRecoveryUsed, 0);
  const availableComposePets = codexPets.filter((pet) => isReadyToCompose(pet));
  const selectedComposePet = availableComposePets.find((pet) => pet.id === selectedComposePetId) ?? availableComposePets[0] ?? null;
  const selectedUpgradeCost = selectedStablePet?.occupied ? getUpgradeCost(selectedStablePet.level) : null;
  const codexGroups = codexRarityGroups.map((group) => ({
    ...group,
    pets: codexPets.filter((pet) => pet.rarity === group.rarity),
  }));

  function handleStarterConfirm(): void {
    const starter = starterPets.find((pet) => pet.id === selectedStarterId);
    if (!starter) {
      return;
    }

    setStablePets((current) => {
      const next = [...current];
      next[0] = {
        id: starter.name.toLowerCase(),
        name: starter.name,
        level: 1,
        role: '主位',
        element: starterElement,
        hp: '100%',
        phase: '灵胎期',
        occupied: true,
        faction: starter.faction,
        template: starter.template,
        rarity: starter.rarity,
        everOwned: true,
      };
      return next;
    });

    setCodexPets((current) => current.map((pet) => (
      pet.name === starter.name
        ? { ...pet, discovered: true, shards: '已拥有', everOwned: true, selectableElement: false }
        : pet
    )));

    setStarterOpen(false);
    setSelectedStarterId(null);
  }

  function handleComposeCodexPet(targetSlotId: string): void {
    if (!selectedComposePet) {
      return;
    }

    setStablePets((current) => current.map((pet) => (
      pet.id !== targetSlotId || pet.occupied || pet.role === '主位'
        ? pet
        : {
            id: `${pet.id}-${selectedComposePet.id}`,
            name: selectedComposePet.name,
            level: 1,
            role: pet.role,
            element: composeElement,
            hp: '100%',
            phase: '灵胎期',
            occupied: true,
            faction: selectedComposePet.faction,
            template: selectedComposePet.template,
            rarity: selectedComposePet.rarity,
            everOwned: true,
          }
    )));

    setCodexPets((current) => current.map((pet) => (
      pet.id === selectedComposePet.id
        ? { ...pet, shards: '已拥有', everOwned: true, selectableElement: false }
        : pet
    )));
    setSelectedStablePetId(null);
  }

  function handleOpenStablePet(petId: string): void {
    setSelectedStablePetId(petId);
  }

  function handleCloseStablePet(): void {
    setSelectedStablePetId(null);
  }

  function handlePickComposePet(petId: string): void {
    setSelectedComposePetId(petId);
  }

  function handleDissolvePet(petId: string): void {
    setStablePets((current) => current.map((pet) => (
      pet.id !== petId
        ? pet
        : {
            ...pet,
            name: '空栏位',
            level: 0,
            element: '',
            hp: '',
            phase: '已腾出栏位',
            occupied: false,
            faction: '',
            template: '',
            rarity: '普通',
          }
    )));
    setSelectedStablePetId(null);
  }

  function handleSetMainPet(petId: string): void {
    setStablePets((current) => {
      const targetIndex = current.findIndex((pet) => pet.id === petId);
      if (targetIndex <= 0 || !current[targetIndex]?.occupied) {
        return current;
      }

      const next = [...current];
      const targetPet = next[targetIndex];
      const currentMain = next[0];
      const targetRole = targetPet.role;
      next[0] = { ...targetPet, role: '主位' };
      next[targetIndex] = currentMain.occupied
        ? { ...currentMain, role: targetRole }
        : {
            ...currentMain,
            role: targetRole,
            name: '空栏位',
            phase: '可合成新宠',
          };
      return next;
    });
    setSelectedStablePetId(null);
  }

  function handleUpgradePet(petId: string): void {
    const pet = stablePets.find((item) => item.id === petId);
    if (!pet) {
      return;
    }
    const cost = getUpgradeCost(pet.level);
    if (!cost || availableSoul < cost) {
      return;
    }

    setSoulSpendOffset((current) => current + cost);
    setStablePets((current) => current.map((item) => (
      item.id === petId
        ? { ...item, level: item.level + 1, phase: getPhaseForLevel(item.level + 1) }
        : item
    )));
  }

  function handleRecoverPet(petId: string): void {
    const pet = stablePets.find((item) => item.id === petId);
    if (!pet || getHealthRatio(pet.hp) >= 100 || quickRecoverRemaining <= 0) {
      return;
    }

    setQuickRecoveryUsed((current) => current + 1);
    setStablePets((current) => current.map((item) => (
      item.id === petId
        ? { ...item, hp: '100%' }
        : item
    )));
  }

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
            </div>
            <button className="primary-button small" disabled={!canConfirm} onClick={onConfirm} type="button">
              {confirming ? '购买中' : '购买兽魂'}
            </button>
          </article>
        </section>

        <section className="spirit-main-row">
          {mainPet.occupied ? (
            <article className="spirit-profile-card spirit-profile-card-horizontal" onClick={() => setSelectedStablePetId(mainPet.id)} role="button" tabIndex={0}>
              <div className={`spirit-portrait ${getElementClass(mainPet.element)}`} aria-hidden="true">
                <span>{mainPet.name.slice(0, 1)}</span>
              </div>
              <div className="spirit-profile-main">
                <div className="spirit-name-row">
                  <div>
                    <p className="eyebrow">主位灵宠</p>
                    <h4>{mainPet.name}</h4>
                  </div>
                  <strong>Lv.{mainPet.level}</strong>
                </div>
                <div className="spirit-tag-row">
                  <span className={`spirit-rarity ${getRarityClass(mainPet.rarity)}`}>{mainPet.rarity}</span>
                  <span className="faction-badge">{mainPet.faction}</span>
                  <span className={`spirit-element-chip ${getElementClass(mainPet.element)}`}>{mainPet.element}</span>
                  <span className="soft-tag">{mainPet.template}</span>
                  <span className="soft-tag">{mainPet.phase}</span>
                  {mainPet.faction === playerFaction ? <span className="soft-tag">同阵营 {getFactionBonusLabel(mainPet.faction)}</span> : null}
                </div>
              </div>
            </article>
          ) : (
            <button className="spirit-empty-main-card" onClick={() => setStarterOpen(true)} type="button">
              <span className="spirit-empty-main-plus">+</span>
              <strong>选择你的第一只灵宠</strong>
              <span>初始账号先从三界随机首宠里三选一</span>
            </button>
          )}
        </section>

        <section className="panel-card spirit-stable-card">
          <div className="panel-head">
            <h4>兽栏</h4>
            <span className="soft-tag">单宠出战 · 多宠收藏</span>
          </div>
          <div className="spirit-stable-grid">
            {stablePets.slice(1).map((pet) => (
              <article className={`spirit-stable-slot${pet.occupied ? '' : ' spirit-stable-slot-empty'}`} key={pet.id} onClick={() => handleOpenStablePet(pet.id)} role="button" tabIndex={0}>
                <strong>{pet.occupied ? `${pet.name} Lv.${pet.level}` : pet.name}</strong>
                <span>{pet.occupied ? `${pet.role} · ${pet.element} · ${pet.hp}` : pet.role}</span>
                <small>{pet.occupied ? `${pet.phase} · ${getHealthStatus(pet.hp)}` : pet.phase}</small>
              </article>
            ))}
          </div>
        </section>
      </div>

      {starterOpen && portalTarget ? createPortal((
        <section className="seed-codex-screen spirit-starter-screen" role="dialog" aria-modal="true" aria-label="首宠选择">
          <div className="seed-codex-topbar">
            <div className="seed-codex-title-block">
              <p className="eyebrow">首宠三选一</p>
              <p className="seed-codex-tip">初始账号先选择一只主位灵宠，再确定它的五行属性</p>
            </div>
            <button className="ghost-button small" onClick={() => setStarterOpen(false)} type="button">关闭</button>
          </div>
          <div className="seed-codex-body">
            <section className="seed-codex-detail-card">
              <div className="spirit-starter-grid">
                {starterPets.map((pet) => (
                  <button className={`spirit-starter-card${selectedStarterId === pet.id ? ' is-selected' : ''}`} key={pet.id} onClick={() => setSelectedStarterId(pet.id)} type="button">
                    <strong>{pet.name}</strong>
                    <span>{pet.faction} · {pet.template}</span>
                    <small>{pet.detail}</small>
                  </button>
                ))}
              </div>
            </section>
            {selectedStarterId ? (
              <section className="seed-codex-detail-card">
                <div className="seed-codex-detail-head">
                  <div>
                    <p className="eyebrow">选择五行</p>
                    <h3>金木水火土五选一</h3>
                  </div>
                </div>
                <p className="seed-codex-lore">五行相克：金克木，木克土，土克水，水克火，火克金。真正出战时只有 1 只主战灵宠，所以五行会直接影响掠夺前的出手判断。</p>
                <div className="spirit-element-picker">
                  {elementChoices.map((element) => (
                    <button className={`spirit-element-chip ${starterElement === element ? ' is-selected' : ''}`} key={element} onClick={() => setStarterElement(element)} type="button">
                      {element}
                    </button>
                  ))}
                </div>
                <button className="primary-button spirit-full-button" onClick={handleStarterConfirm} type="button">确认首宠与五行</button>
              </section>
            ) : null}
          </div>
        </section>
      ), portalTarget) : null}

      {selectedStablePet && portalTarget ? createPortal((
        <section className="seed-codex-screen spirit-pet-action-screen" role="dialog" aria-modal="true" aria-label="灵宠操作">
          <div className="seed-codex-topbar">
            <div className="seed-codex-title-block">
              <p className="eyebrow">{selectedStablePet.role}</p>
              <p className="seed-codex-tip">{selectedStablePet.occupied ? `${selectedStablePet.name} Lv.${selectedStablePet.level}` : '空栏位'}</p>
            </div>
            <button className="ghost-button small" onClick={handleCloseStablePet} type="button">关闭</button>
          </div>
          <div className="seed-codex-body">
            <section className="seed-codex-detail-card">
              {selectedStablePet.occupied ? (
                <>
                  <div className="seed-codex-detail-head">
                    <div>
                      <p className="eyebrow">{selectedStablePet.element} · {selectedStablePet.phase}</p>
                      <h3>{selectedStablePet.name}</h3>
                    </div>
                  </div>
                  <SpiritStageCard
                    element={selectedStablePet.element}
                    level={selectedStablePet.level}
                    name={selectedStablePet.name}
                    phase={selectedStablePet.phase}
                    rarity={selectedStablePet.rarity}
                  />
                  <div className="seed-codex-stats">
                    <div className="seed-codex-stat-row"><strong>稀有度</strong><span>{selectedStablePet.rarity}</span></div>
                    <div className="seed-codex-stat-row"><strong>阵营加成</strong><span>{selectedStablePet.faction === playerFaction ? `已触发 ${getFactionBonusLabel(selectedStablePet.faction)}` : `未触发，当前阵营为${playerFaction}`}</span></div>
                    <div className="seed-codex-stat-row"><strong>升级需求</strong><span>{selectedUpgradeCost ? `${selectedUpgradeCost} 兽魂` : '已满级'}</span></div>
                    <div className="seed-codex-stat-row"><strong>剩余兽魂</strong><span>{formatNumber(availableSoul)}</span></div>
                    <div className="seed-codex-stat-row"><strong>当前血量</strong><span>{selectedStablePet.hp}</span></div>
                    <div className="seed-codex-stat-row"><strong>当前状态</strong><span>{getHealthStatus(selectedStablePet.hp)}</span></div>
                    <div className="seed-codex-stat-row"><strong>恢复情况</strong><span>{selectedStablePet.hp === '100%' ? `自然满血 / 今日快速恢复剩余 ${quickRecoverRemaining} 次` : `自然恢复约 1小时36分 / 今日快速恢复剩余 ${quickRecoverRemaining} 次`}</span></div>
                  </div>
                  <div className="spirit-progress-block">
                    <div className="spirit-progress-head">
                      <span>血量</span>
                      <strong>{selectedStablePet.hp}</strong>
                    </div>
                    <div className="spirit-progress-track" aria-hidden="true">
                      <div className="spirit-progress-fill spirit-progress-fill-health" style={{ width: `${getHealthRatio(selectedStablePet.hp)}%` }} />
                    </div>
                  </div>
                  <div className="spirit-pet-action-grid">
                    <button className="primary-button" disabled={selectedStablePet.role === '主位'} onClick={() => handleSetMainPet(selectedStablePet.id)} type="button">设为主位</button>
                    <button className="secondary-button" disabled={!selectedUpgradeCost || availableSoul < selectedUpgradeCost} onClick={() => handleUpgradePet(selectedStablePet.id)} type="button">{selectedUpgradeCost ? `升级（需 ${selectedUpgradeCost}）` : '已满级'}</button>
                    <button className="secondary-button" disabled={getHealthRatio(selectedStablePet.hp) >= 100 || quickRecoverRemaining <= 0} onClick={() => handleRecoverPet(selectedStablePet.id)} type="button">天机符恢复</button>
                    <button className="ghost-button" onClick={() => handleDissolvePet(selectedStablePet.id)} type="button">解散（返还 35% 兽魂）</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="seed-codex-detail-head">
                    <div>
                      <p className="eyebrow">空栏位</p>
                      <h3>{selectedStablePet.role}</h3>
                    </div>
                  </div>
                  {availableComposePets.length > 0 ? (
                    <>
                      <div className="spirit-compose-picker">
                        <div className="seed-codex-icon-grid spirit-compose-icon-grid">
                        {availableComposePets.map((pet) => (
                          <div className="spirit-compose-icon-item" key={pet.id}>
                            <button
                              aria-label={`选择${pet.name}`}
                              className={`seed-codex-icon spirit-compose-icon is-unlocked${selectedComposePet?.id === pet.id ? ' is-selected' : ''}`}
                              onClick={() => handlePickComposePet(pet.id)}
                              type="button"
                            >
                              <span>{pet.name.slice(0, 2)}</span>
                            </button>
                            <small>{pet.shards === '待合成' ? '100/100' : pet.shards.replace(/\s/g, '')}</small>
                          </div>
                        ))}
                        </div>
                      </div>
                      {selectedComposePet ? (
                        <>
                          <SpiritStageCard
                            level={1}
                            name={selectedComposePet.name}
                            phase="灵胎期"
                            rarity={selectedComposePet.rarity}
                          />
                          <div className="spirit-element-picker">
                            {elementChoices.map((element) => (
                              <button className={`spirit-element-chip ${getElementClass(element)} ${composeElement === element ? ' is-selected' : ''}`} key={element} onClick={() => setComposeElement(element)} type="button">
                                {element}
                              </button>
                            ))}
                          </div>
                          <button className="primary-button spirit-full-button" onClick={() => handleComposeCodexPet(selectedStablePet.id)} type="button">确认合成并入栏</button>
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

      {codexOpen && selectedCodexPet && portalTarget ? createPortal((
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
                  {group.pets.map((pet) => (
                    <button
                      aria-label={pet.discovered ? pet.name : '尚未展示'}
                      className={`seed-codex-icon ${pet.discovered ? 'is-unlocked' : 'is-locked'} ${pet.id === selectedCodexPet.id && pet.discovered ? 'is-selected' : ''}`}
                      disabled={!pet.discovered}
                      key={pet.id}
                      onClick={() => setSelectedCodexPetId(pet.id)}
                      type="button"
                    >
                      <span>{pet.discovered ? pet.name.slice(0, 2) : '？？'}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}

            <section className={`seed-codex-detail-card ${selectedCodexPet.discovered ? '' : 'is-undiscovered'}`}>
              {selectedCodexPet.discovered ? (
                <>
                  <div className="seed-codex-detail-head">
                    <div>
                      <p className="eyebrow">{selectedCodexPet.rarity}</p>
                      <h3>{selectedCodexPet.name}</h3>
                    </div>
                  </div>
                  <p className="seed-codex-lore">{selectedCodexPet.detail}</p>
                  <div className="seed-codex-stats">
                    <div className="seed-codex-stat-row"><strong>阵营归属</strong><span>{selectedCodexPet.faction}</span></div>
                    <div className="seed-codex-stat-row"><strong>主模板</strong><span>{selectedCodexPet.template}</span></div>
                    <div className="seed-codex-stat-row"><strong>精魄进度</strong><span>{selectedCodexPet.shards}</span></div>
                    <div className="seed-codex-stat-row"><strong>曾经拥有</strong><span>{selectedCodexPet.everOwned ? '是' : '否'}</span></div>
                    <div className="seed-codex-stat-row"><strong>五行状态</strong><span>{selectedCodexPet.selectableElement ? '未合成前可自选五行' : '已固定当前五行'}</span></div>
                  </div>
                  {isReadyToCompose(selectedCodexPet) ? (
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
