import { useEffect, useState } from 'react';
import type {
  ClientRaidTarget,
  ClientRaidTargetDetailResponse,
} from '@trinitywar/shared';
import type { RaidTargetModalState } from '../../shell/appStateTypes';

type ToastTone = 'info' | 'success' | 'error';

interface UseRaidIntelStateOptions {
  followTarget: (targetPlayerId: string) => Promise<{ summary: string }>;
  loadDetail: (targetId: string) => Promise<ClientRaidTargetDetailResponse>;
  onDetailLoaded: (detail: ClientRaidTargetDetailResponse) => void;
  onFollowChanged?: () => void;
  onToast: (message: string, tone?: ToastTone) => void;
  unfollowTarget: (targetPlayerId: string) => Promise<{ summary: string }>;
}

export function useRaidIntelState(options: UseRaidIntelStateOptions) {
  const { followTarget, loadDetail, onDetailLoaded, onFollowChanged, onToast, unfollowTarget } = options;
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [modal, setModal] = useState<RaidTargetModalState | null>(null);
  const [detail, setDetail] = useState<ClientRaidTargetDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followedTargetIds, setFollowedTargetIds] = useState<string[]>([]);
  const [detailsById, setDetailsById] = useState<Record<string, ClientRaidTargetDetailResponse>>({});

  const cacheDetail = (nextDetail: ClientRaidTargetDetailResponse): void => {
    setDetailsById((current) => ({
      ...current,
      [nextDetail.targetId]: nextDetail,
    }));
    onDetailLoaded(nextDetail);
  };

  const patchCachedPreview = (
    targetId: string,
    mainPetPreview: ClientRaidTarget['mainPetPreview'],
  ): void => {
    setDetailsById((current) => {
      const existing = current[targetId];

      if (!existing) {
        return current;
      }

      return {
        ...current,
        [targetId]: {
          ...existing,
          mainPetPreview,
        },
      };
    });

    setDetail((current) => current?.targetId === targetId
      ? {
        ...current,
        mainPetPreview,
      }
      : current);
  };

  const refreshDetail = async (targetId: string): Promise<void> => {
    try {
      const nextDetail = await loadDetail(targetId);
      cacheDetail(nextDetail);
    } catch {
      // 只刷新当前目标，失败时保留旧缓存，避免影响整个列表。
    }
  };

  const openTarget = (target: ClientRaidTarget, mode: RaidTargetModalState['mode'] = 'raid'): void => {
    setSelectedTargetId(target.id);
    setModal({
      targetId: target.id,
      targetName: target.name,
      mode,
    });
  };

  const closeModal = (): void => {
    const targetId = modal?.targetId;

    if (targetId) {
      setDetailsById((current) => {
        if (!(targetId in current)) {
          return current;
        }

        const next = { ...current };
        delete next[targetId];
        return next;
      });

      void refreshDetail(targetId);
    }

    setModal(null);
  };

  const dismissModal = (): void => {
    setModal(null);
  };

  const toggleFollowTarget = (target: ClientRaidTarget): void => {
    const targetPlayerId = target.targetPlayerId;
    const isFollowing = followedTargetIds.includes(targetPlayerId);
    setFollowedTargetIds((current) => isFollowing
      ? current.filter((followedPlayerId) => followedPlayerId !== targetPlayerId)
      : current.includes(targetPlayerId) ? current : [...current, targetPlayerId]);

    const action = isFollowing ? unfollowTarget(targetPlayerId) : followTarget(targetPlayerId);
    void action.then((result) => {
      onToast(result.summary, 'success');
      onFollowChanged?.();
    }).catch((mutationError) => {
      setFollowedTargetIds((current) => isFollowing
        ? current.includes(targetPlayerId) ? current : [...current, targetPlayerId]
        : current.filter((followedPlayerId) => followedPlayerId !== targetPlayerId));
      onToast(mutationError instanceof Error && mutationError.message ? mutationError.message : '当前无法更新关注，请稍后重试。', 'error');
    });
  };

  const clearDetails = (): void => {
    setDetailsById({});
    setDetail(null);
    setError(null);
    setLoading(false);
  };

  const reset = (): void => {
    setSelectedTargetId('');
    setModal(null);
    setDetail(null);
    setError(null);
    setLoading(false);
    setFollowedTargetIds([]);
    setDetailsById({});
  };

  useEffect(() => {
    if (!modal) {
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }

    const cachedDetail = detailsById[modal.targetId];
    if (cachedDetail) {
      setDetail(cachedDetail);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    void loadDetail(modal.targetId).then((nextDetail) => {
      if (!active) {
        return;
      }

      cacheDetail(nextDetail);
      setDetail(nextDetail);
    }).catch(() => {
      if (!active) {
        return;
      }

      setError('当前无法读取对手详情，请稍后重试。');
    }).finally(() => {
      if (!active) {
        return;
      }

      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [detailsById, loadDetail, modal]);

  return {
    clearDetails,
    closeModal,
    detail,
    dismissModal,
    error,
    followedTargetIds,
    loading,
    modal,
    openTarget,
    patchCachedPreview,
    reset,
    selectedTargetId,
    setSelectedTargetId,
    setFollowedTargetIds,
    toggleFollowTarget,
  };
}
