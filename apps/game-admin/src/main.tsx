import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  APP_NAME,
  type AdminCreateNotificationResponse,
  type AdminAdjustPlayerResourcesResponse,
  type AdminDeletePlayerResponse,
  type AdminListResponse,
  type AdminNotificationHistoryItem,
  type AdminOverviewResponse,
  type AdminPlayerOverviewResponse,
  type AdminPlayerNotificationItem,
  type AdminPlayerSearchResponse,
  type AdminRaidOrderDetailResponse,
  type AdminRobotDashboardResponse,
  type AdminSystemStatusResponse,
} from '@trinitywar/shared';
import { API_BASE, DEBUG_KEY, adminFetch, jsonRequest } from './api/admin';
import { NotificationComposer, createEmptyNotificationForm, type AdminNotificationAttachmentDraft, type AdminNotificationFormState } from './components/NotificationComposer';
import { EmptyState } from './components/EmptyState';
import { Modal } from './components/Modal';
import { buildConfigPayload, createConfigFormFromRecord, createEmptyConfigForm, seedConfigFields, spiritConfigFields, taskConfigFields } from './domain/config';
import { formatValue } from './domain/labels';
import { navItems } from './domain/navigation';
import { CastleLevelsView } from './views/CastleLevelsView';
import { DashboardView } from './views/DashboardView';
import { OrderView } from './views/OrderView';
import { NotificationsView } from './views/NotificationsView';
import { PlayerDetailTables, PlayerInfoView, PlayerRaidContent } from './views/PlayerInfoView';
import { SeedConfigView } from './views/SeedConfigView';
import { ShareAssistView } from './views/ShareAssistView';
import { SpiritConfigView } from './views/SpiritConfigView';
import { SystemView } from './views/SystemView';
import { TaskConfigView, type TaskConfigGroup } from './views/TaskConfigView';
import { SeasonView } from './views/SeasonView';
import { RobotTestView } from './views/RobotTestView';
import { TableSection } from './components/TableSection';
import type { AdminRecord, ModuleKey, PlayerModal } from './types';
import type { PlayerResourceAdjustFormState } from './types';
import './styles.css';

const PLAYER_SEARCH_PAGE_SIZE = 10;
const PLAYER_RAID_PAGE_SIZE = 10;
const ATTACHMENT_NOTIFICATION_CONFIRM_TEXT = 'SEND_ATTACHMENT_NOTIFICATION';
const ROBOT_SEASON_FACTION_RULE_SET = 'v0.2';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

type RobotDashboardViewModel = AdminRobotDashboardResponse & {
  rule: Record<string, unknown>;
  status: Record<string, unknown>;
  errorSummary: {
    items: AdminRecord[];
    exportMarkdown: string;
  };
};

const createEmptyResourceAdjustForm = (): PlayerResourceAdjustFormState => ({
  reason: '',
  goldDelta: '',
  tianjiTalismanDelta: '',
  spiritSoulDelta: '',
  ordinarySoulDelta: '',
  rareSoulDelta: '',
  legendarySoulDelta: '',
  contributionDelta: '',
});

