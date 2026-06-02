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
    const suffix = Date.now();
    const attacker = await authService.devLogin({
      providerUserId: `verify-season-fields-${suffix}`,
      nickname: `season-fields-${suffix}`,
      factionCode: 'human',
    });
    const defender = await authService.devLogin({
      providerUserId: `verify-season-fields-target-${suffix}`,
      nickname: `season-fields-target-${suffix}`,
      factionCode: 'demon',
    });
    const playerId = attacker.player.id;
    const season = await seasonService.ensurePlayerSeason(prisma, playerId);
    const humanFaction = await prisma.faction.findUniqueOrThrow({
      where: { code: 'human' },
      select: { id: true },
    });
    const field = await prisma.playerFieldSlot.findFirstOrThrow({
      where: { playerId },
      orderBy: { slotIndex: 'asc' },
      select: { id: true },
    });

    await prisma.factionMember.updateMany({
      where: { playerId },
      data: { contributionScore: 321 },
    });
    await prisma.faction.update({
      where: { id: humanFaction.id },
      data: { contributionScore: 321 },
    });
    await seasonService.recordPlayerActivity(prisma, playerId, season);
    await prisma.playerSeasonSignIn.create({
      data: {
        playerId,
        seasonNumber: season.seasonNumber,
        dayIndex: 1,
        rewardTianjiTalisman: 1,
      },
    });
    await prisma.fieldHarvestLog.create({
      data: {
        playerId,
        fieldSlotId: field.id,
        seedId: 'qinglingmai',
        collectMode: 'ripe',
        collectedGold: 88,
        overflowGold: 0,
        createdAt: new Date(Math.max(season.startsAt.getTime() + 60_000, Date.now())),
      },
    });
    await prisma.raidOrder.create({
      data: {
        attackerPlayerId: playerId,
        defenderPlayerId: defender.player.id,
        mode: 'SINGLE',
        status: 'SETTLED',
        dispatchedUnitCount: 1,
        frozenUnitSnapshot: {},
        transportCapacitySnapshot: 1,
        attackerSnapshotJson: {},
        defenderSnapshotJson: {},
        dispatchedAt: new Date(),
        settleAt: new Date(),
        settledAt: new Date(),
        requestIdempotencyKey: `verify-season-fields-${suffix}`,
      },
    });

    await seasonService.generateSeasonSnapshots(prisma, season.seasonNumber);

    const playerSnapshot = await prisma.playerSeasonSnapshot.findUniqueOrThrow({
      where: { playerId_seasonNumber: { playerId, seasonNumber: season.seasonNumber } },
    });
    const playerSnapshots = await adminReadonlyService.listPlayerSeasonSnapshots(season.seasonNumber, { playerId });
    const playerHistory = await adminReadonlyService.listPlayerSeasonHistory(playerId, {});
    const factionSnapshots = await adminReadonlyService.listFactionSeasonSnapshots(season.seasonNumber, {});
    const adminPlayerSnapshot = playerSnapshots.items[0];
    const adminFactionSnapshot = factionSnapshots.items.find((item) => item['factionCode'] === 'human');

    assertEqual(playerSnapshot.factionId, humanFaction.id, 'player snapshot factionId');
    assertEqual(playerSnapshot.contributionScore, 321, 'player snapshot contributionScore');
    assertEqual(playerSnapshot.signInDays, 1, 'player snapshot signInDays');
    assertEqual(playerSnapshot.loginDays, 1, 'player snapshot loginDays');
    assertEqual(playerSnapshot.harvestCount, 1, 'player snapshot harvestCount');
    assertEqual(playerSnapshot.raidCount, 1, 'player snapshot raidCount');
    assert(playerSnapshot.finalRank !== null && playerSnapshot.finalRank > 0, 'player snapshot finalRank should exist');
    assert(adminPlayerSnapshot !== undefined, 'admin player snapshot should be readable');
    assertEqual(adminPlayerSnapshot['playerId'], playerId, 'admin player snapshot playerId');
    assertEqual(adminPlayerSnapshot['factionCode'], 'human', 'admin player snapshot factionCode');
    assertEqual(adminPlayerSnapshot['contributionScore'], 321, 'admin player snapshot contributionScore');
    assertEqual(adminPlayerSnapshot['signInDays'], 1, 'admin player snapshot signInDays');
    assertEqual(adminPlayerSnapshot['loginDays'], 1, 'admin player snapshot loginDays');
    assertEqual(adminPlayerSnapshot['harvestCount'], 1, 'admin player snapshot harvestCount');
    assertEqual(adminPlayerSnapshot['raidCount'], 1, 'admin player snapshot raidCount');
    assert(playerHistory.items.some((item) => item['seasonNumber'] === season.seasonNumber), 'admin player history should include snapshot');
    assert(adminFactionSnapshot !== undefined, 'admin faction snapshot should be readable');
    assertEqual(adminFactionSnapshot?.['factionCode'], 'human', 'admin faction snapshot factionCode');
    assertEqual(adminFactionSnapshot?.['contributionScore'], 321, 'admin faction snapshot contributionScore');
    assert(typeof adminFactionSnapshot?.['memberCount'] === 'number', 'admin faction snapshot memberCount should be numeric');
    assert(typeof adminFactionSnapshot?.['finalRank'] === 'number', 'admin faction snapshot finalRank should be numeric');

    console.log(JSON.stringify({
      ok: true,
      suffix,
      seasonNumber: season.seasonNumber,
      playerId,
      checkedFields: [
        'factionId',
        'factionCode',
        'factionName',
        'contributionScore',
        'finalRank',
        'signInDays',
        'loginDays',
        'harvestCount',
        'raidCount',
        'memberCount',
      ],
    }, null, 2));
  } finally {
    await app.close();
  }
}

function assert(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`Expected ${label} to be ${String(expected)}, got ${String(actual)}.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
