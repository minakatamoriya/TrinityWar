import { Injectable } from '@nestjs/common';
import { APP_NAME, type ClientFarmField, type ClientSceneContentResponse } from '@trinitywar/shared';
import type { FieldStatus } from '@prisma/client';
import {
  GAME_BALANCE,
  getBuildingUpgradeCost,
  getCastleExtensionLevelConfig,
  getCastleExtensionTrack,
  getFactionDividendPerHour,
  getPopulationCapacityGain,
  getSeedStageSeconds,
  getVaultCapacityGain,
} from '../lib/game-balance.js';
import type { SceneContentReadModel } from './client-read.repository.js';

type BuildingKey = 'castle' | 'vault' | 'field-slot' | 'population' | 'watchtower';
type ExtensionKey = 'protectionTech' | 'farmYieldTech' | 'ripeWindowTech' | 'pendingClaimTech';

const FIELD_STATUS_COPY: Record<FieldStatus, { title: string; badge: string; tone: ClientFarmField['tone'] }> = {
  LOCKED: { title: '未解锁', badge: '待解锁', tone: 'locked' },
  EMPTY: { title: '空地', badge: '可播种', tone: 'empty' },
  SEEDED: { title: '播种期', badge: '播种', tone: 'seeded' },
  GROWING: { title: '成长期', badge: '成长', tone: 'growing' },
  MATURE: { title: '成熟期', badge: '成熟', tone: 'mature' },
  WITHERED: { title: '枯萎期', badge: '枯萎', tone: 'withered' },
};

@Injectable()
export class SceneContentAssembler {
  assemble(readModel: SceneContentReadModel, now: Date = new Date()): ClientSceneContentResponse {
    return {
      app: APP_NAME,
      building: {
        upgrades: this.buildBuildingUpgrades(readModel),
        extensions: this.buildExtensions(readModel),
      },
      army: this.buildArmy(readModel, now),
      farm: {
        hero: this.buildFarmHero(readModel),
        fields: readModel.fieldSlots.map((field) => this.buildFarmField(field, now)),
        guide: {
          title: '农场经营',
          description: '田地状态已从数据库读取，播种与收取命令会在后续写链路阶段接入。',
          actions: [
            { label: '打开主城页', target: 'building', tone: 'secondary' },
            { label: '返回首页', target: 'home', tone: 'ghost' },
          ],
        },
      },
      raid: {
        hero: this.buildRaidHero(readModel),
        targets: this.buildRaidTargets(readModel),
        detail: {
          advice: readModel.raidTargetPools.length > 0
            ? '目标来自 raid_target_pool，发起掠夺会先创建订单并等待异步结算。'
            : '当前没有可用目标池记录，执行 seed 后会生成开发联调目标。',
          actions: [{ label: '刷新目标', target: 'raid', tone: 'secondary' }],
        },
        messageTemplates: readModel.raidMessageTemplates,
      },
      report: {
        defense: this.buildReportEntries(readModel, 'DEFENSE'),
        attack: this.buildReportEntries(readModel, 'ATTACK'),
        actions: [
          { label: '等待战报接入', target: 'report', tone: 'ghost' },
        ],
      },
      faction: this.buildFaction(readModel),
    };
  }

  private buildRaidHero(readModel: SceneContentReadModel): ClientSceneContentResponse['raid']['hero'] {
    const availableCount = readModel.army?.availableCount ?? 0;
    const targetCount = readModel.raidTargetPools.length;

    return {
      eyebrow: '可掠夺目标',
      title: targetCount > 0 ? `可出征目标 ${targetCount} 个` : '暂无可出征目标',
      description: `当前可用战力 ${formatNumber(availableCount)}，第 16 步只创建订单并进入异步结算链路。`,
      action: { label: targetCount > 0 ? '查看目标' : '等待目标', target: 'raid', tone: targetCount > 0 ? 'primary' : 'ghost' },
    };
  }

