import { NestFactory } from '@nestjs/core';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { AuthService } from '../auth/auth.service.js';
import { AppConfigService } from '../config/app-config.service.js';
import { AppModule } from '../modules/app/app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RAID_SETTLEMENT_QUEUE_NAME } from '../raid/raid-settlement-queue.service.js';
import { RaidSettlementService } from '../raid/raid-settlement.service.js';
import { RaidTargetService } from '../raid/raid-target.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const redisConnections: Redis[] = [];
  let queue: Queue<{ raidOrderId: string }> | null = null;
  let worker: Worker<{ raidOrderId: string }> | null = null;

  try {
    const authService = app.get(AuthService);
    const config = app.get(AppConfigService);
    const prisma = app.get(PrismaService).db;
    const raidTargetService = app.get(RaidTargetService);
    const raidSettlementService = app.get(RaidSettlementService);

    const pingConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
    redisConnections.push(pingConnection);
    const ping = await pingConnection.ping();
    assertEqual(ping, 'PONG', 'redis ping');

    const user1 = await authService.devLogin({
      providerUserId: 'dev-verifier-1',
      nickname: 'smoke-user-1',
      factionCode: 'human',
    });
    await authService.devLogin({
      providerUserId: 'dev-verifier-2',
      nickname: 'smoke-user-2',
      factionCode: 'demon',
    });

    const target = await prisma.raidTargetPool.findFirstOrThrow({
      where: {
        ownerPlayerId: user1.player.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, targetPlayerId: true },
    });
    const army = await prisma.playerArmy.findUniqueOrThrow({
      where: { playerId: user1.player.id },
      select: { armyVersion: true },
    });

    const queueConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
    redisConnections.push(queueConnection);
    queue = new Queue<{ raidOrderId: string }>(RAID_SETTLEMENT_QUEUE_NAME, {
      connection: queueConnection,
    });

    const requestIdempotencyKey = `verify-raid-worker-${Date.now()}`;
    const raidResponse = await raidTargetService.createRaidOrder({
      playerId: user1.player.id,
      targetId: target.id,
      armyVersion: army.armyVersion,
      requestIdempotencyKey,
    });
    const orderId = raidResponse.result.orderId;
    assert(orderId, 'raid order id should be returned');

    const queuedJob = await queue.getJob(orderId);
    assert(queuedJob, 'raid settlement job should be enqueued with order id as job id');
    assertEqual(queuedJob.data.raidOrderId, orderId, 'queued raid order id');

    const workerConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
    redisConnections.push(workerConnection);
    worker = new Worker<{ raidOrderId: string }>(
      RAID_SETTLEMENT_QUEUE_NAME,
      async (job) => {
        await raidSettlementService.settleRaidOrder(job.data.raidOrderId);
        return { raidOrderId: job.data.raidOrderId };
      },
      { connection: workerConnection },
    );

    await waitForJobCompleted(queue, orderId);

    const orderAfterWorker = await prisma.raidOrder.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true, settlement: { select: { id: true } } },
    });
    assertEqual(orderAfterWorker.status, 'SETTLED', 'raid order status after worker');
    assert(orderAfterWorker.settlement, 'raid settlement should exist after worker');

    const sweepResult = await raidSettlementService.settleDueRaidOrders({ take: 50 });
    assertAtLeast(sweepResult.settled, 0, 'sweep settled count');
    assertAtLeast(sweepResult.failed, 0, 'sweep failed count');

    console.log(JSON.stringify({
      ok: true,
      redisUrl: config.redisUrl,
      queueName: RAID_SETTLEMENT_QUEUE_NAME,
      orderId,
      targetPlayerId: target.targetPlayerId,
      jobState: await (await queue.getJob(orderId))?.getState(),
      sweepResult,
    }, null, 2));
  } finally {
    await worker?.close();
    await queue?.close();
    await Promise.all(redisConnections.map((connection) => connection.quit().catch(() => undefined)));
    await app.close();
  }
}

async function waitForJobCompleted(
  queue: Queue<{ raidOrderId: string }>,
  orderId: string,
  timeoutMs = 15000,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const job = await queue.getJob(orderId);
    const state = await job?.getState();

    if (state === 'completed') {
      return;
    }
    if (state === 'failed') {
      throw new Error(`Raid settlement job ${orderId} failed.`);
    }

    await sleep(250);
  }

  const job = await queue.getJob(orderId);
  const state = await job?.getState();
  throw new Error(`Timed out waiting for raid settlement job ${orderId}; last state: ${state ?? 'missing'}.`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}.`);
  }
}

function assertAtLeast(actual: number, minimum: number, label: string): void {
  if (!Number.isFinite(actual) || actual < minimum) {
    throw new Error(`${label}: expected at least ${minimum}, got ${String(actual)}.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
