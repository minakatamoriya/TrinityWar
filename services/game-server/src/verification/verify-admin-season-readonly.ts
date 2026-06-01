import { NestFactory } from '@nestjs/core';
import { AdminReadonlyService } from '../admin-readonly/admin-readonly.service.js';
import { AuthService } from '../auth/auth.service.js';
import { AppModule } from '../modules/app/app.module.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const adminReadonlyService = app.get(AdminReadonlyService);
    const suffix = Date.now();
    const login = await authService.devLogin({
      providerUserId: `verify-admin-season-${suffix}`,
      nickname: `admin-season-${suffix}`,
      factionCode: 'human',
    });

    const current = await adminReadonlyService.getCurrentSeasonAdmin();
    const seasons = await adminReadonlyService.listSeasons({ pageSize: '10' });
    const playerState = await adminReadonlyService.getPlayerSeasonState(login.player.id);

    assertNumber(current.seasonNumber, 'current.seasonNumber');
    assertNumber(current.currentWeek, 'current.currentWeek');
    assertNumber(current.totalWeeks, 'current.totalWeeks');
    if (seasons.items.length <= 0) {
      throw new Error('Expected admin season list to include at least one season.');
    }
    if (playerState.playerId !== login.player.id) {
      throw new Error(`Expected player season state for ${login.player.id}.`);
    }
    if (playerState.currentSeasonNumber !== current.seasonNumber) {
      throw new Error('Expected player season state to match current season.');
    }

    console.log(JSON.stringify({
      ok: true,
      suffix,
      seasonNumber: current.seasonNumber,
      seasonCount: seasons.pagination.total,
      playerId: login.player.id,
    }, null, 2));
  } finally {
    await app.close();
  }
}

function assertNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Expected ${label} to be a number.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
