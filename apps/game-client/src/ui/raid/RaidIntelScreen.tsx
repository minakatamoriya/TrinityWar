import type {
  ClientRaidDeepIntelResponse,
  ClientRaidSpiritIntel,
  ClientRaidSpiritPreview,
  ClientRaidTargetDetailResponse,
  ClientSceneAction,
  ClientSpiritElement,
  ClientSpiritSlot,
  ClientSpiritState,
} from '@trinitywar/shared';
import { useEffect, useState } from 'react';
import { FullScreenToolShell } from '../common/ModalShell';

interface RaidIntelScreenProps {
  mode: 'raid' | 'revenge';
  targetName: string;
  detail: ClientRaidTargetDetailResponse | null;
  loading: boolean;
  error: string | null;
  spiritState: ClientSpiritState | null;
  pendingAction: boolean;
  onClose: () => void;
  onAction: (action: ClientSceneAction, selectedAttackerSpiritId: string | null) => void;
  onRevealDeepIntel: (targetId: string) => Promise<ClientRaidDeepIntelResponse>;
  followed: boolean;
  friend?: boolean;
  onToggleFollow: () => void;
  allowFollow?: boolean;
  allowDeepIntel?: boolean;
}

export function RaidIntelScreen(props: RaidIntelScreenProps): JSX.Element {
  const [intelState, setIntelState] = useState<ClientRaidSpiritIntel | null>(null);
  const [selectedSpiritId, setSelectedSpiritId] = useState<string | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState<string | null>(null);
  const {
    mode,
    targetName,
    detail,
    loading,
    error,
    spiritState,
    pendingAction,
    onClose,
    onAction,
    onRevealDeepIntel,
    followed,
    friend = false,
    onToggleFollow,
    allowFollow = true,
    allowDeepIntel = true,
  } = props;
  const title = mode === 'revenge' ? '复仇' : '战斗';
  const visibleActions = detail ? detail.actions.filter((action) => action.label !== '分享目标') : [];
  const spiritPreview = detail ? getRaidSpiritPreview(detail) : null;
  const directIntel = detail && !allowDeepIntel ? buildDirectTutorialIntel(detail) : null;
  const revealedIntel = intelState ?? directIntel;
  const defenderElement = revealedIntel?.element ?? null;
  const remainingFreeIntel = intelState?.remainingFreeIntel ?? detail?.remainingFreeIntel ?? 0;
  const remainingTalismanIntel = intelState?.remainingTalismanIntel ?? detail?.remainingTalismanIntel ?? 0;
  const intelQuotaText = getIntelQuotaText(remainingFreeIntel, remainingTalismanIntel);
  const battleSpiritSlots = spiritState?.slots ?? [];
  const selectableSpiritSlots = battleSpiritSlots.filter((slot) => slot.spiritId && slot.spiritInstanceId);
  const selectedSpiritSlot = battleSpiritSlots.find((slot) => slot.spiritInstanceId === selectedSpiritId) ?? null;

  useEffect(() => {
    setIntelState(null);
    setIntelLoading(false);
    setIntelError(null);
  }, [detail?.targetId]);

  useEffect(() => {
    const currentStillAvailable = selectableSpiritSlots.some((slot) => slot.spiritInstanceId === selectedSpiritId);
    if (currentStillAvailable) {
      return;
    }

    const preferredSlot = selectableSpiritSlots.find((slot) => slot.isMain) ?? selectableSpiritSlots[0] ?? null;
    setSelectedSpiritId(preferredSlot?.spiritInstanceId ?? null);
  }, [selectableSpiritSlots, selectedSpiritId]);

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
    <FullScreenToolShell
      ariaLabel={`${title}情报页`}
      bodyClassName="raid-intel-body"
      className="raid-intel-screen"
      onBack={onClose}
      title={title}
    >
      <div className="raid-intel-hero">
        <p className="raid-intel-name">{targetName}</p>
      </div>

      {loading ? <p className="panel-text">正在请求对手详情...</p> : null}
      {error ? <p className="panel-text raid-error-text">{error}</p> : null}

      {detail && !loading ? (
        <>
          <div className="raid-detail-topline">
            <span className="soft-tag">领地 Lv.{detail.level}</span>
            <span className="soft-tag">{detail.faction}</span>
            <span className="soft-tag">只查看当前主宠</span>
          </div>

          {spiritPreview ? (
            <article className="panel-card raid-spirit-card">
              <div className="raid-spirit-preview">
                <div className="raid-spirit-avatar" aria-hidden="true">
                  <span>{spiritPreview.avatarGlyph}</span>
                </div>
                <div className="raid-spirit-info">
                  <p className="eyebrow">对手主宠</p>
                  <h4>{spiritPreview.displayName || spiritPreview.label}</h4>
                  <strong>Lv.{spiritPreview.level}</strong>
                </div>
              </div>
              {revealedIntel ? (
                <div className="raid-spirit-revealed">
                  <div><span>五行</span><strong>{formatSpiritElement(revealedIntel.element)}</strong></div>
                  <div><span>攻击</span><strong>{revealedIntel.attackRating}</strong></div>
                  <div><span>状态</span><strong>{revealedIntel.healthStatus}</strong></div>
                  <div><span>词条</span><strong>{formatTraitSummary(revealedIntel.traits)}</strong></div>
                </div>
              ) : allowDeepIntel ? (
                <div className="raid-spirit-intel-action">
                  <button className="secondary-button" disabled={intelLoading} onClick={handleRevealDeepIntel} type="button">
                    {intelLoading ? '窥视中...' : '深度窥视'}
                  </button>
                  {intelError ? <span>{intelError}</span> : <span>{intelQuotaText}</span>}
                </div>
              ) : null}
            </article>
          ) : null}

          <article className="panel-card raid-attacker-picker">
            <div className="raid-attacker-picker-head">
              <div>
                <p className="eyebrow">我方出战</p>
                <h4>选择本次上场灵宠</h4>
              </div>
              <span className="soft-tag">不改变主展示宠</span>
            </div>
            <div className="raid-attacker-grid">
              {battleSpiritSlots.map((slot) => {
                const name = formatSpiritSlotName(slot, spiritState);
                return (
                  <button
                    className={`raid-attacker-option${slot.spiritInstanceId === selectedSpiritId ? ' selected' : ''}`}
                    disabled={!slot.spiritId || !slot.spiritInstanceId}
                    key={slot.slotIndex}
                    onClick={() => setSelectedSpiritId(slot.spiritInstanceId ?? null)}
                    type="button"
                  >
                    <span className="raid-attacker-card-art">
                      <span className="raid-attacker-card-glyph" aria-hidden="true">{getSpiritCardGlyph(name)}</span>
                      <em className="raid-attacker-element-badge">{formatSpiritElement(slot.element)}</em>
                    </span>
                    <span className="raid-attacker-row-info">
                      <span className="raid-attacker-option-title">
                        <strong>{name}</strong>
                        {slot.isMain ? <em>主位</em> : null}
                      </span>
                      <span className="raid-attacker-meta">
                        <span>Lv.{slot.level}</span>
                        <span>五行：{formatSpiritElement(slot.element)}</span>
                      </span>
                      <span className="raid-attacker-hint-row">
                        {isElementAdvantaged(slot.element, defenderElement) ? (
                          <small className="raid-attacker-control">五行克制</small>
                        ) : (
                          <small>点击查看词条</small>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedSpiritSlot ? (
              <div className="raid-attacker-trait-panel">
                <div className="raid-attacker-trait-head">
                  <strong>{formatSpiritSlotName(selectedSpiritSlot, spiritState)}词条</strong>
                  <span>点击卡片切换查看</span>
                </div>
                <div className="raid-attacker-trait-list">
                  {(selectedSpiritSlot.traits ?? []).length > 0
                    ? (selectedSpiritSlot.traits ?? []).map((trait) => (
                      <span key={`${selectedSpiritSlot.slotIndex}-${trait.slotIndex}-${trait.traitCode}`}>
                        {trait.label} +{trait.value}
                      </span>
                    ))
                    : <span>暂无词条</span>}
                </div>
              </div>
            ) : null}
            {selectableSpiritSlots.length <= 0 ? (
              <p className="panel-text raid-error-text">当前没有可出战的灵宠，请先养成一只灵宠。</p>
            ) : null}
          </article>

          <article className="panel-card raid-intel-note">
            <p className="panel-text">{detail.raidRule}</p>
          </article>
        </>
      ) : null}

      {detail && !loading ? (
        <div className="raid-intel-actionbar">
          <div className="raid-action-row">
            {visibleActions.map((action) => (
              <button
                className={`action-button ${action.tone ?? 'primary'}`}
                disabled={pendingAction || !selectedSpiritId}
                key={`${detail.targetId}-${action.label}`}
                onClick={() => onAction(action, selectedSpiritId)}
                type="button"
              >
                {pendingAction ? '出战中...' : action.label}
              </button>
            ))}
            {friend ? <span className="soft-tag">好友</span> : null}
            {allowFollow && !friend ? (
              <button className="action-button ghost" onClick={onToggleFollow} type="button">{followed ? '取消关注' : '关注'}</button>
            ) : null}
          </div>
        </div>
      ) : null}
    </FullScreenToolShell>
  );
}

function getRaidSpiritPreview(detail: ClientRaidTargetDetailResponse): ClientRaidSpiritPreview {
  return detail.mainPetPreview ?? {
    spiritId: null,
    sceneVisibility: 'masked',
    displayName: '未发现主宠',
    label: '未发现主宠',
    level: Math.max(detail.level, 1),
    rarity: null,
    avatarGlyph: detail.faction.slice(0, 1) || '灵',
  };
}

function buildDirectTutorialIntel(detail: ClientRaidTargetDetailResponse): ClientRaidSpiritIntel {
  return {
    element: getTutorialTargetElement(detail),
    attackRating: detail.combatPower || '教程目标',
    healthStatus: detail.defenseStatus || detail.protectionStatus || '可出战',
    traits: [],
    remainingFreeIntel: detail.remainingFreeIntel,
    remainingTalismanIntel: detail.remainingTalismanIntel,
  };
}

function getTutorialTargetElement(detail: ClientRaidTargetDetailResponse): ClientRaidSpiritIntel['element'] {
  const sourceText = `${detail.name} ${detail.faction} ${detail.detail}`;
  if (sourceText.includes('金')) return 'metal';
  if (sourceText.includes('木')) return 'wood';
  if (sourceText.includes('水')) return 'water';
  if (sourceText.includes('火')) return 'fire';
  if (sourceText.includes('土') || sourceText.includes('田')) return 'earth';
  return 'earth';
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

function formatSpiritSlotName(slot: ClientSpiritSlot, spiritState: ClientSpiritState | null): string {
  if (!slot.spiritId) {
    return `空栏位 ${slot.slotIndex}`;
  }

  return spiritState?.codex.find((entry) => entry.spiritId === slot.spiritId)?.definition.label
    ?? slot.spiritId;
}

function formatSpiritElement(element: ClientSpiritElement | null): string {
  if (element === 'metal') return '金';
  if (element === 'wood') return '木';
  if (element === 'water') return '水';
  if (element === 'fire') return '火';
  if (element === 'earth') return '土';
  return '未知';
}

function getSpiritCardGlyph(name: string): string {
  return Array.from(name.trim())[0] ?? '灵';
}

function formatTraitSummary(traits: ClientRaidSpiritIntel['traits']): string {
  if (!traits || traits.length <= 0) {
    return '未窥见';
  }

  return traits.map((trait) => trait.label).slice(0, 2).join('、');
}

function isElementAdvantaged(attacker: ClientSpiritElement | null, defender: ClientSpiritElement | null): boolean {
  if (!attacker || !defender) {
    return false;
  }

  return controls(attacker, defender);
}

function controls(left: ClientSpiritElement, right: ClientSpiritElement): boolean {
  return (
    (left === 'metal' && right === 'wood')
    || (left === 'wood' && right === 'earth')
    || (left === 'earth' && right === 'water')
    || (left === 'water' && right === 'fire')
    || (left === 'fire' && right === 'metal')
  );
}
