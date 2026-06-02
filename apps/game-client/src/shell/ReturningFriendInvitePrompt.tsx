import { CenteredModalShell } from '../ui/common/ModalShell';
import type { ReturningFriendInvitePromptState } from './appStateTypes';

interface ReturningFriendInvitePromptProps {
  prompt: ReturningFriendInvitePromptState | null;
  confirming: boolean;
  onConfirm: () => void;
  onReject: () => void;
}

export function ReturningFriendInvitePrompt(props: ReturningFriendInvitePromptProps): JSX.Element | null {
  const {
    prompt,
    confirming,
    onConfirm,
    onReject,
  } = props;

  if (!prompt) {
    return null;
  }

  return (
    <CenteredModalShell
      className="friend-invite-confirm-card"
      description={`${prompt.inviterName}（${prompt.inviterFactionName}）邀请你成为好友。确认后双方都会出现在好友列表，并各自收到可领取的邀请奖励。`}
      eyebrow="好友邀请"
      footer={(
        <>
          <button
            className="secondary-button"
            disabled={confirming}
            onClick={onReject}
            type="button"
          >
            拒绝
          </button>
          <button
            className="primary-button"
            disabled={confirming}
            onClick={onConfirm}
            type="button"
          >
            {confirming ? '确认中...' : '确认成为好友'}
          </button>
        </>
      )}
      title="确认成为好友"
    />
  );
}
