import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { NotificationCategory as PrismaNotificationCategory, PlayerNotificationClaimStatus as PrismaPlayerNotificationClaimStatus, PrismaClient } from '@prisma/client';
import type {
  AdminListResponse,
  AdminCreateNotificationRequest,
  AdminCreateNotificationResponse,
  AdminNotificationHistoryItem,
  AdminPlayerNotificationItem,
  ClientClaimNotificationResponse,
  ClientDeleteNotificationResponse,
  ClientMarkNotificationReadResponse,
  ClientNotificationItem,
  ClientNotificationListResponse,
  ClientUnreadNotificationCountResponse,
  NotificationAttachment,
  NotificationAttachmentKind,
  NotificationCategory,
  PlayerNotificationClaimStatus,
} from '@trinitywar/shared';
import { AuditService } from '../audit/audit.service.js';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface PagingQuery {
  page?: string;
  pageSize?: string;
}

@Injectable()
export class NotificationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async createGlobalNotification(body: unknown): Promise<AdminCreateNotificationResponse> {
    const payload = await this.parseNotificationPayload(body);
    const players = await this.prisma.db.player.findMany({
      select: { id: true },
    });

    const created = await this.prisma.transaction(async (client) => {
      const systemNotification = await client.systemNotification.create({
        data: {
          audience: 'GLOBAL',
          category: payload.category,
          title: payload.title,
          body: payload.body,
          expiresAt: payload.expiresAt,
          createdByAdmin: 'admin-console',
        },
      });

      if (players.length > 0) {
        await client.playerNotification.createMany({
          data: players.map((player) => ({
            playerId: player.id,
            systemNotificationId: systemNotification.id,
            category: payload.category,
            titleSnapshot: payload.title,
            bodySnapshot: payload.body,
            attachmentJson: payload.attachments.length > 0 ? toAttachmentJson(payload.attachments) : Prisma.DbNull,
            expiresAt: payload.expiresAt,
            claimStatus: payload.attachments.length > 0 ? 'UNCLAIMED' : 'NONE',
          })),
        });
      }

      return systemNotification;
    });

