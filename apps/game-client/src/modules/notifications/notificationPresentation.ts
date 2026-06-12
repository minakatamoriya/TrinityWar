import type {
  ClientClaimNotificationResponse,
  ClientDeleteNotificationResponse,
  ClientMarkNotificationReadResponse,
  ClientNotificationItem,
  ClientNotificationListResponse,
} from '@trinitywar/shared';
import type { SeedRewardModalState } from '../../shell/appStateTypes';
import type { SeedRewardModalItem } from '../../ui/common/SeedRewardModal';

export function mapNotificationAttachmentToRewardItem(attachment: ClientNotificationItem['attachments'][number]): SeedRewardModalItem {
  const label = attachment.name ?? attachment.label;
  return {
    itemId: attachment.kind,
    label,
    quantity: attachment.quantity,
  };
}

export function buildNotificationClaimRewardModal(notification: ClientNotificationItem): SeedRewardModalState {
  return {
    title: notification.title || '领取附件',
    summary: '确认后将以下附件收入背包。',
    confirmAction: 'claim-notification',
    notificationId: notification.id,
    items: notification.attachments.map(mapNotificationAttachmentToRewardItem),
  };
}

export function markNotificationReadInList(
  current: ClientNotificationListResponse | null,
  notificationId: string,
  result: ClientMarkNotificationReadResponse,
): ClientNotificationListResponse | null {
  return current ? {
    ...current,
    unreadCount: result.unreadCount,
    items: current.items.map((item) => item.id === notificationId ? { ...item, read: true, readAt: result.readAt, canDelete: true } : item),
  } : current;
}

export function markNotificationClaimedInList(
  current: ClientNotificationListResponse | null,
  notificationId: string,
  result: ClientClaimNotificationResponse,
): ClientNotificationListResponse | null {
  return current ? {
    ...current,
    unreadCount: result.unreadCount,
    items: current.items.map((item) => item.id === notificationId ? {
      ...item,
      claimStatus: result.claimStatus,
      claimedAt: result.claimedAt,
      read: true,
      readAt: result.readAt,
      canDelete: true,
    } : item),
  } : current;
}

export function deleteNotificationFromList(
  current: ClientNotificationListResponse | null,
  notificationId: string,
  result: ClientDeleteNotificationResponse,
): ClientNotificationListResponse | null {
  if (!current) {
    return current;
  }

  return {
    ...current,
    unreadCount: result.unreadCount,
    pagination: {
      ...current.pagination,
      total: Math.max(current.pagination.total - 1, 0),
    },
    items: current.items.filter((item) => item.id !== notificationId),
  };
}
