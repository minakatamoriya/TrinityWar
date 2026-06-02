import type {
  ClientRaidTarget,
  ClientRaidTargetDetailResponse,
} from '@trinitywar/shared';
import type { ClientViewModel } from '../../api';

export function patchRaidTargetPreviewInViewModel(
  viewModel: ClientViewModel | null,
  targetId: string,
  mainPetPreview: ClientRaidTarget['mainPetPreview'],
): ClientViewModel | null {
  if (!viewModel) {
    return viewModel;
  }

  return {
    ...viewModel,
    scenes: {
      ...viewModel.scenes,
      raid: {
        ...viewModel.scenes.raid,
        targets: viewModel.scenes.raid.targets.map((target) => (
          target.id === targetId
            ? {
              ...target,
              mainPetPreview,
            }
            : target
        )),
      },
    },
  };
}

export function applyRaidTargetDetailToViewModel(
  viewModel: ClientViewModel | null,
  detail: ClientRaidTargetDetailResponse,
): ClientViewModel | null {
  if (!viewModel) {
    return viewModel;
  }

  return {
    ...viewModel,
    scenes: {
      ...viewModel.scenes,
      raid: {
        ...viewModel.scenes.raid,
        targets: viewModel.scenes.raid.targets.map((target) => (
          target.id === detail.targetId
            ? {
              ...target,
              name: detail.name,
              faction: detail.faction,
              level: detail.level,
              mainPetPreview: detail.mainPetPreview,
            }
            : target
        )),
      },
    },
  };
}
