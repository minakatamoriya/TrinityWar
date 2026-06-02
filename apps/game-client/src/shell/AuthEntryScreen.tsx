import type { DevFactionChoice, DevLoginMode } from '../api';
import type { ShareAssistAudience } from '../ui/share/ShareAssistPage';
import { factionChoiceCards } from '../config/sceneConfig';
import type { PendingFriendInviteState } from './appStateTypes';
import type { ToastState } from './appStateTypes';

interface AuthEntryScreenProps {
  authScreen: 'faction-select' | 'account-select';
  friendInviteNewUserUrlInput: string;
  friendInviteReturningUserUrlInput: string;
  loginError: string | null;
  loginLoadingMode: DevLoginMode | null;
  pendingActionKey: string | null;
  pendingFriendInvite: PendingFriendInviteState | null;
  pendingNewUserFaction: DevFactionChoice;
  toast: ToastState | null;
  onChangeAuthScreen: (screen: 'faction-select' | 'account-select') => void;
  onChangeFriendInviteNewUserUrlInput: (value: string) => void;
  onChangeFriendInviteReturningUserUrlInput: (value: string) => void;
  onChangePendingNewUserFaction: (faction: DevFactionChoice) => void;
  onDevLogin: (mode: DevLoginMode, options?: { factionCode?: DevFactionChoice }) => void;
  onOpenBattleDemo: () => void;
  onOpenShareAssistDemo: (audience: ShareAssistAudience) => void;
  onSubmitFriendInviteUrl: (url: string, audience: ShareAssistAudience) => void;
}

