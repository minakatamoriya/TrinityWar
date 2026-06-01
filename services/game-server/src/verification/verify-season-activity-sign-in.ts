import { NestFactory } from '@nestjs/core';
import { AuthService } from '../auth/auth.service.js';
import { ClientCommandService } from '../client-command/client-command.service.js';
import { ClientReadService } from '../client-read/client-read.service.js';
import { AppModule } from '../modules/app/app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SeasonService } from '../season/season.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const clientReadService = app.get(ClientReadService);
    const clientCommandService = app.get(ClientCommandService);
    const seasonService = app.get(SeasonService);
    const prisma = app.get(PrismaService).db;
    const suffix = Date.now();
    const login = await authService.devLogin({
      providerUserId: `verify-season-sign-in-${suffix}`,
      nickname: `season-sign-in-${suffix}`,
      factionCode: 'human',
    });
    const playerId = login.player.id;

    const bootstrap = await clientReadService.getBootstrap(playerId);
    const initialSignIn = await clientReadService.getSeasonSignIn(playerId);
    const initialResource = await prisma.playerSpiritResource.findUniqueOrThrow({
      where: { playerId },
      select: { tianjiTalisman: true },
    });
    const claim = await clientCommandService.claimSeasonSignIn({ playerId });
    const duplicateRejected = await clientCommandService.claimSeasonSignIn({ playerId })
      .then(() => false)
      .catch(() => true);
    const currentSeason = seasonService.getCurrentSeason();
    const activityCount = await prisma.playerSeasonActivity.count({
      where: { playerId, seasonNumber: currentSeason.seasonNumber },
    });
    const signInCount = await prisma.playerSeasonSignIn.count({
      where: { playerId, seasonNumber: currentSeason.seasonNumber },
    });
    await seasonService.generateSeasonSnapshots(prisma, currentSeason.seasonNumber);
    const snapshot = await prisma.playerSeasonSnapshot.findUniqueOrThrow({
      where: { playerId_seasonNumber: { playerId, seasonNumber: currentSeason.seasonNumber } },
      select: { signInDays: true, loginDays: true },
    });

    if (bootstrap.season.seasonNumber !== currentSeason.seasonNumber) {
      throw new Error('Expected bootstrap season to match current season.');
    }
    if (initialSignIn.claimedToday) {
      throw new Error('Expected fresh verifier player to have no sign-in today.');
    }
    if (claim.tianjiTalisman !== initialResource.tianjiTalisman + claim.rewardTianjiTalisman) {
      throw new Error('Expected sign-in reward to update tianji talisman balance.');
    }
    if (!claim.signIn.claimedToday || claim.signIn.claimedDays.length !== 1) {
      throw new Error('Expected claim response to include claimed sign-in state.');
    }
    if (!duplicateRejected) {
      throw new Error('Expected duplicate sign-in claim to be rejected.');
    }
    if (activityCount < 1 || signInCount !== 1) {
      throw new Error(`Expected activity>=1 and signIn=1, got activity=${activityCount}, signIn=${signInCount}.`);
    }
    if (snapshot.signInDays < 1 || snapshot.loginDays < 1) {
      throw new Error(`Expected snapshot to include real sign-in/login days, got ${snapshot.signInDays}/${snapshot.loginDays}.`);
    }

    console.log(JSON.stringify({
      ok: true,
      suffix,
      seasonNumber: currentSeason.seasonNumber,
      playerId,
      rewardTianjiTalisman: claim.rewardTianjiTalisman,
      tianjiTalisman: claim.tianjiTalisman,
      signInDays: snapshot.signInDays,
      loginDays: snapshot.loginDays,
    }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
