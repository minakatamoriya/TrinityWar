interface GlobalFeatureModalProps {
  title: string;
  eyebrow?: string;
  description?: string;
  onClose: () => void;
  children?: React.ReactNode;
}

export function GlobalFeatureModal(props: GlobalFeatureModalProps): JSX.Element {
  const { title, eyebrow = '功能预留', description, onClose, children } = props;

  return (
    <div className="modal-backdrop global-feature-backdrop">
      <div className="modal-card transfer-card global-feature-card">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        {description ? <p className="panel-text">{description}</p> : null}
        {children ? <div className="global-feature-content">{children}</div> : null}
        <div className="transfer-foot-row">
          <button className="secondary-button" onClick={onClose} type="button">关闭</button>
        </div>
      </div>
    </div>
  );
}