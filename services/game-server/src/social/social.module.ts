import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClientReadModule } from '../client-read/client-read.module.js';
import { SeasonModule } from '../season/season.module.js';
import { SocialController } from './social.controller.js';
import { SocialService } from './social.service.js';

@Module({
  imports: [AuthModule, ClientReadModule, SeasonModule],
  controllers: [SocialController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
