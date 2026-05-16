import { Prisma, PrismaClient } from '@prisma/client';
import { DEV_ACCOUNT_SEEDS } from './seed-data/dev-accounts.js';
import { FACTION_SEEDS } from './seed-data/factions.js';
import { SEED_DEFINITION_SEEDS } from './seed-data/seeds.js';
import { PlayerInitializationService } from './player-initialization.service.js';

type TransactionClient = Prisma.TransactionClient;

export async function runSeed(): Promise<void> {
  const prisma = new PrismaClient();
  const playerInitializationService = new PlayerInitializationService();

  try {
    await prisma.$transaction(async (client) => {
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
            seedSeconds: seed.seedSeconds,
            growSeconds: seed.growSeconds,
            matureSeconds: seed.matureSeconds,
            ripeWindowSeconds: seed.ripeWindowSeconds,
            baseYieldGold: seed.baseYieldGold,
            harvestSeedReturn: seed.harvestSeedReturn,
            strategyNote: seed.strategyNote,
            lore: seed.lore,
          },
        });
      }

      if (shouldSeedDevAccounts()) {
        await seedDevAccounts(client, playerInitializationService);
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function seedDevAccounts(
  client: TransactionClient,
  playerInitializationService: PlayerInitializationService,
): Promise<void> {
  for (const account of DEV_ACCOUNT_SEEDS) {
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
        },
      })
      : await client.player.create({
        data: {
          nickname: account.nickname,
          factionId: faction.id,
          castleLevelCache: account.castleLevel,
          authIdentities: {
            create: {
              provider: 'DEV_FAKE',
              providerUserId: account.providerUserId,
            },
          },
        },
      });

    await client.factionMember.deleteMany({
      where: {
        playerId: player.id,
        factionId: {
          not: faction.id,
        },
      },
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
        contributionScore: 0,
      },
      update: {},
    });

    await playerInitializationService.initialize(client, {
      playerId: player.id,
      resetExisting: true,
      castleLevel: account.castleLevel,
      vaultGold: account.wallet.vaultGold,
      walletGold: account.wallet.walletGold,
      pendingTaxGold: account.wallet.pendingTaxGold,
      pendingDividendGold: account.wallet.pendingDividendGold,
      vaultLevel: account.building.vaultLevel,
      populationLevel: account.building.populationLevel,
      watchtowerLevel: account.building.watchtowerLevel,
      protectionTechLevel: account.building.protectionTechLevel,
      farmYieldTechLevel: account.building.farmYieldTechLevel,
      ripeWindowTechLevel: account.building.ripeWindowTechLevel,
      pendingClaimTechLevel: account.building.pendingClaimTechLevel,
      army: account.army,
      seedInventory: account.seedInventory,
      fields: account.fields,
      taskOverrides: account.taskOverrides,
    });
  }
}

function shouldSeedDevAccounts(): boolean {
  return process.env.SEED_DEV_ACCOUNTS === '1' || ['development', 'test'].includes(process.env.NODE_ENV ?? 'development');
}
