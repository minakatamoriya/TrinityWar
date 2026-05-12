import type { ClientArmyTrainingQueue } from '@trinitywar/shared';

interface ArmyRecruitScreenProps {
  currentArmy: number;
  armyCapacity: number;
  currentGold: number;
  selectedCount: number;
  onSelectCount: (count: number) => void;
  onConfirm: () => void;
  confirming: boolean;
  trainingQueue: ClientArmyTrainingQueue | null;
  unitCostGold: number;
  unitTrainingSeconds: number;
  embedded?: boolean;
  onClose?: () => void;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(totalSeconds, 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}小时 ${minutes}分 ${seconds}秒`;
  }

  return `${minutes}分 ${seconds}秒`;
}

export function ArmyRecruitScreen(props: ArmyRecruitScreenProps): JSX.Element {
  const {
    currentArmy,
    armyCapacity,
    currentGold,
    selectedCount,
    onSelectCount,
    onConfirm,
    confirming,
    trainingQueue,
    unitCostGold,
    unitTrainingSeconds,
    embedded = false,
  } = props;
  const queuedUnits = trainingQueue?.queuedUnits ?? 0;
  const queueRemainingSeconds = trainingQueue ? Math.max(Math.ceil((new Date(trainingQueue.readyAt).getTime() - Date.now()) / 1000), 0) : 0;
  const queueProgress = trainingQueue
    ? Math.min(Math.max((trainingQueue.totalSeconds - queueRemainingSeconds) / Math.max(trainingQueue.totalSeconds, 1), 0), 1)
    : 0;
  const remainingCapacity = Math.max(armyCapacity - currentArmy - queuedUnits, 0);
  const affordableCount = Math.floor(currentGold / unitCostGold);
  const maxRecruitable = Math.min(remainingCapacity, affordableCount);
  const actualRecruitCount = Math.min(selectedCount, remainingCapacity, affordableCount);
  const totalCost = actualRecruitCount * unitCostGold;
  const canConfirm = actualRecruitCount > 0 && !confirming;
  const queueCostAfterAppend = (trainingQueue?.totalCost ?? 0) + totalCost;
  const finalQueuedUnits = queuedUnits + actualRecruitCount;
  const finalQueueSeconds = queueRemainingSeconds + actualRecruitCount * unitTrainingSeconds;
  const nextRemainingCapacity = Math.max(armyCapacity - currentArmy - finalQueuedUnits, 0);
  const limitedBy = affordableCount < remainingCapacity ? '金币' : '灵宠上限';
  const ariaProps = embedded
    ? { 'aria-label': '灵宠培育' }
    : { 'aria-label': '灵宠培育页', 'aria-modal': true, role: 'dialog' as const };

  return (
    <section className={`army-recruit-screen${embedded ? ' army-recruit-screen-embedded' : ''}`} {...ariaProps}>
      <div className="army-training-queue-card">
        <div className="army-training-queue-head">
          <div>
            <p className="eyebrow">灵宠培育</p>
            <h3>{trainingQueue ? `培育中 ${formatNumber(queuedUnits)} 只灵宠` : '当前没有灵宠培育队列'}</h3>
          </div>
          <span className="soft-tag">1 只灵宠 = {unitCostGold} 金币 / {unitTrainingSeconds} 秒</span>
        </div>
        <div className="army-training-progress-track" aria-hidden="true">
          <div className="army-training-progress-fill" style={{ width: `${queueProgress * 100}%` }} />
        </div>
        <div className="army-training-queue-meta">
          {trainingQueue ? (
            <>
              <div className="army-training-meta-item">
                <span>剩余时间</span>
                <strong>{formatDuration(queueRemainingSeconds)}</strong>
              </div>
              {/* <div className="army-training-meta-item">
                <span>完成时刻</span>
                <strong>{formatClockTime(trainingQueue.readyAt)}</strong>
              </div>
              <div className="army-training-meta-item">
                <span>已扣金币</span>
                <strong>{formatNumber(trainingQueue.totalCost)}</strong>
              </div> */}
            </>
          ) : (
            <p className="army-training-empty-text">金币会在点击确认时立即扣除，灵宠会在倒计时结束后统一入列。</p>
          )}
        </div>
      </div>

      <div className="army-recruit-body">
        <article className="army-recruit-option-panel">
          <div className="army-recruit-slider-panel">
            <div className="army-recruit-slider-head">
              <strong>{formatNumber(actualRecruitCount)} 只灵宠</strong>
              <span>最大可培育 {formatNumber(maxRecruitable)} 只</span>
            </div>
            <input
              aria-label="灵宠培育数量"
              className="army-recruit-slider"
              disabled={maxRecruitable <= 0 || confirming}
              max={Math.max(maxRecruitable, 0)}
              min={0}
              onChange={(event) => onSelectCount(Number(event.target.value))}
              step={1}
              type="range"
              value={Math.min(actualRecruitCount, maxRecruitable)}
            />
            <div className="army-recruit-slider-scale" aria-hidden="true">
              <span>0</span>
              <span>{formatNumber(Math.floor(maxRecruitable / 2))}</span>
              <span>{formatNumber(maxRecruitable)}</span>
            </div>
            <div className="army-recruit-preview-grid">
              <div className="army-recruit-preview-card">
                <span>本次消耗</span>
                <strong>{formatNumber(totalCost)}</strong>
                <em>金币</em>
              </div>
              <div className="army-recruit-preview-card">
                <span>追加后排队</span>
                <strong>{formatNumber(finalQueuedUnits)}</strong>
                <em>只</em>
              </div>
              <div className="army-recruit-preview-card">
                <span>队列总耗时</span>
                <strong>{formatDuration(finalQueueSeconds)}</strong>
                <em>重算后</em>
              </div>
              <div className="army-recruit-preview-card">
                <span>剩余灵宠位</span>
                <strong>{formatNumber(nextRemainingCapacity)}</strong>
                <em>完成后</em>
              </div>
            </div>
            <p className="army-recruit-slider-note">
              {maxRecruitable > 0
                ? `当前最大培育量由${limitedBy}限制，滑块会自动卡在可用范围内。`
                : remainingCapacity <= 0
                  ? '当前灵宠已满，请先提升灵宠上限后再继续培育。'
                  : '当前金币不足以培育任何灵宠。'}
            </p>
          </div>
        </article>
      </div>

      <div className="army-recruit-actionbar">
        <div className="army-recruit-summary">
          <strong>{actualRecruitCount > 0 ? `确认培育 ${formatNumber(actualRecruitCount)} 只灵宠` : '当前无法培育'}</strong>
          <span>
            {actualRecruitCount > 0
              ? `本次将立即扣除 ${formatNumber(totalCost)} 金币，并把培育队列更新为 ${formatNumber(finalQueuedUnits)} 只灵宠，累计已花 ${formatNumber(queueCostAfterAppend)} 金币。`
              : remainingCapacity <= 0
                ? '当前灵宠上限已被现有灵宠和培育队列占满，请先等待培育完成或扩充上限。'
                : '当前金币不足以支持灵宠培育。'}
          </span>
        </div>
        <button className="primary-button" disabled={!canConfirm} onClick={onConfirm} type="button">
          {confirming ? '提交中...' : trainingQueue ? '追加培育' : '开始培育'}
        </button>
      </div>
    </section>
  );
}