import type { ClientFactionAdvantagePanel, ClientFarmField, ClientSceneAction } from '@trinitywar/shared';
import type { TutorialFarmUiRules, TutorialTask } from '../../tutorial/tutorialFlow';
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
  farmBoardMessage: string;
  farmBoardUpdatedAt: string | null;
  tutorialTask: TutorialTask | null;
  uiRules: TutorialFarmUiRules;
  onAction: (action: ClientSceneAction, fieldId: string, fieldCode: string) => void;
  onOpenFarmBoard: () => void;
  onTutorialAction: () => void;
}

export function FarmScene(props: FarmSceneProps): JSX.Element {
  const {
    collectPresentation,
    advantage,
    fields,
    farmBoardMessage,
    tutorialTask,
    uiRules,
    onAction,
    onOpenFarmBoard,
    onTutorialAction,
  } = props;
  const boardPreview = farmBoardMessage.trim() || '还没有留言，点击写下农场留言。';
  const visibleFields = uiRules.visibleFieldLimit === null ? fields : fields.slice(0, uiRules.visibleFieldLimit);

  return (
    <div className="scene-shell">
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

        {advantage && uiRules.showFactionAdvantage ? (
          <article className="panel-card faction-advantage-panel">
            <div className="panel-head">
              <h4>{advantage.factionName}优势</h4>
              <span className="soft-tag">{advantage.title}</span>
            </div>
            <p className="panel-text">{advantage.summary}</p>
            {advantage.details.length > 0 ? (
              <ul className="mini-list">
                {advantage.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ) : null}

        {uiRules.showFarmBoard ? (
          <div className="farm-top-card-grid">
            <button className="panel-card farm-top-action-card farm-board-panel-card" onClick={onOpenFarmBoard} type="button">
              <span className="farm-board-icon" aria-hidden="true">田</span>
              <span className="farm-board-copy">
                <strong>{boardPreview}</strong>
              </span>
            </button>
          </div>
        ) : null}

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
