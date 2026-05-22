import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { getFactionDividendPerHour, getTaxIncomePerHour } from '../lib/game-balance.js';

const HOUR_MS = 60 * 60 * 1000;

@Injectable()
export class PassiveIncomeLifecycleService {
  async settlePlayerPassiveIncome(client: Prisma.TransactionClient, playerId: string, now: Date = new Date()): Promise<void> {
    const player = await client.player.findUnique({
      where: { id: playerId },
      select: {
        castleLevelCache: true,
        wallet: {
          select: {
            passiveSettledAt: true,
          },
        },
        buildings: {
          select: {
            castleLevel: true,
          },
        },
        factionMembers: {
          take: 1,
          select: {
            contributionScore: true,
          },
        },
      },
    });

    if (!player?.wallet) {
      return;
    }

    const lastSettledAt = player.wallet.passiveSettledAt ?? now;
    const elapsedHours = Math.floor((now.getTime() - lastSettledAt.getTime()) / HOUR_MS);

    if (elapsedHours <= 0) {
      if (!player.wallet.passiveSettledAt) {
        await client.playerWallet.update({
          where: { playerId },
          data: { passiveSettledAt: now },
        });
      }
      return;
    }

    const castleLevel = player.buildings?.castleLevel ?? player.castleLevelCache;
    const contributionScore = player.factionMembers[0]?.contributionScore ?? 0;
    const taxGold = getTaxIncomePerHour(castleLevel) * elapsedHours;
    const dividendGold = getFactionDividendPerHour(contributionScore).total * elapsedHours;
    const nextSettledAt = new Date(lastSettledAt.getTime() + elapsedHours * HOUR_MS);

    await client.playerWallet.update({
      where: { playerId },
      data: {
        pendingTaxGold: { increment: taxGold },
        pendingDividendGold: { increment: dividendGold },
        passiveSettledAt: nextSettledAt,
        balanceVersion: { increment: 1 },
      },
    });
  }
}
