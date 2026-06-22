import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  DAILY_TASK_CONFIG,
  FACTION_CONTRIBUTION_BALANCE_CONFIG,
  getDailyTaskDefinition,
} from '../lib/game-balance.js';
import { PrismaService } from '../prisma/prisma.service.js';

type PrismaClientLike = Prisma.TransactionClient | PrismaClient;

export type TaskConfigGroup = 'starter' | 'daily' | 'daily-faction' | 'contribution';

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
  taskType: string;
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
    title: '旧版上缴已退役',
    description: '旧版上缴任务已退役。',
    taskType: 'ESSENCE_SUBMIT_BASIC',
    targetCount: 20,
    rewardContribution: 20,
    isEnabled: false,
  },
  {
    taskId: 'essence-submit-focus-common',
    title: '旧版上缴已退役',
    description: '旧版上缴任务已退役。',
    taskType: 'ESSENCE_SUBMIT_FOCUS',
    targetCount: 15,
    rewardContribution: 30,
    isEnabled: false,
  },
  {
    taskId: 'essence-submit-focus-rare',
    title: '旧版上缴已退役',
    description: '旧版上缴任务已退役。',
    taskType: 'ESSENCE_SUBMIT_FOCUS',
    targetCount: 10,
    rewardContribution: 35,
    isEnabled: false,
  },
  {
    taskId: 'conflict-raid',
    title: '冲突对抗',
    description: '完成 1 次成功掠夺，获得阵营贡献。',
    taskType: 'CONFLICT_RAID',
    targetCount: 1,
    rewardContribution: 25,
    isEnabled: false,
  },
];

const CONTRIBUTION_RULE_DEFAULTS: ResolvedDailyFactionTaskConfig[] = [
  {
    taskId: 'start-cultivation',
    title: '开始种植',
    description: '每次开始一轮非教程灵植培育获得个人阵营贡献。',
    taskType: 'FARM_CULTIVATION',
    targetCount: 1,
    rewardContribution: FACTION_CONTRIBUTION_BALANCE_CONFIG.sources.startCultivation,
    isEnabled: true,
  },
  {
    taskId: 'collect-field',
    title: '收取灵植',
    description: '每次收取成熟灵植获得个人阵营贡献。',
    taskType: 'FARM_HARVEST',
    targetCount: 1,
    rewardContribution: FACTION_CONTRIBUTION_BALANCE_CONFIG.sources.fieldCollect,
    isEnabled: true,
  },
  {
    taskId: 'spirit-recover',
    title: '灵宠恢复',
    description: '使用灵宠恢复获得个人阵营贡献。',
    taskType: 'SPIRIT_RECOVER',
    targetCount: 1,
    rewardContribution: FACTION_CONTRIBUTION_BALANCE_CONFIG.sources.spiritRecover,
    isEnabled: true,
  },
  {
    taskId: 'spirit-roll-traits',
    title: '灵宠洗练',
    description: '洗练灵宠词条获得个人阵营贡献。',
    taskType: 'SPIRIT_ROLL_TRAITS',
    targetCount: 1,
    rewardContribution: FACTION_CONTRIBUTION_BALANCE_CONFIG.sources.spiritRollTraits,
    isEnabled: true,
  },
  ...DAILY_FACTION_DEFAULTS.map((task) => ({
    ...task,
    title: task.title.replace('每日阵营任务', '阵营贡献'),
  })),
];

@Injectable()
export class TaskConfigService {
  private overrideTableAvailable: boolean | null = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listAdminTaskConfigs(
    group?: TaskConfigGroup | null,
    client: PrismaClientLike = this.prisma.db,
  ): Promise<AdminTaskConfigRecord[]> {
    const groups: TaskConfigGroup[] = group ? [group] : ['starter', 'contribution'];
    const overrideGroups: TaskConfigGroup[] = groups.includes('contribution')
      ? Array.from(new Set([...groups, 'daily-faction']))
      : groups;
    const overrides = await this.findOverrides(client, overrideGroups);
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
    const base = CONTRIBUTION_RULE_DEFAULTS.find((task) => task.taskId === taskId)
      ?? DAILY_FACTION_DEFAULTS.find((task) => task.taskId === taskId)
      ?? null;
    if (!base) {
      return null;
    }

    const override = await this.findOverride(client, 'contribution', taskId)
      ?? await this.findOverride(client, 'daily-faction', taskId);
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
    if (group === 'daily-faction' || group === 'contribution') {
      const sourceTasks = group === 'contribution' ? CONTRIBUTION_RULE_DEFAULTS : DAILY_FACTION_DEFAULTS;
      return sourceTasks.map((task) => {
        const override = overrides.get(`${group}:${task.taskId}`)
          ?? overrides.get(`daily-faction:${task.taskId}`)
          ?? null;
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
  if (group === 'starter' || group === 'daily' || group === 'daily-faction' || group === 'contribution') {
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
