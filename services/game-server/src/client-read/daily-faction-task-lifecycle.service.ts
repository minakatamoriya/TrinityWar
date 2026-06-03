import { Inject, Injectable } from '@nestjs/common';
import type { DailyFactionTaskType, Prisma, PrismaClient } from '@prisma/client';
import { TaskConfigService } from '../task-config/task-config.service.js';

type PrismaClientLike = Prisma.TransactionClient | PrismaClient;

const BASIC_TASK: DailyFactionTaskType = 'ESSENCE_SUBMIT_BASIC';
const FOCUS_TASK: DailyFactionTaskType = 'ESSENCE_SUBMIT_FOCUS';
const CONFLICT_TASK: DailyFactionTaskType = 'CONFLICT_RAID';

interface DailyFactionTaskSeed {
  taskType: DailyFactionTaskType;
  requiredEssenceType: string | null;
  requiredAmount: number;
  rewardContribution: number;
}

@Injectable()
export class DailyFactionTaskLifecycleService {
  constructor(@Inject(TaskConfigService) private readonly taskConfigService: TaskConfigService) {}

  async ensurePlayerDailyFactionTasks(client: PrismaClientLike, playerId: string, dateKey: string): Promise<void> {
    const player = await client.player.findUnique({
      where: { id: playerId },
      select: {
        factionId: true,
      },
    });

    if (!player?.factionId) {
      return;
    }
    const factionId = player.factionId;

    await client.dailyFactionTask.deleteMany({
      where: {
        playerId,
        taskDate: dateKey,
        taskType: { in: [BASIC_TASK, FOCUS_TASK] },
      },
    });

    const tasks: DailyFactionTaskSeed[] = [];

    const conflictConfig = await this.taskConfigService.getDailyFactionTaskConfig('conflict-raid', client);
    if (conflictConfig?.isEnabled) {
      tasks.push({
        taskType: CONFLICT_TASK,
        requiredEssenceType: null,
        requiredAmount: conflictConfig.targetCount,
        rewardContribution: conflictConfig.rewardContribution,
      });
    }

    if (tasks.length <= 0) {
      return;
    }

    await client.dailyFactionTask.createMany({
      data: tasks.map((task) => ({
        playerId,
        factionId,
        taskDate: dateKey,
        taskType: task.taskType,
        requiredEssenceType: task.requiredEssenceType,
        requiredAmount: task.requiredAmount,
        progressAmount: 0,
        rewardContribution: task.rewardContribution,
        status: 'IN_PROGRESS',
      })),
      skipDuplicates: true,
    });
  }
}

