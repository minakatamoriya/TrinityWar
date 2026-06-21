import type { ClientSeasonTransition } from '@trinitywar/shared';
import { getDevLoginAccessToken } from './devAuthSession';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

function buildApiUrl(path: string): string {
  if (!apiBaseUrl) {
    return path;
  }

  return path.startsWith('/') ? `${apiBaseUrl}${path}` : `${apiBaseUrl}/${path}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly seasonTransition?: ClientSeasonTransition;

  constructor(message: string, status: number, code?: string, details?: unknown, seasonTransition?: ClientSeasonTransition) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.seasonTransition = seasonTransition;
  }
}

function toUserFacingApiMessage(message: string, code?: string): string {
  if (code === 'RAID_NOT_ALLOWED') {
    if (message.includes('no health')) {
      return '主位灵宠当前 0 血，无法出战。请先恢复血量，或更换主位灵宠后再发起战斗。';
    }
    if (message.includes('Main spirit is required')) {
      return '当前没有可出战的主位灵宠。请先设置主位灵宠后再发起战斗。';
    }
  }

  return message;
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  const accessToken = getDevLoginAccessToken();
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as {
      message?: string;
      error?: {
        code?: string;
        message?: string;
        details?: unknown;
        seasonTransition?: ClientSeasonTransition;
      };
    } | null;
    const code = payload?.error?.code;
    const message = payload?.error?.message?.trim() || payload?.message?.trim() || `HTTP ${response.status}`;
    const details = payload?.error?.details;
    const seasonTransition = extractSeasonTransition(payload?.error?.seasonTransition, details);
    throw new ApiError(toUserFacingApiMessage(message, code), response.status, code, details, seasonTransition);
  }

  return (await response.json()) as T;
}

function extractSeasonTransition(
  directSeasonTransition: ClientSeasonTransition | undefined,
  details: unknown,
): ClientSeasonTransition | undefined {
  if (directSeasonTransition) {
    return directSeasonTransition;
  }

  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return undefined;
  }

  const seasonTransition = (details as { seasonTransition?: ClientSeasonTransition }).seasonTransition;
  return seasonTransition;
}

export function getFallbackReason(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'request failed';
}
