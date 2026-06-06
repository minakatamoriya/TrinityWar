import { Inject, Injectable } from '@nestjs/common';
import type {
  AdminRobotDashboardResponse,
  ClientFactionStipendReward,
  ClientRaidRewardItem,
  ClientSpiritBreakthroughRequirement,
  ClientSpiritState,
} from '@trinitywar/shared';
import type { Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service.js';
import { ClientCommandService } from '../client-command/client-command.service.js';
import { BusinessError } from '../common/errors/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RaidTargetService } from '../raid/raid-target.service.js';
import { SpiritService } from '../spirit/spirit.service.js';

type RobotRole = 'farmer' | 'spirit' | 'raid' | 'daily';
type RobotActionStatus = 'SUCCESS' | 'FAILED' | 'BLOCKED';
type FactionCode = 'human' | 'immortal' | 'demon';

interface RobotSpec {
  robotKey: string;
  role: RobotRole;
  nickname: string;
  factionCode: FactionCode;
}

interface RobotActionResult {
  actionName: string;
  resultSummary: Record<string, unknown>;
}

const ROBOT_SPECS: RobotSpec[] = [
  { robotKey: 'robot-farmer-001', role: 'farmer', nickname: '机器人农夫01', factionCode: 'human' },
  { robotKey: 'robot-spirit-001', role: 'spirit', nickname: '机器人灵宠01', factionCode: 'immortal' },
  { robotKey: 'robot-raid-001', role: 'raid', nickname: '机器人掠夺01', factionCode: 'demon' },
];

const DAILY_ROBOT_SPECS: RobotSpec[] = [
  { robotKey: 'robot-human-001', role: 'daily', nickname: '人界日常机器人001', factionCode: 'human' },
  { robotKey: 'robot-immortal-001', role: 'daily', nickname: '仙界日常机器人001', factionCode: 'immortal' },
  { robotKey: 'robot-demon-001', role: 'daily', nickname: '魔界日常机器人001', factionCode: 'demon' },
];

const ROBOT_RAID_TARGET_KEY = 'robot-raid-target-001';
const ROBOT_SEED_ID = 'qinglingmai';
const ROBOT_STARTER_SPIRIT_ID = 'linglu';

@Injectable()
export class RobotService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ClientCommandService) private readonly clientCommandService: ClientCommandService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RaidTargetService) private readonly raidTargetService: RaidTargetService,
    @Inject(SpiritService) private readonly spiritService: SpiritService,
  ) {}

  async runSmoke(): Promise<Record<string, unknown>> {
    const run = await this.prisma.db.robotTestRun.create({
      data: {
        name: '轻量机器人日常 smoke',
        mode: 'smoke',
        plannedRobotCount: ROBOT_SPECS.length,
      },
    });

    let successCount = 0;
    let failedCount = 0;

    for (const spec of ROBOT_SPECS) {
      const login = await this.authService.devLogin({
        providerUserId: spec.robotKey,
        nickname: spec.nickname,
        factionCode: spec.factionCode,
      });
      await this.prepareRobotPlayer(spec, login.player.id);

      const status = await this.runLoggedStep(run.id, spec, login.player.id, spec.role, async () => this.runRobotAction(spec, login.player.id));
      if (status === 'SUCCESS') successCount += 1;
      if (status !== 'SUCCESS') failedCount += 1;
    }

    const finishedRun = await this.prisma.db.robotTestRun.update({
      where: { id: run.id },
      data: {
        status: failedCount > 0 ? 'FAILED' : 'SUCCESS',
        successActionCount: successCount,
        failedActionCount: failedCount,
        summary: `完成 ${successCount} 个动作，失败 ${failedCount} 个动作。`,
        finishedAt: new Date(),
      },
    });

    return this.buildRunResult(run.id, finishedRun.status, successCount, failedCount, 0);
  }

  async runDaily3(): Promise<Record<string, unknown>> {
    const run = await this.prisma.db.robotTestRun.create({
      data: {
        name: '3 阵营日常循环',
        mode: 'daily-3',
        plannedRobotCount: DAILY_ROBOT_SPECS.length,
      },
    });

    const players: Array<{ spec: RobotSpec; playerId: string; sources: string[] }> = [];
    for (const spec of DAILY_ROBOT_SPECS) {
      const login = await this.authService.devLogin({
        providerUserId: spec.robotKey,
        nickname: spec.nickname,
        factionCode: spec.factionCode,
      });
      await this.prepareDailyRobotPlayer(spec, login.player.id);
      players.push({ spec, playerId: login.player.id, sources: [] });
    }

    let successCount = 0;
    let failedCount = 0;
    let blockedCount = 0;
    const countStatus = (status: RobotActionStatus): void => {
      if (status === 'SUCCESS') successCount += 1;
      if (status === 'FAILED') failedCount += 1;
      if (status === 'BLOCKED') blockedCount += 1;
    };

    for (const player of players) {
      countStatus(await this.runLoggedStep(run.id, player.spec, player.playerId, 'collect-field', async () => this.runFarmer(player.playerId)));
      countStatus(await this.runLoggedStep(run.id, player.spec, player.playerId, 'claim-faction-stipend', async () => {
        const result = await this.claimFactionStipendForRobot(player.playerId);
        player.sources.push(result.sourceSummary);
        return result;
      }));
    }

    for (let index = 0; index < players.length; index += 1) {
      const attacker = players[index];
      const defender = players[(index + 1) % players.length];
      countStatus(await this.runLoggedStep(run.id, attacker.spec, attacker.playerId, 'raid-target', async () => {
        const result = await this.runRaidAgainst(attacker.playerId, defender.playerId);
        attacker.sources.push(result.sourceSummary);
        return result;
      }));
    }

    for (const player of players) {
      countStatus(await this.runLoggedStep(run.id, player.spec, player.playerId, 'spirit-growth', async () => (
        this.runDailySpiritGrowth(player.playerId, player.sources)
      )));
    }

    const finalStatus = failedCount > 0 ? 'FAILED' : blockedCount > 0 ? 'ISSUE' : 'SUCCESS';
    const finishedRun = await this.prisma.db.robotTestRun.update({
      where: { id: run.id },
      data: {
        status: finalStatus,
        successActionCount: successCount,
        failedActionCount: failedCount + blockedCount,
        summary: `完成 ${successCount} 个动作，硬错误 ${failedCount} 个，成长卡点 ${blockedCount} 个。`,
        finishedAt: new Date(),
      },
    });

    return this.buildRunResult(run.id, finishedRun.status, successCount, failedCount, blockedCount);
  }

  async getDashboard(): Promise<AdminRobotDashboardResponse> {
    const issueStatuses = ['FAILED', 'BLOCKED'];
    const [runs, robotPlayers, logs, errors, errorGroups] = await Promise.all([
      this.prisma.db.robotTestRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 10,
      }),
      this.prisma.db.playerAuthIdentity.findMany({
        where: {
          provider: 'DEV_FAKE',
          providerUserId: { startsWith: 'robot-' },
        },
        orderBy: { providerUserId: 'asc' },
        select: {
          providerUserId: true,
          player: {
            select: {
              id: true,
              nickname: true,
              lastLoginAt: true,
              faction: { select: { code: true, name: true } },
              wallet: { select: { vaultGold: true } },
              army: { select: { availableCount: true, frozenCount: true } },
            },
          },
        },
      }),
      this.prisma.db.robotActionLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.db.robotActionLog.findMany({
        where: { status: { in: issueStatuses } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.db.robotActionLog.groupBy({
        by: ['status', 'robotRole', 'actionName', 'errorCode', 'errorMessage'],
        where: { status: { in: issueStatuses } },
        _count: { _all: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
        orderBy: { _count: { id: 'desc' } },
      }),
    ]);

    const errorSummary = errorGroups.map((item) => {
      const issueType = resolveIssueType({
        status: item.status,
        robotRole: item.robotRole,
        actionName: item.actionName,
        errorCode: item.errorCode,
        errorMessage: item.errorMessage,
      });

      return {
        issueType,
        severity: resolveIssueSeverity(issueType),
        robotRole: item.robotRole,
        actionName: item.actionName,
        errorCode: item.errorCode,
        errorMessage: item.errorMessage,
        count: item._count._all,
        firstSeenAt: item._min.createdAt?.toISOString() ?? null,
        lastSeenAt: item._max.createdAt?.toISOString() ?? null,
        suggestion: buildIssueSuggestion(issueType, item.errorMessage),
      };
    });
    const latestRun = runs[0] ?? null;
    const progressionBlockCount = errorSummary
      .filter((item) => item.issueType === 'progression_block')
      .reduce((sum, item) => sum + Number(item.count ?? 0), 0);
    const hardIssueCount = errorSummary
      .filter((item) => item.issueType !== 'progression_block')
      .reduce((sum, item) => sum + Number(item.count ?? 0), 0);
    const displayState = hardIssueCount > 0
      ? 'FAILED'
      : progressionBlockCount > 0
        ? 'ISSUE'
        : latestRun?.status ?? 'IDLE';

    return {
      rule: {
        name: '3 阵营日常循环',
        robots: '人界 1 / 仙界 1 / 魔界 1',
        actions: '收菜 -> 领俸禄 -> 环形掠夺 -> 购买升级兽魂 / 升级 / 突破判断',
        raidRelation: '人界 -> 仙界 -> 魔界 -> 人界',
        maturityPolicy: '测试准备层每轮放置 1 块成熟田；收菜仍走真实业务 service。',
        resourcePolicy: '升级兽魂可用金币购买；突破材料只来自俸禄和掠夺，不足记录为成长卡点。',
      },
      status: {
        state: displayState,
        rawState: latestRun?.status ?? 'IDLE',
        latestRunId: latestRun?.id ?? null,
        latestRunAt: latestRun?.startedAt.toISOString() ?? null,
        successActionCount: latestRun?.successActionCount ?? 0,
        failedActionCount: latestRun?.failedActionCount ?? 0,
        totalIssueGroups: errorSummary.length,
        totalIssueCount: errorSummary.reduce((sum, item) => sum + Number(item.count ?? 0), 0),
        progressionBlockCount,
        hardIssueCount,
        totalErrorGroups: errorSummary.length,
        totalErrorCount: hardIssueCount,
      },
      runs: {
        items: runs.map(mapRun),
      },
      robots: {
        items: robotPlayers.map((item) => ({
          robotKey: item.providerUserId,
          playerId: item.player.id,
          nickname: item.player.nickname,
          factionCode: item.player.faction?.code ?? null,
          factionName: item.player.faction?.name ?? null,
          vaultGold: item.player.wallet?.vaultGold ?? null,
          availableArmy: item.player.army?.availableCount ?? null,
          frozenArmy: item.player.army?.frozenCount ?? null,
          lastLoginAt: item.player.lastLoginAt?.toISOString() ?? null,
        })),
      },
      recentActions: {
        items: logs.map(mapActionLog),
      },
      recentErrors: {
        items: errors.map(mapActionLog),
      },
      errorSummary: {
        items: errorSummary,
        exportMarkdown: buildIssueExportMarkdown(errorSummary, latestRun ? mapRun(latestRun) : null),
      },
    };
  }

  async clearErrors(): Promise<Record<string, unknown>> {
    const deleted = await this.prisma.db.robotActionLog.deleteMany({
      where: { status: { in: ['FAILED', 'BLOCKED'] } },
    });
    await this.prisma.db.robotTestRun.updateMany({
      where: { status: { in: ['FAILED', 'ISSUE'] } },
      data: {
        summary: '历史问题已清空，仅保留成功动作日志。',
      },
    });

    return {
      ok: true,
      deletedErrorLogs: deleted.count,
    };
  }

  private async runLoggedStep(
    runId: string,
    spec: RobotSpec,
    playerId: string,
    actionName: string,
    action: () => Promise<RobotActionResult>,
  ): Promise<RobotActionStatus> {
    const startedAt = Date.now();
    try {
      const result = await action();
      await this.createActionLog({
        runId,
        spec,
        playerId,
        actionName: result.actionName || actionName,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        resultSummaryJson: result.resultSummary,
      });
      return 'SUCCESS';
    } catch (error) {
      const blocked = error instanceof RobotProgressionBlockError;
      await this.createActionLog({
        runId,
        spec,
        playerId,
        actionName,
        status: blocked ? 'BLOCKED' : 'FAILED',
        durationMs: Date.now() - startedAt,
        errorCode: blocked ? 'PROGRESSION_BLOCK' : resolveErrorCode(error),
        errorMessage: resolveErrorMessage(error),
        resultSummaryJson: blocked ? error.details : undefined,
      });
      return blocked ? 'BLOCKED' : 'FAILED';
    }
  }

  private async runRobotAction(spec: RobotSpec, playerId: string): Promise<RobotActionResult> {
    if (spec.role === 'farmer') {
      return this.runFarmer(playerId);
    }
    if (spec.role === 'spirit') {
      return this.runSpirit(playerId);
    }
    return this.runRaid(playerId);
  }

  private async runFarmer(playerId: string): Promise<RobotActionResult> {
    const matureField = await this.prisma.db.playerFieldSlot.findFirst({
      where: { playerId, status: 'MATURE' },
      orderBy: { slotIndex: 'asc' },
      select: { id: true, statusVersion: true, currentClaimableGold: true },
    });

    if (matureField) {
      const before = await this.prisma.db.playerWallet.findUniqueOrThrow({
        where: { playerId },
        select: { balanceVersion: true },
      });
      const result = await this.clientCommandService.collectField({
        playerId,
        request: {
          fieldId: matureField.id,
          walletVersion: before.balanceVersion,
          collectMode: 'ripe',
          requestIdempotencyKey: `robot-farmer-collect-${Date.now()}`,
        },
      });

      return {
        actionName: 'collect-field',
        resultSummary: {
          summary: result.summary,
          collectedGold: result.result.collectedGold,
          fieldId: matureField.id,
        },
      };
    }

    const emptyField = await this.prisma.db.playerFieldSlot.findFirst({
      where: { playerId, status: 'EMPTY', isUnlocked: true },
      orderBy: { slotIndex: 'asc' },
      select: { id: true, statusVersion: true },
    });
    if (!emptyField) {
      throw new Error('No empty field available for robot farmer.');
    }

    const result = await this.clientCommandService.startCultivation({
      playerId,
      request: {
        fieldId: emptyField.id,
        plantType: ROBOT_SEED_ID,
      },
      idempotencyKey: `robot-farmer-start-${Date.now()}`,
    });

    return {
      actionName: 'start-cultivation',
      resultSummary: {
        summary: result.summary,
        fieldId: emptyField.id,
        seedId: ROBOT_SEED_ID,
      },
    };
  }

  private async runSpirit(playerId: string): Promise<RobotActionResult> {
    const [wallet, resource, slot] = await Promise.all([
      this.prisma.db.playerWallet.findUniqueOrThrow({
        where: { playerId },
        select: { balanceVersion: true },
      }),
      this.prisma.db.playerSpiritResource.findUniqueOrThrow({
        where: { playerId },
        select: { resourceVersion: true, spiritSoul: true },
      }),
      this.prisma.db.playerSpiritSlot.findFirst({
        where: { playerId, spiritDefinitionId: { not: null } },
        orderBy: { slotIndex: 'asc' },
        select: { slotIndex: true, slotVersion: true, level: true, isMain: true },
      }),
    ]);

    if (resource.spiritSoul < 2) {
      const result = await this.spiritService.buySpiritSoul(playerId, {
        goldAmount: 200,
        walletVersion: wallet.balanceVersion,
        resourceVersion: resource.resourceVersion,
        requestIdempotencyKey: `robot-spirit-buy-${Date.now()}`,
      });

      return {
        actionName: 'buy-spirit-soul',
        resultSummary: { summary: result.summary },
      };
    }

    if (!slot) {
      throw new Error('No spirit slot available for robot spirit.');
    }

    if (!slot.isMain) {
      const result = await this.spiritService.setMainSpirit(playerId, {
        slotIndex: slot.slotIndex,
        slotVersion: slot.slotVersion,
        requestIdempotencyKey: `robot-spirit-main-${Date.now()}`,
      });

      return {
        actionName: 'set-main-spirit',
        resultSummary: { summary: result.summary, slotIndex: slot.slotIndex },
      };
    }

    const result = await this.spiritService.upgradeSpirit(playerId, {
      slotIndex: slot.slotIndex,
      slotVersion: slot.slotVersion,
      resourceVersion: resource.resourceVersion,
      requestIdempotencyKey: `robot-spirit-upgrade-${Date.now()}`,
    });

    return {
      actionName: 'upgrade-spirit',
      resultSummary: { summary: result.summary, slotIndex: slot.slotIndex, beforeLevel: slot.level },
    };
  }

  private async runRaid(playerId: string): Promise<RobotActionResult> {
    const targetId = await this.prepareRaidTarget(playerId);
    const army = await this.prisma.db.playerArmy.findUniqueOrThrow({
      where: { playerId },
      select: { armyVersion: true },
    });
    const detail = await this.raidTargetService.getRaidTargetDetail(playerId, targetId);
    const result = await this.raidTargetService.createRaidOrder({
      playerId,
      targetId: detail.targetId,
      armyVersion: army.armyVersion,
      requestIdempotencyKey: `robot-raid-${Date.now()}`,
      skipQueue: true,
    });

    return {
      actionName: 'raid-target',
      resultSummary: {
        summary: result.summary,
        orderId: result.result.orderId ?? null,
        settlementStatus: result.result.settlementStatus ?? null,
        targetId: detail.targetId,
      },
    };
  }

  private async claimFactionStipendForRobot(playerId: string): Promise<RobotActionResult & { sourceSummary: string }> {
    const wallet = await this.prisma.db.playerWallet.findUniqueOrThrow({
      where: { playerId },
      select: { balanceVersion: true },
    });

    try {
      const result = await this.clientCommandService.claimFactionStipend({
        playerId,
        request: {
          walletVersion: wallet.balanceVersion,
          requestIdempotencyKey: `robot-stipend-${playerId}-${Date.now()}`,
        },
      });
      const sourceSummary = summarizeStipendRewards(result.rewards);
      return {
        actionName: 'claim-faction-stipend',
        sourceSummary,
        resultSummary: {
          summary: result.summary,
          sourceSummary,
          contribution: result.stipend.contribution,
          tierLabel: result.stipend.tierLabel,
          rewards: result.rewards,
        },
      };
    } catch (error) {
      if (error instanceof BusinessError && error.message === 'Daily faction stipend has already been claimed.') {
        return {
          actionName: 'claim-faction-stipend',
          sourceSummary: '俸禄：今日已领取',
          resultSummary: { summary: '今日俸禄已领取，本轮不重复发放。' },
        };
      }
      throw error;
    }
  }

  private async runRaidAgainst(playerId: string, defenderPlayerId: string): Promise<RobotActionResult & { sourceSummary: string }> {
    await Promise.all([
      this.restoreMainSpiritHp(playerId),
      this.restoreMainSpiritHp(defenderPlayerId),
    ]);
    const targetId = await this.prepareRaidTargetFor(playerId, defenderPlayerId);
    const army = await this.prisma.db.playerArmy.findUniqueOrThrow({
      where: { playerId },
      select: { armyVersion: true },
    });
    const detail = await this.raidTargetService.getRaidTargetDetail(playerId, targetId);
    const result = await this.raidTargetService.createRaidOrder({
      playerId,
      targetId: detail.targetId,
      armyVersion: army.armyVersion,
      requestIdempotencyKey: `robot-daily-raid-${playerId}-${Date.now()}`,
      skipQueue: true,
    });
    const sourceSummary = summarizeRaidRewards(result.result.rewards);

    return {
      actionName: 'raid-target',
      sourceSummary,
      resultSummary: {
        summary: result.summary,
        sourceSummary,
        orderId: result.result.orderId ?? null,
        settlementStatus: result.result.settlementStatus ?? null,
        targetId: detail.targetId,
        targetName: result.result.targetName,
        goldLoot: result.result.goldLoot,
        rewards: result.result.rewards,
      },
    };
  }

  private async restoreMainSpiritHp(playerId: string): Promise<void> {
    const mainSlot = await this.prisma.db.playerSpiritSlot.findFirst({
      where: {
        playerId,
        isMain: true,
        spiritDefinitionId: { not: null },
      },
      select: {
        id: true,
        currentHp: true,
        maxHp: true,
      },
    });

    if (!mainSlot || mainSlot.currentHp >= mainSlot.maxHp) {
      return;
    }

    await this.prisma.db.playerSpiritSlot.update({
      where: { id: mainSlot.id },
      data: {
        currentHp: mainSlot.maxHp,
        status: 'ACTIVE',
        slotVersion: { increment: 1 },
      },
    });
  }

  private async runDailySpiritGrowth(playerId: string, sourceSummaries: string[]): Promise<RobotActionResult> {
    const state = await this.spiritService.getSpiritState(playerId);
    const mainSlot = state.mainSlot;
    if (!mainSlot) {
      throw new Error('No main spirit available for daily robot.');
    }

    const requirement = state.breakthroughRequirement;
    if (mainSlot.isAtBreakthroughNode && requirement) {
      if (!requirement.canBreakthrough) {
        throw buildBreakthroughBlock(requirement, sourceSummaries);
      }

      const result = await this.spiritService.breakthroughSpirit(playerId, {
        slotIndex: mainSlot.slotIndex,
        targetStage: requirement.stage,
        slotVersion: mainSlot.slotVersion,
        resourceVersion: state.resourceVersion,
        requestIdempotencyKey: `robot-breakthrough-${playerId}-${Date.now()}`,
      });
      return {
        actionName: 'breakthrough-spirit',
        resultSummary: {
          summary: result.summary,
          stage: requirement.stage,
          consumed: `${requirement.label} x${requirement.required}`,
          sources: sourceSummaries,
        },
      };
    }

    const upgradeCost = getRobotSpiritUpgradeCost(mainSlot.level);
    if (upgradeCost === null) {
      throw new RobotProgressionBlockError('灵宠已到当前最高等级，日常循环暂时无法继续升级。', {
        level: mainSlot.level,
        sources: sourceSummaries,
      });
    }

    let currentState: ClientSpiritState = state;
    if (currentState.spiritSoul < upgradeCost) {
      const needSoul = upgradeCost - currentState.spiritSoul;
      const wallet = await this.prisma.db.playerWallet.findUniqueOrThrow({
        where: { playerId },
        select: { balanceVersion: true },
      });
      const buyResult = await this.spiritService.buySpiritSoul(playerId, {
        goldAmount: needSoul * 100,
        walletVersion: wallet.balanceVersion,
        resourceVersion: currentState.resourceVersion,
        requestIdempotencyKey: `robot-buy-soul-${playerId}-${Date.now()}`,
      });
      sourceSummaries.push(`金币购买：升级兽魂 +${needSoul}`);
      currentState = buyResult.spirit;
    }

    const currentMainSlot = currentState.mainSlot;
    if (!currentMainSlot) {
      throw new Error('No main spirit available after buying spirit soul.');
    }

    const result = await this.spiritService.upgradeSpirit(playerId, {
      slotIndex: currentMainSlot.slotIndex,
      slotVersion: currentMainSlot.slotVersion,
      resourceVersion: currentState.resourceVersion,
      requestIdempotencyKey: `robot-upgrade-spirit-${playerId}-${Date.now()}`,
    });

    return {
      actionName: 'upgrade-spirit',
      resultSummary: {
        summary: result.summary,
        beforeLevel: currentMainSlot.level,
        upgradeCost,
        sources: sourceSummaries,
      },
    };
  }

  private async prepareRobotPlayer(spec: RobotSpec, playerId: string): Promise<void> {
    await this.prisma.transaction(async (client) => {
      const seed = await client.seedDefinition.findUniqueOrThrow({ where: { seedId: ROBOT_SEED_ID } });
      const spirit = await client.spiritDefinition.findUniqueOrThrow({ where: { spiritId: ROBOT_STARTER_SPIRIT_ID } });

      await client.player.update({
        where: { id: playerId },
        data: {
          nickname: spec.nickname,
          protectedUntil: spec.role === 'raid' ? new Date(0) : undefined,
          castleLevelCache: 10,
        },
      });
      await this.prepareBasicResources(client, playerId, seed.id, spirit.id, {
        matureField: spec.role === 'farmer',
        topUpSpiritMaterials: true,
      });
    });
  }

  private async prepareDailyRobotPlayer(spec: RobotSpec, playerId: string): Promise<void> {
    await this.prisma.transaction(async (client) => {
      const seed = await client.seedDefinition.findUniqueOrThrow({ where: { seedId: ROBOT_SEED_ID } });
      const spirit = await client.spiritDefinition.findUniqueOrThrow({ where: { spiritId: ROBOT_STARTER_SPIRIT_ID } });

      await client.player.update({
        where: { id: playerId },
        data: {
          nickname: spec.nickname,
          protectedUntil: new Date(0),
          castleLevelCache: 10,
        },
      });
      await this.prepareBasicResources(client, playerId, seed.id, spirit.id, {
        matureField: true,
        topUpSpiritMaterials: false,
      });
    });
  }

  private async prepareBasicResources(
    client: Prisma.TransactionClient,
    playerId: string,
    seedDefinitionId: string,
    spiritDefinitionId: string,
    options: { matureField: boolean; topUpSpiritMaterials: boolean },
  ): Promise<void> {
    await client.playerWallet.upsert({
      where: { playerId },
      create: {
        playerId,
        vaultGold: 5000,
        vaultCapacity: 10000,
        walletGold: 0,
        walletCapacity: 1000,
      },
      update: {
        vaultGold: { increment: options.topUpSpiritMaterials ? 1000 : 50000 },
        vaultCapacity: { set: 10000 },
        balanceVersion: { increment: 1 },
      },
    });
    await client.playerArmy.upsert({
      where: { playerId },
      create: {
        playerId,
        totalCount: 80,
        availableCount: 80,
        frozenCount: 0,
        woundedCount: 0,
        capacity: 100,
      },
      update: {
        totalCount: 80,
        availableCount: 80,
        frozenCount: 0,
        woundedCount: 0,
        capacity: 100,
        armyVersion: { increment: 1 },
      },
    });
    await client.playerSeedInventory.upsert({
      where: {
        playerId_seedDefinitionId: {
          playerId,
          seedDefinitionId,
        },
      },
      create: {
        playerId,
        seedDefinitionId,
        quantity: 10,
        unlockedAt: new Date(),
      },
      update: {
        quantity: { increment: options.topUpSpiritMaterials ? 3 : 1 },
        unlockedAt: new Date(),
      },
    });

    await client.playerSpiritResource.upsert({
      where: { playerId },
      create: options.topUpSpiritMaterials
        ? {
          playerId,
          spiritSoul: 20,
          ordinarySoul: 50,
          rareSoul: 10,
          legendarySoul: 2,
          tianjiTalisman: 10,
        }
        : {
          playerId,
          spiritSoul: 0,
          ordinarySoul: 0,
          rareSoul: 0,
          legendarySoul: 0,
          tianjiTalisman: 0,
        },
      update: options.topUpSpiritMaterials
        ? {
          spiritSoul: { increment: 10 },
          ordinarySoul: { increment: 10 },
          rareSoul: { increment: 2 },
          legendarySoul: { increment: 1 },
          tianjiTalisman: { increment: 2 },
          resourceVersion: { increment: 1 },
        }
        : {
          resourceVersion: { increment: 1 },
        },
    });
    await client.playerSpiritSlot.upsert({
      where: {
        playerId_slotIndex: {
          playerId,
          slotIndex: 1,
        },
      },
      create: {
        playerId,
        slotIndex: 1,
        spiritDefinitionId,
        isMain: true,
        level: 1,
        element: 'WOOD',
        currentHp: 100,
        maxHp: 100,
        status: 'ACTIVE',
        acquiredAt: new Date(),
      },
      update: {
        spiritDefinitionId,
        isMain: true,
        element: 'WOOD',
        currentHp: 100,
        maxHp: 100,
        status: 'ACTIVE',
        slotVersion: { increment: 1 },
      },
    });
    await client.playerFieldSlot.upsert({
      where: {
        playerId_slotIndex: {
          playerId,
          slotIndex: 1,
        },
      },
      create: {
        playerId,
        slotIndex: 1,
        isUnlocked: true,
        unlockCastleLevel: 1,
        status: options.matureField ? 'MATURE' : 'EMPTY',
        seedDefinitionId: options.matureField ? seedDefinitionId : null,
        investedGold: 0,
        currentClaimableGold: options.matureField ? 200 : 0,
        seedAt: options.matureField ? new Date(Date.now() - 60 * 60 * 1000) : null,
        matureAt: options.matureField ? new Date(Date.now() - 10 * 60 * 1000) : null,
        readyAt: options.matureField ? new Date(Date.now() - 10 * 60 * 1000) : null,
      },
      update: options.matureField
        ? {
          isUnlocked: true,
          status: 'MATURE',
          seedDefinitionId,
          currentClaimableGold: 200,
          seedAt: new Date(Date.now() - 60 * 60 * 1000),
          matureAt: new Date(Date.now() - 10 * 60 * 1000),
          readyAt: new Date(Date.now() - 10 * 60 * 1000),
          statusVersion: { increment: 1 },
        }
        : {
          isUnlocked: true,
        },
    });
  }

  private async prepareRaidTarget(ownerPlayerId: string): Promise<string> {
    const targetLogin = await this.authService.devLogin({
      providerUserId: ROBOT_RAID_TARGET_KEY,
      nickname: '机器人靶场01',
      factionCode: 'human',
    });
    const targetPlayerId = targetLogin.player.id;

    await this.prepareRobotPlayer({
      robotKey: ROBOT_RAID_TARGET_KEY,
      role: 'farmer',
      nickname: '机器人靶场01',
      factionCode: 'human',
    }, targetPlayerId);

    return this.prepareRaidTargetFor(ownerPlayerId, targetPlayerId);
  }

  private async prepareRaidTargetFor(ownerPlayerId: string, targetPlayerId: string): Promise<string> {
    return this.prisma.transaction(async (client) => {
      await client.player.update({
        where: { id: targetPlayerId },
        data: { protectedUntil: new Date(0) },
      });
      await client.raidTargetPool.deleteMany({
        where: { ownerPlayerId, targetPlayerId },
      });
      const target = await client.player.findUniqueOrThrow({
        where: { id: targetPlayerId },
        select: {
          nickname: true,
          castleLevelCache: true,
          faction: { select: { name: true } },
          army: { select: { totalCount: true, availableCount: true } },
          fieldSlots: {
            orderBy: { slotIndex: 'asc' },
            select: {
              id: true,
              slotIndex: true,
              status: true,
              currentClaimableGold: true,
              seedDefinition: { select: { label: true } },
            },
          },
        },
      });
      const fields = target.fieldSlots.map((field) => ({
        id: field.id,
        slotIndex: field.slotIndex,
        status: field.status,
        cropName: field.seedDefinition?.label ?? null,
        currentClaimableGold: field.currentClaimableGold,
      }));
      const created = await client.raidTargetPool.create({
        data: {
          ownerPlayerId,
          targetPlayerId,
          slotIndex: 1,
          refreshBatchNo: 1,
          targetSnapshotJson: {
            name: target.nickname,
            faction: target.faction?.name ?? '未知阵营',
            level: target.castleLevelCache,
            combatPower: target.army?.totalCount ?? 0,
            raidableGold: Math.max(...fields.map((field) => field.currentClaimableGold), 0),
            exposedFruit: 'daily-3 成熟田',
            raidRule: 'daily-3 阵营环形互相掠夺',
            defenseStatus: `可用战力 ${target.army?.availableCount ?? 0}`,
            protectionStatus: '可发起掠夺',
            risk: '机器人日常循环测试',
            detail: '用于验证机器人日常循环中的掠夺、掉落和保护规则。',
          },
          fieldSnapshotJson: fields,
          riskSnapshotJson: { risk: 'robot-daily-3' },
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
        select: { id: true },
      });
      return created.id;
    });
  }

  private async createActionLog(input: {
    runId: string;
    spec: RobotSpec;
    playerId: string;
    actionName: string;
    status: RobotActionStatus;
    durationMs: number;
    errorCode?: string | null;
    errorMessage?: string | null;
    requestSummaryJson?: Record<string, unknown>;
    resultSummaryJson?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.db.robotActionLog.create({
      data: {
        runId: input.runId,
        robotKey: input.spec.robotKey,
        robotRole: input.spec.role,
        playerId: input.playerId,
        actionName: input.actionName,
        status: input.status,
        durationMs: input.durationMs,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        requestSummaryJson: (input.requestSummaryJson ?? {}) as Prisma.InputJsonValue,
        resultSummaryJson: (input.resultSummaryJson ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  private async buildRunResult(
    runId: string,
    status: string,
    successCount: number,
    failedCount: number,
    blockedCount: number,
  ): Promise<Record<string, unknown>> {
    const actionLogs = await this.prisma.db.robotActionLog.findMany({
      where: { runId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      ok: failedCount === 0,
      runId,
      status,
      successActionCount: successCount,
      failedActionCount: failedCount,
      progressionBlockCount: blockedCount,
      actions: actionLogs.map((item) => ({
        robotKey: item.robotKey,
        robotRole: item.robotRole,
        playerId: item.playerId,
        actionName: item.actionName,
        status: item.status,
        errorCode: item.errorCode,
        errorMessage: item.errorMessage,
      })),
    };
  }
}

class RobotProgressionBlockError extends Error {
  constructor(message: string, readonly details: Record<string, unknown>) {
    super(message);
    this.name = 'RobotProgressionBlockError';
  }
}

function buildBreakthroughBlock(requirement: ClientSpiritBreakthroughRequirement, sourceSummaries: string[]): RobotProgressionBlockError {
  const missing = Math.max(requirement.required - requirement.owned, 0);
  const sources = sourceSummaries.length > 0 ? sourceSummaries.join('；') : '本轮没有新增突破材料';
  return new RobotProgressionBlockError(
    `突破材料不足：${requirement.label} ${requirement.owned} / ${requirement.required}，缺少 ${missing}。本轮来源：${sources}。`,
    {
      stage: requirement.stage,
      quality: requirement.quality,
      label: requirement.label,
      required: requirement.required,
      owned: requirement.owned,
      missing,
      sources: sourceSummaries,
    },
  );
}

function mapRun(run: {
  id: string;
  name: string;
  mode: string;
  status: string;
  plannedRobotCount: number;
  successActionCount: number;
  failedActionCount: number;
  summary: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}): Record<string, unknown> {
  return {
    id: run.id,
    name: run.name,
    mode: run.mode,
    status: run.status,
    plannedRobotCount: run.plannedRobotCount,
    successActionCount: run.successActionCount,
    failedActionCount: run.failedActionCount,
    summary: run.summary,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  };
}

function mapActionLog(log: {
  id: string;
  runId: string;
  robotKey: string;
  robotRole: string;
  playerId: string;
  actionName: string;
  status: string;
  durationMs: number;
  errorCode: string | null;
  errorMessage: string | null;
  requestSummaryJson: Prisma.JsonValue | null;
  resultSummaryJson: Prisma.JsonValue | null;
  createdAt: Date;
}): Record<string, unknown> {
  return {
    id: log.id,
    runId: log.runId,
    robotKey: log.robotKey,
    robotRole: log.robotRole,
    playerId: log.playerId,
    actionName: log.actionName,
    status: log.status,
    durationMs: log.durationMs,
    errorCode: log.errorCode,
    errorMessage: log.errorMessage,
    requestSummaryJson: log.requestSummaryJson,
    resultSummaryJson: log.resultSummaryJson,
    createdAt: log.createdAt.toISOString(),
  };
}

function resolveErrorCode(error: unknown): string {
  if (error instanceof BusinessError) {
    return error.code;
  }
  return 'ROBOT_ACTION_FAILED';
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function buildIssueExportMarkdown(
  errors: Array<Record<string, unknown>>,
  latestRun: Record<string, unknown> | null,
): string {
  const lines = [
    '# 机器人测试问题报告',
    '',
    `最新任务：${String(latestRun?.id ?? '-')}`,
    `最新状态：${String(latestRun?.status ?? '-')}`,
    `问题分组数：${errors.length}`,
    '',
  ];

  if (errors.length <= 0) {
    lines.push('当前没有问题。');
    return lines.join('\n');
  }

  for (const [index, error] of errors.entries()) {
    lines.push(`## 问题 ${index + 1}`);
    lines.push('');
    lines.push(`- 类型：${getIssueTypeLabel(error.issueType)}`);
    lines.push(`- 严重程度：${getIssueSeverityLabel(error.severity)}`);
    lines.push(`- 角色：${getRobotRoleLabel(error.robotRole)}`);
    lines.push(`- 动作：${getRobotActionLabel(error.actionName)}`);
    lines.push(`- 错误码：${getRobotErrorCodeLabel(error.errorCode)}`);
    lines.push(`- 错误信息：${getRobotErrorMessageLabel(error.errorMessage)}`);
    lines.push(`- 出现次数：${String(error.count ?? 0)}`);
    lines.push(`- 首次出现：${formatRobotDateTime(error.firstSeenAt)}`);
    lines.push(`- 最近出现：${formatRobotDateTime(error.lastSeenAt)}`);
    lines.push(`- 处理建议：${String(error.suggestion ?? '-')}`);
    lines.push(`- 原始角色：${String(error.robotRole ?? '-')}`);
    lines.push(`- 原始动作：${String(error.actionName ?? '-')}`);
    lines.push(`- 原始错误码：${String(error.errorCode ?? '-')}`);
    lines.push(`- 原始错误信息：${String(error.errorMessage ?? '-')}`);
    lines.push('');
  }

  return lines.join('\n');
}

function resolveIssueType(input: {
  status?: string | null;
  robotRole: string | null;
  actionName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}): 'system_error' | 'rule_error' | 'progression_block' {
  const message = input.errorMessage ?? '';
  const code = input.errorCode ?? '';

  if (
    input.status === 'BLOCKED'
    || code === 'PROGRESSION_BLOCK'
    || message === 'Insufficient spirit soul.'
    || message.includes('Insufficient spirit soul')
    || message.includes('突破材料不足')
  ) {
    return 'progression_block';
  }

  if (code === 'STATE_VERSION_CONFLICT') {
    return 'system_error';
  }

  if (code === 'RAID_NOT_ALLOWED' || message.includes('Target is under raid protection')) {
    return 'rule_error';
  }

  return 'system_error';
}

function resolveIssueSeverity(issueType: string): 'observe' | 'warning' | 'error' {
  if (issueType === 'progression_block') {
    return 'observe';
  }
  if (issueType === 'rule_error') {
    return 'warning';
  }
  return 'error';
}

function buildIssueSuggestion(issueType: string, errorMessage: string | null): string {
  if (issueType === 'progression_block' && errorMessage?.includes('突破材料不足')) {
    return '这是成长资源卡点。继续运行 daily-3 观察俸禄和掠夺是否能逐步补足；若长期不增长，再调整掉落或俸禄节奏。';
  }
  if (issueType === 'progression_block') {
    return '继续循环观察资源增长；如果连续多轮不增长，再检查资源来源或数值节奏。';
  }
  if (issueType === 'rule_error') {
    return '检查机器人目标选择和规则保护条件，确认是否跳过不可操作对象。';
  }
  return '交给 AI 排查接口、状态版本或服务端异常。';
}

function getIssueTypeLabel(value: unknown): string {
  const key = String(value ?? '');
  if (key === 'system_error') return '系统错误';
  if (key === 'rule_error') return '规则错误';
  if (key === 'progression_block') return '成长卡点';
  return key || '-';
}

function getIssueSeverityLabel(value: unknown): string {
  const key = String(value ?? '');
  if (key === 'observe') return '观察';
  if (key === 'warning') return '警告';
  if (key === 'error') return '错误';
  return key || '-';
}

function getRobotRoleLabel(value: unknown): string {
  const key = String(value ?? '');
  if (key === 'farmer') return '种田';
  if (key === 'spirit') return '养宠';
  if (key === 'raid') return '掠夺';
  if (key === 'daily') return '日常循环';
  return key || '-';
}

function getRobotActionLabel(value: unknown): string {
  const key = String(value ?? '');
  if (key === 'collect-field') return '收菜';
  if (key === 'start-cultivation') return '种植';
  if (key === 'claim-faction-stipend') return '领取俸禄';
  if (key === 'buy-spirit-soul') return '购买升级兽魂';
  if (key === 'upgrade-spirit') return '灵宠升级';
  if (key === 'breakthrough-spirit') return '灵宠突破';
  if (key === 'spirit-growth') return '灵宠成长';
  if (key === 'set-main-spirit') return '设置主宠';
  if (key === 'raid-target') return '发起掠夺';
  if (key === 'farmer') return '种田';
  if (key === 'spirit') return '养宠';
  if (key === 'raid') return '掠夺';
  return key || '-';
}

function getRobotErrorCodeLabel(value: unknown): string {
  const key = String(value ?? '');
  if (key === 'CONFLICT') return '状态冲突';
  if (key === 'PROGRESSION_BLOCK') return '成长卡点';
  if (key === 'INSUFFICIENT_RESOURCE') return '资源不足';
  if (key === 'INSUFFICIENT_SPIRIT_SOUL') return '兽魂不足';
  if (key === 'RAID_NOT_ALLOWED') return '掠夺受限';
  if (key === 'STATE_VERSION_CONFLICT') return '状态版本冲突';
  if (key === 'ROBOT_ACTION_FAILED') return '机器人动作失败';
  return key || '-';
}

function getRobotErrorMessageLabel(value: unknown): string {
  const text = String(value ?? '');
  if (text === 'Insufficient spirit soul.') return '升级兽魂不足，当前无法继续升级灵宠。';
  if (text === 'Target is under raid protection.') return '目标处于保护期，当前不能发起掠夺。';
  if (text === 'fieldVersion conflict.') return '田地状态版本已变化，需要刷新后重试。';
  return text || '-';
}

function formatRobotDateTime(value: unknown): string {
  const text = String(value ?? '');
  if (!text) {
    return '-';
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function summarizeStipendRewards(rewards: ClientFactionStipendReward[]): string {
  const parts = rewards
    .filter((reward) => ['ordinary-soul', 'rare-soul', 'legendary-soul'].includes(reward.kind) && reward.quantity > 0)
    .map((reward) => `${normalizeRewardLabel(reward.label, reward.kind)} +${reward.quantity}`);
  return parts.length > 0 ? `俸禄：${parts.join('，')}` : '俸禄：未获得突破材料';
}

function summarizeRaidRewards(rewards: ClientRaidRewardItem[]): string {
  const parts = rewards
    .filter((reward) => ['ordinarySoul', 'rareSoul', 'legendarySoul', 'ordinary-soul', 'rare-soul', 'legendary-soul'].includes(reward.seedId) || isSoulLabel(reward.label))
    .map((reward) => `${normalizeRewardLabel(reward.label, reward.seedId)} +${reward.quantity}`);
  return parts.length > 0 ? `掠夺：${parts.join('，')}` : '掠夺：未获得突破材料';
}

function normalizeRewardLabel(label: string, fallback: string): string {
  if (label.includes('普通')) return '普通兽魂';
  if (label.includes('稀有')) return '稀有兽魂';
  if (label.includes('传说')) return '传说兽魂';
  if (fallback.includes('ordinary')) return '普通兽魂';
  if (fallback.includes('rare')) return '稀有兽魂';
  if (fallback.includes('legendary')) return '传说兽魂';
  return label || fallback;
}

function isSoulLabel(label: string): boolean {
  return label.includes('兽魂') || label.includes('ordinary') || label.includes('rare') || label.includes('legendary');
}

function getRobotSpiritUpgradeCost(level: number): number | null {
  if (level >= 50) {
    return null;
  }
  const fixedCosts: Record<number, number> = {
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 8,
    8: 10,
    9: 12,
    10: 15,
    41: 290,
    42: 300,
    43: 320,
    44: 340,
    45: 360,
    46: 390,
    47: 420,
    48: 450,
    49: 490,
  };
  if (fixedCosts[level]) return fixedCosts[level];
  if (level >= 11 && level <= 15) return 18 + (level - 11) * 3;
  if (level >= 16 && level <= 20) return 35 + (level - 16) * 5;
  if (level >= 21 && level <= 25) return 63 + (level - 21) * 8;
  if (level >= 26 && level <= 30) return 105 + (level - 26) * 10;
  if (level >= 31 && level <= 35) return 160 + (level - 31) * 15;
  if (level >= 36 && level <= 40) return 240 + (level - 36) * 20;
  return 1;
}
