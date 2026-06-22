import { Inject, Injectable } from '@nestjs/common';
import { APP_NAME } from '@trinitywar/shared';
import { Prisma, SocialRelationStatus, SocialRelationType, type FieldStatus } from '@prisma/client';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { AppConfigService } from '../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlayerInitializationService, type PlayerInitializationInput } from '../seed/player-initialization.service.js';
import { DEV_ACCOUNT_SEEDS, type DevAccountSeedData } from '../seed/seed-data/dev-accounts.js';
import { FACTION_SEEDS } from '../seed/seed-data/factions.js';
import { SEED_DEFINITION_SEEDS } from '../seed/seed-data/seeds.js';
import { AuthTokenService } from './auth-token.service.js';

export interface DevLoginRequestBody {
  providerUserId?: string;
  nickname?: string;
  factionCode?: string;
}

export interface DevLoginResponse {
  app: string;
  accessToken: string;
  expiresAt: string;
  player: CurrentPlayerSummary;
}

export interface CurrentPlayerSummary {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  faction: {
    id: string;
    code: string;
    name: string;
  } | null;
  castleLevel: number;
  auth: {
    provider: 'DEV_FAKE' | 'WECHAT';
    providerUserId: string;
  };
}

interface DevVerificationAccount {
  providerUserId: 'dev-verifier-1' | 'dev-verifier-2';
  nickname: string;
  factionCode: 'human' | 'immortal' | 'demon';
  initialization: Omit<PlayerInitializationInput, 'playerId' | 'resetExisting'>;
}

const NEW_PLAYER_SEED_INVENTORY: PlayerInitializationInput['seedInventory'] = {
  qilingya: { quantity: 0, unlocked: true },
  qinglingmai: { quantity: 0, unlocked: true },
  xunyamai: { quantity: 0, unlocked: true },
};
const NEW_PLAYER_SPIRIT_STATE: PlayerInitializationInput['spirit'] = {
  createStarterSpirit: false,
  readyStarterSpirits: true,
  starterSpiritId: 'linglu',
};
const NEW_PLAYER_PRIMARY_SEED_ID = 'qilingya';

const DEV_VERIFICATION_ACCOUNTS: DevVerificationAccount[] = [
  {
    providerUserId: 'dev-verifier-1',
    nickname: '测试用户1',
    factionCode: 'human',
    initialization: {
      castleLevel: 10,
      vaultGold: 5000,
      walletGold: 200,
      pendingTaxGold: 120,
      pendingDividendGold: 80,
      vaultLevel: 8,
      populationLevel: 5,
      watchtowerLevel: 5,
      protectionTechLevel: 5,
      farmYieldTechLevel: 2,
      collectWindowTechLevel: 2,
      pendingClaimTechLevel: 2,
      army: { totalCount: 60, availableCount: 60, frozenCount: 0, woundedCount: 0, capacity: 70 },
      seedInventory: {
        qinglingmai: { quantity: 12, unlocked: true },
        ninglucao: { quantity: 8, unlocked: true },
        xueyuehua: { quantity: 4, unlocked: true },
        zhanqingsi: { quantity: 1, unlocked: true },
      },
      fields: buildVerificationFields('qinglingmai', 'xueyuehua'),
      taskOverrides: [
        { taskId: 'daily-start-cultivation', progress: 1, status: 'COMPLETED' },
      ],
      spirit: {
        spiritSoul: 30,
        ordinarySoul: 999,
        rareSoul: 999,
        legendarySoul: 999,
        tianjiTalisman: 3,
        starterSpiritId: 'canglang',
        starterElement: 'FIRE',
        starterLevel: 10,
      },
    },
  },
  {
    providerUserId: 'dev-verifier-2',
    nickname: '测试用户2',
    factionCode: 'demon',
    initialization: {
      castleLevel: 10,
      vaultGold: 5000,
      walletGold: 200,
      pendingTaxGold: 120,
      pendingDividendGold: 80,
      vaultLevel: 8,
      populationLevel: 5,
      watchtowerLevel: 5,
      protectionTechLevel: 5,
      farmYieldTechLevel: 2,
      collectWindowTechLevel: 2,
      pendingClaimTechLevel: 2,
      army: { totalCount: 60, availableCount: 60, frozenCount: 0, woundedCount: 0, capacity: 70 },
      seedInventory: {
        qinglingmai: { quantity: 12, unlocked: true },
        ninglucao: { quantity: 8, unlocked: true },
        jingdaosong: { quantity: 4, unlocked: true },
        zhanqingsi: { quantity: 1, unlocked: true },
      },
      fields: buildVerificationFields('jingdaosong', 'zhanqingsi'),
      taskOverrides: [
        { taskId: 'daily-start-cultivation', progress: 1, status: 'COMPLETED' },
      ],
      spirit: {
        spiritSoul: 30,
        ordinarySoul: 999,
        rareSoul: 999,
        legendarySoul: 999,
        tianjiTalisman: 3,
        starterSpiritId: 'xuanhu',
        starterElement: 'METAL',
        starterLevel: 10,
      },
    },
  },
];

