import { Module } from '@nestjs/common';
import { AdminReadonlyGuard } from '../admin-readonly/admin-readonly.guard.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationAdminController } from './notification.admin.controller.js';
import { NotificationClientController } from './notification.client.controller.js';
import { NotificationService } from './notification.service.js';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [NotificationClientController, NotificationAdminController],
  providers: [NotificationService, AdminReadonlyGuard],
  exports: [NotificationService],
})
export class NotificationModule {}