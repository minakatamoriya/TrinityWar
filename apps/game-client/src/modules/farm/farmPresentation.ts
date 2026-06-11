import type { ClientPlantResearchState, ClientSceneAction } from '@trinitywar/shared';
import type { ClientViewModel } from '../../api';

export const FARM_COLLECT_PRESENTATION_MS = 1250;

export interface LocalFarmFieldPresentation {
  title: string;
  badge: string;
  tone: 'growing' | 'mature' | 'withered' | 'empty' | 'locked';
  description: string;
  actions: ClientSceneAction[];
  progressRemainingSeconds: number;
  progressTotalSeconds: number;
  fieldVersionOffset: number;
}

export function buildLocalPlantResearchState(plantType: string, unlocked: boolean, essenceOwned: number): ClientPlantResearchState {
  return {
    plantType,
    discovered: unlocked,
    unlocked,
    status: unlocked ? 'unlocked' : 'undiscovered',
    essenceRequired: 0,
    essenceOwned,
    harvestRequired: 0,
    harvestOwned: 0,
    contributionRequired: 0,
    contributionOwned: 0,
    canUnlock: false,
  };
}

export function buildLiveFarmFieldPresentation(
  field: ClientViewModel['scenes']['farm']['fields'][number],
  elapsedSeconds: number,
): LocalFarmFieldPresentation | null {
  if (field.tone !== 'growing' && field.tone !== 'mature') {
    return null;
  }

  if (field.tone === 'mature') {
    return {
      title: field.title,
      badge: field.badge,
      tone: field.tone,
      description: field.description,
      actions: field.actions,
      progressRemainingSeconds: Math.max(field.progressRemainingSeconds - elapsedSeconds, 0),
      progressTotalSeconds: field.progressTotalSeconds,
      fieldVersionOffset: 0,
    };
  }

  let remainingElapsedSeconds = elapsedSeconds;
  let stageTone: LocalFarmFieldPresentation['tone'] = field.tone;
  let stageIndexOffset = 0;
  let stageDurationSeconds = Math.max(field.progressTotalSeconds, 1);
  let stageRemainingSeconds = Math.max(field.progressRemainingSeconds, 0);

  while (remainingElapsedSeconds > 0 && stageTone === 'growing') {
    if (remainingElapsedSeconds < stageRemainingSeconds) {
      stageRemainingSeconds -= remainingElapsedSeconds;
      remainingElapsedSeconds = 0;
      break;
    }

    remainingElapsedSeconds -= stageRemainingSeconds;
    stageIndexOffset = 1;

    stageTone = 'mature';
    stageDurationSeconds = 1;
    stageRemainingSeconds = 0;
    break;
  }

  if (stageIndexOffset === 0) {
    return {
      title: field.title,
      badge: field.badge,
      tone: field.tone,
      description: field.description,
      actions: field.actions,
      progressRemainingSeconds: stageRemainingSeconds,
      progressTotalSeconds: field.progressTotalSeconds,
      fieldVersionOffset: 0,
    };
  }

  if (stageTone === 'growing') {
    return {
      title: '培育中',
      badge: '培育',
      tone: 'growing',
      description: '作物仍在培育中，成熟后即可收取完整收益。',
      actions: [],
      progressRemainingSeconds: stageRemainingSeconds,
      progressTotalSeconds: stageDurationSeconds,
      fieldVersionOffset: 1,
    };
  }

  return {
    title: '成熟期',
    badge: '成熟',
    tone: 'mature',
    description: '已经成熟，可以直接收取完整收益。',
    actions: [{ label: '收取', target: 'farm', tone: 'primary' }],
    progressRemainingSeconds: 0,
    progressTotalSeconds: 1,
    fieldVersionOffset: 1,
  };
}
