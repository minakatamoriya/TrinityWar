import { useState } from 'react';
import type { AdminListResponse, AdminPlayerOverviewResponse, AdminPlayerSearchResponse } from '@trinitywar/shared';
import { DataTable } from '../components/DataTable';
import { InfoSection } from '../components/InfoSection';
import { PaginationBar } from '../components/PaginationBar';
import { SearchPanel } from '../components/SearchPanel';
import { TableSection } from '../components/TableSection';
import { formatValue, recordRows } from '../domain/labels';
import type { AdminRecord, PlayerResourceAdjustFormState } from '../types';

export function PlayerInfoView(props: {
  busy: string;
  keyword: string;
  searchResult: AdminPlayerSearchResponse | null;
  onKeywordChange: (value: string) => void;
  onSearch: () => void;
  onSearchPageChange: (page: number) => void;
  onOpenPlayerInfo: (playerId: string) => void;
  onOpenPlayerRaid: (playerId: string) => void;
  onOpenPlayerSend: (playerId: string, nickname: string) => void;
  onDeletePlayer: (playerId: string) => void;
}): JSX.Element {
  return (
    <div className="view-stack">
      <SearchPanel
        busy={props.busy === 'search'}
        keyword={props.keyword}
        onKeywordChange={props.onKeywordChange}
        onSearch={props.onSearch}
      />

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Search Result</p>
            <h3>玩家列表</h3>
          </div>
          <span className="result-count">共 {props.searchResult?.pagination.total ?? 0} 条</span>
        </div>
        <DataTable
          columns={[
            { label: '昵称 / nickname', key: 'nickname' },
            { label: '玩家 ID / playerId', key: 'playerId' },
            { label: '阵营 / faction', key: 'faction' },
            { label: '领地阶段 / castleLevel', key: 'castleLevel' },
            { label: '最近登录 / lastLoginAt', key: 'lastLoginAt' },
          ]}
          emptyText="输入关键词搜索玩家。"
          getRowKey={(row) => String(row.playerId)}
          rows={props.searchResult?.items ?? []}
          rowAction={(row) => (
            <div className="action-group">
              <button className="small-button" type="button" onClick={() => props.onOpenPlayerInfo(String(row.playerId))}>
                查基础信息
              </button>
              <button className="small-button" type="button" onClick={() => props.onOpenPlayerRaid(String(row.playerId))}>
                查掠夺
              </button>
              <button className="small-button" type="button" onClick={() => props.onOpenPlayerSend(String(row.playerId), String(row.nickname ?? row.playerId))}>
                发送
              </button>
              <button
                className="small-button danger-button"
                disabled={props.busy === 'delete-player'}
                type="button"
                onClick={() => props.onDeletePlayer(String(row.playerId))}
              >
                删除
              </button>
            </div>
          )}
        />
        <PaginationBar
          busy={props.busy === 'search'}
          pagination={props.searchResult?.pagination ?? null}
          onPageChange={props.onSearchPageChange}
        />
      </section>
    </div>
  );
}

const resourceAdjustFields: Array<{
  currentKey: string;
  group: '基础' | '灵宠' | '阵营';
  key: keyof PlayerResourceAdjustFormState;
  label: string;
  placeholder: string;
}> = [
  { group: '基础', key: 'goldDelta', currentKey: 'gold', label: '金币', placeholder: '+1000 / -1000' },
  { group: '基础', key: 'tianjiTalismanDelta', currentKey: 'tianjiTalisman', label: '天机符', placeholder: '+3 / -1' },
  { group: '灵宠', key: 'spiritSoulDelta', currentKey: 'spiritSoul', label: '兽魂', placeholder: '+20 / -5' },
  { group: '灵宠', key: 'ordinarySoulDelta', currentKey: 'ordinarySoul', label: '普通兽魂', placeholder: '+10 / -2' },
  { group: '灵宠', key: 'rareSoulDelta', currentKey: 'rareSoul', label: '稀有兽魂', placeholder: '+5 / -1' },
  { group: '灵宠', key: 'legendarySoulDelta', currentKey: 'legendarySoul', label: '传说兽魂', placeholder: '+1 / -1' },
  { group: '阵营', key: 'contributionDelta', currentKey: 'contributionScore', label: '阵营贡献', placeholder: '+100 / -50' },
];

