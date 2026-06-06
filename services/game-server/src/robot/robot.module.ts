import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClientCommandModule } from '../client-command/client-command.module.js';
import { ClientReadModule } from '../client-read/client-read.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RaidModule } from '../raid/raid.module.js';
import { SpiritModule } from '../spirit/spirit.module.js';
import { RobotService } from './robot.service.js';

@Module({
  imports: [AuthModule, ClientCommandModule, ClientReadModule, PrismaModule, RaidModule, SpiritModule],
  providers: [RobotService],
  exports: [RobotService],
})
export class RobotModule {}
