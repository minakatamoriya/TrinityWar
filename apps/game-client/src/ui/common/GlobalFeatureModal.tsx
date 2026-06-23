import { FullScreenToolShell } from './ModalShell';

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
    <FullScreenToolShell
      ariaLabel={title}
      bodyClassName="global-feature-tool-body"
      className="global-feature-screen"
      description={description}
      eyebrow={eyebrow}
      onBack={onClose}
      title={title}
    >
      {children ? <div className="global-feature-content">{children}</div> : null}
    </FullScreenToolShell>
  );
}
