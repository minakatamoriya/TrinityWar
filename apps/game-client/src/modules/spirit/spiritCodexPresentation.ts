import type {
  ClientSpiritCodexEntry,
  ClientSpiritRarity,
  ClientSpiritRole,
} from '@trinitywar/shared';

export type SpiritCodexDisplayRarity = '普通' | '稀有' | '传说';

export function getSpiritCodexRarityLabel(rarity: ClientSpiritRarity): SpiritCodexDisplayRarity {
  if (rarity === 'legendary') {
    return '传说';
  }
  if (rarity === 'rare') {
    return '稀有';
  }
  return '普通';
}

export function getSpiritFactionLabel(faction: ClientSpiritCodexEntry['definition']['factionAffinity']): string {
  if (faction === 'immortal') {
    return '仙界';
  }
  if (faction === 'demon') {
    return '魔界';
  }
  return '人界';
}

export function getSpiritRoleLabel(role: ClientSpiritRole): string {
  if (role === 'attack') {
    return '攻击型';
  }
  if (role === 'health') {
    return '血量型';
  }
  return '均衡型';
}

export function isSpiritCodexVisible(entry: ClientSpiritCodexEntry): boolean {
  return entry.ownedCurrent || entry.ownedEver || entry.readyToCompose || entry.shardCount > 0;
}

export function getFirstVisibleSpiritCodexId(entries: ClientSpiritCodexEntry[]): string | null {
  return entries.find((entry) => isSpiritCodexVisible(entry))?.spiritId ?? entries[0]?.spiritId ?? null;
}

export function getSpiritCodexName(entry: ClientSpiritCodexEntry): string {
  return isSpiritCodexVisible(entry) ? entry.definition.label : '未知灵宠';
}

export function getSpiritCodexStatusLabel(entry: ClientSpiritCodexEntry): string {
  if (entry.ownedCurrent) {
    return '已拥有';
  }
  if (entry.readyToCompose) {
    return '待合成';
  }
  if (entry.shardCount > 0) {
    return '收集中';
  }
  if (entry.ownedEver) {
    return '已收录';
  }
  return '未可见';
}

export function getSpiritCodexVisibilityLabel(entry: ClientSpiritCodexEntry): string {
  return isSpiritCodexVisible(entry) ? '已可见' : '未可见';
}

export function getSpiritCodexShardProgress(entry: ClientSpiritCodexEntry): string {
  const required = Math.max(entry.definition.shardUnlockRequired, 0);
  const current = Math.min(Math.max(entry.shardCount, 0), required);
  return `${current} / ${required}`;
}

export function formatSpiritUnlockRequirement(entry: ClientSpiritCodexEntry): string {
  const required = Math.max(entry.definition.shardUnlockRequired, 0);
  const progress = getSpiritCodexShardProgress(entry);

  if (isSpiritCodexVisible(entry)) {
    return `已收集 ${entry.definition.shardName} ${progress}，满 ${required} 后可解锁合成资格。`;
  }

  return `首次获得对应精魄后开放完整图鉴信息；累计收集满 ${required} 个对应精魄后可解锁合成资格。`;
}
