import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { APP_NAME, type ClientBootstrapResponse, type ClientSceneContentResponse, type HomeSummaryResponse } from '@trinitywar/shared';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { getLocalDateKey } from '../lib/date-key.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ArmyTrainingLifecycleService } from './army-training-lifecycle.service.js';
import { ClientReadRepository } from './client-read.repository.js';
import { FieldLifecycleService } from './field-lifecycle.service.js';
import { HomeSummaryAssembler } from './home-summary.assembler.js';
import { SceneContentAssembler } from './scene-content.assembler.js';

@Injectable()
export class ClientReadService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ClientReadRepository) private readonly clientReadRepository: ClientReadRepository,
    @Inject(ArmyTrainingLifecycleService) private readonly armyTrainingLifecycleService: ArmyTrainingLifecycleService,
    @Inject(FieldLifecycleService) private readonly fieldLifecycleService: FieldLifecycleService,
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
      orderBy: { seedId: 'asc' },
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
        tianjiTalisman: true,
        dailyTianjiClaimDateKey: true,
      },
    });

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
          tianjiTalisman: spiritResource?.tianjiTalisman ?? 0,
        },
        unlockedSeedIds,
        starterSeedClaimed: false,
        tianjiTalismanClaimed: spiritResource?.dailyTianjiClaimDateKey === getLocalDateKey(),
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
    await this.fieldLifecycleService.settlePlayerFields(client, playerId);
    const readModel = await this.clientReadRepository.findHomeSummary(playerId, getLocalDateKey(), client);

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
    await this.fieldLifecycleService.settlePlayerFields(client, playerId);
    const readModel = await this.clientReadRepository.findSceneContent(playerId, client);

    if (!readModel) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Player not found.',
        statusCode: 404,
      });
    }

    return this.sceneContentAssembler.assemble(readModel);
  }
}
