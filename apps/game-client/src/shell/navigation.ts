import type { ClientSceneKey } from '@trinitywar/shared';
import type { AppSceneKey } from '../config/sceneConfig';

export type SceneNavigationTarget = AppSceneKey | ClientSceneKey;

export function normalizeScene(scene: string): AppSceneKey {
  if (scene === 'home' || scene === 'field' || scene === 'farm') {
    return 'farm';
  }

  if (scene === 'spirit') {
    return 'spirit';
  }

  if (scene === 'raid' || scene === 'report' || scene === 'battle') {
    return 'battle';
  }

  if (scene === 'faction' || scene === 'social') {
    return scene;
  }

  return 'farm';
}
