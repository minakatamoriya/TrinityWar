import type { ClientSpiritState } from '@trinitywar/shared';
import { playableSeedCatalog } from '../farm/seedPresentation';
import type { BackpackResourceItem } from '../../ui/common/ResourceBackpackModal';
import type { SeedRarity } from '../../config/seedCatalog';

const rarityOrder: Record<SeedRarity, number> = { common: 0, rare: 1, legendary: 2 };

export function buildBackpackResourceItems(input: {
  spiritState: ClientSpiritState | null;
  unlockedSeedIds: string[];
  seedInventory: Record<string, number>;
}): BackpackResourceItem[] {
  const raidShardResourceItems: BackpackResourceItem[] = (input.spiritState?.codex ?? [])
    .filter((entry) => entry.hasSeen || entry.ownedEver || entry.ownedCurrent || entry.shardCount > 0)
    .sort((left, right) => {
      const rarityDiff = rarityOrder[left.definition.rarity] - rarityOrder[right.definition.rarity];
      return rarityDiff !== 0 ? rarityDiff : left.definition.label.localeCompare(right.definition.label, 'zh-Hans-CN');
    })
    .map((entry) => ({
      id: `spirit-shard-${entry.spiritId}`,
      label: entry.definition.shardName,
      quantity: entry.shardCount,
      group: 'raid-shard' as const,
      rarity: entry.definition.rarity,
    }));

  return [
    { id: 'spirit-root', label: '灵根', quantity: input.spiritState?.spiritRoot ?? 0, group: 'spirit', rarity: 'common' },
    { id: 'spirit-marrow', label: '灵髓', quantity: input.spiritState?.spiritMarrow ?? 0, group: 'spirit', rarity: 'rare' },
    { id: 'spirit-jade', label: '灵玉', quantity: input.spiritState?.spiritJade ?? 0, group: 'spirit', rarity: 'legendary' },
    { id: 'ordinary-soul', label: '普通兽魂', quantity: input.spiritState?.ordinarySoul ?? 0, group: 'soul', rarity: 'common' },
    { id: 'rare-soul', label: '稀有兽魂', quantity: input.spiritState?.rareSoul ?? 0, group: 'soul', rarity: 'rare' },
    { id: 'legendary-soul', label: '传说兽魂', quantity: input.spiritState?.legendarySoul ?? 0, group: 'soul', rarity: 'legendary' },
    ...raidShardResourceItems,
    ...playableSeedCatalog.filter((seed) => input.unlockedSeedIds.includes(seed.id)).map((seed) => ({
      id: `essence-${seed.id}`,
      label: `${seed.name}精华`,
      quantity: input.seedInventory[seed.id] ?? 0,
      group: 'farm' as const,
      rarity: seed.rarity,
    })),
  ];
}
