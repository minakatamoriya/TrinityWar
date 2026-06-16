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
    const login = await authService.devLogin({
      providerUserId: `verify-season-${suffix}`,
      nickname: `season-${suffix}`,
      factionCode: 'human',
    });
    const playerId = login.player.id;
    const currentSeason = seasonService.getCurrentSeason();

    await clientReadService.getBootstrap(playerId);
    await prisma.playerSeasonState.update({
      where: { playerId },
      data: {
        currentSeasonNumber: Math.max(currentSeason.seasonNumber - 1, 1),
        lastResetSeasonNumber: Math.max(currentSeason.seasonNumber - 1, 1),
      },
    });

    const spiritDefinition = await prisma.spiritDefinition.findFirstOrThrow({
      select: {
        id: true,
        baseHp: true,
      },
    });
    await prisma.playerSpiritSlot.updateMany({
      where: { playerId, isMain: true },
      data: { isMain: false },
    });
    const firstSlot = await prisma.playerSpiritSlot.upsert({
      where: { playerId_slotIndex: { playerId, slotIndex: 1 } },
      create: {
        playerId,
        slotIndex: 1,
        spiritDefinitionId: spiritDefinition.id,
        isMain: true,
        element: 'WOOD',
        level: 1,
        exp: 0,
        maxHp: spiritDefinition.baseHp,
        acquiredAt: new Date(),
      },
      update: {
        spiritDefinitionId: spiritDefinition.id,
        isMain: true,
        element: 'WOOD',
        maxHp: spiritDefinition.baseHp,
        dissolvedAt: null,
      },
      select: { id: true },
    });

    await prisma.factionMember.updateMany({
      where: { playerId },
      data: { contributionScore: 777 },
    });
    await prisma.playerFieldSlot.updateMany({
      where: { playerId, isUnlocked: true },
      data: {
        status: 'GROWING',
        investedGold: 123,
        currentClaimableGold: 45,
      },
    });
    await prisma.playerSpiritSlot.update({
      where: { id: firstSlot.id },
      data: {
        level: 9,
        exp: 50,
        breakthroughStage: 1,
        maxHp: 999,
      },
    });
    await prisma.playerSpiritTrait.upsert({
      where: { spiritSlotId_slotIndex: { spiritSlotId: firstSlot.id, slotIndex: 0 } },
      create: {
        spiritSlotId: firstSlot.id,
        slotIndex: 0,
        traitCode: 'verify_trait',
        traitValue: 12,
        sourceType: 'verify',
      },
      update: {
        traitCode: 'verify_trait',
        traitValue: 12,
        sourceType: 'verify',
      },
    });

    const bootstrap = await clientReadService.getBootstrap(playerId);
    const previousSeasonNumber = Math.max(currentSeason.seasonNumber - 1, 1);
    const previousSeasonSnapshot = await prisma.playerSeasonSnapshot.findUniqueOrThrow({
      where: {
        playerId_seasonNumber: {
          playerId,
          seasonNumber: previousSeasonNumber,
        },
      },
      select: {
        contributionScore: true,
      },
    });
    const seasonState = await prisma.playerSeasonState.findUniqueOrThrow({ where: { playerId } });
    const factionMember = await prisma.factionMember.findFirstOrThrow({ where: { playerId } });
    const fields = await prisma.playerFieldSlot.findMany({ where: { playerId, isUnlocked: true } });
    const slot = await prisma.playerSpiritSlot.findUniqueOrThrow({
      where: { id: firstSlot.id },
      include: { traits: true },
    });

    if (bootstrap.season.seasonNumber !== currentSeason.seasonNumber || seasonState.lastResetSeasonNumber !== currentSeason.seasonNumber) {
      throw new Error('Expected player season state to advance to current season.');
    }
    if (previousSeasonSnapshot.contributionScore !== 777) {
      throw new Error(`Expected previous season snapshot to preserve contribution 777 before reset, got ${previousSeasonSnapshot.contributionScore}.`);
    }
    if (factionMember.contributionScore !== 0) {
      throw new Error(`Expected faction contribution reset to 0, got ${factionMember.contributionScore}.`);
    }
    if (fields.some((field) => field.status !== 'EMPTY' || field.seedDefinitionId !== null || field.investedGold !== 0 || field.currentClaimableGold !== 0)) {
      throw new Error('Expected unlocked fields to reset to empty state.');
    }
    if (slot.level !== 1 || slot.exp !== 0 || slot.breakthroughStage !== 0 || slot.maxHp !== spiritDefinition.baseHp) {
      throw new Error('Expected spirit level/progress to reset to level 1 base state.');
    }
    if (!slot.traits.some((trait) => trait.traitCode === 'verify_trait' && trait.traitValue === 12)) {
      throw new Error('Expected spirit traits to be retained.');
    }

    console.log(JSON.stringify({ ok: true, suffix, seasonNumber: currentSeason.seasonNumber }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
