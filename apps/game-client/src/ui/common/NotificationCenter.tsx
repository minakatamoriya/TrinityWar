import type { ClientNotificationItem, ClientNotificationListResponse, NotificationAttachment } from '@trinitywar/shared';
import { FullScreenToolShell } from './ModalShell';

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getCategoryLabel(category: ClientNotificationItem['category']): string {
  if (category === 'announcement') {
    return '公告';
  }

  if (category === 'maintenance') {
    return '维护';
  }

  if (category === 'reward') {
    return '奖励';
  }

  if (category === 'compensation') {
    return '补偿';
  }

  return '系统';
}

export function NotificationCenter(props: {
  actionId: string | null;
  busy: boolean;
  data: ClientNotificationListResponse | null;
  error: string | null;
  open: boolean;
  onClose: () => void;
  onClaim: (notificationId: string) => void;
  onDelete: (notificationId: string) => void;
  onMarkRead: (notificationId: string) => void;
  onPageChange: (page: number) => void;
  resolveAttachmentLabel?: (attachment: NotificationAttachment) => string | null;
}): JSX.Element | null {
  if (!props.open) {
    return null;
  }

  const page = props.data?.pagination.page ?? 1;
  const pageSize = props.data?.pagination.pageSize ?? 10;
  const total = props.data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));

  return (
    <FullScreenToolShell
      ariaLabel="系统通知"
      bodyClassName="notification-dialog-body"
      bottomBarClassName="notification-bottom-bar"
      bottomBarContent={(
        <div className="notification-pagination">
          <span>{`第 ${page} / ${totalPages} 页`}</span>
          <div className="notification-pagination-actions">
            <button className="ghost-button" disabled={props.busy || page <= 1} onClick={() => props.onPageChange(page - 1)} type="button">上一页</button>
            <button className="ghost-button" disabled={props.busy || page >= totalPages} onClick={() => props.onPageChange(page + 1)} type="button">下一页</button>
          </div>
        </div>
      )}
      className="notification-screen"
      eyebrow="消息中心"
      onBack={props.onClose}
      title="系统通知"
    >
      {props.error ? <p className="notification-error">{props.error}</p> : null}

      <div className="notification-list">
        {props.busy ? <p className="notification-empty">正在读取消息...</p> : null}
        {!props.busy && !props.error && (props.data?.items.length ?? 0) <= 0 ? <p className="notification-empty">当前没有系统通知。</p> : null}
        {!props.busy ? props.data?.items.map((item) => (
          <article className={`notification-card${item.read ? '' : ' unread'}`} key={item.id}>
            <div className="notification-card-head">
              <div className="notification-meta-row">
                <span className="notification-category-tag">{getCategoryLabel(item.category)}</span>
                <span className={`notification-status-tag ${item.read ? 'read' : 'unread'}`}>{item.read ? '已读' : '未读'}</span>
              </div>
              <span className="notification-time">{formatDateTime(item.createdAt)}</span>
            </div>
            <h4>{item.title}</h4>
            <p>{item.body}</p>
            {item.attachments.length > 0 ? (
              <div className="notification-attachment-list">
                {item.attachments.map((attachment, index) => (
                  <span className="notification-attachment-pill" key={`${item.id}:${attachment.kind}:${index}`}>
                    {props.resolveAttachmentLabel?.(attachment) ?? attachment.name ?? attachment.label} x{attachment.quantity}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="notification-card-actions">
              {!item.read ? (
                <button
                  className="secondary-button"
                  disabled={props.actionId === `read:${item.id}`}
                  onClick={() => props.onMarkRead(item.id)}
                  type="button"
                >
                  {props.actionId === `read:${item.id}` ? '处理中...' : '标记已读'}
                </button>
              ) : null}
              {item.claimStatus === 'unclaimed' ? (
                <button
                  className="secondary-button"
                  disabled={props.actionId === `claim:${item.id}`}
                  onClick={() => props.onClaim(item.id)}
                  type="button"
                >
                  {props.actionId === `claim:${item.id}` ? '领取中...' : '领取附件'}
                </button>
              ) : null}
              <button
                className="ghost-button"
                disabled={!item.canDelete || props.actionId === `delete:${item.id}`}
                onClick={() => props.onDelete(item.id)}
                type="button"
              >
                {props.actionId === `delete:${item.id}` ? '删除中...' : '删除'}
              </button>
            </div>
          </article>
        )) : null}
      </div>
    </FullScreenToolShell>
  );
}
