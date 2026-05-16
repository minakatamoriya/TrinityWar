import { Injectable } from '@nestjs/common';
import { APP_NAME, type ClientDailyTaskStatus, type ClientSceneKey, type HomeSummaryResponse } from '@trinitywar/shared';
import { getFactionDividendPerHour, getTaxIncomePerHour } from '../lib/game-balance.js';
import type { HomeSummaryReadModel } from './client-read.repository.js';

const DAILY_TASK_LABELS: Record<string, string> = {
  'daily-harvest-once': '收一次田地',
  'daily-start-cultivation': '开始一次培育',
  'daily-upgrade-building': '升级一次建筑',
  'daily-recruit-army': '征召一次战力',
  'daily-donate-faction': '上缴一次阵营资源',
};

@Injectable()
export class HomeSummaryAssembler {
  assemble(readModel: HomeSummaryReadModel, now: Date = new Date()): HomeSummaryResponse {
    const castleLevel = readModel.buildings?.castleLevel ?? readModel.player.castleLevelCache;
    const vaultGold = readModel.wallet?.vaultGold ?? 0;
    const vaultCapacity = readModel.wallet?.vaultCapacity ?? 0;
    const armyCount = readModel.army?.availableCount ?? readModel.army?.totalCount ?? 0;
    const armyCapacity = readModel.army?.capacity ?? 0;
    const pendingRaidOverflowGold = readModel.wallet?.pendingRaidOverflowGold ?? 0;
    const pendingRaidOverflowExpiresAt = readModel.wallet?.pendingRaidOverflowExpiresAt ?? null;
    const factionContribution = readModel.player.factionMembers[0]?.contributionScore ?? 0;
    const factionDividend = getFactionDividendPerHour(factionContribution);
    const activeTrainingQueue = readModel.trainingQueues.find((queue) => queue.finishAt.getTime() > now.getTime());

    return {
      app: APP_NAME,
      playerName: readModel.player.nickname,
      factionName: readModel.player.faction?.name ?? '未加入阵营',
      castleLevel,
      stateVersions: {
        buildingVersion: readModel.buildings?.buildingVersion ?? 1,
        walletVersion: readModel.wallet?.balanceVersion ?? 1,
      },
      staminaStatus: this.buildStaminaStatus(armyCount, armyCapacity, activeTrainingQueue?.finishAt ?? null, now),
      fieldStatus: this.buildFieldStatus(readModel),
      reportStatus: '暂无新战报',
      protectedUntil: null,
      resources: [
        {
          label: '金币',
          value: `${formatNumber(vaultGold)} / ${formatNumber(vaultCapacity)}`,
          tone: 'vault',
        },
        {
          label: '战力',
          value: `${formatNumber(armyCount)} / ${formatNumber(armyCapacity)}`,
          tone: 'army',
        },
      ],
      pendingClaims: [
        {
          source: 'tax',
          label: '主城税收',
          value: formatNumber(readModel.wallet?.pendingTaxGold ?? 0),
          description: `当前每小时产出 ${formatNumber(getTaxIncomePerHour(castleLevel))} 金币，领取后直接入库。`,
        },
        {
          source: 'faction',
          label: '阵营分红',
          value: formatNumber(readModel.wallet?.pendingDividendGold ?? 0),
          description: `当前每小时可分到 ${formatNumber(factionDividend.total)} 金币，来自阵营结算与贡献加成。`,
        },
      ],
      temporaryClaim: pendingRaidOverflowGold > 0 && pendingRaidOverflowExpiresAt
        ? {
          source: 'raid-overflow',
          label: '待领取',
          goldAmount: pendingRaidOverflowGold,
          expiresAt: pendingRaidOverflowExpiresAt.toISOString(),
          description: '掠夺时金库已满，超出的金币会临时保留在这里，过期后消失。',
        }
        : null,
      dailyTasks: readModel.taskStates.map((taskState) => ({
        id: taskState.taskId,
        title: DAILY_TASK_LABELS[taskState.taskId] ?? taskState.taskId,
        description: `每日任务，完成后可领取 ${formatNumber(taskState.rewardGold)} 金币。`,
        progressCurrent: Math.min(taskState.progress, taskState.target),
        progressTarget: taskState.target,
        progressText: buildDailyTaskProgressText(taskState.progress, taskState.target, taskState.status),
        rewardGold: taskState.rewardGold,
        status: mapTaskStatus(taskState.status),
        actionScene: mapActionScene(taskState.actionScene),
      })),
      primaryActions: [
        { key: 'building', title: '主城', description: '升级主城与金币容量' },
        { key: 'farm', title: '农场', description: '收成熟田地' },
        { key: 'raid', title: '部队', description: '征召兵力并查看训练队列' },
        { key: 'report', title: '掠夺', description: '查看目标、战报与通缉令' },
        { key: 'faction', title: '阵营', description: '上缴并查看分红' },
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
