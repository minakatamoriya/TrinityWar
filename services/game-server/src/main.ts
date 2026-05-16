import './config/load-env.js';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX, APP_NAME, DOCS_ROUTE } from '@trinitywar/shared';
import { GlobalExceptionFilter } from './common/errors/global-exception.filter.js';
import { AppConfigService } from './config/app-config.service.js';
import { PinoLoggerService } from './logging/pino-logger.service.js';
import { AppModule } from './modules/app/app.module.js';

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(AppConfigService);
  const logger = app.get(PinoLoggerService);

  app.useLogger(logger);
  app.useGlobalFilters(app.get(GlobalExceptionFilter));

  app.enableCors();
  app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''));

  const swaggerConfig = new DocumentBuilder()
    .setTitle(`${APP_NAME} API`)
    .setDescription('TrinityWar formal game server API.')
    .setVersion('0.1.0')
    .addTag('system', 'System endpoints')
    .build();

  SwaggerModule.setup(DOCS_ROUTE.replace(/^\//, ''), app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(config.port, config.host);

  logger.info({ host: config.host, port: config.port }, 'game server started');
};

bootstrap().catch((error: unknown) => {
  // Logger providers may not be available if module creation fails.
  console.error('game server failed to start', error);
  process.exit(1);
});
