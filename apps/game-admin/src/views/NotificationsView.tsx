import { useState } from 'react';
import type { AdminCreateNotificationResponse, AdminListResponse, AdminNotificationHistoryItem, AdminPlayerNotificationItem, NotificationAttachment } from '@trinitywar/shared';
import { NotificationComposer, type AdminNotificationFormState, notificationCategoryOptions } from '../components/NotificationComposer';
import { EmptyState } from '../components/EmptyState';
import { TableSection } from '../components/TableSection';

type NotificationTabKey = 'all-players' | 'specific-player' | 'send-result' | 'player-history';

function formatAttachments(items: NotificationAttachment[]): string {
  return items.length > 0 ? items.map((item) => `${item.label} x${item.quantity}`).join('、') : '无';
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '无';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function NotificationsView(props: {
  busy: string;
  globalForm: AdminNotificationFormState;
  history: AdminListResponse<AdminNotificationHistoryItem> | null;
  lastResult: AdminCreateNotificationResponse | null;
  playerForm: AdminNotificationFormState;
  playerHistory: AdminListResponse<AdminPlayerNotificationItem> | null;
  playerHistoryPlayerId: string;
  seedOptions: Array<{ value: string; label: string }>;
  onGlobalAttachmentChange: (index: number, field: 'kind' | 'quantity' | 'seedId', value: string) => void;
  onGlobalChange: (field: keyof AdminNotificationFormState, value: string) => void;
  onGlobalAddAttachment: () => void;
  onGlobalRemoveAttachment: (index: number) => void;
  onHistoryPageChange: (page: number) => void;
  onLoadPlayerHistory: () => void;
  onPlayerAttachmentChange: (index: number, field: 'kind' | 'quantity' | 'seedId', value: string) => void;
  onPlayerChange: (field: keyof AdminNotificationFormState, value: string) => void;
  onPlayerHistoryIdChange: (value: string) => void;
  onPlayerHistoryPageChange: (page: number) => void;
  onPlayerAddAttachment: () => void;
  onPlayerRemoveAttachment: (index: number) => void;
  onSendGlobal: () => void;
  onSendPlayer: () => void;
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<NotificationTabKey>('all-players');
  const lastResult = props.lastResult;

  const tabs: Array<{ key: NotificationTabKey; label: string; description: string }> = [
    { key: 'all-players', label: '所有玩家', description: '全员通告和全服补发独立处理，不和单玩家发奖混在同一块。' },
    { key: 'specific-player', label: '指定玩家', description: '只处理单玩家消息和单玩家发奖。' },
    { key: 'send-result', label: '发送结果', description: '查看最近一次发送结果和系统通知记录。' },
    { key: 'player-history', label: '玩家消息记录', description: '按玩家查询站内信、附件和领取状态。' },
  ];

  const historyRows = props.history?.items.map((item) => ({
    ...item,
    audience: item.audience === 'global' ? '全服' : '单玩家',
    category: notificationCategoryOptions.find((option) => option.value === item.category)?.label ?? item.category,
    createdAt: formatDateTime(item.createdAt),
  })) ?? [];

  const playerHistoryRows = props.playerHistory?.items.map((item) => ({
    ...item,
    category: notificationCategoryOptions.find((option) => option.value === item.category)?.label ?? item.category,
    attachments: formatAttachments(item.attachments),
    readAt: formatDateTime(item.readAt),
    createdAt: formatDateTime(item.createdAt),
    claimStatus: item.claimStatus === 'unclaimed' ? '待领取' : item.claimStatus === 'claimed' ? '已领取' : item.claimStatus === 'expired' ? '已过期' : '无附件',
  })) ?? [];

  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-head compact">
          <h3>系统通知</h3>
          <span className="result-count">把全员通告、指定玩家发奖、结果回执和玩家消息记录拆开管理</span>
        </div>
        <div className="tab-list" role="tablist" aria-label="系统通知导航">
          {tabs.map((tab) => (
            <button
              className={`tab-button${activeTab === tab.key ? ' active' : ''}`}
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'all-players' ? (
        <section className="panel">
          <div className="notification-tab-panel">
            <div className="notification-tab-copy">
              <h4>所有玩家</h4>
              <p>{tabs.find((tab) => tab.key === 'all-players')?.description}</p>
            </div>
            <NotificationComposer
              actionLabel="发送全服通知"
              busy={props.busy === 'notification-global'}
              eyebrow="全员通告"
              form={props.globalForm}
              onAddAttachment={props.onGlobalAddAttachment}
              onAttachmentChange={props.onGlobalAttachmentChange}
              onChange={props.onGlobalChange}
              onRemoveAttachment={props.onGlobalRemoveAttachment}
              onSubmit={props.onSendGlobal}
              seedOptions={props.seedOptions}
              submitBusyLabel="发送中..."
              title="广播给当前所有玩家"
            />
          </div>
        </section>
      ) : null}

      {activeTab === 'specific-player' ? (
        <section className="panel">
          <div className="notification-tab-panel">
            <div className="notification-tab-copy">
              <h4>指定玩家</h4>
              <p>{tabs.find((tab) => tab.key === 'specific-player')?.description}</p>
            </div>
            <NotificationComposer
              actionLabel="发送单玩家通知"
              busy={props.busy === 'notification-player'}
              eyebrow="指定玩家"
              form={props.playerForm}
              onAddAttachment={props.onPlayerAddAttachment}
              onAttachmentChange={props.onPlayerAttachmentChange}
              onChange={props.onPlayerChange}
              onRemoveAttachment={props.onPlayerRemoveAttachment}
              onSubmit={props.onSendPlayer}
              seedOptions={props.seedOptions}
              showPlayerId
              submitBusyLabel="发送中..."
              title="发给指定玩家，可单独发奖"
            />
          </div>
        </section>
      ) : null}

      {activeTab === 'send-result' ? (
        <div className="notification-tab-section">
          <section className="panel notification-subpanel">
            <div className="notification-tab-copy">
              <h4>发送结果</h4>
              <p>{tabs.find((tab) => tab.key === 'send-result')?.description}</p>
            </div>
            <div className="panel-head compact">
              <h3>最近一次发送结果</h3>
            </div>
            {lastResult ? (
              <div className="notification-result-grid">
                <div><span>通知 ID</span><strong>{lastResult.notificationId}</strong></div>
                <div><span>范围</span><strong>{lastResult.audience === 'global' ? '全服' : '单玩家'}</strong></div>
                <div><span>分类</span><strong>{notificationCategoryOptions.find((option) => option.value === lastResult.category)?.label ?? lastResult.category}</strong></div>
                <div><span>投递人数</span><strong>{lastResult.playerCount}</strong></div>
                <div><span>附件数</span><strong>{lastResult.attachmentCount}</strong></div>
                <div><span>创建时间</span><strong>{formatDateTime(lastResult.createdAt)}</strong></div>
                <div><span>过期时间</span><strong>{formatDateTime(lastResult.expiresAt)}</strong></div>
              </div>
            ) : <EmptyState text="发送后会在这里显示结果。" />}
          </section>

          <TableSection
            title="通知记录"
            columns={[
              { label: '标题 / title', key: 'title' },
              { label: '范围 / audience', key: 'audience' },
              { label: '分类 / category', key: 'category' },
              { label: '投递人数 / playerCount', key: 'playerCount' },
              { label: '附件数 / attachmentCount', key: 'attachmentCount' },
              { label: '创建时间 / createdAt', key: 'createdAt' },
            ]}
            rows={historyRows}
            pagination={props.history?.pagination ?? null}
            paginationBusy={props.busy === 'notification-history'}
            onPageChange={props.onHistoryPageChange}
          />
        </div>
      ) : null}

      {activeTab === 'player-history' ? (
        <section className="panel notification-subpanel">
          <div className="notification-tab-panel">
            <div className="notification-tab-copy">
              <h4>玩家消息记录</h4>
              <p>{tabs.find((tab) => tab.key === 'player-history')?.description}</p>
            </div>
            <div className="inline-form lookup-form">
              <input onChange={(event) => props.onPlayerHistoryIdChange(event.target.value)} placeholder="输入玩家 ID" value={props.playerHistoryPlayerId} />
              <button className="primary-button" disabled={props.busy === 'notification-player-history'} onClick={props.onLoadPlayerHistory} type="button">查询</button>
            </div>
            <div className="notification-history-table">
              <TableSection
                title="玩家消息"
                columns={[
                  { label: '标题 / title', key: 'title' },
                  { label: '分类 / category', key: 'category' },
                  { label: '附件 / attachments', key: 'attachments' },
                  { label: '领取状态 / claimStatus', key: 'claimStatus' },
                  { label: '已读时间 / readAt', key: 'readAt' },
                  { label: '创建时间 / createdAt', key: 'createdAt' },
                ]}
                rows={playerHistoryRows}
                pagination={props.playerHistory?.pagination ?? null}
                paginationBusy={props.busy === 'notification-player-history'}
                onPageChange={props.onPlayerHistoryPageChange}
              />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
