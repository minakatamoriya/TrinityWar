import type { ClientSeasonMedalCabinet, ClientSeasonRewardItem, ClientSpiritState } from '@trinitywar/shared';
import { SeasonMedalCabinetView } from './SeasonMedalCabinetView';

export interface FactionContributionTierView {
  threshold: string;
  label: string;
  rewards: string[];
}

export interface SeasonSignInRecordView {
  claimedDays: number[];
}

export interface SeasonSignInDayView {
  day: number;
  reward: number;
  claimed: boolean;
  current: boolean;
  future: boolean;
  missed: boolean;
}

export interface SeasonSignInMilestoneView {
  dayCount: number;
  title: string;
  reached: boolean;
  remainingDays: number;
  claimed: boolean;
  claimable: boolean;
  debugUnlocked: boolean;
  rewards: ClientSeasonRewardItem[];
}

interface SeasonSignInPanelProps {
  record: SeasonSignInRecordView;
  todayReward: number;
  milestones: SeasonSignInMilestoneView[];
  days: SeasonSignInDayView[];
  claimedToday: boolean;
  onClaim: () => void;
  onClaimMilestone: (dayCount: number) => void;
  pendingActionKey: string | null;
}

interface TianjiShopPanelProps {
  spirit: ClientSpiritState & { shop: NonNullable<ClientSpiritState['shop']> };
  pendingActionKey: string | null;
  onClaimAdReward: () => void;
  onBuyItem: (itemId: string) => void;
}

interface GlobalFeatureModalContentProps {
  contributionTiers?: FactionContributionTierView[];
  seasonResetRules?: {
    title: string;
    reset: string[];
    retained: string[];
    onOpenSignIn?: () => void;
  };
  seasonSignIn?: SeasonSignInPanelProps;
  seasonMedalCabinet?: ClientSeasonMedalCabinet | null;
  tianjiShop?: TianjiShopPanelProps;
}

const seasonSignInChestByDayCount: Record<number, { closed: string; open: string }> = {
  1: {
    closed: '/assets/icon/icon_chest_wood_gold_64.png',
    open: '/assets/icon/icon_chest_wood_gold_open_64.png',
  },
  2: {
    closed: '/assets/icon/icon_chest_blue_silver_64.png',
    open: '/assets/icon/icon_chest_blue_silver_open_64.png',
  },
  3: {
    closed: '/assets/icon/icon_chest_purple_64.png',
    open: '/assets/icon/icon_chest_purple_open_64.png',
  },
  5: {
    closed: '/assets/icon/icon_chest_red_legend_64.png',
    open: '/assets/icon/icon_chest_red_legend_open_64.png',
  },
  7: {
    closed: '/assets/icon/icon_chest_teal_gold_64.png',
    open: '/assets/icon/icon_chest_teal_gold_open_64.png',
  },
  14: {
    closed: '/assets/icon/icon_chest_dark_red_64.png',
    open: '/assets/icon/icon_chest_dark_red_open_64.png',
  },
  21: {
    closed: '/assets/icon/icon_chest_winged_gold_64.png',
    open: '/assets/icon/icon_chest_winged_gold_open_64.png',
  },
};

function SeasonResetRulesPanel(props: { title: string; reset: string[]; retained: string[]; onOpenSignIn?: () => void }): JSX.Element {
  return (
    <div className="contribution-tier-list">
      <article className="contribution-tier-card">
        <div>
          <span>赛季规则</span>
          <strong>{props.title}</strong>
        </div>
        <ul>
          {props.retained.map((item) => (
            <li key={`retain-${item}`}>保留：{item}</li>
          ))}
        </ul>
      </article>
      <article className="contribution-tier-card">
        <div>
          <span>赛季重置</span>
          <strong>以下内容会在新赛季开始后重置</strong>
        </div>
        <ul>
          {props.reset.map((item) => (
            <li key={`reset-${item}`}>{item}</li>
          ))}
        </ul>
      </article>
    </div>
  );
}

