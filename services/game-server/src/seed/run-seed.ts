import { Prisma, PrismaClient, SocialRelationStatus, SocialRelationType } from '@prisma/client';
import { DEV_ACCOUNT_SEEDS } from './seed-data/dev-accounts.js';
import { FACTION_SEEDS } from './seed-data/factions.js';
import { RAID_MESSAGE_TEMPLATE_SEEDS } from './seed-data/raid-messages.js';
import { SEED_DEFINITION_SEEDS } from './seed-data/seeds.js';
import { SPIRIT_DEFINITION_SEEDS } from './seed-data/spirits.js';
import { PlayerInitializationService } from './player-initialization.service.js';

type TransactionClient = Prisma.TransactionClient;
const DEV_MAIN_LOOP_PROVIDER_USER_ID = 'dev-main-loop';
const DEV_STABLE_FLOW_2_PROVIDER_USER_ID = 'dev-stable-flow-2';

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

      for (const template of RAID_MESSAGE_TEMPLATE_SEEDS) {
        await client.raidMessageTemplate.upsert({
          where: { templateId: template.templateId },
          create: template,
          update: {
            text: template.text,
            sortOrder: template.sortOrder,
            isActive: template.isActive,
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
      collectWindowTechLevel: account.building.collectWindowTechLevel,
      pendingClaimTechLevel: account.building.pendingClaimTechLevel,
      army: account.army,
      seedInventory: account.seedInventory,
      spirit: account.spirit,
      fields: account.fields,
      taskOverrides: account.taskOverrides,
    });
  }

  await seedDevRaidTargetPools(client);
  await seedDevSocialRelations(client);
}

async function seedDevSocialRelations(client: TransactionClient): Promise<void> {
  const [mainLoopIdentity, stableFlow2Identity] = await Promise.all([
    client.playerAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'DEV_FAKE',
          providerUserId: DEV_MAIN_LOOP_PROVIDER_USER_ID,
        },
      },
      select: { playerId: true },
    }),
    client.playerAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'DEV_FAKE',
          providerUserId: DEV_STABLE_FLOW_2_PROVIDER_USER_ID,
        },
      },
      select: { playerId: true },
    }),
  ]);

  if (!mainLoopIdentity || !stableFlow2Identity) {
    return;
  }

  await upsertActiveFriendPair(client, {
    firstPlayerId: mainLoopIdentity.playerId,
    secondPlayerId: stableFlow2Identity.playerId,
    sourceType: 'dev-seed-stable-friend',
    now: new Date(),
  });
}

async function upsertActiveFriendPair(
  client: TransactionClient,
  input: {
    firstPlayerId: string;
    secondPlayerId: string;
    sourceType: string;
    now: Date;
  },
): Promise<void> {
  if (input.firstPlayerId === input.secondPlayerId) {
    return;
  }

  await Promise.all([
    client.playerSocialRelation.upsert({
      where: {
        playerId_targetPlayerId_relationType: {
          playerId: input.firstPlayerId,
          targetPlayerId: input.secondPlayerId,
          relationType: SocialRelationType.FRIEND,
        },
      },
      create: {
        playerId: input.firstPlayerId,
        targetPlayerId: input.secondPlayerId,
        relationType: SocialRelationType.FRIEND,
        status: SocialRelationStatus.ACTIVE,
        sourceType: input.sourceType,
        intimacy: 20,
        lastInteractedAt: input.now,
      },
      update: {
        status: SocialRelationStatus.ACTIVE,
        sourceType: input.sourceType,
      },
    }),
    client.playerSocialRelation.upsert({
      where: {
        playerId_targetPlayerId_relationType: {
          playerId: input.secondPlayerId,
          targetPlayerId: input.firstPlayerId,
          relationType: SocialRelationType.FRIEND,
        },
      },
      create: {
        playerId: input.secondPlayerId,
        targetPlayerId: input.firstPlayerId,
        relationType: SocialRelationType.FRIEND,
        status: SocialRelationStatus.ACTIVE,
        sourceType: input.sourceType,
        intimacy: 20,
        lastInteractedAt: input.now,
      },
      update: {
        status: SocialRelationStatus.ACTIVE,
        sourceType: input.sourceType,
      },
    }),
  ]);
}

