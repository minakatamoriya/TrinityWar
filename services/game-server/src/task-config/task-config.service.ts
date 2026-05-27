import { Inject, Injectable } from '@nestjs/common';
import type { DailyFactionTaskType, Prisma, PrismaClient } from '@prisma/client';
import { DAILY_TASK_CONFIG, getDailyTaskDefinition } from '../lib/game-balance.js';
import { PrismaService } from '../prisma/prisma.service.js';

type PrismaClientLike = Prisma.TransactionClient | PrismaClient;

export type TaskConfigGroup = 'starter' | 'daily' | 'daily-faction';

export interface ResolvedDailyTaskConfig {
  taskId: string;
  title: string;
  description: string | null;
  objectiveType: string;
  targetCount: number;
  rewardGold: number;
  isEnabled: boolean;
}

export interface ResolvedDailyFactionTaskConfig {
  taskId: string;
  title: string;
  description: string | null;
  taskType: DailyFactionTaskType;
  targetCount: number;
  rewardContribution: number;
  isEnabled: boolean;
}

export interface AdminTaskConfigRecord {
  id: string;
  taskGroup: TaskConfigGroup;
  taskId: string;
  title: string;
  description: string | null;
  objectiveType: string | null;
  targetCount: number | null;
  rewardGold: number | null;
  rewardContribution: number | null;
  isEnabled: boolean;
  source: 'default' | 'override';
  createdAt: string | null;
  updatedAt: string | null;
}

interface TaskConfigOverrideLike {
  id: string;
  taskGroup: string;
  taskId: string;
  title: string | null;
  description: string | null;
  targetCount: number | null;
  rewardGold: number | null;
  rewardContribution: number | null;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DAILY_FACTION_DEFAULTS: ResolvedDailyFactionTaskConfig[] = [
  {
    taskId: 'essence-submit-basic',
    title: '基础精华上缴',
    description: '上缴基础灵植精华，获得阵营贡献。',
    taskType: 'ESSENCE_SUBMIT_BASIC',
    targetCount: 20,
    rewardContribution: 20,
    isEnabled: true,
  },
  {
    taskId: 'essence-submit-focus-common',
    title: '重点精华需求',
    description: '上缴当日重点普通精华，获得更多阵营贡献。',
    taskType: 'ESSENCE_SUBMIT_FOCUS',
    targetCount: 15,
    rewardContribution: 30,
    isEnabled: true,
  },
  {
    taskId: 'essence-submit-focus-rare',
    title: '稀有精华需求',
    description: '上缴当日重点稀有或传说精华，获得更多阵营贡献。',
    taskType: 'ESSENCE_SUBMIT_FOCUS',
    targetCount: 10,
    rewardContribution: 35,
    isEnabled: true,
  },
  {
    taskId: 'conflict-raid',
    title: '冲突对抗',
    description: '完成 1 次成功掠夺，获得阵营贡献。',
    taskType: 'CONFLICT_RAID',
    targetCount: 1,
    rewardContribution: 25,
    isEnabled: true,
  },
];

@Injectable()
export class TaskConfigService {
  private overrideTableAvailable: boolean | null = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listAdminTaskConfigs(
    group?: TaskConfigGroup | null,
    client: PrismaClientLike = this.prisma.db,
  ): Promise<AdminTaskConfigRecord[]> {
    const groups: TaskConfigGroup[] = group ? [group] : ['starter', 'daily', 'daily-faction'];
    const overrides = await this.findOverrides(client, groups);
    return groups.flatMap((taskGroup) => this.buildAdminRecordsForGroup(taskGroup, overrides));
  }

  async upsertAdminTaskConfig(
    group: TaskConfigGroup,
    taskId: string,
    payload: {
      title?: string | null;
      description?: string | null;
      targetCount?: number | null;
      rewardGold?: number | null;
      rewardContribution?: number | null;
      isEnabled?: boolean;
    },
    client: PrismaClientLike = this.prisma.db,
  ): Promise<AdminTaskConfigRecord> {
    const normalizedGroup = normalizeGroup(group);
    const normalizedTaskId = taskId.trim();
    if (!normalizedTaskId) {
      throw new Error('taskId is required.');
    }

    const data = {
      title: normalizeNullableString(payload.title),
      description: normalizeNullableString(payload.description),
      targetCount: normalizeNullableInteger(payload.targetCount),
      rewardGold: normalizeNullableInteger(payload.rewardGold),
      rewardContribution: normalizeNullableInteger(payload.rewardContribution),
      isEnabled: payload.isEnabled ?? true,
    };

    const saved = await client.taskConfigOverride.upsert({
      where: {
        taskGroup_taskId: {
          taskGroup: normalizedGroup,
          taskId: normalizedTaskId,
        },
      },
      create: {
        taskGroup: normalizedGroup,
        taskId: normalizedTaskId,
        ...data,
      },
      update: data,
    });

    const records = await this.listAdminTaskConfigs(normalizedGroup, client);
    return records.find((record) => record.taskId === saved.taskId) ?? this.overrideToAdminRecord(saved, normalizedGroup);
  }

