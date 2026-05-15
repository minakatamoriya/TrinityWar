import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClientReadController } from './client-read.controller.js';
import { ClientReadService } from './client-read.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ClientReadController],
  providers: [ClientReadService],
})
export class ClientReadModule {}
