import type { ClientRaidActionResponse } from '@trinitywar/shared';

type RaidReward = ClientRaidActionResponse['result']['rewards'][number];

export function applyRaidRewardsToSeedInventory(
  seedInventory: Record<string, number>,
  rewards: RaidReward[],
): Record<string, number> {
  const nextInventory = { ...seedInventory };

  rewards.forEach((reward) => {
    nextInventory[reward.seedId] = (nextInventory[reward.seedId] ?? 0) + reward.quantity;
  });

  return nextInventory;
}

export function applyRaidRewardsToUnlockedSeedIds(
  unlockedSeedIds: string[],
  rewards: RaidReward[],
): string[] {
  const nextIds = new Set(unlockedSeedIds);

  rewards.forEach((reward) => nextIds.add(reward.seedId));

  return Array.from(nextIds);
}
