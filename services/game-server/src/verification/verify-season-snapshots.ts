import { NestFactory } from '@nestjs/core';
import { AdminReadonlyService } from '../admin-readonly/admin-readonly.service.js';
import { AuthService } from '../auth/auth.service.js';
import { AppModule } from '../modules/app/app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SeasonService } from '../season/season.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const adminReadonlyService = app.get(AdminReadonlyService);
    const prisma = app.get(PrismaService).db;
    const seasonService = app.get(SeasonService);
    const suffix = Date.now();
    const login = await authService.devLogin({
      providerUserId: `verify-season-snapshot-${suffix}`,
      nickname: `season-snapshot-${suffix}`,
      factionCode: 'human',
    });
    const currentSeason = seasonService.getCurrentSeason();

    await prisma.factionMember.updateMany({
      where: { playerId: login.player.id },
      data: { contributionScore: 456 },
    });
    await prisma.faction.updateMany({
      where: { players: { some: { id: login.player.id } } },
      data: { contributionScore: 456 },
    });

    const result = await seasonService.generateSeasonSnapshots(prisma, currentSeason.seasonNumber);
    const playerSnapshots = await adminReadonlyService.listPlayerSeasonSnapshots(currentSeason.seasonNumber, {
      playerId: login.player.id,
    });
    const factionSnapshots = await adminReadonlyService.listFactionSeasonSnapshots(currentSeason.seasonNumber, {});
    const playerHistory = await adminReadonlyService.listPlayerSeasonHistory(login.player.id, {});

    if (result.playerSnapshotCount <= 0 || result.factionSnapshotCount <= 0) {
      throw new Error('Expected season snapshot generation to include players and factions.');
    }
    if (playerSnapshots.items.length !== 1) {
      throw new Error(`Expected one player snapshot, got ${playerSnapshots.items.length}.`);
    }
    if (playerSnapshots.items[0]?.['contributionScore'] !== 456) {
      throw new Error(`Expected contribution snapshot 456, got ${String(playerSnapshots.items[0]?.['contributionScore'])}.`);
    }
    if (factionSnapshots.items.length <= 0) {
      throw new Error('Expected faction snapshots.');
    }
    if (!playerHistory.items.some((item) => item['seasonNumber'] === currentSeason.seasonNumber)) {
      throw new Error('Expected player season history to include current season snapshot.');
    }

    console.log(JSON.stringify({
      ok: true,
      suffix,
      seasonNumber: currentSeason.seasonNumber,
      playerSnapshotCount: result.playerSnapshotCount,
      factionSnapshotCount: result.factionSnapshotCount,
      playerId: login.player.id,
    }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
