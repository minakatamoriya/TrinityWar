import { ShareAssistPage } from '../ui/share/ShareAssistPage';
import type { ShareAssistAudience } from '../ui/share/ShareAssistPage';
import type { ShareAssistDemoState } from './appStateTypes';

interface ShareAssistDemoScreenProps {
  demo: ShareAssistDemoState;
  onBack: () => void;
  onConfirm: () => void;
  onSuccessExit: (audience: ShareAssistAudience) => void;
}

export function ShareAssistDemoScreen(props: ShareAssistDemoScreenProps): JSX.Element {
  const { demo, onBack, onConfirm, onSuccessExit } = props;

  return (
    <ShareAssistPage
      audience={demo.audience}
      campaign={demo.campaign}
      error={demo.error}
      kind={demo.kind}
      onBack={onBack}
      onConfirm={onConfirm}
      onSuccessExit={() => onSuccessExit(demo.audience)}
      status={demo.status}
    />
  );
}
