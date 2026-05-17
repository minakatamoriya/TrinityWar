import './config/load-env.js';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { AppConfigService } from './config/app-config.service.js';
import { PinoLoggerService } from './logging/pino-logger.service.js';
import { AppModule } from './modules/app/app.module.js';
import { RAID_SETTLEMENT_QUEUE_NAME } from './raid/raid-settlement-queue.service.js';
import { RaidSettlementService } from './raid/raid-settlement.service.js';

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  const config = app.get(AppConfigService);
  const logger = app.get(PinoLoggerService);
  const raidSettlementService = app.get(RaidSettlementService);
  const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

  app.useLogger(logger);

  const initialSweep = await raidSettlementService.settleDueRaidOrders({ take: 50 });
  logger.info(initialSweep, 'raid settlement worker initial sweep completed');

  const worker = new Worker<{ raidOrderId: string }>(
    RAID_SETTLEMENT_QUEUE_NAME,
    async (job) => {
      await raidSettlementService.settleRaidOrder(job.data.raidOrderId);
      return { raidOrderId: job.data.raidOrderId };
    },
    { connection },
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, raidOrderId: job.data.raidOrderId }, 'raid settlement job completed');
  });

  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, raidOrderId: job?.data.raidOrderId, error }, 'raid settlement job failed');
  });

  const shutdown = async (): Promise<void> => {
    await worker.close();
    await connection.quit();
    await app.close();
  };

  process.on('SIGINT', () => {
    void shutdown().then(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    void shutdown().then(() => process.exit(0));
  });

  logger.info({ queueName: RAID_SETTLEMENT_QUEUE_NAME }, 'raid settlement worker started');
};

bootstrap().catch((error: unknown) => {
  console.error('raid settlement worker failed to start', error);
  process.exit(1);
});
