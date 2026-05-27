import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { DAILY_TASK_CONFIG, getDailyTaskDefinition } from '../lib/game-balance.js';
import { getLocalDateKey } from '../lib/date-key.js';
import { TaskConfigService } from '../task-config/task-config.service.js';

type PrismaClientLike = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class DailyTaskLifecycleService {
  constructor(@Inject(TaskConfigService) private readonly taskConfigService: TaskConfigService) {}

  async ensurePlayerDailyTasks(client: PrismaClientLike, playerId: string, dateKey = getLocalDateKey()): Promise<void> {
    const taskIds = buildDailyTaskSelection(dateKey);

    for (const taskId of taskIds) {
      const taskDefinition = getDailyTaskDefinition(taskId);
      const taskConfig = await this.taskConfigService.getDailyTaskConfig(taskId, client);

      if (!taskDefinition || !taskConfig?.isEnabled) {
        continue;
      }

      await client.playerDailyTaskState.upsert({
        where: {
          playerId_dateKey_taskId: {
            playerId,
            dateKey,
            taskId,
          },
        },
        create: {
          playerId,
          dateKey,
          taskId,
          progress: 0,
          target: taskConfig.targetCount,
          status: 'IN_PROGRESS',
          rewardGold: taskConfig.rewardGold,
          actionScene: getDailyTaskActionScene(taskDefinition.objective.type),
          claimedAt: null,
        },
        update: {},
      });
    }
  }
}

function buildDailyTaskSelection(dateKey: string): string[] {
  const fixedTaskIds = DAILY_TASK_CONFIG.fixedTasks
    .slice(0, DAILY_TASK_CONFIG.structure.fixedTaskCount)
    .map((task) => task.id);
  const randomTaskCount = Math.max(DAILY_TASK_CONFIG.structure.randomTaskCount, 0);

  if (randomTaskCount <= 0 || DAILY_TASK_CONFIG.randomTasks.length <= 0) {
    return fixedTaskIds;
  }

  const seed = Array.from(dateKey).reduce((total, char) => total + char.charCodeAt(0), 0);
  const randomTaskIds = Array.from({ length: Math.min(randomTaskCount, DAILY_TASK_CONFIG.randomTasks.length) }, (_, index) => {
    const randomTask = DAILY_TASK_CONFIG.randomTasks[(seed + index) % DAILY_TASK_CONFIG.randomTasks.length];
    return randomTask.id;
  });

  return [...fixedTaskIds, ...randomTaskIds];
}

const DAILY_TASK_SCENE_MAP: Record<string, string> = {
  'collect-field': 'farm',
  'start-cultivation': 'farm',
  'feed-spirit': 'raid',
  'recruit-army': 'raid',
  'upgrade-territory-tech': 'building',
  'upgrade-building': 'building',
  'upgrade-core-line': 'building',
  'upgrade-core-building': 'building',
  'farm-cycle': 'farm',
};

export function getDailyTaskActionScene(objectiveType: string | undefined, fallback = 'home'): string {
  if (!objectiveType) {
    return fallback;
  }

  return DAILY_TASK_SCENE_MAP[objectiveType] ?? fallback;
}
