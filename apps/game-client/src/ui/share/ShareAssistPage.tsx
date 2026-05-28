type ShareAssistKind = 'water' | 'raid';
type ShareAssistAudience = 'new-user' | 'returning-user';
type ShareAssistStatus = 'pending' | 'completed';

interface ShareAssistPageProps {
  audience: ShareAssistAudience;
  kind: ShareAssistKind;
  status: ShareAssistStatus;
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
  raid: {
    eyebrow: '微信助力掠夺',
    requester: '玄刃道友',
    pendingTitle: '玄刃道友邀请你助阵夺取灵田机缘',
    actionLabel: '帮 TA 助阵',
    completedTitle: '助阵成功',
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
    completedSummary: '你的朋友已在仙界安营扎寨。一起开辟灵田、培养灵宠吗？马上就能拥有自己的第一块田。',
    completedHint: '选择阵营时，可以优先考虑和好友同阵营。',
    successActionLabel: '开始新手流程',
  },
  'returning-user': {
    testLabel: '老用户测试',
    completedSummary: '已为好友送出本次助力。登录后可领取助力奖励，并查看好友收到的助力记录。',
    completedHint: '本入口模拟已注册用户从微信链接回流。',
    successActionLabel: '登录并领取奖励',
  },
};

export function ShareAssistPage({ audience, kind, status, onConfirm, onBack, onSuccessExit }: ShareAssistPageProps): JSX.Element {
  const copy = shareAssistCopy[kind];
  const audienceText = audienceCopy[audience];
  const completed = status === 'completed';

  return (
    <main className="share-assist-shell">
      <div className={`share-assist-page share-assist-page-${kind} ${completed ? 'is-completed' : ''}`}>
        <button className="share-assist-back" onClick={onBack} type="button">
          返回入口
        </button>

        <section className="share-assist-focus">
          <div className="share-assist-avatar" aria-hidden="true">{copy.requester.slice(0, 1)}</div>
          <p className="eyebrow">{copy.eyebrow} · {audienceText.testLabel}</p>
          <h1>{completed ? copy.completedTitle : copy.pendingTitle}</h1>
          {completed ? (
            <>
              <p>{audienceText.completedSummary}</p>
              <small>{audienceText.completedHint}</small>
            </>
          ) : null}
        </section>

        <section className="share-assist-action-bar">
          {completed ? (
            <button className="primary-button share-assist-primary" onClick={onSuccessExit ?? onBack} type="button">
              {audienceText.successActionLabel}
            </button>
          ) : (
            <button className="primary-button share-assist-primary" onClick={onConfirm} type="button">
              {copy.actionLabel}
            </button>
          )}
          {!completed ? <p>助力者登录后可领取相应奖励</p> : null}
        </section>
      </div>
    </main>
  );
}

export type { ShareAssistAudience, ShareAssistKind, ShareAssistStatus };
