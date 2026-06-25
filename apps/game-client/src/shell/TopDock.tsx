interface TopDockProps {
  avatarInitial: string;
  isTutorialUser: boolean;
  notificationUnreadCount: number;
  onOpenNotifications: () => void;
  onOpenBackpack: () => void;
  onOpenProfile: () => void;
  onOpenSeasonSignIn: () => void;
  onOpenTianjiShop: () => void;
}

const operationRailButtons = {
  signIn: {
    label: '签到',
    iconSrc: '/assets/icon/sidebar_task_64.png',
  },
  shop: {
    label: '商店',
    iconSrc: '/assets/icon/sidebar_shop_new_64.png',
  },
  backpack: {
    label: '背包',
    iconSrc: '/assets/icon/sidebar_bag_new_64.png',
  },
  notifications: {
    label: '消息',
    iconSrc: '/assets/icon/sidebar_mail_new_64.png',
  },
} as const;

export function TopDock(props: TopDockProps): JSX.Element {
  const {
    avatarInitial,
    isTutorialUser,
    notificationUnreadCount,
    onOpenNotifications,
    onOpenBackpack,
    onOpenProfile,
    onOpenSeasonSignIn,
    onOpenTianjiShop,
  } = props;

  return (
    <>
      <section className="top-dock">
        <header className="top-bar">
          <button className="profile-avatar-button" aria-label="个人资料" onClick={onOpenProfile} type="button">
            <img alt="" aria-hidden="true" className="profile-avatar-image" src="/assets/icon/avatar_female_64.png" />
            <span className="sr-only">{avatarInitial}</span>
          </button>
        </header>
      </section>

      <aside className="operation-rail" aria-label="运营入口">
        {!isTutorialUser ? (
          <>
            <button className="operation-rail-button" onClick={onOpenSeasonSignIn} type="button">
              <img alt="" aria-hidden="true" className="operation-rail-icon" src={operationRailButtons.signIn.iconSrc} />
              <span className="operation-rail-label">{operationRailButtons.signIn.label}</span>
            </button>
            <button className="operation-rail-button" onClick={onOpenTianjiShop} type="button">
              <img alt="" aria-hidden="true" className="operation-rail-icon" src={operationRailButtons.shop.iconSrc} />
              <span className="operation-rail-label">{operationRailButtons.shop.label}</span>
            </button>
            <button className="operation-rail-button" onClick={onOpenBackpack} type="button">
              <img alt="" aria-hidden="true" className="operation-rail-icon" src={operationRailButtons.backpack.iconSrc} />
              <span className="operation-rail-label">{operationRailButtons.backpack.label}</span>
            </button>
            <button className="operation-rail-button top-notification-button" onClick={onOpenNotifications} type="button">
              <img alt="" aria-hidden="true" className="operation-rail-icon" src={operationRailButtons.notifications.iconSrc} />
              <span className="operation-rail-label">{operationRailButtons.notifications.label}</span>
              {notificationUnreadCount > 0 ? (
                <span className="top-notification-badge">{notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}</span>
              ) : null}
            </button>
          </>
        ) : null}
      </aside>
    </>
  );
}
