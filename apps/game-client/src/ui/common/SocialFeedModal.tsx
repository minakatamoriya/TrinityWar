import type { ClientSocialFeedItem } from '@trinitywar/shared';
import { FullScreenToolShell } from './ModalShell';

interface SocialFeedModalProps {
  busy: boolean;
  error: string | null;
  feed: ClientSocialFeedItem[];
  onAcceptFriendRequest: (relationId: string) => void;
  onClose: () => void;
  onRejectFriendRequest: (relationId: string) => void;
}

export function SocialFeedModal(props: SocialFeedModalProps): JSX.Element {
  const {
    busy,
    error,
    feed,
    onAcceptFriendRequest,
    onClose,
    onRejectFriendRequest,
  } = props;

  return (
    <FullScreenToolShell
      ariaLabel="社交动态"
      bodyClassName="social-feed-modal-body"
      className="social-feed-modal-screen"
      description="查看好友申请、关注变化和最近社交提醒"
      onBack={onClose}
      title="动态"
    >
      {error ? <p className="social-error">{error}</p> : null}

      {feed.length > 0 ? (
        <section className="social-list">
          {feed.map((item) => (
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
          ))}
        </section>
      ) : (
        <div className="panel-card social-empty-state">
          <p>还没有新的社交动态。</p>
        </div>
      )}
    </FullScreenToolShell>
  );
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