  private buildRaidTargets(readModel: SceneContentReadModel): ClientSceneContentResponse['raid']['targets'] {
    return readModel.raidTargetPools.map((targetPool) => {
      const snapshot = targetPool.targetSnapshotJson as {
        name?: string;
        faction?: string;
        level?: number;
        combatPower?: number;
        raidableGold?: number;
        risk?: string;
        detail?: string;
      };

      const targetName = snapshot.name ?? targetPool.targetPlayer.nickname;
      const factionName = snapshot.faction ?? targetPool.targetPlayer.faction?.name ?? '未知阵营';
      const combatPower = snapshot.combatPower ?? targetPool.targetPlayer.army?.totalCount ?? 0;
      const raidableGold = snapshot.raidableGold ?? 0;

      return {
        id: targetPool.id,
        name: targetName,
        faction: factionName,
        level: snapshot.level ?? targetPool.targetPlayer.castleLevelCache,
        combatPower: formatNumber(combatPower),
        summary: `${factionName} Lv.${snapshot.level ?? targetPool.targetPlayer.castleLevelCache}`,
        loot: `${formatNumber(Math.max(Math.floor(raidableGold * 0.35), 0))}~${formatNumber(raidableGold)} 金币`,
        risk: snapshot.risk ?? '异步结算',
        detail: snapshot.detail ?? `目标池有效至 ${targetPool.expiresAt.toISOString()}`,
        action: { label: '发起掠夺', target: 'raid', tone: 'primary' },
      };
    });
  }

  private buildReportEntries(
    readModel: SceneContentReadModel,
    reportType: 'ATTACK' | 'DEFENSE',
  ): ClientSceneContentResponse['report']['attack'] {
    return readModel.battleReports
      .filter((report) => report.reportType === reportType)
      .map((report) => ({
        title: report.title,
        tag: reportType === 'ATTACK' ? '攻方' : '守方',
        tone: report.result === 'WIN' ? 'success' : report.result === 'LOSS' ? 'danger' : 'neutral',
        summary: report.summary,
        createdAt: report.createdAt.toISOString(),
        revengeable: report.revengeAvailable,
        raidMessage: report.raidOrder.raidMessage && !report.raidOrder.raidMessage.isHidden
          ? {
            messageTemplateId: report.raidOrder.raidMessage.templateId,
            messageEmojiId: null,
            messageTextSnapshot: report.raidOrder.raidMessage.textSnapshot,
          }
          : null,
        actions: [{ label: '查看详情', target: 'report', tone: 'ghost' }],
      }));
  }

