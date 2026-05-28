import type { ClientFactionAdvantagePanel, ClientFarmField, ClientSceneAction, ClientSceneContentResponse } from '@trinitywar/shared';
import type { TutorialFarmUiRules } from '../../tutorial/tutorialFlow';
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
  landDeeds: NonNullable<ClientSceneContentResponse['farm']['landDeeds']>;
  farmBoardMessage: string;
  farmBoardUpdatedAt: string | null;
  uiRules: TutorialFarmUiRules;
  onAction: (action: ClientSceneAction, fieldId: string, fieldCode: string) => void;
  onOpenFarmBoard: () => void;
}

export function FarmScene(props: FarmSceneProps): JSX.Element {
  const {
    collectPresentation,
    advantage,
    fields,
    landDeeds,
    farmBoardMessage,
    uiRules,
    onAction,
    onOpenFarmBoard,
  } = props;
  const boardPreview = farmBoardMessage.trim() || '还没有留言，点击写下农场留言。';
  const visibleFields = uiRules.visibleFieldLimit === null ? fields : fields.slice(0, uiRules.visibleFieldLimit);

  return (
    <div className="scene-shell">
      <div className="scene-scroll farm-scene-scroll">
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
            const canClick = field.tone === 'empty' || Boolean(primaryAction?.label.includes('收取') || primaryAction?.label.includes('收获'));

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

        {landDeeds.length > 0 && uiRules.showLandDeeds ? (
          <article className="panel-card">
            <div className="panel-head">
              <h4>地契任务</h4>
            </div>
            <div className="task-list">
              {landDeeds.map((deed) => (
                <div className={`task-row task-row-${deed.status === 'claimed' ? 'claimed' : deed.status === 'completed' ? 'completed' : 'in-progress'}`} key={deed.deedKey}>
                  <span className="task-index">{deed.targetFieldSlotIndex}</span>
                  <div>
                    <div className="task-row-head">
                      <strong>{deed.title}</strong>
                      <span className="task-state-badge">{deed.status === 'claimed' ? '已开启' : deed.status === 'completed' ? '已完成' : '进行中'}</span>
                    </div>
                    <p>{deed.description}</p>
                    {[...deed.requirements, ...(deed.alternativeRequirements ?? [])].map((requirement) => (
                      <p className="task-progress-line" key={`${deed.deedKey}-${requirement.key}`}>
                        {requirement.label} {requirement.current}/{requirement.target}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
