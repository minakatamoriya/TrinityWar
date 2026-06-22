import type { ClientSeasonMedalCabinet, ClientSpiritState } from '@trinitywar/shared';
import { GlobalFeatureModal } from '../ui/common/GlobalFeatureModal';
import {
  GlobalFeatureModalContent,
  type SeasonSignInDayView,
  type SeasonSignInMilestoneView,
  type SeasonSignInRecordView,
} from '../ui/common/GlobalFeatureModalContent';
import { formatNumber } from '../utils/format';
import type { GlobalFeatureModalState } from './appStateTypes';

interface GlobalFeatureModalHostProps {
  modal: GlobalFeatureModalState | null;
  pendingActionKey: string | null;
  seasonSignInClaimedToday: boolean;
  seasonSignInDays: SeasonSignInDayView[];
  seasonSignInMilestones: SeasonSignInMilestoneView[];
  seasonSignInRecord: SeasonSignInRecordView;
  seasonSignInTodayReward: number;
  seasonMedalCabinet: ClientSeasonMedalCabinet | null;
  spiritState: ClientSpiritState | null;
  tianjiTalismanCount: number;
  onBuySpiritShopItem: (itemId: string) => void;
  onClaimSeasonSignIn: () => void;
  onClaimSeasonSignInMilestone: (dayCount: number) => void;
  onClaimSpiritAdReward: () => void;
  onClose: () => void;
  onOpenSeasonSignIn: () => void;
}

const seasonResetRules = {
  title: '新赛季会重置竞争进度，但不会删除你的长期身份与收藏。',
  retained: [
    '天机符保留',
    '灵宠词条保留',
    '旧赛季快照、奖励与荣誉保留',
  ],
  reset: [
    '金币清零',
    '灵田全部清空',
    '阵营贡献与排行重置',
    '灵宠等级与培养进度重置',
    '赛季签到重置',
    '每日俸禄状态重置',
    '今日战斗次数重置',
  ],
};

export function GlobalFeatureModalHost(props: GlobalFeatureModalHostProps): JSX.Element | null {
  const {
    modal,
    pendingActionKey,
    seasonSignInClaimedToday,
    seasonSignInDays,
    seasonSignInMilestones,
    seasonSignInRecord,
    seasonSignInTodayReward,
    seasonMedalCabinet,
    spiritState,
    tianjiTalismanCount,
    onBuySpiritShopItem,
    onClaimSeasonSignIn,
    onClaimSeasonSignInMilestone,
    onClaimSpiritAdReward,
    onClose,
    onOpenSeasonSignIn,
  } = props;

  if (!modal) {
    return null;
  }

  return (
    <GlobalFeatureModal
      description={modal.tianjiShop ? undefined : modal.description}
      eyebrow={modal.tianjiShop ? undefined : modal.eyebrow}
      onClose={onClose}
      title={modal.tianjiShop ? `天机符库存 x${formatNumber(tianjiTalismanCount)}` : modal.title}
    >
      <GlobalFeatureModalContent
        contributionTiers={modal.contributionTiers}
        seasonResetRules={modal.seasonResetRules ? {
          ...seasonResetRules,
          onOpenSignIn: onOpenSeasonSignIn,
        } : undefined}
        seasonSignIn={modal.seasonSignIn ? {
          record: seasonSignInRecord,
          todayReward: seasonSignInTodayReward,
          milestones: seasonSignInMilestones,
          days: seasonSignInDays,
          claimedToday: seasonSignInClaimedToday,
          onClaim: onClaimSeasonSignIn,
          onClaimMilestone: onClaimSeasonSignInMilestone,
          pendingActionKey,
        } : undefined}
        seasonMedalCabinet={modal.seasonMedalCabinet ? seasonMedalCabinet : undefined}
        tianjiShop={modal.tianjiShop && spiritState?.shop ? {
          spirit: { ...spiritState, shop: spiritState.shop },
          pendingActionKey,
          onClaimAdReward: onClaimSpiritAdReward,
          onBuyItem: onBuySpiritShopItem,
        } : undefined}
      />
    </GlobalFeatureModal>
  );
}
