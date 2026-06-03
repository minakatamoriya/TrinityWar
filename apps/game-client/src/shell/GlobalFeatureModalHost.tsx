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
  onClaimSpiritAdReward: () => void;
  onClose: () => void;
  onOpenSeasonSignIn: () => void;
}

const seasonResetRules = {
  title: '赛季结束时，重置战力与经营进度，保留长期图鉴与认知资产。',
  retained: [
    '已解锁的植物图鉴仍然可见',
    '已解锁的灵宠图鉴仍然可见',
    '灵宠碎片不清零',
    '已见过的植物与灵宠信息继续保留',
  ],
  reset: [
    '田地种植进度按赛季重开',
    '灵宠等级清零，需要重新培养',
    '金币清零',
    '法术等级清零',
    '阵营贡献清零',
    '灵宠当前血量与战斗养成进度按赛季重开',
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
