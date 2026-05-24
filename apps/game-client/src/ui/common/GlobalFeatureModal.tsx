interface GlobalFeatureModalProps {
  title: string;
  eyebrow?: string;
  description?: string;
  onClose: () => void;
  children?: React.ReactNode;
}

export function GlobalFeatureModal(props: GlobalFeatureModalProps): JSX.Element {
  const { title, eyebrow, description, onClose, children } = props;

  return (
    <div className="modal-backdrop global-feature-backdrop">
      <div className="modal-card transfer-card global-feature-card">
        <button className="modal-close-button" onClick={onClose} type="button">
          关闭
        </button>
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h3>{title}</h3>
        </div>
        {description ? <p className="panel-text">{description}</p> : null}
        {children ? <div className="global-feature-content">{children}</div> : null}
      </div>
    </div>
  );
}
