import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  createWalletChangeLog(client: Prisma.TransactionClient, data: {
    playerId: string;
    walletBucket: string;
    changeType: string;
    deltaGold: number;
    beforeGold: number;
    afterGold: number;
    relatedEntityType?: string | null;
    relatedEntityId?: string | null;
    requestIdempotencyKey?: string | null;
    note?: string | null;
  }) {
    return client.walletChangeLog.create({ data });
  }

  createBuildingUpgradeLog(client: Prisma.TransactionClient, data: {
    playerId: string;
    buildingKey: string;
    oldLevel: number;
    newLevel: number;
    costGold: number;
    requestIdempotencyKey?: string | null;
  }) {
    return client.buildingUpgradeLog.create({ data });
  }

  createFieldHarvestLog(client: Prisma.TransactionClient, data: {
    playerId: string;
    fieldSlotId: string;
    collectMode: string;
    collectedGold: number;
    overflowGold: number;
    rewardItemsJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  }) {
    return client.fieldHarvestLog.create({ data });
  }

  createTaskRewardLog(client: Prisma.TransactionClient, data: {
    playerId: string;
    taskStateId?: string | null;
    taskId: string;
    rewardGold: number;
    requestIdempotencyKey?: string | null;
  }) {
    return client.taskRewardLog.create({ data });
  }
}
