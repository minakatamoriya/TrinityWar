import type { HomeSummaryResponse } from '@trinitywar/shared';
import type { ClientViewModel } from '../api';

export interface ClientViewModelScenePatch {
  home: HomeSummaryResponse;
  scenes: ClientViewModel['scenes'];
}

export function applyClientViewModelScenePatch(
  viewModel: ClientViewModel | null,
  patch: ClientViewModelScenePatch,
): ClientViewModel | null {
  if (!viewModel) {
    return viewModel;
  }

  return {
    ...viewModel,
    home: patch.home,
    scenes: patch.scenes,
  };
}
