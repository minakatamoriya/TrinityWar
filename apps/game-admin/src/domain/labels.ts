import type { AdminRecord, FieldRow } from '../types';

const fieldLabels: Record<string, string> = {
  app: '应用',
  docs: '文档地址',
  modules: '模块',
  environment: '环境',
  version: '版本',
  time: '服务时间',
  database: '数据库',
  workers: 'Worker',
  featureFlags: '功能开关',
  playerId: '玩家 ID',
  id: 'ID',
  nickname: '昵称',
  faction: '阵营',
  factionMembers: '阵营成员记录',
  castleLevel: '主城等级',
  stateVersion: '状态版本',
  createdAt: '创建时间',
  updatedAt: '更新时间',
  lastLoginAt: '最近登录',
  spirit: '灵宠',
  resources: '玩家基础资源',
  gold: '金币',
  resourceStateVersion: '资源状态版本（内部并发校验）',
  spiritResourceStateVersion: '灵宠资源版本（内部并发校验）',
  spell: '法术',
  spellStateVersion: '法术状态版本（内部并发校验）',
  spiritSoul: '兽魂',
  tianjiTalisman: '天机符',
  dailyRecoveryUsed: '今日恢复次数',
  dailyRecoveryDateKey: '恢复日期',
  dailyIntelFreeUsed: '今日免费侦察',
  dailyIntelTalismanUsed: '今日天机侦察',
  dailyIntelDateKey: '侦察日期',
  resourceVersion: '灵宠资源版本',
  mainSlot: '主战灵宠',
  slotIndex_spirit: '兽栏序号',
  isMain: '主战',
  spiritId: '灵宠 ID',
  rarity: '稀有度',
  factionAffinity: '阵营亲和',
  role: '定位',
  element: '五行',
  level: '等级',
  exp: '经验',
  currentHp: '当前生命',
  maxHp: '最大生命',
  baseAttack: '基础攻击',
  baseHp: '基础生命',
  growthAttack: '攻击成长',
  growthHp: '生命成长',
  acquiredAt: '获得时间',
  dissolvedAt: '解散时间',
  slotVersion: '兽栏版本',
  shardName: '精魄名称',
  shardCount: '精魄数量',
  shardUnlockRequired: '合成所需精魄',
  hasSeen: '已见过',
  readyToCompose: '可合成',
  ownedCurrent: '当前持有',
  ownedEver: '曾经持有',
  firstSeenAt: '首次见到',
  readyAt: '就绪时间',
  lastOwnedAt: '最近持有',
  codexVersion: '图鉴版本',
  lore: '背景',
  growSeconds: '成长秒数',
  matureSeconds: '成熟秒数',
  collectWindowSeconds: '可收窗口秒数',
  baseYieldGold: '基础产金',
  strategyNote: '策略说明',
  upgradeCost: '升级消耗',
  cumulativeCost: '累计消耗',
  taxPerHour: '每小时税收',
  unlocks: '解锁内容',
  sortOrder: '排序',
  playerId_wallet: '玩家 ID',
  vaultGold: '金币（旧金库字段）',
  vaultCapacity: '金库容量',
  walletGold: '旧钱包金币',
  walletCapacity: '钱包容量',
  walletProtectedRatio: '旧钱包保护比例',
  pendingTaxGold: '待领税收',
  pendingDividendGold: '待领分红',
  pendingRaidOverflowGold: '掠夺溢出待领',
  pendingRaidOverflowExpiresAt: '掠夺溢出过期时间',
  balanceVersion: '资源状态版本（内部并发校验）',
  castleLevelCache: '主城缓存等级',
  castleLevel_building: '主城等级',
  vaultLevel: '金库等级',
  fieldSlotLevel: '田地位等级',
  populationLevel: '人口兼容等级',
  watchtowerLevel: '防守等级',
  protectionTechLevel: '护灵阵',
  farmYieldTechLevel: '祈雨术',
  collectWindowTechLevel: '观星术',
  pendingClaimTechLevel: '同心诀',
  buildingVersion: '法术状态版本（内部并发校验）',
  capacity: '容量',
  slotIndex: '田地序号',
  isUnlocked: '是否解锁',
  status: '状态',
  seedId: '灵植 ID',
  currentClaimableGold: '当前可收金币',
  matureAt: '成熟时间',
  overripeAt: '枯萎时间',
  statusVersion: '状态版本',
  label: '名称',
  quantity: '数量',
  inventoryVersion: '库存版本',
  unlockedAt: '解锁时间',
  taskId: '任务 ID',
  progress: '进度',
  target: '目标',
  rewardGold: '奖励金币',
  actionScene: '行动页面',
  claimedAt: '领取时间',
  orderId: '订单 ID',
  type: '类型',
  attackerPlayerId: '攻击方玩家',
  defenderPlayerId: '防守方玩家',
  defenderFieldSlotId: '防守地块',
  sourceTargetPoolId: '来源目标池',
  mode: '模式',
  requestIdempotencyKey: '幂等键',
  dispatchedAt: '出征时间',
  settleAt: '预计结算',
  settledAt: '实际结算',
  settlementVersion: '结算版本',
  raidOrderId: '掠夺订单',
  result: '结果',
  lootGold: '掠夺金币',
  depositedGold: '入库金币',
  overflowGold: '溢出金币',
  temporaryClaimExpiresAt: '临时领取过期',
  attackerLoss: '攻击方损失',
  defenderLoss: '防守方损失',
  rewardItemsJson: '奖励物品',
  reportSummary: '战报摘要',
  assetType: '资产类型',
  sourceEntityId: '来源实体',
  sourceFieldSlotId: '来源田地',
  lockedGold: '锁定金币',
  lockedItemJson: '锁定物品',
  lockMode: '锁定模式',
  expiresAt: '过期时间',
  ownerPlayerId: '归属玩家',
  ownerNickname: '归属玩家昵称',
  ownerCastleLevel: '归属玩家等级',
  opponentPlayerId: '对手玩家',
  reportType: '战报类型',
  title: '标题',
  summary: '摘要',
  revengeAvailable: '可复仇',
  revokedAt: '撤销时间',
  campaignId: '助力活动 ID',
  campaignType: '助力类型',
  campaignStatus: '助力活动状态',
  currentAssistCount: '当前助力数',
  maxAssistCount: '助力上限',
  targetEntityType: '目标类型',
  targetEntityId: '目标 ID',
  recordCount: '助力记录数',
  inviteCount: '邀请绑定数',
  helperAudience: '助力者类型',
  helperPlayerId: '助力玩家 ID',
  helperNickname: '助力玩家昵称',
  helperOpenidHash: '助力 OpenID Hash',
  helperDeviceHash: '助力设备 Hash',
  assistRecordId: '浇水记录 ID',
  rewardClaimedAt: '奖励发送时间',
  boundAt: '绑定时间',
  inviterPlayerId: '邀请人 ID',
  inviterNickname: '邀请人昵称',
  invitedPlayerId: '被邀请玩家 ID',
  invitedNickname: '被邀请玩家昵称',
  invitedOpenidHash: '被邀请 OpenID Hash',
  sourceCampaignId: '来源助力活动',
  rewardedAt: '奖励时间',
};

