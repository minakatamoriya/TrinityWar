import { getLocalDateKey } from '../lib/date-key.js';

export class SimClock {
  private current: Date;

  constructor(startAt: Date) {
    this.current = new Date(startAt.getTime());
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  dateKey(): string {
    return getLocalDateKey(this.current);
  }

  weekKey(): string {
    const date = new Date(Date.UTC(this.current.getUTCFullYear(), this.current.getUTCMonth(), this.current.getUTCDate()));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  advanceSeconds(seconds: number): Date {
    this.current = new Date(this.current.getTime() + Math.max(Math.floor(seconds), 0) * 1000);
    return this.now();
  }

  advanceHours(hours: number): Date {
    return this.advanceSeconds(hours * 60 * 60);
  }

  advanceDays(days: number): Date {
    return this.advanceSeconds(days * 24 * 60 * 60);
  }
}

export function createSeasonSimClock(startAt?: Date): SimClock {
  return new SimClock(startAt ?? new Date('2026-06-08T00:00:00+08:00'));
}