    return mapAdminCreateResponse(created, 'global', players.length, payload.attachments.length);
  }

  async createPlayerNotification(playerId: string, body: unknown): Promise<AdminCreateNotificationResponse> {
    const payload = await this.parseNotificationPayload(body);
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

    const created = await this.prisma.transaction(async (client) => {
      const systemNotification = await client.systemNotification.create({
        data: {
          audience: 'PLAYER',
          category: payload.category,
          title: payload.title,
          body: payload.body,
          expiresAt: payload.expiresAt,
          createdByAdmin: 'admin-console',
        },
      });

      await client.playerNotification.create({
        data: {
          playerId,
          systemNotificationId: systemNotification.id,
          category: payload.category,
          titleSnapshot: payload.title,
          bodySnapshot: payload.body,
          attachmentJson: payload.attachments.length > 0 ? toAttachmentJson(payload.attachments) : Prisma.DbNull,
          expiresAt: payload.expiresAt,
          claimStatus: payload.attachments.length > 0 ? 'UNCLAIMED' : 'NONE',
        },
      });

      return systemNotification;
    });

    return mapAdminCreateResponse(created, 'player', 1, payload.attachments.length);
  }

  async listNotificationHistory(query: Record<string, string | undefined>): Promise<AdminListResponse<AdminNotificationHistoryItem>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const [items, total] = await Promise.all([
      this.prisma.db.systemNotification.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
        include: {
          _count: {
            select: { playerNotifications: true },
          },
          playerNotifications: {
            select: { attachmentJson: true },
            take: 1,
          },
        },
      }),
      this.prisma.db.systemNotification.count(),
    ]);

    return {
      items: items.map((item) => ({
        notificationId: item.id,
        title: item.title,
        body: item.body,
        audience: item.audience === 'GLOBAL' ? 'global' : 'player',
        category: mapCategory(item.category),
        createdAt: item.createdAt.toISOString(),
        expiresAt: item.expiresAt?.toISOString() ?? null,
        revokedAt: item.revokedAt?.toISOString() ?? null,
        attachmentCount: parseAttachments(item.playerNotifications[0]?.attachmentJson ?? null).length,
        playerCount: item._count.playerNotifications,
      })),
      pagination: { page, pageSize, total },
    };
  }

  async listAdminPlayerNotifications(
    playerId: string,
    query: Record<string, string | undefined>,
  ): Promise<AdminListResponse<AdminPlayerNotificationItem>> {
    await this.ensurePlayerExists(playerId);
    await this.expirePlayerNotifications(playerId);

    const { page, pageSize, skip, take } = parsePagination(query);
    const where: Prisma.PlayerNotificationWhereInput = { playerId };
    const [items, total] = await Promise.all([
      this.prisma.db.playerNotification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      this.prisma.db.playerNotification.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        title: item.titleSnapshot,
        body: item.bodySnapshot,
        category: mapCategory(item.category),
        claimStatus: mapClaimStatus(item.claimStatus),
        attachments: parseAttachments(item.attachmentJson),
        readAt: item.readAt?.toISOString() ?? null,
        claimedAt: item.claimedAt?.toISOString() ?? null,
        deletedAt: item.deletedAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
        expiresAt: item.expiresAt?.toISOString() ?? null,
      })),
      pagination: { page, pageSize, total },
    };
  }

  async listPlayerNotifications(playerId: string, query: Record<string, string | undefined>): Promise<ClientNotificationListResponse> {
    await this.expirePlayerNotifications(playerId);
    const { page, pageSize, skip, take } = parsePagination(query);
    const where: Prisma.PlayerNotificationWhereInput = {
      playerId,
      deletedAt: null,
    };

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.db.playerNotification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      this.prisma.db.playerNotification.count({ where }),
      this.prisma.db.playerNotification.count({
        where: {
          ...where,
          readAt: null,
        },
      }),
    ]);

    return {
      items: items.map(mapClientNotificationItem),
      pagination: { page, pageSize, total },
      unreadCount,
    };
  }

  async getUnreadCount(playerId: string): Promise<ClientUnreadNotificationCountResponse> {
    await this.expirePlayerNotifications(playerId);
    const unreadCount = await this.prisma.db.playerNotification.count({
      where: {
        playerId,
        deletedAt: null,
        readAt: null,
      },
    });

    return { unreadCount };
  }

  async markPlayerNotificationAsRead(playerId: string, notificationId: string): Promise<ClientMarkNotificationReadResponse> {
    await this.expirePlayerNotifications(playerId);
    const existing = await this.prisma.db.playerNotification.findFirst({
      where: {
        id: notificationId,
        playerId,
        deletedAt: null,
      },
      select: {
        id: true,
        readAt: true,
      },
    });

    if (!existing) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Notification not found.',
        statusCode: 404,
      });
    }

    const readAt = existing.readAt ?? new Date();

    if (!existing.readAt) {
      await this.prisma.db.playerNotification.update({
        where: { id: notificationId },
        data: { readAt },
      });
    }

    const unreadCount = await this.prisma.db.playerNotification.count({
      where: {
        playerId,
        deletedAt: null,
        readAt: null,
      },
    });

    return {
      id: notificationId,
      read: true,
      readAt: readAt.toISOString(),
      unreadCount,
    };
  }

  async claimPlayerNotification(playerId: string, notificationId: string): Promise<ClientClaimNotificationResponse> {
    await this.expirePlayerNotifications(playerId);

    return this.prisma.transaction(async (client) => {
      const notification = await client.playerNotification.findFirst({
        where: {
          id: notificationId,
          playerId,
          deletedAt: null,
        },
        select: {
          id: true,
          attachmentJson: true,
          claimStatus: true,
          readAt: true,
          expiresAt: true,
          claimedAt: true,
        },
      });

      if (!notification) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Notification not found.',
          statusCode: 404,
        });
      }

      const attachments = parseAttachments(notification.attachmentJson);
      if (attachments.length <= 0) {
        throw new BusinessError({
          code: ErrorCode.BadRequest,
          message: 'This notification does not contain claimable attachments.',
          statusCode: 400,
        });
      }

      if (notification.claimStatus === 'CLAIMED') {
        throw new BusinessError({
          code: ErrorCode.Conflict,
          message: 'Notification attachments have already been claimed.',
          statusCode: 409,
        });
      }

      if (notification.claimStatus === 'EXPIRED' || (notification.expiresAt && notification.expiresAt.getTime() <= Date.now())) {
        await client.playerNotification.update({
          where: { id: notificationId },
          data: {
            claimStatus: 'EXPIRED',
          },
        });

        throw new BusinessError({
          code: ErrorCode.Conflict,
          message: 'Notification attachments have expired.',
          statusCode: 409,
        });
      }

      const summary = await this.applyNotificationAttachments(client, playerId, notificationId, attachments);
      const claimedAt = notification.claimedAt ?? new Date();
      const readAt = notification.readAt ?? claimedAt;

      await client.playerNotification.update({
        where: { id: notificationId },
        data: {
          claimStatus: 'CLAIMED',
          claimedAt,
          readAt,
        },
      });

      const unreadCount = await client.playerNotification.count({
        where: {
          playerId,
          deletedAt: null,
          readAt: null,
        },
      });

      return {
        id: notificationId,
        claimStatus: 'claimed',
        claimedAt: claimedAt.toISOString(),
        unreadCount,
        summary,
      };
    });
  }

  async deletePlayerNotification(playerId: string, notificationId: string): Promise<ClientDeleteNotificationResponse> {
    await this.expirePlayerNotifications(playerId);
    const existing = await this.prisma.db.playerNotification.findFirst({
      where: {
        id: notificationId,
        playerId,
        deletedAt: null,
      },
      select: {
        readAt: true,
        claimStatus: true,
      },
    });

    if (!existing) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Notification not found.',
        statusCode: 404,
      });
    }

    if (!existing.readAt) {
      throw new BusinessError({
        code: ErrorCode.BadRequest,
        message: 'Only read notifications can be deleted.',
        statusCode: 400,
      });
    }

    if (existing.claimStatus === 'UNCLAIMED') {
      throw new BusinessError({
        code: ErrorCode.BadRequest,
        message: 'Notification attachments must be claimed or expired before deletion.',
        statusCode: 400,
      });
    }

    await this.prisma.db.playerNotification.update({
      where: { id: notificationId },
      data: { deletedAt: new Date() },
    });

    const unreadCount = await this.prisma.db.playerNotification.count({
      where: {
        playerId,
        deletedAt: null,
        readAt: null,
      },
    });

    return {
      id: notificationId,
      deleted: true,
      unreadCount,
    };
  }

  private async parseNotificationPayload(body: unknown): Promise<{
    title: string;
    body: string;
    category: PrismaNotificationCategory;
    expiresAt: Date | null;
    attachments: NotificationAttachment[];
  }> {
    const payload = body as AdminCreateNotificationRequest | null;
    const attachments = await this.normalizeAttachments(payload?.attachments ?? []);
    const normalizedTitle = (payload?.title?.trim() || (attachments.length > 0 ? '系统补发' : '系统通知')).trim();
    const normalizedBody = (payload?.body?.trim() || (attachments.length > 0 ? `请查收附件：${attachments.map((item) => `${item.label} x${item.quantity}`).join('、')}。` : '请查收最新系统通知。')).trim();
    const category = parseCategory(payload?.category);
    const expiresAt = parseOptionalDate(payload?.expiresAt);

    if (normalizedTitle.length < 1 || normalizedTitle.length > 80) {
      throw new BusinessError({
        code: ErrorCode.BadRequest,
        message: 'Notification title must be 1-80 characters.',
        statusCode: 400,
      });
    }

    if (normalizedBody.length < 1 || normalizedBody.length > 1000) {
      throw new BusinessError({
        code: ErrorCode.BadRequest,
        message: 'Notification body must be 1-1000 characters.',
        statusCode: 400,
      });
    }

    if ((!payload?.title?.trim() && !payload?.body?.trim()) && attachments.length <= 0) {
      throw new BusinessError({
        code: ErrorCode.BadRequest,
        message: 'Notification must contain message content or attachments.',
        statusCode: 400,
      });
    }

    return {
      title: normalizedTitle,
      body: normalizedBody,
      category,
      expiresAt,
      attachments,
    };
  }

  private async normalizeAttachments(input: AdminCreateNotificationRequest['attachments']): Promise<NotificationAttachment[]> {
    if (!input || input.length <= 0) {
      return [];
    }

    const seedIds = input
      .filter((item): item is NonNullable<AdminCreateNotificationRequest['attachments']>[number] & { kind: 'seed'; seedId: string } => item.kind === 'seed' && typeof item.seedId === 'string' && item.seedId.trim().length > 0)
      .map((item) => item.seedId.trim());
    const seedDefinitions = seedIds.length > 0
      ? await this.prisma.db.seedDefinition.findMany({
          where: { seedId: { in: Array.from(new Set(seedIds)) } },
          select: { seedId: true, label: true },
        })
      : [];
    const seedLabelMap = new Map(seedDefinitions.map((item) => [item.seedId, item.label]));

    return input.map((item) => normalizeAttachmentInput(item, seedLabelMap));
  }

  private async ensurePlayerExists(playerId: string): Promise<void> {
    const player = await this.prisma.db.player.findUnique({ where: { id: playerId }, select: { id: true } });

    if (!player) {
      throw new BusinessError({
        code: ErrorCode.NotFound,
        message: 'Player not found.',
        statusCode: 404,
      });
    }
  }

  private async expirePlayerNotifications(playerId: string): Promise<void> {
    await this.prisma.db.playerNotification.updateMany({
      where: {
        playerId,
        deletedAt: null,
        claimStatus: 'UNCLAIMED',
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        claimStatus: 'EXPIRED',
      },
    });
  }

  private async applyNotificationAttachments(
    client: Prisma.TransactionClient | PrismaClient,
    playerId: string,
    notificationId: string,
    attachments: NotificationAttachment[],
  ): Promise<string> {
    const goldGrant = attachments.filter((item) => item.kind === 'gold').reduce((sum, item) => sum + item.quantity, 0);
    const spiritSoulGrant = attachments.filter((item) => item.kind === 'spiritSoul').reduce((sum, item) => sum + item.quantity, 0);
    const talismanGrant = attachments.filter((item) => item.kind === 'tianjiTalisman').reduce((sum, item) => sum + item.quantity, 0);
    const seedGrants = attachments.filter((item) => item.kind === 'seed');

    if (goldGrant > 0) {
      const wallet = await client.playerWallet.findUnique({
        where: { playerId },
        select: { vaultGold: true, vaultCapacity: true },
      });

      if (!wallet) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Player wallet state not found.',
          statusCode: 404,
        });
      }

      const availableSpace = Math.max(wallet.vaultCapacity - wallet.vaultGold, 0);
      if (goldGrant > availableSpace) {
        throw new BusinessError({
          code: ErrorCode.BadRequest,
          message: `Insufficient vault capacity. Available space: ${availableSpace}.`,
          statusCode: 400,
        });
      }

      await client.playerWallet.update({
        where: { playerId },
        data: {
          vaultGold: { increment: goldGrant },
          balanceVersion: { increment: 1 },
        },
      });

      await this.auditService.createWalletChangeLog(client, {
        playerId,
        walletBucket: 'vault',
        changeType: 'notification-attachment-claim',
        deltaGold: goldGrant,
        beforeGold: wallet.vaultGold,
        afterGold: wallet.vaultGold + goldGrant,
        relatedEntityType: 'player-notification',
        relatedEntityId: notificationId,
        note: `Claim notification attachment: gold x${goldGrant}.`,
      });
    }

    if (spiritSoulGrant > 0 || talismanGrant > 0) {
      await client.playerSpiritResource.upsert({
        where: { playerId },
        create: {
          playerId,
          spiritSoul: spiritSoulGrant,
          tianjiTalisman: talismanGrant,
        },
        update: {
          spiritSoul: spiritSoulGrant > 0 ? { increment: spiritSoulGrant } : undefined,
          tianjiTalisman: talismanGrant > 0 ? { increment: talismanGrant } : undefined,
          resourceVersion: { increment: 1 },
        },
      });
    }

    if (seedGrants.length > 0) {
      const seedDefinitions = await client.seedDefinition.findMany({
        where: { seedId: { in: seedGrants.map((item) => item.seedId ?? '') } },
        select: { id: true, seedId: true },
      });
      const seedIdMap = new Map(seedDefinitions.map((item) => [item.seedId, item.id]));

      for (const seedGrant of seedGrants) {
        const seedId = seedGrant.seedId ?? '';
        const seedDefinitionId = seedIdMap.get(seedId);
        if (!seedDefinitionId) {
          throw new BusinessError({
            code: ErrorCode.NotFound,
            message: `Seed definition not found: ${seedId}.`,
            statusCode: 404,
          });
        }

        await client.playerSeedInventory.upsert({
          where: {
            playerId_seedDefinitionId: {
              playerId,
              seedDefinitionId,
            },
          },
          create: {
            playerId,
            seedDefinitionId,
            quantity: seedGrant.quantity,
            unlockedAt: new Date(),
          },
          update: {
            quantity: { increment: seedGrant.quantity },
            unlockedAt: new Date(),
            inventoryVersion: { increment: 1 },
          },
        });
      }
    }

    return `已领取附件：${attachments.map((item) => `${item.label} x${item.quantity}`).join('、')}。`;
  }
}