  private buildBuildingUpgrades(readModel: SceneContentReadModel): ClientSceneContentResponse['building']['upgrades'] {
    const buildings = readModel.buildings;
    const castleLevel = buildings?.castleLevel ?? readModel.player.castleLevelCache;
    const vaultLevel = buildings?.vaultLevel ?? 1;
    const populationLevel = buildings?.populationLevel ?? 1;
    const watchtowerLevel = buildings?.watchtowerLevel ?? 1;

    const items: Array<{ id: BuildingKey; title: string; level: number; locked?: boolean; description: string; costText: string; actionLabel: string }> = [
      {
        id: 'castle',
        title: '主城',
        level: castleLevel,
        description: `Lv.${castleLevel} -> Lv.${castleLevel + 1}，提升税收与后续田地解锁里程碑。`,
        costText: this.buildUpgradeCostText('castle', castleLevel),
        actionLabel: '升级主城',
      },
      {
        id: 'vault',
        title: '金库',
        level: vaultLevel,
        description: `Lv.${vaultLevel} -> Lv.${vaultLevel + 1}，金库容量预计提升 ${formatNumber(getVaultCapacityGain(vaultLevel))}。`,
        costText: this.buildUpgradeCostText('vault', vaultLevel),
        actionLabel: '升级金库',
      },
      {
        id: 'field-slot',
        title: '田地',
        level: buildings?.fieldSlotLevel ?? readModel.fieldSlots.filter((field) => field.isUnlocked).length,
        locked: true,
        description: `当前已解锁 ${readModel.fieldSlots.filter((field) => field.isUnlocked).length} 块田地，田地位随主城等级自动开启。`,
        costText: '随主城等级自动解锁',
        actionLabel: '查看条件',
      },
      {
        id: 'population',
        title: '兵力上限',
        level: populationLevel,
        description: `Lv.${populationLevel} -> Lv.${populationLevel + 1}，容量预计提升 ${formatNumber(getPopulationCapacityGain(populationLevel))}。`,
        costText: this.buildUpgradeCostText('population', populationLevel),
        actionLabel: '升级兵力上限',
      },
      {
        id: 'watchtower',
        title: '防御',
        level: watchtowerLevel,
        description: `Lv.${watchtowerLevel} -> Lv.${watchtowerLevel + 1}，强化被掠夺时的基础防守表现。`,
        costText: this.buildUpgradeCostText('watchtower', watchtowerLevel),
        actionLabel: '升级防御',
      },
    ];

    return items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      costText: item.costText,
      locked: item.locked,
      action: {
        label: item.locked ? '查看条件' : item.actionLabel,
        target: 'building',
        tone: item.locked ? 'ghost' : 'secondary',
      },
    }));
  }

  private buildExtensions(readModel: SceneContentReadModel): ClientSceneContentResponse['building']['extensions'] {
    const buildings = readModel.buildings;
    const castleLevel = buildings?.castleLevel ?? readModel.player.castleLevelCache;
    const levels: Record<ExtensionKey, number> = {
      protectionTech: buildings?.protectionTechLevel ?? 0,
      farmYieldTech: buildings?.farmYieldTechLevel ?? 0,
      ripeWindowTech: buildings?.ripeWindowTechLevel ?? 0,
      pendingClaimTech: buildings?.pendingClaimTechLevel ?? 0,
    };

    return (Object.keys(levels) as ExtensionKey[]).map((trackId) => {
      const currentLevel = levels[trackId];
      const track = getCastleExtensionTrack(trackId);
      const nextConfig = getCastleExtensionLevelConfig(trackId, currentLevel + 1);
      const locked = !nextConfig || castleLevel < nextConfig.requiredCastleLevel;
      const title = track?.title ?? trackId;
      const effectUnit = getExtensionEffectUnit(trackId);

      return {
        id: trackId,
        title,
        levelText: nextConfig ? `Lv.${currentLevel} -> Lv.${currentLevel + 1}` : `Lv.${currentLevel}`,
        description: track?.description ?? '扩展能力等待配置。',
        effectText: nextConfig
          ? `当前 ${formatNumber(getCurrentExtensionEffect(trackId, currentLevel))}${effectUnit}，升级后 ${formatNumber(nextConfig.effectValue)}${effectUnit}。`
          : '已达到当前配置上限。',
        costText: nextConfig
          ? locked
            ? `需要主城 Lv.${nextConfig.requiredCastleLevel}`
            : `消耗 ${formatNumber(nextConfig.upgradeCost)} 金币`
          : '已满级',
        locked,
        action: {
          label: locked ? '查看条件' : '升级扩展',
          target: 'building',
          tone: locked ? 'ghost' : 'secondary',
        },
      };
    });
  }

  private buildArmy(readModel: SceneContentReadModel, now: Date): ClientSceneContentResponse['army'] {
    const activeQueue = readModel.trainingQueues.find((queue) => queue.status === 'QUEUED' && queue.finishAt.getTime() > now.getTime())
      ?? readModel.trainingQueues.find((queue) => queue.status === 'FINISHED')
      ?? null;

    return {
      unitCostGold: GAME_BALANCE.army.recruitGoldCostPerUnit,
      unitTrainingSeconds: GAME_BALANCE.army.recruitSecondsPerUnit,
      queue: activeQueue
        ? {
          queuedUnits: activeQueue.queuedCount,
          totalCost: activeQueue.totalCostGold,
          startedAt: activeQueue.startedAt.toISOString(),
          readyAt: activeQueue.finishAt.toISOString(),
          totalSeconds: Math.max(Math.ceil((activeQueue.finishAt.getTime() - activeQueue.startedAt.getTime()) / 1000), 1),
          remainingSeconds: Math.max(Math.ceil((activeQueue.finishAt.getTime() - now.getTime()) / 1000), 0),
        }
        : null,
    };
  }

  private buildFarmHero(readModel: SceneContentReadModel): ClientSceneContentResponse['farm']['hero'] {
    const unlocked = readModel.fieldSlots.filter((field) => field.isUnlocked);
    const mature = unlocked.filter((field) => field.status === 'MATURE').length;
    const growing = unlocked.filter((field) => field.status === 'SEEDED' || field.status === 'GROWING').length;
    const empty = unlocked.filter((field) => field.status === 'EMPTY').length;

    return {
      eyebrow: '田地经营',
      title: `成熟 ${mature} 块 · 培育中 ${growing} 块 · 空地 ${empty} 块`,
      description: `当前 ${unlocked.length}/${readModel.fieldSlots.length} 块田地已解锁，字段来自 player_field_slot 与 seed_definition。`,
      action: { label: empty > 0 ? '开始培育' : '查看田地', target: 'farm', tone: empty > 0 ? 'primary' : 'secondary' },
    };
  }

  private buildFarmField(field: SceneContentReadModel['fieldSlots'][number], now: Date): ClientFarmField {
    const copy = FIELD_STATUS_COPY[field.status];
    const timing = getFieldTiming(field, now);

    return {
      id: field.id,
      fieldVersion: field.statusVersion,
      code: `田地 ${String(field.slotIndex).padStart(2, '0')}`,
      title: copy.title,
      badge: copy.badge,
      cropName: field.seedDefinition?.label,
      tone: copy.tone,
      progressRemainingSeconds: timing.remainingSeconds,
      progressTotalSeconds: timing.totalSeconds,
      yieldGold: field.currentClaimableGold || field.seedDefinition?.baseYieldGold || 0,
      description: buildFieldDescription(field),
      actions: buildFieldActions(field.status),
    };
  }

  private buildFaction(readModel: SceneContentReadModel): ClientSceneContentResponse['faction'] {
    const currentFaction = readModel.player.faction;
    const contribution = readModel.player.factionMembers[0]?.contributionScore ?? 0;
    const dividend = getFactionDividendPerHour(contribution);

    return {
      hero: {
        eyebrow: currentFaction?.name ?? '未加入阵营',
        title: currentFaction ? `${currentFaction.name} · 个人贡献 ${formatNumber(contribution)}` : '暂未加入阵营',
        description: currentFaction
          ? `阵营金库 ${formatNumber(currentFaction.treasuryGold)}，阵营总贡献 ${formatNumber(currentFaction.contributionScore)}。`
          : '当前账号没有阵营关系，后续命令阶段再接入转换阵营。',
        advantage: currentFaction ? `当前每小时预计分红 ${formatNumber(dividend.total)} 金币` : '暂无阵营加成',
        breakdown: `基础 ${formatNumber(dividend.base)} + 贡献加成 ${formatNumber(dividend.bonus)}`,
        action: { label: '查看阵营', target: 'faction', tone: currentFaction ? 'secondary' : 'ghost' },
      },
      contribution: {
        title: '个人阵营贡献',
        value: formatNumber(contribution),
        description: `每 ${formatNumber(dividend.contributionStep)} 点贡献提高一档分红，当前第 ${formatNumber(dividend.contributionTier)} 档。`,
      },
      comparison: readModel.factions.map((faction) => ({
        faction: faction.name,
        advantage: `总贡献 ${formatNumber(faction.contributionScore)}`,
        gold: formatNumber(faction.treasuryGold),
        power: formatNumber(faction.contributionScore),
        isCurrent: faction.id === currentFaction?.id,
      })),
      donate: {
        title: '阵营上缴',
        description: '命令写链路尚未接入，本阶段仅展示真实阵营与贡献读模型。',
        goldStep: GAME_BALANCE.faction.donateGoldStep,
        contributionRule: `每上缴 ${formatNumber(GAME_BALANCE.faction.donateGoldStep)} 金币预计获得 ${formatNumber(GAME_BALANCE.faction.contributionPerDonateStep)} 贡献。`,
      },
      rankings: readModel.factions.map((faction, index) => ({
        label: `${index + 1}. ${faction.name}`,
        value: `${formatNumber(faction.contributionScore)} 贡献`,
        note: `${formatNumber(faction.treasuryGold)} 金库`,
      })),
    };
  }

  private buildUpgradeCostText(buildingId: BuildingKey, currentLevel: number): string {
    const cost = getBuildingUpgradeCost(buildingId, currentLevel);
    return typeof cost === 'number' ? `消耗 ${formatNumber(cost)} 金币` : '已达到当前配置上限';
  }
}

