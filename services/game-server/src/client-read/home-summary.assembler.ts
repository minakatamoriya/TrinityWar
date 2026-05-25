import { Injectable } from '@nestjs/common';
import { APP_NAME, type ClientDailyTaskStatus, type ClientSceneKey, type HomeSummaryResponse } from '@trinitywar/shared';
import { getActiveDailyTaskIds, getDailyTaskDefinition } from '../lib/game-balance.js';
import type { HomeSummaryReadModel } from './client-read.repository.js';

@Injectable()
export class HomeSummaryAssembler {
  assemble(readModel: HomeSummaryReadModel, now: Date = new Date()): HomeSummaryResponse {
    const castleLevel = readModel.buildings?.castleLevel ?? readModel.player.castleLevelCache;
    const vaultGold = readModel.wallet?.vaultGold ?? 0;
    const armyCount = readModel.army?.availableCount ?? readModel.army?.totalCount ?? 0;
    const armyCapacity = readModel.army?.capacity ?? 0;
    const activeTrainingQueue = readModel.trainingQueues.find((queue) => queue.finishAt.getTime() > now.getTime());
    const activeDailyTaskIds = getActiveDailyTaskIds();

    return {
      app: APP_NAME,
      playerName: readModel.player.nickname,
      factionName: readModel.player.faction?.name ?? '未加入阵营',
      castleLevel,
      stateVersions: {
        buildingVersion: readModel.buildings?.buildingVersion ?? 1,
        walletVersion: readModel.wallet?.balanceVersion ?? 1,
        armyVersion: readModel.army?.armyVersion ?? 1,
      },
      staminaStatus: this.buildStaminaStatus(armyCount, armyCapacity, activeTrainingQueue?.finishAt ?? null, now),
      fieldStatus: this.buildFieldStatus(readModel),
      reportStatus: '暂无新战报',
      protectedUntil: readModel.player.protectedUntil && readModel.player.protectedUntil.getTime() > now.getTime()
        ? readModel.player.protectedUntil.toISOString()
        : null,
      resources: [
        {
          label: '金币',
          value: formatNumber(vaultGold),
          tone: 'vault',
        },
        {
          label: '战力',
          value: `${formatNumber(armyCount)} / ${formatNumber(armyCapacity)}`,
          tone: 'army',
        },
      ],
      pendingClaims: [],
      temporaryClaim: null,
      dailyTasks: readModel.taskStates.filter((taskState) => activeDailyTaskIds.has(taskState.taskId)).map((taskState) => ({
        id: taskState.taskId,
        title: getDailyTaskDefinition(taskState.taskId)?.title ?? taskState.taskId,
        description: `每日任务，完成后可领取 ${formatNumber(taskState.rewardGold)} 金币。`,
        progressCurrent: Math.min(taskState.progress, taskState.target),
        progressTarget: taskState.target,
        progressText: buildDailyTaskProgressText(taskState.progress, taskState.target, taskState.status),
        rewardGold: taskState.rewardGold,
        status: mapTaskStatus(taskState.status),
        actionScene: mapActionScene(taskState.actionScene),
      })),
      primaryActions: [
        { key: 'building', title: '法术阁', description: '修习法术强化经营' },
        { key: 'farm', title: '农场', description: '收成熟田地' },
        { key: 'raid', title: '部队', description: '征召兵力并查看训练队列' },
        { key: 'report', title: '掠夺', description: '查看目标、战报与通缉令' },
        { key: 'faction', title: '阵营', description: '上缴并领取每日俸禄' },
      ],
    };
  }

  private buildStaminaStatus(armyCount: number, armyCapacity: number, activeTrainingFinishAt: Date | null, now: Date): string {
    if (activeTrainingFinishAt) {
      const remainingMinutes = Math.max(Math.ceil((activeTrainingFinishAt.getTime() - now.getTime()) / 60000), 1);
      return `训练中，约 ${remainingMinutes} 分钟后完成`;
    }

    if (armyCapacity <= 0) {
      return '暂无兵力容量';
    }

    if (armyCount >= armyCapacity) {
      return '战力已满';
    }

    return `可继续征召 ${formatNumber(armyCapacity - armyCount)} 战力`;
  }

  private buildFieldStatus(readModel: HomeSummaryReadModel): string {
    const unlockedFields = readModel.fieldSlots.filter((field) => field.isUnlocked);

    if (unlockedFields.length <= 0) {
      return '暂无已解锁田地';
    }

    const readyCount = unlockedFields.filter((field) => field.status === 'MATURE' || field.status === 'WITHERED').length;

    if (readyCount > 0) {
      return `${readyCount} 块田地可收取`;
    }

    const activeCount = unlockedFields.filter((field) => field.status === 'SEEDED' || field.status === 'GROWING').length;

    if (activeCount > 0) {
      return `${activeCount} 块田地培育中`;
    }

    return `${unlockedFields.length} 块田地空闲`;
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(Math.floor(value), 0));
}

function buildDailyTaskProgressText(progress: number, target: number, status: HomeSummaryReadModel['taskStates'][number]['status']): string {
  if (status === 'CLAIMED') {
    return '已领取';
  }

  const progressCurrent = Math.min(progress, target);

  if (progressCurrent >= target || status === 'COMPLETED') {
    return '可领取';
  }

  return `${progressCurrent}/${target}`;
}

function mapTaskStatus(status: HomeSummaryReadModel['taskStates'][number]['status']): ClientDailyTaskStatus {
  if (status === 'CLAIMED') {
    return 'claimed';
  }

  if (status === 'COMPLETED') {
    return 'completed';
  }

  return 'in-progress';
}

function mapActionScene(actionScene: string): ClientSceneKey {
  if (actionScene === 'building' || actionScene === 'farm' || actionScene === 'raid' || actionScene === 'report' || actionScene === 'faction') {
    return actionScene;
  }

  return 'home';
}
