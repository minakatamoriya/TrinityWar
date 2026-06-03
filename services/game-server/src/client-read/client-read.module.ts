import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SeasonModule } from '../season/season.module.js';
import { TaskConfigModule } from '../task-config/task-config.module.js';
import { ClientReadController } from './client-read.controller.js';
import { ArmyTrainingLifecycleService } from './army-training-lifecycle.service.js';
import { ClientReadRepository } from './client-read.repository.js';
import { ClientReadService } from './client-read.service.js';
import { DailyTaskLifecycleService } from './daily-task-lifecycle.service.js';
import { DailyFactionTaskLifecycleService } from './daily-faction-task-lifecycle.service.js';
import { FieldLifecycleService } from './field-lifecycle.service.js';
import { HomeSummaryAssembler } from './home-summary.assembler.js';
import { PassiveIncomeLifecycleService } from './passive-income-lifecycle.service.js';
import { SceneContentAssembler } from './scene-content.assembler.js';

@Module({
  imports: [AuthModule, SeasonModule, TaskConfigModule],
  controllers: [ClientReadController],
  providers: [ClientReadService, ClientReadRepository, HomeSummaryAssembler, SceneContentAssembler, FieldLifecycleService, ArmyTrainingLifecycleService, PassiveIncomeLifecycleService, DailyTaskLifecycleService, DailyFactionTaskLifecycleService],
  exports: [ClientReadService, FieldLifecycleService, ArmyTrainingLifecycleService, PassiveIncomeLifecycleService, DailyTaskLifecycleService, DailyFactionTaskLifecycleService],
})
export class ClientReadModule {}
