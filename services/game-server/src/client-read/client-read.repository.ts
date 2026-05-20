import { Inject, Injectable } from '@nestjs/common';
import type { ArmyTrainingStatus, FieldStatus, Prisma, PrismaClient, TaskStatus } from '@prisma/client';
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
    balanceVersion: number;
  } | null;
  buildings: {
    castleLevel: number;
    buildingVersion: number;
  } | null;
  army: {
    totalCount: number;
    availableCount: number;
    capacity: number;
    armyVersion: number;
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

export interface SceneContentReadModel {
  player: {
    id: string;
    nickname: string;
    castleLevelCache: number;
    faction: {
      id: string;
      name: string;
      treasuryGold: number;
      contributionScore: number;
    } | null;
    factionMembers: Array<{
      contributionScore: number;
    }>;
  };
  wallet: {
    vaultGold: number;
    vaultCapacity: number;
  } | null;
  buildings: {
    castleLevel: number;
    vaultLevel: number;
    fieldSlotLevel: number;
    populationLevel: number;
    watchtowerLevel: number;
    protectionTechLevel: number;
    farmYieldTechLevel: number;
    ripeWindowTechLevel: number;
    pendingClaimTechLevel: number;
  } | null;
  army: {
    totalCount: number;
    availableCount: number;
    frozenCount: number;
    woundedCount: number;
    capacity: number;
  } | null;
  trainingQueues: Array<{
    queuedCount: number;
    unitCostGold: number;
    totalCostGold: number;
    startedAt: Date;
    finishAt: Date;
    status: ArmyTrainingStatus;
  }>;
  fieldSlots: Array<{
    id: string;
    slotIndex: number;
    statusVersion: number;
    isUnlocked: boolean;
    unlockCastleLevel: number;
    status: FieldStatus;
    investedGold: number;
    currentClaimableGold: number;
    seedAt: Date | null;
    matureAt: Date | null;
    fullMatureAt: Date | null;
    overripeAt: Date | null;
    seedDefinition: {
      seedId: string;
      label: string;
      seedSeconds: number;
      growSeconds: number;
      matureSeconds: number;
      ripeWindowSeconds: number;
      baseYieldGold: number;
    } | null;
  }>;
  factions: Array<{
    id: string;
    name: string;
    treasuryGold: number;
    contributionScore: number;
  }>;
  raidTargetPools: Array<{
    id: string;
    targetSnapshotJson: Prisma.JsonValue;
    expiresAt: Date;
    targetPlayer: {
      nickname: string;
      castleLevelCache: number;
      faction: {
        name: string;
      } | null;
      farmBoard: {
        message: string;
        hiddenAt: Date | null;
      } | null;
      spiritSlots: Array<{
        level: number;
        spiritDefinition: {
          spiritId: string;
          label: string;
          rarity: string;
        } | null;
      }>;
      army: {
        totalCount: number;
        availableCount: number;
      } | null;
    };
  }>;
  raidMessageTemplates: Array<{
    templateId: string;
    text: string;
  }>;
  battleReports: Array<{
    title: string;
    summary: string;
    reportType: string;
    result: string;
    revengeAvailable: boolean;
    createdAt: Date;
    raidOrder: {
      raidMessage: {
        templateId: string;
        textSnapshot: string;
        isHidden: boolean;
      } | null;
    };
  }>;
}

@Injectable()
export class ClientReadRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findHomeSummary(
    playerId: string,
    dateKey: string,
    client: Prisma.TransactionClient | PrismaClient = this.prisma.db,
  ): Promise<HomeSummaryReadModel | null> {
    const player = await client.player.findUnique({
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
            balanceVersion: true,
          },
        },
        buildings: {
          select: {
            castleLevel: true,
            buildingVersion: true,
          },
        },
        army: {
          select: {
            totalCount: true,
            availableCount: true,
            capacity: true,
            armyVersion: true,
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

  async findSceneContent(
    playerId: string,
    client: Prisma.TransactionClient | PrismaClient = this.prisma.db,
  ): Promise<SceneContentReadModel | null> {
    const player = await client.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        nickname: true,
        castleLevelCache: true,
        faction: {
          select: {
            id: true,
            name: true,
            treasuryGold: true,
            contributionScore: true,
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
          },
        },
        buildings: {
          select: {
            castleLevel: true,
            vaultLevel: true,
            fieldSlotLevel: true,
            populationLevel: true,
            watchtowerLevel: true,
            protectionTechLevel: true,
            farmYieldTechLevel: true,
            ripeWindowTechLevel: true,
            pendingClaimTechLevel: true,
          },
        },
        army: {
          select: {
            totalCount: true,
            availableCount: true,
            frozenCount: true,
            woundedCount: true,
            capacity: true,
          },
        },
        trainingQueues: {
          where: {
            status: { in: ['QUEUED', 'FINISHED'] },
          },
          orderBy: { finishAt: 'asc' },
          select: {
            queuedCount: true,
            unitCostGold: true,
            totalCostGold: true,
            startedAt: true,
            finishAt: true,
            status: true,
          },
        },
        fieldSlots: {
          orderBy: { slotIndex: 'asc' },
          select: {
            id: true,
            slotIndex: true,
            statusVersion: true,
            isUnlocked: true,
            unlockCastleLevel: true,
            status: true,
            investedGold: true,
            currentClaimableGold: true,
            seedAt: true,
            matureAt: true,
            fullMatureAt: true,
            overripeAt: true,
            seedDefinition: {
              select: {
                seedId: true,
                label: true,
                seedSeconds: true,
                growSeconds: true,
                matureSeconds: true,
                ripeWindowSeconds: true,
                baseYieldGold: true,
              },
            },
          },
        },
      },
    });

    if (!player) {
      return null;
    }

    const factions = await client.faction.findMany({
      orderBy: [{ contributionScore: 'desc' }, { treasuryGold: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        treasuryGold: true,
        contributionScore: true,
      },
    });

    const raidTargetPools = await client.raidTargetPool.findMany({
      where: {
        ownerPlayerId: playerId,
        expiresAt: { gt: new Date() },
      },
      orderBy: [{ refreshBatchNo: 'desc' }, { slotIndex: 'asc' }],
      take: 6,
      select: {
        id: true,
        targetSnapshotJson: true,
        expiresAt: true,
        targetPlayer: {
          select: {
            nickname: true,
            castleLevelCache: true,
            faction: { select: { name: true } },
            farmBoard: { select: { message: true, hiddenAt: true } },
            spiritSlots: {
              where: { isMain: true },
              take: 1,
              select: {
                level: true,
                spiritDefinition: {
                  select: {
                    spiritId: true,
                    label: true,
                    rarity: true,
                  },
                },
              },
            },
            army: {
              select: {
                totalCount: true,
                availableCount: true,
              },
            },
          },
        },
      },
    });

    const raidMessageTemplates = await client.raidMessageTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      take: 5,
      select: {
        templateId: true,
        text: true,
      },
    });

    const battleReports = await client.battleReport.findMany({
      where: {
        ownerPlayerId: playerId,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        title: true,
        summary: true,
        reportType: true,
        result: true,
        revengeAvailable: true,
        createdAt: true,
        raidOrder: {
          select: {
            raidMessage: {
              select: {
                templateId: true,
                textSnapshot: true,
                isHidden: true,
              },
            },
          },
        },
      },
    });

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
      trainingQueues: player.trainingQueues,
      fieldSlots: player.fieldSlots,
      factions,
      raidTargetPools,
      raidMessageTemplates,
      battleReports,
    };
  }
}
