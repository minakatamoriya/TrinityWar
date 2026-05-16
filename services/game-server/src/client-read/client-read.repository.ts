import { Inject, Injectable } from '@nestjs/common';
import type { ArmyTrainingStatus, FieldStatus, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface HomeSummaryReadModel {
  player: {
    id: string;
    nickname: string;
    castleLevelCache: number;
    faction: {
      name: string;
    } | null;
    factionMembers: Array<{
      contributionScore: number;
    }>;
  };
  wallet: {
    vaultGold: number;
    vaultCapacity: number;
    pendingTaxGold: number;
    pendingDividendGold: number;
    pendingRaidOverflowGold: number;
    pendingRaidOverflowExpiresAt: Date | null;
  } | null;
  buildings: {
    castleLevel: number;
  } | null;
  army: {
    totalCount: number;
    availableCount: number;
    capacity: number;
  } | null;
  fieldSlots: Array<{
    isUnlocked: boolean;
    status: FieldStatus;
  }>;
  taskStates: Array<{
    taskId: string;
    progress: number;
    target: number;
    status: TaskStatus;
    rewardGold: number;
    actionScene: string;
  }>;
  trainingQueues: Array<{
    status: ArmyTrainingStatus;
    finishAt: Date;
  }>;
}

@Injectable()
export class ClientReadRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findHomeSummary(playerId: string, dateKey: string): Promise<HomeSummaryReadModel | null> {
    const player = await this.prisma.db.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        nickname: true,
        castleLevelCache: true,
        faction: {
          select: {
            name: true,
          },
        },
        factionMembers: {
          take: 1,
          select: {
            contributionScore: true,
          },
        },
        wallet: {
          select: {
            vaultGold: true,
            vaultCapacity: true,
            pendingTaxGold: true,
            pendingDividendGold: true,
            pendingRaidOverflowGold: true,
            pendingRaidOverflowExpiresAt: true,
          },
        },
        buildings: {
          select: {
            castleLevel: true,
          },
        },
        army: {
          select: {
            totalCount: true,
            availableCount: true,
            capacity: true,
          },
        },
        fieldSlots: {
          orderBy: { slotIndex: 'asc' },
          select: {
            isUnlocked: true,
            status: true,
          },
        },
        taskStates: {
          where: { dateKey },
          orderBy: { createdAt: 'asc' },
          select: {
            taskId: true,
            progress: true,
            target: true,
            status: true,
            rewardGold: true,
            actionScene: true,
          },
        },
        trainingQueues: {
          where: {
            status: { in: ['QUEUED', 'FINISHED'] },
          },
          orderBy: { finishAt: 'asc' },
          select: {
            status: true,
            finishAt: true,
          },
        },
      },
    });

    if (!player) {
      return null;
    }

    return {
      player: {
        id: player.id,
        nickname: player.nickname,
        castleLevelCache: player.castleLevelCache,
        faction: player.faction,
        factionMembers: player.factionMembers,
      },
      wallet: player.wallet,
      buildings: player.buildings,
      army: player.army,
      fieldSlots: player.fieldSlots,
      taskStates: player.taskStates,
      trainingQueues: player.trainingQueues,
    };
  }
}