const DEV_MAIN_LOOP_PROVIDER_USER_ID = 'dev-main-loop';
const DEV_STABLE_FLOW_2_PROVIDER_USER_ID = 'dev-stable-flow-2';
const DEV_STABLE_ACCOUNT_PROVIDER_USER_IDS = new Set([DEV_STABLE_FLOW_2_PROVIDER_USER_ID]);
const DEV_FIXED_FRIEND_PROVIDER_PAIRS = [
  [DEV_MAIN_LOOP_PROVIDER_USER_ID, DEV_STABLE_FLOW_2_PROVIDER_USER_ID],
] as const;

@Injectable()
export class AuthService {
  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PlayerInitializationService) private readonly playerInitializationService: PlayerInitializationService,
    @Inject(AuthTokenService) private readonly authTokenService: AuthTokenService,
  ) {}

  async devLogin(input: DevLoginRequestBody): Promise<DevLoginResponse> {
    if (!['development', 'test'].includes(this.config.nodeEnv)) {
      throw new BusinessError({
        code: ErrorCode.Forbidden,
        message: 'Development login is only available in development and test environments.',
        statusCode: 403,
      });
    }

    const providerUserId = normalizeProviderUserId(input.providerUserId);
    const verificationAccount = getDevVerificationAccount(providerUserId);
    const stableAccount = getDevStableAccount(providerUserId);
    const nickname = verificationAccount?.nickname ?? stableAccount?.nickname ?? normalizeDevNickname(input.nickname?.trim(), providerUserId);
    const factionCode = verificationAccount?.factionCode ?? stableAccount?.factionCode ?? input.factionCode?.trim() ?? 'human';

    const result = await this.prisma.transaction(async (client) => {
      if (verificationAccount) {
        const playerId = await this.ensureDevVerificationPair(client, providerUserId);
        const authIdentity = await client.playerAuthIdentity.findUniqueOrThrow({
          where: {
            provider_providerUserId: {
              provider: 'DEV_FAKE',
              providerUserId,
            },
          },
        });
        const summary = await getCurrentPlayerSummary(client, playerId, authIdentity.id, providerUserId);

        return {
          authIdentityId: authIdentity.id,
          summary,
        };
      }

      const faction = await this.ensureFactionByCode(client, factionCode);
      const existingIdentity = await client.playerAuthIdentity.findUnique({
        where: {
          provider_providerUserId: {
            provider: 'DEV_FAKE',
            providerUserId,
          },
        },
        include: { player: { include: { factionMembers: true } } },
      });

      const shouldRepairNickname = existingIdentity
        ? isMojibakeText(existingIdentity.player.nickname) && !isMojibakeText(nickname)
        : false;
      const shouldSyncStableFaction = Boolean(stableAccount && existingIdentity && existingIdentity.player.factionId !== faction.id);
      const player = existingIdentity
        ? await client.player.update({
          where: { id: existingIdentity.playerId },
          data: {
            lastLoginAt: new Date(),
            ...(shouldRepairNickname ? { nickname } : {}),
            ...(shouldSyncStableFaction ? { factionId: faction.id } : {}),
          },
        })
        : await client.player.create({
          data: {
            nickname,
            factionId: faction.id,
            castleLevelCache: stableAccount?.castleLevel ?? 1,
            lastLoginAt: new Date(),
            authIdentities: {
              create: {
                provider: 'DEV_FAKE',
                providerUserId,
              },
            },
            factionMembers: {
              create: {
                factionId: faction.id,
                contributionScore: 0,
              },
            },
          },
        });

      if (stableAccount && existingIdentity) {
        const preservedContribution = existingIdentity.player.factionMembers.reduce(
          (maxContribution, member) => Math.max(maxContribution, member.contributionScore),
          0,
        );
        await client.factionMember.deleteMany({
          where: {
            playerId: player.id,
            factionId: { not: faction.id },
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
            contributionScore: preservedContribution,
          },
          update: {
            contributionScore: preservedContribution,
          },
        });
      }

      const initialization = stableAccount && !existingIdentity
        ? buildStableDevAccountInitialization(stableAccount)
        : {
          castleLevel: player.castleLevelCache,
          vaultGold: 0,
          seedInventory: NEW_PLAYER_SEED_INVENTORY,
          spirit: NEW_PLAYER_SPIRIT_STATE,
        };
      await ensureSeedDefinitionsExist(client, getInitializationSeedIds(initialization));
      await this.playerInitializationService.initialize(client, {
        playerId: player.id,
        ...initialization,
      });
      await this.ensureDevFixedFriendRelations(client, providerUserId);

      const authIdentity = existingIdentity
        ?? await client.playerAuthIdentity.findUniqueOrThrow({
          where: {
            provider_providerUserId: {
              provider: 'DEV_FAKE',
              providerUserId,
            },
          },
        });

      const summary = await getCurrentPlayerSummary(client, player.id, authIdentity.id, providerUserId);

      return {
        authIdentityId: authIdentity.id,
        summary,
      };
    });

    const token = this.authTokenService.issueAccessToken({
      playerId: result.summary.id,
      authIdentityId: result.authIdentityId,
      provider: 'DEV_FAKE',
      providerUserId,
    });

    return {
      app: APP_NAME,
      accessToken: token.accessToken,
      expiresAt: token.expiresAt,
      player: result.summary,
    };
  }

  private async ensureDevVerificationPair(
    client: Prisma.TransactionClient,
    requestedProviderUserId: string,
  ): Promise<string> {
    await this.ensureCoreFactions(client);
    const playerIdByProviderUserId = new Map<string, string>();

    for (const account of DEV_VERIFICATION_ACCOUNTS) {
      const playerId = await this.upsertDevVerificationPlayer(client, account);
      playerIdByProviderUserId.set(account.providerUserId, playerId);
    }

    const playerIds = Array.from(playerIdByProviderUserId.values());

    await client.raidTargetPool.deleteMany({
      where: {
        OR: [
          { ownerPlayerId: { in: playerIds } },
          { targetPlayerId: { in: playerIds } },
        ],
      },
    });
    await client.idempotencyRecord.deleteMany({
      where: { playerId: { in: playerIds } },
    });

    const firstPlayerId = playerIdByProviderUserId.get('dev-verifier-1');
    const secondPlayerId = playerIdByProviderUserId.get('dev-verifier-2');

    if (!firstPlayerId || !secondPlayerId) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Dev verification players could not be initialized.',
        statusCode: 500,
      });
    }

    await this.createVerificationRaidTargetPool(client, {
      ownerPlayerId: firstPlayerId,
      targetPlayerId: secondPlayerId,
    });
    await this.createVerificationRaidTargetPool(client, {
      ownerPlayerId: secondPlayerId,
      targetPlayerId: firstPlayerId,
    });

    const requestedPlayerId = playerIdByProviderUserId.get(requestedProviderUserId);
    if (!requestedPlayerId) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Requested dev verification player was not initialized.',
        statusCode: 500,
      });
    }

    return requestedPlayerId;
  }

  private async upsertDevVerificationPlayer(
    client: Prisma.TransactionClient,
    account: DevVerificationAccount,
  ): Promise<string> {
    const faction = await this.ensureFactionByCode(client, account.factionCode, { select: { id: true } });
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
          castleLevelCache: account.initialization.castleLevel ?? 10,
          lastLoginAt: new Date(),
        },
        select: { id: true },
      })
      : await client.player.create({
        data: {
          nickname: account.nickname,
          factionId: faction.id,
          castleLevelCache: account.initialization.castleLevel ?? 10,
          lastLoginAt: new Date(),
          authIdentities: {
            create: {
              provider: 'DEV_FAKE',
              providerUserId: account.providerUserId,
            },
          },
        },
        select: { id: true },
      });

    await client.factionMember.deleteMany({
      where: {
        playerId: player.id,
        factionId: { not: faction.id },
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
        contributionScore: 10,
      },
      update: {
        contributionScore: 10,
      },
    });

    await this.playerInitializationService.initialize(client, {
      ...account.initialization,
      playerId: player.id,
      resetExisting: true,
    });

    return player.id;
  }

  private async ensureDevFixedFriendRelations(
    client: Prisma.TransactionClient,
    providerUserId: string,
  ): Promise<void> {
    const pairs = DEV_FIXED_FRIEND_PROVIDER_PAIRS.filter(([firstProviderUserId, secondProviderUserId]) => (
      providerUserId === firstProviderUserId || providerUserId === secondProviderUserId
    ));

    for (const [firstProviderUserId, secondProviderUserId] of pairs) {
      const [firstIdentity, secondIdentity] = await Promise.all([
        client.playerAuthIdentity.findUnique({
          where: {
            provider_providerUserId: {
              provider: 'DEV_FAKE',
              providerUserId: firstProviderUserId,
            },
          },
          select: { playerId: true },
        }),
        client.playerAuthIdentity.findUnique({
          where: {
            provider_providerUserId: {
              provider: 'DEV_FAKE',
              providerUserId: secondProviderUserId,
            },
          },
          select: { playerId: true },
        }),
      ]);

      if (!firstIdentity || !secondIdentity) {
        continue;
      }

      await upsertActiveFriendPair(client, {
        firstPlayerId: firstIdentity.playerId,
        secondPlayerId: secondIdentity.playerId,
        sourceType: 'dev-stable-friend',
        now: new Date(),
      });
    }
  }

  private async ensureCoreFactions(client: Prisma.TransactionClient): Promise<void> {
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
  }

  private async ensureFactionByCode<TSelect extends Prisma.FactionSelect | undefined = undefined>(
    client: Prisma.TransactionClient,
    factionCode: string,
    options?: { select?: TSelect },
  ): Promise<TSelect extends Prisma.FactionSelect ? Prisma.FactionGetPayload<{ select: TSelect }> : Prisma.Faction> {
    await this.ensureCoreFactions(client);
    const faction = await client.faction.findUnique({
      where: { code: factionCode },
      ...(options?.select ? { select: options.select } : {}),
    });
    if (!faction) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: `Faction not found: ${factionCode}.`,
        statusCode: 404,
      });
    }
    return faction as TSelect extends Prisma.FactionSelect ? Prisma.FactionGetPayload<{ select: TSelect }> : Prisma.Faction;
  }

  private async createVerificationRaidTargetPool(
    client: Prisma.TransactionClient,
    input: {
      ownerPlayerId: string;
      targetPlayerId: string;
    },
  ): Promise<void> {
    const target = await client.player.findUniqueOrThrow({
      where: { id: input.targetPlayerId },
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
    const fields = target.fieldSlots.map((field) => ({
      id: field.id,
      slotIndex: field.slotIndex,
      status: field.status,
      cropName: field.seedDefinition?.label ?? null,
      currentClaimableGold: field.currentClaimableGold,
    }));
    const raidableGold = Math.max(...target.fieldSlots.map((field) => field.currentClaimableGold), 0);

    await client.raidTargetPool.create({
      data: {
        ownerPlayerId: input.ownerPlayerId,
        targetPlayerId: input.targetPlayerId,
        slotIndex: 1,
        refreshBatchNo: 1,
        targetSnapshotJson: {
          name: target.nickname,
          faction: target.faction?.name ?? '未知阵营',
          level: target.castleLevelCache,
          combatPower: target.army?.totalCount ?? 0,
          raidableGold,
          exposedFruit: fields.length > 0 ? '验证成熟田地' : '暂无暴露田地',
          raidRule: '开发验证账号互相发现并可发起掠夺。',
          defenseStatus: `可用战力 ${target.army?.availableCount ?? 0}`,
          protectionStatus: '可发起掠夺',
          risk: '验证样本',
          detail: '测试用户1/2 专用互掠目标池，每次登录验证账号会重置。',
        },
        fieldSnapshotJson: fields,
        riskSnapshotJson: {
          risk: 'verification',
          targetVaultGold: target.wallet?.vaultGold ?? 0,
          targetWalletGold: target.wallet?.walletGold ?? 0,
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }

}

function buildVerificationFields(
  firstMatureSeedId: string,
  secondMatureSeedId: string,
): Array<{
  slotIndex: number;
  isUnlocked: boolean;
  unlockCastleLevel: number;
  status: FieldStatus;
  seedId?: string;
  investedGold?: number;
  currentClaimableGold?: number;
  stageOffsetSeconds?: number;
}> {
  return [
    {
      slotIndex: 1,
      isUnlocked: true,
      unlockCastleLevel: 1,
      status: 'MATURE',
      seedId: firstMatureSeedId,
      currentClaimableGold: 900,
      stageOffsetSeconds: 4 * 60 * 60,
    },
    {
      slotIndex: 2,
      isUnlocked: true,
      unlockCastleLevel: 5,
      status: 'MATURE',
      seedId: secondMatureSeedId,
      currentClaimableGold: 600,
      stageOffsetSeconds: 3 * 60 * 60,
    },
    {
      slotIndex: 3,
      isUnlocked: true,
      unlockCastleLevel: 10,
      status: 'GROWING',
      seedId: 'ninglucao',
      currentClaimableGold: 220,
      stageOffsetSeconds: 75 * 60,
    },
    { slotIndex: 4, isUnlocked: true, unlockCastleLevel: 1, status: 'EMPTY' },
  ];
}


function getDevVerificationAccount(providerUserId: string): DevVerificationAccount | null {
  return DEV_VERIFICATION_ACCOUNTS.find((account) => account.providerUserId === providerUserId) ?? null;
}

function getDevStableAccount(providerUserId: string): DevAccountSeedData | null {
  if (!DEV_STABLE_ACCOUNT_PROVIDER_USER_IDS.has(providerUserId)) {
    return null;
  }

  return DEV_ACCOUNT_SEEDS.find((account) => account.providerUserId === providerUserId) ?? null;
}

function buildStableDevAccountInitialization(account: DevAccountSeedData): Omit<PlayerInitializationInput, 'playerId' | 'resetExisting'> {
  return {
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
  };
}

function getInitializationSeedIds(initialization: Omit<PlayerInitializationInput, 'playerId' | 'resetExisting'>): string[] {
  return Array.from(new Set([
    ...Object.keys(initialization.seedInventory ?? {}),
    ...(initialization.fields ?? [])
      .map((field) => field.seedId)
      .filter((seedId): seedId is string => Boolean(seedId)),
    NEW_PLAYER_PRIMARY_SEED_ID,
  ]));
}

async function upsertActiveFriendPair(
  client: Prisma.TransactionClient,
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

  const existingRelations = await client.playerSocialRelation.findMany({
    where: {
      relationType: SocialRelationType.FRIEND,
      OR: [
        {
          playerId: input.firstPlayerId,
          targetPlayerId: input.secondPlayerId,
        },
        {
          playerId: input.secondPlayerId,
          targetPlayerId: input.firstPlayerId,
        },
      ],
    },
    select: {
      playerId: true,
      targetPlayerId: true,
      status: true,
    },
  });

  if (existingRelations.some((relation) => relation.status !== SocialRelationStatus.ACTIVE)) {
    return;
  }

  const hasFirstToSecond = existingRelations.some((relation) => (
    relation.playerId === input.firstPlayerId && relation.targetPlayerId === input.secondPlayerId
  ));
  const hasSecondToFirst = existingRelations.some((relation) => (
    relation.playerId === input.secondPlayerId && relation.targetPlayerId === input.firstPlayerId
  ));

  await Promise.all([
    hasFirstToSecond
      ? Promise.resolve()
      : client.playerSocialRelation.create({
        data: {
          playerId: input.firstPlayerId,
          targetPlayerId: input.secondPlayerId,
          relationType: SocialRelationType.FRIEND,
          status: SocialRelationStatus.ACTIVE,
          sourceType: input.sourceType,
          intimacy: 20,
          lastInteractedAt: input.now,
        },
      }),
    hasSecondToFirst
      ? Promise.resolve()
      : client.playerSocialRelation.create({
        data: {
          playerId: input.secondPlayerId,
          targetPlayerId: input.firstPlayerId,
          relationType: SocialRelationType.FRIEND,
          status: SocialRelationStatus.ACTIVE,
          sourceType: input.sourceType,
          intimacy: 20,
          lastInteractedAt: input.now,
        },
      }),
  ]);
}

function normalizeProviderUserId(providerUserId: string | undefined): string {
  const normalized = providerUserId?.trim() || 'dev-newbie';

  if (!/^[a-zA-Z0-9._:-]{3,64}$/.test(normalized)) {
    throw new BusinessError({
      code: ErrorCode.BadRequest,
      message: 'providerUserId must be 3-64 characters and contain only letters, numbers, dot, underscore, colon or hyphen.',
      statusCode: 400,
    });
  }

  return normalized;
}

function normalizeDevNickname(nickname: string | undefined, providerUserId: string): string {
  if (!nickname || isMojibakeText(nickname)) {
    const suffix = providerUserId.match(/^dev-ui-(\d+)$/)?.[1];
    return suffix ? `新用户_${suffix}` : providerUserId;
  }

  return nickname;
}

function isMojibakeText(value: string): boolean {
  return /[\uFFFD]|\?{2,}|脙|脗|忙|莽|猫|茅|氓|盲|脨|脩|脫|脢|碌/.test(value);
}

async function getCurrentPlayerSummary(
  client: Prisma.TransactionClient,
  playerId: string,
  authIdentityId: string,
  providerUserId: string,
): Promise<CurrentPlayerSummary> {
  void authIdentityId;

  const player = await client.player.findUniqueOrThrow({
    where: { id: playerId },
    include: {
      faction: true,
      buildings: true,
    },
  });

  return {
    id: player.id,
    nickname: player.nickname,
    avatarUrl: player.avatarUrl,
    faction: player.faction
      ? {
        id: player.faction.id,
        code: player.faction.code,
        name: player.faction.name,
      }
      : null,
    castleLevel: player.buildings?.castleLevel ?? player.castleLevelCache,
    auth: {
      provider: 'DEV_FAKE',
      providerUserId,
    },
  };
}

async function ensureSeedDefinitionsExist(
  client: Prisma.TransactionClient,
  seedIds: string[],
): Promise<void> {
  for (const seed of SEED_DEFINITION_SEEDS.filter((entry) => seedIds.includes(entry.seedId))) {
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
}