  async getDailyTaskConfig(
    taskId: string,
    client: PrismaClientLike = this.prisma.db,
  ): Promise<ResolvedDailyTaskConfig | null> {
    const task = getDailyTaskDefinition(taskId);
    if (!task) {
      return null;
    }

    const group: TaskConfigGroup = isCatchupTask(taskId) ? 'starter' : 'daily';
    const override = await this.findOverride(client, group, taskId);
    return applyDailyOverride(defaultDailyTaskConfig(task), override);
  }

  async getDailyFactionTaskConfig(
    taskId: string,
    client: PrismaClientLike = this.prisma.db,
  ): Promise<ResolvedDailyFactionTaskConfig | null> {
    const base = DAILY_FACTION_DEFAULTS.find((task) => task.taskId === taskId) ?? null;
    if (!base) {
      return null;
    }

    const override = await this.findOverride(client, 'daily-faction', taskId);
    return applyDailyFactionOverride(base, override);
  }

  private async findOverride(
    client: PrismaClientLike,
    taskGroup: TaskConfigGroup,
    taskId: string,
  ): Promise<TaskConfigOverrideLike | null> {
    if (!await this.hasOverrideTable(client)) {
      return null;
    }

    try {
      return await client.taskConfigOverride.findUnique({
        where: {
          taskGroup_taskId: {
            taskGroup,
            taskId,
          },
        },
      });
    } catch (caught) {
      if (isMissingTaskConfigOverrideTable(caught)) {
        return null;
      }

      throw caught;
    }
  }

  private async findOverrides(
    client: PrismaClientLike,
    groups: TaskConfigGroup[],
  ): Promise<Map<string, TaskConfigOverrideLike>> {
    if (!await this.hasOverrideTable(client)) {
      return new Map();
    }

    try {
      const overrides = await client.taskConfigOverride.findMany({
        where: { taskGroup: { in: groups } },
      });
      return new Map(overrides.map((override) => [`${override.taskGroup}:${override.taskId}`, override]));
    } catch (caught) {
      if (isMissingTaskConfigOverrideTable(caught)) {
        return new Map();
      }

      throw caught;
    }
  }

  private buildAdminRecordsForGroup(
    group: TaskConfigGroup,
    overrides: Map<string, TaskConfigOverrideLike>,
  ): AdminTaskConfigRecord[] {
    if (group === 'daily-faction') {
      return DAILY_FACTION_DEFAULTS.map((task) => {
        const override = overrides.get(`${group}:${task.taskId}`) ?? null;
        return dailyFactionToAdminRecord(applyDailyFactionOverride(task, override), group, override);
      });
    }

    const sourceTasks = group === 'starter' ? DAILY_TASK_CONFIG.catchupTasks : [
      ...DAILY_TASK_CONFIG.fixedTasks,
      ...DAILY_TASK_CONFIG.randomTasks,
    ];

    return sourceTasks.map((task) => {
      const override = overrides.get(`${group}:${task.id}`) ?? null;
      return dailyToAdminRecord(applyDailyOverride(defaultDailyTaskConfig(task), override), group, override);
    });
  }

  private overrideToAdminRecord(override: TaskConfigOverrideLike, group: TaskConfigGroup): AdminTaskConfigRecord {
    return {
      id: override.id,
      taskGroup: group,
      taskId: override.taskId,
      title: override.title ?? override.taskId,
      description: override.description,
      objectiveType: null,
      targetCount: override.targetCount,
      rewardGold: override.rewardGold,
      rewardContribution: override.rewardContribution,
      isEnabled: override.isEnabled,
      source: 'override',
      createdAt: override.createdAt.toISOString(),
      updatedAt: override.updatedAt.toISOString(),
    };
  }

