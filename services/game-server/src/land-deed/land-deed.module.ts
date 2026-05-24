import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { LandDeedService } from './land-deed.service.js';

@Module({
  imports: [PrismaModule],
  providers: [LandDeedService],
  exports: [LandDeedService],
})
export class LandDeedModule {}