function parseCategory(category: NotificationCategory | undefined): PrismaNotificationCategory {
  if (!category || category === 'system') {
    return 'SYSTEM';
  }

  if (category === 'announcement') {
    return 'ANNOUNCEMENT';
  }

  if (category === 'maintenance') {
    return 'MAINTENANCE';
  }

  if (category === 'reward') {
    return 'REWARD';
  }

  if (category === 'compensation') {
    return 'COMPENSATION';
  }

  throw new BusinessError({
    code: ErrorCode.BadRequest,
    message: 'Unsupported notification category.',
    statusCode: 400,
  });
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new BusinessError({
      code: ErrorCode.BadRequest,
      message: 'expiresAt must be a valid ISO datetime.',
      statusCode: 400,
    });
  }

  return parsed;
}

function parsePagination(query: PagingQuery): { page: number; pageSize: number; skip: number; take: number } {
  const page = Math.max(1, Number(query.page ?? '1') || 1);
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize ?? '20') || 20));
  const skip = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    skip,
    take: pageSize,
  };
}

function mapAdminCreateResponse(
  notification: { id: string; title: string; category: PrismaNotificationCategory; createdAt: Date; expiresAt: Date | null },
  audience: 'global' | 'player',
  playerCount: number,
  attachmentCount: number,
): AdminCreateNotificationResponse {
  return {
    notificationId: notification.id,
    audience,
    playerCount,
    title: notification.title,
    category: mapCategory(notification.category),
    attachmentCount,
    createdAt: notification.createdAt.toISOString(),
    expiresAt: notification.expiresAt?.toISOString() ?? null,
  };
}

