import { NestFactory } from '@nestjs/core';
import { AuthService } from '../auth/auth.service.js';
import { BusinessError } from '../common/errors/index.js';
import { AppModule } from '../modules/app/app.module.js';
import { NotificationService } from '../notification/notification.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const GOLD_GRANT = 123;
const TALISMAN_GRANT = 2;
const ORDINARY_SOUL_GRANT = 3;
const SHARD_GRANT = 4;
const SHARD_SPIRIT_ID = 'canglang';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const notificationService = app.get(NotificationService);
    const prisma = app.get(PrismaService).db;
    const suffix = Date.now().toString();

    const userA = await authService.devLogin({
      providerUserId: `verify-notification-a-${suffix}`,
      nickname: `notify-a-${suffix}`,
      factionCode: 'human',
    });
    const userB = await authService.devLogin({
      providerUserId: `verify-notification-b-${suffix}`,
      nickname: `notify-b-${suffix}`,
      factionCode: 'demon',
    });

    const playerAId = userA.player.id;
    const playerBId = userB.player.id;
    const unreadABefore = (await notificationService.getUnreadCount(playerAId)).unreadCount;
    const unreadBBefore = (await notificationService.getUnreadCount(playerBId)).unreadCount;
    const resourcesBefore = await readPlayerResources(prisma, playerAId, SHARD_SPIRIT_ID);

    const globalTitle = `verify-global-${suffix}`;
    const globalResponse = await notificationService.createGlobalNotification({
      title: globalTitle,
      body: 'Notification verification global notice.',
      category: 'announcement',
    });
    assertEqual(globalResponse.audience, 'global', 'global response audience');
    assertAtLeast(globalResponse.playerCount, 2, 'global recipient count');
    assertEqual(globalResponse.attachmentCount, 0, 'global attachment count');

    const playerTitle = `verify-player-${suffix}`;
    const playerResponse = await notificationService.createPlayerNotification(playerAId, {
      title: playerTitle,
      body: 'Notification verification attachment notice.',
      category: 'compensation',
      attachments: [
        { kind: 'gold', quantity: GOLD_GRANT },
        { kind: 'tianjiTalisman', quantity: TALISMAN_GRANT },
        { kind: 'ordinarySoul', quantity: ORDINARY_SOUL_GRANT },
        { kind: 'spiritShard', quantity: SHARD_GRANT, spiritId: SHARD_SPIRIT_ID },
      ],
    });
    assertEqual(playerResponse.audience, 'player', 'player response audience');
    assertEqual(playerResponse.playerCount, 1, 'player recipient count');
    assertEqual(playerResponse.attachmentCount, 4, 'player attachment count');

    const listA = await notificationService.listPlayerNotifications(playerAId, { page: '1', pageSize: '20' });
    const listB = await notificationService.listPlayerNotifications(playerBId, { page: '1', pageSize: '20' });
    const globalForA = findNotificationByTitle(listA.items, globalTitle);
    const globalForB = findNotificationByTitle(listB.items, globalTitle);
    const playerForA = findNotificationByTitle(listA.items, playerTitle);
    const playerForB = listB.items.find((item) => item.title === playerTitle);

    assert(globalForA, 'player A should see global notification');
    assert(globalForB, 'player B should see global notification');
    assert(playerForA, 'target player should see player notification');
    assert(!playerForB, 'non-target player should not see player notification');
    assertEqual(playerForA.claimStatus, 'unclaimed', 'attachment notification claim status before claim');
    assert(playerForA.canClaim, 'attachment notification should be claimable before claim');
    assertEqual(listA.unreadCount, unreadABefore + 2, 'player A unread count after creating notifications');
    assertEqual(listB.unreadCount, unreadBBefore + 1, 'player B unread count after creating notifications');

    const readGlobal = await notificationService.markPlayerNotificationAsRead(playerAId, globalForA.id);
    assert(readGlobal.read, 'mark read response should be read');
    assertEqual(readGlobal.unreadCount, unreadABefore + 1, 'player A unread count after mark read');
    const listAAfterRead = await notificationService.listPlayerNotifications(playerAId, { page: '1', pageSize: '20' });
    const globalForAAfterRead = findNotificationByTitle(listAAfterRead.items, globalTitle);
    assert(globalForAAfterRead?.read, 'global notification should be read');
    assert(globalForAAfterRead?.canDelete, 'read global notification without attachments should be deletable');

    await assertBusinessError(
      () => notificationService.claimPlayerNotification(playerBId, playerForA.id),
      404,
      'non-target player claim should be rejected as not found',
    );

    const claimResult = await notificationService.claimPlayerNotification(playerAId, playerForA.id);
    assertEqual(claimResult.claimStatus, 'claimed', 'claim response status');
    assertEqual(claimResult.unreadCount, unreadABefore, 'player A unread count after claim');
    const resourcesAfter = await readPlayerResources(prisma, playerAId, SHARD_SPIRIT_ID);
    assertEqual(resourcesAfter.vaultGold, resourcesBefore.vaultGold + GOLD_GRANT, 'vault gold after claim');
    assertEqual(resourcesAfter.tianjiTalisman, resourcesBefore.tianjiTalisman + TALISMAN_GRANT, 'tianji talisman after claim');
    assertEqual(resourcesAfter.ordinarySoul, resourcesBefore.ordinarySoul + ORDINARY_SOUL_GRANT, 'ordinary soul after claim');
    assertEqual(
      resourcesAfter.shardCount,
      Math.min(resourcesBefore.shardCount + SHARD_GRANT, resourcesBefore.shardUnlockRequired),
      'spirit shard count after claim',
    );

    await assertBusinessError(
      () => notificationService.claimPlayerNotification(playerAId, playerForA.id),
      409,
      'duplicate claim should be rejected',
    );

    const deleteResult = await notificationService.deletePlayerNotification(playerAId, playerForA.id);
    assert(deleteResult.deleted, 'delete response should be deleted');
    const listAAfterDelete = await notificationService.listPlayerNotifications(playerAId, { page: '1', pageSize: '20' });
    assert(!listAAfterDelete.items.some((item) => item.id === playerForA.id), 'deleted notification should disappear from client list');

    const history = await notificationService.listNotificationHistory({ page: '1', pageSize: '50' });
    assert(history.items.some((item) => item.notificationId === globalResponse.notificationId), 'admin history should include global notification');
    assert(history.items.some((item) => item.notificationId === playerResponse.notificationId), 'admin history should include player notification');
    const playerHistory = await notificationService.listAdminPlayerNotifications(playerAId, { page: '1', pageSize: '50' });
    const playerHistoryItem = playerHistory.items.find((item) => item.id === playerForA.id);
    assert(playerHistoryItem, 'admin player history should include deleted player notification');
    assertEqual(playerHistoryItem.claimStatus, 'claimed', 'admin player history claim status');
    assert(playerHistoryItem.deletedAt, 'admin player history should expose deletedAt');

    console.log(JSON.stringify({
      ok: true,
      players: {
        targetPlayerId: playerAId,
        nonTargetPlayerId: playerBId,
      },
      notifications: {
        globalNotificationId: globalResponse.notificationId,
        globalPlayerNotificationId: globalForA.id,
        playerNotificationId: playerResponse.notificationId,
        playerPlayerNotificationId: playerForA.id,
      },
      resourceDelta: {
        vaultGold: resourcesAfter.vaultGold - resourcesBefore.vaultGold,
        tianjiTalisman: resourcesAfter.tianjiTalisman - resourcesBefore.tianjiTalisman,
        ordinarySoul: resourcesAfter.ordinarySoul - resourcesBefore.ordinarySoul,
        spiritShard: resourcesAfter.shardCount - resourcesBefore.shardCount,
      },
      unread: {
        playerABefore: unreadABefore,
        playerAAfterClaim: claimResult.unreadCount,
        playerBBefore: unreadBBefore,
        playerBAfterCreate: listB.unreadCount,
      },
    }, null, 2));
  } finally {
    await app.close();
  }
}

