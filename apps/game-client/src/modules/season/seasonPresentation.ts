import type { ClientViewModel } from '../../api';

export function buildSeasonProgress(status: ClientViewModel['bootstrap']['season']): {
  label: string;
  detail: string;
} {
  const safeTotalWeeks = Math.max(status.totalWeeks, 1);
  const safeCurrentWeek = Math.min(Math.max(status.currentWeek, 1), safeTotalWeeks);

  return {
    label: `S${status.seasonNumber} 赛季`,
    detail: `${safeCurrentWeek}/${safeTotalWeeks} 周`,
  };
}