const resourceAdjustGroups = ['基础', '灵宠', '阵营'] as const;

export function PlayerDetailTables(props: {
  adjustForm: PlayerResourceAdjustFormState;
  adjustBusy?: boolean;
  onAdjustChange: (field: keyof PlayerResourceAdjustFormState, value: string) => void;
  onAdjustSubmit: () => void;
  overview: AdminPlayerOverviewResponse;
}): JSX.Element {
  const [activeTab, setActiveTab] = useState('profile');
  const [selectedSpiritSlotIndex, setSelectedSpiritSlotIndex] = useState<number | null>(null);
  const tabs = [
    { key: 'profile', label: '基础' },
    { key: 'spirit', label: '灵宠' },
    { key: 'farm', label: '田地' },
    { key: 'seed', label: '灵植' },
    { key: 'task', label: '任务' },
  ];
  const plantAccess = props.overview.seedInventory as { items?: AdminRecord[]; unlockedSeedIds?: string[] };
  const spirit = props.overview.spirit as {
    resource: AdminRecord | null;
    mainSlot: AdminRecord | null;
    slots: AdminRecord[];
    codex: AdminRecord[];
  } | undefined;
  const spiritSlots = spirit?.slots ?? [];
  const selectedSpiritSlot =
    spiritSlots.find((slot) => Number(slot.slotIndex) === selectedSpiritSlotIndex)
    ?? spiritSlots.find((slot) => Boolean(slot.isMain))
    ?? spiritSlots[0]
    ?? null;
  const mainSpiritTitle = spirit?.mainSlot
    ? `${formatValue(spirit.mainSlot.label)} / ${formatValue(spirit.mainSlot.spiritId)}`
    : '暂无主战灵宠';
  const contributionScore = Array.isArray(props.overview.identity.factionMembers)
    ? Number((props.overview.identity.factionMembers[0] as AdminRecord | undefined)?.contributionScore ?? 0)
    : 0;
  const currentAdjustValues: Record<string, unknown> = {
    ...(props.overview.resources ?? {}),
    ...(spirit?.resource ?? {}),
    contributionScore,
  };

  return (
    <div className="detail-stack">
      <div className="tab-list" role="tablist" aria-label="玩家基础信息切换">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab.key ? 'tab-button active' : 'tab-button'}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' ? (
        <div className="detail-stack">
          <InfoSection
            title="基础信息"
            rows={recordRows(props.overview.identity, ['playerId', 'nickname', 'faction', 'castleLevel', 'stateVersion', 'createdAt', 'updatedAt', 'lastLoginAt'])}
          />
          <div className="two-column">
            <InfoSection
              title="玩家基础资源"
              rows={recordRows(props.overview.resources, ['playerId', 'gold', 'tianjiTalisman', 'resourceStateVersion', 'spiritResourceStateVersion'])}
            />
            <InfoSection
              title="法术状态"
              rows={recordRows(props.overview.spell, ['playerId', 'protectionTechLevel', 'farmYieldTechLevel', 'collectWindowTechLevel', 'pendingClaimTechLevel', 'spellStateVersion'])}
            />
          </div>
          <section className="panel resource-adjust-panel">
            <div className="panel-head compact resource-adjust-head">
              <div>
                <p className="eyebrow">Admin Adjustment</p>
                <h3>资源修正</h3>
              </div>
              <span className="resource-adjust-badge">只填增减量</span>
            </div>
            <div className="resource-adjust-layout">
              <div className="resource-adjust-groups">
                {resourceAdjustGroups.map((group) => (
                  <div className="resource-adjust-group" key={group}>
                    <div className="resource-adjust-group-title">{group}</div>
                    {resourceAdjustFields.filter((field) => field.group === group).map((field) => (
                      <label className="resource-adjust-row" key={field.key}>
                        <span className="resource-adjust-label">{field.label}</span>
                        <span className="resource-adjust-current">当前 {formatValue(currentAdjustValues[field.currentKey] ?? 0)}</span>
                        <input
                          inputMode="numeric"
                          onChange={(event) => props.onAdjustChange(field.key, event.target.value)}
                          placeholder={field.placeholder}
                          type="number"
                          value={props.adjustForm[field.key]}
                        />
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              <div className="resource-adjust-side">
                <label className="resource-adjust-reason">
                  <span>修正原因</span>
                  <textarea
                    onChange={(event) => props.onAdjustChange('reason', event.target.value)}
                    placeholder="例如：内测补偿、排障回滚、误操作修正"
                    rows={5}
                    value={props.adjustForm.reason}
                  />
                </label>
                <div className="resource-adjust-warning">
                  <strong>审计规则</strong>
                  <span>提交后会写入后台审计；金币同步写钱包流水，阵营贡献同步写贡献流水。</span>
                  <span>输入负数表示扣减，后端会拒绝扣成负数的请求。</span>
                </div>
              </div>
            </div>
            <div className="resource-adjust-footer">
              <span>建议一次只修正一个排障事项，便于之后按审计记录追踪。</span>
              <button
                className="primary-button"
                disabled={Boolean(props.adjustBusy)}
                onClick={props.onAdjustSubmit}
                type="button"
              >
                {props.adjustBusy ? '提交中...' : '提交资源修正'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'spirit' ? (
        <div className="detail-stack">
          <div className="two-column">
            <InfoSection
              title="灵宠资源"
              rows={recordRows(spirit?.resource, ['playerId', 'spiritSoul', 'dailyRecoveryUsed', 'dailyIntelFreeUsed', 'dailyIntelTalismanUsed', 'resourceVersion'])}
            />
            <InfoSection
              title="灵宠配置"
              rows={[
                { label: '主战灵宠', field: 'mainSlot', value: mainSpiritTitle },
                { label: '灵宠槽位', field: 'slots.length', value: spiritSlots.length },
                { label: '当前选中槽位', field: 'selectedSlotIndex', value: selectedSpiritSlot?.slotIndex ?? '-' },
              ]}
            />
          </div>
          <TableSection
            title="灵宠槽位列表"
            columns={[
              { label: '槽位 / slotIndex', key: 'slotIndex' },
              { label: '主战 / isMain', key: 'isMain' },
              { label: '灵宠 / label', key: 'label' },
              { label: '灵宠 ID / spiritId', key: 'spiritId' },
              { label: '稀有度 / rarity', key: 'rarity' },
              { label: '五行 / element', key: 'element' },
              { label: '等级 / level', key: 'level' },
              { label: '生命 / currentHp', key: 'currentHp' },
              { label: '上限 / maxHp', key: 'maxHp' },
              { label: '状态 / status', key: 'status' },
            ]}
            rows={spiritSlots}
            rowAction={(row) => (
              <button
                className="small-button"
                type="button"
                onClick={() => setSelectedSpiritSlotIndex(Number(row.slotIndex))}
              >
                详情
              </button>
            )}
          />
          <InfoSection
            title={`灵宠详情 · ${selectedSpiritSlot ? `槽位 ${formatValue(selectedSpiritSlot.slotIndex)}` : '未选择'}`}
            rows={recordRows(selectedSpiritSlot, [
              'slotIndex',
              'isMain',
              'spiritId',
              'label',
              'rarity',
              'factionAffinity',
              'role',
              'element',
              'level',
              'exp',
              'currentHp',
              'maxHp',
              'status',
              'baseAttack',
              'baseHp',
              'growthAttack',
              'growthHp',
              'shardName',
              'shardUnlockRequired',
              'lore',
              'acquiredAt',
              'dissolvedAt',
              'slotVersion',
              'createdAt',
              'updatedAt',
            ])}
          />
        </div>
      ) : null}

      {activeTab === 'farm' ? (
        <TableSection
          title="田地列表"
          columns={[
            { label: '序号 / slotIndex', key: 'slotIndex' },
            { label: '解锁 / isUnlocked', key: 'isUnlocked' },
            { label: '状态 / status', key: 'status' },
            { label: '灵植 / seedId', key: 'seedId' },
            { label: '可收金币 / currentClaimableGold', key: 'currentClaimableGold' },
            { label: '成熟 / matureAt', key: 'matureAt' },
            { label: '版本 / statusVersion', key: 'statusVersion' },
          ]}
          rows={props.overview.fields}
        />
      ) : null}

      {activeTab === 'seed' ? (
        <TableSection
          title={`灵植资格${plantAccess.unlockedSeedIds?.length ? ` · 已解锁 ${plantAccess.unlockedSeedIds.length}` : ''}`}
          columns={[
            { label: '灵植 ID / seedId', key: 'seedId' },
            { label: '名称 / label', key: 'label' },
            { label: '永久资格 / unlocked', key: 'unlocked' },
            { label: '版本 / inventoryVersion', key: 'inventoryVersion' },
            { label: '解锁时间 / unlockedAt', key: 'unlockedAt' },
          ]}
          rows={plantAccess.items ?? []}
        />
      ) : null}

      {activeTab === 'task' ? (
        <TableSection
          title="每日任务"
          columns={[
            { label: '任务 ID / taskId', key: 'taskId' },
            { label: '进度 / progress', key: 'progress' },
            { label: '目标 / target', key: 'target' },
            { label: '状态 / status', key: 'status' },
            { label: '奖励 / rewardGold', key: 'rewardGold' },
            { label: '领取时间 / claimedAt', key: 'claimedAt' },
          ]}
          rows={props.overview.dailyTasks}
        />
      ) : null}
    </div>
  );
}

export function PlayerRaidContent(props: {
  busy: string;
  playerOverview: AdminPlayerOverviewResponse | null;
  playerOrders: AdminListResponse<AdminRecord> | null;
  summaryPlayerId?: string;
  onPageChange: (page: number) => void;
  onOpenOrder: (orderId: string) => void;
}): JSX.Element {
  const recentReports = props.playerOverview?.recentReports ?? [];

  return (
    <div className="detail-stack">
      {props.summaryPlayerId ? (
        <InfoSection
          title="掠夺摘要"
          rows={[
            { label: '当前玩家', field: 'playerId', value: props.summaryPlayerId },
            { label: '订单总数', field: 'pagination.total', value: props.playerOrders?.pagination.total ?? 0 },
            { label: '最近战报数', field: 'recentReports.length', value: recentReports.length },
          ]}
        />
      ) : null}

      <TableSection
        title="掠夺订单"
        columns={[
          { label: '订单 ID / orderId', key: 'orderId' },
          { label: '状态 / status', key: 'status' },
          { label: '攻击方 / attackerPlayerId', key: 'attackerPlayerId' },
          { label: '防守方 / defenderPlayerId', key: 'defenderPlayerId' },
          { label: '出征战力 / dispatchedUnitCount', key: 'dispatchedUnitCount' },
          { label: '预计结算 / settleAt', key: 'settleAt' },
          { label: '创建时间 / createdAt', key: 'createdAt' },
        ]}
        rows={props.playerOrders?.items ?? []}
        rowAction={(row) => (
          <button className="small-button" type="button" onClick={() => props.onOpenOrder(String(row.orderId))}>
            查订单
          </button>
        )}
        pagination={props.playerOrders?.pagination ?? null}
        paginationBusy={props.busy === 'player-raid'}
        onPageChange={props.onPageChange}
      />

      <TableSection
        title="最近战报"
        columns={[
          { label: '标题 / title', key: 'title' },
          { label: '类型 / reportType', key: 'reportType' },
          { label: '结果 / result', key: 'result' },
          { label: '对手 / opponentPlayerId', key: 'opponentPlayerId' },
          { label: '摘要 / summary', key: 'summary' },
          { label: '时间 / createdAt', key: 'createdAt' },
        ]}
        rows={recentReports}
      />
    </div>
  );
}
