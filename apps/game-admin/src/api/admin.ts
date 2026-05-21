import { ADMIN_API_PREFIX } from '@trinitywar/shared';

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
export const DEBUG_KEY = import.meta.env.VITE_ADMIN_DEBUG_KEY ?? '';

export function jsonRequest(method: string, body: Record<string, unknown>): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${ADMIN_API_PREFIX}${path}`, {
    ...init,
    headers: {
      ...(DEBUG_KEY ? { 'x-admin-debug-key': DEBUG_KEY } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message?.trim() || `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}
