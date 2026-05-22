import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient, RaidOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

type PrismaExecutor = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class RaidRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findVisibleTargetPoolEntry(
    input: {
      ownerPlayerId: string;
      targetPoolId: string;
      now?: Date;
    },
    client: PrismaExecutor = this.prisma.db,
  ) {
    return client.raidTargetPool.findFirst({
      where: {
        id: input.targetPoolId,
        ownerPlayerId: input.ownerPlayerId,
        expiresAt: {
          gt: input.now ?? new Date(),
        },
      },
      include: {
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
                id: true,
                slotIndex: true,
                level: true,
                element: true,
                currentHp: true,
                maxHp: true,
                status: true,
                spiritDefinition: {
                  select: {
                    id: true,
                    spiritId: true,
                    label: true,
                    rarity: true,
                    factionAffinity: true,
                    role: true,
                    baseAttack: true,
                    baseDefense: true,
                    baseHp: true,
                    growthAttack: true,
                    growthDefense: true,
                    growthHp: true,
                  },
                },
              },
            },
            wallet: { select: { vaultGold: true, walletGold: true } },
            army: {
              select: {
                totalCount: true,
                availableCount: true,
                frozenCount: true,
                woundedCount: true,
                capacity: true,
              },
            },
            fieldSlots: {
              orderBy: { slotIndex: 'asc' },
              select: {
                id: true,
                slotIndex: true,
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
        },
      },
    });
  }

  findVisibleTargetPoolEntries(
    input: {
      ownerPlayerId: string;
      now?: Date;
      take?: number;
    },
    client: PrismaExecutor = this.prisma.db,
  ) {
    return client.raidTargetPool.findMany({
      where: {
        ownerPlayerId: input.ownerPlayerId,
        expiresAt: { gt: input.now ?? new Date() },
      },
      orderBy: [{ refreshBatchNo: 'desc' }, { slotIndex: 'asc' }],
      take: input.take ?? 6,
      include: {
        targetPlayer: {
          select: {
            nickname: true,
            protectedUntil: true,
            castleLevelCache: true,
            faction: { select: { name: true } },
            army: { select: { totalCount: true, availableCount: true } },
          },
        },
      },
    });
  }

  findRaidOrderByIdempotencyKey(
    requestIdempotencyKey: string,
    client: PrismaExecutor = this.prisma.db,
  ) {
    return client.raidOrder.findUnique({
      where: { requestIdempotencyKey },
      include: {
        assetLocks: true,
        settlement: true,
        battleReports: true,
        raidMessage: true,
      },
    });
  }

  findDueRaidOrders(
    input: {
      statuses: RaidOrderStatus[];
      now?: Date;
      take?: number;
    },
    client: PrismaExecutor = this.prisma.db,
  ) {
    return client.raidOrder.findMany({
      where: {
        status: { in: input.statuses },
        settleAt: { lte: input.now ?? new Date() },
      },
      orderBy: { settleAt: 'asc' },
      take: input.take ?? 50,
      include: {
        assetLocks: true,
      },
    });
  }

  findRaidOrderForSettlement(
    raidOrderId: string,
    client: PrismaExecutor = this.prisma.db,
  ) {
    return client.raidOrder.findUnique({
      where: { id: raidOrderId },
      include: {
        assetLocks: true,
        settlement: true,
        battleReports: true,
        attacker: {
          select: {
            id: true,
            nickname: true,
            faction: { select: { name: true } },
            wallet: {
              select: {
                vaultGold: true,
                vaultCapacity: true,
                pendingRaidOverflowGold: true,
                pendingRaidOverflowExpiresAt: true,
                balanceVersion: true,
              },
            },
            army: {
              select: {
                totalCount: true,
                availableCount: true,
                frozenCount: true,
                armyVersion: true,
              },
            },
            spiritSlots: {
              where: { isMain: true },
              take: 1,
              select: {
                id: true,
                slotIndex: true,
                level: true,
                element: true,
                currentHp: true,
                maxHp: true,
                status: true,
                spiritDefinition: {
                  select: {
                    id: true,
                    spiritId: true,
                    label: true,
                    rarity: true,
                    factionAffinity: true,
                    role: true,
                    baseAttack: true,
                    baseDefense: true,
                    baseHp: true,
                    growthAttack: true,
                    growthDefense: true,
                    growthHp: true,
                  },
                },
              },
            },
            farmBoard: { select: { message: true, hiddenAt: true } },
          },
        },
        defender: {
          select: {
            id: true,
            nickname: true,
            faction: { select: { name: true } },
            spiritSlots: {
              where: { isMain: true },
              take: 1,
              select: {
                id: true,
                slotIndex: true,
                level: true,
                element: true,
                currentHp: true,
                maxHp: true,
                status: true,
                spiritDefinition: {
                  select: {
                    id: true,
                    spiritId: true,
                    label: true,
                    rarity: true,
                    factionAffinity: true,
                    role: true,
                    baseAttack: true,
                    baseDefense: true,
                    baseHp: true,
                    growthAttack: true,
                    growthDefense: true,
                    growthHp: true,
                  },
                },
              },
            },
          },
        },
        raidMessage: true,
      },
    });
  }

  createRaidOrder(
    data: Prisma.RaidOrderCreateInput,
    client: PrismaExecutor = this.prisma.db,
  ) {
    return client.raidOrder.create({ data });
  }

  createRaidAssetLock(
    data: Prisma.RaidAssetLockCreateInput,
    client: PrismaExecutor = this.prisma.db,
  ) {
    return client.raidAssetLock.create({ data });
  }

  createRaidSettlement(
    data: Prisma.RaidSettlementCreateInput,
    client: PrismaExecutor = this.prisma.db,
  ) {
    return client.raidSettlement.create({ data });
  }

  createBattleReports(
    data: Prisma.BattleReportCreateManyInput[],
    client: PrismaExecutor = this.prisma.db,
  ) {
    return client.battleReport.createMany({ data });
  }
}
