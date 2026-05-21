import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ClientReadModule } from '../client-read/client-read.module.js';
import { IdempotencyModule } from '../idempotency/idempotency.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PlayerInitializationService } from '../seed/player-initialization.service.js';
import { BuildingUpgradeRuleService } from './building-upgrade-rule.service.js';
import { ClientCommandController } from './client-command.controller.js';
import { ClientCommandService } from './client-command.service.js';
import { FieldCommandRuleService } from './field-command-rule.service.js';

@Module({
  imports: [AuthModule, PrismaModule, AuditModule, IdempotencyModule, ClientReadModule],
  controllers: [ClientCommandController],
  providers: [ClientCommandService, BuildingUpgradeRuleService, FieldCommandRuleService, PlayerInitializationService],
})
export class ClientCommandModule {}
