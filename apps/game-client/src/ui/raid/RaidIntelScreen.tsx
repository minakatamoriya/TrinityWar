import type { ClientRaidTargetDetailResponse, ClientSceneAction } from '@trinitywar/shared';
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
              <span className="soft-tag">灵宠守备 {detail.combatPower}</span>
            </div>

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
              <p><strong>防守状态：</strong>{detail.defenseStatus}</p>
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