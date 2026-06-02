import { CenteredModalShell } from '../ui/common/ModalShell';

interface SettingsModalProps {
  currentAccountName: string;
  devLoginModeLabel: string;
  open: boolean;
  onClose: () => void;
  onSwitchDevUser: () => void;
}

export function SettingsModal(props: SettingsModalProps): JSX.Element | null {
  const {
    currentAccountName,
    devLoginModeLabel,
    open,
    onClose,
    onSwitchDevUser,
  } = props;

  if (!open) {
    return null;
  }

  return (
    <CenteredModalShell
      className="settings-panel"
      description="当前阶段退出登录只清理本地 token 并返回测试账号选择页，不调用后端注销接口。"
      eyebrow="设置"
      footer={(
        <>
          <button className="ghost-button" onClick={onClose} type="button">
            关闭
          </button>
          <button className="secondary-button" onClick={onSwitchDevUser} type="button">
            退出测试登录
          </button>
        </>
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
    </CenteredModalShell>
  );
}
