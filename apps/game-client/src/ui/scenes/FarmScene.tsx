import type { ClientFactionAdvantagePanel, ClientFarmField, ClientSceneAction } from '@trinitywar/shared';
import type { TutorialFarmUiRules, TutorialTask } from '../../tutorial/tutorialFlow';
import { FactionAdvantageTip } from '../common/FactionAdvantageTip';
import { buildFarmFieldStatusView, FarmStatusCard } from '../farm/FarmStatusCard';

interface FarmCollectPresentationState {
  fieldId: string;
  tier: 'harvest' | 'critical';
  showSeeds: boolean;
}

interface FarmSceneProps {
  advantage?: ClientFactionAdvantagePanel;
  collectPresentation: FarmCollectPresentationState | null;
  fields: ClientFarmField[];
  tutorialTask: TutorialTask | null;
  uiRules: TutorialFarmUiRules;
  onAction: (action: ClientSceneAction, fieldId: string, fieldCode: string) => void;
  onTutorialAction: () => void;
}

export function FarmScene(props: FarmSceneProps): JSX.Element {
  const {
    collectPresentation,
    advantage,
    fields,
    tutorialTask,
    uiRules,
    onAction,
    onTutorialAction,
  } = props;
  const visibleFields = uiRules.visibleFieldLimit === null ? fields : fields.slice(0, uiRules.visibleFieldLimit);

  return (
    <div className="scene-shell farm-scene-shell">
      <div className="scene-scroll farm-scene-scroll">
        {tutorialTask ? (
          <article className="panel-card tutorial-starter-card">
            <p className="eyebrow">新手引导</p>
            <div className="panel-head">
              <h4>{tutorialTask.title}</h4>
            </div>
            <p className="panel-text">{tutorialTask.description}</p>
            <button className="secondary-button" onClick={onTutorialAction} type="button">
              {tutorialTask.actionLabel}
            </button>
          </article>
        ) : null}

        {advantage && uiRules.showFactionAdvantage ? <FactionAdvantageTip advantage={advantage} /> : null}

        <div className="card-grid farm-field-grid">
          {visibleFields.map((field) => {
            const primaryAction = field.actions[0];
            const canClick = Boolean(primaryAction) && (
              field.tone === 'empty'
              || Boolean(primaryAction?.label.includes('收取') || primaryAction?.label.includes('收获'))
            );

            return (
              <FarmStatusCard
                className={`field-card farm-plot ${field.tone}`}
                collectPresentation={collectPresentation?.fieldId === field.id ? collectPresentation : null}
                key={field.id}
                minimal
                onClick={() => {
                  if (!primaryAction || !canClick) {
                    return;
                  }

                  onAction(primaryAction, field.id, field.code);
                }}
                onKeyDown={(event) => {
                  if (!primaryAction || !canClick || (event.key !== 'Enter' && event.key !== ' ')) {
                    return;
                  }

                  event.preventDefault();
                  onAction(primaryAction, field.id, field.code);
                }}
                role={canClick ? 'button' : undefined}
                tabIndex={canClick ? 0 : undefined}
                view={buildFarmFieldStatusView(field)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