export function AuthEntryScreen(props: AuthEntryScreenProps): JSX.Element {
  const {
    authScreen,
    friendInviteNewUserUrlInput,
    friendInviteReturningUserUrlInput,
    loginError,
    loginLoadingMode,
    pendingActionKey,
    pendingFriendInvite,
    pendingNewUserFaction,
    toast,
    onChangeAuthScreen,
    onChangeFriendInviteNewUserUrlInput,
    onChangeFriendInviteReturningUserUrlInput,
    onChangePendingNewUserFaction,
    onDevLogin,
    onOpenBattleDemo,
    onOpenShareAssistDemo,
    onSubmitFriendInviteUrl,
  } = props;

  return (
    <main className="loading-shell auth-shell">
      <section className="loading-panel auth-panel">
        <p className="eyebrow">TRINITY WAR</p>
        {authScreen === 'faction-select' ? (
          <FactionSelectPanel
            loginLoadingMode={loginLoadingMode}
            pendingFriendInvite={pendingFriendInvite}
            pendingNewUserFaction={pendingNewUserFaction}
            onBack={() => onChangeAuthScreen('account-select')}
            onChangePendingNewUserFaction={onChangePendingNewUserFaction}
            onDevLogin={onDevLogin}
          />
        ) : (
          <AccountSelectPanel
            friendInviteNewUserUrlInput={friendInviteNewUserUrlInput}
            friendInviteReturningUserUrlInput={friendInviteReturningUserUrlInput}
            loginLoadingMode={loginLoadingMode}
            pendingActionKey={pendingActionKey}
            onChangeAuthScreen={onChangeAuthScreen}
            onChangeFriendInviteNewUserUrlInput={onChangeFriendInviteNewUserUrlInput}
            onChangeFriendInviteReturningUserUrlInput={onChangeFriendInviteReturningUserUrlInput}
            onDevLogin={onDevLogin}
            onOpenBattleDemo={onOpenBattleDemo}
            onOpenShareAssistDemo={onOpenShareAssistDemo}
            onSubmitFriendInviteUrl={onSubmitFriendInviteUrl}
          />
        )}
        {loginError ? <p className="auth-error">{loginError}</p> : null}
        {toast ? (
          <div className={`top-toast top-toast-${toast.tone}`}>
            <span>{toast.message}</span>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function FactionSelectPanel(props: {
  loginLoadingMode: DevLoginMode | null;
  pendingFriendInvite: PendingFriendInviteState | null;
  pendingNewUserFaction: DevFactionChoice;
  onBack: () => void;
  onChangePendingNewUserFaction: (faction: DevFactionChoice) => void;
  onDevLogin: (mode: DevLoginMode, options?: { factionCode?: DevFactionChoice }) => void;
}): JSX.Element {
  const {
    loginLoadingMode,
    pendingFriendInvite,
    pendingNewUserFaction,
    onBack,
    onChangePendingNewUserFaction,
    onDevLogin,
  } = props;

  return (
    <>
      <h1>选择阵营</h1>
      {pendingFriendInvite ? (
        <div className="auth-invite-faction-notice">
          <span>邀请你的玩家</span>
          <strong>{pendingFriendInvite.inviterName} · {pendingFriendInvite.inviterFactionName}</strong>
          <p>这是一条单人好友邀请。选择任意阵营都可以成为好友；选择同阵营只是更方便后续阵营协作。</p>
        </div>
      ) : (
        <p className="panel-text">这是用户第一次进入时看到的页面。先确定阵营，再创建新档案进入首页。</p>
      )}
      <div className="auth-faction-page-grid">
        {factionChoiceCards.map((faction) => {
          const matchesInviteFaction = pendingFriendInvite?.inviterFactionCode === faction.code;
          const differsFromInviteFaction = Boolean(pendingFriendInvite && !matchesInviteFaction);

          return (
            <article
              key={faction.code}
              className={`auth-faction-card auth-faction-page-card ${pendingNewUserFaction === faction.code ? 'is-selected' : ''} ${matchesInviteFaction ? 'is-invite-recommended' : ''} ${differsFromInviteFaction ? 'is-invite-mismatch' : ''}`}
              onClick={() => {
                if (loginLoadingMode !== null) {
                  return;
                }
                onChangePendingNewUserFaction(faction.code);
              }}
              onKeyDown={(event) => {
                if (loginLoadingMode !== null || (event.key !== 'Enter' && event.key !== ' ')) {
                  return;
                }
                event.preventDefault();
                onChangePendingNewUserFaction(faction.code);
              }}
              role="button"
              tabIndex={loginLoadingMode !== null ? -1 : 0}
            >
              <div className="auth-faction-card-head">
                <span>{faction.name}</span>
                <strong>{faction.title}</strong>
              </div>
              {pendingFriendInvite ? (
                <div className={`auth-faction-invite-hint ${matchesInviteFaction ? 'match' : 'mismatch'}`}>
                  {matchesInviteFaction ? '推荐：与邀请人同阵营，后续协作更顺手' : '可选：不同阵营也会成为好友'}
                </div>
              ) : null}
              <p>{faction.leaderSummary}</p>
              <ul>
                {faction.traits.map((trait) => (
                  <li key={trait}>{trait}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      <div className="auth-faction-page-actions">
        <button className="secondary-button" disabled={loginLoadingMode !== null} onClick={onBack} type="button">
          返回
        </button>
        <button
          className="primary-button"
          disabled={loginLoadingMode !== null}
          onClick={() => onDevLogin('new-user', { factionCode: pendingNewUserFaction })}
          type="button"
        >
          {loginLoadingMode === 'new-user' ? '创建中...' : `以${factionChoiceCards.find((item) => item.code === pendingNewUserFaction)?.name ?? '该阵营'}创建新档案`}
        </button>
      </div>
    </>
  );
}

function AccountSelectPanel(props: {
  friendInviteNewUserUrlInput: string;
  friendInviteReturningUserUrlInput: string;
  loginLoadingMode: DevLoginMode | null;
  pendingActionKey: string | null;
  onChangeAuthScreen: (screen: 'faction-select' | 'account-select') => void;
  onChangeFriendInviteNewUserUrlInput: (value: string) => void;
  onChangeFriendInviteReturningUserUrlInput: (value: string) => void;
  onDevLogin: (mode: DevLoginMode, options?: { factionCode?: DevFactionChoice }) => void;
  onOpenBattleDemo: () => void;
  onOpenShareAssistDemo: (audience: ShareAssistAudience) => void;
  onSubmitFriendInviteUrl: (url: string, audience: ShareAssistAudience) => void;
}): JSX.Element {
  const {
    friendInviteNewUserUrlInput,
    friendInviteReturningUserUrlInput,
    loginLoadingMode,
    pendingActionKey,
    onChangeAuthScreen,
    onChangeFriendInviteNewUserUrlInput,
    onChangeFriendInviteReturningUserUrlInput,
    onDevLogin,
    onOpenBattleDemo,
    onOpenShareAssistDemo,
    onSubmitFriendInviteUrl,
  } = props;

  return (
    <>
      <div className="auth-browser-layout">
        <section className="auth-account-column">
          <h1>选择账号入口</h1>
          <p className="panel-text">已有档案和验证账号从这里进入。新用户建档入口在阵营选择页。</p>
          <div className="auth-choice-grid">
            <button className="auth-choice-button primary-choice" disabled={loginLoadingMode !== null} onClick={() => onChangeAuthScreen('faction-select')} type="button">
              <span>新用户</span>
              <strong>前往阵营选择</strong>
            </button>
            <button className="auth-choice-button" disabled={loginLoadingMode !== null} onClick={() => onDevLogin('existing-user')} type="button">
              <span>我是已注册用户</span>
              <strong>{loginLoadingMode === 'existing-user' ? '登录中...' : '进入已有档案'}</strong>
            </button>
            <button className="auth-choice-button" disabled={loginLoadingMode !== null} onClick={() => onDevLogin('test-user-1')} type="button">
              <span>验证账号</span>
              <strong>{loginLoadingMode === 'test-user-1' ? '登录中...' : '测试用户1'}</strong>
            </button>
            <button className="auth-choice-button" disabled={loginLoadingMode !== null} onClick={() => onDevLogin('test-user-2')} type="button">
              <span>验证账号</span>
              <strong>{loginLoadingMode === 'test-user-2' ? '登录中...' : '测试用户2'}</strong>
            </button>
          </div>
        </section>
        <section className="auth-share-assist-section">
          <div>
            <h2>战斗回放测试入口</h2>
            <p>直接播放 10 回合灵宠互撞 demo，不需要先登录账号。</p>
          </div>
          <div className="auth-share-assist-grid">
            <button className="primary-button" onClick={onOpenBattleDemo} type="button">
              打开战斗测试
            </button>
          </div>
        </section>
        <section className="auth-share-assist-section">
          <div>
            <h2>微信助力测试入口</h2>
            <p>模拟玩家从微信分享链接进入。被助力人固定为“已注册用户”，助力者分新用户和老用户两种路径。</p>
          </div>
          <div className="auth-share-assist-grid">
            <button className="primary-button" disabled={pendingActionKey === 'share-assist:create'} onClick={() => onOpenShareAssistDemo('new-user')} type="button">
              新用户助力浇水流程
            </button>
            <button className="primary-button" disabled={pendingActionKey === 'share-assist:create'} onClick={() => onOpenShareAssistDemo('returning-user')} type="button">
              老用户助力浇水流程
            </button>
          </div>
        </section>
        <section className="auth-share-assist-section auth-friend-invite-section">
          <div>
            <h2>微信好友邀请测试入口</h2>
            <p>URL 只标识“哪位玩家发起邀请”。测试时由下面两个入口决定新玩家或老玩家；老玩家固定使用测试用户1。</p>
          </div>
          <div className="auth-friend-invite-paste-grid">
            <label>
              <span>新玩家邀请 URL</span>
              <input
                onChange={(event) => onChangeFriendInviteNewUserUrlInput(event.target.value)}
                placeholder="粘贴好友邀请 URL"
                value={friendInviteNewUserUrlInput}
              />
              <button className="secondary-button" disabled={loginLoadingMode !== null} onClick={() => onSubmitFriendInviteUrl(friendInviteNewUserUrlInput, 'new-user')} type="button">
                新玩家接受邀请并建档
              </button>
            </label>
            <label>
              <span>老玩家邀请 URL</span>
              <input
                onChange={(event) => onChangeFriendInviteReturningUserUrlInput(event.target.value)}
                placeholder="粘贴好友邀请 URL"
                value={friendInviteReturningUserUrlInput}
              />
              <button className="secondary-button" disabled={loginLoadingMode !== null} onClick={() => onSubmitFriendInviteUrl(friendInviteReturningUserUrlInput, 'returning-user')} type="button">
                老友回归并肩同行
              </button>
            </label>
          </div>
        </section>
      </div>
    </>
  );
}
