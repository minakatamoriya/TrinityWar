import { Injectable } from '@nestjs/common';
import { APP_NAME, type ClientCodexState, type ClientFactionStipendReward, type ClientFarmField, type ClientPlantInventoryItem, type ClientRaidRewardItem, type ClientRaidSpiritPreview, type ClientSceneAction, type ClientSceneContentResponse, type ClientSceneVisibility } from '@trinitywar/shared';
import { STARTER_SPIRIT_IDS } from '../seed/seed-data/spirits.js';
import type { FieldStatus } from '@prisma/client';
import {
  GAME_BALANCE,
  getCastleExtensionLevelConfig,
  getCastleExtensionTrack,
  getFactionStipendTier,
  getLandDeedConfig,
  getPlantUnlockRequirement,
} from '../lib/game-balance.js';
import { getCurrentFactionAdvantageConfig, getFactionFarmCollectWindowSeconds, type FactionAdvantageCode } from '../lib/faction-advantage-formulas.js';
import {
  addSeconds,
  getCultivationSeconds,
  getFieldReadyAt,
  getMatureStartedAt,
} from '../lib/field-timing.js';
import { getLocalDateKey } from '../lib/date-key.js';
import type { SceneContentReadModel } from './client-read.repository.js';

type ExtensionKey = 'protectionTech' | 'farmYieldTech' | 'collectWindowTech' | 'factionOfferingTech';
type VisibleExtensionKey = Exclude<ExtensionKey, 'factionOfferingTech'>;

const FIELD_STATUS_COPY: Record<FieldStatus, { title: string; badge: string; tone: ClientFarmField['tone'] }> = {
  LOCKED: { title: '\u672a\u89e3\u9501', badge: '\u5f85\u89e3\u9501', tone: 'locked' },
  EMPTY: { title: '\u7a7a\u5730', badge: '\u53ef\u64ad\u79cd', tone: 'empty' },
  GROWING: { title: '\u57f9\u80b2\u4e2d', badge: '\u57f9\u80b2', tone: 'growing' },
  MATURE: { title: '\u6210\u719f\u671f', badge: '\u6210\u719f', tone: 'mature' },
  WITHERED: { title: '\u67af\u840e\u671f', badge: '\u67af\u840e', tone: 'withered' },
};

