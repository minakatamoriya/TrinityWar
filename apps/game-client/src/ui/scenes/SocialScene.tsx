import type {
  ClientSocialFeedItem,
  ClientSocialFriendFieldVisitResponse,
  ClientSocialRelationItem,
  ClientSocialSummaryResponse,
} from '@trinitywar/shared';
import { createPortal } from 'react-dom';
import { FullScreenToolShell } from '../common/ModalShell';
import { FarmStatusCard, type FarmStatusViewModel } from '../farm/FarmStatusCard';

export type SocialTabKey = 'friends' | 'relations' | 'feed';

interface SocialSceneProps {
  activeTab: SocialTabKey;
  busy: boolean;
  error: string | null;
  summary: ClientSocialSummaryResponse | null;
  friendInviteUrl: string | null;
  feed: ClientSocialFeedItem[];
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
  onAcceptFriendRequest: (relationId: string) => void;
  onRejectFriendRequest: (relationId: string) => void;
}

const socialTabs: Array<{ key: SocialTabKey; label: string }> = [
  { key: 'friends', label: '好友' },
  { key: 'relations', label: '关系' },
  { key: 'feed', label: '动态' },
];

export function SocialScene({
  activeTab,
  busy,
  error,
  summary,
  friendInviteUrl,
  feed,
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
  onAcceptFriendRequest,
  onRejectFriendRequest,
}: SocialSceneProps): JSX.Element {
  const relationRows = buildRelationRows({ friends, following });
  const friendRows = relationRows.filter((relation) => relation.friendStatus === 'active');
  const followingRows = relationRows.filter((relation) => relation.friendStatus !== 'active' && relation.followingStatus === 'active');

  return (
    <div className="scene-scroll social-scene">
      {summary ? (
        <section className="social-metric-strip">
          <span>好友 {summary.counts.friends}/{summary.counts.friendLimit}</span>
          <span>关注 {summary.counts.following}/{summary.counts.followingLimit}</span>
          <span>动态 {summary.counts.feedUnread}</span>
        </section>
      ) : null}

      {error ? <p className="social-error">{error}</p> : null}

      <section className="tab-row">
        {socialTabs.map((tab) => (
          <button
            className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
            key={tab.key}
            onClick={() => onChangeTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </section>

      {activeTab === 'feed' ? (
        <section className="social-list">
          {feed.length > 0 ? feed.map((item) => (
            <article className="panel-card social-feed-card" key={item.id}>
              <div className="panel-head">
                <span className="soft-tag">{item.actor?.nickname ?? '系统'}</span>
                <span className="card-label">{formatDateTime(item.createdAt)}</span>
              </div>
              <p>{item.summary}</p>
              {item.actions.length > 0 ? (
                <div className="button-row">
                  {item.actions.map((action) => (
                    <button
                      className="ghost-button"
                      disabled={isFeedActionDisabled(action, busy)}
                      key={`${item.id}-${action.action}`}
                      onClick={() => {
                        if (action.action === 'accept_friend' && action.relatedEntityId) {
                          onAcceptFriendRequest(action.relatedEntityId);
                        }
                        if (action.action === 'reject_friend' && action.relatedEntityId) {
                          onRejectFriendRequest(action.relatedEntityId);
                        }
                      }}
                      type="button"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          )) : <EmptySocialState text="还没有新的社交动态。" />}
        </section>
      ) : null}

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
            onDeleteFriend,
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
  onDeleteFriend: (targetPlayerId: string) => void;
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
      <div>
        <h4>{relation.target.nickname}</h4>
        <p>{relation.target.factionName ?? '未加入阵营'} · {relation.target.castleLevel} 级 · 亲密度 {relation.intimacy}</p>
        <div className="social-relation-tags">
          {getRelationTags(relation).map((tag) => <span className="soft-tag" key={`${relation.key}-${tag}`}>{tag}</span>)}
        </div>
      </div>
      <div className="social-relation-actions">
        {relation.friendStatus === 'active' ? (
          <>
            <button className="primary-button" disabled={busy || !relation.assistSummary || relation.assistSummary.availableCount <= 0} onClick={() => onAssistFriend(relation.target.playerId)} type="button">
              {relation.assistSummary && relation.assistSummary.availableCount > 0 ? `助力 ${relation.assistSummary.availableCount}` : '暂无助力'}
            </button>
            <button className="ghost-button" disabled={busy} onClick={() => onOpenFieldVisit(relation.target.playerId)} type="button">
              拜访灵田
            </button>
            <button className="ghost-button" disabled={busy} onClick={() => onOpenSpiritProfile(relation.target.playerId)} type="button">
              查看灵宠
            </button>
            <button className="ghost-button danger" disabled={busy} onClick={() => onDeleteFriend(relation.target.playerId)} type="button">
              删除
            </button>
          </>
        ) : (
          <>
            <button
              className="ghost-button"
              disabled={busy || relation.friendStatus === 'pending'}
              onClick={() => onRequestFriend(relation.target.playerId)}
              type="button"
            >
              {getRelationActionLabel(relation)}
            </button>
            {relation.followingStatus === 'active' ? (
              <button className="ghost-button" disabled={busy} onClick={() => onUnfollowTarget(relation.target.playerId)} type="button">
                取消关注
              </button>
            ) : (
              <button className="ghost-button" disabled={busy} onClick={() => onFollowTarget(relation.target.playerId)} type="button">
                关注
              </button>
            )}
            <button className="ghost-button" disabled={busy} onClick={() => onOpenSpiritProfile(relation.target.playerId)} type="button">
              查看灵宠
            </button>
          </>
        )}
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
    return '待确认';
  }
  return '加好友';
}

function getRelationTags(relation: RelationRow): string[] {
  return relation.tags;
}

function isFeedActionDisabled(action: ClientSocialFeedItem['actions'][number], busy: boolean): boolean {
  if (busy) {
    return true;
  }
  if (action.action === 'accept_friend' || action.action === 'reject_friend') {
    return !action.relatedEntityId;
  }
  if (action.action === 'revenge' || action.action === 'follow') {
    return !action.targetPlayerId;
  }
  return false;
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

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

