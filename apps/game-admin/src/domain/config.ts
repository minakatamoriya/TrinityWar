import type { AdminRecord, ConfigField } from '../types';

export const seedConfigFields: ConfigField[] = [
  { key: 'seedId', label: '种子 ID / seedId' },
  { key: 'label', label: '名称 / label' },
  { key: 'rarity', label: '稀有度 / rarity', inputType: 'select', options: ['common', 'rare', 'legendary'] },
  { key: 'seedSeconds', label: '播种秒数 / seedSeconds', inputType: 'number' },
  { key: 'growSeconds', label: '生长秒数 / growSeconds', inputType: 'number' },
  { key: 'matureSeconds', label: '成熟秒数 / matureSeconds', inputType: 'number' },
  { key: 'ripeWindowSeconds', label: '丰熟窗口秒数 / ripeWindowSeconds', inputType: 'number' },
  { key: 'baseYieldGold', label: '基础产金 / baseYieldGold', inputType: 'number' },
  { key: 'harvestSeedReturn', label: '收获返种 / harvestSeedReturn', inputType: 'number' },
  { key: 'strategyNote', label: '策略说明 / strategyNote', inputType: 'textarea', nullable: true },
  { key: 'lore', label: '背景 / lore', inputType: 'textarea', nullable: true },
];

export const spiritConfigFields: ConfigField[] = [
  { key: 'spiritId', label: '灵宠 ID / spiritId' },
  { key: 'label', label: '名称 / label' },
  { key: 'rarity', label: '稀有度 / rarity', inputType: 'select', options: ['COMMON', 'RARE', 'LEGENDARY'] },
  { key: 'factionAffinity', label: '阵营亲和 / factionAffinity', inputType: 'select', options: ['human', 'immortal', 'demon'] },
  { key: 'role', label: '定位 / role', inputType: 'select', options: ['ATTACK', 'DEFENSE', 'BALANCED', 'HEALTH'] },
  { key: 'shardName', label: '精魄名 / shardName' },
  { key: 'shardUnlockRequired', label: '合成所需精魄 / shardUnlockRequired', inputType: 'number' },
  { key: 'baseAttack', label: '基础攻击 / baseAttack', inputType: 'number' },
  { key: 'baseDefense', label: '基础防御 / baseDefense', inputType: 'number' },
  { key: 'baseHp', label: '基础生命 / baseHp', inputType: 'number' },
  { key: 'growthAttack', label: '攻击成长 / growthAttack', inputType: 'number' },
  { key: 'growthDefense', label: '防御成长 / growthDefense', inputType: 'number' },
  { key: 'growthHp', label: '生命成长 / growthHp', inputType: 'number' },
  { key: 'sortOrder', label: '排序 / sortOrder', inputType: 'number' },
  { key: 'lore', label: '背景 / lore', inputType: 'textarea', nullable: true },
];

export function createEmptyConfigForm(fields: ConfigField[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, field.options?.[0] ?? '']));
}

export function buildConfigPayload(fields: ConfigField[], form: Record<string, string>): Record<string, string | number | null> {
  return Object.fromEntries(fields.map((field) => {
    const value = form[field.key] ?? '';
    if (field.inputType === 'number') {
      return [field.key, Number(value)];
    }
    if (field.nullable && value.trim() === '') {
      return [field.key, null];
    }
    return [field.key, value.trim()];
  }));
}

export function createConfigFormFromRecord(fields: ConfigField[], record: AdminRecord): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, record[field.key] === null || record[field.key] === undefined ? '' : String(record[field.key])]));
}
