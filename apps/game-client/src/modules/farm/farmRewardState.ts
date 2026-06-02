import type {
  ClientCollectFieldResponse,
  ClientSpiritState,
} from '@trinitywar/shared';

type FarmReward = ClientCollectFieldResponse['result']['rewards'][number];

interface SpiritMaterialRewardDelta {
  spiritJade: number;
  spiritMarrow: number;
  spiritRoot: number;
}

function isFarmSeedReward(reward: FarmReward, tutorialStarterSeedId: string): boolean {
  return (
    ((reward.kind ?? 'seed') === 'seed' || reward.kind === 'essence')
    && Boolean(reward.seedId)
    && reward.seedId !== tutorialStarterSeedId
  );
}

export function applyFarmSeedRewardsToInventory(
  inventory: Record<string, number>,
  rewards: FarmReward[],
  tutorialStarterSeedId: string,
): Record<string, number> {
  const nextInventory = { ...inventory };

  rewards
    .filter((reward) => isFarmSeedReward(reward, tutorialStarterSeedId))
    .forEach((reward) => {
      nextInventory[reward.seedId as string] = (nextInventory[reward.seedId as string] ?? 0) + reward.quantity;
    });

  return nextInventory;
}

export function applyFarmSeedRewardsToUnlockedSeedIds(
  unlockedSeedIds: string[],
  rewards: FarmReward[],
  tutorialStarterSeedId: string,
): string[] {
  const nextIds = new Set(unlockedSeedIds);

  rewards
    .filter((reward) => isFarmSeedReward(reward, tutorialStarterSeedId))
    .forEach((reward) => nextIds.add(reward.seedId as string));

  return Array.from(nextIds);
}

export function buildSpiritMaterialRewardDelta(rewards: FarmReward[]): SpiritMaterialRewardDelta {
  return rewards.reduce<SpiritMaterialRewardDelta>((delta, reward) => {
    if (reward.kind === 'spirit-root') {
      delta.spiritRoot += reward.quantity;
    }
    if (reward.kind === 'spirit-marrow') {
      delta.spiritMarrow += reward.quantity;
    }
    if (reward.kind === 'spirit-jade') {
      delta.spiritJade += reward.quantity;
    }
    return delta;
  }, { spiritJade: 0, spiritMarrow: 0, spiritRoot: 0 });
}

export function hasSpiritMaterialRewardDelta(delta: SpiritMaterialRewardDelta): boolean {
  return delta.spiritRoot > 0 || delta.spiritMarrow > 0 || delta.spiritJade > 0;
}

export function applySpiritMaterialRewardDelta(
  spiritState: ClientSpiritState | null,
  delta: SpiritMaterialRewardDelta,
): ClientSpiritState | null {
  if (!spiritState || !hasSpiritMaterialRewardDelta(delta)) {
    return spiritState;
  }

  return {
    ...spiritState,
    resourceVersion: spiritState.resourceVersion + 1,
    spiritJade: (spiritState.spiritJade ?? 0) + delta.spiritJade,
    spiritMarrow: (spiritState.spiritMarrow ?? 0) + delta.spiritMarrow,
    spiritRoot: (spiritState.spiritRoot ?? 0) + delta.spiritRoot,
  };
}
