import { CenteredModalShell } from '../ui/common/ModalShell';

interface SettingsModalProps {
  currentAccountName: string;
  currentSeasonEndsAt: string | null;
  devLoginModeLabel: string;
  open: boolean;
  pendingActionKey: string | null;
  seasonTimingOverrideActive: boolean;
  onClose: () => void;
  onResetSeasonTiming: () => void;
  onSetSeasonNearRollover: () => void;
  onSwitchDevUser: () => void;
}

export function SettingsModal(props: SettingsModalProps): JSX.Element | null {
  const {
    currentAccountName,
    currentSeasonEndsAt,
    devLoginModeLabel,
    open,
    pendingActionKey,
    seasonTimingOverrideActive,
    onClose,
    onResetSeasonTiming,
    onSetSeasonNearRollover,
    onSwitchDevUser,
  } = props;

  if (!open) {
    return null;
  }

  return (
    <CenteredModalShell
      className="settings-panel"
      description="当前只清理本地测试登录状态，不调用后端注销接口。赛季调试按钮仅用于开发验证跨赛季流程。"
      eyebrow="设置"
      footer={(
        <div className="settings-action-stack">
          <button
            className="secondary-button"
            disabled={pendingActionKey === 'system:season-near-rollover'}
            onClick={onSetSeasonNearRollover}
            type="button"
          >
            {pendingActionKey === 'system:season-near-rollover' ? '设置中...' : '设置为 60 秒后跨赛季'}
          </button>
          <button
            className="ghost-button"
            disabled={pendingActionKey === 'system:season-reset-timing'}
            onClick={onResetSeasonTiming}
            type="button"
          >
            {pendingActionKey === 'system:season-reset-timing' ? '恢复中...' : '恢复正常赛季时间'}
          </button>
          <button className="ghost-button" onClick={onSwitchDevUser} type="button">
            切换测试账号
          </button>
          <button className="ghost-button" onClick={onClose} type="button">
            关闭
          </button>
        </div>
      )}
      title="测试登录"
    >
      <div className="settings-row">
        <span>当前账号</span>
        <strong>{currentAccountName}</strong>
      </div>
      <div className="settings-row">
        <span>测试身份</span>
        <strong>{devLoginModeLabel}</strong>
      </div>
      <div className="settings-row">
        <span>登录方式</span>
        <strong>开发测试登录</strong>
      </div>
      <div className="settings-row">
        <span>赛季结束</span>
        <strong>{currentSeasonEndsAt ?? '未知'}</strong>
      </div>
      <div className="settings-row">
        <span>调试时钟</span>
        <strong>{seasonTimingOverrideActive ? '已开启' : '未开启'}</strong>
      </div>
    </CenteredModalShell>
  );
}
