import { NestFactory } from '@nestjs/core';
import { AdminReadonlyService } from '../admin-readonly/admin-readonly.service.js';
import { AuthService } from '../auth/auth.service.js';
import { BusinessError } from '../common/errors/index.js';
import { AppModule } from '../modules/app/app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const adminService = app.get(AdminReadonlyService);
    const prisma = app.get(PrismaService).db;
    const suffix = Date.now().toString();

    const login = await authService.devLogin({
      providerUserId: `verify-admin-adjust-${suffix}`,
      nickname: `admin-adjust-${suffix}`,
      factionCode: 'human',
    });
    const playerId = login.player.id;

    const before = await readState(prisma, playerId);
    await assertBusinessError(
      () => adminService.adjustPlayerResources(playerId, {
        reason: '',
        goldDelta: 1,
      }),
      400,
      'empty reason should be rejected',
    );
    await assertBusinessError(
      () => adminService.adjustPlayerResources(playerId, {
        reason: 'Verify negative guard.',
        goldDelta: -(before.gold + 1),
      }),
      400,
      'negative gold result should be rejected',
    );

    const result = await adminService.adjustPlayerResources(playerId, {
      reason: '补偿',
      goldDelta: 321,
      tianjiTalismanDelta: 4,
      spiritSoulDelta: 5,
      ordinarySoulDelta: 6,
      rareSoulDelta: 7,
      legendarySoulDelta: 8,
      contributionDelta: 9,
    });
    assert(result.adjusted, 'adjust response should be adjusted');
    assertEqual(result.changes.length, 7, 'change count');

    const after = await readState(prisma, playerId);
    assertEqual(after.gold, before.gold + 321, 'gold after adjustment');
    assertEqual(after.tianjiTalisman, before.tianjiTalisman + 4, 'tianji talisman after adjustment');
    assertEqual(after.spiritSoul, before.spiritSoul + 5, 'spirit soul after adjustment');
    assertEqual(after.ordinarySoul, before.ordinarySoul + 6, 'ordinary soul after adjustment');
    assertEqual(after.rareSoul, before.rareSoul + 7, 'rare soul after adjustment');
    assertEqual(after.legendarySoul, before.legendarySoul + 8, 'legendary soul after adjustment');
    assertEqual(after.contributionScore, before.contributionScore + 9, 'contribution after adjustment');

    const [walletLog, contributionLog, auditLog] = await Promise.all([
      prisma.walletChangeLog.findFirst({
        where: { playerId, changeType: 'admin-resource-adjust', deltaGold: 321 },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.factionContributionLog.findFirst({
        where: { playerId, sourceType: 'admin-resource-adjust', contributionDelta: 9 },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.adminOperationAuditLog.findUnique({ where: { id: result.auditLogId } }),
    ]);

    assert(walletLog, 'wallet change log should be created');
    assert(contributionLog, 'faction contribution log should be created');
    assert(auditLog, 'admin audit log should be created');
    assertEqual(auditLog.action, 'adjust-player-resources', 'audit action');
    assertEqual(auditLog.targetId, playerId, 'audit target id');
    assertEqual(auditLog.reason, '补偿', 'audit reason');

    const auditList = await adminService.listAuditLogs({
      targetId: playerId,
      action: 'adjust-player-resources',
      page: '1',
      pageSize: '10',
    });
    assert(auditList.items.some((item) => item.id === result.auditLogId), 'admin audit list should include resource adjustment');

    console.log(JSON.stringify({
      ok: true,
      playerId,
      auditLogId: result.auditLogId,
      changes: result.changes,
    }, null, 2));
  } finally {
    await app.close();
  }
}

type PrismaDb = PrismaService['db'];

async function readState(prisma: PrismaDb, playerId: string): Promise<{
  gold: number;
  tianjiTalisman: number;
  spiritSoul: number;
  ordinarySoul: number;
  rareSoul: number;
  legendarySoul: number;
  contributionScore: number;
}> {
  const player = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    select: {
      wallet: { select: { vaultGold: true } },
      spiritResource: {
        select: {
          tianjiTalisman: true,
          spiritSoul: true,
          ordinarySoul: true,
          rareSoul: true,
          legendarySoul: true,
        },
      },
      factionMembers: {
        select: { contributionScore: true },
        take: 1,
      },
    },
  });

  return {
    gold: player.wallet?.vaultGold ?? 0,
    tianjiTalisman: player.spiritResource?.tianjiTalisman ?? 0,
    spiritSoul: player.spiritResource?.spiritSoul ?? 0,
    ordinarySoul: player.spiritResource?.ordinarySoul ?? 0,
    rareSoul: player.spiritResource?.rareSoul ?? 0,
    legendarySoul: player.spiritResource?.legendarySoul ?? 0,
    contributionScore: player.factionMembers[0]?.contributionScore ?? 0,
  };
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
