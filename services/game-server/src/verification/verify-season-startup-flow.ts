import { NestFactory } from '@nestjs/core';
import { AuthService } from '../auth/auth.service.js';
import { ClientCommandService } from '../client-command/client-command.service.js';
import { ClientReadService } from '../client-read/client-read.service.js';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { AppModule } from '../modules/app/app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SeasonService } from '../season/season.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const clientCommandService = app.get(ClientCommandService);
    const clientReadService = app.get(ClientReadService);
    const prisma = app.get(PrismaService).db;
    const seasonService = app.get(SeasonService);
    const suffix = Date.now();
    const currentSeason = seasonService.getCurrentSeason();
    const previousSeasonNumber = Math.max(currentSeason.seasonNumber - 1, 1);

    if (previousSeasonNumber === currentSeason.seasonNumber) {
      throw new Error('Season startup verification requires current season number to be greater than 1.');
    }

    const keepLogin = await authService.devLogin({
      providerUserId: `verify-season-startup-keep-${suffix}`,
      nickname: `season-startup-keep-${suffix}`,
      factionCode: 'human',
    });
    const keepPlayerId = keepLogin.player.id;
    await preparePreviousSeasonPlayer(clientReadService, prisma, keepPlayerId, previousSeasonNumber);

    const keepBootstrap = await clientReadService.getBootstrap(keepPlayerId);
    if (!keepBootstrap.season.startup?.blocking || keepBootstrap.season.startup.currentStep !== 'season-intro') {
      throw new Error('Expected rollover bootstrap to block on season intro.');
    }
    if (keepBootstrap.season.startup.factionChoiceStatus !== 'available') {
      throw new Error('Expected faction choice to be available after rollover.');
    }

    await assertBusinessConflict(
      () => clientCommandService.confirmSeasonFaction({ playerId: keepPlayerId }),
      'Expected faction confirmation to reject before intro confirmation.',
    );

    const introResult = await clientCommandService.confirmSeasonStartupIntro({ playerId: keepPlayerId });
    if (!introResult.startup.introConfirmed || introResult.startup.currentStep !== 'faction-confirm' || introResult.startup.completed) {
      throw new Error('Expected intro confirmation to advance to faction confirmation.');
    }

    const keepResult = await clientCommandService.confirmSeasonFaction({ playerId: keepPlayerId });
    if (!keepResult.startup.completed || keepResult.startup.blocking || keepResult.startup.factionChoiceStatus !== 'used') {
      throw new Error('Expected keeping current faction to complete startup flow.');
    }

    await assertBusinessConflict(
      () => clientCommandService.changeSeasonFaction({
        playerId: keepPlayerId,
        request: { factionCode: 'demon' },
      }),
      'Expected second faction choice in same season to be rejected.',
    );

    const changeLogin = await authService.devLogin({
      providerUserId: `verify-season-startup-change-${suffix}`,
      nickname: `season-startup-change-${suffix}`,
      factionCode: 'human',
    });
    const changePlayerId = changeLogin.player.id;
    await preparePreviousSeasonPlayer(clientReadService, prisma, changePlayerId, previousSeasonNumber);
    await clientCommandService.confirmSeasonStartupIntro({ playerId: changePlayerId });
    const changeResult = await clientCommandService.changeSeasonFaction({
      playerId: changePlayerId,
      request: { factionCode: 'demon' },
    });

    if (!changeResult.startup.completed || changeResult.startup.factionChoiceStatus !== 'used') {
      throw new Error('Expected changing faction to complete startup flow.');
    }

    const changedPlayer = await prisma.player.findUniqueOrThrow({
      where: { id: changePlayerId },
      select: {
        faction: { select: { code: true } },
        factionMembers: {
          select: {
            contributionScore: true,
            faction: { select: { code: true } },
          },
        },
      },
    });

    if (changedPlayer.faction?.code !== 'demon' || changedPlayer.factionMembers[0]?.faction.code !== 'demon') {
      throw new Error('Expected player and faction membership to move to demon faction.');
    }
    if (changedPlayer.factionMembers[0]?.contributionScore !== 0) {
      throw new Error('Expected new faction membership contribution to start at 0.');
    }

    console.log(JSON.stringify({
      ok: true,
      suffix,
      seasonNumber: currentSeason.seasonNumber,
      previousSeasonNumber,
    }, null, 2));
  } finally {
    await app.close();
  }
}

async function preparePreviousSeasonPlayer(
  clientReadService: ClientReadService,
  prisma: PrismaService['db'],
  playerId: string,
  previousSeasonNumber: number,
): Promise<void> {
  await clientReadService.getBootstrap(playerId);
  await prisma.playerSeasonState.update({
    where: { playerId },
    data: {
      currentSeasonNumber: previousSeasonNumber,
      lastResetSeasonNumber: previousSeasonNumber,
      startupIntroConfirmedSeasonNumber: previousSeasonNumber,
      startupCompletedSeasonNumber: previousSeasonNumber,
      factionChoiceRequiredSeasonNumber: null,
      factionChoiceUsedSeasonNumber: null,
      factionChoiceUsedAt: null,
    },
  });
}

async function assertBusinessConflict(action: () => Promise<unknown>, message: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (error instanceof BusinessError && error.code === ErrorCode.Conflict) {
      return;
    }
    throw error;
  }

  throw new Error(message);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
