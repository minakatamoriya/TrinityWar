import { Module } from '@nestjs/common';
import { SeasonService } from './season.service.js';

@Module({
  providers: [SeasonService],
  exports: [SeasonService],
})
export class SeasonModule {}
