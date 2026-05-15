import { Inject, Injectable } from '@nestjs/common';
import { APP_NAME, type ClientBootstrapResponse } from '@trinitywar/shared';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ClientReadService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
          tianjiTalisman: 0,
        },
        unlockedSeedIds,
        starterSeedClaimed: false,
        tianjiTalismanClaimed: false,
      },
    };
  }
}
