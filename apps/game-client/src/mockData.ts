import { APP_NAME, type ClientBootstrapResponse, type ClientSceneContentResponse, type HomeSummaryResponse } from '@trinitywar/shared';

export const mockBootstrap: ClientBootstrapResponse = {
  app: APP_NAME,
  env: 'local',
  version: '0.1.0',
  serverTime: new Date('2026-05-09T10:00:00+08:00').toISOString(),
};

export const mockHomeSummary: HomeSummaryResponse = {
  app: APP_NAME,
  playerName: '人界领主·临川',
  factionName: '人界',
  castleLevel: 4,
  staminaStatus: '免费掠夺 2/3',
  fieldStatus: '成熟外场 1 块，成长中 1 块',
  reportStatus: '未读战报 2，免费复仇 1',
  resources: [
    { label: '金库', value: '4,280 / 5,000', tone: 'vault' },
    { label: '余额', value: '620 / 1,500', tone: 'wallet' },
  ],
  pendingClaims: [
    { source: 'tax', label: '主城税收', value: '380', description: '当前每小时产出 190 金币，领取后直接入库。' },
    { source: 'faction', label: '阵营分红', value: '540', description: '当前每小时可分到 200 金币，来自阵营结算与贡献加成。' },
  ],
  primaryActions: [
    { key: 'building', title: '建筑', description: '升级主城与金库' },
    { key: 'farm', title: '农场', description: '收成熟外场' },
    { key: 'raid', title: '掠夺', description: '查看匿名目标' },
    { key: 'report', title: '战报', description: '处理未读与复仇' },
    { key: 'faction', title: '阵营', description: '上缴并查看分红' },
  ],
};

