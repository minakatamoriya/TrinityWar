import type { FieldStatus, Prisma } from '@prisma/client';
import { DAILY_TASK_CONFIG } from '../lib/game-balance.js';
import { getLocalDateKey } from '../lib/date-key.js';

export interface PlayerInitializationInput {
  playerId: string;
  resetExisting?: boolean;
  castleLevel?: number;
  vaultGold?: number;
  walletGold?: number;
  pendingTaxGold?: number;
  pendingDividendGold?: number;
  vaultLevel?: number;
  populationLevel?: number;
  watchtowerLevel?: number;
  protectionTechLevel?: number;
  farmYieldTechLevel?: number;
  ripeWindowTechLevel?: number;
  pendingClaimTechLevel?: number;
  army?: {
    totalCount: number;
    availableCount: number;
    frozenCount?: number;
    woundedCount?: number;
    capacity: number;
  };
  seedInventory?: Record<string, { quantity: number; unlocked: boolean }>;
  fields?: PlayerFieldInitializationInput[];
  taskOverrides?: Array<{
    taskId: string;
    progress: number;
    status?: 'IN_PROGRESS' | 'COMPLETED' | 'CLAIMED';
  }>;
}

export interface PlayerFieldInitializationInput {
  slotIndex: number;
  isUnlocked: boolean;
  unlockCastleLevel: number;
  status: FieldStatus;
  seedId?: string;
  investedGold?: number;
  currentClaimableGold?: number;
  stageOffsetSeconds?: number;
}

const fieldUnlockMilestones = [1, 5, 10, 15];
const starterSeedInventory: Record<string, { quantity: number; unlocked: boolean }> = {
  qinglingmai: { quantity: 3, unlocked: true },
};

export class PlayerInitializationService {
  async initialize(client: Prisma.TransactionClient, input: PlayerInitializationInput): Promise<void> {
    const now = new Date();
    const resetExisting = input.resetExisting ?? false;
    const castleLevel = input.castleLevel ?? 1;
    const populationLevel = input.populationLevel ?? 1;
    const armyCapacity = input.army?.capacity ?? getInitialArmyCapacity(populationLevel);

    await client.playerWallet.upsert({
      where: { playerId: input.playerId },
      create: {
        playerId: input.playerId,
        vaultGold: input.vaultGold ?? 120,
        vaultCapacity: getInitialVaultCapacity(input.vaultLevel ?? 1),
        walletGold: input.walletGold ?? 0,
        walletCapacity: 500,
        walletProtectedRatio: 20,
        pendingTaxGold: input.pendingTaxGold ?? 0,
        pendingDividendGold: input.pendingDividendGold ?? 0,
        pendingRaidOverflowGold: 0,
        balanceVersion: 1,
      },
      update: resetExisting
        ? {
          vaultGold: input.vaultGold ?? 120,
          vaultCapacity: getInitialVaultCapacity(input.vaultLevel ?? 1),
          walletGold: input.walletGold ?? 0,
          walletCapacity: 500,
          walletProtectedRatio: 20,
          pendingTaxGold: input.pendingTaxGold ?? 0,
          pendingDividendGold: input.pendingDividendGold ?? 0,
          pendingRaidOverflowGold: 0,
          pendingRaidOverflowExpiresAt: null,
          balanceVersion: { increment: 1 },
        }
        : {},
    });

    await client.playerBuilding.upsert({
      where: { playerId: input.playerId },
      create: {
        playerId: input.playerId,
        castleLevel,
        vaultLevel: input.vaultLevel ?? 1,
        fieldSlotLevel: getUnlockedFieldCount(castleLevel),
        populationLevel,
        watchtowerLevel: input.watchtowerLevel ?? 1,
        protectionTechLevel: input.protectionTechLevel ?? 0,
        farmYieldTechLevel: input.farmYieldTechLevel ?? 0,
        ripeWindowTechLevel: input.ripeWindowTechLevel ?? 0,
        pendingClaimTechLevel: input.pendingClaimTechLevel ?? 0,
        buildingVersion: 1,
      },
      update: resetExisting
        ? {
          castleLevel,
          vaultLevel: input.vaultLevel ?? 1,
          fieldSlotLevel: getUnlockedFieldCount(castleLevel),
          populationLevel,
          watchtowerLevel: input.watchtowerLevel ?? 1,
          protectionTechLevel: input.protectionTechLevel ?? 0,
          farmYieldTechLevel: input.farmYieldTechLevel ?? 0,
          ripeWindowTechLevel: input.ripeWindowTechLevel ?? 0,
          pendingClaimTechLevel: input.pendingClaimTechLevel ?? 0,
          buildingVersion: { increment: 1 },
        }
        : {},
    });

    await client.playerArmy.upsert({
      where: { playerId: input.playerId },
      create: {
        playerId: input.playerId,
        totalCount: input.army?.totalCount ?? Math.min(10, armyCapacity),
        availableCount: input.army?.availableCount ?? Math.min(10, armyCapacity),
        frozenCount: input.army?.frozenCount ?? 0,
        woundedCount: input.army?.woundedCount ?? 0,
        capacity: armyCapacity,
        armyVersion: 1,
      },
      update: resetExisting
        ? {
          totalCount: input.army?.totalCount ?? Math.min(10, armyCapacity),
          availableCount: input.army?.availableCount ?? Math.min(10, armyCapacity),
          frozenCount: input.army?.frozenCount ?? 0,
          woundedCount: input.army?.woundedCount ?? 0,
          capacity: armyCapacity,
          armyVersion: { increment: 1 },
        }
        : {},
    });

    const seedDefinitions = await client.seedDefinition.findMany({
      select: { id: true, seedId: true },
    });
    const seedIdToDefinitionId = new Map(seedDefinitions.map((seed) => [seed.seedId, seed.id]));

    await this.initializeFields(client, input.playerId, input.fields ?? buildDefaultFields(castleLevel), seedIdToDefinitionId, now, resetExisting);
    await this.initializeSeedInventory(client, input.playerId, input.seedInventory ?? starterSeedInventory, seedDefinitions, now, resetExisting);
    await this.initializeDailyTasks(client, input.playerId, input.taskOverrides, resetExisting);

    await client.player.update({
      where: { id: input.playerId },
      data: {
        castleLevelCache: castleLevel,
        lastLoginAt: now,
      },
    });
  }

