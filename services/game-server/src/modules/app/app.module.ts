import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { ClientReadModule } from '../../client-read/client-read.module.js';
import { CommonModule } from '../../common/common.module.js';
import { ConfigModule } from '../../config/config.module.js';
import { LoggingModule } from '../../logging/logging.module.js';
import { PlayerModule } from '../../player/player.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { SystemModule } from '../system/system.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    CommonModule,
    PrismaModule,
    AuthModule,
    PlayerModule,
    ClientReadModule,
    SystemModule,
  ],
})
export class AppModule {}
