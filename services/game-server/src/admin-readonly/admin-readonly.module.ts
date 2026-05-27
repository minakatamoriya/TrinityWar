import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TaskConfigModule } from '../task-config/task-config.module.js';
import { AdminReadonlyController } from './admin-readonly.controller.js';
import { AdminReadonlyGuard } from './admin-readonly.guard.js';
import { AdminReadonlyService } from './admin-readonly.service.js';

@Module({
  imports: [PrismaModule, TaskConfigModule],
  controllers: [AdminReadonlyController],
  providers: [AdminReadonlyGuard, AdminReadonlyService],
})
export class AdminReadonlyModule {}
