import { createPortal } from 'react-dom';
import type { CharacterDialogEntry } from '../../dialog/useCharacterDialog';

interface CharacterDialogProps {
  dialog: CharacterDialogEntry | null;
  onAdvance: () => void;
  onClose: () => void;
  portalTarget?: HTMLElement | null;
}

export function CharacterDialog({ dialog, onAdvance, onClose, portalTarget }: CharacterDialogProps): JSX.Element | null {
  if (!dialog) {
    return null;
  }

  const handleAdvance = (): void => {
    if (dialog.canAdvance) {
      onAdvance();
    }
  };

  const handleBackdropClick = (): void => {
    if (dialog.canAdvance) {
      handleAdvance();
      return;
    }

    if (dialog.closeOnMaskClick) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="character-dialog-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <section
        aria-label={`${dialog.actor.name} 对话`}
        aria-live="polite"
        className={`character-dialog-panel is-${dialog.phase} ${dialog.canAdvance ? 'is-advanceable' : ''}`}
        onClick={(event) => {
          event.stopPropagation();
          handleAdvance();
        }}
        role="dialog"
      >
        <div className="character-dialog-content">
          <p className="character-dialog-speaker">{dialog.actor.name}</p>
          <p className="character-dialog-text">{dialog.text}</p>
          {dialog.stepCount > 1 ? (
            <p className="character-dialog-progress">{dialog.stepIndex + 1} / {dialog.stepCount}</p>
          ) : null}
        </div>
        <img className="character-dialog-image" src={dialog.actor.imageUrl} alt={dialog.actor.imageAlt} />
        {dialog.canAdvance ? <span className="character-dialog-next">点击继续</span> : null}
        {dialog.showCloseButton ? (
          <button
            className="character-dialog-close"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            type="button"
            aria-label="关闭对话"
          >
            x
          </button>
        ) : null}
      </section>
    </div>,
    portalTarget ?? document.body,
  );
}
