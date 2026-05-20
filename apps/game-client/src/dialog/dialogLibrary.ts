import dialogConfig from './dialogScenes.json';

export type CharacterDialogActorId = keyof typeof dialogConfig.actors;
export type CharacterDialogSceneId = keyof typeof dialogConfig.scenes;
export type CharacterDialogMode = 'random' | 'sequence' | 'shuffle';
export type CharacterDialogAdvance = 'auto' | 'click' | 'auto-or-click';
export type CharacterDialogInterrupt = 'queue' | 'replace' | 'ignore';

export interface CharacterDialogActor {
  id: CharacterDialogActorId;
  name: string;
  imageUrl: string;
  imageAlt: string;
}

export interface CharacterDialogStep {
  actorId: CharacterDialogActorId;
  text: string;
  holdMs?: number;
  autoCloseMs?: number;
  showCloseButton?: boolean;
  closeOnMaskClick?: boolean;
  advance?: CharacterDialogAdvance;
}

export interface CharacterDialogOptions {
  holdMs?: number;
  autoCloseMs?: number | null;
  showCloseButton?: boolean;
  closeOnMaskClick?: boolean;
}

export interface CharacterDialogTrigger {
  type: 'enterScene';
  scene?: string;
  conditions?: {
    hasMatureCrop?: boolean;
  };
}

export interface CharacterDialogScene {
  id: CharacterDialogSceneId;
  mode?: CharacterDialogMode;
  chance?: number;
  cooldownMs?: number;
  enterDelayMs?: number;
  priority?: number;
  interrupt?: CharacterDialogInterrupt;
  advance?: CharacterDialogAdvance;
  trigger?: CharacterDialogTrigger;
  steps: CharacterDialogStep[];
  options?: CharacterDialogOptions;
}

export interface CharacterDialogConfig {
  defaults: {
    mode: CharacterDialogMode;
    advance: CharacterDialogAdvance;
    priority: number;
    interrupt: CharacterDialogInterrupt;
    showCloseButton: boolean;
    closeOnMaskClick: boolean;
    enterDelayMs: number;
    autoCloseMs: number;
    holdMs: number;
  };
  actors: Record<CharacterDialogActorId, Omit<CharacterDialogActor, 'id'>>;
  scenes: Record<CharacterDialogSceneId, Omit<CharacterDialogScene, 'id'>>;
}

export const characterDialogConfig = dialogConfig as CharacterDialogConfig;

export const characterDialogActors = Object.fromEntries(
  Object.entries(characterDialogConfig.actors).map(([id, actor]) => [
    id,
    {
      id,
      ...actor,
    },
  ]),
) as Record<CharacterDialogActorId, CharacterDialogActor>;

export const characterDialogScenes = Object.fromEntries(
  Object.entries(characterDialogConfig.scenes).map(([id, scene]) => [
    id,
    {
      id,
      ...scene,
    },
  ]),
) as Record<CharacterDialogSceneId, CharacterDialogScene>;

export function getDialogSceneDefaultOptions(scene: CharacterDialogScene): Required<Omit<CharacterDialogOptions, 'autoCloseMs'>> & { autoCloseMs: number | null } {
  return {
    holdMs: scene.options?.holdMs ?? characterDialogConfig.defaults.holdMs,
    autoCloseMs: scene.options?.autoCloseMs ?? characterDialogConfig.defaults.autoCloseMs,
    showCloseButton: scene.options?.showCloseButton ?? characterDialogConfig.defaults.showCloseButton,
    closeOnMaskClick: scene.options?.closeOnMaskClick ?? characterDialogConfig.defaults.closeOnMaskClick,
  };
}

export function getDialogSceneMode(scene: CharacterDialogScene): CharacterDialogMode {
  return scene.mode ?? characterDialogConfig.defaults.mode;
}

export function getDialogSceneAdvance(scene: CharacterDialogScene): CharacterDialogAdvance {
  return scene.advance ?? characterDialogConfig.defaults.advance;
}

export function getDialogScenePriority(scene: CharacterDialogScene): number {
  return scene.priority ?? characterDialogConfig.defaults.priority;
}

export function getDialogSceneInterrupt(scene: CharacterDialogScene): CharacterDialogInterrupt {
  return scene.interrupt ?? characterDialogConfig.defaults.interrupt;
}

export function getDialogSceneEnterDelayMs(scene: CharacterDialogScene): number {
  return Math.max(scene.enterDelayMs ?? characterDialogConfig.defaults.enterDelayMs, 0);
}
