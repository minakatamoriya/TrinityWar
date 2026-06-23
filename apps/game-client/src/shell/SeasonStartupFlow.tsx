import type { ClientSeasonStartupState } from '@trinitywar/shared';
import type { DevFactionChoice } from '../api';
import { factionChoiceCards } from '../config/sceneConfig';

interface SeasonStartupFlowProps {
  currentFactionName: string;
  pendingActionKey: string | null;
  selectedFactionCode: DevFactionChoice;
  startup: ClientSeasonStartupState;
  onChangeSelectedFaction: (factionCode: DevFactionChoice) => void;
  onConfirmIntro: () => void;
  onConfirmKeepCurrentFaction: () => void;
  onConfirmSeasonFactionChange: () => void;
  onOpenFactionSelect: () => void;
  onBackToFactionConfirm: () => void;
  stepOverride: 'faction-select' | null;
}

export function SeasonStartupFlow(props: SeasonStartupFlowProps): JSX.Element | null {
  const {
    currentFactionName,
    pendingActionKey,
    selectedFactionCode,
    startup,
    onChangeSelectedFaction,
    onConfirmIntro,
    onConfirmKeepCurrentFaction,
    onConfirmSeasonFactionChange,
    onOpenFactionSelect,
    onBackToFactionConfirm,
    stepOverride,
  } = props;

  if (!startup.blocking || startup.completed) {
    return null;
  }

  const effectiveStep = stepOverride ?? startup.currentStep ?? 'season-intro';
  const seasonTitle = `第 ${startup.seasonNumber} 赛季`;

  if (effectiveStep === 'faction-select') {
    const selectedFactionName = factionChoiceCards.find((item) => item.code === selectedFactionCode)?.name ?? '所选阵营';

    return (
      <section className="season-startup-screen" aria-labelledby="season-startup-title">
        <div className="season-startup-layout">
          <header className="season-startup-hero">
            <p className="eyebrow">新赛季启动</p>
            <h2 id="season-startup-title">{seasonTitle} 阵营选择</h2>
            <p>本次选择会作为新赛季的阵营确认结果。好友、关注、旧赛季快照、奖励和荣誉不会因为调整阵营而删除。</p>
          </header>

          <main className="season-startup-main season-startup-main-scroll">
            <div className="auth-faction-page-grid season-startup-faction-grid">
              {factionChoiceCards.map((faction) => (
                <article
                  key={faction.code}
                  className={`auth-faction-card auth-faction-page-card ${selectedFactionCode === faction.code ? 'is-selected' : ''}`}
                  onClick={() => {
                    if (pendingActionKey !== null) {
                      return;
                    }
                    onChangeSelectedFaction(faction.code);
                  }}
                  onKeyDown={(event) => {
                    if (pendingActionKey !== null || (event.key !== 'Enter' && event.key !== ' ')) {
                      return;
                    }
                    event.preventDefault();
                    onChangeSelectedFaction(faction.code);
                  }}
                  role="button"
                  tabIndex={pendingActionKey !== null ? -1 : 0}
                >
                  <div className="auth-faction-card-head">
                    <span>{faction.name}</span>
                    <strong>{faction.title}</strong>
                  </div>
                  <p>{faction.leaderSummary}</p>
                  <ul>
                    {faction.traits.map((trait) => (
                      <li key={trait}>{trait}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </main>

          <footer className="season-startup-footer">
            <button
              className="ghost-button"
              disabled={pendingActionKey !== null}
              onClick={onBackToFactionConfirm}
              type="button"
            >
              返回阵营确认
            </button>
            <button
              className="secondary-button"
              disabled={pendingActionKey === 'season-startup:change-faction'}
              onClick={onConfirmSeasonFactionChange}
              type="button"
            >
              {pendingActionKey === 'season-startup:change-faction' ? '确认中...' : `确认加入${selectedFactionName}并进入灵田`}
            </button>
          </footer>
        </div>
      </section>
    );
  }

  if (effectiveStep === 'faction-confirm') {
    return (
      <section className="season-startup-screen" aria-labelledby="season-startup-title">
        <div className="season-startup-layout">
          <header className="season-startup-hero">
            <p className="eyebrow">新赛季启动</p>
            <h2 id="season-startup-title">{seasonTitle} 阵营确认</h2>
            <p>新赛季开始时需要确认一次阵营。保持当前阵营也会消耗本赛季的确认机会，确认后进入灵田。</p>
          </header>

          <main className="season-startup-main">
            <div className="season-startup-current-panel">
              <span>当前阵营</span>
              <strong>{currentFactionName}</strong>
            </div>
            <div className="season-startup-note">
              确认后本赛季不能再次更改阵营；如果要调整，请在进入灵田前完成选择。
            </div>
          </main>

          <footer className="season-startup-footer season-startup-action-stack">
            <button
              className="secondary-button"
              disabled={pendingActionKey === 'season-startup:keep-faction'}
              onClick={onConfirmKeepCurrentFaction}
              type="button"
            >
              {pendingActionKey === 'season-startup:keep-faction' ? '确认中...' : '保持当前阵营并进入灵田'}
            </button>
            <button
              className="ghost-button"
              disabled={pendingActionKey !== null}
              onClick={onOpenFactionSelect}
              type="button"
            >
              调整阵营
            </button>
          </footer>
        </div>
      </section>
    );
  }

  return (
    <section className="season-startup-screen" aria-labelledby="season-startup-title">
      <div className="season-startup-layout">
        <header className="season-startup-hero">
          <p className="eyebrow">新赛季启动</p>
          <h2 id="season-startup-title">{seasonTitle} 开启</h2>
          <p>旧赛季已经结算。确认规则摘要后，需要完成阵营确认，才会进入灵田。</p>
        </header>

        <main className="season-startup-main">
          <div className="season-startup-summary-grid">
            <div className="season-startup-summary-item">
              <span>保留</span>
              <strong>天机符、灵宠词条、赛季快照、奖励与荣誉</strong>
            </div>
            <div className="season-startup-summary-item">
              <span>重置</span>
              <strong>金币、灵田、贡献、排行、签到、俸禄、今日战斗次数</strong>
            </div>
            <div className="season-startup-summary-item">
              <span>提醒</span>
              <strong>赛季结束前请及时收获灵田，未收取内容会随新赛季清空</strong>
            </div>
          </div>
        </main>

        <footer className="season-startup-footer">
          <button
            className="secondary-button"
            disabled={pendingActionKey === 'season-startup:intro'}
            onClick={onConfirmIntro}
            type="button"
          >
            {pendingActionKey === 'season-startup:intro' ? '进入中...' : '继续确认阵营'}
          </button>
        </footer>
      </div>
    </section>
  );
}
