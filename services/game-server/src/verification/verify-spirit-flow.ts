import { NestFactory } from '@nestjs/core';
import type { SpiritDefinition } from '@prisma/client';
import { AuthService } from '../auth/auth.service.js';
import { AppModule } from '../modules/app/app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SpiritService } from '../spirit/spirit.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const prisma = app.get(PrismaService).db;
    const spiritService = app.get(SpiritService);
    const suffix = Date.now().toString();
    const login = await authService.devLogin({
      providerUserId: `verify-spirit-flow-${suffix}`,
      nickname: `spirit-flow-${suffix}`,
      factionCode: 'human',
    });
    const playerId = login.player.id;
    const definitions = await prisma.spiritDefinition.findMany({
      orderBy: [{ sortOrder: 'asc' }, { spiritId: 'asc' }],
    });
    const mainDefinition = mustFindDefinition(definitions, 'canglang') ?? definitions[0];
    const secondaryDefinition = mustFindDefinition(definitions, 'linglu') ?? definitions[1];
    const composeDefinition = definitions.find((definition) => (
      definition.id !== mainDefinition.id && definition.id !== secondaryDefinition.id
    )) ?? definitions[2];

    assert(mainDefinition && secondaryDefinition && composeDefinition, 'at least three spirit definitions are required');
    await prepareSpiritState(prisma, playerId, mainDefinition, secondaryDefinition, composeDefinition);

    const initialState = await spiritService.getSpiritStateResponse(playerId);
    assertEqual(initialState.spirit.slots.length, 5, 'spirit slot count');
    assertEqual(initialState.spirit.mainSlot?.slotIndex, 1, 'initial main slot');
    assert(initialState.spirit.readyToCompose.some((entry) => entry.spiritId === composeDefinition.spiritId), 'compose spirit should be ready');

    const slot2BeforeSetMain = await readSlot(prisma, playerId, 2);
    const setMainResponse = await spiritService.setMainSpirit(playerId, {
      slotIndex: 2,
      slotVersion: slot2BeforeSetMain.slotVersion,
      requestIdempotencyKey: `verify-spirit-set-main-${suffix}`,
    });
    assertEqual(setMainResponse.spirit.mainSlot?.slotIndex, 2, 'main slot after set-main response');
    const [slot1AfterSetMain, slot2AfterSetMain] = await Promise.all([
      readSlot(prisma, playerId, 1),
      readSlot(prisma, playerId, 2),
    ]);
    assertEqual(slot1AfterSetMain.isMain, false, 'slot 1 should no longer be main');
    assertEqual(slot2AfterSetMain.isMain, true, 'slot 2 should be main');

    await assertRejects(
      () => spiritService.dissolveSpirit(playerId, {
        slotIndex: 2,
        slotVersion: slot2AfterSetMain.slotVersion,
        requestIdempotencyKey: `verify-spirit-dissolve-main-${suffix}`,
      }),
      'main spirit dissolve should be rejected',
    );

    const resourceBeforeDissolve = await readSpiritResource(prisma, playerId);
    const slot1BeforeDissolve = await readSlot(prisma, playerId, 1);
    const dissolveResponse = await spiritService.dissolveSpirit(playerId, {
      slotIndex: 1,
      slotVersion: slot1BeforeDissolve.slotVersion,
      requestIdempotencyKey: `verify-spirit-dissolve-${suffix}`,
    });
    assert(!dissolveResponse.spirit.slots.find((slot) => slot.slotIndex === 1)?.spiritId, 'slot 1 should be empty after dissolve response');
    const [slot1AfterDissolve, resourceAfterDissolve, mainCodexAfterDissolve] = await Promise.all([
      readSlot(prisma, playerId, 1),
      readSpiritResource(prisma, playerId),
      readCodex(prisma, playerId, mainDefinition.id),
    ]);
    assertEqual(slot1AfterDissolve.spiritDefinitionId, null, 'dissolved slot should be empty in database');
    assertAtLeast(resourceAfterDissolve.spiritSoul, resourceBeforeDissolve.spiritSoul, 'spirit soul should not decrease after dissolve');
    assertEqual(mainCodexAfterDissolve.ownedCurrent, false, 'dissolved spirit should no longer be currently owned');
    assertEqual(mainCodexAfterDissolve.ownedEver, true, 'dissolved spirit should remain owned ever');

    const composeResponse = await spiritService.composeSpirit(playerId, {
      spiritId: composeDefinition.spiritId,
      slotIndex: 1,
      element: 'fire',
      requestIdempotencyKey: `verify-spirit-compose-${suffix}`,
    });
    const composedSlot = composeResponse.spirit.slots.find((slot) => slot.slotIndex === 1);
    assertEqual(composedSlot?.spiritId, composeDefinition.spiritId, 'slot 1 should hold composed spirit');
    assertEqual(composedSlot?.element, 'fire', 'composed spirit element');
    assertEqual(composeResponse.spirit.mainSlot?.slotIndex, 2, 'compose should preserve existing main slot');
    const [slot1AfterCompose, composeCodexAfter] = await Promise.all([
      readSlot(prisma, playerId, 1),
      readCodex(prisma, playerId, composeDefinition.id),
    ]);
    assertEqual(slot1AfterCompose.spiritDefinitionId, composeDefinition.id, 'composed slot database spirit');
    assertEqual(slot1AfterCompose.isMain, false, 'composed slot should not steal main slot');
    assertEqual(slot1AfterCompose.element, 'FIRE', 'composed slot database element');
    assertEqual(composeCodexAfter.ownedCurrent, true, 'composed spirit should be owned current');
    assertEqual(composeCodexAfter.readyToCompose, false, 'composed spirit ready flag should clear');
    assertEqual(composeCodexAfter.shardCount, 0, 'compose should consume exact required shard count');

    console.log(JSON.stringify({
      ok: true,
      playerId,
      definitions: {
        main: mainDefinition.spiritId,
        secondary: secondaryDefinition.spiritId,
        composed: composeDefinition.spiritId,
      },
      operations: ['get-spirit', 'set-main', 'dissolve-main-reject', 'dissolve', 'compose'],
      finalMainSlot: composeResponse.spirit.mainSlot?.slotIndex,
    }, null, 2));
  } finally {
    await app.close();
  }
}

