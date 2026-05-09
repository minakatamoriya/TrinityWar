import { useEffect, useState } from 'react';
import type {
  ClientBuildingUpgradeId,
  ClientButtonTone,
  ClientClaimPendingRequest,
  ClientGuideSection,
  ClientRaidTarget,
  ClientReportEntry,
  ClientSceneAction,
  ClientSceneKey,
  ClientTransferGoldRequest,
  HomeSummaryResponse,
} from '@trinitywar/shared';
import { claimPendingEarnings, collectFieldEarnings, loadClientViewModel, resetDemoExperimentState, startFieldCultivation, transferClientGold, type ClientViewModel, upgradeClientBuilding } from './api';

type ReportTabKey = 'defense' | 'attack';
type FactionTabKey = 'overview' | 'donate' | 'rank';

interface ModalState {
  title: string;
  body: string;
}

interface TransferPanelState {
  from: ClientTransferGoldRequest['from'];
  title: string;
  amount: number;
  maxAmount: number;
}

interface RaidResultState {
  targetName: string;
  summary: string;
  loot: string;
}

const sceneNavLabels: Record<ClientSceneKey, string> = {
  home: '主城',
  building: '建筑',
  farm: '农场',
  raid: '掠夺',
  report: '战报',
  faction: '阵营',
};

const sceneKeys: ClientSceneKey[] = ['home', 'building', 'farm', 'raid', 'report', 'faction'];

const todayChecklist = ['领取待领取收益', '收取 1 块成熟外场', '完成 1 次匿名掠夺'];

const factionBackgroundMap: Record<string, string> = {
  人界: '/assets/backgrounds/renjie.png',
  仙界: '/assets/backgrounds/xianjie.png',
  魔界: '/assets/backgrounds/mojie.png',
};

const sceneBackgroundMap: Record<Exclude<ClientSceneKey, 'home'>, string> = {
  building: '/assets/backgrounds/jianzhu.png',
  farm: '/assets/backgrounds/nongchang.png',
  raid: '/assets/backgrounds/lueduo.png',
  report: '/assets/backgrounds/zhanbao.png',
  faction: '/assets/backgrounds/zhenying.png',
};

function normalizeScene(scene: string): ClientSceneKey {
  if (scene === 'field') {
    return 'farm';
  }

  if (scene === 'home' || scene === 'building' || scene === 'farm' || scene === 'raid' || scene === 'report' || scene === 'faction') {
    return scene;
  }

  return 'home';
}

function toneClassName(tone: ClientButtonTone): string {
  return `action-button ${tone}`;
}

function formatServerTime(serverTime: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(serverTime));
}

function buildActionMessage(label: string, context?: string): string {
  const subject = context ? `当前目标：${context}。` : '';

  if (label.includes('领取')) {
    return `${subject}该操作会先走收益确认，再把可承接的部分并入当前库存。`;
  }

  if (label.includes('升级')) {
    return `${subject}验证版先只确认入口、消耗文案和收益预期，具体数值以后端结算为准。`;
  }

  if (label.includes('上缴')) {
    return `${subject}上缴后会立即累积贡献值，分红收益通过后续小时结算回流。`;
  }

  if (label.includes('说明') || label.includes('详情')) {
    return `${subject}这里先保留为说明弹窗，后续可以替换成更完整的二级信息面板。`;
  }

  if (label.includes('刷新')) {
    return `${subject}验证版先模拟目标刷新入口，后续再接真实目标池刷新接口。`;
  }

  return `${subject}该入口已经接入前端交互壳，后续可以继续补确认弹窗、接口联调和状态回写。`;
}

