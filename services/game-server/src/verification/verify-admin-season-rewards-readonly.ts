import { NestFactory } from '@nestjs/core';
import { AdminReadonlyService } from '../admin-readonly/admin-readonly.service.js';
import { AuthService } from '../auth/auth.service.js';
import { AppModule } from '../modules/app/app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SeasonService } from '../season/season.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const adminReadonlyService = app.get(AdminReadonlyService);
    const authService = app.get(AuthService);
    const prisma = app.get(PrismaService).db;
    const seasonService = app.get(SeasonService);
    const season = seasonService.getCurrentSeason();
    const suffix = Date.now();
    const login = await authService.devLogin({
      providerUserId: `verify-admin-season-rewards-${suffix}`,
      nickname: `admin-season-rewards-${suffix}`,
      factionCode: 'human',
    });
    const playerId = login.player.id;

    await prisma.factionMember.updateMany({
      where: { playerId },
      data: { contributionScore: 800 },
    });
    await prisma.playerSeasonSignIn.createMany({
      data: [1, 2, 3].map((dayIndex) => ({
        playerId,
        seasonNumber: season.seasonNumber,
        dayIndex,
        rewardTianjiTalisman: 1,
      })),
      skipDuplicates: true,
    });
    await seasonService.generateSeasonSnapshots(prisma, season.seasonNumber);

    const beforePreviewCounts = await readSeasonRewardCounts(prisma, playerId, season.seasonNumber);
    const preview = await adminReadonlyService.getSeasonRewardPreview(season.seasonNumber, { playerId });
    const afterPreviewCounts = await readSeasonRewardCounts(prisma, playerId, season.seasonNumber);
    const history = await adminReadonlyService.listPlayerSeasonRewardHistory(playerId, {
      seasonNumber: String(season.seasonNumber),
      page: '1',
      pageSize: '10',
    });

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
    if (!history.pagination || history.items.length <= 0) {
      throw new Error('Expected player season reward history rows.');
    }
    if (history.items.some((item) => item['playerId'] !== playerId || item['seasonNumber'] !== season.seasonNumber)) {
      throw new Error('Expected player season reward history to be scoped to the requested player and season.');
    }
    if (!history.items.some((item) => item['rewardType'] === 'contribution_tier' && item['rewardTier'] === 'season-contribution-800')) {
      throw new Error('Expected player reward history to include the contribution tier grant.');
    }
    if (preview['readOnly'] !== true || preview['willWrite'] !== false) {
      throw new Error('Expected reward preview to be marked readonly.');
    }
    if (preview['previewAvailable'] !== true) {
      throw new Error('Expected reward preview to be available after snapshot generation.');
    }
    if (!Array.isArray(preview['rules']) || preview['rules'].length <= 0) {
      throw new Error('Expected reward preview rules.');
    }
    if (!preview['rules'].some((rule) => isRecord(rule) && rule['rewardType'] === 'contribution_tier' && rule['rewardTier'] === 'season-contribution-800')) {
      throw new Error('Expected reward preview to include the contribution tier rule.');
    }
    if (
      beforePreviewCounts.grants !== afterPreviewCounts.grants
      || beforePreviewCounts.achievements !== afterPreviewCounts.achievements
      || beforePreviewCounts.notifications !== afterPreviewCounts.notifications
    ) {
      throw new Error('Expected reward preview not to write grants, achievements, or notifications.');
    }

    console.log(JSON.stringify({
      ok: true,
      playerId,
      seasonNumber: season.seasonNumber,
      totalGrantCount: summary.totalGrantCount,
      totalAchievementCount: summary.totalAchievementCount,
      grantPageCount: grants.items.length,
      achievementPageCount: achievements.items.length,
      playerHistoryCount: history.items.length,
      previewRuleCount: preview['ruleCount'],
    }, null, 2));
  } finally {
    await app.close();
  }
}

async function readSeasonRewardCounts(
  prisma: PrismaService['db'],
  playerId: string,
  seasonNumber: number,
): Promise<{ grants: number; achievements: number; notifications: number }> {
  const [grants, achievements, notifications] = await Promise.all([
    prisma.playerSeasonRewardGrant.count({ where: { playerId, seasonNumber } }),
    prisma.playerSeasonAchievement.count({ where: { playerId, seasonNumber } }),
    prisma.playerNotification.count({ where: { playerId, category: 'REWARD' } }),
  ]);

  return { grants, achievements, notifications };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
