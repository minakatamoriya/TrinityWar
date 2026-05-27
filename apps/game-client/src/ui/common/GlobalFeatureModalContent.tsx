import type { ClientSpiritState } from '@trinitywar/shared';

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
}

interface SeasonSignInPanelProps {
  record: SeasonSignInRecordView;
  todayReward: number;
  milestones: SeasonSignInMilestoneView[];
  days: SeasonSignInDayView[];
  claimedToday: boolean;
  onClaim: () => void;
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
  tianjiShop?: TianjiShopPanelProps;
}

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
          <strong>以下内容会清零</strong>
        </div>
        <ul>
          {props.reset.map((item) => (
            <li key={`reset-${item}`}>{item}</li>
          ))}
        </ul>
        {props.onOpenSignIn ? (
          <div className="button-row end">
            <button className="secondary-button small" onClick={props.onOpenSignIn} type="button">
              查看签到
            </button>
          </div>
        ) : null}
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

function SeasonSignInPanel(props: SeasonSignInPanelProps): JSX.Element {
  const {
    record,
    todayReward,
    milestones,
    days,
    claimedToday,
    onClaim,
  } = props;

  return (
    <div className="season-signin-panel">
      <div className="season-signin-summary">
        <span>累计 {record.claimedDays.length}/28 天</span>
        <strong>今日 x{todayReward}</strong>
      </div>
      <div className="season-signin-milestones" aria-label="累计签到宝箱">
        {milestones.map((milestone) => (
          <div className={`season-signin-milestone ${milestone.reached ? 'reached' : ''}`} key={milestone.dayCount}>
            <span className="season-signin-milestone-icon" aria-hidden="true">箱</span>
            <div>
              <strong>{milestone.title}</strong>
              <span>累计 {milestone.dayCount} 天</span>
            </div>
            <em>{milestone.reached ? '已达成' : `还差 ${milestone.remainingDays} 天`}</em>
          </div>
        ))}
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
            <strong>{day.missed ? '未签' : `符 x${day.reward}`}</strong>
          </div>
        ))}
      </div>
      <button className="secondary-button" disabled={claimedToday} onClick={onClaim} type="button">
        {claimedToday ? '今日已签到' : '签到领取'}
      </button>
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
        看广告 +{spirit.shop.adReward.tianjiTalisman} 天机符
      </button>
      <p className="panel-text">今日广告 {spirit.shop.adReward.usedToday}/{spirit.shop.adReward.dailyLimit}，完成后会先弹出统一领奖框，确认后才入账天机符。</p>
      <div className="task-list tianji-shop-list">
        {spirit.shop.items.map((item) => (
          <div className="task-row tianji-shop-row" key={item.itemId}>
            <span className="task-index">{item.priceTianjiTalisman}</span>
            <div>
              <div className="task-row-head">
                <strong>{item.label}</strong>
                <span className="task-state-badge">{item.limitLabel}{item.remainingPurchases === null ? '' : ` · 剩 ${item.remainingPurchases}`}</span>
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

export function GlobalFeatureModalContent(props: GlobalFeatureModalContentProps): JSX.Element {
  return (
    <>
      {props.contributionTiers ? <ContributionTierList tiers={props.contributionTiers} /> : null}
      {props.seasonResetRules ? <SeasonResetRulesPanel {...props.seasonResetRules} /> : null}
      {props.seasonSignIn ? <SeasonSignInPanel {...props.seasonSignIn} /> : null}
      {props.tianjiShop ? <TianjiShopPanel {...props.tianjiShop} /> : null}
    </>
  );
}
