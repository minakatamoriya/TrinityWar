import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module.js';
import { PinoLoggerService } from './pino-logger.service.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PinoLoggerService],
  exports: [PinoLoggerService],
})
export class LoggingModule {}
