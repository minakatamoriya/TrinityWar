import type { ClientGuideSection, ClientSceneAction } from '@trinitywar/shared';
import { ActionButton } from './ActionButton';

interface GuideCardProps {
  section: ClientGuideSection;
  onAction: (action: ClientSceneAction) => void;
}

export function GuideCard(props: GuideCardProps): JSX.Element {
  const { section, onAction } = props;

  return (
    <article className="panel-card">
      <div className="panel-head">
        <h4>{section.title}</h4>
      </div>
      <p className="panel-text">{section.description}</p>
      <div className="button-row wrap">
        {section.actions.map((action) => (
          <ActionButton action={action} key={`${section.title}-${action.label}`} onClick={onAction} />
        ))}
      </div>
    </article>
  );
}