import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TaskConfigService } from './task-config.service.js';

@Module({
  imports: [PrismaModule],
  providers: [TaskConfigService],
  exports: [TaskConfigService],
})
export class TaskConfigModule {}
