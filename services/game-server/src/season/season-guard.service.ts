import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SeasonService } from './season.service.js';

type PrismaClientLike = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class SeasonGuardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SeasonService) private readonly seasonService: SeasonService,
  ) {}

  async ensureNoSeasonRolloverForAction(playerId: string): Promise<void> {
    const transition = await this.prisma.transaction(async (client) => {
      const result = await this.seasonService.ensurePlayerSeasonWithTransition(client, playerId);
      return result.transition;
    });

    if (!transition.resetApplied) {
      return;
    }

    throw this.buildSeasonRolledOverError(transition);
  }

  async ensureNoSeasonRolloverForMutation(client: PrismaClientLike, playerId: string): Promise<void> {
    const result = await this.seasonService.ensurePlayerSeasonWithTransition(client, playerId);
    if (!result.transition.resetApplied) {
      return;
    }

    throw this.buildSeasonRolledOverError(result.transition);
  }

  private buildSeasonRolledOverError(transition: Awaited<ReturnType<SeasonService['ensurePlayerSeasonWithTransition']>>['transition']): BusinessError {
    return new BusinessError({
      code: ErrorCode.SeasonRolledOver,
      message: '新赛季已经开始，请刷新后继续。',
      statusCode: 409,
      details: {
        seasonTransition: transition,
      },
    });
  }
}
