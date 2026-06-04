import type { ClientFarmField } from '@trinitywar/shared';
import type { SeedCatalogItem } from '../../config/seedCatalog';
import type { ClientViewModel } from '../../api';
import { buildLiveFarmFieldPresentation } from './farmPresentation';
import { applyFarmOptimisticMutations, type FarmOptimisticMutation } from './farmOptimisticState';

export function buildFarmFields(input: {
  fields: ClientViewModel['scenes']['farm']['fields'];
  fieldSeedAssignments: Record<string, string>;
  optimisticMutations: FarmOptimisticMutation[];
  seedCatalogMap: Map<string, SeedCatalogItem>;
  farmTick: number;
}): ClientFarmField[] {
  const fields = input.fields.map((field) => {
    const assignedSeedId = input.fieldSeedAssignments[field.id];
    const assignedSeed = assignedSeedId ? input.seedCatalogMap.get(assignedSeedId) : undefined;
    const localPresentation = buildLiveFarmFieldPresentation(field, input.farmTick);

    if (!assignedSeed || (field.tone !== 'growing' && field.tone !== 'mature' && field.tone !== 'withered')) {
      return localPresentation ? {
        ...field,
        ...localPresentation,
      } : field;
    }

    return {
      ...field,
      ...(localPresentation ?? {}),
      cropName: assignedSeed.name,
    };
  });

  return applyFarmOptimisticMutations(fields, input.optimisticMutations);
}
