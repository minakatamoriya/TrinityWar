import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { AppConfigService } from '../config/app-config.service.js';

export const RAID_SETTLEMENT_QUEUE_NAME = 'raid-settlement';

@Injectable()
export class RaidSettlementQueueService implements OnModuleDestroy {
  private queue: Queue<{ raidOrderId: string }> | null = null;
  private connection: Redis | null = null;

  constructor(@Inject(AppConfigService) private readonly appConfigService: AppConfigService) {}

  async enqueueRaidSettlement(input: { raidOrderId: string; settleAt: Date }): Promise<void> {
    if (!input.raidOrderId) {
      return;
    }

    const queue = this.getQueue();
    await queue.add(
      'settle-raid-order',
      { raidOrderId: input.raidOrderId },
      {
        jobId: input.raidOrderId,
        delay: Math.max(input.settleAt.getTime() - Date.now(), 0),
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    await this.connection?.quit();
  }

  private getQueue(): Queue<{ raidOrderId: string }> {
    if (this.queue) {
      return this.queue;
    }

    this.connection = new Redis(this.appConfigService.redisUrl, {
      maxRetriesPerRequest: null,
      connectTimeout: 500,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    this.queue = new Queue<{ raidOrderId: string }>(RAID_SETTLEMENT_QUEUE_NAME, {
      connection: this.connection,
    });

    return this.queue;
  }
}
