import { TUTORIAL_STARTER_SEED_ID } from '../../tutorial/tutorialFlow';
import type { RewardBubbleItem } from '../../ui/common/RewardBubbleStack';

export function isDisplayableFarmReward(reward: { kind?: string; seedId?: string }): boolean {
  return !(reward.kind === 'essence' && reward.seedId === TUTORIAL_STARTER_SEED_ID);
}

export function getRewardBubbleTone(reward: { kind?: string }): RewardBubbleItem['tone'] {
  if (reward.kind === 'essence' || reward.kind === 'seed') {
    return 'essence';
  }
  if (reward.kind?.startsWith('spirit-') || reward.kind?.includes('soul')) {
    return 'spirit';
  }
  return 'item';
}
