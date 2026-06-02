export type DevLoginMode = 'new-user' | 'existing-user' | 'test-user-1' | 'test-user-2';
export type DevFactionChoice = 'human' | 'immortal' | 'demon';

export interface DevLoginSession {
  accessToken: string;
  expiresAt: string;
  player: {
    id: string;
    nickname: string;
    castleLevel: number;
    factionCode?: DevFactionChoice;
  };
  mode: DevLoginMode;
}

const AUTH_STORAGE_KEY = 'trinitywar.devAuth';

let devLoginSession: DevLoginSession | null = readStoredDevLoginSession();

export function getStoredDevLoginSession(): DevLoginSession | null {
  return devLoginSession;
}

export function getDevLoginAccessToken(): string | null {
  return devLoginSession?.accessToken ?? null;
}

export function setStoredDevLoginSession(session: DevLoginSession): void {
  devLoginSession = session;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearDevLoginSession(): void {
  devLoginSession = null;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

function readStoredDevLoginSession(): DevLoginSession | null {
  try {
    const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as DevLoginSession;

    if (!parsed.accessToken || !parsed.expiresAt || new Date(parsed.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    const repaired = repairDevLoginSession(parsed);
    if (repaired !== parsed) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(repaired));
    }

    return repaired;
  } catch {
    return null;
  }
}

function repairDevLoginSession(session: DevLoginSession): DevLoginSession {
  const expectedNickname = getExpectedDevNickname(session.mode, session.player.nickname);

  if (!expectedNickname || !isMojibakeText(session.player.nickname)) {
    return session;
  }

  return {
    ...session,
    player: {
      ...session.player,
      nickname: expectedNickname,
    },
  };
}

function getExpectedDevNickname(mode: DevLoginMode, currentNickname: string): string | null {
  if (mode === 'new-user') {
    const suffix = currentNickname.match(/_(\d+)$/)?.[1];
    return suffix ? `新用户_${suffix}` : null;
  }

  if (mode === 'existing-user') {
    return '主循环测试号';
  }

  if (mode === 'test-user-1') {
    return '测试用户1';
  }

  if (mode === 'test-user-2') {
    return '测试用户2';
  }

  return null;
}

function isMojibakeText(value: string): boolean {
  return /[\uFFFD]|Ã|Â|æ|ç|è|é|å|ä|Ð|Ñ|Ó|Ê|µ/.test(value);
}
