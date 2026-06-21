import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ClientReadModule } from '../client-read/client-read.module.js';
import { IdempotencyModule } from '../idempotency/idempotency.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SeasonModule } from '../season/season.module.js';
import { TaskConfigModule } from '../task-config/task-config.module.js';
import { SpiritController } from './spirit.controller.js';
import { SpiritService } from './spirit.service.js';

@Module({
  imports: [AuthModule, PrismaModule, AuditModule, IdempotencyModule, ClientReadModule, SeasonModule, TaskConfigModule],
  controllers: [SpiritController],
  providers: [SpiritService],
  exports: [SpiritService],
})
export class SpiritModule {}
