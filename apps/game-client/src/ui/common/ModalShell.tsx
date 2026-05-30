interface CenteredModalShellProps {
  title: string;
  eyebrow?: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  onClose?: () => void;
  closeLabel?: string;
}

interface FullScreenToolShellProps {
  title: string;
  eyebrow?: string;
  description?: string;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
  onBack: () => void;
  backLabel?: string;
  ariaLabel?: string;
}

export function CenteredModalShell(props: CenteredModalShellProps): JSX.Element {
  const {
    title,
    eyebrow,
    description,
    className,
    children,
    footer,
    onClose,
    closeLabel = '关闭',
  } = props;

  return (
    <div className="modal-backdrop modal-backdrop-blocking" role="presentation">
      <section className={`modal-card transfer-card centered-modal-card${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby="centered-modal-title">
        <header className="centered-modal-head">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h3 id="centered-modal-title">{title}</h3>
        </header>
        {description ? <p className="panel-text centered-modal-message">{description}</p> : null}
        {children ? <div className="centered-modal-content">{children}</div> : null}
        <footer className="transfer-foot-row centered-modal-actions">
          {footer ?? (onClose ? (
            <button className="secondary-button" onClick={onClose} type="button">
              {closeLabel}
            </button>
          ) : null)}
        </footer>
      </section>
    </div>
  );
}

export function FullScreenToolShell(props: FullScreenToolShellProps): JSX.Element {
  const {
    title,
    eyebrow,
    description,
    className,
    bodyClassName,
    children,
    onBack,
    backLabel = '返回',
    ariaLabel,
  } = props;

  return (
    <section className={`full-screen-tool${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-label={ariaLabel ?? title}>
      <header className="full-screen-tool-topbar">
        <button className="full-screen-tool-back" onClick={onBack} type="button">
          {backLabel}
        </button>
        <div className="full-screen-tool-title">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        <span className="full-screen-tool-spacer" aria-hidden="true" />
      </header>
      <div className={`full-screen-tool-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>
        {children}
      </div>
    </section>
  );
}
