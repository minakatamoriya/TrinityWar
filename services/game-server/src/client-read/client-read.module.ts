import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClientReadController } from './client-read.controller.js';
import { ArmyTrainingLifecycleService } from './army-training-lifecycle.service.js';
import { ClientReadRepository } from './client-read.repository.js';
import { ClientReadService } from './client-read.service.js';
import { FieldLifecycleService } from './field-lifecycle.service.js';
import { HomeSummaryAssembler } from './home-summary.assembler.js';
import { SceneContentAssembler } from './scene-content.assembler.js';

@Module({
  imports: [AuthModule],
  controllers: [ClientReadController],
  providers: [ClientReadService, ClientReadRepository, HomeSummaryAssembler, SceneContentAssembler, FieldLifecycleService, ArmyTrainingLifecycleService],
  exports: [ClientReadService, FieldLifecycleService, ArmyTrainingLifecycleService],
})
export class ClientReadModule {}
