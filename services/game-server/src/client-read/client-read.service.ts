import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { APP_NAME, type ClientBootstrapResponse, type ClientSceneContentResponse, type HomeSummaryResponse } from '@trinitywar/shared';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { getLocalDateKey } from '../lib/date-key.js';
import { LandDeedService } from '../land-deed/land-deed.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ArmyTrainingLifecycleService } from './army-training-lifecycle.service.js';
import { ClientReadRepository } from './client-read.repository.js';
import { DailyTaskLifecycleService } from './daily-task-lifecycle.service.js';
import { FieldLifecycleService } from './field-lifecycle.service.js';
import { HomeSummaryAssembler } from './home-summary.assembler.js';
import { PassiveIncomeLifecycleService } from './passive-income-lifecycle.service.js';
import { SceneContentAssembler } from './scene-content.assembler.js';

@Injectable()
export class ClientReadService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ClientReadRepository) private readonly clientReadRepository: ClientReadRepository,
    @Inject(ArmyTrainingLifecycleService) private readonly armyTrainingLifecycleService: ArmyTrainingLifecycleService,
    @Inject(FieldLifecycleService) private readonly fieldLifecycleService: FieldLifecycleService,
    @Inject(DailyTaskLifecycleService) private readonly dailyTaskLifecycleService: DailyTaskLifecycleService,
    @Inject(PassiveIncomeLifecycleService) private readonly passiveIncomeLifecycleService: PassiveIncomeLifecycleService,
    @Inject(LandDeedService) private readonly landDeedService: LandDeedService,
    @Inject(HomeSummaryAssembler) private readonly homeSummaryAssembler: HomeSummaryAssembler,
    @Inject(SceneContentAssembler) private readonly sceneContentAssembler: SceneContentAssembler,
  ) {}

  async getBootstrap(playerId: string): Promise<ClientBootstrapResponse> {
    const player = await this.prisma.db.player.findUnique({
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

    const seedDefinitions = await this.prisma.db.seedDefinition.findMany({
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
      },
    });

    const seedInventory: Record<string, number> = {};
    const unlockedSeedIds: string[] = [];
    const spiritResource = await this.prisma.db.playerSpiritResource.findUnique({
      where: { playerId },
      select: {
        spiritSoul: true,
        tianjiTalisman: true,
        dailyStarterSeedClaimDateKey: true,
        dailyTianjiClaimDateKey: true,
        dailySpiritSoulClaimDateKey: true,
      },
    });
    const playerState = await this.prisma.db.player.findUnique({
      where: { id: playerId },
      select: { castleLevelCache: true },
    });
    const dateKey = getLocalDateKey();
    const dailySpiritSoulAmount = Math.max(Math.floor(playerState?.castleLevelCache ?? 1), 1);

    for (const seedDefinition of seedDefinitions) {
      const inventoryEntry = seedDefinition.playerInventory[0];
      const quantity = inventoryEntry?.quantity ?? 0;

      seedInventory[seedDefinition.seedId] = quantity;

      if ((inventoryEntry?.unlockedAt ?? null) !== null || quantity > 0) {
        unlockedSeedIds.push(seedDefinition.seedId);
      }
    }

    return {
      app: APP_NAME,
      env: 'local',
      version: '0.1.0',
      serverTime: new Date().toISOString(),
      season: {
        seasonNumber: 1,
        currentWeek: 1,
        totalWeeks: 4,
      },
      backpack: {
        seedInventory,
        globalItemInventory: {
          spiritSoul: spiritResource?.spiritSoul ?? 0,
          tianjiTalisman: spiritResource?.tianjiTalisman ?? 0,
        },
        unlockedSeedIds,
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
  ): Promise<HomeSummaryResponse> {
    if (!client) {
      return this.prisma.transaction(async (transactionClient) => this.getHomeSummary(playerId, transactionClient));
    }

    await this.armyTrainingLifecycleService.settlePlayerTrainingQueues(client, playerId);
    await this.passiveIncomeLifecycleService.settlePlayerPassiveIncome(client, playerId);
    await this.fieldLifecycleService.settlePlayerFields(client, playerId);
    const dateKey = getLocalDateKey();
    await this.dailyTaskLifecycleService.ensurePlayerDailyTasks(client, playerId, dateKey);
    const readModel = await this.clientReadRepository.findHomeSummary(playerId, dateKey, client);

    if (!readModel) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Player not found.',
        statusCode: 404,
      });
    }

    return this.homeSummaryAssembler.assemble(readModel);
  }

  async getSceneContent(
    playerId: string,
    client?: Prisma.TransactionClient | PrismaClient,
  ): Promise<ClientSceneContentResponse> {
    if (!client) {
      return this.prisma.transaction(async (transactionClient) => this.getSceneContent(playerId, transactionClient));
    }

    await this.armyTrainingLifecycleService.settlePlayerTrainingQueues(client, playerId);
    await this.passiveIncomeLifecycleService.settlePlayerPassiveIncome(client, playerId);
    await this.fieldLifecycleService.settlePlayerFields(client, playerId);
    await this.landDeedService.reconcilePlayerLandDeeds(client, playerId);
    await this.ensureRaidTargetPool(client, playerId);
    const [readModel, codex] = await Promise.all([
      this.clientReadRepository.findSceneContent(playerId, client),
      client.playerSpiritCodex.findMany({
        where: { playerId },
        select: { spiritDefinition: { select: { spiritId: true } }, hasSeen: true },
      }),
    ]);

    if (!readModel) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Player not found.',
        statusCode: 404,
      });
    }

    return this.sceneContentAssembler.assemble(readModel, codex);
  }

  private async ensureRaidTargetPool(client: Prisma.TransactionClient | PrismaClient, playerId: string): Promise<void> {
    const now = new Date();
    const existingTargetCount = await client.raidTargetPool.count({
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
    });

    if (existingTargetCount > 0) {
      return;
    }

    await client.raidTargetPool.deleteMany({
      where: {
        ownerPlayerId: playerId,
        OR: [
          { expiresAt: { lte: now } },
          {
            targetPlayer: {
              protectedUntil: { gt: now },
            },
          },
        ],
      },
    });

    const candidates = await client.player.findMany({
      where: {
        id: { not: playerId },
        OR: [
          { protectedUntil: null },
          { protectedUntil: { lte: now } },
        ],
      },
      orderBy: [{ lastLoginAt: 'desc' }, { createdAt: 'asc' }],
      take: 6,
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

    if (candidates.length <= 0) {
      return;
    }

    const latestBatch = await client.raidTargetPool.aggregate({
      where: { ownerPlayerId: playerId },
      _max: { refreshBatchNo: true },
    });
    const refreshBatchNo = (latestBatch._max.refreshBatchNo ?? 0) + 1;
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
          slotIndex: index + 1,
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
            protectionStatus: '可发起掠夺',
            detail: '由当前数据库玩家自动生成的掠夺测试目标。',
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
}