function getFieldTiming(field: SceneContentReadModel['fieldSlots'][number], now: Date): { totalSeconds: number; remainingSeconds: number } {
  if (!field.seedDefinition || field.status === 'EMPTY' || field.status === 'LOCKED') {
    return { totalSeconds: 1, remainingSeconds: 0 };
  }

  if (field.status === 'SEEDED') {
    return {
      totalSeconds: getSeedStageSeconds(field.seedDefinition.seedId, 'seeded'),
      remainingSeconds: getRemainingSeconds(
        field.matureAt ?? addSeconds(field.seedAt, getSeedStageSeconds(field.seedDefinition.seedId, 'seeded')),
        now,
      ),
    };
  }

  if (field.status === 'GROWING') {
    return {
      totalSeconds: getSeedStageSeconds(field.seedDefinition.seedId, 'growing'),
      remainingSeconds: getRemainingSeconds(
        field.fullMatureAt ?? addSeconds(field.matureAt, getSeedStageSeconds(field.seedDefinition.seedId, 'growing')),
        now,
      ),
    };
  }

  if (field.status === 'MATURE') {
    return {
      totalSeconds: Math.max(field.seedDefinition.ripeWindowSeconds, 1),
      remainingSeconds: getRemainingSeconds(
        field.overripeAt ?? addSeconds(field.fullMatureAt, field.seedDefinition.ripeWindowSeconds),
        now,
      ),
    };
  }

  return { totalSeconds: 1, remainingSeconds: 0 };
}

