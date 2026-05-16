import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClientReadController } from './client-read.controller.js';
import { ClientReadRepository } from './client-read.repository.js';
import { ClientReadService } from './client-read.service.js';
import { HomeSummaryAssembler } from './home-summary.assembler.js';
import { SceneContentAssembler } from './scene-content.assembler.js';

@Module({
  imports: [AuthModule],
  controllers: [ClientReadController],
  providers: [ClientReadService, ClientReadRepository, HomeSummaryAssembler, SceneContentAssembler],
  exports: [ClientReadService],
})
export class ClientReadModule {}
