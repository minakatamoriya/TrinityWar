import { setTimeout as delay } from 'node:timers/promises';
import { NestFactory } from '@nestjs/core';
import { AuthService } from '../auth/auth.service.js';
import { ClientReadService } from '../client-read/client-read.service.js';
import { AppModule } from '../modules/app/app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SeasonService } from '../season/season.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const clientReadService = app.get(ClientReadService);
    const prisma = app.get(PrismaService).db;
    const seasonService = app.get(SeasonService);
    const suffix = Date.now();
    const currentSeason = seasonService.getCurrentSeason();

    const forcedLogin = await authService.devLogin({
      providerUserId: `verify-season-comp-disabled-${suffix}`,
      nickname: `season-comp-disabled-${suffix}`,
      factionCode: 'human',
    });
    const playerId = forcedLogin.player.id;
    await clientReadService.getBootstrap(playerId);
    await plantInterruptedField(prisma, playerId, 321);

    seasonService.setDevelopmentSeasonNearRollover(new Date(), 1_000, currentSeason.seasonNumber);
    await delay(1_150);

    const bootstrap = await clientReadService.getBootstrap(playerId);
    if (!bootstrap.season.transition?.resetApplied) {
      throw new Error('Expected forced rollover to apply player reset.');
    }

    const compensationCount = await prisma.playerNotification.count({
      where: {
        playerId,
        OR: [
          { titleSnapshot: { contains: '异常重启补偿' } },
          { titleSnapshot: { contains: '灵田补偿' } },
          { bodySnapshot: { contains: '灵田金币生成补偿' } },
          { bodySnapshot: { contains: '可领取的灵田金币' } },
        ],
      },
    });

    if (compensationCount !== 0) {
      throw new Error('Expected season rollover not to create automatic field compensation notifications.');
    }

    const field = await prisma.playerFieldSlot.findFirstOrThrow({
      where: { playerId, isUnlocked: true },
      select: {
        status: true,
        seedDefinitionId: true,
        currentClaimableGold: true,
      },
    });

    if (field.status !== 'EMPTY' || field.seedDefinitionId !== null || field.currentClaimableGold !== 0) {
      throw new Error('Expected interrupted field to be cleared without automatic compensation.');
    }

    console.log(JSON.stringify({
      ok: true,
      suffix,
      seasonNumber: bootstrap.season.seasonNumber,
      automaticCompensation: false,
    }, null, 2));
  } finally {
    await app.close();
  }
}

async function plantInterruptedField(
  prisma: PrismaService['db'],
  playerId: string,
  currentClaimableGold: number,
): Promise<void> {
  const seedDefinition = await prisma.seedDefinition.findFirstOrThrow({
    select: { id: true },
  });
  const field = await prisma.playerFieldSlot.findFirstOrThrow({
    where: { playerId, isUnlocked: true },
    orderBy: { slotIndex: 'asc' },
    select: { id: true },
  });

  await prisma.playerFieldSlot.update({
    where: { id: field.id },
    data: {
      status: 'GROWING',
      seedDefinitionId: seedDefinition.id,
      currentClaimableGold,
      seedAt: new Date(),
      lastCalculatedAt: new Date(),
    },
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