async function seedDevRaidTargetPools(client: TransactionClient): Promise<void> {
  const ownerIdentity = await client.playerAuthIdentity.findUnique({
    where: {
      provider_providerUserId: {
        provider: 'DEV_FAKE',
        providerUserId: 'dev-main-loop',
      },
    },
    select: { playerId: true },
  });
  const targetIdentity = await client.playerAuthIdentity.findUnique({
    where: {
      provider_providerUserId: {
        provider: 'DEV_FAKE',
        providerUserId: 'dev-raid-target-a',
      },
    },
    select: { playerId: true },
  });

  if (!ownerIdentity || !targetIdentity) {
    return;
  }

  const target = await client.player.findUnique({
    where: { id: targetIdentity.playerId },
    select: {
      nickname: true,
      castleLevelCache: true,
      faction: { select: { name: true } },
      wallet: { select: { vaultGold: true, walletGold: true } },
      army: { select: { totalCount: true, availableCount: true } },
      fieldSlots: {
        orderBy: { slotIndex: 'asc' },
        select: {
          id: true,
          slotIndex: true,
          status: true,
          currentClaimableGold: true,
          seedDefinition: { select: { label: true } },
        },
      },
    },
  });

  if (!target) {
    return;
  }

  const refreshBatchNo = 1;
  const fields = target.fieldSlots.map((field) => ({
    id: field.id,
    slotIndex: field.slotIndex,
    status: field.status,
    cropName: field.seedDefinition?.label ?? null,
    currentClaimableGold: field.currentClaimableGold,
  }));
  const raidableGold = Math.max(...target.fieldSlots.map((field) => field.currentClaimableGold), 0);

  await client.raidTargetPool.upsert({
    where: {
      ownerPlayerId_targetPlayerId_slotIndex_refreshBatchNo: {
        ownerPlayerId: ownerIdentity.playerId,
        targetPlayerId: targetIdentity.playerId,
        slotIndex: 1,
        refreshBatchNo,
      },
    },
    create: {
      ownerPlayerId: ownerIdentity.playerId,
      targetPlayerId: targetIdentity.playerId,
      slotIndex: 1,
      refreshBatchNo,
      targetSnapshotJson: {
        name: target.nickname,
        faction: target.faction?.name ?? '未知阵营',
        level: target.castleLevelCache,
        combatPower: target.army?.totalCount ?? 0,
        raidableGold,
        exposedFruit: fields.length > 0 ? '成熟田地暴露收益' : '暂无暴露田地',
        raidRule: '第 16 步仅创建订单并进入异步结算。',
        defenseStatus: `可用战力 ${target.army?.availableCount ?? 0}`,
        protectionStatus: '可发起掠夺',
        detail: '开发联调用真实 raid_target_pool 目标。',
      },
      fieldSnapshotJson: fields,
      riskSnapshotJson: {
        risk: '中',
        targetVaultGold: target.wallet?.vaultGold ?? 0,
        targetWalletGold: target.wallet?.walletGold ?? 0,
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    update: {
      targetSnapshotJson: {
        name: target.nickname,
        faction: target.faction?.name ?? '未知阵营',
        level: target.castleLevelCache,
        combatPower: target.army?.totalCount ?? 0,
        raidableGold,
        exposedFruit: fields.length > 0 ? '成熟田地暴露收益' : '暂无暴露田地',
        raidRule: '第 16 步仅创建订单并进入异步结算。',
        defenseStatus: `可用战力 ${target.army?.availableCount ?? 0}`,
        protectionStatus: '可发起掠夺',
        detail: '开发联调用真实 raid_target_pool 目标。',
      },
      fieldSnapshotJson: fields,
      riskSnapshotJson: {
        risk: '中',
        targetVaultGold: target.wallet?.vaultGold ?? 0,
        targetWalletGold: target.wallet?.walletGold ?? 0,
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
}

function shouldSeedDevAccounts(): boolean {
  return process.env.SEED_DEV_ACCOUNTS === '1' || ['development', 'test'].includes(process.env.NODE_ENV ?? 'development');
}
