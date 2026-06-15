import { NestFactory } from '@nestjs/core';
import { AuthService } from '../auth/auth.service.js';
import { ClientCommandService } from '../client-command/client-command.service.js';
import { AppModule } from '../modules/app/app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SpiritService } from '../spirit/spirit.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const clientCommandService = app.get(ClientCommandService);
    const prisma = app.get(PrismaService).db;
    const spiritService = app.get(SpiritService);
    const suffix = Date.now().toString();

    const login = await authService.devLogin({
      providerUserId: `verify-new-user-feed-${suffix}`,
      nickname: `feed-${suffix}`,
      factionCode: 'human',
    });
    const playerId = login.player.id;

    const initialState = await spiritService.getSpiritState(playerId);
    const starterEntry = initialState.codex.find((entry) => entry.hasSeen);
    assert(starterEntry, 'new user should have at least one visible starter spirit');
    const composeResult = await spiritService.composeSpirit(playerId, {
      spiritId: starterEntry.spiritId,
      slotIndex: 1,
      element: 'wood',
      requestIdempotencyKey: `verify-new-user-feed-compose-${suffix}`,
    });
    const beforeClaim = composeResult.spirit;
    assertEqual(beforeClaim.spiritRoot ?? 0, 0, 'new user spirit root before stipend');

    const claimResult = await clientCommandService.claimFactionStipend({
      playerId,
      request: {
        walletVersion: 1,
        requestIdempotencyKey: `verify-new-user-feed-stipend-${suffix}`,
      },
      idempotencyKey: `verify-new-user-feed-stipend-${suffix}`,
    });
    const afterClaim = await spiritService.getSpiritState(playerId);
    assertEqual(afterClaim.spiritRoot ?? 0, 10, 'new user spirit root after first stipend');

    const mainSlot = afterClaim.slots.find((slot) => slot.slotIndex === 1 && slot.spiritId !== null);
    assert(mainSlot, 'main slot should exist after tutorial compose');

    const feedResult = await spiritService.feedSpirit(playerId, {
      slotIndex: 1,
      actionType: 'feed_once',
      resourceVersion: afterClaim.resourceVersion,
      slotVersion: mainSlot.slotVersion,
      requestIdempotencyKey: `verify-new-user-feed-action-${suffix}`,
    });
    const persistedResource = await prisma.playerSpiritResource.findUniqueOrThrow({
      where: { playerId },
      select: {
        spiritRoot: true,
      },
    });

    assertEqual(feedResult.spirit.spiritRoot ?? 0, 0, 'response spirit root after feed');
    assertEqual(persistedResource.spiritRoot, 0, 'persisted spirit root after feed');

    console.log(JSON.stringify({
      ok: true,
      playerId,
      starterSpiritId: starterEntry.spiritId,
      stipendRewards: claimResult.rewards,
      beforeClaimSpiritRoot: beforeClaim.spiritRoot ?? 0,
      afterClaimSpiritRoot: afterClaim.spiritRoot ?? 0,
      feedSummary: feedResult.summary,
      afterFeedSpiritRoot: feedResult.spirit.spiritRoot ?? 0,
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
  console.error('verify:new-user-feed failed', error);
  process.exitCode = 1;
});
