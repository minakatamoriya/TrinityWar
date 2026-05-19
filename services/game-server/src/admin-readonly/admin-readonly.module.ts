import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminReadonlyController } from './admin-readonly.controller.js';
import { AdminReadonlyGuard } from './admin-readonly.guard.js';
import { AdminReadonlyService } from './admin-readonly.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AdminReadonlyController],
  providers: [AdminReadonlyGuard, AdminReadonlyService],
})
export class AdminReadonlyModule {}
