import type {
  ClientFarmField,
  ClientSceneContentResponse,
  ClientSceneKey,
  ClientSocialSummaryResponse,
  ClientSpiritState,
  HomeSummaryResponse,
} from '@trinitywar/shared';

interface HomeSceneProps {
  home: HomeSummaryResponse;
  scenes: ClientSceneContentResponse;
  spirit?: ClientSpiritState | null;
  socialSummary?: ClientSocialSummaryResponse | null;
  tutorialTask?: {
    title: string;
    description: string;
    actionLabel: string;
  } | null;
  onNavigate: (scene: ClientSceneKey) => void;
  onTutorialAction?: () => void;
}

export function HomeScene(props: HomeSceneProps): JSX.Element {
  const {
    home,
    scenes,
    spirit,
    socialSummary,
    tutorialTask,
    onNavigate,
    onTutorialAction,
  } = props;
  const farmSummary = buildFarmSummary(scenes.farm.fields);
  const mainSpirit = spirit?.mainSlot ?? null;
  const aliveSpiritCount = spirit?.slots.filter((slot) => slot.spiritId && slot.status !== 'dissolved').length ?? 0;
  const readyComposeCount = spirit?.readyToCompose.length ?? 0;
  const breakthroughReady = Boolean(spirit?.breakthroughRequirement?.canBreakthrough);
  const revengeableReports = [...scenes.report.defense, ...scenes.report.attack].filter((entry) => entry.revengeable).length;
  const unreadReports = [...scenes.report.defense, ...scenes.report.attack].filter((entry) => entry.unread).length;
  const bestRaidTarget = scenes.raid.targets[0] ?? null;
  const socialQuickCount = socialSummary?.quickActions.length ?? 0;
  const nextContributionTarget = getNextContributionTarget(home.todayContribution);
  const contributionRemaining = Math.max(nextContributionTarget - home.todayContribution, 0);
  const opportunities = buildOpportunities({
    farmSummary,
    mainSpirit,
    readyComposeCount,
    breakthroughReady,
    revengeableReports,
    unreadReports,
    bestRaidTarget,
    socialQuickCount,
  }).slice(0, 3);
  const recommendations = buildRecommendations({
    farmSummary,
    mainSpirit,
    readyComposeCount,
    breakthroughReady,
    revengeableReports,
    unreadReports,
    bestRaidTarget,
    socialQuickCount,
    factionTask: home.factionTasks.find((task) => task.status !== 'claimed'),
  }).slice(0, 4);

  const tutorialHome = tutorialTask ? (
    <div className="scene-shell scene-shell-home">
      <div className="scene-scroll scene-scroll-home scene-scroll-tutorial-home">
        <article className="panel-card home-tutorial-card">
          <div className="panel-head">
            <h4>新手任务</h4>
            <span className="soft-tag">当前目标</span>
          </div>
          <div className="home-tutorial-body">
            <strong>{tutorialTask.title}</strong>
            <p>{tutorialTask.description}</p>
            <button className="primary-button" onClick={onTutorialAction} type="button">
              {tutorialTask.actionLabel}
            </button>
          </div>
        </article>
      </div>
    </div>
  ) : null;

  if (tutorialHome) {
    return tutorialHome;
  }

  return (
    <div className="scene-shell scene-shell-home">
      <div className="scene-scroll scene-scroll-home">
        {tutorialTask ? (
          <article className="panel-card home-tutorial-card">
            <div className="panel-head">
              <h4>新手任务</h4>
              <span className="soft-tag">当前目标</span>
            </div>
            <div className="home-tutorial-body">
              <strong>{tutorialTask.title}</strong>
              <p>{tutorialTask.description}</p>
              <button className="primary-button" onClick={onTutorialAction} type="button">
                {tutorialTask.actionLabel}
              </button>
            </div>
          </article>
        ) : null}

        <section className="home-overview-panel">
          <div className="home-overview-copy">
            <span className="eyebrow">{home.factionName}</span>
            <h3>{home.playerName}</h3>
            <p>首页会把当前状态、收益机会和入口收在一起，先看哪里更值得处理。</p>
          </div>
          <div className="home-overview-metrics" aria-label="贡献总览">
            <div>
              <span>今日贡献</span>
              <strong>{formatNumber(home.todayContribution)}</strong>
            </div>
            <div>
              <span>距下一档</span>
              <strong>{contributionRemaining > 0 ? formatNumber(contributionRemaining) : '已达成'}</strong>
            </div>
            <div>
              <span>下一目标</span>
              <strong>{formatNumber(nextContributionTarget)}</strong>
            </div>
          </div>
          <div className="home-resource-row">
            {home.resources.slice(0, 4).map((resource) => (
              <div className="home-resource-chip" key={`${resource.label}-${resource.tone}`}>
                <span>{resource.label}</span>
                <strong>{resource.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="home-section">
          <div className="panel-head home-section-head">
            <h4>当前更值得处理</h4>
            <span className="soft-tag">机会优先</span>
          </div>
          <div className="home-opportunity-grid">
            {opportunities.map((item) => (
              <button
                className={`home-opportunity-card home-opportunity-${item.tone}`}
                key={item.title}
                onClick={() => onNavigate(item.target)}
                type="button"
              >
                <span>{item.kicker}</span>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="home-core-grid">
          <article className="panel-card home-core-card">
            <div className="panel-head">
              <h4>农场供给</h4>
              <span className="soft-tag">{home.fieldStatus}</span>
            </div>
            <div className="home-core-stat-row">
              <div><span>可收取</span><strong>{farmSummary.collectableCount} 块</strong></div>
              <div><span>培育中</span><strong>{farmSummary.growingCount} 块</strong></div>
            </div>
            <p>{farmSummary.nextReadyText}</p>
            <button className="secondary-button" onClick={() => onNavigate('farm')} type="button">
              进入农场
            </button>
          </article>

          <article className="panel-card home-core-card">
            <div className="panel-head">
              <h4>灵宠养成</h4>
              <span className="soft-tag">{aliveSpiritCount} 只</span>
            </div>
            <div className="home-core-stat-row">
              <div><span>主战灵宠</span><strong>{mainSpirit?.spiritId ?? '未设置'}</strong></div>
              <div><span>等级</span><strong>{mainSpirit ? `Lv.${mainSpirit.level}` : '-'}</strong></div>
            </div>
            <p>{buildSpiritStatusText(mainSpirit, readyComposeCount, breakthroughReady)}</p>
            <button className="secondary-button" onClick={() => onNavigate('raid')} type="button">
              查看灵宠
            </button>
          </article>
        </section>

        <section className="panel-card home-social-card">
          <div className="panel-head">
            <h4>竞争与社交</h4>
            <span className="soft-tag">{home.reportStatus}</span>
          </div>
          <div className="home-social-grid">
            <div><span>可复仇</span><strong>{revengeableReports}</strong></div>
            <div><span>未读动态</span><strong>{unreadReports + (socialSummary?.counts.feedUnread ?? 0)}</strong></div>
            <div><span>好友</span><strong>{socialSummary?.counts.friends ?? 0}</strong></div>
          </div>
          <div className="home-social-actions">
            <button className="ghost-button" onClick={() => onNavigate('report')} type="button">查看探索</button>
            <button className="ghost-button" onClick={() => onNavigate('social')} type="button">查看社交</button>
          </div>
        </section>

        <section className="panel-card home-recommend-card">
          <div className="panel-head home-section-head">
            <h4>推荐行动</h4>
            <span className="soft-tag">不必全做</span>
          </div>
          <div className="home-recommend-list">
            {recommendations.map((item) => (
              <button className="home-recommend-item" key={item.text} onClick={() => onNavigate(item.target)} type="button">
                <span>{item.label}</span>
                <strong>{item.text}</strong>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

interface FarmSummary {
  collectableCount: number;
  matureCount: number;
  witheredCount: number;
  growingCount: number;
  emptyCount: number;
  nextReadySeconds: number | null;
  nextReadyText: string;
}

interface OpportunityInput {
  farmSummary: FarmSummary;
  mainSpirit: ClientSpiritState['mainSlot'];
  readyComposeCount: number;
  breakthroughReady: boolean;
  revengeableReports: number;
  unreadReports: number;
  bestRaidTarget: ClientSceneContentResponse['raid']['targets'][number] | null;
  socialQuickCount: number;
}

interface HomeOpportunity {
  kicker: string;
  title: string;
  description: string;
  target: ClientSceneKey;
  tone: 'harvest' | 'spirit' | 'raid' | 'social' | 'calm';
}

interface Recommendation {
  label: string;
  text: string;
  target: ClientSceneKey;
}

function buildFarmSummary(fields: ClientFarmField[]): FarmSummary {
  const unlockedFields = fields.filter((field) => field.tone !== 'locked');
  const matureCount = unlockedFields.filter((field) => field.tone === 'mature').length;
  const witheredCount = unlockedFields.filter((field) => field.tone === 'withered').length;
  const growingFields = unlockedFields.filter((field) => field.tone === 'growing');
  const nextReadySeconds = growingFields.length > 0
    ? Math.min(...growingFields.map((field) => Math.max(field.progressRemainingSeconds, 0)))
    : null;

  return {
    collectableCount: matureCount + witheredCount,
    matureCount,
    witheredCount,
    growingCount: growingFields.length,
    emptyCount: unlockedFields.filter((field) => field.tone === 'empty').length,
    nextReadySeconds,
    nextReadyText: nextReadySeconds === null
      ? '当前没有作物在倒计时，空田可以安排下一轮培育。'
      : `下一块田约 ${formatDuration(nextReadySeconds)} 后成熟。`,
  };
}

function buildOpportunities(input: OpportunityInput): HomeOpportunity[] {
  const items: HomeOpportunity[] = [];

  if (input.farmSummary.matureCount > 0) {
    items.push({
      kicker: '农场',
      title: `${input.farmSummary.matureCount} 块田地已成熟`,
      description: '收取后可推进资源和贡献来源。',
      target: 'farm',
      tone: 'harvest',
    });
  }

  if (input.farmSummary.witheredCount > 0) {
    items.push({
      kicker: '风险',
      title: `${input.farmSummary.witheredCount} 块田地已进入枯萎期`,
      description: '现在处理可以回收剩余收益。',
      target: 'farm',
      tone: 'harvest',
    });
  }

  if (input.breakthroughReady) {
    items.push({
      kicker: '灵宠',
      title: '主战灵宠可突破',
      description: '突破后战力和后续收益空间会继续打开。',
      target: 'raid',
      tone: 'spirit',
    });
  } else if (input.readyComposeCount > 0) {
    items.push({
      kicker: '灵宠',
      title: `${input.readyComposeCount} 只灵宠可合成`,
      description: '新灵宠会补足图鉴和战斗选择。',
      target: 'raid',
      tone: 'spirit',
    });
  } else if (false) {
    items.push({
      kicker: '灵宠',
      title: '主战灵宠需要恢复',
      description: '恢复后才能继续出战探索。',
      target: 'raid',
      tone: 'spirit',
    });
  }

  if (input.revengeableReports > 0) {
    items.push({
      kicker: '复仇',
      title: `${input.revengeableReports} 个目标可复仇`,
      description: '对方保护结束前，复仇入口仍然有效。',
      target: 'report',
      tone: 'raid',
    });
  } else if (input.bestRaidTarget) {
    items.push({
      kicker: '探索',
      title: '发现可挑战目标',
      description: input.bestRaidTarget.loot || input.bestRaidTarget.summary,
      target: 'report',
      tone: 'raid',
    });
  }

  if (input.socialQuickCount > 0) {
    items.push({
      kicker: '社交',
      title: `${input.socialQuickCount} 条好友互动可处理`,
      description: '互助和关系动态能带来额外收益。',
      target: 'social',
      tone: 'social',
    });
  }

  if (items.length === 0) {
    items.push({
      kicker: '状态',
      title: '当前节奏稳定',
      description: input.farmSummary.nextReadyText,
      target: input.farmSummary.emptyCount > 0 ? 'farm' : 'faction',
      tone: 'calm',
    });
  }

  return items;
}

function buildRecommendations(input: OpportunityInput & { factionTask?: HomeSummaryResponse['factionTasks'][number] }): Recommendation[] {
  const items: Recommendation[] = [];

  if (input.farmSummary.collectableCount > 0) {
    items.push({ label: '收益', text: '收取成熟田地可获得资源，并推动贡献循环。', target: 'farm' });
  } else if (input.farmSummary.emptyCount > 0) {
    items.push({ label: '供给', text: '空闲田地可以安排下一轮培育。', target: 'farm' });
  }

  if (input.breakthroughReady || input.readyComposeCount > 0) {
    items.push({ label: '养成', text: '灵宠当前有可处理成长点。', target: 'raid' });
  } else if (input.mainSpirit) {
    items.push({ label: '战力', text: '查看主战灵宠状态，决定是否继续投入资源。', target: 'raid' });
  }

  if (input.revengeableReports > 0 || input.bestRaidTarget) {
    items.push({ label: '竞争', text: '探索目标里可能有额外收益机会。', target: 'report' });
  }

  if (input.socialQuickCount > 0) {
    items.push({ label: '互助', text: '好友互动可顺手处理。', target: 'social' });
  }

  if (input.factionTask) {
    items.push({ label: '贡献', text: input.factionTask.title, target: 'faction' });
  }

  if (items.length === 0) {
    items.push({ label: '贡献', text: '查看阵营贡献与今日可领取内容。', target: 'faction' });
    items.push({ label: '下一轮', text: input.farmSummary.nextReadyText, target: 'farm' });
  }

  return items;
}

function buildSpiritStatusText(
  mainSpirit: ClientSpiritState['mainSlot'],
  readyComposeCount: number,
  breakthroughReady: boolean,
): string {
  if (!mainSpirit) {
    return readyComposeCount > 0 ? '已有碎片满足合成条件，可先补齐第一只主战灵宠。' : '暂无主战灵宠，先在灵宠页查看可用养成入口。';
  }

  if (false) {
    return '主战灵宠当前无法出战，恢复后可继续探索。';
  }

  if (breakthroughReady) {
    return '突破材料已满足，战力还有提升空间。';
  }

  if (readyComposeCount > 0) {
    return `${readyComposeCount} 只灵宠碎片已满足合成条件。`;
  }

  return `生命 ${mainSpirit.currentHp}/${mainSpirit.maxHp}，当前可以继续承担探索与守备。`;
}

function getNextContributionTarget(todayContribution: number): number {
  const tiers = [20, 50, 100, 200, 400, 800];
  return tiers.find((tier) => todayContribution < tier) ?? Math.ceil((todayContribution + 1) / 500) * 500;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(Math.floor(value), 0));
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(Math.ceil(totalSeconds), 0);
  if (safeSeconds < 60) {
    return `${safeSeconds} 秒`;
  }

  const minutes = Math.ceil(safeSeconds / 60);
  if (minutes < 60) {
    return `${minutes} 分钟`;
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0 ? `${hours} 小时 ${restMinutes} 分钟` : `${hours} 小时`;
}
