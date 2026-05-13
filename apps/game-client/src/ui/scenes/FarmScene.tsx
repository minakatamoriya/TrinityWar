import type { ClientFarmField, ClientSceneAction } from '@trinitywar/shared';
import { buildFarmFieldStatusView, FarmStatusCard } from '../farm/FarmStatusCard';

interface FarmCollectPresentationState {
  fieldId: string;
  tier: 'harvest' | 'critical';
  showSeeds: boolean;
}

function getFarmCardAction(field: ClientFarmField): ClientSceneAction | undefined {
  return field.actions[0];
}

function getFarmCardClassName(field: ClientFarmField): string {
  return `field-card farm-plot ${field.tone}`;
}

interface FarmSceneProps {
  collectPresentation: FarmCollectPresentationState | null;
  fields: ClientFarmField[];
  farmTick: number;
  onAction: (action: ClientSceneAction, fieldId: string, fieldCode: string) => void;
  onOpenSeedCodex: () => void;
}

export function FarmScene(props: FarmSceneProps): JSX.Element {
  const { collectPresentation, fields, farmTick, onAction, onOpenSeedCodex } = props;

  return (
    <div className="scene-shell">
      <div className="scene-scroll farm-scene-scroll">
        <button className="secondary-button farm-codex-button" onClick={onOpenSeedCodex} type="button">灵植图鉴</button>
        <div className="card-grid farm-field-grid">
          {fields.map((field) => (
            <FarmStatusCard
              className={getFarmCardClassName(field)}
              collectPresentation={collectPresentation?.fieldId === field.id ? collectPresentation : null}
              farmTick={farmTick}
              key={field.id}
              minimal
              onClick={() => {
                const primaryAction = getFarmCardAction(field);
                if (!primaryAction) {
                  return;
                }

                if (field.tone === 'empty' || primaryAction.label.includes('收取')) {
                  onAction(primaryAction, field.id, field.code);
                }
              }}
              onKeyDown={(event) => {
                const primaryAction = getFarmCardAction(field);
                if (!primaryAction) {
                  return;
                }

                if ((field.tone === 'empty' || primaryAction.label.includes('收取')) && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  onAction(primaryAction, field.id, field.code);
                }
              }}
              role={field.tone === 'empty' || Boolean(getFarmCardAction(field)?.label.includes('收取')) ? 'button' : undefined}
              tabIndex={field.tone === 'empty' || Boolean(getFarmCardAction(field)?.label.includes('收取')) ? 0 : undefined}
              view={buildFarmFieldStatusView(field)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}