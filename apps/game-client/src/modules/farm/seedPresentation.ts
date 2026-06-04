import type { ClientPlantResearchState } from '@trinitywar/shared';
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
        const unlocked = input.unlockedSeedIds.includes(seed.id);
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

  return {
    ...research,
    harvestRequired: research.harvestRequired ?? requirement.harvestRequired,
    harvestOwned: research.harvestOwned ?? 0,
    contributionRequired: research.contributionRequired || requirement.contributionRequired,
    contributionOwned: research.contributionOwned ?? 0,
  };
}

export function getFirstVisibleUnlockedSeedId(seedGroups: SeedViewGroup[]): string {
  return seedGroups.flatMap((group) => group.seeds).find((seed) => seed.unlocked)?.id
    ?? playableSeedCatalog[0]?.id
    ?? 'qinglingmai';
}
