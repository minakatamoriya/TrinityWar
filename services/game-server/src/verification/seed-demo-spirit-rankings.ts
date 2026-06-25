import '../config/load-env.js';
import { PrismaClient, type FieldStatus, type Prisma, type SpiritElement } from '@prisma/client';
import { PlayerInitializationService, type PlayerInitializationInput } from '../seed/player-initialization.service.js';
import { FACTION_SEEDS } from '../seed/seed-data/factions.js';
import { SEED_DEFINITION_SEEDS } from '../seed/seed-data/seeds.js';
import { SPIRIT_DEFINITION_SEEDS } from '../seed/seed-data/spirits.js';

type DemoLeaderboardAccount = {
  providerUserId: string;
  nickname: string;
  factionCode: 'human' | 'immortal' | 'demon';
  castleLevel: number;
  starterSpiritId: string;
  starterElement: SpiritElement;
  starterLevel: number;
  battleCount: number;
  winCount: number;
  lossCount: number;
  drawCount: number;
};

const DEMO_ACCOUNTS: DemoLeaderboardAccount[] = [
  {
    providerUserId: 'dev-main-loop',
    nickname: '主循环测试号',
    factionCode: 'human',
    castleLevel: 10,
    starterSpiritId: 'canglang',
    starterElement: 'WOOD',
    starterLevel: 10,
    battleCount: 24,
    winCount: 18,
    lossCount: 4,
    drawCount: 2,
  },
  {
    providerUserId: 'dev-verifier-1',
    nickname: '测试用户1',
    factionCode: 'human',
    castleLevel: 10,
    starterSpiritId: 'qingyuan',
    starterElement: 'FIRE',
    starterLevel: 10,
    battleCount: 16,
    winCount: 11,
    lossCount: 3,
    drawCount: 2,
  },
  {
    providerUserId: 'dev-spirit-board-human-1',
    nickname: '人界榜单样本1',
    factionCode: 'human',
    castleLevel: 12,
    starterSpiritId: 'canglang',
    starterElement: 'WOOD',
    starterLevel: 12,
    battleCount: 13,
    winCount: 9,
    lossCount: 2,
    drawCount: 2,
  },
  {
    providerUserId: 'dev-spirit-board-immortal-1',
    nickname: '仙界榜单样本1',
    factionCode: 'immortal',
    castleLevel: 11,
    starterSpiritId: 'linglu',
    starterElement: 'WATER',
    starterLevel: 11,
    battleCount: 15,
    winCount: 10,
    lossCount: 4,
    drawCount: 1,
  },
  {
    providerUserId: 'dev-verifier-2',
    nickname: '测试用户2',
    factionCode: 'demon',
    castleLevel: 10,
    starterSpiritId: 'xuanhu',
    starterElement: 'METAL',
    starterLevel: 10,
    battleCount: 17,
    winCount: 12,
    lossCount: 4,
    drawCount: 1,
  },
  {
    providerUserId: 'dev-spirit-board-demon-1',
    nickname: '魔界榜单样本1',
    factionCode: 'demon',
    castleLevel: 12,
    starterSpiritId: 'xuanhu',
    starterElement: 'FIRE',
    starterLevel: 12,
    battleCount: 14,
    winCount: 8,
    lossCount: 4,
    drawCount: 2,
  },
];

const BASE_SEED_INVENTORY: Record<string, { quantity: number; unlocked: boolean }> = {
  qilingya: { quantity: 4, unlocked: true },
  qinglingmai: { quantity: 8, unlocked: true },
  xunyamai: { quantity: 8, unlocked: true },
  ninglucao: { quantity: 4, unlocked: true },
};

