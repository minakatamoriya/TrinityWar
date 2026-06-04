import type { ClientFactionStipendReward } from '@trinitywar/shared';

const spiritSoulRewardKinds = new Set<ClientFactionStipendReward['kind']>([
  'legendary-soul',
  'ordinary-soul',
  'rare-soul',
  'spirit-jade',
  'spirit-marrow',
  'spirit-root',
]);

export function applyFactionStipendSoulRewards(
  inventory: Record<string, number>,
  rewards: ClientFactionStipendReward[],
): Record<string, number> {
  const nextItems = { ...inventory };

  rewards
    .filter((reward) => spiritSoulRewardKinds.has(reward.kind))
    .forEach((reward) => {
      nextItems[reward.kind] = (nextItems[reward.kind] ?? 0) + reward.quantity;
    });

  return nextItems;
}
