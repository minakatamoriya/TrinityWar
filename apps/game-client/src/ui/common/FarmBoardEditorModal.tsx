import { CenteredModalShell } from './ModalShell';

interface FarmBoardEditorModalProps {
  message: string;
  saving: boolean;
  onChangeMessage: (message: string) => void;
  onClose: () => void;
}

export function FarmBoardEditorModal(props: FarmBoardEditorModalProps): JSX.Element {
  const {
    message,
    saving,
    onChangeMessage,
    onClose,
  } = props;

  return (
    <CenteredModalShell
      className="farm-board-modal"
      eyebrow="农场留言板"
      footer={(
        <>
          <span>{Array.from(message).length}/40</span>
          <button
            className="secondary-button"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            {saving ? '保存中...' : '关闭'}
          </button>
        </>
      )}
      title="修改留言"
    >
      <textarea
        className="farm-board-textarea"
        maxLength={40}
        onChange={(event) => onChangeMessage(event.target.value)}
        placeholder="写一句给来访者看的农场留言"
        value={message}
      />
    </CenteredModalShell>
  );
}
