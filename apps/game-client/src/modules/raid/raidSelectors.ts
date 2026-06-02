import type { ClientRaidTarget } from '@trinitywar/shared';

export function resolveRaidTargetByContext(targets: ClientRaidTarget[], context?: string): ClientRaidTarget | null {
  if (!context) {
    return targets[0] ?? null;
  }

  const matchedTarget = targets.find((target) => target.id === context || context.includes(target.name));
  return matchedTarget ?? targets[0] ?? null;
}
