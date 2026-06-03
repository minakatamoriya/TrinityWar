interface TopDockProps {
  avatarInitial: string;
  isTutorialUser: boolean;
  notificationUnreadCount: number;
  seasonProgress: {
    label: string;
    detail: string;
  };
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onOpenSeasonResetRules: () => void;
  onOpenSeasonSignIn: () => void;
  onOpenSettings: () => void;
  onOpenTianjiShop: () => void;
}

export function TopDock(props: TopDockProps): JSX.Element {
  const {
    avatarInitial,
    isTutorialUser,
    notificationUnreadCount,
    seasonProgress,
    onOpenNotifications,
    onOpenProfile,
    onOpenSeasonResetRules,
    onOpenSeasonSignIn,
    onOpenSettings,
    onOpenTianjiShop,
  } = props;

  return (
    <section className="top-dock">
      <header className="top-bar">
        <button className="profile-avatar-button" aria-label="个人资料" onClick={onOpenProfile} type="button">
          {avatarInitial}
        </button>
        <div className="top-action-group">
          <button
            aria-label="赛季进度"
            className="season-progress-inline"
            onClick={onOpenSeasonResetRules}
            type="button"
          >
            <span className="season-progress-inline-label">{seasonProgress.label}</span>
            <span className="season-progress-inline-detail">{seasonProgress.detail}</span>
          </button>
          {!isTutorialUser ? (
            <>
              <button className="ghost-button top-action-button top-item-button" onClick={onOpenTianjiShop} type="button">
                商店
              </button>
              <button className="ghost-button top-action-button" onClick={onOpenSeasonSignIn} type="button">
                签到
              </button>
              <button className="ghost-button top-action-button top-notification-button" onClick={onOpenNotifications} type="button">
                消息
                {notificationUnreadCount > 0 ? (
                  <span className="top-notification-badge">{notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}</span>
                ) : null}
              </button>
            </>
          ) : null}
          <button className="ghost-button top-action-button" onClick={onOpenSettings} type="button">
            设置
          </button>
        </div>
      </header>
    </section>
  );
}
