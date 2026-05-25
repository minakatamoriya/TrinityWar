import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  AdminDeletePlayerResponse,
  AdminListResponse,
  AdminOverviewResponse,
  AdminPlayerOverviewResponse,
  AdminPlayerSearchResponse,
  AdminRaidOrderDetailResponse,
  AdminSystemStatusResponse,
} from '@trinitywar/shared';
import { APP_NAME, DOCS_ROUTE } from '@trinitywar/shared';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { GAME_DESIGN_CONFIG } from '../lib/game-balance.js';
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
        'seed-config',
        'spirit-config',
        'castle-level-config',
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
        adminWriteDebugKeyEnabled: Boolean(process.env.ADMIN_WRITE_DEBUG_KEY?.trim()),
        forceMockReads: parseBoolean(process.env.VITE_FORCE_MOCK_READS),
        allowMockReadFallback: parseBoolean(process.env.VITE_ALLOW_MOCK_READ_FALLBACK),
        forceMockCommands: parseBoolean(process.env.VITE_FORCE_MOCK_COMMANDS),
      },
    };
  }

  async listSeedDefinitions(query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const [items, total] = await Promise.all([
      this.prisma.db.seedDefinition.findMany({
        orderBy: [{ sortOrder: 'asc' }, { seedId: 'asc' }],
        skip,
        take,
      }),
      this.prisma.db.seedDefinition.count(),
    ]);

    return { items: items.map(normalizeDates), pagination: { page, pageSize, total } };
  }

  async createSeedDefinition(body: unknown): Promise<Record<string, unknown>> {
    const payload = parseSeedDefinitionPayload(body, true);
    try {
      const created = await this.prisma.db.seedDefinition.create({ data: payload as unknown as Prisma.SeedDefinitionUncheckedCreateInput });
      return normalizeDates(created);
    } catch (caught) {
      throwConfigMutationError(caught, 'Seed definition already exists or is referenced.');
    }
  }

  async updateSeedDefinition(seedId: string, body: unknown): Promise<Record<string, unknown>> {
    const payload = parseSeedDefinitionPayload(body, false);
    if (Object.keys(payload).length <= 0) {
      throwBadRequest('At least one seed field is required.');
    }

    try {
      const updated = await this.prisma.db.seedDefinition.update({
        where: { seedId },
        data: payload as Prisma.SeedDefinitionUncheckedUpdateInput,
      });
      return normalizeDates(updated);
    } catch (caught) {
      throwConfigMutationError(caught, 'Seed definition not found or update conflicts.');
    }
  }

  async deleteSeedDefinition(seedId: string): Promise<Record<string, unknown>> {
    try {
      const deleted = await this.prisma.db.seedDefinition.delete({ where: { seedId } });
      return { seedId: deleted.seedId, label: deleted.label, deleted: true };
    } catch (caught) {
      throwConfigMutationError(caught, 'Seed definition is referenced by player data or does not exist.');
    }
  }

  async listSpiritDefinitions(query: Record<string, string | undefined>): Promise<AdminListResponse<Record<string, unknown>>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const [items, total] = await Promise.all([
      this.prisma.db.spiritDefinition.findMany({
        orderBy: [{ sortOrder: 'asc' }, { spiritId: 'asc' }],
        skip,
        take,
      }),
      this.prisma.db.spiritDefinition.count(),
    ]);

    return { items: items.map(normalizeDates), pagination: { page, pageSize, total } };
  }

  async createSpiritDefinition(body: unknown): Promise<Record<string, unknown>> {
    const payload = parseSpiritDefinitionPayload(body, true);
    try {
      const created = await this.prisma.db.spiritDefinition.create({ data: payload as unknown as Prisma.SpiritDefinitionUncheckedCreateInput });
      return normalizeDates(created);
    } catch (caught) {
      throwConfigMutationError(caught, 'Spirit definition already exists or is referenced.');
    }
  }

  async updateSpiritDefinition(spiritId: string, body: unknown): Promise<Record<string, unknown>> {
    const payload = parseSpiritDefinitionPayload(body, false);
    if (Object.keys(payload).length <= 0) {
      throwBadRequest('At least one spirit field is required.');
    }

    try {
      const updated = await this.prisma.db.spiritDefinition.update({
        where: { spiritId },
        data: payload as Prisma.SpiritDefinitionUncheckedUpdateInput,
      });
      return normalizeDates(updated);
    } catch (caught) {
      throwConfigMutationError(caught, 'Spirit definition not found or update conflicts.');
    }
  }

  async deleteSpiritDefinition(spiritId: string): Promise<Record<string, unknown>> {
    try {
      const deleted = await this.prisma.db.spiritDefinition.delete({ where: { spiritId } });
      return { spiritId: deleted.spiritId, label: deleted.label, deleted: true };
    } catch (caught) {
      throwConfigMutationError(caught, 'Spirit definition is referenced by player data or does not exist.');
    }
  }

  async listCastleLevels(): Promise<AdminListResponse<Record<string, unknown>>> {
    const landDeeds = GAME_DESIGN_CONFIG.landDeeds.map((deed: Record<string, unknown>) => ({
      type: 'land-deed',
      key: deed['deedKey'],
      title: deed['title'],
      requirements: formatRuleRequirements(deed['requirements'], deed['alternativeRequirements']),
      cost: '-',
      effect: `unlock field ${deed['targetFieldSlotIndex']}`,
      rewards: '-',
    }));
    const territoryTechs = Object.entries(GAME_DESIGN_CONFIG.territoryTechs as Record<string, { title?: string; levels?: Array<Record<string, unknown>> }>)
      .flatMap(([key, track]) => (track.levels ?? []).map((level) => ({
        type: 'spell',
        key: `${key}-lv-${level['level']}`,
        title: track.title ?? key,
        requirements: 'no castle-level requirement',
        cost: formatRuleCost(level),
        effect: level['effectValue'],
        rewards: '-',
      })));
    const factionStipends = ((GAME_DESIGN_CONFIG.factionStipends as { tiers?: Array<Record<string, unknown>> }).tiers ?? [])
      .map((tier) => ({
        type: 'faction-stipend',
        key: tier['tierKey'],
        title: tier['label'],
        requirements: `contribution >= ${tier['minContribution']}`,
        cost: 'daily claim',
        effect: '-',
        rewards: formatRuleRewards(tier['rewards']),
      }));
    const items = [...landDeeds, ...territoryTechs, ...factionStipends];
    return {
      items,
      pagination: { page: 1, pageSize: items.length, total: items.length },
    };
  }
  async searchPlayers(query: Record<string, string | undefined>): Promise<AdminPlayerSearchResponse> {
    const keyword = query.keyword?.trim();
    const { page, pageSize, skip, take } = parsePagination(query);
    const where = keyword
      ? {
          OR: [
            { id: { contains: keyword } },
            { nickname: { contains: keyword, mode: 'insensitive' as const } },
            { authIdentities: { some: { providerUserId: { contains: keyword, mode: 'insensitive' as const } } } },
          ],
        }
      : {};
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

  async deletePlayer(playerId: string): Promise<AdminDeletePlayerResponse> {
    const normalizedPlayerId = playerId.trim();
    if (!normalizedPlayerId) {
      throw new BusinessError({
        code: ErrorCode.BadRequest,
        message: 'playerId is required.',
        statusCode: 400,
      });
    }

    const existing = await this.prisma.db.player.findUnique({
      where: { id: normalizedPlayerId },
      select: { id: true, nickname: true },
    });
    if (!existing) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Player not found.',
        statusCode: 404,
      });
    }

    await this.prisma.db.player.delete({ where: { id: normalizedPlayerId } });
    return {
      playerId: existing.id,
      nickname: existing.nickname,
      deleted: true,
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
        spiritResource: true,
        spiritSlots: {
          orderBy: { slotIndex: 'asc' },
          include: { spiritDefinition: true },
        },
        spiritCodex: {
          orderBy: { updatedAt: 'desc' },
          take: 20,
          include: { spiritDefinition: true },
        },
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
      spirit: {
        resource: player.spiritResource ? normalizeDates(player.spiritResource) : null,
        mainSlot: (() => {
          const mainSlot = player.spiritSlots.find((slot) => slot.isMain);
          return mainSlot ? normalizeSpiritSlot(mainSlot) : null;
        })(),
        slots: player.spiritSlots.map(normalizeSpiritSlot),
        codex: player.spiritCodex.map((entry) => normalizeDates({
          spiritId: entry.spiritDefinition.spiritId,
          label: entry.spiritDefinition.label,
          rarity: entry.spiritDefinition.rarity,
          factionAffinity: entry.spiritDefinition.factionAffinity,
          role: entry.spiritDefinition.role,
          shardName: entry.spiritDefinition.shardName,
          shardCount: entry.shardCount,
          shardUnlockRequired: entry.spiritDefinition.shardUnlockRequired,
          hasSeen: entry.hasSeen,
          readyToCompose: entry.readyToCompose,
          ownedCurrent: entry.ownedCurrent,
          ownedEver: entry.ownedEver,
          firstSeenAt: entry.firstSeenAt,
          readyAt: entry.readyAt,
          lastOwnedAt: entry.lastOwnedAt,
          codexVersion: entry.codexVersion,
        })),
      },
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

function parseSeedDefinitionPayload(body: unknown, requireAll: boolean): Record<string, string | number | null> {
  const record = requireRecord(body);
  const payload: Record<string, string | number | null> = {};

  copyStringField(payload, record, 'seedId', requireAll);
  copyStringField(payload, record, 'label', requireAll);
  copyEnumField(payload, record, 'rarity', ['common', 'rare', 'legendary'], requireAll);
  copyIntegerField(payload, record, 'sortOrder', requireAll, 0);
  copyIntegerField(payload, record, 'seedSeconds', requireAll, 1);
  copyIntegerField(payload, record, 'growSeconds', requireAll, 1);
  copyIntegerField(payload, record, 'matureSeconds', requireAll, 1);
  copyIntegerField(payload, record, 'ripeWindowSeconds', requireAll, 0);
  copyIntegerField(payload, record, 'baseYieldGold', requireAll, 0);
  copyIntegerField(payload, record, 'harvestSeedReturn', requireAll, 0);
  copyNullableStringField(payload, record, 'strategyNote', requireAll);
  copyNullableStringField(payload, record, 'lore', requireAll);

  return payload;
}

function parseSpiritDefinitionPayload(body: unknown, requireAll: boolean): Record<string, string | number | null> {
  const record = requireRecord(body);
  const payload: Record<string, string | number | null> = {};

  copyStringField(payload, record, 'spiritId', requireAll);
  copyStringField(payload, record, 'label', requireAll);
  copyEnumField(payload, record, 'rarity', ['COMMON', 'RARE', 'LEGENDARY'], requireAll, true);
  copyEnumField(payload, record, 'factionAffinity', ['human', 'immortal', 'demon'], requireAll);
  copyEnumField(payload, record, 'role', ['ATTACK', 'DEFENSE', 'BALANCED', 'HEALTH'], requireAll, true);
  copyStringField(payload, record, 'shardName', requireAll);
  copyIntegerField(payload, record, 'shardUnlockRequired', requireAll, 1);
  copyIntegerField(payload, record, 'baseAttack', requireAll, 0);
  copyIntegerField(payload, record, 'baseDefense', requireAll, 0);
  copyIntegerField(payload, record, 'baseHp', requireAll, 1);
  copyIntegerField(payload, record, 'growthAttack', requireAll, 0);
  copyIntegerField(payload, record, 'growthDefense', requireAll, 0);
  copyIntegerField(payload, record, 'growthHp', requireAll, 0);
  copyIntegerField(payload, record, 'sortOrder', requireAll, 0);
  copyNullableStringField(payload, record, 'lore', requireAll);

  return payload;
}

function requireRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throwBadRequest('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

function copyStringField(
  payload: Record<string, string | number | null>,
  record: Record<string, unknown>,
  field: string,
  required: boolean,
): void {
  const value = record[field];
  if (value === undefined) {
    if (required) {
      throwBadRequest(`${field} is required.`);
    }
    return;
  }
  if (typeof value !== 'string' || value.trim().length <= 0) {
    throwBadRequest(`${field} must be a non-empty string.`);
  }
  payload[field] = value.trim();
}

function copyNullableStringField(
  payload: Record<string, string | number | null>,
  record: Record<string, unknown>,
  field: string,
  required: boolean,
): void {
  const value = record[field];
  if (value === undefined) {
    if (required) {
      payload[field] = null;
    }
    return;
  }
  if (value === null) {
    payload[field] = null;
    return;
  }
  if (typeof value !== 'string') {
    throwBadRequest(`${field} must be a string or null.`);
  }
  payload[field] = value.trim() || null;
}

function copyIntegerField(
  payload: Record<string, string | number | null>,
  record: Record<string, unknown>,
  field: string,
  required: boolean,
  minValue: number,
): void {
  const value = record[field];
  if (value === undefined) {
    if (required) {
      throwBadRequest(`${field} is required.`);
    }
    return;
  }
  const normalized = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(normalized) || Number(normalized) < minValue) {
    throwBadRequest(`${field} must be an integer >= ${minValue}.`);
  }
  payload[field] = Number(normalized);
}

function copyEnumField(
  payload: Record<string, string | number | null>,
  record: Record<string, unknown>,
  field: string,
  allowedValues: string[],
  required: boolean,
  uppercase = false,
): void {
  const value = record[field];
  if (value === undefined) {
    if (required) {
      throwBadRequest(`${field} is required.`);
    }
    return;
  }
  if (typeof value !== 'string') {
    throwBadRequest(`${field} must be a string.`);
  }
  const normalized = uppercase ? value.trim().toUpperCase() : value.trim();
  if (!allowedValues.includes(normalized)) {
    throwBadRequest(`${field} must be one of: ${allowedValues.join(', ')}.`);
  }
  payload[field] = normalized;
}

function throwConfigMutationError(caught: unknown, fallbackMessage: string): never {
  const code = getPrismaErrorCode(caught);
  if (code === 'P2025') {
    throw new BusinessError({
      code: ErrorCode.NotFound,
      message: fallbackMessage,
      statusCode: 404,
    });
  }
  if (code === 'P2002' || code === 'P2003') {
    throw new BusinessError({
      code: ErrorCode.Conflict,
      message: fallbackMessage,
      statusCode: 409,
    });
  }
  throw new BusinessError({
    code: ErrorCode.Conflict,
    message: fallbackMessage,
    statusCode: 409,
    details: caught instanceof Error ? caught.message : String(caught),
  });
}

function getPrismaErrorCode(caught: unknown): string | null {
  if (!caught || typeof caught !== 'object' || !('code' in caught)) {
    return null;
  }
  const code = (caught as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function throwBadRequest(message: string): never {
  throw new BusinessError({
    code: ErrorCode.BadRequest,
    message,
    statusCode: 400,
  });
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

function formatRuleRequirements(requirements: unknown, alternativeRequirements: unknown): string {
  const main = formatRequirementList(requirements);
  const alternative = formatRequirementList(alternativeRequirements);
  return alternative ? `${main} OR ${alternative}` : main;
}

function formatRequirementList(requirements: unknown): string {
  if (!Array.isArray(requirements)) {
    return '';
  }

  return requirements
    .map((requirement) => {
      const record = requirement && typeof requirement === 'object' ? requirement as Record<string, unknown> : {};
      return `${record['label'] ?? record['key'] ?? 'requirement'} >= ${record['target'] ?? 0}`;
    })
    .join(' + ');
}

function formatRuleCost(level: Record<string, unknown>): string {
  const amount = Number(level['costAmount'] ?? level['upgradeCost'] ?? 0);
  const resource = level['costResource'] === 'tianjiTalisman' ? '天机符' : '金币';
  return `${Number.isFinite(amount) ? Math.max(Math.floor(amount), 0) : 0} ${resource}`;
}

function formatRuleRewards(rewards: unknown): string {
  if (!Array.isArray(rewards)) {
    return '';
  }

  return rewards
    .map((reward) => {
      const record = reward && typeof reward === 'object' ? reward as Record<string, unknown> : {};
      return `${record['label'] ?? record['kind'] ?? 'reward'} x${record['quantity'] ?? 0}`;
    })
    .join(', ');
}

function normalizeSpiritSlot(slot: {
  id: string;
  playerId: string;
  slotIndex: number;
  spiritDefinitionId: string | null;
  isMain: boolean;
  level: number;
  exp: number;
  element: unknown;
  currentHp: number;
  maxHp: number;
  status: unknown;
  acquiredAt: Date | null;
  dissolvedAt: Date | null;
  slotVersion: number;
  createdAt: Date;
  updatedAt: Date;
  spiritDefinition: {
    spiritId: string;
    label: string;
    rarity: unknown;
    factionAffinity: string;
    role: unknown;
    shardName: string;
    shardUnlockRequired: number;
    baseAttack: number;
    baseDefense: number;
    baseHp: number;
    growthAttack: number;
    growthDefense: number;
    growthHp: number;
    lore: string | null;
  } | null;
}): Record<string, unknown> {
  return normalizeDates({
    id: slot.id,
    playerId: slot.playerId,
    slotIndex: slot.slotIndex,
    isMain: slot.isMain,
    spiritId: slot.spiritDefinition?.spiritId ?? null,
    label: slot.spiritDefinition?.label ?? null,
    rarity: slot.spiritDefinition?.rarity ?? null,
    factionAffinity: slot.spiritDefinition?.factionAffinity ?? null,
    role: slot.spiritDefinition?.role ?? null,
    element: slot.element,
    level: slot.level,
    exp: slot.exp,
    currentHp: slot.currentHp,
    maxHp: slot.maxHp,
    status: slot.status,
    baseAttack: slot.spiritDefinition?.baseAttack ?? null,
    baseDefense: slot.spiritDefinition?.baseDefense ?? null,
    baseHp: slot.spiritDefinition?.baseHp ?? null,
    growthAttack: slot.spiritDefinition?.growthAttack ?? null,
    growthDefense: slot.spiritDefinition?.growthDefense ?? null,
    growthHp: slot.spiritDefinition?.growthHp ?? null,
    shardName: slot.spiritDefinition?.shardName ?? null,
    shardUnlockRequired: slot.spiritDefinition?.shardUnlockRequired ?? null,
    lore: slot.spiritDefinition?.lore ?? null,
    acquiredAt: slot.acquiredAt,
    dissolvedAt: slot.dissolvedAt,
    slotVersion: slot.slotVersion,
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt,
  });
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function parseBoolean(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

