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

    const stats = await prisma.factionSpiritBattleStat.findMany({
      where: {
        factionId: attackerFaction.factionId ?? '',
        battleCount: { gt: 0 },
      },
      include: {
        spiritDefinition: {
          select: { spiritId: true, label: true },
        },
      },
    });

    assert(stats.length > 0, 'faction spirit battle stats should be written after raid settlement');

    const scenes = await clientReadService.getSceneContent(attackerId);
    assert((scenes.faction.spiritRankings?.length ?? 0) > 0, 'faction scene should expose spiritRankings');

    console.log(JSON.stringify({
      ok: true,
      attacker: attacker.player.nickname,
      defender: defender.player.nickname,
      orderId: raidResponse.result.orderId,
      stats: stats.map((item) => ({
        spiritId: item.spiritDefinition.spiritId,
        spiritName: item.spiritDefinition.label,
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
