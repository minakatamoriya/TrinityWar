import type { HomeSummaryResponse } from '@trinitywar/shared';

export function findResourceByTone(
  tone: HomeSummaryResponse['resources'][number]['tone'],
  resources: HomeSummaryResponse['resources'],
): HomeSummaryResponse['resources'][number] | undefined {
  return resources.find((resource) => resource.tone === tone);
}
