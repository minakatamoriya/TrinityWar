import type { ClientButtonTone, ClientSceneAction } from '@trinitywar/shared';

function toneClassName(tone: ClientButtonTone): string {
  return `action-button ${tone}`;
}

interface ActionButtonProps {
  action: ClientSceneAction;
  onClick: (action: ClientSceneAction) => void;
  disabled?: boolean;
}

export function ActionButton(props: ActionButtonProps): JSX.Element {
  const { action, onClick, disabled = false } = props;

  return (
    <button className={toneClassName(action.tone)} onClick={(event) => {
      if (disabled) {
        return;
      }

      event.stopPropagation();
      onClick(action);
    }} disabled={disabled} type="button">
      {action.label}
    </button>
  );
}