@Injectable()
export class SceneContentAssembler {
  assemble(readModel: SceneContentReadModel, codex: Array<{
    spiritDefinition: { spiritId: string };
    shardCount: number;
    readyToCompose: boolean;
    ownedCurrent: boolean;
    ownedEver: boolean;
  }> = [], now: Date = new Date()): ClientSceneContentResponse {
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
        advantage: this.buildFactionAdvantage(readModel, 'farm'),
        fields: readModel.fieldSlots.map((field) => this.buildFarmField(field, readModel, now)),
        plants: this.buildPlants(readModel),
        landDeeds: this.buildLandDeeds(readModel),
        guide: {
          title: '灵田经营',
          description: '灵田状态已从数据库读取，可通过培育和收取逐步扩大经营。',
          actions: [
            { label: '查看灵田', target: 'farm', tone: 'ghost' },
          ],
        },
      },
      raid: {
        hero: this.buildRaidHero(readModel),
        advantage: this.buildFactionAdvantage(readModel, 'raid'),
        daily: this.buildRaidDaily(readModel),
        targets: visibleRaidTargets,
        detail: {
          advice: visibleRaidTargets.length > 0
            ? '\u76ee\u6807\u6765\u81ea raid_target_pool\uff0c\u53ef\u6d88\u8017\u6218\u529b\u53d1\u8d77\u5f02\u6b65\u6218\u6597\u3002'
            : '\u5f53\u524d\u6ca1\u6709\u53ef\u7528\u76ee\u6807\u8bb0\u5f55\uff0c\u6267\u884c seed \u540e\u4f1a\u751f\u6210\u53ef\u63a0\u593a\u76ee\u6807\u3002',
          actions: [{ label: '\u5237\u65b0\u76ee\u6807', target: 'raid', tone: 'secondary' }],
        },
        messageTemplates: readModel.raidMessageTemplates,
      },
      report: {
        defense: this.buildReportEntries(readModel, 'DEFENSE'),
        attack: this.buildReportEntries(readModel, 'ATTACK'),
        actions: [
          { label: '\u7b49\u5f85\u6218\u62a5\u751f\u6210', target: 'report', tone: 'ghost' },
        ],
      },
      faction: this.buildFaction(readModel),
    };
  }

  private buildRaidDaily(readModel: SceneContentReadModel): NonNullable<ClientSceneContentResponse['raid']['daily']> {
    const dateKey = readModel.raidDailyState?.dateKey ?? getLocalDateKeyForAssembler();
    const baseAttemptLimit = Math.max(Math.floor(GAME_BALANCE.raid?.dailyAttemptLimit ?? 10), 0);
    const baseRefreshLimit = Math.max(Math.floor(GAME_BALANCE.raid?.freeRefreshesPerDay ?? 0), 0);
    const attemptLimit = baseAttemptLimit + Math.max(Math.floor(readModel.raidDailyState?.extraRaidAttemptsPurchased ?? 0), 0);
    const refreshLimit = baseRefreshLimit + Math.max(Math.floor(readModel.raidDailyState?.extraRefreshesPurchased ?? 0), 0);
    const attemptsUsed = Math.max(Math.floor(readModel.raidDailyState?.normalRaidAttemptsUsed ?? 0), 0);
    const refreshesUsed = Math.max(Math.floor(readModel.raidDailyState?.raidRefreshesUsed ?? 0), 0);

    return {
      dateKey,
      attemptLimit,
      attemptsUsed,
      attemptsRemaining: Math.max(attemptLimit - attemptsUsed, 0),
      refreshLimit,
      refreshesUsed,
      refreshesRemaining: Math.max(refreshLimit - refreshesUsed, 0),
    };
  }

  private buildRaidHero(readModel: SceneContentReadModel): ClientSceneContentResponse['raid']['hero'] {
    const availableCount = readModel.army?.availableCount ?? 0;
    const targetCount = this.buildRaidTargets(readModel).length;

    return {
      eyebrow: '\u4fa6\u5bdf\u76ee\u6807',
      title: targetCount > 0 ? `\u53ef\u51fa\u6218\u76ee\u6807 ${targetCount} \u4e2a` : '\u6682\u65e0\u53ef\u51fa\u6218\u76ee\u6807',
      description: `\u5f53\u524d\u53ef\u7528\u6218\u529b ${formatNumber(availableCount)}\uff0c\u524d 16 \u4e2a\u76ee\u6807\u4f1a\u5c55\u793a\u5728\u5f02\u6b65\u6218\u6597\u5217\u8868\u3002`,
      action: { label: targetCount > 0 ? '\u67e5\u770b\u76ee\u6807' : '\u7b49\u5f85\u76ee\u6807', target: 'raid', tone: targetCount > 0 ? 'primary' : 'ghost' },
    };
  }

  private buildRaidTargets(
    readModel: SceneContentReadModel,
    codex: Array<{
      spiritDefinition: { spiritId: string };
      shardCount: number;
      readyToCompose: boolean;
      ownedCurrent: boolean;
      ownedEver: boolean;
    }> = [],
    _now: Date = new Date(),
  ): ClientSceneContentResponse['raid']['targets'] {
    return readModel.raidTargetPools.map((targetPool) => {
      const snapshot = targetPool.targetSnapshotJson as {
        name?: string;
        faction?: string;
        level?: number;
        combatPower?: number;
        raidableGold?: number;
        risk?: string;
        detail?: string;
        tutorialTarget?: boolean;
      };

      const targetName = snapshot.name ?? targetPool.targetPlayer.nickname;
      const factionName = snapshot.faction ?? targetPool.targetPlayer.faction?.name ?? '\u672a\u77e5\u9635\u8425';
      const combatPower = snapshot.combatPower ?? targetPool.targetPlayer.army?.totalCount ?? 0;
      const mainSlot = targetPool.targetPlayer.spiritSlots[0] ?? null;
      let sceneVisibility: ClientSceneVisibility = 'masked';
      const spiritId = mainSlot?.spiritDefinition?.spiritId;
      if (spiritId) {
        const entry = codex.find(e => e.spiritDefinition?.spiritId === spiritId);
        sceneVisibility = resolveSpiritSceneVisibility(entry);
      }
      const mainPetPreview = buildRaidSpiritPreview(mainSlot, sceneVisibility);

      return {
        id: targetPool.id,
        targetPlayerId: targetPool.targetPlayer.id,
        name: targetName,
        faction: factionName,
        level: snapshot.level ?? targetPool.targetPlayer.castleLevelCache,
        tutorialTarget: snapshot.tutorialTarget === true,
        mainPetPreview,
        combatPower: formatNumber(combatPower),
        summary: mainPetPreview
          ? `${factionName} | ${mainPetPreview.label}`
          : `${factionName} Lv.${snapshot.level ?? targetPool.targetPlayer.castleLevelCache}`,
        loot: '系统奖励结算',
        risk: snapshot.risk ?? '\u5f02\u6b65\u6218\u6597',
        detail: snapshot.detail ?? `\u76ee\u6807\u6709\u6548\u671f\u81f3 ${targetPool.expiresAt.toISOString()}`,
        action: { label: '\u53d1\u8d77\u6218\u6597', target: 'raid', tone: 'primary' },
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
          ...(report.raidOrder.settlement?.battleReplayJson ? [{ label: '\u6218\u6597\u56de\u653e', target: 'report', tone: 'secondary', context: report.raidOrderId } satisfies ClientSceneAction] : []),
          ...(report.revengeAvailable
            ? [
              { label: '\u590d\u4ec7', target: 'report', tone: 'primary', context: report.opponentPlayerId } satisfies ClientSceneAction,
              { label: '\u67e5\u770b\u5bf9\u624b', target: 'report', tone: 'ghost', context: report.opponentPlayerId } satisfies ClientSceneAction,
            ]
            : [{ label: '\u67e5\u770b\u5bf9\u624b', target: 'report', tone: 'ghost', context: report.opponentPlayerId } satisfies ClientSceneAction]),
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
          rewards: normalizeRaidRewardItems(settlement?.rewardItemsJson),
          contributionGain: getContributionGainFromRewardItems(settlement?.rewardItemsJson),
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
    const levels: Record<VisibleExtensionKey, number> = {
      protectionTech: buildings?.protectionTechLevel ?? 0,
      farmYieldTech: buildings?.farmYieldTechLevel ?? 0,
      collectWindowTech: buildings?.collectWindowTechLevel ?? 0,
    };

    return (Object.keys(levels) as VisibleExtensionKey[]).map((trackId) => {
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
        description: track?.description ?? '\u6269\u5c55\u80fd\u529b\u7b49\u5f85\u914d\u7f6e\u3002',
        effectText: nextConfig
          ? `\u5f53\u524d ${formatNumber(getCurrentExtensionEffect(trackId, currentLevel))}${effectUnit}\uff0c\u4fee\u4e60\u540e ${formatNumber(nextConfig.effectValue)}${effectUnit}`
          : '\u5df2\u8fbe\u5230\u5f53\u524d\u7248\u672c\u4e0a\u9650\u3002',
        costText: nextConfig
          ? formatSpellCostText(nextConfig)
          : '\u5df2\u6ee1\u7ea7',
        locked,
        action: {
          label: locked ? '\u67e5\u770b' : '\u4fee\u4e60\u9886\u5730',
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
      advantage: this.buildFactionAdvantage(readModel, 'spirit'),
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
    const growing = unlocked.filter((field) => field.status === 'GROWING').length;
    const empty = unlocked.filter((field) => field.status === 'EMPTY').length;

    return {
      eyebrow: '\u7530\u5730\u7ecf\u8425',
      title: `\u6210\u719f ${mature} \u5757 | \u57f9\u80b2\u4e2d ${growing} \u5757 | \u7a7a\u5730 ${empty} \u5757`,
      description: `\u5f53\u524d ${unlocked.length}/${readModel.fieldSlots.length} \u5757\u7530\u5730\u5df2\u89e3\u9501\uff0c\u6210\u719f\u540e\u53ef\u76f4\u63a5\u6536\u53d6\u3002`,
      action: { label: empty > 0 ? '\u5f00\u59cb\u57f9\u80b2' : '\u67e5\u770b\u7530\u5730', target: 'farm', tone: empty > 0 ? 'primary' : 'secondary' },
    };
  }

  private buildFarmField(
    field: SceneContentReadModel['fieldSlots'][number],
    readModel: SceneContentReadModel,
    now: Date,
  ): ClientFarmField {
    const copy = FIELD_STATUS_COPY[field.status];
    const timing = getFieldTiming(field, readModel, now);
    const expectedEssenceYield = 0;
    const stolenEssenceYield = 0;
    const harvestableEssenceYield = 0;

    return {
      id: field.id,
      fieldVersion: field.statusVersion,
      code: `\u7530\u5730 ${String(field.slotIndex).padStart(2, '0')}`,
      title: copy.title,
      badge: copy.badge,
      cropName: field.seedDefinition?.label,
      tone: copy.tone,
      progressRemainingSeconds: timing.remainingSeconds,
      progressTotalSeconds: timing.totalSeconds,
      yieldGold: field.currentClaimableGold || field.seedDefinition?.baseYieldGold || 0,
      expectedEssenceYield,
      stolenEssenceYield,
      harvestableEssenceYield,
      essenceLabel: null,
      description: buildFieldDescription(field),
      actions: buildFieldActions(field.status),
    };
  }

  private buildPlants(readModel: SceneContentReadModel): ClientPlantInventoryItem[] {
    const contribution = readModel.player.factionMembers[0]?.contributionScore ?? 0;
    const harvestCount = readModel.plantUnlockMetrics.harvestCount;

    return readModel.seedInventory.filter((inventory) => inventory.seedDefinition.seedId !== 'qilingya').map((inventory) => {
      const requirement = getPlantUnlockRequirement(
        inventory.seedDefinition.seedId,
        inventory.seedDefinition.rarity,
        inventory.seedDefinition.sortOrder,
      );
      const baseUnlocked = requirement.harvestRequired <= 0 && requirement.contributionRequired <= 0;
      const unlocked = baseUnlocked || Boolean(inventory.unlockedAt);
      const discovered = unlocked || baseUnlocked || inventory.seedDefinition.plantResearch.length > 0;
      const essenceQuantity = Math.max(inventory.quantity, 0);
      const requirementsMet = harvestCount >= requirement.harvestRequired
        && contribution >= requirement.contributionRequired;
      const canUnlock = !unlocked
        && !baseUnlocked
        && requirementsMet;

      return {
        plantType: inventory.seedDefinition.seedId,
        essenceType: inventory.seedDefinition.seedId,
        plantName: inventory.seedDefinition.label,
        essenceLabel: null,
        rarity: mapSeedRarity(inventory.seedDefinition.rarity),
        unlocked,
        discovered,
        researchStatus: unlocked ? 'unlocked' : canUnlock ? 'ready' : discovered ? 'discovered' : 'undiscovered',
        unlockEssenceRequired: 0,
        unlockHarvestRequired: requirement.harvestRequired,
        unlockHarvestOwned: harvestCount,
        unlockContributionRequired: requirement.contributionRequired,
        unlockContributionOwned: contribution,
        canUnlock,
        essenceQuantity,
        growSeconds: inventory.seedDefinition.growSeconds,
        matureSeconds: inventory.seedDefinition.matureSeconds,
        expectedEssenceYield: 0,
      };
    });
  }

  private buildLandDeeds(readModel: SceneContentReadModel): NonNullable<ClientSceneContentResponse['farm']['landDeeds']> {
    return readModel.landDeedProgress.flatMap((progress) => {
      const config = getLandDeedConfig(progress.deedKey);
      if (!config) {
        return [];
      }

      const progressJson = normalizeLandDeedProgressJson(progress.progressJson);

      return [{
        deedKey: normalizeLandDeedKey(progress.deedKey),
        title: config.title,
        description: config.description,
        status: normalizeLandDeedStatus(progress.status),
        targetFieldSlotIndex: config.targetFieldSlotIndex,
        requirements: progressJson.requirements,
        alternativeRequirements: progressJson.alternativeRequirements,
        canClaim: progress.status === 'completed',
        claimedAt: progress.claimedAt?.toISOString() ?? null,
      }];
    });
  }

  private buildFaction(readModel: SceneContentReadModel): ClientSceneContentResponse['faction'] {
    const currentFaction = readModel.player.faction;
    const contribution = readModel.player.factionMembers[0]?.contributionScore ?? 0;
    const currentFactionTotalContribution = readModel.factions.find((faction) => faction.id === currentFaction?.id)?.contributionScore ?? currentFaction?.contributionScore ?? 0;
    const stipendTier = getFactionStipendTier(contribution);
    const stipendState = readModel.factionStipendStates[0] ?? null;
    const donateGoldStep = GAME_BALANCE.faction.donateGoldStep;
    const stipendRewards = toPublicFactionStipendRewards((stipendTier?.rewards ?? []) as ClientFactionStipendReward[])
      .filter((reward) => readModel.factionStipendClaimCount > 0 || reward.kind !== 'spirit-shard');
    const visibleStipendRewards = stipendState?.claimedAt
      ? normalizeFactionStipendRewards(stipendState.rewardJson) ?? stipendRewards
      : stipendRewards;
    const stipendRewardPrefix = stipendState?.claimedAt ? '\u4eca\u65e5\u5df2\u9886\u4ff8\u7984\uff1a' : '\u9884\u8ba1\u6bcf\u65e5\u4ff8\u7984\uff1a';
    const stipendRewardText = visibleStipendRewards.map((reward) => `${reward.label} x${formatNumber(reward.quantity)}`).join('\u3001') || '\u9635\u8425\u4ff8\u7984';

    return {
      hero: {
        eyebrow: currentFaction?.name ?? '\u672a\u52a0\u5165\u9635\u8425',
        title: currentFaction ? `${currentFaction.name} | \u4e2a\u4eba\u8d21\u732e ${formatNumber(contribution)}` : '\u5c1a\u672a\u52a0\u5165\u9635\u8425',
        description: currentFaction
          ? `\u9635\u8425\u603b\u8d21\u732e ${formatNumber(currentFactionTotalContribution)}`
          : '\u5f53\u524d\u8d26\u53f7\u6ca1\u6709\u9635\u8425\u5173\u7cfb\uff0c\u540e\u7eed\u9636\u6bb5\u518d\u5f00\u653e\u8f6c\u6295\u9635\u8425\u3002',
        advantage: currentFaction ? `\u9635\u8425\u4ff8\u7984\u6863\u4f4d\uff1a${stipendTier?.label ?? '\u9635\u8425\u4ff8\u7984'}` : '\u6682\u65e0\u9635\u8425\u4ff8\u7984',
        breakdown: `${stipendRewardPrefix}${stipendRewardText}`,
        action: { label: '\u67e5\u770b\u9635\u8425', target: 'faction', tone: currentFaction ? 'secondary' : 'ghost' },
      },
      contribution: {
        title: '\u4e2a\u4eba\u9635\u8425\u8d21\u732e',
        value: formatNumber(contribution),
        description: `\u8d21\u732e\u51b3\u5b9a\u6bcf\u65e5\u4ff8\u7984\u6863\u4f4d\uff0c\u4ff8\u7984\u4ee5\u690d\u7269\u7cbe\u534e\u3001\u7075\u5ba0\u8d44\u6e90\u548c\u9b42\u7c7b\u6750\u6599\u4e3a\u4e3b\u3002\u5f53\u524d\u6863\u4f4d\uff1a${stipendTier?.label ?? '\u9635\u8425\u4ff8\u7984'}\u3002`,
      },
      comparison: readModel.factions.map((faction) => ({
        faction: faction.name,
        advantage: `\u603b\u8d21\u732e ${formatNumber(faction.contributionScore)}`,
        totalContribution: formatNumber(faction.contributionScore),
        power: formatNumber(faction.contributionScore),
        isCurrent: faction.id === currentFaction?.id,
      })),
      donate: {
        title: '\u9635\u8425\u8d21\u732e',
        description: '\u8d21\u732e\u4e3b\u8981\u6765\u81ea\u79cd\u7530\u3001\u7075\u5ba0\u3001\u4e92\u52a9\u548c\u5bf9\u6218\u884c\u4e3a\u3002',
        goldStep: donateGoldStep,
        contributionRule: '\u8d21\u732e\u7531\u65e5\u5e38\u884c\u4e3a\u7d2f\u79ef\u3002',
      },
      tasks: [],
      contributionLogs: readModel.contributionLogs.map((log) => ({
        id: log.id,
        sourceType: log.sourceType,
        sourceLabel: getContributionSourceLabel(log.sourceType),
        contributionDelta: log.contributionDelta,
        createdAt: log.createdAt.toISOString(),
      })),
      stipend: currentFaction
        ? {
          title: '\u6bcf\u65e5\u9635\u8425\u4ff8\u7984',
          description: '\u6bcf\u65e5\u53ef\u6309\u5f53\u524d\u8d21\u732e\u6863\u4f4d\u9886\u53d6\u4e00\u6b21\uff0c\u4e3b\u8981\u5305\u542b\u690d\u7269\u7cbe\u534e\u3001\u7075\u5ba0\u8d44\u6e90\u548c\u9b42\u7c7b\u6750\u6599\u3002',
          status: stipendState?.claimedAt ? 'claimed' : 'available',
          dateKey: stipendState?.dateKey ?? getLocalDateKeyForAssembler(),
          contribution: stipendState?.contributionSnapshot ?? contribution,
          tierKey: stipendState?.tierKey ?? stipendTier?.tierKey ?? 'contribution-0',
          tierLabel: stipendTier?.label ?? '\u9635\u8425\u4ff8\u7984',
          rewards: visibleStipendRewards,
          claimedAt: stipendState?.claimedAt?.toISOString() ?? null,
          action: stipendState?.claimedAt ? null : { label: '\u9886\u53d6\u4ff8\u7984', target: 'faction', tone: 'primary' },
        }
        : undefined,
      rankings: readModel.factionRankings.map((ranking, index) => ({
        playerId: ranking.player.id,
        rank: index + 1,
        label: `${index + 1}. ${ranking.player.id === readModel.player.id ? '\u4f60' : ranking.player.nickname}`,
        value: `${formatNumber(ranking.contributionScore)} \u8d21\u732e`,
        note: `Lv.${formatNumber(ranking.player.castleLevelCache)}`,
        factionName: ranking.player.faction?.name ?? currentFaction?.name,
        contributionScore: ranking.contributionScore,
        castleLevel: ranking.player.castleLevelCache,
        isCurrentPlayer: ranking.player.id === readModel.player.id,
      })),
      spiritRankings: readModel.factionSpiritRankings
        .sort((left, right) => {
          const winRateDelta = computeSpiritWinRate(right) - computeSpiritWinRate(left);
          if (winRateDelta !== 0) {
            return winRateDelta;
          }

          const battleDelta = right.battleCount - left.battleCount;
          if (battleDelta !== 0) {
            return battleDelta;
          }

          return right.winCount - left.winCount;
        })
        .slice(0, 10)
        .map((item) => ({
          spiritId: item.spiritId,
          label: item.label,
          rarity: item.rarity,
          battleCount: item.battleCount,
          winCount: item.winCount,
          lossCount: item.lossCount,
          drawCount: item.drawCount,
          winRatePercent: computeSpiritWinRate(item),
        })),
    };
  }

  private buildFactionAdvantage(
    readModel: SceneContentReadModel,
    scene: 'farm' | 'spirit' | 'raid',
  ): ClientSceneContentResponse['farm']['advantage'] {
    const factionCode = readModel.player.factionCode;
    const config = getCurrentFactionAdvantageConfig((factionCode ?? null) as FactionAdvantageCode);

    if (!config) {
      return undefined;
    }

    if (factionCode === 'human' && scene === 'farm') {
      return {
        ...config,
        summary: config.summary,
      };
    }

    if (factionCode === 'immortal' && scene === 'spirit') {
      return {
        ...config,
        summary: config.summary,
      };
    }

    if (factionCode === 'demon' && scene === 'raid') {
      return {
        ...config,
        summary: config.summary,
      };
    }

    return undefined;
  }
}

function computeSpiritWinRate(input: {
  battleCount: number;
  winCount: number;
}): number {
  if (input.battleCount <= 0) {
    return 0;
  }

  return Math.round((input.winCount / input.battleCount) * 100);
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
      label: normalizeFactionStipendRewardLabel(item.label, item.kind),
      quantity: Math.max(Math.floor(item.quantity ?? 0), 0),
      seedId: item.seedId,
      essenceType: item.essenceType,
      spiritId: item.spiritId,
    }));
}

function toPublicFactionStipendRewards(rewards: ClientFactionStipendReward[]): ClientFactionStipendReward[] {
  return rewards
    .map((item) => ({
      kind: item.kind,
      label: normalizeFactionStipendRewardLabel(item.label, item.kind),
      quantity: Math.max(Math.floor(item.quantity), 0),
      seedId: item.seedId,
      essenceType: item.essenceType,
      spiritId: item.spiritId,
    }))
    .filter((item) => item.label.trim().length > 0 && item.quantity > 0);
}

function normalizeFactionStipendRewardLabel(label: string | undefined, kind: string | undefined): string {
  const trimmedLabel = label?.trim() ?? '';

  if (trimmedLabel.length > 0 && !/^[?？]+$/.test(trimmedLabel)) {
    return trimmedLabel;
  }

  return getFactionStipendRewardLabel(kind) ?? trimmedLabel;
}

function getFactionStipendRewardLabel(kind: string | undefined): string | null {
  if (kind === 'gold') {
    return '金币';
  }

  if (kind === 'ordinary-soul') {
    return '普通兽魂';
  }

  if (kind === 'rare-soul') {
    return '稀有兽魂';
  }

  if (kind === 'legendary-soul') {
    return '传说兽魂';
  }

  if (kind === 'spirit-shard') {
    return '灵宠精魄';
  }

  if (kind === 'seed') {
    return '种子';
  }

  if (kind === 'spirit-root') {
    return '灵根';
  }

  if (kind === 'spirit-marrow') {
    return '灵髓';
  }

  if (kind === 'spirit-jade') {
    return '灵玉';
  }

  return null;
}

function getContributionSourceLabel(sourceType: string): string {
  if (sourceType === 'faction-task-submit' || sourceType === 'essence-submit') {
    return '\u8d44\u6e90\u4e0a\u7f34';
  }

  if (sourceType === 'field-collect') {
    return '收取田地';
  }

  if (sourceType === 'field-start-cultivation') {
    return '开始种植';
  }

  if (sourceType === 'spirit-recover') {
    return '灵宠恢复';
  }

  if (sourceType === 'spirit-roll-traits') {
    return '灵宠洗点';
  }

  if (sourceType === 'social-water-field') {
    return '好友浇水';
  }

  if (sourceType === 'social-harvest-field') {
    return '好友摘取';
  }

  if (sourceType === 'social-revive-field') {
    return '好友复活';
  }

  if (sourceType === 'raid-battle') {
    return '参与对战';
  }

  if (sourceType === 'raid-win') {
    return '对战胜利';
  }

  if (sourceType === 'raid-success') {
    return '\u6218\u6597\u80dc\u5229';
  }

  if (sourceType === 'field-steal') {
    return '\u91c7\u6458\u6536\u76ca';
  }

  return '\u8d21\u732e\u8bb0\u5f55';
}

function getLocalDateKeyForAssembler(): string {
  return getLocalDateKey(new Date());
}

function getFieldTiming(
  field: SceneContentReadModel['fieldSlots'][number],
  readModel: SceneContentReadModel,
  now: Date,
): { totalSeconds: number; remainingSeconds: number } {
  if (!field.seedDefinition || field.status === 'EMPTY' || field.status === 'LOCKED') {
    return { totalSeconds: 1, remainingSeconds: 0 };
  }

  if (field.status === 'GROWING') {
    const factionCode = (readModel.player.factionCode ?? null) as FactionAdvantageCode;
    return {
      totalSeconds: getCultivationSeconds(field.seedDefinition.seedId, factionCode),
      remainingSeconds: getRemainingSeconds(
        field.readyAt ?? getFieldReadyAt(field, field.seedDefinition.seedId, now, factionCode),
        now,
      ),
    };
  }

  if (field.status === 'MATURE') {
    const matureWindowSeconds = getMatureWindowSeconds(field, readModel);

    return {
      totalSeconds: matureWindowSeconds,
      remainingSeconds: getRemainingSeconds(
        field.overripeAt ?? addSeconds(field.readyAt ?? getMatureStartedAt(field, now), matureWindowSeconds),
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

function buildFieldDescription(field: SceneContentReadModel['fieldSlots'][number]): string {
  if (!field.isUnlocked) {
    return '\u8fd9\u5757\u7530\u5730\u6682\u4e0d\u53ef\u7528\u3002';
  }

  if (field.status === 'EMPTY') {
    return '\u7a7a\u5730\u53ef\u64ad\u79cd\uff0c\u70b9\u51fb\u5f00\u59cb\u57f9\u80b2\u3002';
  }

  if (field.status === 'MATURE') {
    return '\u6210\u719f\u53ef\u6536\uff0c\u53ef\u83b7\u5f97\u91d1\u5e01\u548c\u57f9\u517b\u6750\u6599\u3002';
  }

  if (field.status === 'WITHERED') {
    return '\u5df2\u7ecf\u67af\u840e\uff0c\u4ecd\u53ef\u6536\u53d6\u90e8\u5206\u91d1\u5e01\u548c\u57f9\u517b\u6750\u6599\u3002';
  }

  return `${field.seedDefinition?.label ?? '\u4f5c\u7269'} \u57f9\u80b2\u4e2d\uff0c\u6210\u719f\u540e\u53ef\u6536\u83b7\u3002`;
}

function buildFieldActions(status: FieldStatus): ClientFarmField['actions'] {
  if (status === 'EMPTY') {
    return [{ label: '\u5f00\u59cb\u57f9\u80b2', target: 'farm', tone: 'primary' }];
  }

  if (status === 'MATURE' || status === 'WITHERED') {
    return [{ label: '\u6536\u53d6', target: 'farm', tone: 'primary' }];
  }

  return [];
}

function getMatureWindowSeconds(
  field: SceneContentReadModel['fieldSlots'][number],
  readModel: SceneContentReadModel,
): number {
  const techBonusSeconds = (getCastleExtensionLevelConfig(
    'collectWindowTech',
    readModel.buildings?.collectWindowTechLevel ?? 0,
  )?.effectValue ?? 0) * 60;

  return getFactionFarmCollectWindowSeconds(
    field.seedDefinition?.collectWindowSeconds ?? 30 * 60,
    techBonusSeconds,
    (readModel.player.factionCode ?? null) as FactionAdvantageCode,
  );
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
      label: typeof record.label === 'string' ? record.label : '\u4efb\u52a1',
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

  return '\u5206\u949f';
}

function formatSpellCostText(config: { costResource?: string; costAmount?: number; upgradeCost?: number }): string {
  const resource = config.costResource === 'tianjiTalisman' ? '\u5929\u673a\u7b26' : '\u91d1\u5e01';
  const amount = Math.max(Math.floor(config.costAmount ?? config.upgradeCost ?? 0), 0);
  return `\u6d88\u8017 ${formatNumber(amount)} ${resource}`;
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
  sceneVisibility: ClientSceneVisibility = 'masked',
): ClientRaidSpiritPreview | null {
  if (!slot?.spiritDefinition) {
    return null;
  }
  if (sceneVisibility === 'masked') {
    return {
      spiritId: null,
      sceneVisibility,
      displayName: '？？',
      label: '？？',
      level: Math.max(slot.level, 1),
      rarity: null,
      avatarGlyph: 'unknown',
    };
  }
  return {
    spiritId: slot.spiritDefinition.spiritId,
    sceneVisibility,
    displayName: slot.spiritDefinition.label,
    label: slot.spiritDefinition.label,
    level: Math.max(slot.level, 1),
    rarity: mapSpiritRarity(slot.spiritDefinition.rarity),
    avatarGlyph: getSpiritGlyph(slot.spiritDefinition.label),
  };
}

function resolveSpiritSceneVisibility(entry: {
  spiritDefinition: {
    spiritId: string;
  };
  hasSeen?: boolean;
  shardCount: number;
  readyToCompose: boolean;
  ownedCurrent: boolean;
  ownedEver: boolean;
} | undefined): ClientSceneVisibility {
  return resolveSpiritCodexState(entry) === 'hidden' ? 'masked' : 'named';
}

function resolveSpiritCodexState(entry: {
  spiritDefinition: {
    spiritId: string;
  };
  hasSeen?: boolean;
  shardCount: number;
  readyToCompose: boolean;
  ownedCurrent: boolean;
  ownedEver: boolean;
} | undefined): ClientCodexState {
  if (!entry) {
    return 'hidden';
  }

  if (entry.ownedCurrent || entry.ownedEver || entry.readyToCompose) {
    return 'unlocked';
  }

  if (entry.hasSeen && STARTER_SPIRIT_IDS.includes(entry.spiritDefinition.spiritId as typeof STARTER_SPIRIT_IDS[number])) {
    return 'visible-progress';
  }

  if (entry.shardCount > 0) {
    return 'visible-progress';
  }

  return 'hidden';
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

function mapSeedRarity(rarity: string): ClientPlantInventoryItem['rarity'] {
  if (rarity === 'rare') {
    return 'rare';
  }

  if (rarity === 'legendary') {
    return 'legendary';
  }

  return 'common';
}

function normalizeRaidRewardItems(value: unknown): ClientRaidRewardItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : null)
    .filter((item): item is Record<string, unknown> => Boolean(item && item.kind === 'essence' && typeof item.quantity === 'number'))
    .map((item): ClientRaidRewardItem => ({
      kind: 'essence',
      seedId: typeof item.seedId === 'string' ? item.seedId : typeof item.essenceType === 'string' ? item.essenceType : '',
      essenceType: typeof item.essenceType === 'string' ? item.essenceType : typeof item.seedId === 'string' ? item.seedId : undefined,
      label: typeof item.label === 'string' ? item.label : '\u5956\u52b1',
      quantity: Math.max(Math.floor(item.quantity as number), 0),
    }))
    .filter((item) => item.seedId.length > 0 && item.quantity > 0);
}

function getContributionGainFromRewardItems(value: unknown): number {
  if (!Array.isArray(value)) {
    return 0;
  }

  return value
    .map((item) => item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : null)
    .filter((item): item is Record<string, unknown> => Boolean(item && item.kind === 'contribution' && typeof item.quantity === 'number'))
    .reduce((sum, item) => sum + Math.max(Math.floor(item.quantity as number), 0), 0);
}

function getSpiritGlyph(label: string): string {
  const firstCharacter = Array.from(label.trim())[0];
  return firstCharacter ?? '?';
}
