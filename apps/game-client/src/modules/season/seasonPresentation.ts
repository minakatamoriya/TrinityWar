import type { ClientViewModel } from '../../api';
import { formatSeasonLabel } from '@trinitywar/shared';

export function buildSeasonProgress(status: ClientViewModel['bootstrap']['season']): {
  label: string;
  detail: string;
} {
  const safeTotalWeeks = Math.max(status.totalWeeks, 1);
  const safeCurrentWeek = Math.min(Math.max(status.currentWeek, 1), safeTotalWeeks);

  return {
    label: formatSeasonLabel(status.seasonNumber),
    detail: `${safeCurrentWeek}/${safeTotalWeeks} 周`,
  };
}