export const mockSceneContent: ClientSceneContentResponse = {
  app: APP_NAME,
  building: {
    upgrades: [
      {
        id: 'castle',
        title: '主城升级',
        description: 'Lv.4 -> Lv.5，主城税收由每小时 190 提升到 260。',
        costText: '消耗 1,800 金币',
        action: { label: '升级主城', target: 'building', tone: 'primary' },
      },
      {
        id: 'vault',
        title: '金库升级',
        description: 'Lv.3 -> Lv.4，容量由 5,000 提升到 6,600。',
        costText: '消耗 1,150 金币',
        action: { label: '升级金库', target: 'building', tone: 'secondary' },
      },
      {
        id: 'field-slot',
        title: '外场位升级',
        description: 'Lv.1 -> Lv.2，新增第 2 个培育位。',
        costText: '消耗 980 金币',
        action: { label: '升级外场位', target: 'building', tone: 'secondary' },
      },
      {
        id: 'watchtower',
        title: '防守建筑升级',
        description: 'Lv.1 -> Lv.2，降低余额与外场被掠损失。',
        costText: '需要主城 Lv.5',
        locked: true,
        action: { label: '查看条件', target: 'building', tone: 'ghost' },
      },
    ],
    guide: {
      title: '建筑线引导',
      description: '建筑页只承接主城、金库、外场位和防守建筑等长期成长内容，避免和农场经营混在一起。',
      actions: [
        { label: '打开农场页', target: 'farm', tone: 'secondary' },
        { label: '去掠夺', target: 'raid', tone: 'ghost' },
      ],
    },
  },
  farm: {
    hero: {
      eyebrow: '外场经营',
      title: '成熟 1 块 · 成长中 1 块',
      description: '农场页单独承接外场培育、收取、阶段说明和后续扩展玩法。',
      action: { label: '开始培育', target: 'farm', tone: 'primary' },
    },
    fields: [
      {
        id: 'field-1',
        code: '外场 01',
        title: '丰熟期',
        badge: '高风险高收益',
        tone: 'ripe',
        description: '投入 600 金币，当前可收 1,260 金币，过熟倒计时 02:00:00。',
        actions: [
          { label: '提前收取', target: 'farm', tone: 'secondary' },
          { label: '成熟收取', target: 'farm', tone: 'primary' },
        ],
      },
      {
        id: 'field-2',
        code: '外场 02',
        title: '成长期',
        badge: '01:42 后成熟',
        tone: 'growing',
        description: '投入 420 金币，当前提前收取仅返还 520 金币。',
        actions: [
          { label: '收益预览', target: 'farm', tone: 'ghost' },
          { label: '阶段说明', target: 'farm', tone: 'ghost' },
        ],
      },
      {
        id: 'field-3',
        code: '外场 03',
        title: '未解锁',
        badge: '升级解锁',
        tone: 'empty',
        description: '外场位升级到 Lv.2 后开放。',
        actions: [{ label: '去建筑', target: 'building', tone: 'primary' }],
      },
    ],
    guide: {
      title: '农场线引导',
      description: '以后如果农场增加培育品类、天气、地块事件和成熟策略，都可以继续在这个页面扩展。',
      actions: [
        { label: '打开建筑页', target: 'building', tone: 'secondary' },
        { label: '返回主城', target: 'home', tone: 'ghost' },
      ],
    },
  },
  raid: {
    hero: {
      eyebrow: '匿名目标池',
      title: '剩余免费掠夺 2 / 3',
      description: '系统按综合战力匹配 3 个目标，重点看值不值得打。',
      action: { label: '刷新目标', target: 'raid', tone: 'secondary' },
    },
    targets: [
      {
        id: 'target-1',
        name: '赤砂营地',
        faction: '魔界',
        summary: '等级段 4~5 · 资源预估高 · 防守偏弱',
        loot: '420~560 金币',
        risk: '高风险',
        detail: '魔界 · 主城等级 4~5 · 外场成熟 2 块 · 防守偏弱 · 今日被掠 1 次。',
        action: { label: '发起掠夺', target: 'raid', tone: 'primary' },
      },
      {
        id: 'target-2',
        name: '天穹边仓',
        faction: '仙界',
        summary: '等级段 4 · 资源预估中 · 被掠损失低',
        loot: '260~340 金币',
        risk: '中风险',
        detail: '仙界 · 主城等级 4 · 外场成熟 1 块 · 防守偏稳 · 今日未被掠。',
        action: { label: '发起掠夺', target: 'raid', tone: 'secondary' },
      },
      {
        id: 'target-3',
        name: '灰堡驿站',
        faction: '人界',
        summary: '等级段 3~4 · 资源预估低 · 风险较稳',
        loot: '180~260 金币',
        risk: '低风险',
        detail: '人界 · 主城等级 3~4 · 余额暴露较低 · 适合保守出手。',
        action: { label: '发起掠夺', target: 'raid', tone: 'secondary' },
      },
    ],
    detail: {
      advice: '出征建议：派出 90~110 掠夺兵',
      actions: [
        { label: '更换兵力', target: 'raid', tone: 'ghost' },
        { label: '确认出兵', target: 'raid', tone: 'primary' },
      ],
    },
  },
  report: {
    defense: [
      {
        title: '魔界 · 烬牙',
        tag: '可复仇',
        tone: 'danger',
        unread: true,
        revengeable: true,
        summary: '37 分钟前成功掠走你外场 240 金币，击伤 8 名守备兵。',
        actions: [
          { label: '查看详情', target: 'report', tone: 'ghost' },
          { label: '复仇', target: 'raid', tone: 'primary' },
        ],
      },
      {
        title: '系统结算',
        tag: '分红记录',
        tone: 'neutral',
        unread: true,
        summary: '10:00 阵营小时分红 +200，当前待领取分红 540。',
        actions: [{ label: '查看详情', target: 'faction', tone: 'ghost' }],
      },
    ],
    attack: [
      {
        title: '匿名目标 · 赤砂营地',
        tag: '掠夺成功',
        tone: 'success',
        summary: '08:40 你成功掠夺 436 金币，获得 18 点掠夺积分。',
        actions: [{ label: '查看详情', target: 'report', tone: 'ghost' }],
      },
    ],
    actions: [
      { label: '一键已读', target: 'report', tone: 'secondary' },
      { label: '返回主城', target: 'home', tone: 'primary' },
    ],
  },
  faction: {
    hero: {
      eyebrow: '人界阵营面板',
      title: '当前待领取分红 540',
      description: '当前每小时可分到 200 金币，其中基础分红 160，贡献加成 40。',
      action: { label: '领取分红', target: 'faction', tone: 'primary' },
    },
    overview: [
      { label: '阵营公库', value: '82,400' },
      { label: '当前每小时总分红', value: '200' },
      { label: '本小时基础分红', value: '160' },
      { label: '个人贡献加成', value: '+40' },
    ],
    donate: {
      title: '金币上缴',
      description: '上缴会立刻增加贡献值，当前你的每小时分红为 200，后续会随贡献变化继续浮动。',
      actions: [
        { label: '金币上缴', target: 'faction', tone: 'secondary' },
        { label: '查看说明', target: 'faction', tone: 'ghost' },
      ],
    },
    rankings: [
      { label: '1. 烬牙', value: '2,340' },
      { label: '2. 你', value: '2,120' },
      { label: '3. 玄潮', value: '1,980' },
    ],
  },
};