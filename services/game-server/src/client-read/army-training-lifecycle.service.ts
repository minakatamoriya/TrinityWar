import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

@Injectable()
export class ArmyTrainingLifecycleService {
  async settlePlayerTrainingQueues(client: Prisma.TransactionClient, playerId: string, now: Date = new Date()): Promise<void> {
    const dueQueues = await client.armyTrainingQueue.findMany({
      where: {
        playerId,
        status: 'QUEUED',
        finishAt: { lte: now },
      },
      orderBy: { finishAt: 'asc' },
    });

    if (dueQueues.length <= 0) {
      return;
    }

    const settledUnits = dueQueues.reduce((sum, queue) => sum + queue.queuedCount, 0);

    if (settledUnits > 0) {
      await client.playerArmy.update({
        where: { playerId },
        data: {
          totalCount: { increment: settledUnits },
          availableCount: { increment: settledUnits },
          armyVersion: { increment: 1 },
        },
      });
    }

    await client.armyTrainingQueue.updateMany({
      where: {
        id: { in: dueQueues.map((queue) => queue.id) },
      },
      data: {
        status: 'CLAIMED',
      },
    });
  }
}