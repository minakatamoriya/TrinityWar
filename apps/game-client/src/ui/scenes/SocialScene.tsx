import type {
  ClientSocialFeedItem,
  ClientSocialRelationItem,
  ClientSocialSummaryResponse,
} from '@trinitywar/shared';

type SocialTabKey = 'feed' | 'friends' | 'relations';
type SocialRelationFilter = 'all' | 'friends' | 'following' | 'enemies' | 'same-faction';

interface SocialSceneProps {
  activeTab: SocialTabKey;
  relationFilter: SocialRelationFilter;
  busy: boolean;
  error: string | null;
  summary: ClientSocialSummaryResponse | null;
  playerFactionName: string | null;
  friendInviteUrl: string | null;
  feed: ClientSocialFeedItem[];
  friends: ClientSocialRelationItem[];
  following: ClientSocialRelationItem[];
  enemies: ClientSocialRelationItem[];
  onChangeTab: (tab: SocialTabKey) => void;
  onChangeRelationFilter: (filter: SocialRelationFilter) => void;
  onRefresh: () => void;
  onAssistBack: (targetPlayerId: string) => void;
  onRequestFriend: (targetPlayerId: string) => void;
  onDeleteFriend: (targetPlayerId: string) => void;
  onInviteFriend: () => void;
  onCopyFriendInviteUrl: (url: string) => void;
  onAcceptFriendRequest: (relationId: string) => void;
  onRejectFriendRequest: (relationId: string) => void;
}

const tabLabels: Record<SocialTabKey, string> = {
  feed: '动态',
  friends: '好友',
  relations: '关系',
};

const relationFilters: Array<{ key: SocialRelationFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'friends', label: '好友' },
  { key: 'following', label: '关注' },
  { key: 'enemies', label: '仇敌' },
  { key: 'same-faction', label: '同阵营' },
];

