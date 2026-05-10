import type { ClientFarmField, ClientSceneAction } from '@trinitywar/shared';
import { ActionButton } from '../ActionButton';

const farmStageImageMap: Record<ClientFarmField['tone'], string> = {
  seeded: '/assets/farm/bozhong.png',
  growing: '/assets/farm/chengzhang.png',
  mature: '/assets/farm/chengshu.png',
  withered: '/assets/farm/kuwei.png',
  empty: '/assets/farm/weibozhong.png',
  locked: '/assets/farm/weibozhong.png',
};

function getFarmCardAction(field: ClientFarmField): ClientSceneAction | undefined {
  return field.actions[0];
}

function getFarmCardClassName(field: ClientFarmField): string {
  return `field-card farm-plot ${field.tone}`;
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(Math.floor(seconds), 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function getFarmProgressLabel(field: ClientFarmField, remainingSeconds: number): string {
  if (field.tone === 'seeded') {
    return `距离成长期 ${formatDuration(remainingSeconds)}`;
  }

  if (field.tone === 'growing') {
    return `距离成熟 ${formatDuration(remainingSeconds)}`;
  }

  if (field.tone === 'mature') {
    return '当前可收取';
  }

  if (field.tone === 'withered') {
    return '已过熟，收益衰减中';
  }

  if (field.tone === 'locked') {
    return '待解锁';
  }

  return '空闲中';
}

interface FarmSceneProps {
  fields: ClientFarmField[];
  farmTick: number;
  onAction: (action: ClientSceneAction, fieldId: string, fieldCode: string) => void;
}

export function FarmScene(props: FarmSceneProps): JSX.Element {
  const { fields, farmTick, onAction } = props;

  return (
    <div className="scene-shell">
      <div className="scene-scroll card-grid farm-field-grid">
        {fields.map((field) => {
          const remainingSeconds = Math.max(field.progressRemainingSeconds - farmTick, 0);
          const progressPercent = field.progressTotalSeconds > 0
            ? Math.max(Math.min(((field.progressTotalSeconds - remainingSeconds) / field.progressTotalSeconds) * 100, 100), 0)
            : 0;

          return (
            <article
              className={getFarmCardClassName(field)}
              key={field.id}
              role={field.tone === 'locked' ? 'button' : undefined}
              tabIndex={field.tone === 'locked' ? 0 : undefined}
              onClick={() => {
                const primaryAction = getFarmCardAction(field);
                if (field.tone === 'locked' && primaryAction) {
                  onAction(primaryAction, field.id, field.code);
                }
              }}
              onKeyDown={(event) => {
                const primaryAction = getFarmCardAction(field);
                if (field.tone === 'locked' && primaryAction && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  onAction(primaryAction, field.id, field.code);
                }
              }}
            >
              <div className="farm-plot-topline">
                <span className="stage-tag">{field.badge}</span>
              </div>
              <img alt={field.title} className="farm-plot-image" decoding="async" fetchPriority="high" height={512} loading="eager" src={farmStageImageMap[field.tone]} width={512} />
              <div className="farm-plot-meta">
                <div className="farm-progress-block">
                  <div className="farm-progress-track">
                    <span className="farm-progress-fill" style={{ width: `${progressPercent}%` }} />
                    <span className="farm-progress-label">{getFarmProgressLabel(field, remainingSeconds)}</span>
                  </div>
                </div>
                <p className="farm-plot-amount">{field.description}</p>
              </div>
              <div className="farm-plot-actions">
                {field.actions.map((action) => (
                  <ActionButton action={action} key={`${field.id}-${action.label}`} onClick={(nextAction) => {
                    onAction(nextAction, field.id, field.code);
                  }} />
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}