import { useState } from 'react';
import type { ClientSpiritElement, ClientSpiritPublicProfileResponse, ClientSpiritPublicSlot } from '@trinitywar/shared';
import { FullScreenToolShell } from './ModalShell';

interface SpiritPublicProfileModalProps {
  error: string | null;
  loading: boolean;
  profile: ClientSpiritPublicProfileResponse | null;
  onClose: () => void;
}

export function SpiritPublicProfileModal(props: SpiritPublicProfileModalProps): JSX.Element {
  const { error, loading, profile, onClose } = props;
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const selectedSlot = profile?.slots.find((slot) => slot.slotIndex === selectedSlotIndex)
    ?? profile?.mainSlot
    ?? profile?.slots.find((slot) => slot.spiritId)
    ?? null;

  return (
    <FullScreenToolShell
      ariaLabel="查看灵宠"
      bodyClassName="spirit-public-profile-body"
      className="spirit-public-profile-screen"
      eyebrow={profile ? getRelationLabel(profile.viewerRelation) : '灵宠展示'}
      onBack={onClose}
      title={profile?.player.nickname ?? '查看灵宠'}
    >
      {loading ? <p className="panel-text">正在读取对方灵宠...</p> : null}
      {error ? <p className="panel-text raid-error-text">{error}</p> : null}
      {profile && !loading ? (
        <>
          <section className="panel-card spirit-public-player-card">
            <div>
              <p className="eyebrow">玩家资料</p>
              <h4>{profile.player.nickname}</h4>
            </div>
            <div className="spirit-public-player-tags">
              <span className="soft-tag">{profile.player.factionName ?? '未入阵营'}</span>
              <span className="soft-tag">主城 Lv.{profile.player.castleLevel}</span>
              <span className="soft-tag">{getRelationLabel(profile.viewerRelation)}</span>
            </div>
          </section>

          <section className="panel-card spirit-public-slot-list">
            <div className="panel-head">
              <h4>灵宠栏位</h4>
              <span className="soft-tag">点击查看词条</span>
            </div>
            <div className="spirit-public-list">
              {profile.slots.map((slot) => (
                <button
                  className={`spirit-public-row${slot.slotIndex === selectedSlot?.slotIndex ? ' selected' : ''}${slot.spiritId ? '' : ' is-empty'}`}
                  disabled={!slot.spiritId}
                  key={slot.slotIndex}
                  onClick={() => setSelectedSlotIndex(slot.slotIndex)}
                  type="button"
                >
                  <span className="spirit-public-art" aria-hidden="true">
                    <span>{getSpiritGlyph(slot)}</span>
                    <em>{formatElement(slot.element)}</em>
                  </span>
                  <span className="spirit-public-row-main">
                    <span className="spirit-public-title">
                      <strong>{slot.label}</strong>
                      {slot.isMain ? <em>主位</em> : null}
                    </span>
                    <span className="spirit-public-meta">
                      <span>{slot.spiritId ? `Lv.${slot.level}` : '未结契'}</span>
                      <span>{formatRarity(slot.rarity)}</span>
                      <span>五行：{formatElement(slot.element)}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {selectedSlot?.spiritId ? (
            <section className="panel-card spirit-public-traits">
              <div className="panel-head">
                <h4>{selectedSlot.label}词条</h4>
                <span className="soft-tag">当前已开放 {selectedSlot.traits.length} 条</span>
              </div>
              <div className="spirit-public-trait-list">
                {selectedSlot.traits.length > 0
                  ? selectedSlot.traits.map((trait) => (
                    <span key={`${selectedSlot.spiritInstanceId}-${trait.slotIndex}-${trait.traitCode}`}>
                      {trait.label} +{trait.value}
                    </span>
                  ))
                  : <span>暂无词条</span>}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </FullScreenToolShell>
  );
}

function getRelationLabel(relation: ClientSpiritPublicProfileResponse['viewerRelation']): string {
  if (relation === 'self') return '自己';
  if (relation === 'friend') return '好友完整可见';
  if (relation === 'following') return '已关注';
  return '战报对手';
}

function getSpiritGlyph(slot: ClientSpiritPublicSlot): string {
  return Array.from(slot.label.trim())[0] ?? '灵';
}

function formatElement(element: ClientSpiritElement | null): string {
  if (element === 'metal') return '金';
  if (element === 'wood') return '木';
  if (element === 'water') return '水';
  if (element === 'fire') return '火';
  if (element === 'earth') return '土';
  return '未知';
}

function formatRarity(rarity: ClientSpiritPublicSlot['rarity']): string {
  if (rarity === 'legendary') return '传说';
  if (rarity === 'rare') return '稀有';
  if (rarity === 'common') return '普通';
  return '空栏';
}
