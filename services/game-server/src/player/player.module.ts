import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SeasonModule } from '../season/season.module.js';
import { PlayerController } from './player.controller.js';
import { PlayerService } from './player.service.js';

@Module({
  imports: [AuthModule, SeasonModule],
  controllers: [PlayerController],
  providers: [PlayerService],
})
export class PlayerModule {}