  private async initializeFields(
    client: Prisma.TransactionClient,
    playerId: string,
    fields: PlayerFieldInitializationInput[],
    seedIdToDefinitionId: Map<string, string>,
    now: Date,
    resetExisting: boolean,
  ): Promise<void> {
    for (const field of fields) {
      const stageStartedAt = new Date(now.getTime() - (field.stageOffsetSeconds ?? 0) * 1000);
      const seedDefinitionId = field.seedId ? seedIdToDefinitionId.get(field.seedId) : null;

      await client.playerFieldSlot.upsert({
        where: {
          playerId_slotIndex: {
            playerId,
            slotIndex: field.slotIndex,
          },
        },
        create: {
          playerId,
          slotIndex: field.slotIndex,
          isUnlocked: field.isUnlocked,
          unlockCastleLevel: field.unlockCastleLevel,
          status: field.status,
          seedDefinitionId,
          investedGold: field.investedGold ?? 0,
          currentClaimableGold: field.currentClaimableGold ?? 0,
          harvestedGoldTotal: 0,
          raidedGoldTotal: 0,
          seedAt: seedDefinitionId ? stageStartedAt : null,
          matureAt: seedDefinitionId && field.status !== 'SEEDED' ? stageStartedAt : null,
          fullMatureAt: seedDefinitionId && (field.status === 'MATURE' || field.status === 'WITHERED') ? stageStartedAt : null,
          overripeAt: field.status === 'WITHERED' ? stageStartedAt : null,
          lastCalculatedAt: seedDefinitionId ? now : null,
          statusVersion: 1,
        },
        update: resetExisting
          ? {
            isUnlocked: field.isUnlocked,
            unlockCastleLevel: field.unlockCastleLevel,
            status: field.status,
            seedDefinitionId,
            investedGold: field.investedGold ?? 0,
            currentClaimableGold: field.currentClaimableGold ?? 0,
            harvestedGoldTotal: 0,
            raidedGoldTotal: 0,
            seedAt: seedDefinitionId ? stageStartedAt : null,
            matureAt: seedDefinitionId && field.status !== 'SEEDED' ? stageStartedAt : null,
            fullMatureAt: seedDefinitionId && (field.status === 'MATURE' || field.status === 'WITHERED') ? stageStartedAt : null,
            overripeAt: field.status === 'WITHERED' ? stageStartedAt : null,
            lastCalculatedAt: seedDefinitionId ? now : null,
            statusVersion: { increment: 1 },
          }
          : {},
      });
    }
  }

