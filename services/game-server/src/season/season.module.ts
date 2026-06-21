import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SeasonGuardService } from './season-guard.service.js';
import { SeasonService } from './season.service.js';

@Module({
  imports: [PrismaModule],
  providers: [SeasonService, SeasonGuardService],
  exports: [SeasonService, SeasonGuardService],
})
export class SeasonModule {}
