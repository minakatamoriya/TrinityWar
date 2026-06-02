import type { ClientSpiritState } from '@trinitywar/shared';
import type { ClientViewModel, DevLoginSession } from '../api';
import type { ShareAssistDemoState } from './appStateTypes';

export type AppEntryState = 'share-assist-demo' | 'auth-entry' | 'loading' | 'ready';

export function selectAppEntryState(input: {
  loginSession: DevLoginSession | null;
  shareAssistDemo: ShareAssistDemoState | null;
  spiritState: ClientSpiritState | null;
  viewModel: ClientViewModel | null;
}): AppEntryState {
  if (input.viewModel && input.spiritState) {
    return 'ready';
  }

  if (input.shareAssistDemo) {
    return 'share-assist-demo';
  }

  if (!input.loginSession) {
    return 'auth-entry';
  }

  return 'loading';
}
