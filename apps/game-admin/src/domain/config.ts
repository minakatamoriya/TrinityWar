import type { AdminRecord, ConfigField } from '../types';

export const seedConfigFields: ConfigField[] = [
  { key: 'seedId', label: '灵植 ID / seedId' },
  { key: 'label', label: '名称 / label' },
  { key: 'rarity', label: '稀有度 / rarity', inputType: 'select', options: ['common', 'rare', 'legendary'] },
  { key: 'growSeconds', label: '成长秒数 / growSeconds', inputType: 'number' },
  { key: 'matureSeconds', label: '成熟秒数 / matureSeconds', inputType: 'number' },
  { key: 'collectWindowSeconds', label: '可收窗口秒数 / collectWindowSeconds', inputType: 'number' },
  { key: 'baseYieldGold', label: '基础产金 / baseYieldGold', inputType: 'number' },
  { key: 'harvestSeedReturn', label: '兼容返还 / harvestSeedReturn', inputType: 'number' },
  { key: 'sortOrder', label: '排序 / sortOrder', inputType: 'number' },
  { key: 'strategyNote', label: '策略说明 / strategyNote', inputType: 'textarea', nullable: true },
  { key: 'lore', label: '背景 / lore', inputType: 'textarea', nullable: true },
];

export const spiritConfigFields: ConfigField[] = [
  { key: 'spiritId', label: '灵宠 ID / spiritId' },
  { key: 'label', label: '名称 / label' },
  { key: 'rarity', label: '稀有度 / rarity', inputType: 'select', options: ['COMMON', 'RARE', 'LEGENDARY'] },
  { key: 'factionAffinity', label: '阵营亲和 / factionAffinity', inputType: 'select', options: ['human', 'immortal', 'demon'] },
  { key: 'role', label: '定位 / role', inputType: 'select', options: ['ATTACK', 'BALANCED', 'HEALTH'] },
  { key: 'shardName', label: '兽魂名称 / shardName' },
  { key: 'shardUnlockRequired', label: '合成所需兽魂 / shardUnlockRequired', inputType: 'number' },
  { key: 'baseAttack', label: '基础攻击 / baseAttack', inputType: 'number' },
  { key: 'baseHp', label: '基础生命 / baseHp', inputType: 'number' },
  { key: 'growthAttack', label: '攻击成长 / growthAttack', inputType: 'number' },
  { key: 'growthHp', label: '生命成长 / growthHp', inputType: 'number' },
  { key: 'sortOrder', label: '排序 / sortOrder', inputType: 'number' },
  { key: 'lore', label: '背景 / lore', inputType: 'textarea', nullable: true },
];

export const taskConfigFields: ConfigField[] = [
  { key: 'taskGroup', label: '配置分类 / taskGroup', inputType: 'select', options: ['starter', 'contribution'] },
  { key: 'taskId', label: '配置 ID / taskId' },
  { key: 'title', label: '名称 / title' },
  { key: 'description', label: '描述 / description', inputType: 'textarea', nullable: true },
  { key: 'targetCount', label: '目标或触发数量 / targetCount', inputType: 'number' },
  { key: 'rewardGold', label: '奖励金币 / rewardGold', inputType: 'number' },
  { key: 'rewardContribution', label: '贡献值 / rewardContribution', inputType: 'number' },
  { key: 'isEnabled', label: '是否启用 / isEnabled', inputType: 'select', options: ['true', 'false'] },
];

export function createEmptyConfigForm(fields: ConfigField[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, field.options?.[0] ?? '']));
}

export function buildConfigPayload(fields: ConfigField[], form: Record<string, string>): Record<string, string | number | null> {
  return Object.fromEntries(fields.map((field) => {
    const value = form[field.key] ?? '';
    if (field.inputType === 'number') {
      return [field.key, value.trim() === '' ? null : Number(value)];
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