function mapClientNotificationItem(notification: {
  id: string;
  titleSnapshot: string;
  bodySnapshot: string;
  category: PrismaNotificationCategory;
  claimStatus: PrismaPlayerNotificationClaimStatus;
  attachmentJson: Prisma.JsonValue | null;
  readAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  claimedAt: Date | null;
  expiresAt: Date | null;
}): ClientNotificationItem {
  const attachments = parseAttachments(notification.attachmentJson);
  const hasAttachment = attachments.length > 0;
  const effectiveClaimStatus = notification.claimStatus === 'UNCLAIMED' && notification.expiresAt && notification.expiresAt.getTime() <= Date.now()
    ? 'EXPIRED'
    : notification.claimStatus;

  return {
    id: notification.id,
    title: notification.titleSnapshot,
    body: notification.bodySnapshot,
    category: mapCategory(notification.category),
    claimStatus: mapClaimStatus(effectiveClaimStatus),
    read: notification.readAt !== null,
    deleted: notification.deletedAt !== null,
    hasAttachment,
    attachments,
    canClaim: effectiveClaimStatus === 'UNCLAIMED',
    canDelete: notification.readAt !== null && effectiveClaimStatus !== 'UNCLAIMED',
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null,
    claimedAt: notification.claimedAt?.toISOString() ?? null,
    expiresAt: notification.expiresAt?.toISOString() ?? null,
  };
}

