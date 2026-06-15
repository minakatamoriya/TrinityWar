import type { ClientPlantInventoryItem, ClientPlantResearchState } from '@trinitywar/shared';
import {
  compareSeedCatalogItems,
  getSeedUnlockRequirement,
  seedCatalog,
  seedRarityLabels,
  type SeedCatalogItem,
  type SeedRarity,
} from '../../config/seedCatalog';
import { TUTORIAL_STARTER_SEED_ID } from '../../tutorial/tutorialFlow';
import { buildLocalPlantResearchState } from './farmPresentation';

export interface SeedViewItem extends SeedCatalogItem {
  unlocked: boolean;
  quantity: number;
  research: ClientPlantResearchState;
}

export interface SeedViewGroup {
  rarity: SeedRarity;
  label: string;
  seeds: SeedViewItem[];
}

export const playableSeedCatalog = seedCatalog.filter((seed) => seed.id !== TUTORIAL_STARTER_SEED_ID);

export function buildSeedCatalogMap(): Map<string, SeedCatalogItem> {
  return new Map(seedCatalog.map((seed) => [seed.id, seed]));
}

export function buildSeedGroups(input: {
  unlockedSeedIds: string[];
  seedInventory: Record<string, number>;
  plantResearchState: Record<string, ClientPlantResearchState>;
}): SeedViewGroup[] {
  return (['common', 'rare', 'legendary'] as const).map((rarity) => ({
    rarity,
    label: seedRarityLabels[rarity],
    seeds: playableSeedCatalog
      .filter((seed) => seed.rarity === rarity)
      .sort(compareSeedCatalogItems)
      .map((seed) => {
        const unlocked = input.unlockedSeedIds.includes(seed.id) || seed.unlockedByDefault;
        const quantity = input.seedInventory[seed.id] ?? 0;
        const research = buildSeedResearchState(seed, input.plantResearchState[seed.id], unlocked, quantity);

        return {
          ...seed,
          unlocked,
          quantity,
          research,
        };
      }),
  }));
}

function buildSeedResearchState(
  seed: SeedCatalogItem,
  remoteResearch: ClientPlantResearchState | undefined,
  unlocked: boolean,
  quantity: number,
): ClientPlantResearchState {
  const localResearch = buildLocalPlantResearchState(seed.id, unlocked, quantity);
  const requirement = getSeedUnlockRequirement(seed);
  const research = remoteResearch ?? localResearch;
  const harvestRequired = (research.harvestRequired ?? 0) > 0 ? research.harvestRequired ?? 0 : requirement.harvestRequired;
  const contributionRequired = research.contributionRequired > 0 ? research.contributionRequired : requirement.contributionRequired;

  return {
    ...research,
    discovered: unlocked || research.discovered,
    unlocked,
    status: unlocked ? 'unlocked' : research.status,
    harvestRequired,
    harvestOwned: research.harvestOwned ?? 0,
    contributionRequired,
    contributionOwned: research.contributionOwned ?? 0,
  };
}

export function getFirstVisibleUnlockedSeedId(seedGroups: SeedViewGroup[]): string {
  return seedGroups.flatMap((group) => group.seeds).find((seed) => seed.unlocked)?.id
    ?? playableSeedCatalog[0]?.id
    ?? 'qinglingmai';
}

export function mergePlantResearchStateFromScenePlants(
  current: Record<string, ClientPlantResearchState>,
  plants: ClientPlantInventoryItem[] | undefined,
): Record<string, ClientPlantResearchState> {
  if (!plants || plants.length === 0) {
    return current;
  }

  const next = { ...current };
  for (const plant of plants) {
    const previous = next[plant.plantType];
    const discovered = plant.unlocked || Boolean(plant.discovered);
    const status = plant.unlocked
      ? 'unlocked'
      : plant.researchStatus ?? (plant.canUnlock ? 'ready' : discovered ? 'discovered' : 'undiscovered');

    next[plant.plantType] = {
      plantType: plant.plantType,
      discovered,
      unlocked: plant.unlocked,
      status,
      essenceRequired: plant.unlockEssenceRequired ?? previous?.essenceRequired ?? 0,
      essenceOwned: plant.essenceQuantity ?? previous?.essenceOwned ?? 0,
      harvestRequired: plant.unlockHarvestRequired ?? previous?.harvestRequired ?? 0,
      harvestOwned: plant.unlockHarvestOwned ?? previous?.harvestOwned ?? 0,
      contributionRequired: plant.unlockContributionRequired ?? previous?.contributionRequired ?? 0,
      contributionOwned: plant.unlockContributionOwned ?? previous?.contributionOwned ?? 0,
      canUnlock: Boolean(plant.canUnlock),
    };
  }

  return next;
}