  private async hasOverrideTable(client: PrismaClientLike): Promise<boolean> {
    if (this.overrideTableAvailable !== null) {
      return this.overrideTableAvailable;
    }

    try {
      const result = await client.$queryRaw<Array<{ exists: boolean }>>`
        SELECT to_regclass('public.task_config_override') IS NOT NULL AS "exists"
      `;
      this.overrideTableAvailable = Boolean(result[0]?.exists);
      return this.overrideTableAvailable;
    } catch {
      this.overrideTableAvailable = false;
      return false;
    }
  }
}

function defaultDailyTaskConfig(task: {
  id: string;
  title: string;
  objective: { type: string; count: number };
  rewards?: Array<{ type: string; amount: number }>;
}): ResolvedDailyTaskConfig {
  return {
    taskId: task.id,
    title: task.title,
    description: null,
    objectiveType: task.objective.type,
    targetCount: task.objective.count,
    rewardGold: task.rewards?.find((reward) => reward.type === 'gold')?.amount ?? 0,
    isEnabled: true,
  };
}

function applyDailyOverride(
  base: ResolvedDailyTaskConfig,
  override: TaskConfigOverrideLike | null,
): ResolvedDailyTaskConfig {
  if (!override) {
    return base;
  }

  return {
    ...base,
    title: override.title ?? base.title,
    description: override.description ?? base.description,
    targetCount: override.targetCount ?? base.targetCount,
    rewardGold: override.rewardGold ?? base.rewardGold,
    isEnabled: override.isEnabled,
  };
}

function applyDailyFactionOverride(
  base: ResolvedDailyFactionTaskConfig,
  override: TaskConfigOverrideLike | null,
): ResolvedDailyFactionTaskConfig {
  if (!override) {
    return base;
  }

  return {
    ...base,
    title: override.title ?? base.title,
    description: override.description ?? base.description,
    targetCount: override.targetCount ?? base.targetCount,
    rewardContribution: override.rewardContribution ?? base.rewardContribution,
    isEnabled: override.isEnabled,
  };
}

function dailyToAdminRecord(
  task: ResolvedDailyTaskConfig,
  group: TaskConfigGroup,
  override: TaskConfigOverrideLike | null,
): AdminTaskConfigRecord {
  return {
    id: override?.id ?? `${group}:${task.taskId}`,
    taskGroup: group,
    taskId: task.taskId,
    title: task.title,
    description: task.description,
    objectiveType: task.objectiveType,
    targetCount: task.targetCount,
    rewardGold: task.rewardGold,
    rewardContribution: null,
    isEnabled: task.isEnabled,
    source: override ? 'override' : 'default',
    createdAt: override?.createdAt.toISOString() ?? null,
    updatedAt: override?.updatedAt.toISOString() ?? null,
  };
}

function dailyFactionToAdminRecord(
  task: ResolvedDailyFactionTaskConfig,
  group: TaskConfigGroup,
  override: TaskConfigOverrideLike | null,
): AdminTaskConfigRecord {
  return {
    id: override?.id ?? `${group}:${task.taskId}`,
    taskGroup: group,
    taskId: task.taskId,
    title: task.title,
    description: task.description,
    objectiveType: task.taskType,
    targetCount: task.targetCount,
    rewardGold: null,
    rewardContribution: task.rewardContribution,
    isEnabled: task.isEnabled,
    source: override ? 'override' : 'default',
    createdAt: override?.createdAt.toISOString() ?? null,
    updatedAt: override?.updatedAt.toISOString() ?? null,
  };
}

function isCatchupTask(taskId: string): boolean {
  return DAILY_TASK_CONFIG.catchupTasks.some((task) => task.id === taskId);
}

function normalizeGroup(group: TaskConfigGroup): TaskConfigGroup {
  if (group === 'starter' || group === 'daily' || group === 'daily-faction') {
    return group;
  }

  throw new Error('Unsupported task group.');
}

function normalizeNullableString(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNullableInteger(value: number | null | undefined): number | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  return Math.max(Math.floor(value), 0);
}

function isMissingTaskConfigOverrideTable(caught: unknown): boolean {
  const error = caught as { code?: string; message?: string } | null;
  return error?.code === 'P2021'
    || error?.code === 'P2022'
    || Boolean(error?.message?.includes('task_config_override'));
}
