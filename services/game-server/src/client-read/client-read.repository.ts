import { Inject, Injectable } from '@nestjs/common';
import type { ClientSpiritElement } from '@trinitywar/shared';
import { getSpiritBattleInnateRules } from '@trinitywar/shared';
import type { ArmyTrainingStatus, DailyFactionTaskType, FieldStatus, Prisma, PrismaClient, SpiritElement, TaskStatus } from '@prisma/client';
import { getLocalDateKey, getStartOfDateKey } from '../lib/date-key.js';
import type { FactionAdvantageCode } from '../lib/faction-advantage-formulas.js';
import { getFieldReadyAt } from '../lib/field-timing.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { getTraitDefinition } from '../spirit/spirit-trait-roll-rules.js';
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
    collectWindowTechLevel: number;
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
    readyAt: Date | null;
    overripeAt: Date | null;
    seedDefinition: {
      seedId: string;
      label: string;
      growSeconds: number;
      matureSeconds: number;
      collectWindowSeconds: number;
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
      growSeconds: number;
      matureSeconds: number;
      baseYieldGold: number;
      plantResearch: Array<{
        discoveredAt: Date;
      }>;
    };
  }>;
  plantUnlockMetrics: {
    harvestCount: number;
  };
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
    contributionScore: number;
  }>;
  factionRankings: Array<{
    playerId: string;
    contributionScore: number;
    player: {
      id: string;
      nickname: string;
      castleLevelCache: number;
      faction: {
        name: string;
      } | null;
    };
  }>;
  factionSpiritRankings: Array<{
    playerId: string;
    spiritInstanceId: string;
    spiritId: string;
    label: string;
    rarity: 'common' | 'rare' | 'legendary';
    element: ClientSpiritElement | null;
    battleCount: number;
    winCount: number;
    lossCount: number;
    drawCount: number;
    isMain: boolean;
    updatedAt: Date;
    traitItems: Array<{
      label: string;
      description: string;
    }>;
    innateTraitItems: Array<{
      label: string;
      description: string;
    }>;
  }>;
  raidDailyState: {
    dateKey: string;
    normalRaidAttemptsUsed: number;
    raidRefreshesUsed: number;
    extraRaidAttemptsPurchased: number;
    extraRefreshesPurchased: number;
  } | null;
  raidTargetPools: Array<{
    id: string;
    targetSnapshotJson: Prisma.JsonValue;
    expiresAt: Date;
      targetPlayer: {
        id: string;
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
    now: Date = new Date(),
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
          where: { dateKey },
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

    const wallet = player.wallet
      ? {
        ...player.wallet,
        pendingRaidOverflowGold: player.wallet.pendingRaidOverflowExpiresAt && player.wallet.pendingRaidOverflowExpiresAt > now
          ? player.wallet.pendingRaidOverflowGold
          : 0,
      }
      : null;

    return {
      player: {
        id: player.id,
        nickname: player.nickname,
        castleLevelCache: player.castleLevelCache,
        protectedUntil: player.protectedUntil,
        faction: player.faction,
        factionMembers: player.factionMembers,
      },
      wallet,
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
    now: Date = new Date(),
  ): Promise<SceneContentReadModel | null> {
    const dateKey = getLocalDateKeyForRepository(now);
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
            collectWindowTechLevel: true,
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
            readyAt: true,
            overripeAt: true,
            seedDefinition: {
              select: {
                seedId: true,
                label: true,
                growSeconds: true,
                matureSeconds: true,
                collectWindowSeconds: true,
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
          where: { dateKey },
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

    const activeSeason = await client.gameSeason.findFirst({
      where: {
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      select: { seasonNumber: true },
      orderBy: { seasonNumber: 'desc' },
    });

    const [factions, factionContributionTotals, factionStipendClaimCount, factionRankings, activeFactionSpiritSlots, factionSpiritStats] = await Promise.all([
      client.faction.findMany({
        orderBy: [{ contributionScore: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          contributionScore: true,
        },
      }),
      client.factionMember.groupBy({
        by: ['factionId'],
        _sum: { contributionScore: true },
      }),
      client.playerFactionStipendState.count({
        where: {
          playerId,
          claimedAt: { not: null },
        },
      }),
      player.faction
        ? client.factionMember.findMany({
          where: { factionId: player.faction.id },
          orderBy: [
            { contributionScore: 'desc' },
            { joinedAt: 'asc' },
            { playerId: 'asc' },
          ],
          take: 50,
          select: {
            playerId: true,
            contributionScore: true,
            player: {
              select: {
                id: true,
                nickname: true,
                castleLevelCache: true,
                faction: { select: { name: true } },
              },
            },
          },
        })
        : Promise.resolve([]),
      player.faction
        ? client.playerSpiritSlot.findMany({
          where: {
            player: {
              factionId: player.faction.id,
            },
            spiritDefinitionId: { not: null },
            spiritInstanceId: { not: null },
            dissolvedAt: null,
          },
          select: {
            playerId: true,
            spiritInstanceId: true,
            slotIndex: true,
            isMain: true,
            element: true,
            spiritDefinition: {
              select: {
                spiritId: true,
                label: true,
                rarity: true,
              },
            },
            traits: {
              select: {
                slotIndex: true,
                traitCode: true,
                traitValue: true,
                sourceType: true,
              },
            },
          },
        })
        : Promise.resolve([]),
      player.faction && activeSeason
        ? client.spiritBattleInstanceStat.findMany({
          where: {
            factionId: player.faction.id,
            seasonNumber: activeSeason.seasonNumber,
            battleCount: { gte: 10 },
          },
          select: {
            playerId: true,
            spiritInstanceId: true,
            battleCount: true,
            winCount: true,
            lossCount: true,
            drawCount: true,
            updatedAt: true,
          },
        })
        : Promise.resolve([]),
    ]);
    const contributionTotalByFactionId = new Map(
      factionContributionTotals.map((total) => [total.factionId, total._sum.contributionScore ?? 0]),
    );
    const factionsWithMemberContributionTotals = factions
      .map((faction) => ({
        ...faction,
        contributionScore: contributionTotalByFactionId.get(faction.id) ?? 0,
      }))
      .sort((left, right) => {
        const contributionDelta = right.contributionScore - left.contributionScore;
        return contributionDelta !== 0 ? contributionDelta : left.name.localeCompare(right.name, 'zh-Hans-CN');
      });
    const activeSpiritSlotByInstanceId = new Map(
      activeFactionSpiritSlots
        .filter((slot): slot is typeof slot & { spiritInstanceId: string; spiritDefinition: NonNullable<typeof slot.spiritDefinition> } => (
          typeof slot.spiritInstanceId === 'string' && slot.spiritDefinition !== null
        ))
        .map((slot) => [slot.spiritInstanceId, slot] as const),
    );
    const factionSpiritRankings = factionSpiritStats
      .map((stat) => {
        const slot = activeSpiritSlotByInstanceId.get(stat.spiritInstanceId);
        if (!slot?.spiritDefinition) {
          return null;
        }

        return {
          playerId: stat.playerId || slot.playerId,
          spiritInstanceId: stat.spiritInstanceId,
          spiritId: slot.spiritDefinition.spiritId,
          label: slot.spiritDefinition.label,
          rarity: toClientSpiritRarity(slot.spiritDefinition.rarity),
          element: toClientSpiritElement(slot.element),
          battleCount: stat.battleCount,
          winCount: stat.winCount,
          lossCount: stat.lossCount,
          drawCount: stat.drawCount,
          isMain: slot.isMain,
          updatedAt: stat.updatedAt,
          traitItems: mapSpiritTraitItems(slot.traits),
          innateTraitItems: getSpiritBattleInnateRules(slot.spiritDefinition.spiritId).map((rule) => ({
            label: rule.label,
            description: rule.description,
          })),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const [plantHarvestCount, raidDailyState, raidTargetPools] = await Promise.all([
      client.fieldHarvestLog.count({
        where: {
          playerId,
          seedId: { not: null },
        },
      }),
      client.playerRaidDailyState.findUnique({
        where: {
          playerId_dateKey: {
            playerId,
            dateKey,
          },
        },
        select: {
          dateKey: true,
          normalRaidAttemptsUsed: true,
          raidRefreshesUsed: true,
          extraRaidAttemptsPurchased: true,
          extraRefreshesPurchased: true,
        },
      }),
      client.raidTargetPool.findMany({
      where: {
        ownerPlayerId: playerId,
        expiresAt: { gt: now },
      },
      orderBy: [{ refreshBatchNo: 'desc' }, { slotIndex: 'asc' }],
      take: 6,
      select: {
        id: true,
        targetSnapshotJson: true,
        expiresAt: true,
        targetPlayer: {
          select: {
            id: true,
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
      }),
    ]);

    const raidMessageTemplates = await client.raidMessageTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      take: 5,
      select: {
        templateId: true,
        text: true,
      },
    });

    const battleReportRows = await client.battleReport.findMany({
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
      },
    });
    const raidOrders = await client.raidOrder.findMany({
      where: {
        id: { in: battleReportRows.map((report) => report.raidOrderId) },
      },
      select: {
        id: true,
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
    });
    const raidOrdersById = new Map(raidOrders.map((order) => [order.id, order]));
    const battleReports = battleReportRows.flatMap((report) => {
      const raidOrder = raidOrdersById.get(report.raidOrderId);
      return raidOrder ? [{ ...report, raidOrder }] : [];
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
      fieldSlots: player.fieldSlots.map((field) => ({
        ...field,
        readyAt: field.seedDefinition
          ? getFieldReadyAt(field, field.seedDefinition.seedId, now, (player.faction?.code ?? null) as FactionAdvantageCode)
          : null,
      })),
      seedInventory: player.seedInventory,
      plantUnlockMetrics: {
        harvestCount: plantHarvestCount,
      },
      dailyFactionTasks: player.dailyFactionTasks,
      taskConfigs: [],
      contributionLogs: player.factionContributionLogs,
      landDeedProgress: player.landDeedProgress,
      factionStipendStates: player.factionStipendStates,
      factionStipendClaimCount,
      factions: factionsWithMemberContributionTotals,
      factionRankings,
      factionSpiritRankings,
      raidDailyState,
      raidTargetPools,
      raidMessageTemplates,
      battleReports,
    };
  }
}

function getLocalDateKeyForRepository(now = new Date()): string {
  return getLocalDateKey(now);
}

function startOfDateKey(dateKey: string): Date {
  return getStartOfDateKey(dateKey);
}

function toClientSpiritElement(element: SpiritElement | null): ClientSpiritElement | null {
  if (element === 'METAL') return 'metal';
  if (element === 'WOOD') return 'wood';
  if (element === 'WATER') return 'water';
  if (element === 'FIRE') return 'fire';
  if (element === 'EARTH') return 'earth';
  return null;
}

function toClientSpiritRarity(rarity: string): 'common' | 'rare' | 'legendary' {
  if (rarity === 'LEGENDARY') {
    return 'legendary';
  }
  if (rarity === 'RARE') {
    return 'rare';
  }
  return 'common';
}

function mapSpiritTraitItems(traits: Array<{
  slotIndex: number;
  traitCode: string;
  traitValue: number;
  sourceType: string;
}>): Array<{ label: string; description: string }> {
  return [...traits]
    .sort((left, right) => left.slotIndex - right.slotIndex)
    .map((trait) => {
      const definition = getTraitDefinition(trait.traitCode);
      return {
        label: definition.label,
        description: definition.description,
      };
    });
}
