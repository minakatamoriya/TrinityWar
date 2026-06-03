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
    const normalizedTitle = (payload?.title?.trim() || (attachments.length > 0 ? 'System Reward' : 'System Notice')).trim();
    const normalizedBody = (payload?.body?.trim() || (attachments.length > 0 ? `Please claim attachments: ${attachments.map((item) => `${item.label} x${item.quantity}`).join(', ')}.` : 'Please check the latest system notice.')).trim();
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
      .flatMap((item) => {
        if (item.kind === 'seed' && typeof item.seedId === 'string' && item.seedId.trim().length > 0) {
          return [item.seedId.trim()];
        }
        if (item.kind === 'essence' && typeof item.essenceType === 'string' && item.essenceType.trim().length > 0) {
          return [item.essenceType.trim()];
        }
        return [];
      });
    const seedDefinitions = seedIds.length > 0
      ? await this.prisma.db.seedDefinition.findMany({
          where: { seedId: { in: Array.from(new Set(seedIds)) } },
          select: { seedId: true, label: true },
        })
      : [];
    const seedLabelMap = new Map(seedDefinitions.map((item) => [item.seedId, item.label]));
    const spiritIds = input
      .flatMap((item) => item.kind === 'spiritShard' && typeof item.spiritId === 'string' && item.spiritId.trim().length > 0 ? [item.spiritId.trim()] : []);
    const spiritDefinitions = spiritIds.length > 0
      ? await this.prisma.db.spiritDefinition.findMany({
          where: { spiritId: { in: Array.from(new Set(spiritIds)) } },
          select: { spiritId: true, shardName: true },
        })
      : [];
    const spiritShardLabelMap = new Map(spiritDefinitions.map((item) => [item.spiritId, item.shardName]));

    return input.map((item) => normalizeAttachmentInput(item, seedLabelMap, spiritShardLabelMap));
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
    const ordinarySoulGrant = attachments.filter((item) => item.kind === 'ordinarySoul').reduce((sum, item) => sum + item.quantity, 0);
    const rareSoulGrant = attachments.filter((item) => item.kind === 'rareSoul').reduce((sum, item) => sum + item.quantity, 0);
    const legendarySoulGrant = attachments.filter((item) => item.kind === 'legendarySoul').reduce((sum, item) => sum + item.quantity, 0);
    const talismanGrant = attachments.filter((item) => item.kind === 'tianjiTalisman').reduce((sum, item) => sum + item.quantity, 0);
    const seedGrants = attachments.filter((item) => item.kind === 'seed');
    const essenceGrants = attachments.filter((item) => item.kind === 'essence');
    const spiritShardGrants = attachments.filter((item) => item.kind === 'spiritShard');

    if (goldGrant > 0) {
      const wallet = await client.playerWallet.findUnique({
        where: { playerId },
        select: { vaultGold: true },
      });

      if (!wallet) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Player wallet state not found.',
          statusCode: 404,
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

    if (spiritSoulGrant > 0 || ordinarySoulGrant > 0 || rareSoulGrant > 0 || legendarySoulGrant > 0 || talismanGrant > 0) {
      await client.playerSpiritResource.upsert({
        where: { playerId },
        create: {
          playerId,
          spiritSoul: spiritSoulGrant,
          ordinarySoul: ordinarySoulGrant,
          rareSoul: rareSoulGrant,
          legendarySoul: legendarySoulGrant,
          tianjiTalisman: talismanGrant,
        },
        update: {
          spiritSoul: spiritSoulGrant > 0 ? { increment: spiritSoulGrant } : undefined,
          ordinarySoul: ordinarySoulGrant > 0 ? { increment: ordinarySoulGrant } : undefined,
          rareSoul: rareSoulGrant > 0 ? { increment: rareSoulGrant } : undefined,
          legendarySoul: legendarySoulGrant > 0 ? { increment: legendarySoulGrant } : undefined,
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

    if (essenceGrants.length > 0) {
      const seedDefinitions = await client.seedDefinition.findMany({
        where: { seedId: { in: essenceGrants.map((item) => item.essenceType ?? '') } },
        select: { id: true, seedId: true },
      });
      const seedIdMap = new Map(seedDefinitions.map((item) => [item.seedId, item.id]));

      for (const essenceGrant of essenceGrants) {
        const essenceType = essenceGrant.essenceType ?? '';
        const seedDefinitionId = seedIdMap.get(essenceType);
        if (!seedDefinitionId) {
          throw new BusinessError({
            code: ErrorCode.NotFound,
            message: `Seed definition not found: ${essenceType}.`,
            statusCode: 404,
          });
        }

        const inventory = await client.playerSeedInventory.upsert({
          where: {
            playerId_seedDefinitionId: {
              playerId,
              seedDefinitionId,
            },
          },
          create: {
            playerId,
            seedDefinitionId,
            quantity: essenceGrant.quantity,
          },
          update: {
            quantity: { increment: essenceGrant.quantity },
            inventoryVersion: { increment: 1 },
          },
          select: { quantity: true },
        });

        await client.playerPlantResearch.upsert({
          where: {
            playerId_seedDefinitionId: {
              playerId,
              seedDefinitionId,
            },
          },
          create: {
            playerId,
            seedDefinitionId,
          },
          update: {
            researchVersion: { increment: 1 },
          },
        });

        await client.essenceTransactionLog.create({
          data: {
            playerId,
            essenceType,
            delta: essenceGrant.quantity,
            reason: essenceGrant.sourceType === 'season-reward' ? 'season-reward' : 'notification-attachment-claim',
            sourceId: essenceGrant.sourceId ?? notificationId,
            balanceAfter: inventory.quantity,
          },
        });
      }
    }

    if (spiritShardGrants.length > 0) {
      const spiritDefinitions = await client.spiritDefinition.findMany({
        where: { spiritId: { in: spiritShardGrants.map((item) => item.spiritId ?? '') } },
        select: { id: true, spiritId: true, shardUnlockRequired: true },
      });
      const spiritDefinitionById = new Map(spiritDefinitions.map((item) => [item.spiritId, item]));

      for (const shardGrant of spiritShardGrants) {
        const spiritId = shardGrant.spiritId ?? '';
        const spiritDefinition = spiritDefinitionById.get(spiritId);
        if (!spiritDefinition) {
          throw new BusinessError({
            code: ErrorCode.NotFound,
            message: `Spirit definition not found: ${spiritId}.`,
            statusCode: 404,
          });
        }

        const existingCodex = await client.playerSpiritCodex.findUnique({
          where: {
            playerId_spiritDefinitionId: {
              playerId,
              spiritDefinitionId: spiritDefinition.id,
            },
          },
          select: { shardCount: true },
        });
        const nextShardCount = Math.min((existingCodex?.shardCount ?? 0) + shardGrant.quantity, spiritDefinition.shardUnlockRequired);

        await client.playerSpiritCodex.upsert({
          where: {
            playerId_spiritDefinitionId: {
              playerId,
              spiritDefinitionId: spiritDefinition.id,
            },
          },
          create: {
            playerId,
            spiritDefinitionId: spiritDefinition.id,
            hasSeen: true,
            shardCount: nextShardCount,
            readyToCompose: nextShardCount >= spiritDefinition.shardUnlockRequired,
            firstSeenAt: new Date(),
            readyAt: nextShardCount >= spiritDefinition.shardUnlockRequired ? new Date() : null,
          },
          update: {
            hasSeen: true,
            shardCount: nextShardCount,
            readyToCompose: nextShardCount >= spiritDefinition.shardUnlockRequired,
            readyAt: nextShardCount >= spiritDefinition.shardUnlockRequired ? new Date() : undefined,
            codexVersion: { increment: 1 },
          },
        });
      }
    }

    const seasonRewardGrantIds = attachments
      .filter((item) => item.sourceType === 'season-reward' && item.sourceId)
      .map((item) => item.sourceId as string);
    if (seasonRewardGrantIds.length > 0) {
      await client.playerSeasonRewardGrant.updateMany({
        where: {
          playerId,
          id: { in: Array.from(new Set(seasonRewardGrantIds)) },
          status: { in: ['generated', 'notified'] },
        },
        data: {
          status: 'claimed',
          claimedAt: new Date(),
        },
      });
    }

    return `已领取附件：${attachments.map((item) => `${item.name ?? item.label} x${item.quantity}`).join('，')}。`;
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
    const name = typeof candidate.name === 'string' ? candidate.name : undefined;
    const nameEn = typeof candidate.nameEn === 'string' ? candidate.nameEn : undefined;
    const quantity = typeof candidate.quantity === 'number' ? candidate.quantity : Number(candidate.quantity ?? 0);
    const seedId = typeof candidate.seedId === 'string' ? candidate.seedId : undefined;
    const essenceType = typeof candidate.essenceType === 'string' ? candidate.essenceType : undefined;
    const spiritId = typeof candidate.spiritId === 'string' ? candidate.spiritId : undefined;
    const medalKey = typeof candidate.medalKey === 'string' ? candidate.medalKey : undefined;
    const domain = typeof candidate.domain === 'string' ? candidate.domain : undefined;
    const sourceType = typeof candidate.sourceType === 'string' ? candidate.sourceType : undefined;
    const sourceId = typeof candidate.sourceId === 'string' ? candidate.sourceId : undefined;

    if (!isAttachmentKind(kind) || !label || !Number.isFinite(quantity) || quantity <= 0) {
      return [];
    }

    return [{
      kind,
      label,
      quantity,
      ...(name ? { name } : {}),
      ...(nameEn ? { nameEn } : {}),
      ...(seedId ? { seedId } : {}),
      ...(essenceType ? { essenceType } : {}),
      ...(spiritId ? { spiritId } : {}),
      ...(medalKey ? { medalKey } : {}),
      ...(domain ? { domain } : {}),
      ...(sourceType ? { sourceType } : {}),
      ...(sourceId ? { sourceId } : {}),
    } satisfies NotificationAttachment];
  });
}

function toAttachmentJson(attachments: NotificationAttachment[]): Prisma.InputJsonValue {
  return attachments.map((item) => ({
    kind: item.kind,
    quantity: item.quantity,
    label: item.label,
    ...(item.name ? { name: item.name } : {}),
    ...(item.nameEn ? { nameEn: item.nameEn } : {}),
    ...(item.seedId ? { seedId: item.seedId } : {}),
    ...(item.essenceType ? { essenceType: item.essenceType } : {}),
    ...(item.spiritId ? { spiritId: item.spiritId } : {}),
    ...(item.medalKey ? { medalKey: item.medalKey } : {}),
    ...(item.domain ? { domain: item.domain } : {}),
    ...(item.sourceType ? { sourceType: item.sourceType } : {}),
    ...(item.sourceId ? { sourceId: item.sourceId } : {}),
  })) as Prisma.InputJsonValue;
}

function normalizeAttachmentInput(
  input: NonNullable<AdminCreateNotificationRequest['attachments']>[number],
  seedLabelMap: Map<string, string>,
  spiritShardLabelMap: Map<string, string>,
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
    return { kind: 'gold', quantity, label: '金币', name: '金币', nameEn: 'Gold' };
  }

  if (input.kind === 'tianjiTalisman') {
    return { kind: 'tianjiTalisman', quantity, label: '天机符', name: '天机符', nameEn: 'Tianji Talisman' };
  }

  if (input.kind === 'spiritSoul') {
    return { kind: 'spiritSoul', quantity, label: '兽魂', name: '兽魂', nameEn: 'Spirit Soul' };
  }

  if (input.kind === 'ordinarySoul') {
    return { kind: 'ordinarySoul', quantity, label: '普通兽魂', name: '普通兽魂', nameEn: 'Ordinary Soul' };
  }

  if (input.kind === 'rareSoul') {
    return { kind: 'rareSoul', quantity, label: '稀有兽魂', name: '稀有兽魂', nameEn: 'Rare Soul' };
  }

  if (input.kind === 'legendarySoul') {
    return { kind: 'legendarySoul', quantity, label: '传说兽魂', name: '传说兽魂', nameEn: 'Legendary Soul' };
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

  if (input.kind === 'essence') {
    const essenceType = input.essenceType?.trim();
    const seedLabel = essenceType ? seedLabelMap.get(essenceType) : null;
    if (!essenceType || !seedLabel) {
      throw new BusinessError({
        code: ErrorCode.BadRequest,
        message: 'Essence attachment requires a valid essenceType.',
        statusCode: 400,
      });
    }

    return { kind: 'essence', quantity, essenceType, label: `${seedLabel}精华`, name: `${seedLabel}精华`, nameEn: `${seedLabel} Essence` };
  }

  if (input.kind === 'spiritShard') {
    const spiritId = input.spiritId?.trim();
    const shardLabel = spiritId ? spiritShardLabelMap.get(spiritId) : null;
    if (!spiritId || !shardLabel) {
      throw new BusinessError({
        code: ErrorCode.BadRequest,
        message: 'Spirit shard attachment requires a valid spiritId.',
        statusCode: 400,
      });
    }

    return { kind: 'spiritShard', quantity, spiritId, label: shardLabel, name: shardLabel };
  }

  if (input.kind === 'medal') {
    const medalKey = input.medalKey?.trim();
    const domain = input.domain?.trim();
    if (!medalKey) {
      throw new BusinessError({
        code: ErrorCode.BadRequest,
        message: 'Medal attachment requires a medalKey.',
        statusCode: 400,
      });
    }

    return {
      kind: 'medal',
      quantity,
      medalKey,
      label: medalKey,
      name: medalKey,
      ...(domain ? { domain } : {}),
    };
  }

  throw new BusinessError({
    code: ErrorCode.BadRequest,
    message: 'Unsupported attachment kind.',
    statusCode: 400,
  });
}

function isAttachmentKind(value: string): value is NotificationAttachmentKind {
  return value === 'gold'
    || value === 'seed'
    || value === 'essence'
    || value === 'tianjiTalisman'
    || value === 'spiritSoul'
    || value === 'ordinarySoul'
    || value === 'rareSoul'
    || value === 'legendarySoul'
    || value === 'spiritShard'
    || value === 'medal';
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
