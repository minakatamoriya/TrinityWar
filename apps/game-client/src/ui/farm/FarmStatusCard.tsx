import type { KeyboardEventHandler, MouseEventHandler, ReactNode } from 'react';
import type { ClientFarmField, ClientRaidTargetDetailResponse } from '@trinitywar/shared';

export interface FarmStatusViewModel {
  id: string;
  badge: string;
  title: string;
  cropName?: string;
  tone: ClientFarmField['tone'];
  progressRemainingSeconds: number;
  progressTotalSeconds: number;
  yieldGold: number;
  description: string;
  emphasis?: string;
  note?: string;
  lockedHint?: string;
  centerActionLabel?: string;
  harvestable?: boolean;
}

interface FarmCollectPresentationState {
  fieldId: string;
  tier: 'harvest' | 'critical';
  showSeeds: boolean;
}

const farmStageImageMap: Record<ClientFarmField['tone'], string> = {
  growing: '/assets/farm/chengzhang.png',
  mature: '/assets/farm/chengshu.png',
  withered: '/assets/farm/kuwei.png',
  empty: '/assets/farm/weibozhong.png',
  locked: '/assets/farm/weibozhong.png',
};

const raidFieldBadgeMap: Record<ClientFarmField['tone'], string> = {
  growing: '成长',
  mature: '成熟',
  withered: '枯萎',
  empty: '空闲',
  locked: '待解锁',
};

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(Math.floor(seconds), 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function getFarmProgressLabel(view: FarmStatusViewModel, remainingSeconds: number): string {
  if (view.tone === 'growing') {
    return `距离成熟 ${formatDuration(remainingSeconds)}`;
  }

  if (view.tone === 'mature') {
    return '成熟可收';
  }

  if (view.tone === 'withered') {
    return '已枯萎，收益衰减中';
  }

  if (view.tone === 'locked') {
    return view.lockedHint ?? '待解锁';
  }

  return '空闲中';
}

export function buildFarmFieldStatusView(field: ClientFarmField): FarmStatusViewModel {
  const primaryAction = field.actions[0];

  return {
    id: field.id,
    badge: field.badge,
    title: field.title,
    cropName: field.cropName,
    tone: field.tone,
    progressRemainingSeconds: field.progressRemainingSeconds,
    progressTotalSeconds: field.progressTotalSeconds,
    yieldGold: field.yieldGold,
    description: field.description,
    lockedHint: field.tone === 'locked'
      ? field.description
        .replace('这块田地会在主城达到 ', '')
        .replace(' 时自动赠送开启。', ' 自动解锁')
        .replace('这块田地会随主城里程碑自动开启。', '随主城里程碑自动解锁')
      : undefined,
    centerActionLabel: field.tone === 'empty' ? primaryAction?.label : undefined,
    harvestable: field.tone === 'mature' || field.tone === 'withered' || Boolean(primaryAction?.label?.includes('收取')),
  };
}

export function buildRaidFieldStatusView(detail: ClientRaidTargetDetailResponse): FarmStatusViewModel {
  return {
    id: detail.targetId,
    badge: raidFieldBadgeMap[detail.fieldPreviewTone],
    title: detail.fieldStatus,
    cropName: undefined,
    tone: detail.fieldPreviewTone,
    progressRemainingSeconds: 0,
    progressTotalSeconds: 1,
    yieldGold: 0,
    description: detail.exposedFruit,
    emphasis: `可争夺收益 ${detail.raidableGold}`,
    note: detail.raidRule,
  };
}

interface FarmStatusCardProps {
  view: FarmStatusViewModel;
  minimal?: boolean;
  collectPresentation?: FarmCollectPresentationState | null;
  compact?: boolean;
  footer?: ReactNode;
  className?: string;
  role?: string;
  tabIndex?: number;
  onClick?: MouseEventHandler<HTMLElement>;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
}

export function FarmStatusCard(props: FarmStatusCardProps): JSX.Element {
  const { view, minimal = false, collectPresentation = null, compact = false, footer, className, role, tabIndex, onClick, onKeyDown } = props;
  const remainingSeconds = Math.max(view.progressRemainingSeconds, 0);
  const hasProgressTrack = minimal
    ? view.tone === 'growing'
    : view.tone !== 'empty' && view.tone !== 'locked';
  const progressPercent = hasProgressTrack && view.progressTotalSeconds > 0
    ? Math.max(Math.min(((view.progressTotalSeconds - remainingSeconds) / view.progressTotalSeconds) * 100, 100), 0)
    : 0;
  const rootClassName = ['field-card', 'farm-plot', 'farm-status-card', view.tone, compact ? 'compact' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <article className={rootClassName} onClick={onClick} onKeyDown={onKeyDown} role={role} tabIndex={tabIndex}>
      <div className="farm-plot-topline">
        <span className="stage-tag">{view.badge}</span>
        {view.cropName ? <span className="farm-crop-tag">{view.cropName}</span> : null}
      </div>
      <img alt={view.title} className="farm-plot-image" decoding="async" height={512} loading={compact ? 'lazy' : 'eager'} src={farmStageImageMap[view.tone]} width={512} />
      {view.centerActionLabel ? <span className="farm-center-action">{view.centerActionLabel}</span> : null}
      {minimal && view.harvestable ? <span className="farm-harvest-pointer" aria-hidden="true">👆</span> : null}
      {minimal && collectPresentation ? (
        <div className={`farm-collect-presentation ${collectPresentation.tier === 'critical' ? 'critical' : ''}`} aria-hidden="true">
          <span className="farm-collect-badge">{collectPresentation.tier === 'critical' ? '暴击' : '丰收'}</span>
          <div className="farm-coin-burst">
            <span />
            <span />
            <span />
            <span />
          </div>
          {collectPresentation.showSeeds ? (
            <div className="farm-seed-burst">
              <span />
              <span />
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={`farm-progress-block${minimal ? ' overlay' : ''}`}>
        <div className={`farm-progress-track${hasProgressTrack ? '' : ' is-static'}`}>
          {hasProgressTrack ? <span className="farm-progress-fill" style={{ width: `${progressPercent}%` }} /> : null}
          <span className="farm-progress-label">{getFarmProgressLabel(view, remainingSeconds)}</span>
        </div>
      </div>
      {!minimal ? (
        <div className="farm-plot-meta">
          <div className="farm-plot-heading">
            <strong>{view.cropName ?? view.title}</strong>
            {view.cropName ? <span>{view.title}</span> : null}
          </div>
          <p className="farm-plot-detail">{view.description}</p>
          {view.emphasis ? <strong className="farm-status-emphasis">{view.emphasis}</strong> : null}
          {view.note ? <p className="farm-status-note">{view.note}</p> : null}
        </div>
      ) : null}
      {footer ? <div className="farm-status-footer">{footer}</div> : null}
    </article>
  );
}
