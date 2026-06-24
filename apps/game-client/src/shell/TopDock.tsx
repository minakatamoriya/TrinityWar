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
            {avatarInitial}
          </button>
        </header>
      </section>

      <aside className="operation-rail" aria-label="运营入口">
        {!isTutorialUser ? (
          <>
            <button className="operation-rail-button" onClick={onOpenSeasonSignIn} type="button">
              签到
            </button>
            <button className="operation-rail-button" onClick={onOpenTianjiShop} type="button">
              商店
            </button>
            <button className="operation-rail-button" onClick={onOpenBackpack} type="button">
              背包
            </button>
            <button className="operation-rail-button top-notification-button" onClick={onOpenNotifications} type="button">
              通知
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
