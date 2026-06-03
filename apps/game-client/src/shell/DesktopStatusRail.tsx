import type { ClientSceneKey } from '@trinitywar/shared';
import type { ClientViewModel } from '../api';
import { formatReadSource, formatServerTime } from '../utils/format';
import type { RaidHubTabKey } from './appStateTypes';

interface DesktopStatusRailProps {
  currentAccountName: string;
  pendingActionKey: string | null;
  viewModel: ClientViewModel;
  onNavigate: (scene: ClientSceneKey, nextRaidHubTab?: RaidHubTabKey) => void;
  onResetDemoState: () => void;
  onShowToast: (message: string) => void;
  onSwitchDevUser: () => void;
}

export function DesktopStatusRail(props: DesktopStatusRailProps): JSX.Element {
  const {
    currentAccountName,
    pendingActionKey,
    viewModel,
    onNavigate,
    onResetDemoState,
    onShowToast,
    onSwitchDevUser,
  } = props;
  const { bootstrap, home, usingMock, sources } = viewModel;

  return (
    <aside className="left-rail">
      <div className="brand-block">
        <p className="eyebrow">TRINITY WAR</p>
        <h1>阵营经营策略战争</h1>
        <p className="subline">Web 验证版前端，优先用于玩法、页面结构和接口走查。</p>
      </div>

      <div className="summary-card war-card">
        <p className="card-label">当前阵营</p>
        <div className="faction-row">
          <span className="faction-badge">{home.factionName}</span>
          <span className="soft-tag">领地经营</span>
        </div>
        <p className="muted">{home.playerName} · {home.staminaStatus}</p>
      </div>

      <div className="summary-card">
        <p className="card-label">关键提醒</p>
        <div className="rail-note rail-note-stack">
          <div className="rail-note-row">
            <strong>金币来源</strong>
            <span>农作物</span>
          </div>
          <div className="rail-note-row">
            <span>田地状态</span>
            <em>默认开放</em>
          </div>
          <div className="rail-note-row">
            <span>阵营收益</span>
            <em>每日俸禄</em>
          </div>
        </div>
        <button
          className="rail-alert"
          onClick={() => {
            onNavigate('report', 'reports');
            onShowToast('最近 1 次被挑战已解锁免费复仇，已切到探索模块的战报页签。');
          }}
          type="button"
        >
          探索动态 2
        </button>
      </div>

      <div className="summary-card meta-card">
        <p className="card-label">运行状态</p>
        <div className="meta-row"><span>环境</span><strong>{bootstrap.env}</strong></div>
        <div className="meta-row"><span>版本</span><strong>{bootstrap.version}</strong></div>
        <div className="meta-row"><span>时间</span><strong>{formatServerTime(bootstrap.serverTime)}</strong></div>
        <div className="meta-row"><span>数据源</span><strong>{usingMock ? '本地演示数据' : '实时接口'}</strong></div>
        <div className="meta-row source-row"><span>bootstrap</span><strong>{formatReadSource(sources.bootstrap)}</strong></div>
        <div className="meta-row source-row"><span>home</span><strong>{formatReadSource(sources.home)}</strong></div>
        <div className="meta-row source-row"><span>scene</span><strong>{formatReadSource(sources.scenes)}</strong></div>
        <div className="meta-row"><span>测试账号</span><strong>{currentAccountName}</strong></div>
        <button className="ghost-button" onClick={onSwitchDevUser} type="button">
          切换测试账号
        </button>
        <button className="secondary-button" onClick={onResetDemoState} type="button">
          {pendingActionKey === 'system:reset-demo-state' ? '重置中...' : '重置实验数据'}
        </button>
      </div>
    </aside>
  );
}
