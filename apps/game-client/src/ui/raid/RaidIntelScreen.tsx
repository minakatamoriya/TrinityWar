import type { ClientRaidTargetDetailResponse, ClientSceneAction } from '@trinitywar/shared';
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
  followed: boolean;
  onToggleFollow: () => void;
  farmTick: number;
}

const raidSpiritPreviewByTargetId: Record<string, { name: string; level: number; glyph: string }> = {
  'target-1': { name: '影豹', level: 9, glyph: '影' },
  'target-2': { name: '灵鹿', level: 8, glyph: '鹿' },
  'target-3': { name: '青猿', level: 6, glyph: '猿' },
  'target-4': { name: '玄虎', level: 11, glyph: '虎' },
  'target-5': { name: '霜狐', level: 5, glyph: '狐' },
};

const raidSpiritIntelByTargetId: Record<string, { element: string; attack: string; defense: string; status: string }> = {
  'target-1': { element: '火', attack: 'A', defense: 'C', status: '可出战' },
  'target-2': { element: '水', attack: 'B', defense: 'A', status: '状态正常' },
  'target-3': { element: '土', attack: 'B', defense: 'B', status: '可出战' },
  'target-4': { element: '木', attack: 'A', defense: 'B', status: '状态正常' },
  'target-5': { element: '金', attack: 'C', defense: 'B', status: '轻伤' },
};

function getRaidSpiritPreview(detail: ClientRaidTargetDetailResponse): { name: string; level: number; glyph: string } {
  return raidSpiritPreviewByTargetId[detail.targetId] ?? {
    name: '主战灵宠',
    level: Math.max(detail.level, 1),
    glyph: detail.faction.slice(0, 1),
  };
}

function getRaidSpiritIntel(detail: ClientRaidTargetDetailResponse): { element: string; attack: string; defense: string; status: string } {
  return raidSpiritIntelByTargetId[detail.targetId] ?? {
    element: '木',
    attack: 'B',
    defense: 'B',
    status: '可出战',
  };
}

export function RaidIntelScreen(props: RaidIntelScreenProps): JSX.Element {
  const [intelRevealed, setIntelRevealed] = useState(false);
  const { mode, targetName, detail, loading, error, onClose, onAction, followed, onToggleFollow, farmTick } = props;
  const title = mode === 'revenge' ? '复仇' : '掠夺';
  const visibleActions = detail ? detail.actions.filter((action) => action.label !== '分享目标') : [];
  const spiritPreview = detail ? getRaidSpiritPreview(detail) : null;
  const spiritIntel = detail ? getRaidSpiritIntel(detail) : null;

  useEffect(() => {
    setIntelRevealed(false);
  }, [detail?.targetId]);

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
              <span className="soft-tag">主城 Lv.{detail.level}</span>
              <span className="soft-tag">{detail.faction}</span>
              <span className="soft-tag">默认仅见外观与等级</span>
            </div>

            {spiritPreview ? (
              <article className="panel-card raid-spirit-card">
                <div className="raid-spirit-preview">
                  <div className="raid-spirit-avatar" aria-hidden="true">
                    <span>{spiritPreview.glyph}</span>
                  </div>
                  <div className="raid-spirit-info">
                    <p className="eyebrow">默认情报</p>
                    <h4>{spiritPreview.name}</h4>
                    <strong>Lv.{spiritPreview.level}</strong>
                  </div>
                </div>
                {intelRevealed && spiritIntel ? (
                  <div className="raid-spirit-revealed">
                    <div><span>五行</span><strong>{spiritIntel.element}</strong></div>
                    <div><span>攻击</span><strong>{spiritIntel.attack}</strong></div>
                    <div><span>防御</span><strong>{spiritIntel.defense}</strong></div>
                    <div><span>状态</span><strong>{spiritIntel.status}</strong></div>
                  </div>
                ) : (
                  <button className="secondary-button" onClick={() => setIntelRevealed(true)} type="button">深度窥视 · 免费 3 / 3</button>
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
                  <FarmStatusCard className="raid-intel-field-card" farmTick={farmTick} key={field.id} view={buildFarmFieldStatusView(field)} />
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
              <p><strong>主宠情报：</strong>默认只显示卡面外观与等级，不直接展示五行、状态和攻防评级。</p>
              <p><strong>保护状态：</strong>{detail.protectionStatus}</p>
            </div>

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
