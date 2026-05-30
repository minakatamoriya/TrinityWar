import type { PublicShareAssistCampaignResponse } from '@trinitywar/shared';

type ShareAssistKind = 'water' | 'friend_invite';
type ShareAssistAudience = 'new-user' | 'returning-user';
type ShareAssistStatus = 'pending' | 'completed' | 'expired' | 'full';

interface ShareAssistPageProps {
  audience: ShareAssistAudience;
  kind: ShareAssistKind;
  status: ShareAssistStatus;
  campaign?: PublicShareAssistCampaignResponse | null;
  error?: string | null;
  onConfirm: () => void;
  onBack: () => void;
  onSuccessExit?: () => void;
}

interface ShareAssistKindCopy {
  eyebrow: string;
  requester: string;
  pendingTitle: string;
  actionLabel: string;
  completedTitle: string;
}

const shareAssistCopy: Record<ShareAssistKind, ShareAssistKindCopy> = {
  water: {
    eyebrow: '微信助力浇水',
    requester: '青禾道友',
    pendingTitle: '青禾道友邀请你帮他浇水培育灵草',
    actionLabel: '帮 TA 浇水',
    completedTitle: '浇水成功',
  },
  friend_invite: {
    eyebrow: '微信好友邀请',
    requester: '测试好友',
    pendingTitle: '好友发来一条单人邀请',
    actionLabel: '接受好友邀请',
    completedTitle: '邀请已确认',
  },
};

const audienceCopy: Record<ShareAssistAudience, {
  testLabel: string;
  completedSummary: string;
  completedHint: string;
  successActionLabel: string;
}> = {
  'new-user': {
    testLabel: '新用户测试',
    completedSummary: '你的朋友已在三界安营扎寨。一起开辟灵田、培养灵宠吗？马上就能拥有自己的第一块田。',
    completedHint: '这条单人邀请链接已被你接受，其他人将不能再使用。',
    successActionLabel: '开始新手流程',
  },
  'returning-user': {
    testLabel: '老用户测试',
    completedSummary: '你已接受好友邀请。确认后双方会出现在好友列表，并收到对应奖励。',
    completedHint: '这条单人邀请链接被接受后即失效。',
    successActionLabel: '登录并领取奖励',
  },
};

export function ShareAssistPage({ audience, kind, status, campaign, error, onConfirm, onBack, onSuccessExit }: ShareAssistPageProps): JSX.Element {
  const copy = shareAssistCopy[kind];
  const audienceText = audienceCopy[audience];
  const completed = status === 'completed';
  const blocked = status === 'expired' || status === 'full';
  const requester = campaign?.campaign.owner.nickname ?? copy.requester;
  const title = campaign?.copy.title ?? copy.pendingTitle;
  const description = campaign?.copy.description ?? null;
  const actionLabel = campaign?.copy.actionLabel ?? copy.actionLabel;

  return (
    <main className="share-assist-shell">
      <div className={`share-assist-page share-assist-page-${kind} ${completed ? 'is-completed' : ''}`}>
        <button className="share-assist-back" onClick={onBack} type="button">
          返回入口
        </button>

        <section className="share-assist-focus">
          <div className="share-assist-avatar" aria-hidden="true">{requester.slice(0, 1)}</div>
          <p className="eyebrow">{copy.eyebrow} · {audienceText.testLabel}</p>
          <h1>{completed ? copy.completedTitle : blocked ? (status === 'expired' ? '助力已过期' : kind === 'friend_invite' ? '邀请已被接受' : '助力次数已满') : title}</h1>
          {completed ? (
            <>
              <p>{audienceText.completedSummary}</p>
              <small>{audienceText.completedHint}</small>
            </>
          ) : description ? <p>{description}</p> : null}
          {error ? <small>{error}</small> : null}
        </section>

        <section className="share-assist-action-bar">
          {completed ? (
            <button className="primary-button share-assist-primary" onClick={onSuccessExit ?? onBack} type="button">
              {audienceText.successActionLabel}
            </button>
          ) : blocked ? (
            <button className="primary-button share-assist-primary" onClick={onBack} type="button">
              返回入口
            </button>
          ) : (
            <button className="primary-button share-assist-primary" onClick={onConfirm} type="button">
              {actionLabel}
            </button>
          )}
          {!completed ? <p>{kind === 'friend_invite' ? '单人邀请链接仅第一个确认者生效' : '助力者登录后可领取相应奖励'}</p> : null}
        </section>
      </div>
    </main>
  );
}

export type { ShareAssistAudience, ShareAssistKind, ShareAssistStatus };
