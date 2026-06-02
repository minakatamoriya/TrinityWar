import { useEffect, useState } from 'react';
import type { RewardBubbleItem } from '../ui/common/RewardBubbleStack';
import type { ToastState } from './appStateTypes';

export function useFeedbackLayer() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [rewardBubbles, setRewardBubbles] = useState<RewardBubbleItem[]>([]);

  const showToast = (message: string, tone: ToastState['tone'] = 'info'): void => {
    setToast({
      id: Date.now(),
      message,
      tone,
    });
  };

  const showRewardBubbles = (items: Array<Omit<RewardBubbleItem, 'id'>>): void => {
    const visibleItems = items.filter((item) => item.quantity > 0);
    if (visibleItems.length === 0) {
      return;
    }

    const now = Date.now();
    const nextBubbles = visibleItems.map((item, index) => ({
      ...item,
      id: now + index,
    }));
    setRewardBubbles((current) => [...current, ...nextBubbles].slice(-5));
  };

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast((current) => current?.id === toast.id ? null : current);
    }, 2400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  useEffect(() => {
    if (rewardBubbles.length === 0) {
      return;
    }

    const oldestBubbleId = rewardBubbles[0]?.id;
    const timer = window.setTimeout(() => {
      setRewardBubbles((current) => current.filter((bubble) => bubble.id !== oldestBubbleId));
    }, 2200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [rewardBubbles]);

  return {
    rewardBubbles,
    showRewardBubbles,
    showToast,
    toast,
  };
}