export function recordRows(record: AdminRecord | null | undefined, keys: string[]): FieldRow[] {
  if (!record) {
    return [{ label: '状态', field: 'empty', value: '暂无数据' }];
  }

  return keys.map((key) => ({
    label: getLabel(key),
    field: key,
    value: record[key],
  }));
}

export function getLabel(field: string): string {
  return fieldLabels[field] ?? fieldLabels[field.replace(/\..*/, '')] ?? field;
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (typeof value === 'string') {
    return formatDateTime(value) ?? value;
  }

  if (typeof value === 'boolean') {
    return value ? '是 / true' : '否 / false';
  }

  if (Array.isArray(value)) {
    if (value.length <= 0) {
      return '[]';
    }
    if (value.every((item) => typeof item !== 'object' || item === null)) {
      return value.join(', ');
    }
    return value.map((item) => formatValue(item)).join('；');
  }

  if (typeof value === 'object') {
    return Object.entries(value as AdminRecord)
      .map(([key, nestedValue]) => `${getLabel(key)}(${key}): ${formatValue(nestedValue)}`)
      .join('；');
  }

  return String(value);
}

export function formatColumnLabel(label: string): string {
  return label.split('/')[0]?.trim() || label;
}

export function formatDateTime(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const pad = (part: number): string => String(part).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