  private async initializeSeedInventory(
    client: Prisma.TransactionClient,
    playerId: string,
    inventory: Record<string, { quantity: number; unlocked: boolean }>,
    seedDefinitions: Array<{ id: string; seedId: string }>,
    now: Date,
    resetExisting: boolean,
  ): Promise<void> {
    for (const seedDefinition of seedDefinitions) {
      const entry = inventory[seedDefinition.seedId] ?? { quantity: 0, unlocked: false };

      await client.playerSeedInventory.upsert({
        where: {
          playerId_seedDefinitionId: {
            playerId,
            seedDefinitionId: seedDefinition.id,
          },
        },
        create: {
          playerId,
          seedDefinitionId: seedDefinition.id,
          quantity: entry.quantity,
          unlockedAt: entry.unlocked ? now : null,
          inventoryVersion: 1,
        },
        update: resetExisting
          ? {
            quantity: entry.quantity,
            unlockedAt: entry.unlocked ? now : null,
            inventoryVersion: { increment: 1 },
          }
          : {},
      });
    }
  }

  private async initializeDailyTasks(
    client: Prisma.TransactionClient,
    playerId: string,
    taskOverrides: PlayerInitializationInput['taskOverrides'],
    resetExisting: boolean,
  ): Promise<void> {
    const dateKey = getLocalDateKey();
    const taskIds = buildDailyTaskSelection(dateKey);
    const overrideByTaskId = new Map(taskOverrides?.map((override) => [override.taskId, override]) ?? []);

    for (const taskId of taskIds) {
      const taskDefinition = getDailyTaskDefinition(taskId);

      if (!taskDefinition) {
        continue;
      }

      const override = overrideByTaskId.get(taskId);
      const target = taskDefinition.objective.count;
      const progress = override?.progress ?? 0;
      const status = override?.status ?? (progress >= target ? 'COMPLETED' : 'IN_PROGRESS');

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
          progress,
          target,
          status,
          rewardGold: getDailyTaskGoldReward(taskId),
          actionScene: DAILY_TASK_SCENE_MAP[taskDefinition.objective.type] ?? 'home',
          claimedAt: status === 'CLAIMED' ? new Date() : null,
        },
        update: resetExisting
          ? {
            progress,
            target,
            status,
            rewardGold: getDailyTaskGoldReward(taskId),
            actionScene: DAILY_TASK_SCENE_MAP[taskDefinition.objective.type] ?? 'home',
            claimedAt: status === 'CLAIMED' ? new Date() : null,
          }
          : {},
      });
    }
  }
}

function buildDefaultFields(castleLevel: number): PlayerFieldInitializationInput[] {
  return fieldUnlockMilestones.map((unlockCastleLevel, index) => {
    const slotIndex = index + 1;
    const isUnlocked = castleLevel >= unlockCastleLevel;

    return {
      slotIndex,
      isUnlocked,
      unlockCastleLevel,
      status: isUnlocked ? 'EMPTY' : 'LOCKED',
    };
  });
}

function getUnlockedFieldCount(castleLevel: number): number {
  return fieldUnlockMilestones.filter((requiredLevel) => castleLevel >= requiredLevel).length;
}

function getInitialVaultCapacity(vaultLevel: number): number {
  return Math.max(vaultLevel, 1) * 800;
}

function getInitialArmyCapacity(populationLevel: number): number {
  return Math.max(populationLevel, 1) * 10;
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

function getDailyTaskDefinition(taskId: string): (typeof DAILY_TASK_CONFIG.fixedTasks)[number] | (typeof DAILY_TASK_CONFIG.randomTasks)[number] | null {
  return [...DAILY_TASK_CONFIG.fixedTasks, ...DAILY_TASK_CONFIG.randomTasks].find((task) => task.id === taskId) ?? null;
}

function getDailyTaskGoldReward(taskId: string): number {
  const task = getDailyTaskDefinition(taskId);
  const goldReward = task?.rewards?.find((reward) => reward.type === 'gold');
  return typeof goldReward?.amount === 'number' ? goldReward.amount : 0;
}

const DAILY_TASK_SCENE_MAP: Record<string, string> = {
  'collect-field': 'farm',
  'start-cultivation': 'farm',
  'faction-interaction': 'faction',
  'faction-donate': 'faction',
  'recruit-army': 'raid',
  'upgrade-building': 'building',
  'upgrade-core-line': 'building',
  'upgrade-core-building': 'building',
  'farm-cycle': 'farm',
};
