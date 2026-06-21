import { NestFactory } from '@nestjs/core';
import { ClientCommandService } from '../client-command/client-command.service.js';
import { ClientReadService } from '../client-read/client-read.service.js';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { AppModule } from '../modules/app/app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { SeasonService } from '../season/season.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const clientCommandService = app.get(ClientCommandService);
    const clientReadService = app.get(ClientReadService);
    const seasonService = app.get(SeasonService);
    const prisma = app.get(PrismaService).db;
    const suffix = Date.now();
    const login = await authService.devLogin({
      providerUserId: `verify-season-guard-${suffix}`,
      nickname: `season-guard-${suffix}`,
      factionCode: 'human',
    });
    const playerId = login.player.id;
    const currentSeason = seasonService.getCurrentSeason();
    const previousSeasonNumber = Math.max(currentSeason.seasonNumber - 1, 1);

    await clientReadService.getBootstrap(playerId);

    const seedDefinition = await prisma.seedDefinition.findFirstOrThrow({
      select: { id: true },
    });
    const field = await prisma.playerFieldSlot.findFirstOrThrow({
      where: { playerId, isUnlocked: true },
      orderBy: { slotIndex: 'asc' },
      select: {
        id: true,
        statusVersion: true,
      },
    });
    const wallet = await prisma.playerWallet.findUniqueOrThrow({
      where: { playerId },
      select: {
        balanceVersion: true,
      },
    });

    await prisma.playerSeasonState.update({
      where: { playerId },
      data: {
        currentSeasonNumber: previousSeasonNumber,
        lastResetSeasonNumber: previousSeasonNumber,
      },
    });
    await prisma.factionMember.updateMany({
      where: { playerId },
      data: {
        contributionScore: 456,
      },
    });
    await prisma.playerFieldSlot.update({
      where: { id: field.id },
      data: {
        status: 'MATURE',
        seedDefinitionId: seedDefinition.id,
        investedGold: 123,
        currentClaimableGold: 88,
      },
    });

    let rejected = false;
    try {
      await clientCommandService.collectField({
        playerId,
        request: {
          fieldId: field.id,
          collectMode: 'ripe',
          fieldVersion: field.statusVersion,
          walletVersion: wallet.balanceVersion,
        },
      });
    } catch (error) {
      if (!(error instanceof BusinessError) || error.code !== ErrorCode.SeasonRolledOver) {
        throw error;
      }

      rejected = true;
    }

    const refreshedSeasonState = await prisma.playerSeasonState.findUniqueOrThrow({
      where: { playerId },
    });
    const refreshedField = await prisma.playerFieldSlot.findUniqueOrThrow({
      where: { id: field.id },
      select: {
        status: true,
        seedDefinitionId: true,
        investedGold: true,
        currentClaimableGold: true,
      },
    });
    const refreshedWallet = await prisma.playerWallet.findUniqueOrThrow({
      where: { playerId },
      select: {
        vaultGold: true,
        walletGold: true,
      },
    });
    const bootstrap = await clientReadService.getBootstrap(playerId);

    if (!rejected) {
      throw new Error('Expected old-season collect request to be rejected with SEASON_ROLLED_OVER.');
    }
    if (refreshedSeasonState.lastResetSeasonNumber !== currentSeason.seasonNumber) {
      throw new Error('Expected guard request to advance player season state before rejecting old action.');
    }
    if (refreshedField.status !== 'EMPTY' || refreshedField.seedDefinitionId !== null || refreshedField.investedGold !== 0 || refreshedField.currentClaimableGold !== 0) {
      throw new Error('Expected old-season field to be cleared by reset before command rejection.');
    }
    if (refreshedWallet.vaultGold !== 0 || refreshedWallet.walletGold !== 0) {
      throw new Error('Expected old-season collect request to avoid granting stale gold.');
    }
    if (bootstrap.season.seasonNumber !== currentSeason.seasonNumber) {
      throw new Error('Expected bootstrap after guard rejection to expose current season.');
    }

    console.log(JSON.stringify({
      ok: true,
      suffix,
      playerId,
      seasonNumber: currentSeason.seasonNumber,
      previousSeasonNumber,
      errorCode: ErrorCode.SeasonRolledOver,
    }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
