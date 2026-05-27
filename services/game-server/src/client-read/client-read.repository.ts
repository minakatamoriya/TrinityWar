import { Inject, Injectable } from '@nestjs/common';
import type { ArmyTrainingStatus, DailyFactionTaskType, FieldStatus, Prisma, PrismaClient, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminTaskConfigRecord } from '../task-config/task-config.service.js';

export interface HomeSummaryReadModel {
  player: {
    id: string;
    nickname: string;
    castleLevelCache: number;
    protectedUntil: Date | null;
    faction: {
      id: string;
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
  dailyFactionTasks: Array<{
    id: string;
    taskType: DailyFactionTaskType;
    requiredEssenceType: string | null;
    requiredAmount: number;
    progressAmount: number;
    rewardContribution: number;
    status: TaskStatus;
    completedAt: Date | null;
  }>;
  seedInventory: Array<{
    quantity: number;
    unlockedAt: Date | null;
    seedDefinition: {
      seedId: string;
      label: string;
    };
  }>;
  contributionLogs: Array<{
    contributionDelta: number;
  }>;
  taskConfigs: AdminTaskConfigRecord[];
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
    factionCode: string | null;
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
    expectedEssenceYield: number;
    stolenEssenceYield: number;
    harvestedEssenceYield: number;
    lastStolenAt: Date | null;
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
      rarity: string;
    } | null;
  }>;
  seedInventory: Array<{
    quantity: number;
    unlockedAt: Date | null;
    seedDefinition: {
      seedId: string;
      label: string;
      rarity: string;
      sortOrder: number;
      seedSeconds: number;
      growSeconds: number;
      matureSeconds: number;
      baseYieldGold: number;
      plantResearch: Array<{
        discoveredAt: Date;
      }>;
    };
  }>;
  dailyFactionTasks: HomeSummaryReadModel['dailyFactionTasks'];
  taskConfigs: AdminTaskConfigRecord[];
  contributionLogs: Array<{
    id: string;
    sourceType: string;
    contributionDelta: number;
    createdAt: Date;
  }>;
  landDeedProgress: Array<{
    deedKey: string;
    status: string;
    progressJson: Prisma.JsonValue;
    claimedAt: Date | null;
  }>;
  factionStipendStates: Array<{
    dateKey: string;
    contributionSnapshot: number;
    tierKey: string;
    rewardJson: Prisma.JsonValue;
    claimedAt: Date | null;
  }>;
  factionStipendClaimCount: number;
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
        protectedUntil: Date | null;
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
    raidOrderId: string;
    title: string;
    summary: string;
    opponentPlayerId: string;
    reportType: string;
    result: string;
    revengeAvailable: boolean;
    createdAt: Date;
    opponentPlayer: {
      nickname: string;
    };
    raidOrder: {
      settlement: {
        lootGold: number;
        attackerLoss: number;
        defenderLoss: number;
        rewardItemsJson: Prisma.JsonValue;
        battleReplayJson: unknown;
      } | null;
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
        protectedUntil: true,
        faction: {
          select: {
            id: true,
            name: true,
          },
        },
        factionMembers: {
          take: 1,
          select: {
            contributionScore: true,
          },
        },
        dailyFactionTasks: {
          where: { taskDate: dateKey },
          orderBy: { generatedAt: 'asc' },
          select: {
            id: true,
            taskType: true,
            requiredEssenceType: true,
            requiredAmount: true,
            progressAmount: true,
            rewardContribution: true,
            status: true,
            completedAt: true,
          },
        },
        seedInventory: {
          select: {
            quantity: true,
            unlockedAt: true,
            seedDefinition: { select: { seedId: true, label: true } },
          },
        },
        factionContributionLogs: {
          where: { createdAt: { gte: startOfDateKey(dateKey) } },
          select: { contributionDelta: true },
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
        landDeedProgress: {
          orderBy: { deedKey: 'asc' },
          select: {
            deedKey: true,
            status: true,
            progressJson: true,
            claimedAt: true,
          },
        },
        factionStipendStates: {
          where: { dateKey: getLocalDateKeyForRepository() },
          take: 1,
          select: {
            dateKey: true,
            contributionSnapshot: true,
            tierKey: true,
            rewardJson: true,
            claimedAt: true,
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
        protectedUntil: player.protectedUntil,
        faction: player.faction,
        factionMembers: player.factionMembers,
      },
      wallet: player.wallet,
      buildings: player.buildings,
      army: player.army,
      fieldSlots: player.fieldSlots,
      taskStates: player.taskStates,
      dailyFactionTasks: player.dailyFactionTasks,
      seedInventory: player.seedInventory,
      contributionLogs: player.factionContributionLogs,
      taskConfigs: [],
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
            code: true,
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
            expectedEssenceYield: true,
            stolenEssenceYield: true,
            harvestedEssenceYield: true,
            lastStolenAt: true,
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
                rarity: true,
              },
            },
          },
        },
        seedInventory: {
          orderBy: [
            { seedDefinition: { sortOrder: 'asc' } },
            { seedDefinition: { seedId: 'asc' } },
          ],
          select: {
            quantity: true,
            unlockedAt: true,
            seedDefinition: {
              select: {
                seedId: true,
                label: true,
                rarity: true,
                sortOrder: true,
                seedSeconds: true,
                growSeconds: true,
                matureSeconds: true,
                baseYieldGold: true,
                plantResearch: {
                  where: { playerId },
                  select: { discoveredAt: true },
                },
              },
            },
          },
        },
        dailyFactionTasks: {
          where: { taskDate: getLocalDateKeyForRepository() },
          orderBy: { generatedAt: 'asc' },
          select: {
            id: true,
            taskType: true,
            requiredEssenceType: true,
            requiredAmount: true,
            progressAmount: true,
            rewardContribution: true,
            status: true,
            completedAt: true,
          },
        },
        factionContributionLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            sourceType: true,
            contributionDelta: true,
            createdAt: true,
          },
        },
        landDeedProgress: {
          orderBy: { deedKey: 'asc' },
          select: {
            deedKey: true,
            status: true,
            progressJson: true,
            claimedAt: true,
          },
        },
        factionStipendStates: {
          where: { dateKey: getLocalDateKeyForRepository() },
          take: 1,
          select: {
            dateKey: true,
            contributionSnapshot: true,
            tierKey: true,
            rewardJson: true,
            claimedAt: true,
          },
        },
      },
    });

    if (!player) {
      return null;
    }

    const [factions, factionStipendClaimCount] = await Promise.all([
      client.faction.findMany({
        orderBy: [{ contributionScore: 'desc' }, { treasuryGold: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          treasuryGold: true,
          contributionScore: true,
        },
      }),
      client.playerFactionStipendState.count({
        where: {
          playerId,
          claimedAt: { not: null },
        },
      }),
    ]);

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
            protectedUntil: true,
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
        raidOrderId: true,
        summary: true,
        opponentPlayerId: true,
        reportType: true,
        result: true,
        revengeAvailable: true,
        createdAt: true,
        opponentPlayer: {
          select: {
            nickname: true,
          },
        },
        raidOrder: {
          select: {
            settlement: {
              select: {
                lootGold: true,
                attackerLoss: true,
                defenderLoss: true,
                rewardItemsJson: true,
                battleReplayJson: true,
              },
            },
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
        factionCode: player.faction?.code ?? null,
        faction: player.faction,
        factionMembers: player.factionMembers,
      },
      wallet: player.wallet,
      buildings: player.buildings,
      army: player.army,
      trainingQueues: player.trainingQueues,
      fieldSlots: player.fieldSlots,
      seedInventory: player.seedInventory,
      dailyFactionTasks: player.dailyFactionTasks,
      taskConfigs: [],
      contributionLogs: player.factionContributionLogs,
      landDeedProgress: player.landDeedProgress,
      factionStipendStates: player.factionStipendStates,
      factionStipendClaimCount,
      factions,
      raidTargetPools,
      raidMessageTemplates,
      battleReports,
    };
  }
}

function getLocalDateKeyForRepository(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date());
}

function startOfDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00+08:00`);
}