function ContributionTierList(props: { tiers: FactionContributionTierView[] }): JSX.Element {
  return (
    <div className="contribution-tier-list">
      {props.tiers.map((tier) => (
        <article className="contribution-tier-card" key={tier.threshold}>
          <div>
            <span>{tier.threshold}</span>
            <strong>{tier.label}</strong>
          </div>
          <ul>
            {tier.rewards.map((reward) => (
              <li key={reward}>{reward}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

function buildSeasonMilestoneStatusLabel(milestone: SeasonSignInMilestoneView): string {
  if (milestone.claimed) {
    return '已领取';
  }

  if (milestone.reached) {
    return '可领取';
  }

  if (milestone.debugUnlocked) {
    return `测试可领，还差 ${milestone.remainingDays} 天`;
  }

  return `还差 ${milestone.remainingDays} 天`;
}

function SeasonSignInPanel(props: SeasonSignInPanelProps): JSX.Element {
  const {
    record,
    todayReward,
    milestones,
    days,
    claimedToday,
    onClaim,
    onClaimMilestone,
    pendingActionKey,
  } = props;

  return (
    <div className="season-signin-panel">
      <div className="season-signin-summary">
        <span>累计 {record.claimedDays.length}/28 天</span>
        <strong>今日 x{todayReward}</strong>
      </div>
      <p className="season-signin-rule">1-6 天 x1，7-13 天 x2，14-20 天 x3，21 天后 x4。</p>
      <div className="season-signin-grid" aria-label="赛季签到日历">
        {days.map((day) => (
          <div
            className={[
              'season-signin-day',
              day.claimed ? 'claimed' : '',
              day.current ? 'current' : '',
              day.future ? 'future' : '',
              day.missed ? 'missed' : '',
            ].filter(Boolean).join(' ')}
            key={day.day}
          >
            <span>{day.day}</span>
            <strong>{day.missed ? '未签到' : `天机符 x${day.reward}`}</strong>
          </div>
        ))}
      </div>
      <button className="secondary-button" disabled={claimedToday} onClick={onClaim} type="button">
        {claimedToday ? '今日已签到' : '签到领取'}
      </button>
      <div className="season-signin-milestones" aria-label="累计签到宝箱">
        {milestones.map((milestone) => {
          const chestArt = seasonSignInChestByDayCount[milestone.dayCount];
          const chestSrc = milestone.claimed ? chestArt?.open : chestArt?.closed;

          return (
            <div className={`season-signin-milestone ${milestone.reached ? 'reached' : ''}`} key={milestone.dayCount}>
              {chestSrc ? (
                <img
                  alt=""
                  aria-hidden="true"
                  className="season-signin-milestone-art"
                  src={chestSrc}
                />
              ) : (
                <span className="season-signin-milestone-icon" aria-hidden="true">箱</span>
              )}
              <span className="season-signin-milestone-caption">{milestone.title}</span>
              <strong>{milestone.dayCount} 天</strong>
              <em>{buildSeasonMilestoneStatusLabel(milestone)}</em>
              <button
                className="secondary-button small season-signin-milestone-button"
                disabled={!milestone.claimable || pendingActionKey === `season:sign-in-milestone:${milestone.dayCount}`}
                onClick={() => onClaimMilestone(milestone.dayCount)}
                type="button"
              >
                {milestone.claimed
                  ? '已领'
                  : pendingActionKey === `season:sign-in-milestone:${milestone.dayCount}`
                    ? '领取中...'
                    : '宝箱'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TianjiShopPanel(props: TianjiShopPanelProps): JSX.Element {
  const {
    spirit,
    pendingActionKey,
    onClaimAdReward,
    onBuyItem,
  } = props;

  return (
    <div className="tianji-shop-panel">
      <button
        className="secondary-button"
        disabled={pendingActionKey === 'spirit:ad-reward' || spirit.shop.adReward.usedToday >= spirit.shop.adReward.dailyLimit}
        onClick={onClaimAdReward}
        type="button"
      >
        {pendingActionKey === 'spirit:ad-reward'
          ? '领取中...'
          : `看广告 +${spirit.shop.adReward.tianjiTalisman} 天机符`}
      </button>
      <p className="panel-text">
        今日广告 {spirit.shop.adReward.usedToday}/{spirit.shop.adReward.dailyLimit}，观看完成后立即入账天机符。
      </p>
      <div className="task-list tianji-shop-list">
        {spirit.shop.items.map((item) => (
          <div className="task-row tianji-shop-row" key={item.itemId}>
            <span className="task-index">{item.priceTianjiTalisman}</span>
            <div>
              <div className="task-row-head">
                <strong>{item.label}</strong>
                <span className="task-state-badge">
                  {item.limitLabel}
                  {item.remainingPurchases === null ? '' : ` · 剩 ${item.remainingPurchases}`}
                </span>
              </div>
              <p>{item.description}</p>
            </div>
            <button
              className="secondary-button small"
              disabled={pendingActionKey === `spirit:shop:${item.itemId}` || spirit.tianjiTalisman < item.priceTianjiTalisman || item.remainingPurchases === 0}
              onClick={() => onBuyItem(item.itemId)}
              type="button"
            >
              兑换
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeasonMedalCabinetPanel(props: { cabinet: ClientSeasonMedalCabinet | null }): JSX.Element {
  return <SeasonMedalCabinetView cabinet={props.cabinet} loadingText="正在读取赛季奖章陈列柜。" />;
}

export function GlobalFeatureModalContent(props: GlobalFeatureModalContentProps): JSX.Element {
  return (
    <>
      {props.contributionTiers ? <ContributionTierList tiers={props.contributionTiers} /> : null}
      {props.seasonSignIn ? <SeasonSignInPanel {...props.seasonSignIn} /> : null}
      {props.seasonResetRules ? <SeasonResetRulesPanel {...props.seasonResetRules} /> : null}
      {props.seasonMedalCabinet !== undefined ? <SeasonMedalCabinetPanel cabinet={props.seasonMedalCabinet} /> : null}
      {props.tianjiShop ? <TianjiShopPanel {...props.tianjiShop} /> : null}
    </>
  );
}
