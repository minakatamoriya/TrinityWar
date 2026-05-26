import { Injectable } from '@nestjs/common';
import { APP_NAME, type ClientFactionStipendReward, type ClientFarmField, type ClientRaidSpiritPreview, type ClientSceneAction, type ClientSceneContentResponse } from '@trinitywar/shared';
import type { FieldStatus } from '@prisma/client';
import {
  GAME_BALANCE,
  getCastleExtensionLevelConfig,
  getCastleExtensionTrack,
  getFactionStipendTier,
  getLandDeedConfig,
  getSeedStageSeconds,
} from '../lib/game-balance.js';
import type { SceneContentReadModel } from './client-read.repository.js';

type ExtensionKey = 'protectionTech' | 'farmYieldTech' | 'ripeWindowTech' | 'factionOfferingTech';

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
  assemble(readModel: SceneContentReadModel, codex: Array<{ spiritDefinition: { spiritId: string }, hasSeen: boolean }> = [], now: Date = new Date()): ClientSceneContentResponse {
    const visibleRaidTargets = this.buildRaidTargets(readModel, codex, now);

    return {
      app: APP_NAME,
      building: {
        upgrades: this.buildBuildingUpgrades(),
        extensions: this.buildExtensions(readModel),
      },
      army: this.buildArmy(readModel, now),
      farm: {
        hero: this.buildFarmHero(readModel),
        fields: readModel.fieldSlots.map((field) => this.buildFarmField(field, now)),
        landDeeds: this.buildLandDeeds(readModel),
        guide: {
          title: '农场经营',
          description: '田地状态已从数据库读取，后续将通过地契任务逐步开启更多田地。',
          actions: [
            { label: '打开法术阁', target: 'building', tone: 'secondary' },
            { label: '返回首页', target: 'home', tone: 'ghost' },
          ],
        },
      },
      raid: {
        hero: this.buildRaidHero(readModel),
        targets: visibleRaidTargets,
        detail: {
          advice: visibleRaidTargets.length > 0
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
    const targetCount = this.buildRaidTargets(readModel).length;

    return {
      eyebrow: '可掠夺目标',
      title: targetCount > 0 ? `可出征目标 ${targetCount} 个` : '暂无可出征目标',
      description: `当前可用战力 ${formatNumber(availableCount)}，第 16 步只创建订单并进入异步结算链路。`,
      action: { label: targetCount > 0 ? '查看目标' : '等待目标', target: 'raid', tone: targetCount > 0 ? 'primary' : 'ghost' },
    };
  }

  private buildRaidTargets(
    readModel: SceneContentReadModel,
    codex: Array<{ spiritDefinition: { spiritId: string }, hasSeen: boolean }> = [],
    now: Date = new Date(),
  ): ClientSceneContentResponse['raid']['targets'] {
    return readModel.raidTargetPools.filter((targetPool) => !targetPool.targetPlayer.protectedUntil || targetPool.targetPlayer.protectedUntil <= now).map((targetPool) => {
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
      const mainSlot = targetPool.targetPlayer.spiritSlots[0] ?? null;
      let hasSeen = false;
      const spiritId = mainSlot?.spiritDefinition?.spiritId;
      if (spiritId) {
        const entry = codex.find(e => e.spiritDefinition?.spiritId === spiritId);
        hasSeen = !!entry?.hasSeen;
      }
      const mainPetPreview = buildRaidSpiritPreview(mainSlot, hasSeen);

      return {
        id: targetPool.id,
        name: targetName,
        faction: factionName,
        level: snapshot.level ?? targetPool.targetPlayer.castleLevelCache,
        mainPetPreview,
        combatPower: formatNumber(combatPower),
        summary: mainPetPreview
          ? `${factionName} · ${mainPetPreview.label}`
          : `${factionName} Lv.${snapshot.level ?? targetPool.targetPlayer.castleLevelCache}`,
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
      .map((report) => {
        const settlement = report.raidOrder.settlement;
        const ownDamage = report.reportType === 'ATTACK'
          ? settlement?.attackerLoss
          : settlement?.defenderLoss;
        const opponentDamage = report.reportType === 'ATTACK'
          ? settlement?.defenderLoss
          : settlement?.attackerLoss;

        const actions: ClientSceneAction[] = [
          ...(report.raidOrder.settlement?.battleReplayJson ? [{ label: '战斗回放', target: 'report', tone: 'secondary', context: report.raidOrderId } satisfies ClientSceneAction] : []),
          ...(report.revengeAvailable
            ? [
              { label: '复仇', target: 'report', tone: 'primary', context: report.opponentPlayerId } satisfies ClientSceneAction,
              { label: '查看详情', target: 'report', tone: 'ghost', context: report.opponentPlayerId } satisfies ClientSceneAction,
            ]
            : [{ label: '查看详情', target: 'report', tone: 'ghost', context: report.opponentPlayerId } satisfies ClientSceneAction]),
        ];

        return {
          orderId: report.raidOrderId,
          title: report.title,
          tag: report.title,
          tone: report.result === 'WIN' ? 'success' : report.result === 'LOSS' ? 'danger' : 'neutral',
          summary: report.summary,
          createdAt: report.createdAt.toISOString(),
          occurredAtText: formatDateTime(report.createdAt),
          opponentName: report.opponentPlayer.nickname,
          metrics: settlement
            ? {
              gold: formatNumber(settlement.lootGold),
              ownDamage: `${formatNumber(ownDamage ?? 0)}%`,
              opponentDamage: `${formatNumber(opponentDamage ?? 0)}%`,
            }
            : undefined,
          revengeable: report.revengeAvailable,
          raidMessage: report.raidOrder.raidMessage && !report.raidOrder.raidMessage.isHidden
            ? {
              messageTemplateId: report.raidOrder.raidMessage.templateId,
              messageEmojiId: null,
              messageTextSnapshot: report.raidOrder.raidMessage.textSnapshot,
            }
            : null,
          battleReplayAvailable: Boolean(report.raidOrder.settlement?.battleReplayJson),
          actions,
        };
      });
  }

  private buildBuildingUpgrades(): ClientSceneContentResponse['building']['upgrades'] {
    return [];
  }

  private buildExtensions(readModel: SceneContentReadModel): ClientSceneContentResponse['building']['extensions'] {
    const buildings = readModel.buildings;
    const levels: Record<ExtensionKey, number> = {
      protectionTech: buildings?.protectionTechLevel ?? 0,
      farmYieldTech: buildings?.farmYieldTechLevel ?? 0,
      ripeWindowTech: buildings?.ripeWindowTechLevel ?? 0,
      factionOfferingTech: buildings?.pendingClaimTechLevel ?? 0,
    };

    return (Object.keys(levels) as ExtensionKey[]).map((trackId) => {
      const currentLevel = levels[trackId];
      const track = getCastleExtensionTrack(trackId);
      const expectedNextLevel = currentLevel + 1;
      const rawNextConfig = getCastleExtensionLevelConfig(trackId, expectedNextLevel);
      const nextConfig = rawNextConfig?.level === expectedNextLevel ? rawNextConfig : null;
      const locked = !nextConfig;
      const title = track?.title ?? trackId;
      const effectUnit = getExtensionEffectUnit(trackId);

      return {
        id: trackId,
        title,
        levelText: nextConfig ? `Lv.${currentLevel} -> Lv.${currentLevel + 1}` : `Lv.${currentLevel}`,
        description: track?.description ?? '扩展能力等待配置。',
        effectText: nextConfig
          ? `当前 ${formatNumber(getCurrentExtensionEffect(trackId, currentLevel))}${effectUnit}，修习后 ${formatNumber(nextConfig.effectValue)}${effectUnit}。`
          : '已达到当前配置上限。',
        costText: nextConfig
          ? formatSpellCostText(nextConfig)
          : '已满级',
        locked,
        action: {
          label: locked ? '查看' : '修习法术',
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
      description: `当前 ${unlocked.length}/${readModel.fieldSlots.length} 块田地已解锁，后续田地通过地契任务开启。`,
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

  private buildLandDeeds(readModel: SceneContentReadModel): NonNullable<ClientSceneContentResponse['farm']['landDeeds']> {
    return readModel.landDeedProgress.map((progress) => {
      const config = getLandDeedConfig(progress.deedKey);
      const progressJson = normalizeLandDeedProgressJson(progress.progressJson);

      return {
        deedKey: normalizeLandDeedKey(progress.deedKey),
        title: config?.title ?? progress.deedKey,
        description: config?.description ?? '完成地契任务后开启新田地。',
        status: normalizeLandDeedStatus(progress.status),
        targetFieldSlotIndex: config?.targetFieldSlotIndex ?? 0,
        requirements: progressJson.requirements,
        alternativeRequirements: progressJson.alternativeRequirements,
        canClaim: progress.status === 'completed',
        claimedAt: progress.claimedAt?.toISOString() ?? null,
      };
    });
  }

  private buildFaction(readModel: SceneContentReadModel): ClientSceneContentResponse['faction'] {
    const currentFaction = readModel.player.faction;
    const contribution = readModel.player.factionMembers[0]?.contributionScore ?? 0;
    const stipendTier = getFactionStipendTier(contribution);
    const stipendState = readModel.factionStipendStates[0] ?? null;
    const donateGoldStep = GAME_BALANCE.faction.donateGoldStep;
    const contributionPerDonateStep = GAME_BALANCE.faction.contributionPerDonateStep;
    const contributionBonusPercent = getCurrentExtensionEffect('factionOfferingTech', readModel.buildings?.pendingClaimTechLevel ?? 0);
    const stipendRewards = toPublicFactionStipendRewards((stipendTier?.rewards ?? []) as ClientFactionStipendReward[]);
    const visibleStipendRewards = stipendState?.claimedAt
      ? normalizeFactionStipendRewards(stipendState.rewardJson) ?? stipendRewards
      : readModel.factionStipendClaimCount <= 0
        ? buildFirstFactionStipendPreview(stipendRewards)
        : stipendRewards;
    const stipendRewardText = visibleStipendRewards.map((reward) => `${reward.label} x${formatNumber(reward.quantity)}`).join('、') || '暂无俸禄';

    return {
      hero: {
        eyebrow: currentFaction?.name ?? '未加入阵营',
        title: currentFaction ? `${currentFaction.name} · 个人贡献 ${formatNumber(contribution)}` : '暂未加入阵营',
        description: currentFaction
          ? `阵营金库 ${formatNumber(currentFaction.treasuryGold)}，阵营总贡献 ${formatNumber(currentFaction.contributionScore)}。`
          : '当前账号没有阵营关系，后续命令阶段再接入转换阵营。',
        advantage: currentFaction ? `今日俸禄档位：${stipendTier?.label ?? '基础俸禄'}` : '暂无阵营俸禄',
        breakdown: `预计每日俸禄：${stipendRewardText}`,
        action: { label: '查看阵营', target: 'faction', tone: currentFaction ? 'secondary' : 'ghost' },
      },
      contribution: {
        title: '个人阵营贡献',
        value: formatNumber(contribution),
        description: `贡献用于提升每日俸禄档位，俸禄以种子和分档兽魂等材料为主。当前档位：${stipendTier?.label ?? '基础俸禄'}。`,
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
        description: `上缴金币可增加个人贡献，贡献会提升每日俸禄档位。当前规则：每 ${formatNumber(donateGoldStep)} 金币 = ${formatNumber(contributionPerDonateStep)} 基础贡献。`,
        goldStep: donateGoldStep,
        contributionRule: contributionBonusPercent > 0
          ? `每上缴 ${formatNumber(donateGoldStep)} 金币获得 ${formatNumber(contributionPerDonateStep)} 基础贡献；同心诀当前 +${formatNumber(contributionBonusPercent)}%。`
          : `每上缴 ${formatNumber(donateGoldStep)} 金币获得 ${formatNumber(contributionPerDonateStep)} 贡献；贡献越高，每日俸禄材料越好。`,
      },
      stipend: currentFaction
        ? {
          title: '每日阵营俸禄',
          description: '每日可按当前贡献档位领取一次，材料为主、少量金币为辅。',
          status: stipendState?.claimedAt ? 'claimed' : 'available',
          dateKey: stipendState?.dateKey ?? getLocalDateKeyForAssembler(),
          contribution: stipendState?.contributionSnapshot ?? contribution,
          tierKey: stipendState?.tierKey ?? stipendTier?.tierKey ?? 'contribution-0',
          tierLabel: stipendTier?.label ?? '基础俸禄',
          rewards: visibleStipendRewards,
          claimedAt: stipendState?.claimedAt?.toISOString() ?? null,
          action: stipendState?.claimedAt ? null : { label: '领取俸禄', target: 'faction', tone: 'primary' },
        }
        : undefined,
      rankings: readModel.factions.map((faction, index) => ({
        label: `${index + 1}. ${faction.name}`,
        value: `${formatNumber(faction.contributionScore)} 贡献`,
        note: `${formatNumber(faction.treasuryGold)} 金库`,
      })),
    };
  }
}

function normalizeFactionStipendRewards(value: unknown): ClientFactionStipendReward[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .map((item) => item && typeof item === 'object' && !Array.isArray(item) ? item as Partial<ClientFactionStipendReward> : null)
    .filter((item): item is Partial<ClientFactionStipendReward> => Boolean(item && typeof item.kind === 'string' && typeof item.label === 'string' && typeof item.quantity === 'number'))
    .map((item) => ({
      kind: item.kind as ClientFactionStipendReward['kind'],
      label: item.label ?? '',
      quantity: Math.max(Math.floor(item.quantity ?? 0), 0),
      seedId: item.seedId,
    }));
}

function toPublicFactionStipendRewards(rewards: ClientFactionStipendReward[]): ClientFactionStipendReward[] {
  return rewards
    .map((item) => ({
      kind: item.kind,
      label: item.label,
      quantity: Math.max(Math.floor(item.quantity), 0),
      seedId: item.seedId,
    }))
    .filter((item) => item.label.trim().length > 0 && item.quantity > 0);
}

function buildFirstFactionStipendPreview(rewards: ClientFactionStipendReward[]): ClientFactionStipendReward[] {
  return [
    ...rewards.filter((reward) => reward.kind !== 'seed'),
    { kind: 'seed', seedId: 'qinglingmai', label: '青灵麦', quantity: 1 },
    { kind: 'seed', seedId: 'xunyamai', label: '风云稻', quantity: 1 },
  ];
}

function getLocalDateKeyForAssembler(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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
    return '完成对应地契任务后自动解锁。';
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

function normalizeLandDeedProgressJson(value: unknown): {
  requirements: NonNullable<ClientSceneContentResponse['farm']['landDeeds']>[number]['requirements'];
  alternativeRequirements: NonNullable<ClientSceneContentResponse['farm']['landDeeds']>[number]['alternativeRequirements'];
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { requirements: [], alternativeRequirements: [] };
  }

  const record = value as {
    requirements?: unknown;
    alternativeRequirements?: unknown;
  };

  return {
    requirements: normalizeRequirementProgressList(record.requirements),
    alternativeRequirements: normalizeRequirementProgressList(record.alternativeRequirements),
  };
}

function normalizeRequirementProgressList(value: unknown): NonNullable<ClientSceneContentResponse['farm']['landDeeds']>[number]['requirements'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    const record = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {};
    const current = typeof record.current === 'number' ? record.current : 0;
    const target = typeof record.target === 'number' ? record.target : 0;

    return {
      key: typeof record.key === 'string' ? record.key : 'unknown',
      label: typeof record.label === 'string' ? record.label : '进度',
      current,
      target,
      completed: typeof record.completed === 'boolean' ? record.completed : current >= target,
    };
  });
}

function normalizeLandDeedKey(value: string): NonNullable<ClientSceneContentResponse['farm']['landDeeds']>[number]['deedKey'] {
  if (value === 'field-2' || value === 'field-3' || value === 'field-4') {
    return value;
  }

  return 'field-2';
}

function normalizeLandDeedStatus(value: string): NonNullable<ClientSceneContentResponse['farm']['landDeeds']>[number]['status'] {
  if (value === 'locked' || value === 'in-progress' || value === 'completed' || value === 'claimed') {
    return value;
  }

  if (value === 'in_progress') {
    return 'in-progress';
  }

  return 'in-progress';
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

  if (trackId === 'factionOfferingTech') {
    return '%';
  }

  return '分钟';
}

function formatSpellCostText(config: { costResource?: string; costAmount?: number; upgradeCost?: number }): string {
  const resource = config.costResource === 'tianjiTalisman' ? '天机符' : '金币';
  const amount = Math.max(Math.floor(config.costAmount ?? config.upgradeCost ?? 0), 0);
  return `消耗 ${formatNumber(amount)} ${resource}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(Math.floor(value), 0));
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(value);
}

function buildRaidSpiritPreview(
  slot: { level: number; spiritDefinition: { spiritId: string; label: string; rarity: string } | null } | null,
  hasSeen: boolean = false,
): ClientRaidSpiritPreview | null {
  if (!slot?.spiritDefinition) {
    return null;
  }
  if (!hasSeen) {
    return {
      spiritId: null,
      label: '？？',
      level: Math.max(slot.level, 1),
      rarity: null,
      avatarGlyph: 'unknown',
    };
  }
  return {
    spiritId: slot.spiritDefinition.spiritId,
    label: slot.spiritDefinition.label,
    level: Math.max(slot.level, 1),
    rarity: mapSpiritRarity(slot.spiritDefinition.rarity),
    avatarGlyph: getSpiritGlyph(slot.spiritDefinition.label),
  };
}

function mapSpiritRarity(rarity: string): ClientRaidSpiritPreview['rarity'] {
  if (rarity === 'RARE') {
    return 'rare';
  }

  if (rarity === 'LEGENDARY') {
    return 'legendary';
  }

  if (rarity === 'COMMON') {
    return 'common';
  }

  return null;
}

function getSpiritGlyph(label: string): string {
  const firstCharacter = Array.from(label.trim())[0];
  return firstCharacter ?? '灵';
}
