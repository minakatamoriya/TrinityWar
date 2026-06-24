import type {
  ClientSocialFriendFieldVisitResponse,
  ClientSocialRelationItem,
  ClientSocialSummaryResponse,
} from '@trinitywar/shared';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import { CenteredModalShell, FullScreenToolShell } from '../common/ModalShell';
import { FarmStatusCard, type FarmStatusViewModel } from '../farm/FarmStatusCard';

export type SocialTabKey = 'friends' | 'relations';

interface SocialSceneProps {
  activeTab: SocialTabKey;
  busy: boolean;
  error: string | null;
  summary: ClientSocialSummaryResponse | null;
  friendInviteUrl: string | null;
  friends: ClientSocialRelationItem[];
  following: ClientSocialRelationItem[];
  fieldVisit: ClientSocialFriendFieldVisitResponse | null;
  portalTarget: HTMLElement | null;
  onChangeTab: (tab: SocialTabKey) => void;
  onRefresh: () => void;
  onAssistFriend: (targetPlayerId: string) => void;
  onAssistAllFields: () => void;
  onOpenFieldVisit: (targetPlayerId: string) => void;
  onOpenSpiritProfile: (targetPlayerId: string) => void;
  onCloseFieldVisit: () => void;
  onRequestFriend: (targetPlayerId: string) => void;
  onDeleteFriend: (targetPlayerId: string) => void;
  onFollowTarget: (targetPlayerId: string) => void;
  onUnfollowTarget: (targetPlayerId: string) => void;
  onInviteFriend: () => void;
  onCopyFriendInviteUrl: (url: string) => void;
}

const socialTabs: Array<{ key: SocialTabKey; label: string }> = [
  { key: 'friends', label: '好友' },
  { key: 'relations', label: '关注' },
];

export function SocialScene({
  activeTab,
  busy,
  error,
  summary,
  friendInviteUrl,
  friends,
  following,
  fieldVisit,
  portalTarget,
  onChangeTab,
  onAssistFriend,
  onAssistAllFields,
  onOpenFieldVisit,
  onOpenSpiritProfile,
  onCloseFieldVisit,
  onRequestFriend,
  onDeleteFriend,
  onFollowTarget,
  onUnfollowTarget,
  onInviteFriend,
  onCopyFriendInviteUrl,
}: SocialSceneProps): JSX.Element {
  const [pendingDeleteFriend, setPendingDeleteFriend] = useState<{ nickname: string; targetPlayerId: string } | null>(null);
  const relationRows = buildRelationRows({ friends, following });
  const friendRows = relationRows.filter((relation) => relation.friendStatus === 'active');
  const followingRows = relationRows.filter((relation) => relation.friendStatus !== 'active' && relation.followingStatus === 'active');
  const tabCountByKey: Record<SocialTabKey, number> = {
    friends: summary?.counts.friends ?? friendRows.length,
    relations: summary?.counts.following ?? followingRows.length,
  };

  return (
    <div className="scene-scroll social-scene">
      {error ? <p className="social-error">{error}</p> : null}

      <section className="social-tab-row">
        {socialTabs.map((tab) => (
          <button
            className={`social-tab-button ${activeTab === tab.key ? 'active' : ''}`}
            key={tab.key}
            onClick={() => onChangeTab(tab.key)}
            type="button"
          >
            <span>{tab.label}</span>
            <strong className="social-tab-count">{tabCountByKey[tab.key]}</strong>
          </button>
        ))}
      </section>

      {activeTab === 'friends' ? (
        <section className="social-list">
          <div className="social-friend-toolbar">
            <span>邀请新玩家成为好友，双方领新友奖励</span>
            <button className="primary-button social-invite-button" disabled={busy} onClick={onInviteFriend} type="button">
              邀请领好礼
            </button>
          </div>
          {friendInviteUrl ? (
            <div className="social-friend-invite-url">
              <span>好友邀请 URL</span>
              <code>{friendInviteUrl}</code>
              <button className="ghost-button" onClick={() => onCopyFriendInviteUrl(friendInviteUrl)} type="button">
                复制
              </button>
            </div>
          ) : null}
          {friendRows.length > 0 ? friendRows.map((relation) => renderRelationCard({
            busy,
            onAssistFriend,
            onDeleteFriend: (targetPlayerId, nickname) => {
              setPendingDeleteFriend({ nickname, targetPlayerId });
            },
            onFollowTarget,
            onOpenFieldVisit,
            onOpenSpiritProfile,
            onRequestFriend,
            onUnfollowTarget,
            relation,
          })) : <EmptySocialState text="暂无好友，先邀请一位新玩家成为好友。" />}
        </section>
      ) : null}

      {activeTab === 'relations' ? (
        <section className="social-list">
          {followingRows.length > 0 ? followingRows.map((relation) => renderRelationCard({
            busy,
            onAssistFriend,
            onDeleteFriend,
            onFollowTarget,
            onOpenFieldVisit,
            onOpenSpiritProfile,
            onRequestFriend,
            onUnfollowTarget,
            relation,
          })) : <EmptySocialState text="暂无关注对象。可在战报或目标详情中关注玩家。" />}
        </section>
      ) : null}
      {pendingDeleteFriend ? (
        <CenteredModalShell
          closeLabel="取消"
          description={`删除后，你和 ${pendingDeleteFriend.nickname} 会从好友列表中移除。`}
          footer={(
            <>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => setPendingDeleteFriend(null)}
                type="button"
              >
                取消
              </button>
              <button
                className="ghost-button danger"
                disabled={busy}
                onClick={() => {
                  onDeleteFriend(pendingDeleteFriend.targetPlayerId);
                  setPendingDeleteFriend(null);
                }}
                type="button"
              >
                {busy ? '删除中...' : '确认删除'}
              </button>
            </>
          )}
          onClose={() => {
            if (!busy) {
              setPendingDeleteFriend(null);
            }
          }}
          title="确认删除好友"
        />
      ) : null}
      {fieldVisit && portalTarget ? createPortal((
        <FriendFieldVisitModal
          busy={busy}
          onClose={onCloseFieldVisit}
          onAssistAll={onAssistAllFields}
          visit={fieldVisit}
        />
      ), portalTarget) : null}
    </div>
  );
}

