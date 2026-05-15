import { Global, Module } from '@nestjs/common';
import { LoggingModule } from '../logging/logging.module.js';
import { GlobalExceptionFilter } from './errors/global-exception.filter.js';

@Global()
@Module({
  imports: [LoggingModule],
  providers: [GlobalExceptionFilter],
  exports: [GlobalExceptionFilter],
})
export class CommonModule {}
