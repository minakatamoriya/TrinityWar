import { NestFactory } from '@nestjs/core';
import { AuthService } from '../auth/auth.service.js';
import { ClientReadService } from '../client-read/client-read.service.js';
import { AppModule } from '../modules/app/app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

const TUTORIAL_TARGET_PROVIDER_USER_ID = 'dev-tutorial-target';
const TUTORIAL_TARGET_NAME = '守田人';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const clientReadService = app.get(ClientReadService);
    const prisma = app.get(PrismaService).db;
    const suffix = Date.now();

    const newPlayer = await authService.devLogin({
      providerUserId: `dev-ui-verify-${suffix}`,
      nickname: `tutorial-${suffix}`,
      factionCode: 'human',
    });
    const newPlayerScenes = await clientReadService.getSceneContent(newPlayer.player.id);
    assertEqual(newPlayerScenes.raid.targets.length, 1, 'new tutorial player target count');
    assertEqual(newPlayerScenes.raid.targets[0]?.name, TUTORIAL_TARGET_NAME, 'new tutorial player target name');
    assertEqual(newPlayerScenes.raid.targets[0]?.tutorialTarget, true, 'new tutorial player tutorial flag');

    const newPlayerPoolRows = await prisma.raidTargetPool.findMany({
      where: { ownerPlayerId: newPlayer.player.id, expiresAt: { gt: new Date() } },
      include: {
        targetPlayer: {
          select: {
            nickname: true,
            factionId: true,
            authIdentities: {
              select: {
                provider: true,
                providerUserId: true,
              },
            },
          },
        },
      },
    });
    assertEqual(newPlayerPoolRows.length, 1, 'new tutorial player pool row count');
    assert(
      newPlayerPoolRows[0]?.targetPlayer.authIdentities.some((identity) => (
        identity.provider === 'DEV_FAKE'
        && identity.providerUserId === TUTORIAL_TARGET_PROVIDER_USER_ID
      )),
      'new tutorial player should target the tutorial account',
    );
    assertEqual(newPlayerPoolRows[0]?.targetPlayer.factionId, null, 'tutorial target should not belong to a faction');

    const existingPlayer = await authService.devLogin({
      providerUserId: 'dev-main-loop',
      nickname: '主循环测试号',
      factionCode: 'immortal',
    });
    const existingPlayerScenes = await clientReadService.refreshRaidTargetPool(existingPlayer.player.id);
    const existingPlayerState = await prisma.player.findUniqueOrThrow({
      where: { id: existingPlayer.player.id },
      select: { factionId: true },
    });
    assert(
      existingPlayerScenes.raid.targets.every((target) => target.name !== TUTORIAL_TARGET_NAME && target.tutorialTarget !== true),
      'existing player refresh should not show tutorial target',
    );

    const existingPlayerTutorialRows = await prisma.raidTargetPool.count({
      where: {
        ownerPlayerId: existingPlayer.player.id,
        expiresAt: { gt: new Date() },
        targetPlayer: {
          authIdentities: {
            some: {
              provider: 'DEV_FAKE',
              providerUserId: TUTORIAL_TARGET_PROVIDER_USER_ID,
            },
          },
        },
      },
    });
    assertEqual(existingPlayerTutorialRows, 0, 'existing player tutorial pool rows');

    const existingPlayerPoolRows = await prisma.raidTargetPool.findMany({
      where: {
        ownerPlayerId: existingPlayer.player.id,
        expiresAt: { gt: new Date() },
      },
      select: {
        targetPlayer: {
          select: {
            factionId: true,
            nickname: true,
          },
        },
      },
    });
    assert(
      existingPlayerPoolRows.every((row) => row.targetPlayer.factionId && row.targetPlayer.factionId !== existingPlayerState.factionId),
      'existing player targets should all be opposing faction players',
    );

    console.log(JSON.stringify({
      ok: true,
      newPlayer: newPlayer.player.nickname,
      newPlayerTarget: newPlayerScenes.raid.targets[0]?.name,
      existingPlayer: existingPlayer.player.nickname,
      existingPlayerTargetCount: existingPlayerScenes.raid.targets.length,
    }, null, 2));
  } finally {
    await app.close();
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

main().catch((error: unknown) => {
  console.error('verify:tutorial-raid-targets failed', error);
  process.exitCode = 1;
});
