import '../config/load-env.js';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { Prisma, SpiritDefinition } from '@prisma/client';
import { AuthService } from '../auth/auth.service.js';
import { AppModule } from '../modules/app/app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SpiritService } from '../spirit/spirit.service.js';

async function main(): Promise<void> {
  process.env.ROBOT_AUTOMATION_BOOTSTRAP = 'disabled';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const prisma = app.get(PrismaService).db;
    const spiritService = app.get(SpiritService);
    const suffix = Date.now().toString();
    const login = await authService.devLogin({
      providerUserId: `verify-spirit-trait-roll-${suffix}`,
      nickname: `spirit-trait-roll-${suffix}`,
      factionCode: 'human',
    });
    const playerId = login.player.id;
    const definition = await prisma.spiritDefinition.findFirstOrThrow({
      orderBy: [{ sortOrder: 'asc' }, { spiritId: 'asc' }],
    });

    await prepareSpiritTraitState(prisma, playerId, definition);

    const initialTraits = await readTraitCodes(prisma, playerId, 1);
    const beforeBasic = await readVersions(prisma, playerId, 1);
    await spiritService.rollSpiritTraits(playerId, {
      slotIndex: 1,
      mode: 'basic',
      material: 'gold',
      candidateCount: 0,
      lockedTraitSlotIndexes: [1, 2],
      slotVersion: beforeBasic.slotVersion,
      walletVersion: beforeBasic.walletVersion,
      resourceVersion: beforeBasic.resourceVersion,
      requestIdempotencyKey: `verify-basic-lock-${suffix}`,
    });
    const afterBasicTraits = await readTraitCodes(prisma, playerId, 1);
    const afterBasicResource = await readSpiritResource(prisma, playerId);
    assertEqual(afterBasicTraits[1], initialTraits[1], 'basic lock should preserve trait slot 1');
    assertEqual(afterBasicTraits[2], initialTraits[2], 'basic lock should preserve trait slot 2');
    assertEqual(afterBasicResource.tianjiTalisman, beforeBasic.tianjiTalisman - 2, 'basic lock should consume Tianji talisman');

    const beforeLockAll = await readVersions(prisma, playerId, 1);
    await assertRejects(
      () => spiritService.rollSpiritTraits(playerId, {
        slotIndex: 1,
        mode: 'basic',
        lockedTraitSlotIndexes: [1, 2, 3],
        slotVersion: beforeLockAll.slotVersion,
        walletVersion: beforeLockAll.walletVersion,
        resourceVersion: beforeLockAll.resourceVersion,
        requestIdempotencyKey: `verify-basic-lock-all-${suffix}`,
      }),
      'basic roll should reject locking every unlocked trait slot',
    );

    const beforeNormal = await readVersions(prisma, playerId, 1);
    const normalRoll = await spiritService.rollSpiritTraits(playerId, {
      slotIndex: 1,
      mode: 'normal',
      material: 'lingsui',
      candidateCount: 7,
      targetSlotIndex: 3,
      slotVersion: beforeNormal.slotVersion,
      walletVersion: beforeNormal.walletVersion,
      resourceVersion: beforeNormal.resourceVersion,
      requestIdempotencyKey: `verify-normal-${suffix}`,
    });
    assertEqual(normalRoll.traitRoll?.candidates.length, 7, 'normal roll should produce seven candidates');
    assert(!normalRoll.traitRoll?.candidates.some((candidate) => candidate.traitCode === afterBasicTraits[3]), 'normal roll should exclude current trait');

    const selectedNormalTrait = normalRoll.traitRoll?.candidates[0]?.traitCode;
    assert(selectedNormalTrait, 'normal roll should have a selected candidate');
    const beforeResolveNormal = await readVersions(prisma, playerId, 1);
    await spiritService.resolveSpiritTraitRoll(playerId, {
      rollLogId: normalRoll.traitRoll?.rollLogId ?? '',
      selectedTraitCode: selectedNormalTrait,
      slotVersion: beforeResolveNormal.slotVersion,
      requestIdempotencyKey: `verify-normal-resolve-${suffix}`,
    });
    const afterNormalTraits = await readTraitCodes(prisma, playerId, 1);
    assertEqual(afterNormalTraits[1], afterBasicTraits[1], 'normal resolve should preserve trait slot 1');
    assertEqual(afterNormalTraits[2], afterBasicTraits[2], 'normal resolve should preserve trait slot 2');
    assertEqual(afterNormalTraits[3], selectedNormalTrait, 'normal resolve should apply selected trait to target slot');

    const beforeAdvanced = await readVersions(prisma, playerId, 1);
    const advancedRoll = await spiritService.rollSpiritTraits(playerId, {
      slotIndex: 1,
      mode: 'advanced',
      material: 'lingyu',
      candidateCount: 3,
      targetSlotIndex: 3,
      slotVersion: beforeAdvanced.slotVersion,
      walletVersion: beforeAdvanced.walletVersion,
      resourceVersion: beforeAdvanced.resourceVersion,
      requestIdempotencyKey: `verify-advanced-${suffix}`,
    });
    const firstAdvancedCandidates = advancedRoll.traitRoll?.candidates.map((candidate) => candidate.candidateId) ?? [];
    assertEqual(firstAdvancedCandidates.length, 3, 'advanced roll should produce three candidates');

    const beforeAdvancedReroll = await readVersions(prisma, playerId, 1);
    const advancedReroll = await spiritService.rollSpiritTraits(playerId, {
      slotIndex: 1,
      mode: 'advanced',
      material: 'lingyu',
      candidateCount: 3,
      targetSlotIndex: 3,
      excludeCandidateIds: firstAdvancedCandidates,
      slotVersion: beforeAdvancedReroll.slotVersion,
      walletVersion: beforeAdvancedReroll.walletVersion,
      resourceVersion: beforeAdvancedReroll.resourceVersion,
      requestIdempotencyKey: `verify-advanced-reroll-${suffix}`,
    });
    const nextAdvancedCandidates = advancedReroll.traitRoll?.candidates.map((candidate) => candidate.candidateId) ?? [];
    assertEqual(nextAdvancedCandidates.length, 3, 'advanced reroll should produce three candidates');
    assert(nextAdvancedCandidates.every((candidateId) => !firstAdvancedCandidates.includes(candidateId)), 'advanced reroll should exclude previous candidate group');

    console.log(JSON.stringify({
      ok: true,
      playerId,
      operations: ['basic-lock', 'basic-lock-all-reject', 'normal-seven-candidates', 'normal-resolve', 'advanced-reroll-exclude'],
    }, null, 2));
  } finally {
    await app.close();
  }
}