function parseVaultValue(value: string): { current: number; capacity: number; ratio: number } {
  const parts = value.split('/').map((part) => Number(part.replace(/,/g, '').trim()));
  const current = parts[0] ?? 0;
  const capacity = parts[1] ?? 1;
  const ratio = capacity > 0 ? Math.min(current / capacity, 1) : 0;

  return { current, capacity, ratio };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function findResource(label: string, resources: HomeSummaryResponse['resources']): HomeSummaryResponse['resources'][number] | undefined {
  return resources.find((resource) => resource.label === label);
}

function getFactionBackground(factionName: string): string {
  return factionBackgroundMap[factionName] ?? factionBackgroundMap['人界'];
}

function getSceneBackground(scene: ClientSceneKey, factionName: string): string {
  if (scene === 'home') {
    return getFactionBackground(factionName);
  }

  return sceneBackgroundMap[scene];
}

function ActionButton(props: {
  action: ClientSceneAction;
  onClick: (action: ClientSceneAction) => void;
}): JSX.Element {
  const { action, onClick } = props;

  return (
    <button className={toneClassName(action.tone)} onClick={() => onClick(action)} type="button">
      {action.label}
    </button>
  );
}

function GuideCard(props: {
  section: ClientGuideSection;
  onAction: (action: ClientSceneAction) => void;
}): JSX.Element {
  const { section, onAction } = props;

  return (
    <article className="panel-card">
      <div className="panel-head">
        <h4>{section.title}</h4>
      </div>
      <p className="panel-text">{section.description}</p>
      <div className="button-row wrap">
        {section.actions.map((action) => (
          <ActionButton action={action} key={`${section.title}-${action.label}`} onClick={onAction} />
        ))}
      </div>
    </article>
  );
}

function ReportCard(props: {
  entry: ClientReportEntry;
  onAction: (action: ClientSceneAction, context?: string) => void;
}): JSX.Element {
  const { entry, onAction } = props;

  return (
    <article className={`report-card ${entry.tone}`}>
      <div className="report-head">
        <div>
          <h4>{entry.title}</h4>
          <p className="report-tag-row">
            <span className="tag-pill">{entry.tag}</span>
            {entry.unread ? <span className="tag-pill unread">未读</span> : null}
            {entry.revengeable ? <span className="tag-pill revenge">可复仇</span> : null}
          </p>
        </div>
      </div>
      <p className="panel-text">{entry.summary}</p>
      <div className="button-row wrap">
        {entry.actions.map((action) => (
          <ActionButton action={action} key={`${entry.title}-${action.label}`} onClick={(nextAction) => onAction(nextAction, entry.title)} />
        ))}
      </div>
    </article>
  );
}

function RaidTargetCard(props: {
  target: ClientRaidTarget;
  selected: boolean;
  onSelect: (id: string) => void;
}): JSX.Element {
  const { target, selected, onSelect } = props;

  return (
    <button className={`target-card ${selected ? 'selected' : ''}`} onClick={() => onSelect(target.id)} type="button">
      <div className="target-head">
        <div>
          <strong>{target.name}</strong>
          <span>{target.faction}</span>
        </div>
        <span className="risk-pill">{target.risk}</span>
      </div>
      <p>{target.summary}</p>
      <div className="target-meta">
        <span>预估收益</span>
        <strong>{target.loot}</strong>
      </div>
    </button>
  );
}

export function App(): JSX.Element {
  const [viewModel, setViewModel] = useState<ClientViewModel | null>(null);
  const [activeScene, setActiveScene] = useState<ClientSceneKey>('home');
  const [reportTab, setReportTab] = useState<ReportTabKey>('defense');
  const [factionTab, setFactionTab] = useState<FactionTabKey>('overview');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [selectedRaidTargetId, setSelectedRaidTargetId] = useState<string>('');
  const [raidResult, setRaidResult] = useState<RaidResultState | null>(null);
  const [claimingSource, setClaimingSource] = useState<ClientClaimPendingRequest['source'] | null>(null);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [transferPanel, setTransferPanel] = useState<TransferPanelState | null>(null);

  useEffect(() => {
    let active = true;

    void loadClientViewModel().then((data) => {
      if (!active) {
        return;
      }

      setViewModel(data);
      setSelectedRaidTargetId(data.scenes.raid.targets[0]?.id ?? '');
    });

    return () => {
      active = false;
    };
  }, []);

  if (!viewModel) {
    return (
      <main className="loading-shell">
        <section className="loading-panel">
          <p className="eyebrow">TRINITY WAR</p>
          <h1>验证前端加载中</h1>
          <p className="panel-text">正在读取客户端验证数据与页面结构。</p>
        </section>
      </main>
    );
  }

  const { bootstrap, home, scenes, usingMock } = viewModel;
  const selectedRaidTarget = scenes.raid.targets.find((target) => target.id === selectedRaidTargetId) ?? scenes.raid.targets[0];
  const activeReportEntries = reportTab === 'defense' ? scenes.report.defense : scenes.report.attack;
  const activeBackgroundImage = `url(${getSceneBackground(activeScene, home.factionName)})`;
  const vaultResource = findResource('金库', home.resources);
  const walletResource = findResource('余额', home.resources);
  const pendingClaims = home.pendingClaims ?? [];
  const taxPending = pendingClaims.find((claim) => claim.source === 'tax');
  const factionPending = pendingClaims.find((claim) => claim.source === 'faction');
  const totalPending = pendingClaims.reduce((sum, claim) => sum + Number(claim.value.replace(/,/g, '')), 0);
  const vaultProgress = vaultResource ? parseVaultValue(vaultResource.value) : null;
  const walletProgress = walletResource && walletResource.value.includes('/') ? parseVaultValue(walletResource.value) : null;

  const openTransferPanel = (from: ClientTransferGoldRequest['from']): void => {
    if (!vaultProgress || !walletProgress) {
      return;
    }

    const maxAmount = from === 'vault'
      ? Math.min(vaultProgress.current, Math.max(walletProgress.capacity - walletProgress.current, 0))
      : Math.min(walletProgress.current, Math.max(vaultProgress.capacity - vaultProgress.current, 0));

    setTransferPanel({
      from,
      title: from === 'vault' ? '金库转入余额' : '余额转回金库',
      amount: maxAmount,
      maxAmount,
    });
  };

  const handleClaimPending = async (source: ClientClaimPendingRequest['source']): Promise<void> => {
    if (claimingSource === source) {
      return;
    }

    setClaimingSource(source);

    try {
      const result = await claimPendingEarnings({ source });
      applyMutationResult(result);
    } catch {
      setModal({
        title: '领取收益失败',
        body: '当前无法完成收益入库，请稍后重试。',
      });
    } finally {
      setClaimingSource(null);
    }
  };

  const handleTransferGold = async (): Promise<void> => {
    if (!transferPanel) {
      return;
    }

    const actionKey = `transfer:${transferPanel.from}`;
    if (pendingActionKey === actionKey) {
      return;
    }

    setPendingActionKey(actionKey);

    try {
      const result = await transferClientGold({
        from: transferPanel.from,
        amount: transferPanel.amount,
      });
      applyMutationResult(result);
      setTransferPanel(null);
    } catch {
      setModal({
        title: transferPanel.title,
        body: '当前无法完成转账，请稍后重试。',
      });
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleResetDemoState = async (): Promise<void> => {
    if (pendingActionKey === 'system:reset-demo-state') {
      return;
    }

    setPendingActionKey('system:reset-demo-state');

    try {
      const result = await resetDemoExperimentState();
      setViewModel((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          home: result.home,
          scenes: result.scenes,
        };
      });

      setModal({
        title: '实验数据已重置',
        body: result.summary,
      });
      setActiveScene('home');
      setReportTab('defense');
      setFactionTab('overview');
      setRaidResult(null);
    } catch {
      setModal({
        title: '重置失败',
        body: '当前无法重置实验数据，请稍后重试。',
      });
    } finally {
      setPendingActionKey(null);
    }
  };

  const applyMutationResult = (result: { home: HomeSummaryResponse; scenes: ClientViewModel['scenes']; summary: string }): void => {
    setViewModel((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        home: result.home,
        scenes: result.scenes,
      };
    });

    setModal({
      title: '操作完成',
      body: result.summary,
    });
  };

  const handleBuildingAction = async (action: ClientSceneAction, buildingId: ClientBuildingUpgradeId, context: string): Promise<void> => {
    if (action.label.includes('升级')) {
      const actionKey = `building:${buildingId}`;
      if (pendingActionKey === actionKey) {
        return;
      }

      setPendingActionKey(actionKey);

      try {
        const result = await upgradeClientBuilding({ buildingId });
        applyMutationResult(result);
      } catch {
        setModal({ title: action.label, body: `${context} 当前升级失败，请稍后重试。` });
      } finally {
        setPendingActionKey(null);
      }
      return;
    }

    handleSceneAction(action, context);
  };

  const handleFarmAction = async (action: ClientSceneAction, fieldId: string, context: string): Promise<void> => {
    const actionKey = `farm:${fieldId}:${action.label}`;
    if (pendingActionKey === actionKey) {
      return;
    }

    if (action.label === '开始培育') {
      setPendingActionKey(actionKey);

      try {
        const result = await startFieldCultivation({ fieldId });
        applyMutationResult(result);
      } catch {
        setModal({ title: action.label, body: `${context} 当前无法开始培育，请稍后重试。` });
      } finally {
        setPendingActionKey(null);
      }
      return;
    }

    if (action.label.includes('收取')) {
      setPendingActionKey(actionKey);

      try {
        const result = await collectFieldEarnings({
          fieldId,
          collectMode: action.label.includes('提前') ? 'early' : 'ripe',
        });
        applyMutationResult(result);
      } catch {
        setModal({ title: action.label, body: `${context} 当前无法完成收取，请稍后重试。` });
      } finally {
        setPendingActionKey(null);
      }
      return;
    }

    handleSceneAction(action, context);
  };

  const handleSceneAction = (action: ClientSceneAction, context?: string): void => {
    if (action.label === '确认出兵' && selectedRaidTarget) {
      setRaidResult({
        targetName: selectedRaidTarget.name,
        summary: `你对${selectedRaidTarget.name}发起了一次验证版出兵。`,
        loot: selectedRaidTarget.loot,
      });
      setActiveScene('report');
      setReportTab('attack');
      setModal({
        title: '出兵模拟完成',
        body: `目标 ${selectedRaidTarget.name}，预估可得 ${selectedRaidTarget.loot}。当前仅做前端验证，真实结算以后端为准。`,
      });
      return;
    }

    if (action.target !== activeScene || action.label.includes('返回') || action.label.includes('打开') || action.label.includes('复仇')) {
      setActiveScene(normalizeScene(action.target));
    }

    if (action.label.includes('复仇')) {
      setSelectedRaidTargetId(scenes.raid.targets[0]?.id ?? '');
    }

    setModal({
      title: action.label,
      body: buildActionMessage(action.label, context),
    });
  };

  return (
    <main className="app-shell">
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
            <span className="soft-tag">主城 Lv.{home.castleLevel}</span>
          </div>
          <p className="muted">{home.playerName} · {home.staminaStatus}</p>
        </div>

        <div className="summary-card">
          <p className="card-label">今日主目标</p>
          <ul className="mini-list">
            {todayChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="summary-card">
          <p className="card-label">关键提醒</p>
          <div className="rail-note rail-note-stack">
            <div className="rail-note-row">
              <strong>待领取总计</strong>
              <span>{formatNumber(totalPending)}</span>
            </div>
            <div className="rail-note-row">
              <span>主城税收</span>
              <em>{taxPending?.value ?? '0'}</em>
            </div>
            <div className="rail-note-row">
              <span>阵营分红</span>
              <em>{factionPending?.value ?? '0'}</em>
            </div>
          </div>
          <button className="rail-alert" onClick={() => setModal({ title: '战报提醒', body: '最近 1 次被掠已解锁免费复仇，可直接跳到掠夺页验证复仇链路。' })} type="button">
            战报未读 2
          </button>
        </div>

        <div className="summary-card meta-card">
          <p className="card-label">运行状态</p>
          <div className="meta-row"><span>环境</span><strong>{bootstrap.env}</strong></div>
          <div className="meta-row"><span>版本</span><strong>{bootstrap.version}</strong></div>
          <div className="meta-row"><span>时间</span><strong>{formatServerTime(bootstrap.serverTime)}</strong></div>
          <div className="meta-row"><span>数据源</span><strong>{usingMock ? '本地演示数据' : '实时接口'}</strong></div>
          <button className="secondary-button" onClick={() => {
            void handleResetDemoState();
          }} type="button">
            {pendingActionKey === 'system:reset-demo-state' ? '重置中...' : '重置实验数据'}
          </button>
        </div>
      </aside>

      <section className="phone-stage">
        <div
          className="phone-frame phone-frame-scene"
          style={{ ['--scene-bg-image' as string]: activeBackgroundImage } as React.CSSProperties}
        >
          <header className="top-bar">
            <div className="top-action-group">
              <button className="ghost-button top-action-button" onClick={() => setModal({ title: '商城', body: '验证版先预留商城入口，后续可继续补礼包、月卡、限时折扣与购买链路。' })} type="button">
                商城
              </button>
              <button className="ghost-button top-action-button" onClick={() => setModal({ title: '设置', body: '验证版先预留设置入口，后续可继续补音效、账号、调试开关与埋点面板。' })} type="button">
                设置
              </button>
            </div>
          </header>

          <section className="global-resource-bar">
            <section className="resource-dock resource-dock-global">
              {vaultResource && vaultProgress ? (
                <button className="resource-dock-card resource-dock-card-vault" key={vaultResource.label} onClick={() => openTransferPanel('vault')} type="button">
                  <div className="resource-dock-head">
                    <span className="resource-name">{vaultResource.label}</span>
                    <span className="resource-dock-hint">转出到余额</span>
                  </div>
                  <strong className="resource-dock-amount">{formatNumber(vaultProgress.current)}</strong>
                  <div className="resource-dock-progress" aria-hidden="true">
                    <div className="resource-dock-progress-fill resource-dock-progress-fill-vault" style={{ width: `${vaultProgress.ratio * 100}%` }} />
                  </div>
                  <div className="resource-dock-foot">
                    <span>上限 {formatNumber(vaultProgress.capacity)}</span>
                    <span>{Math.round(vaultProgress.ratio * 100)}%</span>
                  </div>
                </button>
              ) : null}

              {walletResource && walletProgress ? (
                <button className="resource-dock-card resource-dock-card-wallet" key={walletResource.label} onClick={() => openTransferPanel('wallet')} type="button">
                  <div className="resource-dock-head">
                    <span className="resource-name">{walletResource.label}</span>
                    <span className="resource-dock-hint">转回金库</span>
                  </div>
                  <strong className="resource-dock-amount">{formatNumber(walletProgress.current)}</strong>
                  <div className="resource-dock-progress" aria-hidden="true">
                    <div className="resource-dock-progress-fill resource-dock-progress-fill-wallet" style={{ width: `${walletProgress.ratio * 100}%` }} />
                  </div>
                  <div className="resource-dock-foot">
                    <span>上限 {formatNumber(walletProgress.capacity)}</span>
                    <span>{Math.round(walletProgress.ratio * 100)}%</span>
                  </div>
                </button>
              ) : null}
            </section>
          </section>

          <section className={`screen-body scene-${activeScene}`}>
            {activeScene === 'home' ? (
              <div className="scene-shell scene-shell-home">
                <div className="scene-scroll scene-scroll-home">
                <section className="hero-panel parchment">
                  <div>
                    <p className="eyebrow">今日状态</p>
                    <h3>主城 Lv.{home.castleLevel}</h3>
                    <p className="muted">{home.fieldStatus}，{home.reportStatus}。</p>
                  </div>
                  {taxPending ? (
                    <button className="pending-claim-button" onClick={() => {
                      void handleClaimPending('tax');
                    }} type="button">
                      <span>{taxPending.label}</span>
                      <strong>{taxPending.value}</strong>
                      <em>{claimingSource === 'tax' ? '领取中...' : '点击入库'}</em>
                    </button>
                  ) : null}
                </section>

                <article className="panel-card home-task-card">
                  <div className="panel-head">
                    <h4>主城任务列表</h4>
                    <span className="soft-tag">今日推进</span>
                  </div>
                  <div className="task-list">
                    {todayChecklist.map((item, index) => (
                      <div className="task-row" key={item}>
                        <span className="task-index">0{index + 1}</span>
                        <div>
                          <strong>{item}</strong>
                          <p>{index === 0 ? '优先回收主城税收，确保金库有足够空间继续验证。'
                            : index === 1 ? '把成熟地块收回后，可以立即再投入一轮培育。'
                              : '战报与掠夺页联动已经接好，可继续验证一轮进攻结果。'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
                </div>
              </div>
            ) : null}

            {activeScene === 'building' ? (
              <div className="scene-shell">
                <div className="scene-scroll card-grid compact-grid">
                  {scenes.building.upgrades.map((upgrade) => (
                    <article className={`upgrade-card ${upgrade.locked ? 'locked' : ''}`} key={upgrade.title}>
                      <div>
                        <h4>{upgrade.title}</h4>
                        <p>{upgrade.description}</p>
                      </div>
                      <div className="cost-box">
                        <span>{upgrade.costText}</span>
                        <ActionButton action={upgrade.action} onClick={(action) => {
                          void handleBuildingAction(action, upgrade.id, upgrade.title);
                        }} />
                      </div>
                    </article>
                  ))}
                  <GuideCard onAction={handleSceneAction} section={scenes.building.guide} />
                </div>
              </div>
            ) : null}

            {activeScene === 'farm' ? (
              <div className="scene-shell">
                <section className="hero-panel parchment compact-hero">
                  <div>
                    <p className="eyebrow">{scenes.farm.hero.eyebrow}</p>
                    <h3>{scenes.farm.hero.title}</h3>
                    <p className="muted">{scenes.farm.hero.description}</p>
                  </div>
                  <ActionButton action={scenes.farm.hero.action} onClick={(action) => {
                    const emptyField = scenes.farm.fields.find((field) => field.tone === 'empty' && field.title !== '未解锁');
                    if (!emptyField) {
                      handleSceneAction(action, '农场总览');
                      return;
                    }

                    void handleFarmAction(action, emptyField.id, emptyField.code);
                  }} />
                </section>

                <div className="scene-scroll card-grid farm-field-grid">
                  {scenes.farm.fields.map((field) => (
                    <article className={`field-card ${field.tone}`} key={field.id}>
                      <div className="field-head">
                        <div>
                          <p className="eyebrow">{field.code}</p>
                          <h4>{field.title}</h4>
                        </div>
                        <span className="stage-tag">{field.badge}</span>
                      </div>
                      <p>{field.description}</p>
                      <div className="button-row wrap compact-actions">
                        {field.actions.map((action) => (
                          <ActionButton action={action} key={`${field.id}-${action.label}`} onClick={(nextAction) => {
                            void handleFarmAction(nextAction, field.id, field.code);
                          }} />
                        ))}
                      </div>
                    </article>
                  ))}

                  <GuideCard onAction={handleSceneAction} section={scenes.farm.guide} />
                </div>
              </div>
            ) : null}

            {activeScene === 'raid' ? (
              <div className="scene-shell">
                <section className="hero-panel parchment compact-hero">
                  <div>
                    <p className="eyebrow">{scenes.raid.hero.eyebrow}</p>
                    <h3>{scenes.raid.hero.title}</h3>
                    <p className="muted">{scenes.raid.hero.description}</p>
                  </div>
                  <ActionButton action={scenes.raid.hero.action} onClick={handleSceneAction} />
                </section>

                <div className="scene-scroll">
                <div className="grid raid-layout">
                  <div className="target-list">
                    {scenes.raid.targets.map((target) => (
                      <RaidTargetCard
                        key={target.id}
                        onSelect={setSelectedRaidTargetId}
                        selected={target.id === selectedRaidTarget?.id}
                        target={target}
                      />
                    ))}
                  </div>

                  <article className="panel-card target-detail-card">
                    <div className="panel-head">
                      <h4>{selectedRaidTarget.name}</h4>
                      <span className="soft-tag">{selectedRaidTarget.risk}</span>
                    </div>
                    <p className="panel-text">{selectedRaidTarget.detail}</p>
                    <div className="target-meta large">
                      <span>预估收益</span>
                      <strong>{selectedRaidTarget.loot}</strong>
                    </div>
                    <p className="advice-box">{scenes.raid.detail.advice}</p>
                    <div className="button-row wrap">
                      <ActionButton action={selectedRaidTarget.action} onClick={(action) => handleSceneAction(action, selectedRaidTarget.name)} />
                      {scenes.raid.detail.actions.map((action) => (
                        <ActionButton action={action} key={action.label} onClick={(nextAction) => handleSceneAction(nextAction, selectedRaidTarget.name)} />
                      ))}
                    </div>
                  </article>
                </div>
                </div>
              </div>
            ) : null}

            {activeScene === 'report' ? (
              <div className="scene-shell">
                {raidResult ? (
                  <article className="hero-panel result-banner">
                    <div>
                      <p className="eyebrow">最新模拟结果</p>
                      <h3>{raidResult.summary}</h3>
                      <p className="muted">目标 {raidResult.targetName}，预估收益 {raidResult.loot}。</p>
                    </div>
                    <button className="ghost-button" onClick={() => setRaidResult(null)} type="button">
                      收起
                    </button>
                  </article>
                ) : null}

                <div className="tab-row">
                  <button className={`tab-button ${reportTab === 'defense' ? 'active' : ''}`} onClick={() => setReportTab('defense')} type="button">防守战报</button>
                  <button className={`tab-button ${reportTab === 'attack' ? 'active' : ''}`} onClick={() => setReportTab('attack')} type="button">进攻战报</button>
                </div>
                <div className="scene-scroll stack-panel compact">
                  {activeReportEntries.map((entry) => (
                    <ReportCard entry={entry} key={`${reportTab}-${entry.title}`} onAction={handleSceneAction} />
                  ))}
                </div>
                <div className="button-row wrap">
                  {scenes.report.actions.map((action) => (
                    <ActionButton action={action} key={action.label} onClick={handleSceneAction} />
                  ))}
                </div>
              </div>
            ) : null}

            {activeScene === 'faction' ? (
              <div className="scene-shell">
                <section className="hero-panel parchment compact-hero">
                  <div>
                    <p className="eyebrow">{scenes.faction.hero.eyebrow}</p>
                    <h3>{scenes.faction.hero.title}</h3>
                    <p className="muted">{scenes.faction.hero.description}</p>
                  </div>
                  <button className="pending-claim-button pending-claim-button-faction" onClick={() => {
                    void handleClaimPending('faction');
                  }} type="button">
                    <span>{factionPending?.label ?? '阵营分红'}</span>
                    <strong>{factionPending?.value ?? '0'}</strong>
                    <em>{claimingSource === 'faction' ? '领取中...' : '领取入库'}</em>
                  </button>
                </section>

                <div className="tab-row">
                  <button className={`tab-button ${factionTab === 'overview' ? 'active' : ''}`} onClick={() => setFactionTab('overview')} type="button">阵营总览</button>
                  <button className={`tab-button ${factionTab === 'donate' ? 'active' : ''}`} onClick={() => setFactionTab('donate')} type="button">上缴与分红</button>
                  <button className={`tab-button ${factionTab === 'rank' ? 'active' : ''}`} onClick={() => setFactionTab('rank')} type="button">排行榜</button>
                </div>

                <div className="scene-scroll">
                  {factionTab === 'overview' ? (
                    <article className="panel-card stats-card">
                      {scenes.faction.overview.map((item) => (
                        <div className="stat-row" key={item.label}>
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </article>
                  ) : null}

                  {factionTab === 'donate' ? <GuideCard onAction={handleSceneAction} section={scenes.faction.donate} /> : null}

                  {factionTab === 'rank' ? (
                    <article className="panel-card ranking-card">
                      {scenes.faction.rankings.map((item) => (
                        <div className="stat-row" key={item.label}>
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </article>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>

          <footer className="bottom-dock">
            {sceneKeys.map((scene) => (
              <button className={`nav-item ${activeScene === scene ? 'active' : ''}`} key={scene} onClick={() => setActiveScene(scene)} type="button">
                {sceneNavLabels[scene]}
              </button>
            ))}
          </footer>
        </div>
      </section>

      {modal ? (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="panel-head">
              <h4>{modal.title}</h4>
              <button className="ghost-button small" onClick={() => setModal(null)} type="button">关闭</button>
            </div>
            <p className="panel-text">{modal.body}</p>
            <div className="button-row end">
              <button className="secondary-button" onClick={() => setModal(null)} type="button">知道了</button>
            </div>
          </div>
        </div>
      ) : null}

      {transferPanel ? (
        <div className="modal-backdrop" onClick={() => setTransferPanel(null)}>
          <div className="modal-card transfer-card" onClick={(event) => event.stopPropagation()}>
            <div className="panel-head">
              <h4>{transferPanel.title}</h4>
              <button className="ghost-button small" onClick={() => setTransferPanel(null)} type="button">关闭</button>
            </div>
            <p className="panel-text">拖动滑条设置转账金额，系统会自动按源余额和目标上限截断。</p>
            <div className="transfer-amount-row">
              <span>转账金额</span>
              <strong>{formatNumber(transferPanel.amount)}</strong>
            </div>
            <input
              className="transfer-slider"
              max={transferPanel.maxAmount}
              min={0}
              onChange={(event) => {
                const nextAmount = Number(event.target.value);
                setTransferPanel((current) => current ? { ...current, amount: nextAmount } : current);
              }}
              step={10}
              type="range"
              value={Math.min(transferPanel.amount, transferPanel.maxAmount)}
            />
            <div className="transfer-foot-row">
              <span>可转上限 {formatNumber(transferPanel.maxAmount)}</span>
              <button className="ghost-button small" onClick={() => {
                setTransferPanel((current) => current ? { ...current, amount: current.maxAmount } : current);
              }} type="button">
                全部转出
              </button>
            </div>
            <div className="button-row end">
              <button className="secondary-button" onClick={() => setTransferPanel(null)} type="button">取消</button>
              <button className="primary-button" disabled={transferPanel.maxAmount <= 0 || pendingActionKey === `transfer:${transferPanel.from}`} onClick={() => {
                void handleTransferGold();
              }} type="button">
                {pendingActionKey === `transfer:${transferPanel.from}` ? '转账中...' : '确认转账'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}