type PrismaDb = PrismaService['db'];

async function prepareSpiritState(
  prisma: PrismaDb,
  playerId: string,
  mainDefinition: SpiritDefinition,
  secondaryDefinition: SpiritDefinition,
  composeDefinition: SpiritDefinition,
): Promise<void> {
  const now = new Date();
  await prisma.$transaction(async (client) => {
    await client.playerSpiritResource.upsert({
      where: { playerId },
      create: {
        playerId,
        spiritSoul: 100,
        ordinarySoul: 50,
        rareSoul: 20,
        legendarySoul: 5,
        tianjiTalisman: 10,
      },
      update: {
        spiritSoul: 100,
        ordinarySoul: 50,
        rareSoul: 20,
        legendarySoul: 5,
        tianjiTalisman: 10,
        dailyIntelFreeUsed: 0,
        dailyIntelTalismanUsed: 0,
        dailyIntelDateKey: null,
        resourceVersion: { increment: 1 },
      },
    });

    for (let slotIndex = 1; slotIndex <= 5; slotIndex += 1) {
      const definition = slotIndex === 1 ? mainDefinition : slotIndex === 2 ? secondaryDefinition : null;
      const maxHp = definition ? calculateSpiritMaxHp(definition.baseHp, definition.growthHp, 3) : 0;
      await client.playerSpiritSlot.upsert({
        where: { playerId_slotIndex: { playerId, slotIndex } },
        create: {
          playerId,
          slotIndex,
          spiritDefinitionId: definition?.id ?? null,
          isMain: slotIndex === 1,
          level: definition ? 3 : 1,
          exp: 0,
          element: definition ? (slotIndex === 1 ? 'WOOD' : 'WATER') : null,
          maxHp,
          acquiredAt: definition ? now : null,
          dissolvedAt: definition ? null : now,
          slotVersion: 1,
        },
        update: {
          spiritDefinitionId: definition?.id ?? null,
          isMain: slotIndex === 1,
          level: definition ? 3 : 1,
          exp: 0,
          breakthroughStage: 0,
          satiatedUntil: null,
          lastExpSettledAt: definition ? now : null,
          element: definition ? (slotIndex === 1 ? 'WOOD' : 'WATER') : null,
          maxHp,
          acquiredAt: definition ? now : null,
          dissolvedAt: definition ? null : now,
          slotVersion: { increment: 1 },
        },
      });
    }

    await client.playerSpiritCodex.updateMany({
      where: { playerId },
      data: {
        hasSeen: true,
        shardCount: 0,
        readyToCompose: false,
        ownedCurrent: false,
        ownedEver: false,
        readyAt: null,
        lastOwnedAt: null,
        codexVersion: { increment: 1 },
      },
    });

    for (const definition of [mainDefinition, secondaryDefinition]) {
      await client.playerSpiritCodex.update({
        where: {
          playerId_spiritDefinitionId: {
            playerId,
            spiritDefinitionId: definition.id,
          },
        },
        data: {
          hasSeen: true,
          ownedCurrent: true,
          ownedEver: true,
          lastOwnedAt: now,
          codexVersion: { increment: 1 },
        },
      });
    }

    await client.playerSpiritCodex.update({
      where: {
        playerId_spiritDefinitionId: {
          playerId,
          spiritDefinitionId: composeDefinition.id,
        },
      },
      data: {
        hasSeen: true,
        shardCount: composeDefinition.shardUnlockRequired,
        readyToCompose: true,
        ownedCurrent: false,
        ownedEver: false,
        readyAt: now,
        codexVersion: { increment: 1 },
      },
    });
  });
}

