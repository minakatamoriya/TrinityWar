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
    <div className="modal-backdrop farm-board-backdrop" role="presentation">
      <div className="modal-card transfer-card farm-board-modal" role="dialog" aria-modal="true" aria-label="农场留言板">
        <div>
          <div>
            <p className="eyebrow">农场留言板</p>
            <h3>修改留言</h3>
          </div>
        </div>
        <textarea
          className="farm-board-textarea"
          maxLength={40}
          onChange={(event) => onChangeMessage(event.target.value)}
          placeholder="写一句给来访者看的农场留言"
          value={message}
        />
        <div className="transfer-foot-row farm-board-modal-foot">
          <span>{Array.from(message).length}/40</span>
          <button
            className="secondary-button"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            {saving ? '保存中...' : '关闭'}
          </button>
        </div>
      </div>
    </div>
  );
}
