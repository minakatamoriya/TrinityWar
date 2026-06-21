import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ClientReadModule } from '../client-read/client-read.module.js';
import { ConfigModule } from '../config/config.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SeasonModule } from '../season/season.module.js';
import { RaidController } from './raid.controller.js';
import { RaidSettlementQueueService } from './raid-settlement-queue.service.js';
import { RaidSettlementRuleService } from './raid-settlement-rule.service.js';
import { RaidSettlementService } from './raid-settlement.service.js';
import { RaidTargetService } from './raid-target.service.js';
import { RaidRepository } from './raid.repository.js';

@Module({
  imports: [AuditModule, AuthModule, ConfigModule, PrismaModule, ClientReadModule, SeasonModule],
  controllers: [RaidController],
  providers: [RaidRepository, RaidTargetService, RaidSettlementQueueService, RaidSettlementRuleService, RaidSettlementService],
  exports: [RaidRepository, RaidTargetService, RaidSettlementQueueService, RaidSettlementRuleService, RaidSettlementService],
})
export class RaidModule {}
