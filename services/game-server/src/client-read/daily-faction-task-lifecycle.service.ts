import { Inject, Injectable } from '@nestjs/common';
import type { DailyFactionTaskType, Prisma, PrismaClient } from '@prisma/client';
import { TaskConfigService } from '../task-config/task-config.service.js';

type PrismaClientLike = Prisma.TransactionClient | PrismaClient;

const BASIC_TASK: DailyFactionTaskType = 'ESSENCE_SUBMIT_BASIC';
const FOCUS_TASK: DailyFactionTaskType = 'ESSENCE_SUBMIT_FOCUS';
const CONFLICT_TASK: DailyFactionTaskType = 'CONFLICT_RAID';
const TUTORIAL_PLANT_IDS = new Set<string>(['qilingya']);

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
        seedInventory: {
          where: { unlockedAt: { not: null } },
          orderBy: [
            { seedDefinition: { sortOrder: 'asc' } },
            { seedDefinition: { seedId: 'asc' } },
          ],
          select: {
            seedDefinition: {
              select: {
                seedId: true,
                rarity: true,
              },
            },
          },
        },
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
        requiredEssenceType: { in: Array.from(TUTORIAL_PLANT_IDS) },
      },
    });

    const unlockedPlants = player.seedInventory
      .map((inventory) => inventory.seedDefinition)
      .filter((plant) => !TUTORIAL_PLANT_IDS.has(plant.seedId));

    const tasks: DailyFactionTaskSeed[] = [];
    if (unlockedPlants.length > 0) {
      const basicPlant = unlockedPlants.find((plant) => plant.rarity === 'common') ?? unlockedPlants[0];
      const focusPlant = pickFocusPlant(unlockedPlants, dateKey);
      const basicConfig = await this.taskConfigService.getDailyFactionTaskConfig('essence-submit-basic', client);
      const focusConfig = await this.taskConfigService.getDailyFactionTaskConfig(
        focusPlant.rarity === 'common' ? 'essence-submit-focus-common' : 'essence-submit-focus-rare',
        client,
      );
      if (basicConfig?.isEnabled) {
        tasks.push({
          taskType: BASIC_TASK,
          requiredEssenceType: basicPlant.seedId,
          requiredAmount: basicConfig.targetCount,
          rewardContribution: basicConfig.rewardContribution,
        });
      }
      if (focusConfig?.isEnabled) {
        tasks.push({
          taskType: FOCUS_TASK,
          requiredEssenceType: focusPlant.seedId,
          requiredAmount: focusConfig.targetCount,
          rewardContribution: focusConfig.rewardContribution,
        });
      }
    }

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

function pickFocusPlant(
  plants: Array<{ seedId: string; rarity: string }>,
  dateKey: string,
): { seedId: string; rarity: string } {
  const preferredPlants = plants.filter((plant) => plant.rarity !== 'common');
  const pool = preferredPlants.length > 0 ? preferredPlants : plants;
  const seed = Array.from(dateKey).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return pool[seed % pool.length];
}
