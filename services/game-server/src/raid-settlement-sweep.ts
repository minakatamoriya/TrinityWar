import './config/load-env.js';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { PinoLoggerService } from './logging/pino-logger.service.js';
import { AppModule } from './modules/app/app.module.js';
import { RaidSettlementService } from './raid/raid-settlement.service.js';

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  const logger = app.get(PinoLoggerService);
  const raidSettlementService = app.get(RaidSettlementService);

  app.useLogger(logger);

  const result = await raidSettlementService.settleDueRaidOrders({ take: 50 });
  logger.info(result, 'raid settlement sweep completed');
  await app.close();
};

bootstrap().catch((error: unknown) => {
  console.error('raid settlement sweep failed', error);
  process.exit(1);
});
