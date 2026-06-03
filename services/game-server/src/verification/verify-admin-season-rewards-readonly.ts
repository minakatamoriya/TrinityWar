import { NestFactory } from '@nestjs/core';
import { AdminReadonlyService } from '../admin-readonly/admin-readonly.service.js';
import { AppModule } from '../modules/app/app.module.js';
import { SeasonService } from '../season/season.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const adminReadonlyService = app.get(AdminReadonlyService);
    const seasonService = app.get(SeasonService);
    const season = seasonService.getCurrentSeason();

    const [summary, grants, achievements] = await Promise.all([
      adminReadonlyService.getSeasonRewardSummary(season.seasonNumber),
      adminReadonlyService.listSeasonRewardGrants(season.seasonNumber, { page: '1', pageSize: '5' }),
      adminReadonlyService.listSeasonAchievements(season.seasonNumber, { page: '1', pageSize: '5' }),
    ]);

    if (summary.seasonNumber !== season.seasonNumber) {
      throw new Error(`Expected summary season ${season.seasonNumber}, got ${String(summary.seasonNumber)}.`);
    }
    if (!grants.pagination || !Array.isArray(grants.items)) {
      throw new Error('Expected reward grants list response.');
    }
    if (!achievements.pagination || !Array.isArray(achievements.items)) {
      throw new Error('Expected achievements list response.');
    }

    console.log(JSON.stringify({
      ok: true,
      seasonNumber: season.seasonNumber,
      totalGrantCount: summary.totalGrantCount,
      totalAchievementCount: summary.totalAchievementCount,
      grantPageCount: grants.items.length,
      achievementPageCount: achievements.items.length,
    }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