function App(): JSX.Element {
  const [activeModule, setActiveModule] = useState<ModuleKey>('player');
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [status, setStatus] = useState<AdminSystemStatusResponse | null>(null);
  const [keyword, setKeyword] = useState('');
  const [searchResult, setSearchResult] = useState<AdminPlayerSearchResponse | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [playerOverview, setPlayerOverview] = useState<AdminPlayerOverviewResponse | null>(null);
  const [resourceAdjustForm, setResourceAdjustForm] = useState<PlayerResourceAdjustFormState>(() => createEmptyResourceAdjustForm());
  const [playerOrders, setPlayerOrders] = useState<AdminListResponse<AdminRecord> | null>(null);
  const [playerOrdersOwnerId, setPlayerOrdersOwnerId] = useState('');
  const [activeModal, setActiveModal] = useState<PlayerModal>(null);
  const [quickSendPlayer, setQuickSendPlayer] = useState<{ playerId: string; nickname: string } | null>(null);
  const [orderId, setOrderId] = useState('');
  const [orderDetail, setOrderDetail] = useState<AdminRaidOrderDetailResponse | null>(null);
  const [globalNotificationForm, setGlobalNotificationForm] = useState<AdminNotificationFormState>(() => createEmptyNotificationForm());
  const [playerNotificationForm, setPlayerNotificationForm] = useState<AdminNotificationFormState>(() => createEmptyNotificationForm());
  const [quickNotificationForm, setQuickNotificationForm] = useState<AdminNotificationFormState>(() => createEmptyNotificationForm());
  const [lastNotificationResult, setLastNotificationResult] = useState<AdminCreateNotificationResponse | null>(null);
  const [notificationHistory, setNotificationHistory] = useState<AdminListResponse<AdminNotificationHistoryItem> | null>(null);
  const [playerNotificationHistory, setPlayerNotificationHistory] = useState<AdminListResponse<AdminPlayerNotificationItem> | null>(null);
  const [playerNotificationHistoryPlayerId, setPlayerNotificationHistoryPlayerId] = useState('');
  const [shareAssistCampaigns, setShareAssistCampaigns] = useState<AdminListResponse<AdminRecord> | null>(null);
  const [shareAssistRecords, setShareAssistRecords] = useState<AdminListResponse<AdminRecord> | null>(null);
  const [shareInviteRelations, setShareInviteRelations] = useState<AdminListResponse<AdminRecord> | null>(null);
  const [currentSeason, setCurrentSeason] = useState<AdminRecord | null>(null);
  const [seasons, setSeasons] = useState<AdminListResponse<AdminRecord> | null>(null);
  const [seasonPlayerSnapshots, setSeasonPlayerSnapshots] = useState<AdminListResponse<AdminRecord> | null>(null);
  const [seasonFactionSnapshots, setSeasonFactionSnapshots] = useState<AdminListResponse<AdminRecord> | null>(null);
  const [seasonRewardSummary, setSeasonRewardSummary] = useState<AdminRecord | null>(null);
  const [seasonRewardGrants, setSeasonRewardGrants] = useState<AdminListResponse<AdminRecord> | null>(null);
  const [seasonAchievements, setSeasonAchievements] = useState<AdminListResponse<AdminRecord> | null>(null);
  const [seasonPlayerHistory, setSeasonPlayerHistory] = useState<AdminListResponse<AdminRecord> | null>(null);
  const [seasonPlayerHistoryId, setSeasonPlayerHistoryId] = useState('');
  const [seasonPlayerRewardHistory, setSeasonPlayerRewardHistory] = useState<AdminListResponse<AdminRecord> | null>(null);
  const [seasonRewardPreview, setSeasonRewardPreview] = useState<AdminRecord | null>(null);
  const [seasonPlayerRewardSeasonNumber, setSeasonPlayerRewardSeasonNumber] = useState('');
  const [seedDefinitions, setSeedDefinitions] = useState<AdminListResponse<AdminRecord> | null>(null);
  const [seedForm, setSeedForm] = useState<Record<string, string>>(() => createEmptyConfigForm(seedConfigFields));
  const [editingSeedId, setEditingSeedId] = useState('');
  const [isSeedEditorOpen, setIsSeedEditorOpen] = useState(false);
  const [spiritDefinitions, setSpiritDefinitions] = useState<AdminListResponse<AdminRecord> | null>(null);
  const [spiritForm, setSpiritForm] = useState<Record<string, string>>(() => createEmptyConfigForm(spiritConfigFields));
  const [editingSpiritId, setEditingSpiritId] = useState('');
  const [isSpiritEditorOpen, setIsSpiritEditorOpen] = useState(false);
  const [taskDefinitions, setTaskDefinitions] = useState<AdminListResponse<AdminRecord> | null>(null);
  const [taskGroup, setTaskGroup] = useState<TaskConfigGroup>('contribution');
  const [taskForm, setTaskForm] = useState<Record<string, string>>(() => createEmptyConfigForm(taskConfigFields));
  const [editingTaskId, setEditingTaskId] = useState('');
  const [editingTaskGroup, setEditingTaskGroup] = useState<TaskConfigGroup>('contribution');
  const [isTaskEditorOpen, setIsTaskEditorOpen] = useState(false);
  const [castleLevels, setCastleLevels] = useState<AdminListResponse<AdminRecord> | null>(null);
  const [lightweightRuleTab, setLightweightRuleTab] = useState<'faction-stipend'>('faction-stipend');
  const [auditLogs, setAuditLogs] = useState<AdminListResponse<AdminRecord> | null>(null);
  const [auditTargetId, setAuditTargetId] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [robotDashboard, setRobotDashboard] = useState<RobotDashboardViewModel | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selectedPlayer = useMemo(
    () => searchResult?.items.find((item) => item.playerId === selectedPlayerId) ?? null,
    [searchResult, selectedPlayerId],
  );
  const selectedPlayerTitle = selectedPlayer?.nickname ?? playerOverview?.identity.nickname ?? selectedPlayerId;

  useEffect(() => {
    void refreshShell();
    void handleSearch(1);
  }, []);

  useEffect(() => {
    if (activeModule === 'seedConfig' && !seedDefinitions) {
      void loadSeedDefinitions();
    }
    if (activeModule === 'notifications' && !notificationHistory) {
      void loadNotificationHistory();
    }
    if (activeModule === 'notifications' && !seedDefinitions) {
      void loadSeedDefinitions();
    }
    if (activeModule === 'shareAssist' && (!shareAssistCampaigns || !shareAssistRecords || !shareInviteRelations)) {
      void loadShareAssistDashboard();
    }
    if (activeModule === 'season' && (!currentSeason || !seasons)) {
      void loadSeasonDashboard();
    }
    if (activeModule === 'spiritConfig' && !spiritDefinitions) {
      void loadSpiritDefinitions();
    }
    if (activeModule === 'taskConfig' && !taskDefinitions) {
      void loadTaskDefinitions();
    }
    if (activeModule === 'castleLevels' && !castleLevels) {
      void loadCastleLevels();
    }
    if (activeModule === 'system' && !auditLogs) {
      void loadAuditLogs();
    }
    if (activeModule === 'robotTest' && !robotDashboard) {
      void loadRobotDashboard();
    }
  }, [activeModule]);

  useEffect(() => {
    if (!activeModal) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setActiveModal(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal]);

  const run = async <T,>(label: string, request: () => Promise<T>): Promise<T | null> => {
    setBusy(label);
    setError(null);
    try {
      return await request();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '请求失败');
      return null;
    } finally {
      setBusy('');
    }
  };

  const refreshShell = async (): Promise<void> => {
    const [nextOverview, nextStatus] = await Promise.all([
      adminFetch<AdminOverviewResponse>('/overview'),
      adminFetch<AdminSystemStatusResponse>('/system/status'),
    ]).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : '后台概览请求失败');
      return [null, null] as const;
    });

    setOverview(nextOverview);
    setStatus(nextStatus);
  };

  const loadAuditLogs = async (page = auditLogs?.pagination.page ?? 1): Promise<void> => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '10',
    });
    const normalizedTargetId = auditTargetId.trim();
    const normalizedAction = auditAction.trim();
    if (normalizedTargetId) {
      params.set('targetId', normalizedTargetId);
    }
    if (normalizedAction) {
      params.set('action', normalizedAction);
    }

    const result = await run('audit-logs', () => adminFetch<AdminListResponse<AdminRecord>>(`/audit-logs?${params.toString()}`));
    if (result) {
      setAuditLogs(result);
    }
  };

  const loadRobotDashboard = async (): Promise<void> => {
    const result = await run('robot-dashboard', () => adminFetch<RobotDashboardViewModel>('/robots/dashboard'));
    if (result) {
      setRobotDashboard(result);
    }
  };

  const runRobotDaily3 = async (): Promise<void> => {
    const result = await run('robot-daily-3', () => adminFetch<AdminRecord>('/robots/daily-3', jsonRequest('POST', {})));
    if (result) {
      await loadRobotDashboard();
    }
  };

  const runRobotSocial3 = async (): Promise<void> => {
    const result = await run('robot-social-3', () => adminFetch<AdminRecord>('/robots/social-3', jsonRequest('POST', {})));
    if (result) {
      await loadRobotDashboard();
    }
  };

  const runRobotPlayerSimV1 = async (): Promise<void> => {
    const result = await run('robot-player-sim-v1', () => adminFetch<AdminRecord>('/robots/player-sim-v1', jsonRequest('POST', {})));
    if (result) {
      await loadRobotDashboard();
    }
  };

  const runRobotSeasonSimV1Day = async (): Promise<void> => {
    const result = await run('robot-season-day', () => adminFetch<AdminRecord>('/robots/season-sim-v1/day', jsonRequest('POST', {
      actionDelayMs: 250,
      factionRuleSet: ROBOT_SEASON_FACTION_RULE_SET,
    })));
    if (result) {
      await loadRobotDashboard();
    }
  };

  const startRobotDaily3Loop = async (input: { intervalSeconds: number; maxRounds: number; hardErrorLimit: number }): Promise<void> => {
    const result = await run('robot-loop-start', () => adminFetch<AdminRecord>('/robots/daily-3/loop/start', jsonRequest('POST', input)));
    if (result) {
      await loadRobotDashboard();
    }
  };

  const startRobotSocial3Loop = async (input: { intervalSeconds: number; maxRounds: number; hardErrorLimit: number }): Promise<void> => {
    const result = await run('robot-loop-start', () => adminFetch<AdminRecord>('/robots/social-3/loop/start', jsonRequest('POST', input)));
    if (result) {
      await loadRobotDashboard();
    }
  };

  const startRobotPlayerSimV1Loop = async (input: { intervalSeconds: number; maxRounds: number; hardErrorLimit: number }): Promise<void> => {
    const result = await run('robot-loop-start', () => adminFetch<AdminRecord>('/robots/player-sim-v1/loop/start', jsonRequest('POST', input)));
    if (result) {
      await loadRobotDashboard();
    }
  };

  const startRobotSeasonSimV1Loop = async (input: { intervalSeconds: number; totalDays: number; actionDelayMs?: number }): Promise<void> => {
    const result = await run('robot-season-loop-start', () => adminFetch<AdminRecord>('/robots/season-sim-v1/loop/start', jsonRequest('POST', {
      ...input,
      factionRuleSet: ROBOT_SEASON_FACTION_RULE_SET,
    })));
    if (result) {
      await loadRobotDashboard();
    }
  };

  const saveRobotDaily3AutomationConfig = async (input: {
    enabled: boolean;
    intervalSeconds: number;
    maxRounds: number;
    hardErrorLimit: number;
    autoStartOnBoot: boolean;
  }): Promise<void> => {
    const result = await run('robot-config-save', () => adminFetch<AdminRecord>('/robots/daily-3/automation-config', jsonRequest('PATCH', input)));
    if (result) {
      await loadRobotDashboard();
    }
  };

  const saveRobotSocial3AutomationConfig = async (input: {
    enabled: boolean;
    intervalSeconds: number;
    maxRounds: number;
    hardErrorLimit: number;
    autoStartOnBoot: boolean;
  }): Promise<void> => {
    const result = await run('robot-config-save', () => adminFetch<AdminRecord>('/robots/social-3/automation-config', jsonRequest('PATCH', input)));
    if (result) {
      await loadRobotDashboard();
    }
  };

  const saveRobotPlayerSimV1AutomationConfig = async (input: {
    enabled: boolean;
    intervalSeconds: number;
    maxRounds: number;
    hardErrorLimit: number;
    autoStartOnBoot: boolean;
  }): Promise<void> => {
    const result = await run('robot-config-save', () => adminFetch<AdminRecord>('/robots/player-sim-v1/automation-config', jsonRequest('PATCH', input)));
    if (result) {
      await loadRobotDashboard();
    }
  };

  const stopRobotDaily3Loop = async (): Promise<void> => {
    const result = await run('robot-loop-stop', () => adminFetch<AdminRecord>('/robots/daily-3/loop/stop', jsonRequest('POST', {})));
    if (result) {
      await loadRobotDashboard();
    }
  };

  const stopRobotSeasonSimV1Loop = async (): Promise<void> => {
    const result = await run('robot-season-loop-stop', () => adminFetch<AdminRecord>('/robots/season-sim-v1/loop/stop', jsonRequest('POST', {})));
    if (result) {
      await loadRobotDashboard();
    }
  };

  const clearRobotErrors = async (): Promise<void> => {
    if (!window.confirm('确认清空机器人历史错误？成功动作日志会保留。')) {
      return;
    }
    const result = await run('robot-clear-errors', () => adminFetch<AdminRecord>('/robots/errors', jsonRequest('DELETE', {})));
    if (result) {
      await loadRobotDashboard();
    }
  };

  const exportRobotErrors = async (): Promise<void> => {
    const markdown = robotDashboard?.errorSummary.exportMarkdown ?? '';
    if (!markdown.trim()) {
      setError('当前没有可导出的机器人问题。');
      return;
    }

    try {
      await navigator.clipboard.writeText(markdown);
      setError(null);
      window.alert('问题报告已复制。');
    } catch {
      const popup = window.open('', '_blank');
      popup?.document.write(`<pre>${escapeHtml(markdown)}</pre>`);
      popup?.document.close();
    }
  };

  const handleSearch = async (page = 1): Promise<void> => {
    const normalizedKeyword = keyword.trim();
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PLAYER_SEARCH_PAGE_SIZE),
    });
    if (normalizedKeyword) {
      params.set('keyword', normalizedKeyword);
    }
    const result = await run('search', () => adminFetch<AdminPlayerSearchResponse>(`/players/search?${params.toString()}`));
    if (!result) {
      return;
    }

    setSearchResult(result);
    setSelectedPlayerId(result.items[0]?.playerId ?? '');
    setPlayerOverview(null);
    setPlayerOrders(null);
    setPlayerOrdersOwnerId('');
  };

  const handleLoadPlayer = async (playerId = selectedPlayerId): Promise<void> => {
    if (!playerId) {
      setError('请选择玩家。');
      return;
    }

    const result = await run('player', () => adminFetch<AdminPlayerOverviewResponse>(`/players/${encodeURIComponent(playerId)}/overview`));
    if (!result) {
      return;
    }

    setSelectedPlayerId(playerId);
    setPlayerOverview(result);
  };

  const patchResourceAdjustForm = (field: keyof PlayerResourceAdjustFormState, value: string): void => {
    setResourceAdjustForm((current) => ({ ...current, [field]: value }));
  };

  const buildResourceAdjustPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      reason: resourceAdjustForm.reason.trim(),
    };
    for (const key of Object.keys(resourceAdjustForm) as Array<keyof PlayerResourceAdjustFormState>) {
      if (key === 'reason') {
        continue;
      }
      const value = resourceAdjustForm[key].trim();
      if (value) {
        payload[key] = Number(value);
      }
    }
    return payload;
  };

  const submitResourceAdjust = async (): Promise<void> => {
    const playerId = playerOverview?.identity.playerId ? String(playerOverview.identity.playerId) : selectedPlayerId;
    if (!playerId) {
      setError('请选择玩家。');
      return;
    }
    const payload = buildResourceAdjustPayload();
    const deltaCount = Object.keys(payload).filter((key) => key.endsWith('Delta')).length;
    if (deltaCount <= 0) {
      setError('请至少填写一个资源增减量。');
      return;
    }
    if (!String(payload.reason ?? '').trim()) {
      setError('请填写资源修正原因。');
      return;
    }
    if (!window.confirm(`确认修正玩家资源？\n${playerId}\n本操作会写入后台审计。`)) {
      return;
    }

    const result = await run('player-resource-adjust', () => adminFetch<AdminAdjustPlayerResourcesResponse>(`/players/${encodeURIComponent(playerId)}/resources/adjust`, jsonRequest('POST', payload)));
    if (!result) {
      return;
    }

    setResourceAdjustForm(createEmptyResourceAdjustForm());
    await handleLoadPlayer(playerId);
  };

  const handleLoadPlayerRaid = async (playerId = selectedPlayerId, page = 1): Promise<void> => {
    if (!playerId) {
      setError('请选择玩家。');
      return;
    }

    const params = new URLSearchParams({
      type: 'raid',
      page: String(page),
      pageSize: String(PLAYER_RAID_PAGE_SIZE),
    });
    const result = await run('player-raid', () => adminFetch<AdminListResponse<AdminRecord>>(`/players/${encodeURIComponent(playerId)}/orders?${params.toString()}`));
    if (!result) {
      return;
    }

    setSelectedPlayerId(playerId);
    setPlayerOrders(result);
    setPlayerOrdersOwnerId(playerId);
  };

  const handleDeletePlayer = async (playerId: string): Promise<void> => {
    const confirmed = window.confirm(`确认删除玩家账号信息？\n${playerId}\n此操作会清理该玩家的关联后台数据。`);
    if (!confirmed) {
      return;
    }

    const result = await run('delete-player', () => adminFetch<AdminDeletePlayerResponse>(`/players/${encodeURIComponent(playerId)}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reason: `Delete player ${playerId} from admin console.`,
        confirmText: playerId,
      }),
    }));
    if (!result) {
      return;
    }

    if (activeModal?.playerId === playerId) {
      setActiveModal(null);
    }
    if (selectedPlayerId === playerId) {
      setSelectedPlayerId('');
      setPlayerOverview(null);
      setPlayerOrders(null);
      setPlayerOrdersOwnerId('');
    }

    const currentPage = searchResult?.pagination.page ?? 1;
    const shouldMoveBack = (searchResult?.items.length ?? 0) <= 1 && currentPage > 1;
    await handleSearch(shouldMoveBack ? currentPage - 1 : currentPage);
  };

  const handleLoadOrder = async (nextOrderId = orderId): Promise<void> => {
    const normalizedOrderId = nextOrderId.trim();
    if (!normalizedOrderId) {
      setError('请输入订单 ID。');
      return;
    }

    const result = await run('order', () => adminFetch<AdminRaidOrderDetailResponse>(`/raid/orders/${encodeURIComponent(normalizedOrderId)}`));
    if (result) {
      setOrderId(normalizedOrderId);
      setOrderDetail(result);
    }
  };

  const openPlayerInfoModal = (playerId: string): void => {
    setSelectedPlayerId(playerId);
    setActiveModal({ type: 'info', playerId });
    void handleLoadPlayer(playerId);
  };

  const openPlayerRaidModal = (playerId: string): void => {
    setSelectedPlayerId(playerId);
    setActiveModal({ type: 'raid', playerId });
    void handleLoadPlayerRaid(playerId, 1);
    void handleLoadPlayer(playerId);
  };

  const openOrderFromTable = (nextOrderId: string): void => {
    setOrderId(nextOrderId);
    setActiveModal(null);
    setActiveModule('order');
    void handleLoadOrder(nextOrderId);
  };

  const patchNotificationForm = (
    setter: React.Dispatch<React.SetStateAction<AdminNotificationFormState>>,
    field: keyof AdminNotificationFormState,
    value: string,
  ): void => {
    setter((current) => ({ ...current, [field]: value }));
  };

  const patchNotificationAttachment = (
    setter: React.Dispatch<React.SetStateAction<AdminNotificationFormState>>,
    index: number,
    field: keyof AdminNotificationAttachmentDraft,
    value: string,
  ): void => {
    setter((current) => ({
      ...current,
      attachments: current.attachments.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }));
  };

  const appendNotificationAttachment = (setter: React.Dispatch<React.SetStateAction<AdminNotificationFormState>>): void => {
    setter((current) => ({
      ...current,
      attachments: [...current.attachments, { kind: 'gold', quantity: '1' }],
    }));
  };

  const removeNotificationAttachment = (setter: React.Dispatch<React.SetStateAction<AdminNotificationFormState>>, index: number): void => {
    setter((current) => ({
      ...current,
      attachments: current.attachments.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const hasNotificationAttachments = (form: AdminNotificationFormState): boolean => form.attachments.length > 0;

  const buildNotificationPayload = (form: AdminNotificationFormState, reason?: string): Record<string, unknown> => {
    const attachments = form.attachments.map((item) => ({
      kind: item.kind,
      quantity: Number(item.quantity),
    }));

    return {
      title: form.title.trim() || undefined,
      body: form.body.trim() || undefined,
      category: form.category,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      attachments,
      ...(attachments.length > 0 ? {
        reason: reason ?? 'Send notification attachments from admin console.',
        confirmText: ATTACHMENT_NOTIFICATION_CONFIRM_TEXT,
      } : {}),
    };
  };

  const loadNotificationHistory = async (page = notificationHistory?.pagination.page ?? 1): Promise<void> => {
    const result = await run('notification-history', () => adminFetch<AdminListResponse<AdminNotificationHistoryItem>>(`/notifications?page=${page}&pageSize=10`));
    if (result) {
      setNotificationHistory(result);
    }
  };

  const loadPlayerNotificationHistory = async (playerId = playerNotificationHistoryPlayerId, page = 1): Promise<void> => {
    const normalizedPlayerId = playerId.trim();
    if (!normalizedPlayerId) {
      setError('请输入玩家 ID。');
      return;
    }

    const result = await run('notification-player-history', () => adminFetch<AdminListResponse<AdminPlayerNotificationItem>>(`/players/${encodeURIComponent(normalizedPlayerId)}/notifications?page=${page}&pageSize=10`));
    if (result) {
      setPlayerNotificationHistory(result);
      setPlayerNotificationHistoryPlayerId(normalizedPlayerId);
    }
  };

  const openPlayerSendModal = (playerId: string, nickname: string): void => {
    setQuickSendPlayer({ playerId, nickname });
    setQuickNotificationForm(createEmptyNotificationForm({ playerId }));
    if (!seedDefinitions) {
      void loadSeedDefinitions();
    }
    void loadPlayerNotificationHistory(playerId, 1);
  };

  const sendGlobalNotification = async (): Promise<void> => {
    if (hasNotificationAttachments(globalNotificationForm) && !window.confirm(`Confirm sending notification attachments.\n${ATTACHMENT_NOTIFICATION_CONFIRM_TEXT}`)) {
      return;
    }

    const result = await run('notification-global', () => adminFetch<AdminCreateNotificationResponse>('/notifications/global', jsonRequest('POST', buildNotificationPayload(globalNotificationForm, 'Send global notification attachments from admin console.'))));
    if (!result) {
      return;
    }

    setLastNotificationResult(result);
    setGlobalNotificationForm(createEmptyNotificationForm());
    await loadNotificationHistory();
  };

  const sendNotificationToPlayer = async (form: AdminNotificationFormState, mode: 'panel' | 'quick'): Promise<void> => {
    const playerId = form.playerId.trim();
    if (!playerId) {
      setError('请输入玩家 ID。');
      return;
    }

    if (hasNotificationAttachments(form) && !window.confirm(`Confirm sending notification attachments.\n${ATTACHMENT_NOTIFICATION_CONFIRM_TEXT}`)) {
      return;
    }

    const result = await run(mode === 'quick' ? 'notification-player-quick' : 'notification-player', () => adminFetch<AdminCreateNotificationResponse>(`/players/${encodeURIComponent(playerId)}/notifications`, jsonRequest('POST', buildNotificationPayload(form, `Send player notification attachments to ${playerId} from admin console.`))));
    if (!result) {
      return;
    }

    setLastNotificationResult(result);
    if (mode === 'quick') {
      setQuickNotificationForm(createEmptyNotificationForm({ playerId }));
    } else {
      setPlayerNotificationForm(createEmptyNotificationForm({ playerId }));
    }

    await loadNotificationHistory();
    await loadPlayerNotificationHistory(playerId, 1);
  };

  const sendPlayerNotification = async (): Promise<void> => {
    await sendNotificationToPlayer(playerNotificationForm, 'panel');
  };

  const sendQuickPlayerNotification = async (): Promise<void> => {
    await sendNotificationToPlayer(quickNotificationForm, 'quick');
  };

  const loadSeedDefinitions = async (page = seedDefinitions?.pagination.page ?? 1): Promise<void> => {
    const result = await run('seed-list', () => adminFetch<AdminListResponse<AdminRecord>>(`/config/seeds?page=${page}&pageSize=50`));
    if (result) {
      setSeedDefinitions(result);
    }
  };

  const saveSeedDefinition = async (): Promise<void> => {
    const payload = buildConfigPayload(seedConfigFields, seedForm);
    const path = editingSeedId ? `/config/seeds/${encodeURIComponent(editingSeedId)}` : '/config/seeds';
    const method = editingSeedId ? 'PATCH' : 'POST';
    const result = await run('seed-save', () => adminFetch<AdminRecord>(path, jsonRequest(method, payload)));
    if (!result) {
      return;
    }
    setEditingSeedId('');
    setSeedForm(createEmptyConfigForm(seedConfigFields));
    setIsSeedEditorOpen(false);
    await loadSeedDefinitions();
  };

  const editSeedDefinition = (row: AdminRecord): void => {
    setEditingSeedId(String(row.seedId));
    setSeedForm(createConfigFormFromRecord(seedConfigFields, row));
    setIsSeedEditorOpen(true);
  };

  const deleteSeedDefinition = async (seedId: string): Promise<void> => {
    if (!window.confirm(`确认删除灵植定义？\n${seedId}\n已被玩家田地或资格记录引用的灵植不能删除。`)) {
      return;
    }
    const result = await run('seed-delete', () => adminFetch<AdminRecord>(`/config/seeds/${encodeURIComponent(seedId)}`, jsonRequest('DELETE', {
      reason: `Delete seed definition ${seedId} from admin console.`,
      confirmText: seedId,
    })));
    if (result) {
      await loadSeedDefinitions();
    }
  };

  const loadSpiritDefinitions = async (page = spiritDefinitions?.pagination.page ?? 1): Promise<void> => {
    const result = await run('spirit-list', () => adminFetch<AdminListResponse<AdminRecord>>(`/config/spirits?page=${page}&pageSize=50`));
    if (result) {
      setSpiritDefinitions(result);
    }
  };

  const saveSpiritDefinition = async (): Promise<void> => {
    const payload = buildConfigPayload(spiritConfigFields, spiritForm);
    const path = editingSpiritId ? `/config/spirits/${encodeURIComponent(editingSpiritId)}` : '/config/spirits';
    const method = editingSpiritId ? 'PATCH' : 'POST';
    const result = await run('spirit-save', () => adminFetch<AdminRecord>(path, jsonRequest(method, payload)));
    if (!result) {
      return;
    }
    setEditingSpiritId('');
    setSpiritForm(createEmptyConfigForm(spiritConfigFields));
    setIsSpiritEditorOpen(false);
    await loadSpiritDefinitions();
  };

  const editSpiritDefinition = (row: AdminRecord): void => {
    setEditingSpiritId(String(row.spiritId));
    setSpiritForm(createConfigFormFromRecord(spiritConfigFields, row));
    setIsSpiritEditorOpen(true);
  };

  const deleteSpiritDefinition = async (spiritId: string): Promise<void> => {
    if (!window.confirm(`确认删除灵宠定义？\n${spiritId}\n已被玩家兽栏或图鉴引用的灵宠不能删除。`)) {
      return;
    }
    const result = await run('spirit-delete', () => adminFetch<AdminRecord>(`/config/spirits/${encodeURIComponent(spiritId)}`, jsonRequest('DELETE', {
      reason: `Delete spirit definition ${spiritId} from admin console.`,
      confirmText: spiritId,
    })));
    if (result) {
      await loadSpiritDefinitions();
    }
  };

  const loadTaskDefinitions = async (group = taskGroup): Promise<void> => {
    const result = await run('task-list', () => adminFetch<AdminListResponse<AdminRecord>>(`/config/tasks?group=${encodeURIComponent(group)}`));
    if (result) {
      setTaskDefinitions(result);
    }
  };

  const changeTaskGroup = (group: TaskConfigGroup): void => {
    setTaskGroup(group);
    setIsTaskEditorOpen(false);
    void loadTaskDefinitions(group);
  };

  const editTaskDefinition = (row: AdminRecord): void => {
    const group = row.taskGroup === 'starter' ? 'starter' : 'contribution';
    setEditingTaskGroup(group);
    setEditingTaskId(String(row.taskId));
    setTaskForm(createConfigFormFromRecord(taskConfigFields, row));
    setIsTaskEditorOpen(true);
  };

  const saveTaskDefinition = async (): Promise<void> => {
    if (!editingTaskId) {
      setError('请选择任务配置。');
      return;
    }

    const payload: Record<string, unknown> = buildConfigPayload(taskConfigFields, taskForm);
    payload.isEnabled = taskForm.isEnabled === 'true';
    const result = await run('task-save', () => adminFetch<AdminRecord>(
      `/config/tasks/${encodeURIComponent(editingTaskGroup)}/${encodeURIComponent(editingTaskId)}`,
      jsonRequest('PATCH', payload),
    ));
    if (!result) {
      return;
    }

    setEditingTaskId('');
    setEditingTaskGroup(taskGroup);
    setTaskForm(createEmptyConfigForm(taskConfigFields));
    setIsTaskEditorOpen(false);
    await loadTaskDefinitions(taskGroup);
  };

  const loadCastleLevels = async (): Promise<void> => {
    const result = await run('castle-levels', () => adminFetch<AdminListResponse<AdminRecord>>('/config/castle-levels'));
    if (result) {
      setCastleLevels(result);
    }
  };

  const loadShareAssistCampaigns = async (page = shareAssistCampaigns?.pagination.page ?? 1): Promise<void> => {
    const result = await run('share-assist-campaigns', () => adminFetch<AdminListResponse<AdminRecord>>(`/share-assist/campaigns?page=${page}&pageSize=10`));
    if (result) {
      setShareAssistCampaigns(result);
    }
  };

  const loadShareAssistRecords = async (page = shareAssistRecords?.pagination.page ?? 1): Promise<void> => {
    const result = await run('share-assist-records', () => adminFetch<AdminListResponse<AdminRecord>>(`/share-assist/records?page=${page}&pageSize=10`));
    if (result) {
      setShareAssistRecords(result);
    }
  };

  const loadShareInviteRelations = async (page = shareInviteRelations?.pagination.page ?? 1): Promise<void> => {
    const result = await run('share-assist-invites', () => adminFetch<AdminListResponse<AdminRecord>>(`/share-assist/invite-relations?page=${page}&pageSize=10`));
    if (result) {
      setShareInviteRelations(result);
    }
  };

  const loadShareAssistDashboard = async (): Promise<void> => {
    setBusy('share-assist');
    setError(null);
    try {
      const [campaigns, records, inviteRelations] = await Promise.all([
        adminFetch<AdminListResponse<AdminRecord>>('/share-assist/campaigns?page=1&pageSize=10'),
        adminFetch<AdminListResponse<AdminRecord>>('/share-assist/records?page=1&pageSize=10'),
        adminFetch<AdminListResponse<AdminRecord>>('/share-assist/invite-relations?page=1&pageSize=10'),
      ]);
      setShareAssistCampaigns(campaigns);
      setShareAssistRecords(records);
      setShareInviteRelations(inviteRelations);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '助力记录请求失败');
    } finally {
      setBusy('');
    }
  };

  const loadSeasons = async (page = seasons?.pagination.page ?? 1): Promise<void> => {
    const result = await run('season-list', () => adminFetch<AdminListResponse<AdminRecord>>(`/seasons?page=${page}&pageSize=10`));
    if (result) {
      setSeasons(result);
    }
  };

  const loadSeasonPlayerSnapshots = async (seasonNumber: number, page = seasonPlayerSnapshots?.pagination.page ?? 1): Promise<void> => {
    if (!seasonNumber) {
      setSeasonPlayerSnapshots(null);
      return;
    }
    const result = await run('season-player-snapshots', () => adminFetch<AdminListResponse<AdminRecord>>(`/seasons/${seasonNumber}/player-snapshots?page=${page}&pageSize=10`));
    if (result) {
      setSeasonPlayerSnapshots(result);
    }
  };

  const loadSeasonFactionSnapshots = async (seasonNumber: number, page = seasonFactionSnapshots?.pagination.page ?? 1): Promise<void> => {
    if (!seasonNumber) {
      setSeasonFactionSnapshots(null);
      return;
    }
    const result = await run('season-faction-snapshots', () => adminFetch<AdminListResponse<AdminRecord>>(`/seasons/${seasonNumber}/faction-snapshots?page=${page}&pageSize=10`));
    if (result) {
      setSeasonFactionSnapshots(result);
    }
  };

  const loadSeasonRewardGrants = async (seasonNumber: number, page = seasonRewardGrants?.pagination.page ?? 1): Promise<void> => {
    if (!seasonNumber) {
      setSeasonRewardGrants(null);
      return;
    }
    const result = await run('season-reward-grants', () => adminFetch<AdminListResponse<AdminRecord>>(`/seasons/${seasonNumber}/reward-grants?page=${page}&pageSize=10`));
    if (result) {
      setSeasonRewardGrants(result);
    }
  };

  const loadSeasonAchievements = async (seasonNumber: number, page = seasonAchievements?.pagination.page ?? 1): Promise<void> => {
    if (!seasonNumber) {
      setSeasonAchievements(null);
      return;
    }
    const result = await run('season-achievements', () => adminFetch<AdminListResponse<AdminRecord>>(`/seasons/${seasonNumber}/achievements?page=${page}&pageSize=10`));
    if (result) {
      setSeasonAchievements(result);
    }
  };

  const loadSeasonDashboard = async (): Promise<void> => {
    setBusy('season');
    setError(null);
    try {
      const [nextCurrentSeason, nextSeasons] = await Promise.all([
        adminFetch<AdminRecord>('/seasons/current'),
        adminFetch<AdminListResponse<AdminRecord>>('/seasons?page=1&pageSize=10'),
      ]);
      setCurrentSeason(nextCurrentSeason);
      setSeasons(nextSeasons);
      const seasonNumber = Number(nextCurrentSeason.seasonNumber ?? 0);
      if (seasonNumber > 0) {
        setSeasonPlayerRewardSeasonNumber((current) => current || String(seasonNumber));
        const [playerSnapshots, factionSnapshots, rewardSummary, rewardGrants, achievements] = await Promise.all([
          adminFetch<AdminListResponse<AdminRecord>>(`/seasons/${seasonNumber}/player-snapshots?page=1&pageSize=10`),
          adminFetch<AdminListResponse<AdminRecord>>(`/seasons/${seasonNumber}/faction-snapshots?page=1&pageSize=10`),
          adminFetch<AdminRecord>(`/seasons/${seasonNumber}/reward-summary`),
          adminFetch<AdminListResponse<AdminRecord>>(`/seasons/${seasonNumber}/reward-grants?page=1&pageSize=10`),
          adminFetch<AdminListResponse<AdminRecord>>(`/seasons/${seasonNumber}/achievements?page=1&pageSize=10`),
        ]);
        setSeasonPlayerSnapshots(playerSnapshots);
        setSeasonFactionSnapshots(factionSnapshots);
        setSeasonRewardSummary(rewardSummary);
        setSeasonRewardGrants(rewardGrants);
        setSeasonAchievements(achievements);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '赛季后台请求失败');
    } finally {
      setBusy('');
    }
  };

  const loadSeasonPlayerHistory = async (playerId = seasonPlayerHistoryId, page = 1): Promise<void> => {
    const normalizedPlayerId = playerId.trim();
    if (!normalizedPlayerId) {
      setError('请输入玩家 ID。');
      return;
    }
    const result = await run('season-player-history', () => adminFetch<AdminListResponse<AdminRecord>>(`/players/${encodeURIComponent(normalizedPlayerId)}/season-history?page=${page}&pageSize=10`));
    if (result) {
      setSeasonPlayerHistory(result);
      setSeasonPlayerHistoryId(normalizedPlayerId);
    }
  };

  const loadSeasonPlayerRewardHistory = async (playerId = seasonPlayerHistoryId, page = 1): Promise<void> => {
    const normalizedPlayerId = playerId.trim();
    if (!normalizedPlayerId) {
      setError('请输入玩家 ID。');
      return;
    }

    const params = new URLSearchParams({
      page: String(page),
      pageSize: '10',
    });
    const normalizedSeasonNumber = seasonPlayerRewardSeasonNumber.trim();
    if (normalizedSeasonNumber) {
      params.set('seasonNumber', normalizedSeasonNumber);
    }

    const result = await run('season-player-reward-history', () => adminFetch<AdminListResponse<AdminRecord>>(
      `/players/${encodeURIComponent(normalizedPlayerId)}/season-rewards?${params.toString()}`,
    ));
    if (result) {
      setSeasonPlayerRewardHistory(result);
      setSeasonPlayerHistoryId(normalizedPlayerId);
    }
  };

  const loadSeasonRewardPreview = async (playerId = seasonPlayerHistoryId): Promise<void> => {
    const normalizedPlayerId = playerId.trim();
    const normalizedSeasonNumber = Number(seasonPlayerRewardSeasonNumber.trim() || String(currentSeason?.seasonNumber ?? 0));
    if (!normalizedPlayerId) {
      setError('请输入玩家 ID。');
      return;
    }
    if (!Number.isInteger(normalizedSeasonNumber) || normalizedSeasonNumber <= 0) {
      setError('请输入有效赛季号。');
      return;
    }

    const params = new URLSearchParams({ playerId: normalizedPlayerId });
    const result = await run('season-reward-preview', () => adminFetch<AdminRecord>(
      `/seasons/${normalizedSeasonNumber}/rewards/preview?${params.toString()}`,
    ));
    if (result) {
      setSeasonRewardPreview(result);
      setSeasonPlayerHistoryId(normalizedPlayerId);
      setSeasonPlayerRewardSeasonNumber(String(normalizedSeasonNumber));
    }
  };

  const metricItems = [
    { label: '数据库', value: status?.database.status ?? '-', tone: status?.database.status === 'up' ? 'ok' : 'bad' },
    { label: '环境', value: status?.environment ?? '-', tone: 'neutral' },
    { label: '后台模块', value: String(overview?.modules.length ?? 0), tone: 'neutral' },
    { label: '调试头', value: DEBUG_KEY ? '已配置' : '未配置', tone: DEBUG_KEY ? 'ok' : 'neutral' },
  ];
  const modalOverview =
    activeModal && String(playerOverview?.identity.playerId ?? '') === activeModal.playerId ? playerOverview : null;
  const modalOrders = activeModal && playerOrdersOwnerId === activeModal.playerId ? playerOrders : null;
  const modalPlayerTitle = activeModal ? selectedPlayerTitle || activeModal.playerId : '';

  return (
    <>
      <main className="admin-layout">
        <aside className="sidebar">
          <div className="brand-block">
            <span className="brand-mark">TW</span>
            <div>
              <p className="eyebrow">Admin Console</p>
              <h1>{APP_NAME}</h1>
            </div>
          </div>

          <nav className="nav-list" aria-label="后台模块">
            {navItems.map((item) => (
              <button
                className={item.key === activeModule ? 'nav-item active' : 'nav-item'}
                key={item.key}
                onClick={() => setActiveModule(item.key)}
                type="button"
              >
                <span>{item.label}</span>
                <small>{item.description}</small>
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <span>API</span>
            <strong>{API_BASE}</strong>
          </div>
        </aside>

        <section className="content-shell">
          <header className="topbar">
            <div>
              <p className="eyebrow">{navItems.find((item) => item.key === activeModule)?.description}</p>
              <h2>{navItems.find((item) => item.key === activeModule)?.label}</h2>
            </div>
            <button className="primary-button" disabled={busy === 'shell'} onClick={() => void run('shell', refreshShell)} type="button">
              刷新状态
            </button>
          </header>

          {error ? <div className="error-line">{error}</div> : null}

          {activeModule === 'dashboard' ? (
            <DashboardView
              metrics={metricItems}
              overview={overview}
              status={status}
              onNavigate={setActiveModule}
            />
          ) : null}

          {activeModule === 'player' ? (
            <PlayerInfoView
              busy={busy}
              keyword={keyword}
              onKeywordChange={setKeyword}
              onDeletePlayer={(playerId) => void handleDeletePlayer(playerId)}
              onOpenPlayerInfo={openPlayerInfoModal}
              onOpenPlayerRaid={openPlayerRaidModal}
              onOpenPlayerSend={openPlayerSendModal}
              onSearch={() => void handleSearch(1)}
              onSearchPageChange={(page) => void handleSearch(page)}
              searchResult={searchResult}
            />
          ) : null}

          {activeModule === 'order' ? (
            <OrderView
              busy={busy}
              orderDetail={orderDetail}
              orderId={orderId}
              onOrderIdChange={setOrderId}
              onLoadOrder={() => void handleLoadOrder()}
            />
          ) : null}

          {activeModule === 'notifications' ? (
            <NotificationsView
              busy={busy}
              globalForm={globalNotificationForm}
              history={notificationHistory}
              lastResult={lastNotificationResult}
              onGlobalAddAttachment={() => appendNotificationAttachment(setGlobalNotificationForm)}
              onGlobalAttachmentChange={(index, field, value) => patchNotificationAttachment(setGlobalNotificationForm, index, field, value)}
              onGlobalChange={(field, value) => patchNotificationForm(setGlobalNotificationForm, field, value)}
              onGlobalRemoveAttachment={(index) => removeNotificationAttachment(setGlobalNotificationForm, index)}
              onHistoryPageChange={(page) => void loadNotificationHistory(page)}
              onLoadPlayerHistory={() => void loadPlayerNotificationHistory()}
              onPlayerAddAttachment={() => appendNotificationAttachment(setPlayerNotificationForm)}
              onPlayerAttachmentChange={(index, field, value) => patchNotificationAttachment(setPlayerNotificationForm, index, field, value)}
              onPlayerChange={(field, value) => patchNotificationForm(setPlayerNotificationForm, field, value)}
              onPlayerHistoryIdChange={setPlayerNotificationHistoryPlayerId}
              onPlayerHistoryPageChange={(page) => void loadPlayerNotificationHistory(playerNotificationHistoryPlayerId, page)}
              onPlayerRemoveAttachment={(index) => removeNotificationAttachment(setPlayerNotificationForm, index)}
              onSendGlobal={() => void sendGlobalNotification()}
              onSendPlayer={() => void sendPlayerNotification()}
              playerForm={playerNotificationForm}
              playerHistory={playerNotificationHistory}
              playerHistoryPlayerId={playerNotificationHistoryPlayerId}
            />
          ) : null}

          {activeModule === 'shareAssist' ? (
            <ShareAssistView
              busy={busy}
              campaigns={shareAssistCampaigns}
              inviteRelations={shareInviteRelations}
              records={shareAssistRecords}
              onCampaignPageChange={(page) => void loadShareAssistCampaigns(page)}
              onInvitePageChange={(page) => void loadShareInviteRelations(page)}
              onRecordPageChange={(page) => void loadShareAssistRecords(page)}
              onRefresh={() => void loadShareAssistDashboard()}
            />
          ) : null}

          {activeModule === 'robotTest' ? (
            <RobotTestView
              busy={busy}
              dashboard={robotDashboard}
              onClearErrors={() => void clearRobotErrors()}
              onExportErrors={() => void exportRobotErrors()}
              onRefresh={() => void loadRobotDashboard()}
              onRunDaily3={() => void runRobotDaily3()}
              onRunPlayerSimV1={() => void runRobotPlayerSimV1()}
              onRunSeasonSimV1Day={() => void runRobotSeasonSimV1Day()}
              onRunSocial3={() => void runRobotSocial3()}
              onSaveAutomationConfig={(input) => void saveRobotDaily3AutomationConfig(input)}
              onSavePlayerSimV1AutomationConfig={(input) => void saveRobotPlayerSimV1AutomationConfig(input)}
              onSaveSocialAutomationConfig={(input) => void saveRobotSocial3AutomationConfig(input)}
              onStartLoop={(input) => void startRobotDaily3Loop(input)}
              onStartPlayerSimV1Loop={(input) => void startRobotPlayerSimV1Loop(input)}
              onStartSeasonSimV1Loop={(input) => void startRobotSeasonSimV1Loop(input)}
              onStartSocialLoop={(input) => void startRobotSocial3Loop(input)}
              onStopLoop={() => void stopRobotDaily3Loop()}
              onStopSeasonSimV1Loop={() => void stopRobotSeasonSimV1Loop()}
            />
          ) : null}

          {activeModule === 'season' ? (
            <SeasonView
              busy={busy}
              currentSeason={currentSeason}
              factionSnapshots={seasonFactionSnapshots}
              rewardGrants={seasonRewardGrants}
              rewardSummary={seasonRewardSummary}
              achievements={seasonAchievements}
              playerHistory={seasonPlayerHistory}
              playerHistoryId={seasonPlayerHistoryId}
              playerRewardHistory={seasonPlayerRewardHistory}
              playerRewardSeasonNumber={seasonPlayerRewardSeasonNumber}
              rewardPreview={seasonRewardPreview}
              playerSnapshots={seasonPlayerSnapshots}
              seasons={seasons}
              onAchievementPageChange={(page) => void loadSeasonAchievements(Number(currentSeason?.seasonNumber ?? 0), page)}
              onFactionSnapshotPageChange={(page) => void loadSeasonFactionSnapshots(Number(currentSeason?.seasonNumber ?? 0), page)}
              onLoadPlayerHistory={() => void loadSeasonPlayerHistory()}
              onLoadPlayerRewardHistory={() => void loadSeasonPlayerRewardHistory()}
              onLoadRewardPreview={() => void loadSeasonRewardPreview()}
              onPlayerHistoryIdChange={setSeasonPlayerHistoryId}
              onPlayerHistoryPageChange={(page) => void loadSeasonPlayerHistory(seasonPlayerHistoryId, page)}
              onPlayerRewardHistoryPageChange={(page) => void loadSeasonPlayerRewardHistory(seasonPlayerHistoryId, page)}
              onPlayerRewardSeasonNumberChange={setSeasonPlayerRewardSeasonNumber}
              onPlayerSnapshotPageChange={(page) => void loadSeasonPlayerSnapshots(Number(currentSeason?.seasonNumber ?? 0), page)}
              onRefresh={() => void loadSeasonDashboard()}
              onRewardGrantPageChange={(page) => void loadSeasonRewardGrants(Number(currentSeason?.seasonNumber ?? 0), page)}
              onSeasonPageChange={(page) => void loadSeasons(page)}
            />
          ) : null}

          {activeModule === 'spiritConfig' ? (
            <SpiritConfigView
              busy={busy}
              definitions={spiritDefinitions}
              editingId={editingSpiritId}
              form={spiritForm}
              isEditorOpen={isSpiritEditorOpen}
              onAdd={() => {
                setEditingSpiritId('');
                setSpiritForm(createEmptyConfigForm(spiritConfigFields));
                setIsSpiritEditorOpen(true);
              }}
              onCancelEdit={() => {
                setEditingSpiritId('');
                setSpiritForm(createEmptyConfigForm(spiritConfigFields));
                setIsSpiritEditorOpen(false);
              }}
              onDelete={(spiritId) => void deleteSpiritDefinition(spiritId)}
              onEdit={editSpiritDefinition}
              onFieldChange={(field, value) => setSpiritForm((current) => ({ ...current, [field]: value }))}
              onRefresh={() => void loadSpiritDefinitions()}
              onSave={() => void saveSpiritDefinition()}
            />
          ) : null}

          {activeModule === 'seedConfig' ? (
            <SeedConfigView
              busy={busy}
              definitions={seedDefinitions}
              editingId={editingSeedId}
              form={seedForm}
              isEditorOpen={isSeedEditorOpen}
              onAdd={() => {
                setEditingSeedId('');
                setSeedForm(createEmptyConfigForm(seedConfigFields));
                setIsSeedEditorOpen(true);
              }}
              onCancelEdit={() => {
                setEditingSeedId('');
                setSeedForm(createEmptyConfigForm(seedConfigFields));
                setIsSeedEditorOpen(false);
              }}
              onDelete={(seedId) => void deleteSeedDefinition(seedId)}
              onEdit={editSeedDefinition}
              onFieldChange={(field, value) => setSeedForm((current) => ({ ...current, [field]: value }))}
              onRefresh={() => void loadSeedDefinitions()}
              onSave={() => void saveSeedDefinition()}
            />
          ) : null}

          {activeModule === 'taskConfig' ? (
            <TaskConfigView
              busy={busy}
              definitions={taskDefinitions}
              editingId={editingTaskId}
              form={taskForm}
              group={taskGroup}
              isEditorOpen={isTaskEditorOpen}
              onCancelEdit={() => {
                setEditingTaskId('');
                setEditingTaskGroup(taskGroup);
                setTaskForm(createEmptyConfigForm(taskConfigFields));
                setIsTaskEditorOpen(false);
              }}
              onEdit={editTaskDefinition}
              onFieldChange={(field, value) => setTaskForm((current) => ({ ...current, [field]: value }))}
              onGroupChange={changeTaskGroup}
              onRefresh={() => void loadTaskDefinitions()}
              onSave={() => void saveTaskDefinition()}
            />
          ) : null}

          {activeModule === 'castleLevels' ? (
            <CastleLevelsView
              activeTab={lightweightRuleTab}
              busy={busy}
              levels={castleLevels}
              onRefresh={() => void loadCastleLevels()}
              onTabChange={setLightweightRuleTab}
            />
          ) : null}

          {activeModule === 'system' ? (
            <SystemView
              auditAction={auditAction}
              auditLogs={auditLogs}
              auditTargetId={auditTargetId}
              busy={busy}
              onAuditActionChange={setAuditAction}
              onAuditPageChange={(page) => void loadAuditLogs(page)}
              onAuditRefresh={() => void loadAuditLogs(1)}
              onAuditTargetIdChange={setAuditTargetId}
              overview={overview}
              status={status}
            />
          ) : null}
        </section>
      </main>

      {activeModal ? (
        <Modal
          title={activeModal.type === 'info' ? '玩家基础信息' : '玩家掠夺情况'}
          subtitle={`${formatValue(modalPlayerTitle)} / ${activeModal.playerId}`}
          onClose={() => setActiveModal(null)}
        >
          {activeModal.type === 'info' ? (
            modalOverview ? (
              <PlayerDetailTables
                adjustBusy={busy === 'player-resource-adjust'}
                adjustForm={resourceAdjustForm}
                onAdjustChange={patchResourceAdjustForm}
                onAdjustSubmit={() => void submitResourceAdjust()}
                overview={modalOverview}
              />
            ) : <EmptyState text="正在读取玩家基础信息。" />
          ) : modalOrders ? (
            <PlayerRaidContent
              busy={busy}
              onOpenOrder={openOrderFromTable}
              onPageChange={(page) => void handleLoadPlayerRaid(activeModal.playerId, page)}
              playerOverview={modalOverview}
              playerOrders={modalOrders}
              summaryPlayerId={activeModal.playerId}
            />
          ) : (
            <EmptyState text="正在读取玩家掠夺情况。" />
          )}
        </Modal>
      ) : null}

      {quickSendPlayer ? (
        <Modal
          title="发送站内信 / 发物品"
          subtitle={`${quickSendPlayer.nickname} / ${quickSendPlayer.playerId}`}
          onClose={() => setQuickSendPlayer(null)}
        >
          <div className="detail-stack">
            <NotificationComposer
              actionLabel="发送给当前玩家"
              busy={busy === 'notification-player-quick'}
              eyebrow="快捷发送"
              form={quickNotificationForm}
              onAddAttachment={() => appendNotificationAttachment(setQuickNotificationForm)}
              onAttachmentChange={(index, field, value) => patchNotificationAttachment(setQuickNotificationForm, index, field, value)}
              onChange={(field, value) => patchNotificationForm(setQuickNotificationForm, field, value)}
              onRemoveAttachment={(index) => removeNotificationAttachment(setQuickNotificationForm, index)}
              onSubmit={() => void sendQuickPlayerNotification()}
              playerIdDisabled
              showPlayerId
              submitBusyLabel="发送中..."
              title="复用发送组件，可同时发消息和多种物品"
            />
            <TableSection
              title="该玩家最近消息"
              columns={[
                { label: '标题 / title', key: 'title' },
                { label: '附件 / attachments', key: 'attachments' },
                { label: '状态 / claimStatus', key: 'claimStatus' },
                { label: '创建时间 / createdAt', key: 'createdAt' },
              ]}
              rows={playerNotificationHistory?.items.map((item) => ({
                ...item,
                attachments: item.attachments.length > 0 ? item.attachments.map((attachment) => `${attachment.label} x${attachment.quantity}`).join('、') : '无',
                claimStatus: item.claimStatus === 'unclaimed' ? '待领取' : item.claimStatus === 'claimed' ? '已领取' : item.claimStatus === 'expired' ? '已过期' : '无附件',
              })) ?? []}
            />
          </div>
        </Modal>
      ) : null}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