const BASE_FIELDS: PlayerInitializationInput['fields'] = [
  {
    slotIndex: 1,
    isUnlocked: true,
    unlockCastleLevel: 1,
    status: 'MATURE',
    seedId: 'qinglingmai',
    currentClaimableGold: 320,
    stageOffsetSeconds: 3 * 60 * 60,
  },
  {
    slotIndex: 2,
    isUnlocked: true,
    unlockCastleLevel: 1,
    status: 'GROWING',
    seedId: 'ninglucao',
    currentClaimableGold: 120,
    stageOffsetSeconds: 75 * 60,
  },
  { slotIndex: 3, isUnlocked: true, unlockCastleLevel: 1, status: 'EMPTY' },
  { slotIndex: 4, isUnlocked: true, unlockCastleLevel: 1, status: 'EMPTY' },
];

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const playerInitializationService = new PlayerInitializationService();

  try {
    const summary = await prisma.$transaction(async (client) => {
      await ensureStaticDefinitions(client);

      const season = await client.gameSeason.findFirst({
        where: {
          startsAt: { lte: new Date() },
          endsAt: { gt: new Date() },
        },
        select: { seasonNumber: true },
        orderBy: { seasonNumber: 'desc' },
      });
      assert(season, 'No active season found. Please start or seed a current season first.');

      const result: Array<{
        providerUserId: string;
        nickname: string;
        factionCode: string;
        spiritId: string | null;
        battleCount: number;
        winCount: number;
        lossCount: number;
        drawCount: number;
      }> = [];

      for (const account of DEMO_ACCOUNTS) {
        const player = await upsertDemoPlayer(client, playerInitializationService, account);
        const mainSpiritSlot = await client.playerSpiritSlot.findFirst({
          where: {
            playerId: player.id,
            isMain: true,
            spiritDefinitionId: { not: null },
            spiritInstanceId: { not: null },
          },
          select: {
            slotIndex: true,
            isMain: true,
            spiritInstanceId: true,
            spiritDefinitionId: true,
            spiritDefinition: {
              select: {
                spiritId: true,
                label: true,
              },
            },
          },
        });
        assert(mainSpiritSlot?.spiritInstanceId, `Main spirit slot missing for ${account.providerUserId}`);
        assert(mainSpiritSlot.spiritDefinitionId, `Main spirit definition missing for ${account.providerUserId}`);

        await client.spiritBattleInstanceStat.upsert({
          where: {
            seasonNumber_spiritInstanceId: {
              seasonNumber: season.seasonNumber,
              spiritInstanceId: mainSpiritSlot.spiritInstanceId,
            },
          },
          create: {
            seasonNumber: season.seasonNumber,
            factionId: player.factionId ?? '',
            playerId: player.id,
            spiritInstanceId: mainSpiritSlot.spiritInstanceId,
            spiritDefinitionId: mainSpiritSlot.spiritDefinitionId,
            battleCount: account.battleCount,
            winCount: account.winCount,
            lossCount: account.lossCount,
            drawCount: account.drawCount,
            latestSlotIndex: mainSpiritSlot.slotIndex,
            latestIsMain: mainSpiritSlot.isMain,
          },
          update: {
            factionId: player.factionId ?? '',
            playerId: player.id,
            spiritDefinitionId: mainSpiritSlot.spiritDefinitionId,
            battleCount: account.battleCount,
            winCount: account.winCount,
            lossCount: account.lossCount,
            drawCount: account.drawCount,
            latestSlotIndex: mainSpiritSlot.slotIndex,
            latestIsMain: mainSpiritSlot.isMain,
            updatedAt: new Date(),
          },
        });

        result.push({
          providerUserId: account.providerUserId,
          nickname: player.nickname,
          factionCode: account.factionCode,
          spiritId: mainSpiritSlot.spiritDefinition?.spiritId ?? null,
          battleCount: account.battleCount,
          winCount: account.winCount,
          lossCount: account.lossCount,
          drawCount: account.drawCount,
        });
      }

      return result;
    });

    console.log(JSON.stringify({
      ok: true,
      seeded: summary,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function ensureStaticDefinitions(client: Prisma.TransactionClient): Promise<void> {
  for (const faction of FACTION_SEEDS) {
    await client.faction.upsert({
      where: { code: faction.code },
      create: faction,
      update: {
        name: faction.name,
        treasuryGold: faction.treasuryGold,
        hourlyBaseDividend: faction.hourlyBaseDividend,
        hourlyContributionDividendPerTen: faction.hourlyContributionDividendPerTen,
      },
    });
  }

  for (const seed of SEED_DEFINITION_SEEDS) {
    await client.seedDefinition.upsert({
      where: { seedId: seed.seedId },
      create: seed,
      update: {
        label: seed.label,
        rarity: seed.rarity,
        sortOrder: seed.sortOrder,
        growSeconds: seed.growSeconds,
        matureSeconds: seed.matureSeconds,
        collectWindowSeconds: seed.collectWindowSeconds,
        baseYieldGold: seed.baseYieldGold,
        strategyNote: seed.strategyNote,
        lore: seed.lore,
      },
    });
  }

  for (const spirit of SPIRIT_DEFINITION_SEEDS) {
    await client.spiritDefinition.upsert({
      where: { spiritId: spirit.spiritId },
      create: spirit,
      update: {
        label: spirit.label,
        rarity: spirit.rarity,
        factionAffinity: spirit.factionAffinity,
        role: spirit.role,
        shardName: spirit.shardName,
        shardUnlockRequired: spirit.shardUnlockRequired,
        baseAttack: spirit.baseAttack,
        baseHp: spirit.baseHp,
        growthAttack: spirit.growthAttack,
        growthHp: spirit.growthHp,
        sortOrder: spirit.sortOrder,
        lore: spirit.lore,
      },
    });
  }
}

async function upsertDemoPlayer(
  client: Prisma.TransactionClient,
  playerInitializationService: PlayerInitializationService,
  account: DemoLeaderboardAccount,
): Promise<{ id: string; nickname: string; factionId: string | null }> {
  const faction = await client.faction.findUniqueOrThrow({
    where: { code: account.factionCode },
    select: { id: true },
  });
  const existingIdentity = await client.playerAuthIdentity.findUnique({
    where: {
      provider_providerUserId: {
        provider: 'DEV_FAKE',
        providerUserId: account.providerUserId,
      },
    },
    select: { playerId: true },
  });

  const player = existingIdentity
    ? await client.player.update({
      where: { id: existingIdentity.playerId },
      data: {
        nickname: account.nickname,
        factionId: faction.id,
        castleLevelCache: account.castleLevel,
        lastLoginAt: new Date(),
      },
      select: { id: true, nickname: true, factionId: true },
    })
    : await client.player.create({
      data: {
        nickname: account.nickname,
        factionId: faction.id,
        castleLevelCache: account.castleLevel,
        lastLoginAt: new Date(),
        authIdentities: {
          create: {
            provider: 'DEV_FAKE',
            providerUserId: account.providerUserId,
          },
        },
      },
      select: { id: true, nickname: true, factionId: true },
    });

  await client.factionMember.upsert({
    where: {
      factionId_playerId: {
        factionId: faction.id,
        playerId: player.id,
      },
    },
    create: {
      factionId: faction.id,
      playerId: player.id,
      contributionScore: 30,
    },
    update: {
      contributionScore: 30,
    },
  });

  await playerInitializationService.initialize(client, {
    playerId: player.id,
    resetExisting: true,
    castleLevel: account.castleLevel,
    vaultGold: 2400,
    walletGold: 180,
    pendingTaxGold: 80,
    pendingDividendGold: 30,
    vaultLevel: 4,
    populationLevel: 3,
    watchtowerLevel: 3,
    protectionTechLevel: 1,
    farmYieldTechLevel: 1,
    collectWindowTechLevel: 1,
    pendingClaimTechLevel: 1,
    army: {
      totalCount: 36,
      availableCount: 32,
      frozenCount: 0,
      woundedCount: 4,
      capacity: 40,
    },
    seedInventory: BASE_SEED_INVENTORY,
    fields: BASE_FIELDS as Array<{
      slotIndex: number;
      isUnlocked: boolean;
      unlockCastleLevel: number;
      status: FieldStatus;
      seedId?: string;
      investedGold?: number;
      currentClaimableGold?: number;
      stageOffsetSeconds?: number;
    }>,
    spirit: {
      createStarterSpirit: true,
      ordinarySoul: 999,
      rareSoul: 999,
      legendarySoul: 999,
      tianjiTalisman: 5,
      starterSpiritId: account.starterSpiritId,
      starterElement: account.starterElement,
      starterLevel: account.starterLevel,
    },
    taskOverrides: [
      { taskId: 'daily-start-cultivation', progress: 1, status: 'COMPLETED' },
    ],
  });

  return player;
}

function assert<T>(value: T | null | undefined, message: string): asserts value is T {
  if (!value) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
