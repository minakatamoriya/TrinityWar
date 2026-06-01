import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ClientReadModule } from '../client-read/client-read.module.js';
import { IdempotencyModule } from '../idempotency/idempotency.module.js';
import { LandDeedModule } from '../land-deed/land-deed.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SeasonModule } from '../season/season.module.js';
import { PlayerInitializationService } from '../seed/player-initialization.service.js';
import { TaskConfigModule } from '../task-config/task-config.module.js';
import { BuildingUpgradeRuleService } from './building-upgrade-rule.service.js';
import { ClientCommandController } from './client-command.controller.js';
import { ClientCommandService } from './client-command.service.js';
import { FieldCommandRuleService } from './field-command-rule.service.js';

@Module({
  imports: [AuthModule, PrismaModule, AuditModule, IdempotencyModule, ClientReadModule, LandDeedModule, SeasonModule, TaskConfigModule],
  controllers: [ClientCommandController],
  providers: [ClientCommandService, BuildingUpgradeRuleService, FieldCommandRuleService, PlayerInitializationService],
})
export class ClientCommandModule {}
