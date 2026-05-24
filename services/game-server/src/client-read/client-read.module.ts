import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LandDeedModule } from '../land-deed/land-deed.module.js';
import { ClientReadController } from './client-read.controller.js';
import { ArmyTrainingLifecycleService } from './army-training-lifecycle.service.js';
import { ClientReadRepository } from './client-read.repository.js';
import { ClientReadService } from './client-read.service.js';
import { DailyTaskLifecycleService } from './daily-task-lifecycle.service.js';
import { FieldLifecycleService } from './field-lifecycle.service.js';
import { HomeSummaryAssembler } from './home-summary.assembler.js';
import { PassiveIncomeLifecycleService } from './passive-income-lifecycle.service.js';
import { SceneContentAssembler } from './scene-content.assembler.js';

@Module({
  imports: [AuthModule, LandDeedModule],
  controllers: [ClientReadController],
  providers: [ClientReadService, ClientReadRepository, HomeSummaryAssembler, SceneContentAssembler, FieldLifecycleService, ArmyTrainingLifecycleService, PassiveIncomeLifecycleService, DailyTaskLifecycleService],
  exports: [ClientReadService, FieldLifecycleService, ArmyTrainingLifecycleService, PassiveIncomeLifecycleService, DailyTaskLifecycleService],
})
export class ClientReadModule {}
