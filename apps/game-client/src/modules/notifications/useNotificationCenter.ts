import { useState } from 'react';
import type { ClientNotificationListResponse } from '@trinitywar/shared';
import {
  claimNotification,
  deleteNotification,
  loadNotifications,
  loadUnreadNotificationCount,
  markNotificationAsRead,
} from '../../api';
import {
  deleteNotificationFromList,
  markNotificationClaimedInList,
  markNotificationReadInList,
} from './notificationPresentation';

interface UseNotificationCenterOptions {
  onError: (message: string) => void;
}

export function useNotificationCenter(options: UseNotificationCenterOptions) {
  const { onError } = options;
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<ClientNotificationListResponse | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const reset = (): void => {
    setOpen(false);
    setList(null);
    setUnreadCount(0);
    setBusy(false);
    setError(null);
    setActionId(null);
  };

  const refreshUnreadCount = async (): Promise<void> => {
    try {
      const result = await loadUnreadNotificationCount();
      setUnreadCount(result.unreadCount);
    } catch {
      setUnreadCount(0);
    }
  };

  const loadPage = async (page = 1): Promise<void> => {
    setBusy(true);
    setError(null);

    try {
      const result = await loadNotifications(page, 10);
      setList(result);
      setUnreadCount(result.unreadCount);
    } catch {
      setError('当前无法读取消息中心，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  const openCenter = (): void => {
    setOpen(true);
    void loadPage(1);
  };

  const markRead = async (notificationId: string): Promise<void> => {
    setActionId(`read:${notificationId}`);
    try {
      const result = await markNotificationAsRead(notificationId);
      setUnreadCount(result.unreadCount);
      setList((current) => markNotificationReadInList(current, notificationId, result));
    } catch (markError) {
      onError(markError instanceof Error && markError.message ? markError.message : '当前无法标记消息已读，请稍后重试。');
    } finally {
      setActionId(null);
    }
  };

  const claim = async (notificationId: string) => {
    setActionId(`claim:${notificationId}`);
    try {
      const result = await claimNotification(notificationId);
      setUnreadCount(result.unreadCount);
      setList((current) => markNotificationClaimedInList(current, notificationId, result));
      return result;
    } finally {
      setActionId(null);
    }
  };

  const deleteItem = async (notificationId: string): Promise<void> => {
    setActionId(`delete:${notificationId}`);
    try {
      const result = await deleteNotification(notificationId);
      setUnreadCount(result.unreadCount);
      setList((current) => deleteNotificationFromList(current, notificationId, result));
    } catch (deleteError) {
      onError(deleteError instanceof Error && deleteError.message ? deleteError.message : '当前无法删除消息，请稍后重试。');
    } finally {
      setActionId(null);
    }
  };

  return {
    actionId,
    busy,
    claim,
    close: () => setOpen(false),
    deleteItem,
    error,
    list,
    loadPage,
    markRead,
    open,
    openCenter,
    refreshUnreadCount,
    reset,
    setUnreadCount,
    unreadCount,
  };
}
