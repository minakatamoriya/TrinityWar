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

function isHarvestAction(action: ClientSceneAction | undefined): boolean {
  return Boolean(action?.label.includes('收取') || action?.label.includes('鏀跺彇'));
}

interface FarmSceneProps {
  collectPresentation: FarmCollectPresentationState | null;
  fields: ClientFarmField[];
  farmTick: number;
  farmBoardMessage: string;
  farmBoardUpdatedAt: string | null;
  onAction: (action: ClientSceneAction, fieldId: string, fieldCode: string) => void;
  onOpenFarmBoard: () => void;
  onOpenSeedCodex: () => void;
}

export function FarmScene(props: FarmSceneProps): JSX.Element {
  const {
    collectPresentation,
    fields,
    farmTick,
    farmBoardMessage,
    farmBoardUpdatedAt,
    onAction,
    onOpenFarmBoard,
    onOpenSeedCodex,
  } = props;
  const boardPreview = farmBoardMessage.trim() || '还没有留言，点击写下农场留言。';
  const boardUpdatedText = farmBoardUpdatedAt
    ? `最后修改 ${new Date(farmBoardUpdatedAt).toLocaleString('zh-CN', { hour12: false })}`
    : '点击留言或修改';

  return (
    <div className="scene-shell">
      <div className="scene-scroll farm-scene-scroll">
        <div className="farm-top-card-grid">
          <button className="panel-card farm-top-action-card farm-codex-panel-card" onClick={onOpenSeedCodex} type="button">
            <span className="eyebrow">灵植图鉴</span>
            <strong>查看已发现灵植</strong>
            <span>按稀有度浏览种子、收益和培育策略。</span>
          </button>
          <button className="panel-card farm-top-action-card farm-board-panel-card" onClick={onOpenFarmBoard} type="button">
            <span className="eyebrow">农场留言板</span>
            <strong>{boardPreview}</strong>
            <span>{boardUpdatedText}</span>
          </button>
        </div>

        <div className="card-grid farm-field-grid">
          {fields.map((field) => {
            const primaryAction = getFarmCardAction(field);
            const canClick = field.tone === 'empty' || isHarvestAction(primaryAction);

            return (
              <FarmStatusCard
                className={getFarmCardClassName(field)}
                collectPresentation={collectPresentation?.fieldId === field.id ? collectPresentation : null}
                farmTick={farmTick}
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
