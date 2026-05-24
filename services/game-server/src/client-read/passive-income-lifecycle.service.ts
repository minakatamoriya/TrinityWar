import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

@Injectable()
export class PassiveIncomeLifecycleService {
  async settlePlayerPassiveIncome(client: Prisma.TransactionClient, playerId: string, now: Date = new Date()): Promise<void> {
    const wallet = await client.playerWallet.findUnique({
      where: { playerId },
      select: { passiveSettledAt: true },
    });

    if (!wallet) {
      return;
    }

    if (wallet.passiveSettledAt) {
      return;
    }

    await client.playerWallet.update({
      where: { playerId },
      data: { passiveSettledAt: now },
    });
  }
}
