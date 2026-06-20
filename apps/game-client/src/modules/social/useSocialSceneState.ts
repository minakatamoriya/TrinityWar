import { useRef, useState } from 'react';
import type {
  ClientSocialFeedItem,
  ClientSocialFriendFieldVisitResponse,
  ClientSocialRelationItem,
  ClientSocialSummaryResponse,
} from '@trinitywar/shared';
import {
  acceptSocialFriendRequest,
  deleteSocialFriend,
  followSocialTarget,
  harvestSocialField,
  loadSocialFeed,
  loadSocialRelations,
  loadSocialSummary,
  rejectSocialFriendRequest,
  reviveSocialField,
  requestSocialFriend,
  unfollowSocialTarget,
  visitSocialFriendFields,
} from '../../api';
import { buildIdempotencyKey } from '../../apiSupport/idempotency';
import { formatSocialAssistSummary } from '../../utils/format';
import { runSocialFieldAssists } from './socialAssist';

interface UseSocialSceneStateOptions {
  onToast: (message: string, tone?: 'info' | 'success' | 'error') => void;
}

export function useSocialSceneState(options: UseSocialSceneStateOptions) {
  const { onToast } = options;
  const [summary, setSummary] = useState<ClientSocialSummaryResponse | null>(null);
  const [feed, setFeed] = useState<ClientSocialFeedItem[]>([]);
  const [friends, setFriends] = useState<ClientSocialRelationItem[]>([]);
  const [following, setFollowing] = useState<ClientSocialRelationItem[]>([]);
  const [fieldVisit, setFieldVisit] = useState<ClientSocialFriendFieldVisitResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assistBusyRef = useRef(false);

  const reset = (): void => {
    setSummary(null);
    setFeed([]);
    setFriends([]);
    setFollowing([]);
    setFieldVisit(null);
    setError(null);
    setLoading(false);
  };

  const loadBundle = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const [nextSummary, feedResult, friendsResult, followingResult] = await Promise.all([
        loadSocialSummary(),
        loadSocialFeed(),
        loadSocialRelations('friends'),
        loadSocialRelations('following'),
      ]);

      setSummary(nextSummary);
      setFeed(feedResult.items);
      setFriends(friendsResult.items);
      setFollowing(followingResult.items);
    } catch (loadError) {
      setError(loadError instanceof Error && loadError.message ? loadError.message : '当前无法读取社交数据，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  const runAssistForFields = async (
    targetPlayerId: string,
    fields: ClientSocialFriendFieldVisitResponse['fields'],
  ): Promise<ReturnType<typeof runSocialFieldAssists> extends Promise<infer TResult> ? TResult : never> => {
    const assistBatchKey = buildIdempotencyKey('social-assist-batch');
    const assistResult = await runSocialFieldAssists({
      targetPlayerId,
      fields,
      reviveField: (fieldSlotId) => reviveSocialField({
        targetPlayerId,
        fieldSlotId,
        requestIdempotencyKey: `${assistBatchKey}:revive:${fieldSlotId}`,
      }),
      harvestField: (fieldSlotId) => harvestSocialField({
        targetPlayerId,
        fieldSlotId,
        requestIdempotencyKey: `${assistBatchKey}:harvest:${fieldSlotId}`,
      }),
    });

    if (assistResult.latestCounts) {
      const counts = assistResult.latestCounts;
      setSummary((current) => current ? { ...current, counts } : current);
    }

    return assistResult;
  };

  const showAssistResultToast = (assistResult: {
    revivedCount: number;
    harvestedCount: number;
    rewardGold: number;
    intimacyGain: number;
    cappedIntimacyCount: number;
    failedMessages: string[];
  }): void => {
    const summaryParts = formatSocialAssistSummary(assistResult);

    if (summaryParts.length > 0) {
      onToast(`一键助力完成：${summaryParts.join('，')}。`, assistResult.failedMessages.length > 0 ? 'info' : 'success');
    } else {
      onToast(assistResult.failedMessages[0] ?? '当前没有成功助力的田地。', 'info');
    }

    if (assistResult.failedMessages.length > 0 && summaryParts.length > 0) {
      onToast(`部分田地未完成：${assistResult.failedMessages[0]}`, 'info');
    }
  };

  const openFieldVisit = async (targetPlayerId: string): Promise<void> => {
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const visit = await visitSocialFriendFields(targetPlayerId);
      setFieldVisit(visit);
    } catch (visitError) {
      onToast(visitError instanceof Error && visitError.message ? visitError.message : '当前无法查看好友灵田，请稍后重试。', 'error');
    } finally {
      setLoading(false);
    }
  };

  const assistAllFields = async (): Promise<void> => {
    const visit = fieldVisit;
    const targetPlayerId = visit?.friend.playerId;
    if (!visit || !targetPlayerId || loading || assistBusyRef.current) {
      return;
    }

    const actionableFields = visit.fields.filter((field) => field.nextAction === 'revive' || field.nextAction === 'harvest');
    if (actionableFields.length === 0) {
      onToast('好友当前没有可助力的田地。', 'info');
      return;
    }

    assistBusyRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const assistResult = await runAssistForFields(targetPlayerId, actionableFields);
      setFieldVisit(await visitSocialFriendFields(targetPlayerId));
      showAssistResultToast(assistResult);
      void loadBundle();
    } finally {
      assistBusyRef.current = false;
      setLoading(false);
    }
  };

  const mutateRelation = async (
    action: () => Promise<{ summary: string }>,
    fallbackMessage: string,
  ): Promise<void> => {
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await action();
      onToast(result.summary, 'success');
      void loadBundle();
    } catch (mutationError) {
      onToast(mutationError instanceof Error && mutationError.message ? mutationError.message : fallbackMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const assistFriend = async (targetPlayerId: string): Promise<void> => {
    if (loading || assistBusyRef.current) {
      return;
    }

    assistBusyRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const visit = await visitSocialFriendFields(targetPlayerId);
      const actionableFields = visit.fields.filter((field) => field.nextAction === 'revive' || field.nextAction === 'harvest');
      if (actionableFields.length === 0) {
        onToast('好友当前没有可助力的田地。', 'info');
        void loadBundle();
        return;
      }

      const assistResult = await runAssistForFields(targetPlayerId, actionableFields);
      showAssistResultToast(assistResult);
      void loadBundle();
    } catch (assistError) {
      onToast(assistError instanceof Error && assistError.message ? assistError.message : '当前无法完成一键助力，请稍后重试。', 'error');
    } finally {
      assistBusyRef.current = false;
      setLoading(false);
    }
  };

  return {
    acceptFriendRequest: (relationId: string) => mutateRelation(
      () => acceptSocialFriendRequest(relationId),
      '当前无法确认好友申请，请稍后重试。',
    ),
    assistAllFields,
    assistFriend,
    closeFieldVisit: () => setFieldVisit(null),
    deleteFriend: (targetPlayerId: string) => mutateRelation(
      () => deleteSocialFriend(targetPlayerId),
      '当前无法删除好友，请稍后重试。',
    ),
    error,
    feed,
    followTarget: (targetPlayerId: string) => mutateRelation(
      () => followSocialTarget({ targetPlayerId }),
      '当前无法关注该玩家，请稍后重试。',
    ),
    fieldVisit,
    following,
    friends,
    loadBundle,
    loading,
    openFieldVisit,
    rejectFriendRequest: (relationId: string) => mutateRelation(
      () => rejectSocialFriendRequest(relationId),
      '当前无法处理好友申请，请稍后重试。',
    ),
    requestFriend: (targetPlayerId: string) => mutateRelation(
      () => requestSocialFriend({ targetPlayerId }),
      '当前无法发送好友申请，请稍后重试。',
    ),
    reset,
    summary,
    unfollowTarget: (targetPlayerId: string) => mutateRelation(
      () => unfollowSocialTarget(targetPlayerId),
      '当前无法取消关注，请稍后重试。',
    ),
  };
}
