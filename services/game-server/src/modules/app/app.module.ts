import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { AuditModule } from '../../audit/audit.module.js';
import { ClientCommandModule } from '../../client-command/client-command.module.js';
import { ClientReadModule } from '../../client-read/client-read.module.js';
import { CommonModule } from '../../common/common.module.js';
import { ConfigModule } from '../../config/config.module.js';
import { IdempotencyModule } from '../../idempotency/idempotency.module.js';
import { LoggingModule } from '../../logging/logging.module.js';
import { PlayerModule } from '../../player/player.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { SystemModule } from '../system/system.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    CommonModule,
    PrismaModule,
    AuthModule,
    AuditModule,
    PlayerModule,
    IdempotencyModule,
    ClientReadModule,
    ClientCommandModule,
    SystemModule,
  ],
})
export class AppModule {}
