import type { ClientRaidTargetDetailResponse, ClientSceneAction } from '@trinitywar/shared';
import { useState } from 'react';
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

export function RaidIntelScreen(props: RaidIntelScreenProps): JSX.Element {
  const [intelOpen, setIntelOpen] = useState(false);
  const { mode, targetName, detail, loading, error, onClose, onAction, followed, onToggleFollow, farmTick } = props;
  const title = mode === 'revenge' ? '复仇' : '掠夺';
  const visibleActions = detail ? detail.actions.filter((action) => action.label !== '分享目标') : [];

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
              <span className="soft-tag">默认仅见等级与品种</span>
            </div>

            <article className="panel-card raid-intel-note">
              <p className="panel-text">默认情报：可见对手主战灵宠等级与品种，不显示五行、状态和精确攻防。若要做精判断，需要先进行深度窥视。</p>
              <button className="secondary-button" onClick={() => setIntelOpen(true)} type="button">深度窥视 · 免费 3 / 3</button>
            </article>

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
              <p><strong>主宠品种：</strong>默认只显示品种，不直接展示五行。</p>
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

      {detail && intelOpen ? (
        <section className="seed-codex-screen spirit-pet-action-screen" role="dialog" aria-modal="true" aria-label="深度窥视">
          <div className="seed-codex-topbar">
            <div className="seed-codex-title-block">
              <p className="eyebrow">深度窥视</p>
              <p className="seed-codex-tip">每次挑战或复仇都需要重新窥视</p>
            </div>
            <button className="ghost-button small" onClick={() => setIntelOpen(false)} type="button">关闭</button>
          </div>
          <div className="seed-codex-body">
            <section className="seed-codex-detail-card">
              <div className="seed-codex-detail-head">
                <div>
                  <p className="eyebrow">{detail.faction}</p>
                  <h3>{targetName} 的主战灵宠</h3>
                </div>
              </div>
              <div className="seed-codex-stats">
                <div className="seed-codex-stat-row"><strong>五行属性</strong><span>木</span></div>
                <div className="seed-codex-stat-row"><strong>攻击评级</strong><span>A</span></div>
                <div className="seed-codex-stat-row"><strong>防御评级</strong><span>B</span></div>
                <div className="seed-codex-stat-row"><strong>当前状态</strong><span>可出战</span></div>
              </div>
              <p className="seed-codex-lore">五行相克：金克木，木克土，土克水，水克火，火克金。今日免费深度窥视 3 次，用完后可消耗天机符再追加 3 次。每次挑战、再次挑战和复仇都需要重新窥视。</p>
            </section>
          </div>
        </section>
      ) : null}
    </section>
  );
}
