import type { ClientSpiritState } from '@trinitywar/shared';

export function syncTianjiTalismanInInventory(
  inventory: Record<string, number>,
  tianjiTalisman: number,
): Record<string, number> {
  return {
    ...inventory,
    tianjiTalisman,
  };
}

export function applyTianjiTalismanToSpiritState(
  spiritState: ClientSpiritState | null,
  input: {
    resourceVersion: number;
    tianjiTalisman: number;
  },
): ClientSpiritState | null {
  if (!spiritState) {
    return spiritState;
  }

  return {
    ...spiritState,
    resourceVersion: input.resourceVersion,
    tianjiTalisman: input.tianjiTalisman,
  };
}

export function spendLocalTianjiTalisman(input: {
  cost: number;
  globalItemInventory: Record<string, number>;
  spiritState: ClientSpiritState | null;
}): {
  globalItemInventory: Record<string, number>;
  spiritState: ClientSpiritState | null;
} {
  if (input.cost <= 0) {
    return {
      globalItemInventory: input.globalItemInventory,
      spiritState: input.spiritState,
    };
  }

  return {
    globalItemInventory: {
      ...input.globalItemInventory,
      tianjiTalisman: Math.max((input.globalItemInventory.tianjiTalisman ?? 0) - input.cost, 0),
    },
    spiritState: input.spiritState
      ? {
        ...input.spiritState,
        resourceVersion: input.spiritState.resourceVersion + 1,
        tianjiTalisman: Math.max(input.spiritState.tianjiTalisman - input.cost, 0),
      }
      : input.spiritState,
  };
}
