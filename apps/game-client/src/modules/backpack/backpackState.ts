import type { ClientPlantResearchState } from '@trinitywar/shared';
import type { ClientViewModel } from '../../api';
import {
  emptySeedInventory,
} from '../../config/seedCatalog';

export const emptyGlobalItemInventory: Record<string, number> = {
  tianjiTalisman: 0,
};

export interface SeedBackpackState {
  globalItemInventory: Record<string, number>;
  plantResearchState: Record<string, ClientPlantResearchState>;
  seedInventory: Record<string, number>;
  selectedSeedId: string;
  unlockedSeedIds: string[];
}

export function getPreferredSeedId(input: {
  seedInventory: Record<string, number>;
  tutorialStarterSeedId: string;
  unlockedSeedIds: string[];
}): string {
  const {
    seedInventory,
    tutorialStarterSeedId,
    unlockedSeedIds,
  } = input;

  return (
    unlockedSeedIds.find((seedId) => seedId !== tutorialStarterSeedId && (seedInventory[seedId] ?? 0) > 0)
    ?? unlockedSeedIds.find((seedId) => seedId !== tutorialStarterSeedId)
    ?? unlockedSeedIds[0]
    ?? 'qinglingmai'
  );
}

export function buildSeedBackpackState(input: {
  backpack: ClientViewModel['bootstrap']['backpack'];
  currentSelectedSeedId: string;
}): SeedBackpackState {
  const mergedUnlockedSeedIds = Array.from(new Set(input.backpack.unlockedSeedIds));
  const seedInventory = {
    ...emptySeedInventory,
    ...input.backpack.seedInventory,
  };
  const selectedSeedId = mergedUnlockedSeedIds.includes(input.currentSelectedSeedId)
    ? input.currentSelectedSeedId
    : mergedUnlockedSeedIds[0] ?? 'qilingya';

  return {
    globalItemInventory: {
      ...emptyGlobalItemInventory,
      ...input.backpack.globalItemInventory,
    },
    plantResearchState: input.backpack.plantResearch ?? {},
    seedInventory,
    selectedSeedId,
    unlockedSeedIds: mergedUnlockedSeedIds,
  };
}
