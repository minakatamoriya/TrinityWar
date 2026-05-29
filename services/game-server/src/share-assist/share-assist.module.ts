import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ShareAssistController } from './share-assist.controller.js';
import { ShareAssistService } from './share-assist.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ShareAssistController],
  providers: [ShareAssistService],
})
export class ShareAssistModule {}
