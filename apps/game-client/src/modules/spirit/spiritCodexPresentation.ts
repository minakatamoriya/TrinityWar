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
  return entry.sceneVisibility === 'named';
}

export function getFirstVisibleSpiritCodexId(entries: ClientSpiritCodexEntry[]): string | null {
  return entries.find((entry) => isSpiritCodexVisible(entry))?.spiritId ?? entries[0]?.spiritId ?? null;
}

export function getSpiritCodexName(entry: ClientSpiritCodexEntry): string {
  return entry.displayName;
}

export function getSpiritCodexStatusLabel(entry: ClientSpiritCodexEntry): string {
  if (entry.ownedCurrent && entry.readyToCompose) {
    return '已拥有，可再次合成';
  }
  if (entry.ownedCurrent) {
    return '已拥有';
  }
  if (entry.readyToCompose) {
    return '待合成';
  }
  if (entry.ownedEver) {
    return '已收录';
  }
  if (entry.shardCount > 0 || entry.codexState === 'visible-progress') {
    return '收集中';
  }
  return '未可见';
}

export function getSpiritCodexVisibilityLabel(entry: ClientSpiritCodexEntry): string {
  if (entry.codexState === 'unlocked') {
    return '已解锁';
  }
  if (entry.codexState === 'visible-progress') {
    return '已可见';
  }
  return '未可见';
}

export function getSpiritCodexShardProgress(entry: ClientSpiritCodexEntry): string {
  const required = Math.max(entry.definition.shardUnlockRequired, 0);
  const current = Math.min(Math.max(entry.shardCount, 0), required);
  return `${current} / ${required}`;
}

export function getSpiritCodexProgressLabel(entry: ClientSpiritCodexEntry): string {
  if (entry.codexState === 'unlocked') {
    return entry.readyToCompose ? '已解锁，可再次合成' : '已解锁';
  }

  return getSpiritCodexShardProgress(entry);
}

export function formatSpiritUnlockRequirement(entry: ClientSpiritCodexEntry): string {
  const required = Math.max(entry.definition.shardUnlockRequired, 0);

  if (entry.codexState === 'unlocked') {
    return entry.readyToCompose
      ? '当前灵宠已解锁，且已满足再次合成条件。'
      : '当前灵宠已解锁。';
  }

  if (entry.codexState !== 'hidden') {
    return `已收集 ${entry.definition.shardName} ${getSpiritCodexShardProgress(entry)}，达到 ${required} 个后可获得合成资格。`;
  }

  return `首次获得对应精魄后开放完整图鉴信息；累计收集达到 ${required} 个对应精魄后可获得合成资格。`;
}

export function getSpiritComposeAvailabilityLabel(entry: ClientSpiritCodexEntry): string {
  if (entry.readyToCompose) {
    return entry.ownedCurrent ? '已拥有，可再次合成' : '已备齐，可合成';
  }

  return '可结契';
}
