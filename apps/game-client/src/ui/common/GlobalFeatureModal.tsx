import { CenteredModalShell } from './ModalShell';

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
    <CenteredModalShell
      className="global-feature-card"
      description={description}
      eyebrow={eyebrow}
      onClose={onClose}
      title={title}
    >
      {children ? <div className="global-feature-content">{children}</div> : null}
    </CenteredModalShell>
  );
}