interface RelationRow {
  key: string;
  relationIds: string[];
  tags: string[];
  intimacy: number;
  lastInteractedAt: string | null;
  friendStatus: ClientSocialRelationItem['status'] | null;
  followingStatus: ClientSocialRelationItem['status'] | null;
  assistSummary?: ClientSocialRelationItem['assistSummary'];
  target: ClientSocialRelationItem['target'];
}

function buildRelationRows(input: {
  friends: ClientSocialRelationItem[];
  following: ClientSocialRelationItem[];
}): RelationRow[] {
  const rowMap = new Map<string, RelationRow>();

  const ensureRow = (relation: ClientSocialRelationItem): RelationRow => {
    const existing = rowMap.get(relation.target.playerId);
    if (existing) {
      return existing;
    }

    const row: RelationRow = {
      key: relation.target.playerId,
      relationIds: [],
      tags: [],
      intimacy: relation.intimacy,
      lastInteractedAt: relation.lastInteractedAt,
      friendStatus: null,
      followingStatus: null,
      assistSummary: relation.assistSummary,
      target: relation.target,
    };
    rowMap.set(relation.target.playerId, row);
    return row;
  };

  const append = (relation: ClientSocialRelationItem, tag: string): void => {
    const existing = ensureRow(relation);
    existing.relationIds.push(relation.id);
    if (!existing.tags.includes(tag)) {
      existing.tags.push(tag);
    }
    existing.intimacy = Math.max(existing.intimacy, relation.intimacy);
    existing.lastInteractedAt = pickRecentInteraction(existing.lastInteractedAt, relation.lastInteractedAt);
    if (relation.relationType === 'friend') {
      existing.friendStatus = relation.status;
      if (relation.status === 'active') {
        existing.tags = existing.tags.filter((existingTag) => existingTag !== '关注');
      }
    }
    if (relation.relationType === 'following') {
      existing.followingStatus = relation.status;
    }
    if (relation.assistSummary && (!existing.assistSummary || relation.assistSummary.availableCount > existing.assistSummary.availableCount)) {
      existing.assistSummary = relation.assistSummary;
    }
  };

  input.following.forEach((relation) => append(relation, '关注'));
  input.friends.forEach((relation) => append(relation, relation.status === 'pending' ? '待确认' : '好友'));

  return Array.from(rowMap.values()).sort((left, right) => {
    const interactionDiff = getInteractionTime(right.lastInteractedAt) - getInteractionTime(left.lastInteractedAt);
    return interactionDiff || right.intimacy - left.intimacy || left.target.nickname.localeCompare(right.target.nickname, 'zh-CN');
  });
}