type PrismaDb = PrismaService['db'];

async function readPlayerResources(
  prisma: PrismaDb,
  playerId: string,
  spiritId: string,
): Promise<{
  vaultGold: number;
  tianjiTalisman: number;
  ordinarySoul: number;
  shardCount: number;
  shardUnlockRequired: number;
}> {
  const [wallet, spiritResource, spiritDefinition] = await Promise.all([
    prisma.playerWallet.findUniqueOrThrow({
      where: { playerId },
      select: { vaultGold: true },
    }),
    prisma.playerSpiritResource.findUnique({
      where: { playerId },
      select: { tianjiTalisman: true, ordinarySoul: true },
    }),
    prisma.spiritDefinition.findUniqueOrThrow({
      where: { spiritId },
      select: { id: true, shardUnlockRequired: true },
    }),
  ]);
  const codex = await prisma.playerSpiritCodex.findUnique({
    where: {
      playerId_spiritDefinitionId: {
        playerId,
        spiritDefinitionId: spiritDefinition.id,
      },
    },
    select: { shardCount: true },
  });

  return {
    vaultGold: wallet.vaultGold,
    tianjiTalisman: spiritResource?.tianjiTalisman ?? 0,
    ordinarySoul: spiritResource?.ordinarySoul ?? 0,
    shardCount: codex?.shardCount ?? 0,
    shardUnlockRequired: spiritDefinition.shardUnlockRequired,
  };
}

function findNotificationByTitle<T extends { title: string }>(items: T[], title: string): T {
  const item = items.find((candidate) => candidate.title === title);
  assert(item, `notification should exist: ${title}`);
  return item;
}

async function assertBusinessError(
  action: () => Promise<unknown>,
  statusCode: number,
  label: string,
): Promise<void> {
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

function assertAtLeast(actual: number, minimum: number, message: string): void {
  if (actual < minimum) {
    throw new Error(`${message}: expected at least ${minimum}, got ${actual}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
