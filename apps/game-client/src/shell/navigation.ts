import type { ClientSceneKey } from '@trinitywar/shared';

export function normalizeScene(scene: string): ClientSceneKey {
  if (scene === 'field') {
    return 'farm';
  }

  if (scene === 'home' || scene === 'building' || scene === 'farm' || scene === 'raid' || scene === 'report' || scene === 'faction' || scene === 'social') {
    return scene;
  }

  return 'home';
}
