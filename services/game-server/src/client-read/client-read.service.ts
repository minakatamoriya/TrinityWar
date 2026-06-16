import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient, SpiritElement } from '@prisma/client';
import { APP_NAME, type ClientBootstrapResponse, type ClientPlantResearchState, type ClientSceneContentResponse, type ClientSeasonRewardsResponse, type ClientSeasonSignInResponse, type HomeSummaryResponse } from '@trinitywar/shared';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { getLocalDateKey } from '../lib/date-key.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SeasonService } from '../season/season.service.js';
import { SEED_DEFINITION_SEEDS } from '../seed/seed-data/seeds.js';
import { SPIRIT_DEFINITION_SEEDS } from '../seed/seed-data/spirits.js';
import { ArmyTrainingLifecycleService } from './army-training-lifecycle.service.js';
import { ClientReadRepository } from './client-read.repository.js';
import { DailyTaskLifecycleService } from './daily-task-lifecycle.service.js';
import { DailyFactionTaskLifecycleService } from './daily-faction-task-lifecycle.service.js';
import { FieldLifecycleService } from './field-lifecycle.service.js';
import { HomeSummaryAssembler } from './home-summary.assembler.js';
import { PassiveIncomeLifecycleService } from './passive-income-lifecycle.service.js';
import { SceneContentAssembler } from './scene-content.assembler.js';
import { TaskConfigService } from '../task-config/task-config.service.js';

const RAID_TARGET_POOL_SIZE = 6;
const TUTORIAL_TARGET_PROVIDER_USER_ID = 'dev-tutorial-target';
const TUTORIAL_TARGET_NAME = '守田人';
const TUTORIAL_TARGET_SEED_ID = 'qinglingmai';
const TUTORIAL_TARGET_SPIRIT_ID = 'canglang';