export function SocialScene({
  activeTab,
  relationFilter,
  busy,
  error,
  summary,
  playerFactionName,
  friendInviteUrl,
  feed,
  friends,
  following,
  enemies,
  onChangeTab,
  onChangeRelationFilter,
  onAssistBack,
  onRequestFriend,
  onDeleteFriend,
  onInviteFriend,
  onCopyFriendInviteUrl,
  onAcceptFriendRequest,
  onRejectFriendRequest,
}: SocialSceneProps): JSX.Element {
  const relationRows = buildRelationRows({ friends, following, enemies, playerFactionName });
  const activeRelations = activeTab === 'friends'
    ? relationRows.filter((relation) => relation.friendStatus === 'active')
    : filterRelationRows(relationRows, relationFilter);
  const activeRelationFilter = relationFilters.find((filter) => filter.key === relationFilter) ?? relationFilters[0];

  return (
    <div className="scene-scroll social-scene">
      {summary ? (
        <section className="social-metric-strip">
          <span>动态 {summary.counts.feedUnread}</span>
          <span>好友 {summary.counts.friends}</span>
          <span>关注 {summary.counts.following}</span>
          <span>仇敌 {summary.counts.enemies}</span>
          <span>浇水 {summary.counts.todayWaterUsed}/{summary.counts.todayWaterLimit}</span>
        </section>
      ) : null}

      {error ? <p className="social-error">{error}</p> : null}

      <section className="tab-row">
        {(Object.keys(tabLabels) as SocialTabKey[]).map((tab) => (
          <button
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            key={tab}
            onClick={() => onChangeTab(tab)}
            type="button"
          >
            {tabLabels[tab]}
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
              <div className="button-row">
                {item.actions.map((action) => (
                  <button
                    className="ghost-button"
                    disabled={isFeedActionDisabled(action, busy)}
                    key={`${item.id}-${action.action}`}
                    onClick={() => {
                      if (action.action === 'assist_back' && action.targetPlayerId) {
                        onAssistBack(action.targetPlayerId);
                      }
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
            </article>
          )) : <EmptySocialState text="还没有新的社交动态。" />}
        </section>
      ) : (
        <section className="social-list">
          {activeTab === 'friends' ? (
            <div className="social-friend-toolbar">
              <span>邀请新玩家成为好友，双方领新友奖励</span>
              <button className="primary-button social-invite-button" disabled={busy} onClick={onInviteFriend} type="button">
                邀请领好礼
              </button>
            </div>
          ) : null}
          {activeTab === 'friends' && friendInviteUrl ? (
            <div className="social-friend-invite-url">
              <span>好友邀请 URL</span>
              <code>{friendInviteUrl}</code>
              <button className="ghost-button" onClick={() => onCopyFriendInviteUrl(friendInviteUrl)} type="button">
                复制
              </button>
            </div>
          ) : null}
          {activeTab === 'relations' ? (
            <div className="social-filter-bar">
              <span>按最近互动排序</span>
              <label>
                <span className="sr-only">关系筛选</span>
                <select value={activeRelationFilter.key} onChange={(event) => onChangeRelationFilter(event.target.value as SocialRelationFilter)}>
                  {relationFilters.map((filter) => (
                    <option key={filter.key} value={filter.key}>{filter.label}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          {activeRelations.length > 0 ? activeRelations.map((relation) => (
            <article className="panel-card social-relation-card" key={relation.key}>
              <div>
                <h4>{relation.target.nickname}</h4>
                <p>{relation.target.factionName ?? '未加入阵营'} · {relation.target.castleLevel} 级 · 亲密度 {relation.intimacy}</p>
                <div className="social-relation-tags">
                  {relation.tags.map((tag) => <span className="soft-tag" key={`${relation.key}-${tag}`}>{tag}</span>)}
                </div>
              </div>
              <div className="social-relation-actions">
                <button
                  className="ghost-button"
                  disabled={busy || relation.friendStatus === 'pending' || !relation.sameFaction}
                  onClick={() => {
                    if (relation.friendStatus === 'active') {
                      onAssistBack(relation.target.playerId);
                      return;
                    }
                    onRequestFriend(relation.target.playerId);
                  }}
                  type="button"
                >
                  {getRelationActionLabel(relation)}
                </button>
                {relation.friendStatus === 'active' ? (
                  <button className="ghost-button danger" disabled={busy} onClick={() => onDeleteFriend(relation.target.playerId)} type="button">
                    删除
                  </button>
                ) : null}
              </div>
            </article>
          )) : (
            <EmptySocialState
              text={activeTab === 'friends' ? '暂无好友，先邀请一位新玩家成为好友。' : '暂无匹配关系。'}
            />
          )}
        </section>
      )}
    </div>
  );
}

interface RelationRow {
  key: string;
  relationIds: string[];
  tags: string[];
  intimacy: number;
  friendStatus: ClientSocialRelationItem['status'] | null;
  sameFaction: boolean;
  target: ClientSocialRelationItem['target'];
}

function buildRelationRows(input: {
  friends: ClientSocialRelationItem[];
  following: ClientSocialRelationItem[];
  enemies: ClientSocialRelationItem[];
  playerFactionName: string | null;
}): RelationRow[] {
  const rowMap = new Map<string, RelationRow>();

  const append = (relation: ClientSocialRelationItem, tag: string): void => {
    const existing = rowMap.get(relation.target.playerId);
    if (!existing) {
      rowMap.set(relation.target.playerId, {
        key: relation.target.playerId,
        relationIds: [relation.id],
        tags: [tag],
        intimacy: relation.intimacy,
        friendStatus: relation.relationType === 'friend' ? relation.status : null,
        sameFaction: Boolean(input.playerFactionName && relation.target.factionName === input.playerFactionName),
        target: relation.target,
      });
      return;
    }

    existing.relationIds.push(relation.id);
    if (!existing.tags.includes(tag)) {
      existing.tags.push(tag);
    }
    existing.intimacy = Math.max(existing.intimacy, relation.intimacy);
    if (relation.relationType === 'friend') {
      existing.friendStatus = relation.status;
    }
  };

  input.friends.forEach((relation) => append(relation, relation.status === 'pending' ? '待确认' : '好友'));
  input.following.forEach((relation) => append(relation, '关注'));
  input.enemies.forEach((relation) => append(relation, '仇敌'));

  return Array.from(rowMap.values()).sort((left, right) => right.intimacy - left.intimacy || left.target.nickname.localeCompare(right.target.nickname, 'zh-CN'));
}

function filterRelationRows(rows: RelationRow[], filter: SocialRelationFilter): RelationRow[] {
  if (filter === 'all') {
    return rows;
  }
  if (filter === 'friends') {
    return rows.filter((row) => row.friendStatus === 'active');
  }
  if (filter === 'following') {
    return rows.filter((row) => row.tags.includes('关注'));
  }
  if (filter === 'enemies') {
    return rows.filter((row) => row.tags.includes('仇敌'));
  }

  return rows.filter((row) => row.target.factionName !== null);
}

function getRelationActionLabel(relation: RelationRow): string {
  if (!relation.sameFaction) {
    return '仅战斗';
  }
  if (relation.friendStatus === 'active') {
    return '浇水';
  }
  if (relation.friendStatus === 'pending') {
    return '待确认';
  }
  return '加好友';
}

function isFeedActionDisabled(action: ClientSocialFeedItem['actions'][number], busy: boolean): boolean {
  if (busy) {
    return true;
  }
  if (action.action === 'accept_friend' || action.action === 'reject_friend') {
    return !action.relatedEntityId;
  }
  if (action.action === 'assist_back' || action.action === 'revenge' || action.action === 'follow') {
    return !action.targetPlayerId;
  }
  return action.action === 'ignore';
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

export type { SocialRelationFilter, SocialTabKey };