type PrismaDb = PrismaService['db'];

async function prepareSpiritTraitState(prisma: PrismaDb, playerId: string, definition: SpiritDefinition): Promise<void> {
  const now = new Date();
  await prisma.$transaction(async (client) => {
    await client.playerWallet.update({
      where: { playerId },
      data: {
        vaultGold: 100_000,
        balanceVersion: { increment: 1 },
      },
    });
    await client.playerSpiritResource.upsert({
      where: { playerId },
      create: {
        playerId,
        spiritMarrow: 50,
        spiritJade: 10,
        tianjiTalisman: 10,
      },
      update: {
        spiritMarrow: 50,
        spiritJade: 10,
        tianjiTalisman: 10,
        resourceVersion: { increment: 1 },
      },
    });

    const maxHp = definition.baseHp + Math.max(30 - 1, 0) * definition.growthHp;
    const slot = await client.playerSpiritSlot.upsert({
      where: { playerId_slotIndex: { playerId, slotIndex: 1 } },
      create: {
        playerId,
        slotIndex: 1,
        spiritDefinitionId: definition.id,
        isMain: true,
        level: 30,
        exp: 0,
        breakthroughStage: 3,
        lastExpSettledAt: now,
        element: 'WOOD',
        currentHp: maxHp,
        maxHp,
        status: 'ACTIVE',
        acquiredAt: now,
        slotVersion: 1,
      },
      update: {
        spiritDefinitionId: definition.id,
        isMain: true,
        level: 30,
        exp: 0,
        breakthroughStage: 3,
        satiatedUntil: null,
        lastExpSettledAt: now,
        element: 'WOOD',
        currentHp: maxHp,
        maxHp,
        status: 'ACTIVE',
        acquiredAt: now,
        dissolvedAt: null,
        slotVersion: { increment: 1 },
      },
      select: { id: true },
    });

    await client.playerSpiritTrait.deleteMany({ where: { spiritSlotId: slot.id } });
    await createTrait(client, slot.id, 1, 'claw', 10);
    await createTrait(client, slot.id, 2, 'thick_skin', 10);
    await createTrait(client, slot.id, 3, 'crit', 6);
  });
}

async function createTrait(client: Prisma.TransactionClient, spiritSlotId: string, slotIndex: number, traitCode: string, traitValue: number): Promise<void> {
  await client.playerSpiritTrait.create({
    data: {
      spiritSlotId,
      slotIndex,
      traitCode,
      traitValue,
      sourceType: 'verify',
    },
  });
}

async function readVersions(prisma: PrismaDb, playerId: string, slotIndex: number) {
  const [slot, wallet, resource] = await Promise.all([
    prisma.playerSpiritSlot.findUniqueOrThrow({
      where: { playerId_slotIndex: { playerId, slotIndex } },
      select: { slotVersion: true },
    }),
    prisma.playerWallet.findUniqueOrThrow({
      where: { playerId },
      select: { balanceVersion: true },
    }),
    prisma.playerSpiritResource.findUniqueOrThrow({
      where: { playerId },
      select: { resourceVersion: true, tianjiTalisman: true },
    }),
  ]);

  return {
    slotVersion: slot.slotVersion,
    walletVersion: wallet.balanceVersion,
    resourceVersion: resource.resourceVersion,
    tianjiTalisman: resource.tianjiTalisman,
  };
}

async function readSpiritResource(prisma: PrismaDb, playerId: string) {
  return prisma.playerSpiritResource.findUniqueOrThrow({
    where: { playerId },
    select: { spiritMarrow: true, spiritJade: true, tianjiTalisman: true, resourceVersion: true },
  });
}

async function readTraitCodes(prisma: PrismaDb, playerId: string, slotIndex: number): Promise<Record<number, string>> {
  const slot = await prisma.playerSpiritSlot.findUniqueOrThrow({
    where: { playerId_slotIndex: { playerId, slotIndex } },
    select: {
      traits: {
        select: { slotIndex: true, traitCode: true },
        orderBy: { slotIndex: 'asc' },
      },
    },
  });

  return Object.fromEntries(slot.traits.map((trait) => [trait.slotIndex, trait.traitCode]));
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
