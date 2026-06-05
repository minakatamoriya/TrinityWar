import { NestFactory } from '@nestjs/core';
import { AdminReadonlyService } from '../admin-readonly/admin-readonly.service.js';
import { AuthService } from '../auth/auth.service.js';
import { BusinessError } from '../common/errors/index.js';
import { AppModule } from '../modules/app/app.module.js';
import { NotificationService } from '../notification/notification.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const ATTACHMENT_NOTIFICATION_CONFIRM_TEXT = 'SEND_ATTACHMENT_NOTIFICATION';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const adminService = app.get(AdminReadonlyService);
    const notificationService = app.get(NotificationService);
    const prisma = app.get(PrismaService).db;
    const suffix = Date.now().toString();

    const login = await authService.devLogin({
      providerUserId: `verify-admin-dangerous-${suffix}`,
      nickname: `admin-danger-${suffix}`,
      factionCode: 'human',
    });
    const playerId = login.player.id;

    await assertBusinessError(
      () => notificationService.createPlayerNotification(playerId, {
        title: `verify-audit-reject-${suffix}`,
        body: 'Attachment notification without admin confirmation should be rejected.',
        category: 'compensation',
        attachments: [{ kind: 'gold', quantity: 1 }],
      }),
      400,
      'attachment notification without confirmation',
    );

    const notification = await notificationService.createPlayerNotification(playerId, {
      title: `verify-audit-${suffix}`,
      body: 'Attachment notification with admin confirmation should be audited.',
      category: 'compensation',
      attachments: [{ kind: 'gold', quantity: 1 }],
      reason: 'Verify player attachment notification audit.',
      confirmText: ATTACHMENT_NOTIFICATION_CONFIRM_TEXT,
    });

    const notificationAudit = await prisma.adminOperationAuditLog.findFirst({
      where: {
        action: 'create-player-notification-with-attachments',
        targetId: notification.notificationId,
      },
    });
    assert(notificationAudit, 'attachment notification audit log should be created');
    assertEqual(notificationAudit.reason, 'Verify player attachment notification audit.', 'notification audit reason');
    assertEqual(notificationAudit.confirmText, ATTACHMENT_NOTIFICATION_CONFIRM_TEXT, 'notification audit confirm text');

    await assertBusinessError(
      () => adminService.deletePlayer(playerId, {
        reason: 'Verify wrong player delete confirmation.',
        confirmText: 'wrong-player-id',
      }),
      400,
      'delete player with wrong confirmation',
    );

    const deleteResult = await adminService.deletePlayer(playerId, {
      reason: 'Verify player deletion audit.',
      confirmText: playerId,
    });
    assert(deleteResult.deleted, 'delete player should succeed with exact confirmation');

    const playerAudit = await prisma.adminOperationAuditLog.findFirst({
      where: {
        action: 'delete-player',
        targetId: playerId,
      },
    });
    assert(playerAudit, 'player delete audit log should be created');
    assertEqual(playerAudit.reason, 'Verify player deletion audit.', 'player audit reason');
    assertEqual(playerAudit.confirmText, playerId, 'player audit confirm text');

    await assertBusinessError(
      () => adminService.deleteSeedDefinition(`missing-seed-${suffix}`, {
        reason: 'Verify seed delete confirmation.',
        confirmText: 'wrong-seed-id',
      }),
      400,
      'delete seed with wrong confirmation',
    );
    await assertBusinessError(
      () => adminService.deleteSpiritDefinition(`missing-spirit-${suffix}`, {
        reason: 'Verify spirit delete confirmation.',
        confirmText: 'wrong-spirit-id',
      }),
      400,
      'delete spirit with wrong confirmation',
    );

    console.log(JSON.stringify({
      ok: true,
      playerId,
      notificationId: notification.notificationId,
      auditedActions: [
        notificationAudit.action,
        playerAudit.action,
      ],
    }, null, 2));
  } finally {
    await app.close();
  }
}

async function assertBusinessError(action: () => Promise<unknown>, statusCode: number, label: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    assert(error instanceof BusinessError, `${label}: should throw BusinessError`);
    assertEqual(error.statusCode, statusCode, `${label}: status code`);
    return;
  }

  throw new Error(`${label}: expected error`);
}

function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
