import { useState } from 'react';
import type { AdminListResponse, AdminPlayerOverviewResponse, AdminPlayerSearchResponse } from '@trinitywar/shared';
import { DataTable } from '../components/DataTable';
import { InfoSection } from '../components/InfoSection';
import { PaginationBar } from '../components/PaginationBar';
import { SearchPanel } from '../components/SearchPanel';
import { TableSection } from '../components/TableSection';
import { formatValue, recordRows } from '../domain/labels';
import type { AdminRecord } from '../types';

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

export function PlayerDetailTables(props: { overview: AdminPlayerOverviewResponse }): JSX.Element {
  const [activeTab, setActiveTab] = useState('profile');
  const [selectedSpiritSlotIndex, setSelectedSpiritSlotIndex] = useState<number | null>(null);
  const tabs = [
    { key: 'profile', label: '基础' },
    { key: 'spirit', label: '灵宠' },
    { key: 'farm', label: '田地' },
    { key: 'seed', label: '种子' },
    { key: 'task', label: '任务' },
  ];
  const seedInventory = props.overview.seedInventory as { items?: AdminRecord[]; unlockedSeedIds?: string[] };
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
              title="钱包状态"
              rows={recordRows(props.overview.wallet, ['playerId', 'vaultGold', 'walletGold', 'walletProtectedRatio', 'balanceVersion'])}
            />
            <InfoSection
              title="法术状态"
              rows={recordRows(props.overview.building, ['playerId', 'protectionTechLevel', 'farmYieldTechLevel', 'ripeWindowTechLevel', 'buildingVersion'])}
            />
          </div>
        </div>
      ) : null}

      {activeTab === 'spirit' ? (
        <div className="detail-stack">
          <div className="two-column">
            <InfoSection
              title="灵宠资源"
              rows={recordRows(spirit?.resource, ['playerId', 'spiritSoul', 'tianjiTalisman', 'dailyRecoveryUsed', 'dailyIntelFreeUsed', 'dailyIntelTalismanUsed', 'resourceVersion'])}
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
              'baseDefense',
              'baseHp',
              'growthAttack',
              'growthDefense',
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
            { label: '种子 / seedId', key: 'seedId' },
            { label: '可收金币 / currentClaimableGold', key: 'currentClaimableGold' },
            { label: '成熟 / matureAt', key: 'matureAt' },
            { label: '版本 / statusVersion', key: 'statusVersion' },
          ]}
          rows={props.overview.fields}
        />
      ) : null}

      {activeTab === 'seed' ? (
        <TableSection
          title={`种子库存${seedInventory.unlockedSeedIds?.length ? ` · 已解锁 ${seedInventory.unlockedSeedIds.length}` : ''}`}
          columns={[
            { label: '种子 ID / seedId', key: 'seedId' },
            { label: '名称 / label', key: 'label' },
            { label: '数量 / quantity', key: 'quantity' },
            { label: '版本 / inventoryVersion', key: 'inventoryVersion' },
            { label: '解锁时间 / unlockedAt', key: 'unlockedAt' },
          ]}
          rows={seedInventory.items ?? []}
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

