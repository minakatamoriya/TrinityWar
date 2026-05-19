import { Inject, Injectable } from '@nestjs/common';
import type {
  AdminListResponse,
  AdminOverviewResponse,
  AdminPlayerOverviewResponse,
  AdminPlayerSearchResponse,
  AdminRaidOrderDetailResponse,
  AdminSystemStatusResponse,
} from '@trinitywar/shared';
import { APP_NAME, DOCS_ROUTE } from '@trinitywar/shared';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface PagingQuery {
  page?: string;
  pageSize?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class AdminReadonlyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getOverview(): Promise<AdminOverviewResponse> {
    return {
      app: APP_NAME,
      docs: DOCS_ROUTE,
      modules: [
        'system-status',
        'player-search',
        'player-overview',
        'wallet-logs',
        'building-logs',
        'field-logs',
        'player-orders',
        'raid-order-detail',
      ],
    };
  }

  async getSystemStatus(): Promise<AdminSystemStatusResponse> {
    let databaseStatus: 'up' | 'down' = 'up';

    try {
      await this.prisma.db.$queryRaw`SELECT 1`;
    } catch {
      databaseStatus = 'down';
    }

    return {
      app: APP_NAME,
      environment: process.env.NODE_ENV ?? 'development',
      version: '0.1.0',
      time: new Date().toISOString(),
      database: { status: databaseStatus },
      workers: [{ name: 'raid-settlement', status: 'registered' }],
      featureFlags: {
        adminDebugKeyEnabled: Boolean(process.env.ADMIN_DEBUG_KEY?.trim()),
        forceMockReads: parseBoolean(process.env.VITE_FORCE_MOCK_READS),
        allowMockReadFallback: parseBoolean(process.env.VITE_ALLOW_MOCK_READ_FALLBACK),
        forceMockCommands: parseBoolean(process.env.VITE_FORCE_MOCK_COMMANDS),
      },
    };
  }

  async searchPlayers(query: Record<string, string | undefined>): Promise<AdminPlayerSearchResponse> {
    const keyword = query.keyword?.trim();
    if (!keyword) {
      throw new BusinessError({
        code: ErrorCode.BadRequest,
        message: 'keyword is required.',
        statusCode: 400,
      });
    }

    const { page, pageSize, skip, take } = parsePagination(query);
    const where = {
      OR: [
        { id: { contains: keyword } },
        { nickname: { contains: keyword, mode: 'insensitive' as const } },
        { authIdentities: { some: { providerUserId: { contains: keyword, mode: 'insensitive' as const } } } },
      ],
    };
    const [items, total] = await Promise.all([
      this.prisma.db.player.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          nickname: true,
          castleLevelCache: true,
          lastLoginAt: true,
          faction: { select: { name: true } },
          authIdentities: { select: { provider: true, providerUserId: true } },
        },
      }),
      this.prisma.db.player.count({ where }),
    ]);

    return {
      items: items.map((player) => ({
        playerId: player.id,
        nickname: player.nickname,
        faction: player.faction?.name ?? null,
        castleLevel: player.castleLevelCache,
        lastLoginAt: toIso(player.lastLoginAt),
        tags: player.authIdentities.map((identity) => `${identity.provider}:${identity.providerUserId}`),
      })),
      pagination: { page, pageSize, total },
    };
  }

  async getPlayerOverview(playerId: string): Promise<AdminPlayerOverviewResponse> {
    const player = await this.prisma.db.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        nickname: true,
        castleLevelCache: true,
        stateVersion: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        faction: { select: { code: true, name: true } },
        factionMembers: {
          select: {
            contributionScore: true,
            joinedAt: true,
            faction: { select: { code: true, name: true } },
          },
          take: 5,
        },
        wallet: true,
        buildings: true,
        army: true,
        fieldSlots: { orderBy: { slotIndex: 'asc' }, include: { seedDefinition: true } },
        seedInventory: { include: { seedDefinition: true }, orderBy: { updatedAt: 'desc' } },
        taskStates: { orderBy: { updatedAt: 'desc' }, take: 20 },
        ownedBattleReports: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!player) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Player not found.',
        statusCode: 404,
      });
    }

    return {
      identity: {
        playerId: player.id,
        nickname: player.nickname,
        faction: player.faction,
        factionMembers: player.factionMembers.map((member) => ({
          faction: member.faction,
          contributionScore: member.contributionScore,
          joinedAt: toIso(member.joinedAt),
        })),
        castleLevel: player.castleLevelCache,
        stateVersion: player.stateVersion,
        createdAt: toIso(player.createdAt),
        updatedAt: toIso(player.updatedAt),
        lastLoginAt: toIso(player.lastLoginAt),
      },
      wallet: player.wallet ? normalizeDates(player.wallet) : null,
      building: player.buildings ? normalizeDates(player.buildings) : null,
      army: player.army ? normalizeDates(player.army) : null,
      fields: player.fieldSlots.map((field) => normalizeDates({
        id: field.id,
        slotIndex: field.slotIndex,
        isUnlocked: field.isUnlocked,
        status: field.status,
        seedId: field.seedDefinition?.seedId ?? null,
        currentClaimableGold: field.currentClaimableGold,
        matureAt: field.matureAt,
        fullMatureAt: field.fullMatureAt,
        overripeAt: field.overripeAt,
        statusVersion: field.statusVersion,
        updatedAt: field.updatedAt,
      })),
      seedInventory: {
        unlockedSeedIds: player.seedInventory
          .filter((item) => item.unlockedAt || item.quantity > 0)
          .map((item) => item.seedDefinition.seedId),
        items: player.seedInventory.map((item) => normalizeDates({
          seedId: item.seedDefinition.seedId,
          label: item.seedDefinition.label,
          quantity: item.quantity,
          inventoryVersion: item.inventoryVersion,
          unlockedAt: item.unlockedAt,
        })),
      },
      dailyTasks: player.taskStates.map((task) => normalizeDates(task)),
      recentReports: player.ownedBattleReports.map((report) => normalizeDates(report)),
    };
  }

  async getWalletLogs(playerId: string, query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const where = {
      playerId,
      ...buildDateRange(query),
      ...(query.changeType ? { changeType: query.changeType } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.db.walletChangeLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.db.walletChangeLog.count({ where }),
    ]);
    return { items: items.map(normalizeDates), pagination: { page, pageSize, total } };
  }

  async getBuildingLogs(playerId: string, query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const where = {
      playerId,
      ...buildDateRange(query),
      ...(query.buildingKey ? { buildingKey: query.buildingKey } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.db.buildingUpgradeLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.db.buildingUpgradeLog.count({ where }),
    ]);
    return { items: items.map(normalizeDates), pagination: { page, pageSize, total } };
  }

  async getFieldLogs(playerId: string, query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const where = {
      playerId,
      ...buildDateRange(query),
      ...(query.actionType ? { collectMode: query.actionType } : {}),
      ...(query.slotIndex ? { fieldSlot: { slotIndex: Number(query.slotIndex) } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.db.fieldHarvestLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { fieldSlot: { select: { slotIndex: true } } },
      }),
      this.prisma.db.fieldHarvestLog.count({ where }),
    ]);
    return { items: items.map(normalizeDates), pagination: { page, pageSize, total } };
  }

  async getPlayerOrders(playerId: string, query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const status = query.status?.trim();
    const type = query.type?.trim();
    const mergeTake = skip + take;
    const trainingWhere = { playerId, ...(status ? { status: status as never } : {}) };
    const raidWhere = {
      OR: [{ attackerPlayerId: playerId }, { defenderPlayerId: playerId }],
      ...(status ? { status: status as never } : {}),
    };
    const [trainingQueues, trainingTotal, raidOrders, raidTotal] = await Promise.all([
      type && type !== 'army-training'
        ? Promise.resolve([])
        : this.prisma.db.armyTrainingQueue.findMany({
          where: trainingWhere,
          orderBy: { createdAt: 'desc' },
          take: mergeTake,
        }),
      type && type !== 'army-training'
        ? Promise.resolve(0)
        : this.prisma.db.armyTrainingQueue.count({ where: trainingWhere }),
      type && type !== 'raid'
        ? Promise.resolve([])
        : this.prisma.db.raidOrder.findMany({
          where: raidWhere,
          orderBy: { createdAt: 'desc' },
          take: mergeTake,
        }),
      type && type !== 'raid'
        ? Promise.resolve(0)
        : this.prisma.db.raidOrder.count({ where: raidWhere }),
    ]);
    const items = [
      ...trainingQueues.map((queue) => normalizeDates({
        type: 'army-training',
        orderId: queue.id,
        status: queue.status,
        queuedCount: queue.queuedCount,
        totalCostGold: queue.totalCostGold,
        startedAt: queue.startedAt,
        finishAt: queue.finishAt,
        createdAt: queue.createdAt,
      })),
      ...raidOrders.map((order) => normalizeDates({
        type: 'raid',
        orderId: order.id,
        status: order.status,
        attackerPlayerId: order.attackerPlayerId,
        defenderPlayerId: order.defenderPlayerId,
        dispatchedUnitCount: order.dispatchedUnitCount,
        dispatchedAt: order.dispatchedAt,
        settleAt: order.settleAt,
        settledAt: order.settledAt,
        createdAt: order.createdAt,
      })),
    ].sort((left, right) => String(right['createdAt'] ?? '').localeCompare(String(left['createdAt'] ?? '')));

    return {
      items: items.slice(skip, skip + take),
      pagination: { page, pageSize, total: trainingTotal + raidTotal },
    };
  }

  async getRaidOrderDetail(orderId: string): Promise<AdminRaidOrderDetailResponse> {
    const order = await this.prisma.db.raidOrder.findUnique({
      where: { id: orderId },
      include: {
        settlement: true,
        battleReports: { orderBy: { createdAt: 'desc' } },
        assetLocks: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Raid order not found.',
        statusCode: 404,
      });
    }

    return {
      order: normalizeDates({
        id: order.id,
        attackerPlayerId: order.attackerPlayerId,
        defenderPlayerId: order.defenderPlayerId,
        defenderFieldSlotId: order.defenderFieldSlotId,
        sourceTargetPoolId: order.sourceTargetPoolId,
        mode: order.mode,
        status: order.status,
        dispatchedUnitCount: order.dispatchedUnitCount,
        requestIdempotencyKey: order.requestIdempotencyKey,
        dispatchedAt: order.dispatchedAt,
        settleAt: order.settleAt,
        settledAt: order.settledAt,
        settlementVersion: order.settlementVersion,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      }),
      settlement: order.settlement ? normalizeDates(order.settlement) : null,
      reports: order.battleReports.map(normalizeDates),
      assetLocks: order.assetLocks.map(normalizeDates),
    };
  }
}

function parsePagination(query: PagingQuery): { page: number; pageSize: number; skip: number; take: number } {
  const page = Math.max(Number(query.page ?? 1) || 1, 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize ?? 20) || 20, 1), 100);
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

function buildDateRange(query: PagingQuery): { createdAt?: { gte?: Date; lte?: Date } } {
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (query.from) {
    createdAt.gte = new Date(query.from);
  }
  if (query.to) {
    createdAt.lte = new Date(query.to);
  }
  return Object.keys(createdAt).length > 0 ? { createdAt } : {};
}

function normalizeDates<T extends Record<string, unknown>>(record: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]),
  );
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function parseBoolean(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}
