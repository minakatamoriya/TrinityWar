import type { ClientReadSourceStatus } from '../api';

export interface ResourceProgressValue {
  current: number;
  capacity: number;
  ratio: number;
}

export function formatServerTime(serverTime: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(serverTime));
}

export function parseTianjiCostText(costText: string): number {
  const match = costText.match(/^消耗\s*([\d,，]+)\s*天机符/);
  if (!match) {
    return 0;
  }

  return Math.max(Number(match[1].replace(/[，,]/g, '')) || 0, 0);
}

export function parseCapacityResourceValue(value: string): ResourceProgressValue {
  const parts = value.split('/').map((part) => Number(part.replace(/,/g, '').trim()));
  const current = parts[0] ?? 0;
  const capacity = parts[1] ?? 1;
  const ratio = capacity > 0 ? Math.min(current / capacity, 1) : 0;

  return { current, capacity, ratio };
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

export function formatSocialAssistSummary(input: {
  wateredCount: number;
  harvestedCount: number;
  rewardGold: number;
  intimacyGain: number;
  cappedIntimacyCount?: number;
}): string[] {
  return [
    input.wateredCount > 0 ? `浇水 ${input.wateredCount} 块` : null,
    input.harvestedCount > 0 ? `采摘 ${input.harvestedCount} 块` : null,
    input.rewardGold > 0 ? `金币 +${formatNumber(input.rewardGold)}` : null,
    input.intimacyGain > 0 ? `亲密度 +${formatNumber(input.intimacyGain)}` : null,
    (input.cappedIntimacyCount ?? 0) > 0 ? '今日亲密度已达上限' : null,
  ].filter((part): part is string => Boolean(part));
}

export function formatProtectionCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(totalSeconds, 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatReadSource(status: ClientReadSourceStatus): string {
  return status.source === 'api' ? '实时接口' : `本地演示数据${status.fallbackReason ? `（${status.fallbackReason}）` : ''}`;
}