function getRemainingSeconds(target: Date | null, now: Date): number {
  if (!target) {
    return 0;
  }

  return Math.max(Math.ceil((target.getTime() - now.getTime()) / 1000), 0);
}

function addSeconds(source: Date | null, seconds: number): Date | null {
  if (!source) {
    return null;
  }

  return new Date(source.getTime() + Math.max(Math.floor(seconds), 0) * 1000);
}

function buildFieldDescription(field: SceneContentReadModel['fieldSlots'][number]): string {
  if (!field.isUnlocked) {
    return `主城 Lv.${field.unlockCastleLevel} 自动解锁。`;
  }

  if (field.status === 'EMPTY') {
    return '空地可在后续播种命令接入后开始培育。';
  }

  if (field.status === 'MATURE') {
    return `当前可收取 ${formatNumber(field.currentClaimableGold)} 金币。`;
  }

  if (field.status === 'WITHERED') {
    return `已枯萎，当前保底可收取 ${formatNumber(field.currentClaimableGold)} 金币。`;
  }

  return `${field.seedDefinition?.label ?? '作物'} 培育中，预计收益 ${formatNumber(field.currentClaimableGold || field.seedDefinition?.baseYieldGold || 0)} 金币。`;
}

function buildFieldActions(status: FieldStatus): ClientFarmField['actions'] {
  if (status === 'EMPTY') {
    return [{ label: '开始培育', target: 'farm', tone: 'primary' }];
  }

  if (status === 'MATURE' || status === 'WITHERED') {
    return [{ label: '收取', target: 'farm', tone: 'primary' }];
  }

  if (status === 'GROWING') {
    return [{ label: '提前收取', target: 'farm', tone: 'secondary' }];
  }

  return [];
}

function getCurrentExtensionEffect(trackId: ExtensionKey, currentLevel: number): number {
  if (currentLevel <= 0) {
    return 0;
  }

  return getCastleExtensionLevelConfig(trackId, currentLevel)?.effectValue ?? 0;
}

function getExtensionEffectUnit(trackId: ExtensionKey): string {
  if (trackId === 'farmYieldTech') {
    return '%';
  }

  if (trackId === 'pendingClaimTech') {
    return '小时';
  }

  return '分钟';
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(Math.floor(value), 0));
}
