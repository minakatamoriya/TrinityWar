import '../config/load-env.js';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../modules/app/app.module.js';
import { AuthService } from '../auth/auth.service.js';
import { ClientReadService } from '../client-read/client-read.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RaidTargetService } from '../raid/raid-target.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const clientReadService = app.get(ClientReadService);
    const raidTargetService = app.get(RaidTargetService);
    const prisma = app.get(PrismaService).db;
    const suffix = Date.now().toString();

    const attacker = await authService.devLogin({
      providerUserId: `dev-spirit-rank-attacker-${suffix}`,
      nickname: `胜率榜攻方${suffix.slice(-4)}`,
      factionCode: 'human',
    });
    const defender = await authService.devLogin({
      providerUserId: `dev-spirit-rank-defender-${suffix}`,
      nickname: `胜率榜守方${suffix.slice(-4)}`,
      factionCode: 'demon',
    });

    const attackerId = attacker.player.id;
    const defenderId = defender.player.id;

    const raidScene = await clientReadService.refreshRaidTargetPool(attackerId);
    const target = raidScene.raid.targets.find((item) => item.targetPlayerId === defenderId);
    assert(target, 'attacker should see defender in refreshed raid target pool');

    const army = await prisma.playerArmy.findUniqueOrThrow({
      where: { playerId: attackerId },
      select: { armyVersion: true },
    });

    const raidResponse = await raidTargetService.createRaidOrder({
      playerId: attackerId,
      targetId: target.id,
      armyVersion: army.armyVersion,
      requestIdempotencyKey: `verify-faction-spirit-rankings-${suffix}`,
    });

    assert(raidResponse.result.orderId, 'raid order should settle and return order id');

    const attackerFaction = await prisma.player.findUniqueOrThrow({
      where: { id: attackerId },
      select: { factionId: true },
    });

    const activeSeason = await prisma.gameSeason.findFirst({
      where: {
        startsAt: { lte: new Date() },
        endsAt: { gt: new Date() },
      },
      select: { seasonNumber: true },
      orderBy: { seasonNumber: 'desc' },
    });
    const attackerMainSpirit = await prisma.playerSpiritSlot.findFirst({
      where: {
        playerId: attackerId,
        isMain: true,
        spiritDefinitionId: { not: null },
        spiritInstanceId: { not: null },
      },
      select: {
        slotIndex: true,
        isMain: true,
        spiritInstanceId: true,
        spiritDefinition: {
          select: {
            id: true,
            spiritId: true,
            label: true,
          },
        },
      },
    });

    assert(activeSeason, 'active season should exist for spirit rankings');
    assert(attackerMainSpirit?.spiritInstanceId, 'attacker main spirit instance should exist');
    assert(attackerMainSpirit.spiritDefinition, 'attacker main spirit definition should exist');

    await prisma.spiritBattleInstanceStat.upsert({
      where: {
        seasonNumber_spiritInstanceId: {
          seasonNumber: activeSeason.seasonNumber,
          spiritInstanceId: attackerMainSpirit.spiritInstanceId,
        },
      },
      create: {
        seasonNumber: activeSeason.seasonNumber,
        factionId: attackerFaction.factionId ?? '',
        playerId: attackerId,
        spiritInstanceId: attackerMainSpirit.spiritInstanceId,
        spiritDefinitionId: attackerMainSpirit.spiritDefinition.id,
        battleCount: 12,
        winCount: 10,
        lossCount: 1,
        drawCount: 1,
        latestSlotIndex: attackerMainSpirit.slotIndex,
        latestIsMain: attackerMainSpirit.isMain,
      },
      update: {
        battleCount: 12,
        winCount: 10,
        lossCount: 1,
        drawCount: 1,
        latestSlotIndex: attackerMainSpirit.slotIndex,
        latestIsMain: attackerMainSpirit.isMain,
      },
    });

    const stats = await prisma.spiritBattleInstanceStat.findMany({
      where: {
        factionId: attackerFaction.factionId ?? '',
        seasonNumber: activeSeason.seasonNumber,
        battleCount: { gte: 10 },
      },
    });

    assert(stats.length > 0, 'spirit battle instance stats should be queryable for the current faction');

    const scenes = await clientReadService.getSceneContent(attackerId);
    assert((scenes.faction.spiritRankings?.length ?? 0) > 0, 'faction scene should expose spiritRankings');

    console.log(JSON.stringify({
      ok: true,
      attacker: attacker.player.nickname,
      defender: defender.player.nickname,
      orderId: raidResponse.result.orderId,
      stats: stats.map((item) => ({
        spiritInstanceId: item.spiritInstanceId,
        battleCount: item.battleCount,
        winCount: item.winCount,
        lossCount: item.lossCount,
        drawCount: item.drawCount,
      })),
      spiritRankings: scenes.faction.spiritRankings?.slice(0, 3) ?? [],
    }, null, 2));
  } finally {
    await app.close();
  }
}

function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