function parseAttachments(value: Prisma.JsonValue | null): NotificationAttachment[] {
  if (!value || !Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }

    const candidate = item as Record<string, unknown>;
    const kind = typeof candidate.kind === 'string' ? candidate.kind : '';
    const label = typeof candidate.label === 'string' ? candidate.label : '';
    const quantity = typeof candidate.quantity === 'number' ? candidate.quantity : Number(candidate.quantity ?? 0);
    const seedId = typeof candidate.seedId === 'string' ? candidate.seedId : undefined;

    if (!isAttachmentKind(kind) || !label || !Number.isFinite(quantity) || quantity <= 0) {
      return [];
    }

    return [{
      kind,
      label,
      quantity,
      ...(seedId ? { seedId } : {}),
    } satisfies NotificationAttachment];
  });
}

function toAttachmentJson(attachments: NotificationAttachment[]): Prisma.InputJsonValue {
  return attachments.map((item) => ({
    kind: item.kind,
    quantity: item.quantity,
    label: item.label,
    ...(item.seedId ? { seedId: item.seedId } : {}),
  })) as Prisma.InputJsonValue;
}

function normalizeAttachmentInput(
  input: NonNullable<AdminCreateNotificationRequest['attachments']>[number],
  seedLabelMap: Map<string, string>,
): NotificationAttachment {
  const quantity = Math.floor(Number(input.quantity ?? 0));
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new BusinessError({
      code: ErrorCode.BadRequest,
      message: 'Attachment quantity must be greater than zero.',
      statusCode: 400,
    });
  }

  if (input.kind === 'gold') {
    return { kind: 'gold', quantity, label: '金币' };
  }

  if (input.kind === 'tianjiTalisman') {
    return { kind: 'tianjiTalisman', quantity, label: '天机符' };
  }

  if (input.kind === 'spiritSoul') {
    return { kind: 'spiritSoul', quantity, label: '兽魂' };
  }

  if (input.kind === 'seed') {
    const seedId = input.seedId?.trim();
    const seedLabel = seedId ? seedLabelMap.get(seedId) : null;
    if (!seedId || !seedLabel) {
      throw new BusinessError({
        code: ErrorCode.BadRequest,
        message: 'Seed attachment requires a valid seedId.',
        statusCode: 400,
      });
    }

    return { kind: 'seed', quantity, seedId, label: seedLabel };
  }

  throw new BusinessError({
    code: ErrorCode.BadRequest,
    message: 'Unsupported attachment kind.',
    statusCode: 400,
  });
}

function isAttachmentKind(value: string): value is NotificationAttachmentKind {
  return value === 'gold' || value === 'seed' || value === 'tianjiTalisman' || value === 'spiritSoul';
}

function mapCategory(category: PrismaNotificationCategory): NotificationCategory {
  if (category === 'ANNOUNCEMENT') {
    return 'announcement';
  }

  if (category === 'MAINTENANCE') {
    return 'maintenance';
  }

  if (category === 'REWARD') {
    return 'reward';
  }

  if (category === 'COMPENSATION') {
    return 'compensation';
  }

  return 'system';
}

function mapClaimStatus(status: PrismaPlayerNotificationClaimStatus): PlayerNotificationClaimStatus {
  if (status === 'UNCLAIMED') {
    return 'unclaimed';
  }

  if (status === 'CLAIMED') {
    return 'claimed';
  }

  if (status === 'EXPIRED') {
    return 'expired';
  }

  return 'none';
}