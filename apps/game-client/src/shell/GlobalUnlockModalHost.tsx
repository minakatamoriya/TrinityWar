import { GlobalUnlockModal } from '../ui/common/GlobalUnlockModal';
import type { GlobalUnlockModalState } from './appStateTypes';

interface GlobalUnlockModalHostProps {
  modal: GlobalUnlockModalState | null;
  onConfirm: () => void;
}

export function GlobalUnlockModalHost(props: GlobalUnlockModalHostProps): JSX.Element | null {
  const {
    modal,
    onConfirm,
  } = props;

  if (!modal) {
    return null;
  }

  return (
    <GlobalUnlockModal
      items={modal.items}
      onConfirm={onConfirm}
      summary={modal.summary}
      title={modal.title}
    />
  );
}
