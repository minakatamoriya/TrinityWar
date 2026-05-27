import { Injectable } from '@nestjs/common';
import type { DailyFactionTaskType, Prisma, PrismaClient } from '@prisma/client';

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
      tasks.push(
        {
          taskType: BASIC_TASK,
          requiredEssenceType: basicPlant.seedId,
          requiredAmount: 20,
          rewardContribution: 20,
        },
        {
          taskType: FOCUS_TASK,
          requiredEssenceType: focusPlant.seedId,
          requiredAmount: focusPlant.rarity === 'common' ? 15 : 10,
          rewardContribution: focusPlant.rarity === 'common' ? 30 : 35,
        },
      );
    }

    tasks.push(
      {
        taskType: CONFLICT_TASK,
        requiredEssenceType: null,
        requiredAmount: 1,
        rewardContribution: 25,
      },
    );

    for (const task of tasks) {
      await client.dailyFactionTask.upsert({
        where: {
          playerId_taskDate_taskType: {
            playerId,
            taskDate: dateKey,
            taskType: task.taskType,
          },
        },
        create: {
          playerId,
          factionId: player.factionId,
          taskDate: dateKey,
          taskType: task.taskType,
          requiredEssenceType: task.requiredEssenceType,
          requiredAmount: task.requiredAmount,
          progressAmount: 0,
          rewardContribution: task.rewardContribution,
          status: 'IN_PROGRESS',
        },
        update: {},
      });
    }
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
