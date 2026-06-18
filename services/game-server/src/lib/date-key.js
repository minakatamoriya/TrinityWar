import { getDateKeyTimezone } from './game-balance.js';

export function getLocalDateKey(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: getDateKeyTimezone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(now);
}

export function getStartOfDateKey(dateKey) {
  return new Date(`${dateKey}T00:00:00+08:00`);
}