@Injectable()
export class ClientReadService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ClientReadRepository) private readonly clientReadRepository: ClientReadRepository,
    @Inject(ArmyTrainingLifecycleService) private readonly armyTrainingLifecycleService: ArmyTrainingLifecycleService,
    @Inject(FieldLifecycleService) private readonly fieldLifecycleService: FieldLifecycleService,
    @Inject(DailyTaskLifecycleService) private readonly dailyTaskLifecycleService: DailyTaskLifecycleService,
    @Inject(DailyFactionTaskLifecycleService) private readonly dailyFactionTaskLifecycleService: DailyFactionTaskLifecycleService,
    @Inject(PassiveIncomeLifecycleService) private readonly passiveIncomeLifecycleService: PassiveIncomeLifecycleService,
    @Inject(SeasonService) private readonly seasonService: SeasonService,
    @Inject(HomeSummaryAssembler) private readonly homeSummaryAssembler: HomeSummaryAssembler,
    @Inject(SceneContentAssembler) private readonly sceneContentAssembler: SceneContentAssembler,
    @Inject(TaskConfigService) private readonly taskConfigService: TaskConfigService,
  ) {}

  async getBootstrap(
    playerId: string,
    client?: Prisma.TransactionClient | PrismaClient,
  ): Promise<ClientBootstrapResponse> {
    const db = client ?? this.prisma.db;

    const player = await db.player.findUnique({
      where: { id: playerId },
      select: { id: true },
    });

    if (!player) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Player not found.',
        statusCode: 404,
      });
    }

    const season = await this.seasonService.ensurePlayerSeason(db, playerId);
    await this.seasonService.recordPlayerActivity(db, playerId, season);

    const seedDefinitions = await db.seedDefinition.findMany({
      orderBy: [{ sortOrder: 'asc' }, { seedId: 'asc' }],
      include: {
        playerInventory: {
          where: {
            playerId,
          },
          select: {
            quantity: true,
            unlockedAt: true,
          },
        },
        plantResearch: {
          where: {
            playerId,
          },
          select: {
            discoveredAt: true,
          },
        },
      },
    });

    const seedInventory: Record<string, number> = {};
    const unlockedSeedIds: string[] = [];
    const plantResearch: Record<string, ClientPlantResearchState> = {};
    const spiritResource = await db.playerSpiritResource.findUnique({
      where: { playerId },
      select: {
        spiritSoul: true,
        tianjiTalisman: true,
        dailyStarterSeedClaimDateKey: true,
        dailyTianjiClaimDateKey: true,
        dailySpiritSoulClaimDateKey: true,
      },
    });
    const playerState = await db.player.findUnique({
      where: { id: playerId },
      select: {
        castleLevelCache: true,
        factionMembers: {
          take: 1,
          select: { contributionScore: true },
        },
      },
    });
    const dateKey = getLocalDateKey();
    const dailySpiritSoulAmount = Math.max(Math.floor(playerState?.castleLevelCache ?? 1), 1);
    const contribution = playerState?.factionMembers[0]?.contributionScore ?? 0;
    const harvestCount = await db.fieldHarvestLog.count({
      where: {
        playerId,
        seedId: { not: null },
      },
    });

    for (const seedDefinition of seedDefinitions) {
      const inventoryEntry = seedDefinition.playerInventory[0];
      const isTutorialSeed = seedDefinition.seedId === 'qilingya';
      const quantity = isTutorialSeed ? 0 : inventoryEntry?.quantity ?? 0;
      const unlockRequirement = getPlantUnlockRequirement(seedDefinition.seedId, seedDefinition.rarity, seedDefinition.sortOrder);
      const baseUnlocked = unlockRequirement.harvestRequired <= 0 && unlockRequirement.contributionRequired <= 0;
      const unlocked = baseUnlocked || (inventoryEntry?.unlockedAt ?? null) !== null;
      const discovered = unlocked || baseUnlocked || Boolean(seedDefinition.plantResearch[0]?.discoveredAt);
      const requirementsMet = harvestCount >= unlockRequirement.harvestRequired
        && contribution >= unlockRequirement.contributionRequired;
      const canUnlock = !unlocked
        && !baseUnlocked
        && requirementsMet;

      seedInventory[seedDefinition.seedId] = quantity;
      plantResearch[seedDefinition.seedId] = {
        plantType: seedDefinition.seedId,
        discovered,
        unlocked,
        status: unlocked ? 'unlocked' : canUnlock ? 'ready' : discovered ? 'discovered' : 'undiscovered',
        essenceRequired: 0,
        essenceOwned: 0,
        harvestRequired: unlockRequirement.harvestRequired,
        harvestOwned: harvestCount,
        contributionRequired: unlockRequirement.contributionRequired,
        contributionOwned: contribution,
        canUnlock,
      };

      if (unlocked) {
        unlockedSeedIds.push(seedDefinition.seedId);
      }
    }

    return {
      app: APP_NAME,
      env: 'local',
      version: '0.1.0',
      serverTime: new Date().toISOString(),
      season: {
        seasonNumber: season.seasonNumber,
        currentWeek: season.currentWeek,
        totalWeeks: season.totalWeeks,
      },
      backpack: {
        seedInventory,
        essenceInventory: seedInventory,
        globalItemInventory: {
          spiritSoul: spiritResource?.spiritSoul ?? 0,
          tianjiTalisman: spiritResource?.tianjiTalisman ?? 0,
        },
        unlockedSeedIds,
        unlockedPlantIds: unlockedSeedIds,
        plantResearch,
        starterSeedClaimed: spiritResource?.dailyStarterSeedClaimDateKey === dateKey,
        tianjiTalismanClaimed: spiritResource?.dailyTianjiClaimDateKey === dateKey,
        spiritSoulClaimed: spiritResource?.dailySpiritSoulClaimDateKey === dateKey,
        dailySpiritSoulAmount,
      },
    };
  }

  async getHomeSummary(
    playerId: string,
    client?: Prisma.TransactionClient | PrismaClient,
    now: Date = new Date(),
  ): Promise<HomeSummaryResponse> {
    if (!client) {
      return this.prisma.transaction(async (transactionClient) => this.getHomeSummary(playerId, transactionClient, now));
    }

    await this.armyTrainingLifecycleService.settlePlayerTrainingQueues(client, playerId, now);
    await this.passiveIncomeLifecycleService.settlePlayerPassiveIncome(client, playerId, now);
    await this.fieldLifecycleService.settlePlayerFields(client, playerId, now);
    const dateKey = getLocalDateKey(now);
    await this.dailyTaskLifecycleService.ensurePlayerDailyTasks(client, playerId, dateKey);
    await this.dailyFactionTaskLifecycleService.ensurePlayerDailyFactionTasks(client, playerId, dateKey);
    const readModel = await this.clientReadRepository.findHomeSummary(playerId, dateKey, client, now);

    if (!readModel) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Player not found.',
        statusCode: 404,
      });
    }

    readModel.taskConfigs = await this.listTaskConfigsForClientRead(client);
    return this.homeSummaryAssembler.assemble(readModel);
  }

  async getSeasonSignIn(
    playerId: string,
    client?: Prisma.TransactionClient | PrismaClient,
  ): Promise<ClientSeasonSignInResponse> {
    const db = client ?? this.prisma.db;
    return this.seasonService.getSeasonSignInState(db, playerId);
  }

  async getSeasonRewards(
    playerId: string,
    client?: Prisma.TransactionClient | PrismaClient,
  ): Promise<ClientSeasonRewardsResponse> {
    const db = client ?? this.prisma.db;
    return this.seasonService.getSeasonRewards(db, playerId);
  }

  async getSceneContent(
    playerId: string,
    client?: Prisma.TransactionClient | PrismaClient,
    now: Date = new Date(),
  ): Promise<ClientSceneContentResponse> {
    if (!client) {
      return this.prisma.transaction(async (transactionClient) => this.getSceneContent(playerId, transactionClient, now));
    }

    await this.armyTrainingLifecycleService.settlePlayerTrainingQueues(client, playerId, now);
    await this.passiveIncomeLifecycleService.settlePlayerPassiveIncome(client, playerId, now);
    await this.fieldLifecycleService.settlePlayerFields(client, playerId, now);
    await this.dailyFactionTaskLifecycleService.ensurePlayerDailyFactionTasks(client, playerId, getLocalDateKey(now));
    await this.ensureRaidTargetPool(client, playerId, { now });
    const [readModel, codex] = await Promise.all([
      this.clientReadRepository.findSceneContent(playerId, client, now),
      client.playerSpiritCodex.findMany({
        where: { playerId },
        select: {
          spiritDefinition: { select: { spiritId: true } },
          hasSeen: true,
          shardCount: true,
          readyToCompose: true,
          ownedCurrent: true,
          ownedEver: true,
        },
      }),
    ]);

    if (!readModel) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Player not found.',
        statusCode: 404,
      });
    }

    readModel.taskConfigs = await this.listTaskConfigsForClientRead(client);
    return this.sceneContentAssembler.assemble(readModel, codex, now);
  }

  private async listTaskConfigsForClientRead(client: Prisma.TransactionClient | PrismaClient): Promise<Awaited<ReturnType<TaskConfigService['listAdminTaskConfigs']>>> {
    try {
      return await this.taskConfigService.listAdminTaskConfigs(null, client);
    } catch {
      return [];
    }
  }

  async refreshRaidTargetPool(
    playerId: string,
    client?: Prisma.TransactionClient | PrismaClient,
  ): Promise<ClientSceneContentResponse> {
    if (!client) {
      return this.prisma.transaction(async (transactionClient) => this.refreshRaidTargetPool(playerId, transactionClient));
    }

    await client.raidTargetPool.deleteMany({ where: { ownerPlayerId: playerId } });
    await this.ensureRaidTargetPool(client, playerId, { force: true, now: new Date() });
    return this.getSceneContent(playerId, client);
  }

  private async ensureRaidTargetPool(
    client: Prisma.TransactionClient | PrismaClient,
    playerId: string,
    options: { force?: boolean; now?: Date } = {},
  ): Promise<void> {
    const now = options.now ?? new Date();
    const isTutorialPlayer = await this.isPlayerInRaidTutorial(client, playerId);
    const playerFactionId = await this.getPlayerFactionId(client, playerId);

    if (isTutorialPlayer) {
      await this.ensureTutorialRaidTargetPool(client, playerId, now, options);
      return;
    }

    await client.raidTargetPool.deleteMany({
      where: {
        ownerPlayerId: playerId,
        OR: [
          {
            targetPlayer: {
              authIdentities: {
                some: {
                  provider: 'DEV_FAKE',
                  providerUserId: TUTORIAL_TARGET_PROVIDER_USER_ID,
                },
              },
            },
          },
          { targetPlayer: { factionId: null } },
          ...(playerFactionId ? [{ targetPlayer: { factionId: playerFactionId } }] : []),
        ],
      },
    });

    const existingTargets = await client.raidTargetPool.findMany({
      where: {
        ownerPlayerId: playerId,
        expiresAt: { gt: now },
        targetPlayer: {
          OR: [
            { protectedUntil: null },
            { protectedUntil: { lte: now } },
          ],
        },
      },
      select: { targetPlayerId: true },
    });

    if (!options.force && existingTargets.length >= RAID_TARGET_POOL_SIZE) {
      return;
    }

    const latestBatch = await client.raidTargetPool.aggregate({
      where: { ownerPlayerId: playerId },
      _max: { refreshBatchNo: true },
    });
    const refreshBatchNo = (latestBatch._max.refreshBatchNo ?? 0) + 1;

    await client.raidTargetPool.deleteMany({
      where: {
        ownerPlayerId: playerId,
        OR: options.force
          ? undefined
          : [
            { expiresAt: { lte: now } },
            {
              targetPlayer: {
                protectedUntil: { gt: now },
              },
            },
          ],
      },
    });

    const activeTargets = options.force
      ? []
      : await client.raidTargetPool.findMany({
        where: {
          ownerPlayerId: playerId,
          expiresAt: { gt: now },
          targetPlayer: {
            OR: [
              { protectedUntil: null },
              { protectedUntil: { lte: now } },
            ],
          },
        },
        select: { targetPlayerId: true },
      });
    const activeTargetPlayerIds = activeTargets.map((target) => target.targetPlayerId);
    const targetsToCreate = Math.max(RAID_TARGET_POOL_SIZE - activeTargetPlayerIds.length, 0);

    if (targetsToCreate <= 0 || !playerFactionId) {
      return;
    }

    const candidateWhere = {
      id: activeTargetPlayerIds.length > 0
        ? { notIn: [playerId, ...activeTargetPlayerIds] }
        : { not: playerId },
      factionId: {
        not: playerFactionId,
      },
      authIdentities: {
        none: {
          provider: 'DEV_FAKE' as const,
          providerUserId: TUTORIAL_TARGET_PROVIDER_USER_ID,
        },
      },
      OR: [
        { protectedUntil: null },
        { protectedUntil: { lte: now } },
      ],
    };
    const candidateCount = await client.player.count({ where: candidateWhere });
    const candidateOffset = options.force && candidateCount > 0
      ? ((refreshBatchNo - 1) * RAID_TARGET_POOL_SIZE) % candidateCount
      : 0;
    const candidates = await client.player.findMany({
      where: candidateWhere,
      orderBy: [{ lastLoginAt: 'desc' }, { createdAt: 'asc' }],
      take: targetsToCreate,
      skip: candidateOffset,
      select: {
        id: true,
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
    if (options.force && candidates.length < targetsToCreate && candidateOffset > 0) {
      const wrappedCandidates = await client.player.findMany({
        where: candidateWhere,
        orderBy: [{ lastLoginAt: 'desc' }, { createdAt: 'asc' }],
        take: targetsToCreate - candidates.length,
        select: {
          id: true,
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
      candidates.push(...wrappedCandidates.filter((target) => !candidates.some((candidate) => candidate.id === target.id)));
    }

    if (candidates.length <= 0) {
      return;
    }

    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    for (const [index, target] of candidates.entries()) {
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
          ownerPlayerId: playerId,
          targetPlayerId: target.id,
          slotIndex: activeTargetPlayerIds.length + index + 1,
          refreshBatchNo,
          targetSnapshotJson: {
            name: target.nickname,
            faction: target.faction?.name ?? '未知阵营',
            level: target.castleLevelCache,
            combatPower: target.army?.totalCount ?? 0,
            raidableGold,
            exposedFruit: fields.length > 0 ? '可侦察农场收益' : '暂无暴露田地',
            raidRule: '目标池为空时自动补入现存玩家，便于开发测试。',
            defenseStatus: `可用战力 ${target.army?.availableCount ?? 0}`,
            protectionStatus: '可发起战斗',
            detail: '由当前数据库玩家自动生成的探索测试目标。',
          },
          fieldSnapshotJson: fields,
          riskSnapshotJson: {
            risk: 'auto-fill',
            targetVaultGold: target.wallet?.vaultGold ?? 0,
            targetWalletGold: target.wallet?.walletGold ?? 0,
          },
          expiresAt,
        },
      });
    }
  }

  private async isPlayerInRaidTutorial(
    client: Prisma.TransactionClient | PrismaClient,
    playerId: string,
  ): Promise<boolean> {
    const player = await client.player.findUnique({
      where: { id: playerId },
      select: {
        authIdentities: {
          select: {
            provider: true,
            providerUserId: true,
          },
        },
        factionStipendStates: {
          where: { claimedAt: { not: null } },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!player) {
      return false;
    }

    const isDevNewUser = player.authIdentities.some((identity) => (
      identity.provider === 'DEV_FAKE'
      && (identity.providerUserId === 'dev-newbie' || identity.providerUserId.startsWith('dev-ui-'))
    ));

    return isDevNewUser && player.factionStipendStates.length <= 0;
  }

  private async getPlayerFactionId(
    client: Prisma.TransactionClient | PrismaClient,
    playerId: string,
  ): Promise<string | null> {
    const player = await client.player.findUnique({
      where: { id: playerId },
      select: { factionId: true },
    });

    return player?.factionId ?? null;
  }

  private async ensureTutorialRaidTargetPool(
    client: Prisma.TransactionClient | PrismaClient,
    playerId: string,
    now: Date,
    options: { force?: boolean } = {},
  ): Promise<void> {
    const tutorialTargetSpirit = await this.getTutorialTargetSpiritProfile(client, playerId);
    const target = await this.ensureTutorialTargetPlayer(client, now, tutorialTargetSpirit);
    const latestBatch = await client.raidTargetPool.aggregate({
      where: { ownerPlayerId: playerId },
      _max: { refreshBatchNo: true },
    });
    const refreshBatchNo = (latestBatch._max.refreshBatchNo ?? 0) + 1;

    await client.raidTargetPool.deleteMany({
      where: {
        ownerPlayerId: playerId,
        OR: options.force
          ? undefined
          : [
            { targetPlayerId: { not: target.id } },
            { expiresAt: { lte: now } },
          ],
      },
    });

    if (!options.force) {
      const existingTutorialTarget = await client.raidTargetPool.findFirst({
        where: {
          ownerPlayerId: playerId,
          targetPlayerId: target.id,
          expiresAt: { gt: now },
        },
        select: { id: true },
      });

      if (existingTutorialTarget) {
        return;
      }
    }

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
        ownerPlayerId: playerId,
        targetPlayerId: target.id,
        slotIndex: 1,
        refreshBatchNo,
        targetSnapshotJson: {
          name: TUTORIAL_TARGET_NAME,
          faction: target.faction?.name ?? '人界',
          level: 1,
          combatPower: target.army?.totalCount ?? 1,
          raidableGold,
          exposedFruit: '教程田地',
          raidRule: '新手教程固定目标，只用于首次战斗教学。',
          defenseStatus: '守田人会留手，适合完成首次战斗。',
          protectionStatus: '教程可挑战',
          risk: '教程目标',
          detail: '新手教程专用目标；正式刷新不会出现。',
          tutorialTarget: true,
          guaranteedOrdinarySoul: 1,
        },
        fieldSnapshotJson: fields,
        riskSnapshotJson: {
          risk: 'tutorial',
          targetVaultGold: target.wallet?.vaultGold ?? 0,
          targetWalletGold: target.wallet?.walletGold ?? 0,
        },
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    });
  }

  private async ensureTutorialTargetPlayer(
    client: Prisma.TransactionClient | PrismaClient,
    now: Date,
    targetSpirit: { spiritId: string; element: SpiritElement },
  ) {
    const seedDefinition = await ensureSeedDefinition(client, TUTORIAL_TARGET_SEED_ID);
    const spiritDefinition = await ensureSpiritDefinition(client, targetSpirit.spiritId);
    const existingIdentity = await client.playerAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'DEV_FAKE',
          providerUserId: TUTORIAL_TARGET_PROVIDER_USER_ID,
        },
      },
      select: { playerId: true },
    });

    const player = existingIdentity
      ? await client.player.update({
        where: { id: existingIdentity.playerId },
        data: {
          nickname: TUTORIAL_TARGET_NAME,
          factionId: null,
          castleLevelCache: 1,
          protectedUntil: null,
        },
        select: { id: true },
      })
      : await client.player.create({
        data: {
          nickname: TUTORIAL_TARGET_NAME,
          factionId: null,
          castleLevelCache: 1,
          authIdentities: {
            create: {
              provider: 'DEV_FAKE',
              providerUserId: TUTORIAL_TARGET_PROVIDER_USER_ID,
            },
          },
        },
        select: { id: true },
      });

    await client.factionMember.deleteMany({
      where: { playerId: player.id },
    });

    await client.playerWallet.upsert({
      where: { playerId: player.id },
      create: {
        playerId: player.id,
        vaultGold: 80,
        vaultCapacity: 800,
        walletGold: 0,
        walletCapacity: 500,
      },
      update: {
        vaultGold: 80,
        walletGold: 0,
        pendingRaidOverflowGold: 0,
        pendingRaidOverflowExpiresAt: null,
        balanceVersion: { increment: 1 },
      },
    });

    await client.playerArmy.upsert({
      where: { playerId: player.id },
      create: {
        playerId: player.id,
        totalCount: 1,
        availableCount: 1,
        frozenCount: 0,
        woundedCount: 0,
        capacity: 10,
      },
      update: {
        totalCount: 1,
        availableCount: 1,
        frozenCount: 0,
        woundedCount: 0,
        capacity: 10,
        armyVersion: { increment: 1 },
      },
    });

    await client.playerBuilding.upsert({
      where: { playerId: player.id },
      create: {
        playerId: player.id,
        castleLevel: 1,
        vaultLevel: 1,
        fieldSlotLevel: 4,
        populationLevel: 1,
        watchtowerLevel: 1,
      },
      update: {
        castleLevel: 1,
        vaultLevel: 1,
        fieldSlotLevel: 4,
        populationLevel: 1,
        watchtowerLevel: 1,
        buildingVersion: { increment: 1 },
      },
    });

    await client.playerFieldSlot.upsert({
      where: { playerId_slotIndex: { playerId: player.id, slotIndex: 1 } },
      create: {
        playerId: player.id,
        slotIndex: 1,
        isUnlocked: true,
        unlockCastleLevel: 1,
        status: 'MATURE',
        seedDefinitionId: seedDefinition?.id,
        currentClaimableGold: 80,
        seedAt: new Date(now.getTime() - 10 * 60 * 1000),
        matureAt: new Date(now.getTime() - 5 * 60 * 1000),
        readyAt: new Date(now.getTime() - 5 * 60 * 1000),
        overripeAt: new Date(now.getTime() + 30 * 60 * 1000),
        lastCalculatedAt: now,
      },
      update: {
        isUnlocked: true,
        unlockCastleLevel: 1,
        status: 'MATURE',
        seedDefinitionId: seedDefinition?.id,
        currentClaimableGold: 80,
        seedAt: new Date(now.getTime() - 10 * 60 * 1000),
        matureAt: new Date(now.getTime() - 5 * 60 * 1000),
        readyAt: new Date(now.getTime() - 5 * 60 * 1000),
        overripeAt: new Date(now.getTime() + 30 * 60 * 1000),
        lastCalculatedAt: now,
        statusVersion: { increment: 1 },
      },
    });

    for (const slotIndex of [2, 3, 4]) {
      await client.playerFieldSlot.upsert({
        where: { playerId_slotIndex: { playerId: player.id, slotIndex } },
        create: {
          playerId: player.id,
          slotIndex,
          isUnlocked: true,
          unlockCastleLevel: 1,
          status: 'EMPTY',
        },
        update: {
          isUnlocked: true,
          unlockCastleLevel: 1,
          status: 'EMPTY',
          seedDefinitionId: null,
          currentClaimableGold: 0,
          statusVersion: { increment: 1 },
        },
      });
    }

    if (spiritDefinition) {
      const maxHp = spiritDefinition.baseHp;

      await client.playerSpiritSlot.upsert({
        where: { playerId_slotIndex: { playerId: player.id, slotIndex: 1 } },
        create: {
          playerId: player.id,
          slotIndex: 1,
          spiritDefinitionId: spiritDefinition.id,
          isMain: true,
          level: 1,
          exp: 0,
          element: targetSpirit.element,
          maxHp,
          acquiredAt: now,
        },
        update: {
          spiritDefinitionId: spiritDefinition.id,
          isMain: true,
          level: 1,
          exp: 0,
          element: targetSpirit.element,
          maxHp,
          dissolvedAt: null,
          slotVersion: { increment: 1 },
        },
      });
    }

    for (const slotIndex of [2, 3, 4, 5]) {
      await client.playerSpiritSlot.upsert({
        where: { playerId_slotIndex: { playerId: player.id, slotIndex } },
        create: {
          playerId: player.id,
          slotIndex,
          spiritDefinitionId: null,
          isMain: false,
          level: 1,
          exp: 0,
          maxHp: 0,
        },
        update: {
          spiritDefinitionId: null,
          isMain: false,
          level: 1,
          exp: 0,
          maxHp: 0,
          dissolvedAt: null,
          slotVersion: { increment: 1 },
        },
      });
    }

    await client.playerFarmBoard.upsert({
      where: { playerId: player.id },
      create: {
        playerId: player.id,
        message: '新手教程田地，只供第一次战斗演示。',
      },
      update: {
        message: '新手教程田地，只供第一次战斗演示。',
        hiddenAt: null,
        boardVersion: { increment: 1 },
      },
    });

    return client.player.findUniqueOrThrow({
      where: { id: player.id },
      select: {
        id: true,
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
  }

  private async getTutorialTargetSpiritProfile(
    client: Prisma.TransactionClient | PrismaClient,
    playerId: string,
  ): Promise<{ spiritId: string; element: SpiritElement }> {
    const mainSpirit = await client.playerSpiritSlot.findFirst({
      where: {
        playerId,
        isMain: true,
        spiritDefinitionId: { not: null },
      },
      select: {
        element: true,
        spiritDefinition: {
          select: {
            spiritId: true,
          },
        },
      },
    });

    return {
      spiritId: mainSpirit?.spiritDefinition?.spiritId ?? TUTORIAL_TARGET_SPIRIT_ID,
      element: mainSpirit?.element ?? 'WOOD',
    };
  }
}

async function ensureSeedDefinition(
  client: Prisma.TransactionClient | PrismaClient,
  seedId: string,
): Promise<{ id: string; label: string } | null> {
  const seed = SEED_DEFINITION_SEEDS.find((entry) => entry.seedId === seedId);
  if (!seed) {
    return null;
  }

  return client.seedDefinition.upsert({
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
    select: {
      id: true,
      label: true,
    },
  });
}

async function ensureSpiritDefinition(
  client: Prisma.TransactionClient | PrismaClient,
  spiritId: string,
): Promise<{ id: string; baseHp: number } | null> {
  const spirit = SPIRIT_DEFINITION_SEEDS.find((entry) => entry.spiritId === spiritId);
  if (!spirit) {
    return null;
  }

  return client.spiritDefinition.upsert({
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
    select: {
      id: true,
      baseHp: true,
    },
  });
}

function getPlantUnlockRequirement(seedId: string, rarity: string, sortOrder: number): { harvestRequired: number; contributionRequired: number } {
  if (seedId === 'qilingya' || seedId === 'qinglingmai' || seedId === 'xunyamai') {
    return { harvestRequired: 0, contributionRequired: 0 };
  }

  if (rarity === 'legendary') {
    return { harvestRequired: 0, contributionRequired: 800 };
  }

  if (rarity === 'rare') {
    return { harvestRequired: 0, contributionRequired: 300 };
  }

  if (sortOrder >= 60) {
    return { harvestRequired: 30, contributionRequired: 0 };
  }

  if (sortOrder >= 50) {
    return { harvestRequired: 20, contributionRequired: 0 };
  }

  return { harvestRequired: 10, contributionRequired: 0 };
}
