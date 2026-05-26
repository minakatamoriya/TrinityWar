import type { ClientRaidDeepIntelResponse, ClientRaidSpiritIntel, ClientRaidSpiritPreview, ClientRaidTargetDetailResponse, ClientSceneAction } from '@trinitywar/shared';
import { useEffect, useState } from 'react';
import { ActionButton } from '../ActionButton';
import { buildFarmFieldStatusView, FarmStatusCard } from '../farm/FarmStatusCard';

interface RaidIntelScreenProps {
  mode: 'raid' | 'revenge';
  targetName: string;
  detail: ClientRaidTargetDetailResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onAction: (action: ClientSceneAction) => void;
  onRevealDeepIntel: (targetId: string) => Promise<ClientRaidDeepIntelResponse>;
  followed: boolean;
  onToggleFollow: () => void;
}

export function RaidIntelScreen(props: RaidIntelScreenProps): JSX.Element {
  const [intelState, setIntelState] = useState<ClientRaidSpiritIntel | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState<string | null>(null);
  const { mode, targetName, detail, loading, error, onClose, onAction, onRevealDeepIntel, followed, onToggleFollow } = props;
  const title = mode === 'revenge' ? '复仇' : '掠夺';
  const visibleActions = detail ? detail.actions.filter((action) => action.label !== '分享目标') : [];
  const spiritPreview = detail ? getRaidSpiritPreview(detail) : null;
  const remainingFreeIntel = intelState?.remainingFreeIntel ?? detail?.remainingFreeIntel ?? 0;
  const remainingTalismanIntel = intelState?.remainingTalismanIntel ?? detail?.remainingTalismanIntel ?? 0;
  const intelQuotaText = getIntelQuotaText(remainingFreeIntel, remainingTalismanIntel);

  useEffect(() => {
    setIntelState(null);
    setIntelLoading(false);
    setIntelError(null);
  }, [detail?.targetId]);

  const handleRevealDeepIntel = (): void => {
    if (!detail || intelLoading) {
      return;
    }

    setIntelLoading(true);
    setIntelError(null);

    void onRevealDeepIntel(detail.targetId).then((response) => {
      setIntelState(response.intel);
    }).catch(() => {
      setIntelError('深度窥视失败，可能是今日次数已用完或天机符不足。');
    }).finally(() => {
      setIntelLoading(false);
    });
  };

  return (
    <section className="raid-intel-screen" role="dialog" aria-modal="true" aria-label={`${title}情报页`}>
      <div className="raid-intel-topbar">
        <h3>{title}</h3>
        <button className="ghost-button small" onClick={onClose} type="button">关闭</button>
      </div>

      <div className="raid-intel-hero">
        <p className="raid-intel-name">{targetName}</p>
      </div>

      <div className="raid-intel-body">
        {loading ? <p className="panel-text">正在请求对手详情...</p> : null}
        {error ? <p className="panel-text raid-error-text">{error}</p> : null}

        {detail && !loading ? (
          <>
            <div className="raid-detail-topline">
              <span className="soft-tag">领地 Lv.{detail.level}</span>
              <span className="soft-tag">{detail.faction}</span>
              <span className="soft-tag">默认仅见外观与等级</span>
            </div>

            {spiritPreview ? (
              <article className="panel-card raid-spirit-card">
                <div className="raid-spirit-preview">
                  <div className="raid-spirit-avatar" aria-hidden="true">
                    <span>{spiritPreview.avatarGlyph}</span>
                  </div>
                  <div className="raid-spirit-info">
                    <p className="eyebrow">默认情报</p>
                    <h4>{spiritPreview.label}</h4>
                    <strong>Lv.{spiritPreview.level}</strong>
                  </div>
                </div>
                {intelState ? (
                  <div className="raid-spirit-revealed">
                    <div><span>五行</span><strong>{formatSpiritElement(intelState.element)}</strong></div>
                    <div><span>攻击</span><strong>{intelState.attackRating}</strong></div>
                    <div><span>状态</span><strong>{intelState.healthStatus}</strong></div>
                  </div>
                ) : (
                  <div className="raid-spirit-intel-action">
                    <button className="secondary-button" disabled={intelLoading} onClick={handleRevealDeepIntel} type="button">
                      {intelLoading ? '窥视中...' : '深度窥视'}
                    </button>
                    {intelError ? <span>{intelError}</span> : <span>{intelQuotaText}</span>}
                  </div>
                )}
              </article>
            ) : null}

            <div className="raid-intel-summary-card panel-card">
              <div className="panel-head">
                <h4>对手田地</h4>
                <span className="soft-tag">{detail.fieldStatus}</span>
              </div>
              <div className="farm-field-grid raid-intel-field-grid">
                {detail.fields.map((field) => (
                  <FarmStatusCard className="raid-intel-field-card" key={field.id} view={buildFarmFieldStatusView(field)} />
                ))}
              </div>
            </div>

            <div className="raid-asset-strip raid-intel-assets">
              <div className="target-meta raid-asset-card raid-visual-card">
                <span>可掠收益</span>
                <div className="raid-gold-preview" aria-hidden="true">
                  <span className="raid-gold-stack raid-gold-stack-back" />
                  <span className="raid-gold-stack raid-gold-stack-mid" />
                  <span className="raid-gold-stack raid-gold-stack-front" />
                </div>
                <strong>{detail.raidableGold}</strong>
                <em>{detail.exposedFruit}</em>
              </div>
            </div>

            <div className="raid-detail-status-list raid-intel-status-list">
              <p><strong>主宠情报：</strong>默认只显示卡面外观与等级，不直接展示五行、状态和攻击评级。</p>
              <p><strong>保护状态：</strong>{detail.protectionStatus}</p>
            </div>

            {detail.targetFarmBoardMessage ? (
              <article className="panel-card raid-farm-board-note">
                <p className="eyebrow">菜田留言</p>
                <p>{detail.targetFarmBoardMessage}</p>
              </article>
            ) : null}

            <article className="panel-card raid-intel-note">
              <p className="panel-text">{detail.detail}</p>
            </article>
          </>
        ) : null}
      </div>

      {detail && !loading ? (
        <div className="raid-intel-actionbar">
          <div className="raid-action-row">
            {visibleActions.map((action) => (
              <ActionButton action={action} disabled={action.label === '发布通缉令'} key={`${detail.targetId}-${action.label}`} onClick={onAction} />
            ))}
            <button className="action-button ghost" onClick={onToggleFollow} type="button">{followed ? '取消关注' : '关注'}</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function getRaidSpiritPreview(detail: ClientRaidTargetDetailResponse): ClientRaidSpiritPreview {
  return detail.mainPetPreview ?? {
    spiritId: null,
    label: '未发现主宠',
    level: Math.max(detail.level, 1),
    rarity: null,
    avatarGlyph: detail.faction.slice(0, 1) || '灵',
  };
}

function getIntelQuotaText(remainingFreeIntel: number, remainingTalismanIntel: number): string {
  if (remainingFreeIntel > 0) {
    return `今日免费窥视剩余 ${remainingFreeIntel} 次`;
  }

  if (remainingTalismanIntel > 0) {
    return `免费窥视已用完，天机符窥视剩余 ${remainingTalismanIntel} 次`;
  }

  return '今日免费窥视和天机符窥视次数已全部用完';
}

function formatSpiritElement(element: ClientRaidSpiritIntel['element']): string {
  if (element === 'metal') {
    return '金';
  }

  if (element === 'wood') {
    return '木';
  }

  if (element === 'water') {
    return '水';
  }

  if (element === 'fire') {
    return '火';
  }

  if (element === 'earth') {
    return '土';
  }

  return '未知';
}