function renderRelationCard(input: {
  busy: boolean;
  relation: RelationRow;
  onAssistFriend: (targetPlayerId: string) => void;
  onDeleteFriend: (targetPlayerId: string, nickname: string) => void;
  onFollowTarget: (targetPlayerId: string) => void;
  onOpenFieldVisit: (targetPlayerId: string) => void;
  onOpenSpiritProfile: (targetPlayerId: string) => void;
  onRequestFriend: (targetPlayerId: string) => void;
  onUnfollowTarget: (targetPlayerId: string) => void;
}): JSX.Element {
  const {
    busy,
    relation,
    onAssistFriend,
    onDeleteFriend,
    onFollowTarget,
    onOpenFieldVisit,
    onOpenSpiritProfile,
    onRequestFriend,
    onUnfollowTarget,
  } = input;

  return (
    <article className="panel-card social-relation-card" key={relation.key}>
      <div className="social-relation-avatar" aria-hidden="true">
        <span>{getRelationAvatarGlyph(relation.target.nickname)}</span>
      </div>
      <div className="social-relation-main">
        <div className="social-relation-headline">
          <h4>{relation.target.nickname}</h4>
          <span className="social-relation-intimacy">亲密度 {relation.intimacy}</span>
          <p>{relation.target.factionName ?? '未加入阵营'}</p>
        </div>
        <div className="social-relation-actions">
        {relation.friendStatus === 'active' ? (
          <>
            <button className="ghost-button social-relation-action-button is-accent" disabled={busy || !relation.assistSummary || relation.assistSummary.availableCount <= 0} onClick={() => onAssistFriend(relation.target.playerId)} type="button">
              {relation.assistSummary && relation.assistSummary.availableCount > 0 ? `助力${relation.assistSummary.availableCount}` : '助力'}
            </button>
            <button className="ghost-button social-relation-action-button" disabled={busy} onClick={() => onOpenFieldVisit(relation.target.playerId)} type="button">
              灵田
            </button>
            <button className="ghost-button social-relation-action-button" disabled={busy} onClick={() => onOpenSpiritProfile(relation.target.playerId)} type="button">
              灵宠
            </button>
            <button className="ghost-button social-relation-action-button danger" disabled={busy} onClick={() => onDeleteFriend(relation.target.playerId, relation.target.nickname)} type="button">
              删除
            </button>
          </>
        ) : (
          <>
            <button
              className="ghost-button social-relation-action-button"
              disabled={busy || relation.friendStatus === 'pending'}
              onClick={() => onRequestFriend(relation.target.playerId)}
              type="button"
            >
              {getRelationActionLabel(relation)}
            </button>
            {relation.followingStatus === 'active' ? (
              <button className="ghost-button social-relation-action-button" disabled={busy} onClick={() => onUnfollowTarget(relation.target.playerId)} type="button">
                取关
              </button>
            ) : (
              <button className="ghost-button social-relation-action-button" disabled={busy} onClick={() => onFollowTarget(relation.target.playerId)} type="button">
                关注
              </button>
            )}
            <button className="ghost-button social-relation-action-button" disabled={busy} onClick={() => onOpenSpiritProfile(relation.target.playerId)} type="button">
              灵宠
            </button>
          </>
        )}
        </div>
      </div>
    </article>
  );
}

function pickRecentInteraction(left: string | null, right: string | null): string | null {
  return getInteractionTime(right) > getInteractionTime(left) ? right : left;
}