async function readSlot(prisma: PrismaDb, playerId: string, slotIndex: number) {
  return prisma.playerSpiritSlot.findUniqueOrThrow({
    where: { playerId_slotIndex: { playerId, slotIndex } },
    select: {
      id: true,
      spiritDefinitionId: true,
      isMain: true,
      element: true,
      slotVersion: true,
    },
  });
}

async function readSpiritResource(prisma: PrismaDb, playerId: string) {
  return prisma.playerSpiritResource.findUniqueOrThrow({
    where: { playerId },
    select: { spiritSoul: true, resourceVersion: true },
  });
}

async function readCodex(prisma: PrismaDb, playerId: string, spiritDefinitionId: string) {
  return prisma.playerSpiritCodex.findUniqueOrThrow({
    where: {
      playerId_spiritDefinitionId: {
        playerId,
        spiritDefinitionId,
      },
    },
    select: {
      shardCount: true,
      readyToCompose: true,
      ownedCurrent: true,
      ownedEver: true,
    },
  });
}

function mustFindDefinition(definitions: SpiritDefinition[], spiritId: string): SpiritDefinition | undefined {
  return definitions.find((definition) => definition.spiritId === spiritId);
}

function calculateSpiritMaxHp(baseHp: number, growthHp: number, level: number): number {
  return baseHp + Math.max(level - 1, 0) * growthHp;
}

async function assertRejects(action: () => Promise<unknown>, message: string): Promise<void> {
  try {
    await action();
  } catch {
    return;
  }

  throw new Error(message);
}

function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertAtLeast(actual: number, minimum: number, message: string): void {
  if (actual < minimum) {
    throw new Error(`${message}: expected at least ${minimum}, got ${actual}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