function getInteractionTime(value: string | null): number {
  if (!value) {
    return 0;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getRelationActionLabel(relation: RelationRow): string {
  if (relation.friendStatus === 'active') {
    return '助力';
  }
  if (relation.friendStatus === 'pending') {
    return '待确';
  }
  return '加友';
}

function EmptySocialState({ actionLabel, onAction, text }: { actionLabel?: string; onAction?: () => void; text: string }): JSX.Element {
  return (
    <div className="panel-card social-empty-state">
      <p>{text}</p>
      {actionLabel && onAction ? (
        <button className="ghost-button" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function getRelationAvatarGlyph(nickname: string): string {
  return Array.from(nickname.trim())[0] ?? '友';
}

function FriendFieldVisitModal(props: {
  busy: boolean;
  visit: ClientSocialFriendFieldVisitResponse;
  onClose: () => void;
  onAssistAll: () => void;
}): JSX.Element {
  const hasActionableField = props.visit.fields.some((field) => field.nextAction !== null);

  return (
    <FullScreenToolShell
      ariaLabel="拜访灵田"
      bodyClassName="social-field-visit-body"
      className="social-field-visit-screen"
      description={props.visit.ruleText}
      eyebrow={props.visit.friend.nickname}
      onBack={props.onClose}
      title="拜访灵田"
    >
      <div className="card-grid farm-field-grid social-field-visit-grid">
        {props.visit.fields.map((field) => {
          const view = buildFriendFieldStatusView(field);

          return (
            <FarmStatusCard
              className="social-field-plot"
              compact
              key={field.fieldSlotId}
              view={view}
            />
          );
        })}
      </div>
      {!hasActionableField ? <p className="muted social-field-visit-empty">好友当前没有可助力的田地。等 TA 成熟或枯萎后再来。</p> : null}
      <div className="social-field-visit-actionbar">
        <div>
          <strong>{hasActionableField ? '一键结算当前可助力田地' : '暂无可助力田地'}</strong>
          <span>枯萎时自动复活，成熟后自动采摘。</span>
        </div>
        <button className="primary-button" disabled={props.busy || !hasActionableField} onClick={props.onAssistAll} type="button">
          {props.busy ? '助力中...' : '一键助力'}
        </button>
      </div>
    </FullScreenToolShell>
  );
}

function formatFriendFieldStatus(status: ClientSocialFriendFieldVisitResponse['fields'][number]['status']): string {
  if (status === 'LOCKED') {
    return '未解锁';
  }
  if (status === 'EMPTY') {
    return '空地';
  }
  if (status === 'GROWING') {
    return '成长中';
  }
  if (status === 'MATURE') {
    return '成熟';
  }
  return '枯萎';
}

function buildFriendFieldStatusView(field: ClientSocialFriendFieldVisitResponse['fields'][number]): FarmStatusViewModel {
  return {
    id: field.fieldSlotId,
    badge: field.badge,
    title: field.title,
    cropName: field.cropName ?? undefined,
    tone: field.tone,
    progressRemainingSeconds: 0,
    progressTotalSeconds: 1,
    progressLabel: getFriendFieldProgressLabel(field),
    showProgressTrack: false,
    yieldGold: field.yieldGold,
    description: field.unavailableReason ?? getFriendFieldDescription(field),
    emphasis: field.nextAction === 'harvest' && field.rewardPreview
      ? `一键助力可采摘 +${field.rewardPreview.gold} 金币`
      : field.nextAction === 'revive'
        ? '一键助力会先复活再直接收取'
        : undefined,
    harvestable: false,
  };
}

function getFriendFieldProgressLabel(field: ClientSocialFriendFieldVisitResponse['fields'][number]): string {
  if (field.nextAction === 'revive') {
    return '可一键助力';
  }
  if (field.nextAction === 'harvest') {
    return '可采摘';
  }
  if (field.status === 'GROWING') {
    return '成长中';
  }
  if (field.status === 'MATURE') {
    return '本轮已采摘';
  }
  return formatFriendFieldStatus(field.status);
}

function getFriendFieldDescription(field: ClientSocialFriendFieldVisitResponse['fields'][number]): string {
  if (field.nextAction === 'harvest') {
    return '作物已经成熟，可采摘一缕灵田余韵，不影响好友收成。';
  }
  if (field.nextAction === 'revive') {
    return '作物已经枯萎，可一键复活并直接收取。';
  }
  return formatFriendFieldStatus(field.status);
}


