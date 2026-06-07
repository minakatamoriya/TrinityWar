import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type {
  AdminRobotDashboardResponse,
  ClientFactionStipendReward,
  ClientRaidRewardItem,
  ClientSpiritBreakthroughRequirement,
  ClientSpiritState,
} from '@trinitywar/shared';
import { SocialRelationStatus, SocialRelationType, type Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service.js';
import { ClientCommandService } from '../client-command/client-command.service.js';
import { FieldLifecycleService } from '../client-read/field-lifecycle.service.js';
import { BusinessError } from '../common/errors/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RaidTargetService } from '../raid/raid-target.service.js';
import { SocialService } from '../social/social.service.js';
import { SpiritService } from '../spirit/spirit.service.js';

type RobotRole = 'farmer' | 'spirit' | 'raid' | 'daily' | 'social' | 'sim';
type RobotActionStatus = 'SUCCESS' | 'FAILED' | 'BLOCKED';
type FactionCode = 'human' | 'immortal' | 'demon';
type RobotAutomationMode = 'daily-3' | 'social-3' | 'player-sim-v1';

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

interface RobotLoopState {
  running: boolean;
  jobId: string | null;
  mode: RobotAutomationMode | null;
  intervalSeconds: number;
  maxRounds: number;
  completedRounds: number;
  startedAt: string | null;
  stoppedAt: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastRunId: string | null;
  lastStatus: string | null;
  lastError: string | null;
  stopReason: string | null;
  consecutiveHardErrors: number;
  hardErrorLimit: number;
}

interface RobotAutomationConfigPayload {
  enabled: boolean;
  intervalSeconds: number;
  maxRounds: number;
  hardErrorLimit: number;
  autoStartOnBoot: boolean;
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

const PLAYER_SIM_SPECS: RobotSpec[] = [
  { robotKey: 'sim-human-001', role: 'sim', nickname: '人界勤奋玩家001', factionCode: 'human' },
  { robotKey: 'sim-human-002', role: 'sim', nickname: '人界勤奋玩家002', factionCode: 'human' },
  { robotKey: 'sim-human-003', role: 'sim', nickname: '人界勤奋玩家003', factionCode: 'human' },
  { robotKey: 'sim-immortal-001', role: 'sim', nickname: '仙界勤奋玩家001', factionCode: 'immortal' },
  { robotKey: 'sim-immortal-002', role: 'sim', nickname: '仙界勤奋玩家002', factionCode: 'immortal' },
  { robotKey: 'sim-immortal-003', role: 'sim', nickname: '仙界勤奋玩家003', factionCode: 'immortal' },
  { robotKey: 'sim-demon-001', role: 'sim', nickname: '魔界勤奋玩家001', factionCode: 'demon' },
  { robotKey: 'sim-demon-002', role: 'sim', nickname: '魔界勤奋玩家002', factionCode: 'demon' },
  { robotKey: 'sim-demon-003', role: 'sim', nickname: '魔界勤奋玩家003', factionCode: 'demon' },
];

const ROBOT_RAID_TARGET_KEY = 'robot-raid-target-001';
const ROBOT_SEED_ID = 'qinglingmai';
const ROBOT_STARTER_SPIRIT_ID = 'linglu';
const DAILY_3_MODE = 'daily-3';
const SOCIAL_3_MODE = 'social-3';
const PLAYER_SIM_V1_MODE = 'player-sim-v1';
const DAILY_3_CONFIG_ID = 'robot-automation-config-daily-3';
const SOCIAL_3_CONFIG_ID = 'robot-automation-config-social-3';
const PLAYER_SIM_V1_CONFIG_ID = 'robot-automation-config-player-sim-v1';

@Injectable()
export class RobotService implements OnApplicationBootstrap {
  private loopTimer: NodeJS.Timeout | null = null;
  private loopState: RobotLoopState = createIdleLoopState();

  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ClientCommandService) private readonly clientCommandService: ClientCommandService,
    @Inject(FieldLifecycleService) private readonly fieldLifecycleService: FieldLifecycleService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RaidTargetService) private readonly raidTargetService: RaidTargetService,
    @Inject(SocialService) private readonly socialService: SocialService,
    @Inject(SpiritService) private readonly spiritService: SpiritService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.ROBOT_AUTOMATION_BOOTSTRAP === 'disabled') {
      return;
    }

    await this.markInterruptedAutomationJobs();
    for (const mode of [DAILY_3_MODE, SOCIAL_3_MODE, PLAYER_SIM_V1_MODE] as const) {
      const config = await this.getOrCreateAutomationConfig(mode);
      if (!config.enabled || !config.autoStartOnBoot) {
        continue;
      }

      await this.startLoopForMode(mode, {
        intervalSeconds: config.intervalSeconds,
        maxRounds: config.maxRounds,
        hardErrorLimit: config.hardErrorLimit,
      });
    }
  }

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

  async runSocial3(): Promise<Record<string, unknown>> {
    const run = await this.prisma.db.robotTestRun.create({
      data: {
        name: '3 阵营社交助力',
        mode: 'social-3',
        plannedRobotCount: DAILY_ROBOT_SPECS.length,
      },
    });

    const players: Array<{ spec: RobotSpec; playerId: string }> = [];
    for (const spec of DAILY_ROBOT_SPECS) {
      const login = await this.authService.devLogin({
        providerUserId: spec.robotKey,
        nickname: spec.nickname,
        factionCode: spec.factionCode,
      });
      await this.prepareSocialRobotPlayer(spec, login.player.id);
      players.push({ spec: { ...spec, role: 'social' }, playerId: login.player.id });
    }

    let successCount = 0;
    let failedCount = 0;
    const countStatus = (status: RobotActionStatus): void => {
      if (status === 'SUCCESS') successCount += 1;
      if (status !== 'SUCCESS') failedCount += 1;
    };

    countStatus(await this.runLoggedStep(run.id, players[0].spec, players[0].playerId, 'friend-link', async () => (
      this.prepareSocialFriendLinks(players)
    )));

    for (let index = 0; index < players.length; index += 1) {
      const helper = players[index];
      const target = players[(index + 1) % players.length];
      countStatus(await this.runLoggedStep(run.id, helper.spec, helper.playerId, 'friend-field-assist', async () => (
        this.runFriendFieldAssist(helper.playerId, target.playerId)
      )));
    }

    const finishedRun = await this.prisma.db.robotTestRun.update({
      where: { id: run.id },
      data: {
        status: failedCount > 0 ? 'FAILED' : 'SUCCESS',
        successActionCount: successCount,
        failedActionCount: failedCount,
        summary: `完成 ${successCount} 个社交动作，失败 ${failedCount} 个动作。`,
        finishedAt: new Date(),
      },
    });

    return this.buildRunResult(run.id, finishedRun.status, successCount, failedCount, 0);
  }

  async runPlayerSimV1(): Promise<Record<string, unknown>> {
    const run = await this.prisma.db.robotTestRun.create({
      data: {
        name: '勤奋玩家模拟 v1',
        mode: 'player-sim-v1',
        plannedRobotCount: PLAYER_SIM_SPECS.length,
      },
    });

    const players: Array<{ spec: RobotSpec; playerId: string; sources: string[] }> = [];
    for (const spec of PLAYER_SIM_SPECS) {
      const login = await this.authService.devLogin({
        providerUserId: spec.robotKey,
        nickname: spec.nickname,
        factionCode: spec.factionCode,
      });
      await this.preparePlayerSimRobot(spec, login.player.id);
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

    for (let index = 0; index < players.length; index += 1) {
      const player = players[index];
      const target = findNextCrossFactionPlayer(players, index);
      countStatus(await this.runLoggedStep(run.id, player.spec, player.playerId, 'farm-cycle', async () => this.runSimFarmCycle(player.playerId)));
      if (!target) {
        countStatus(await this.runLoggedStep(run.id, player.spec, player.playerId, 'raid-target', async () => this.runSimNoCrossFactionRaidTarget(player.playerId)));
      } else {
        countStatus(await this.runLoggedStep(run.id, player.spec, player.playerId, 'raid-target', async () => this.runRaidAgainst(player.playerId, target.playerId)));
      }
      countStatus(await this.runLoggedStep(run.id, player.spec, player.playerId, 'claim-faction-stipend', async () => {
        const result = await this.claimFactionStipendForRobot(player.playerId);
        player.sources.push(result.sourceSummary);
        return result;
      }));
      countStatus(await this.runLoggedStep(run.id, player.spec, player.playerId, 'spirit-growth', async () => (
        this.runDailySpiritGrowth(player.playerId, player.sources, { blockOnBreakthrough: false, feedWhenPossible: true })
      )));
    }

    await this.recordPlayerSimSnapshots(run.id, players);

    const finalStatus = failedCount > 0 ? 'FAILED' : blockedCount > 0 ? 'ISSUE' : 'SUCCESS';
    const finishedRun = await this.prisma.db.robotTestRun.update({
      where: { id: run.id },
      data: {
        status: finalStatus,
        successActionCount: successCount,
        failedActionCount: failedCount + blockedCount,
        summary: `勤奋玩家模拟：完成 ${successCount} 个动作，硬错误 ${failedCount} 个，卡点 ${blockedCount} 个。`,
        finishedAt: new Date(),
      },
    });

    return this.buildRunResult(run.id, finishedRun.status, successCount, failedCount, blockedCount);
  }

  async startDaily3Loop(body: unknown): Promise<Record<string, unknown>> {
    return this.startLoopForMode(DAILY_3_MODE, parseLoopStartPayload(body));
  }

  async startSocial3Loop(body: unknown): Promise<Record<string, unknown>> {
    return this.startLoopForMode(SOCIAL_3_MODE, parseLoopStartPayload(body));
  }

  async startPlayerSimV1Loop(body: unknown): Promise<Record<string, unknown>> {
    return this.startLoopForMode(PLAYER_SIM_V1_MODE, parseLoopStartPayload(body));
  }

  private async startLoopForMode(mode: RobotAutomationMode, config: { intervalSeconds: number; maxRounds: number; hardErrorLimit: number }): Promise<Record<string, unknown>> {
    if (this.loopState.running) {
      return {
        ok: true,
        alreadyRunning: true,
        loop: this.getLoopState(),
      };
    }

    await this.markInterruptedAutomationJobs();
    const job = await this.prisma.db.robotAutomationJob.create({
      data: {
        name: getAutomationModeName(mode),
        mode,
        status: 'RUNNING',
        intervalSeconds: config.intervalSeconds,
        maxRounds: config.maxRounds,
        hardErrorLimit: config.hardErrorLimit,
      },
    });

    this.loopState = {
      running: true,
      jobId: job.id,
      mode,
      intervalSeconds: config.intervalSeconds,
      maxRounds: config.maxRounds,
      completedRounds: 0,
      startedAt: new Date().toISOString(),
      stoppedAt: null,
      lastRunAt: null,
      nextRunAt: null,
      lastRunId: null,
      lastStatus: null,
      lastError: null,
      stopReason: null,
      consecutiveHardErrors: 0,
      hardErrorLimit: config.hardErrorLimit,
    };
    this.scheduleNextLoopTick(0);

    return {
      ok: true,
      loop: this.getLoopState(),
    };
  }

  async stopDaily3Loop(reason = '手动停止'): Promise<Record<string, unknown>> {
    await this.stopLoop(reason);
    return {
      ok: true,
      loop: this.getLoopState(),
    };
  }

  getLoopState(): RobotLoopState {
    return { ...this.loopState };
  }

  async getDaily3AutomationConfig(): Promise<Record<string, unknown>> {
    return mapAutomationConfig(await this.getOrCreateAutomationConfig(DAILY_3_MODE));
  }

  async updateDaily3AutomationConfig(body: unknown): Promise<Record<string, unknown>> {
    return this.updateAutomationConfig(DAILY_3_MODE, body);
  }

  async getSocial3AutomationConfig(): Promise<Record<string, unknown>> {
    return mapAutomationConfig(await this.getOrCreateAutomationConfig(SOCIAL_3_MODE));
  }

  async updateSocial3AutomationConfig(body: unknown): Promise<Record<string, unknown>> {
    return this.updateAutomationConfig(SOCIAL_3_MODE, body);
  }

  async getPlayerSimV1AutomationConfig(): Promise<Record<string, unknown>> {
    return mapAutomationConfig(await this.getOrCreateAutomationConfig(PLAYER_SIM_V1_MODE));
  }

  async updatePlayerSimV1AutomationConfig(body: unknown): Promise<Record<string, unknown>> {
    return this.updateAutomationConfig(PLAYER_SIM_V1_MODE, body);
  }

  private async updateAutomationConfig(mode: RobotAutomationMode, body: unknown): Promise<Record<string, unknown>> {
    const current = await this.getOrCreateAutomationConfig(mode);
    const payload = parseAutomationConfigPayload(body, {
      enabled: current.enabled,
      intervalSeconds: current.intervalSeconds,
      maxRounds: current.maxRounds,
      hardErrorLimit: current.hardErrorLimit,
      autoStartOnBoot: current.autoStartOnBoot,
    });

    const updated = await this.prisma.db.robotAutomationConfig.upsert({
      where: { mode },
      create: {
        id: getAutomationConfigId(mode),
        mode,
        ...payload,
      },
      update: payload,
    });

    if (!updated.enabled && this.loopState.running && this.loopState.mode === mode) {
      await this.stopLoop('自动调度已关闭');
    }

    return {
      ok: true,
      config: mapAutomationConfig(updated),
    };
  }

  private scheduleNextLoopTick(delayMs: number): void {
    if (!this.loopState.running) {
      return;
    }
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
    }
    this.loopState.nextRunAt = new Date(Date.now() + delayMs).toISOString();
    this.loopTimer = setTimeout(() => {
      this.loopTimer = null;
      void this.runLoopTick();
    }, delayMs);
    this.loopTimer.unref?.();
    void this.persistLoopState();
  }

  private async runLoopTick(): Promise<void> {
    if (!this.loopState.running) {
      return;
    }

    try {
      const result = await this.runAutomationMode(this.loopState.mode ?? DAILY_3_MODE);
      const failedActionCount = Number(result.failedActionCount ?? 0);
      this.loopState.completedRounds += 1;
      this.loopState.lastRunAt = new Date().toISOString();
      this.loopState.lastRunId = typeof result.runId === 'string' ? result.runId : null;
      this.loopState.lastStatus = typeof result.status === 'string' ? result.status : null;
      this.loopState.lastError = null;
      this.loopState.consecutiveHardErrors = failedActionCount > 0 ? this.loopState.consecutiveHardErrors + 1 : 0;
    } catch (error) {
      this.loopState.completedRounds += 1;
      this.loopState.lastRunAt = new Date().toISOString();
      this.loopState.lastStatus = 'FAILED';
      this.loopState.lastError = resolveErrorMessage(error);
      this.loopState.consecutiveHardErrors += 1;
    }
    await this.persistLoopState();

    if (this.loopState.maxRounds > 0 && this.loopState.completedRounds >= this.loopState.maxRounds) {
      await this.stopLoop('达到最大轮数', 'COMPLETED');
      return;
    }

    if (this.loopState.consecutiveHardErrors >= this.loopState.hardErrorLimit) {
      await this.stopLoop('连续硬错误达到阈值', 'FAILED');
      return;
    }

    this.scheduleNextLoopTick(this.loopState.intervalSeconds * 1000);
  }

  private runAutomationMode(mode: RobotAutomationMode): Promise<Record<string, unknown>> {
    if (mode === PLAYER_SIM_V1_MODE) {
      return this.runPlayerSimV1();
    }
    if (mode === SOCIAL_3_MODE) {
      return this.runSocial3();
    }
    return this.runDaily3();
  }

  private async stopLoop(reason: string, status = 'STOPPED'): Promise<void> {
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    this.loopState = {
      ...this.loopState,
      running: false,
      stoppedAt: new Date().toISOString(),
      nextRunAt: null,
      stopReason: reason,
      lastStatus: status === 'FAILED' ? 'FAILED' : this.loopState.lastStatus,
    };
    await this.persistLoopState(status);
  }

  async getDashboard(): Promise<AdminRobotDashboardResponse> {
    const issueStatuses = ['FAILED', 'BLOCKED'];
    await this.markInterruptedAutomationJobs();
    const [runs, dailyAutomationConfig, socialAutomationConfig, playerSimAutomationConfig, automationJobs, robotPlayers, logs, errors, errorGroups] = await Promise.all([
      this.prisma.db.robotTestRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 10,
      }),
      this.getOrCreateAutomationConfig(DAILY_3_MODE),
      this.getOrCreateAutomationConfig(SOCIAL_3_MODE),
      this.getOrCreateAutomationConfig(PLAYER_SIM_V1_MODE),
      this.prisma.db.robotAutomationJob.findMany({
        orderBy: { startedAt: 'desc' },
        take: 10,
      }),
      this.prisma.db.playerAuthIdentity.findMany({
        where: {
          provider: 'DEV_FAKE',
          OR: [
            { providerUserId: { startsWith: 'robot-' } },
            { providerUserId: { startsWith: 'sim-' } },
          ],
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
        take: 100,
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
    const latestRunIssueGroups = latestRun
      ? await this.prisma.db.robotActionLog.groupBy({
        by: ['robotRole', 'actionName', 'status', 'errorCode', 'errorMessage'],
        where: {
          runId: latestRun.id,
          status: { in: issueStatuses },
        },
        _count: { _all: true },
      })
      : [];
    const latestRunIssueSummary = latestRunIssueGroups.map((item) => {
      const issueType = resolveIssueType({
        status: item.status,
        robotRole: item.robotRole,
        actionName: item.actionName,
        errorCode: item.errorCode,
        errorMessage: item.errorMessage,
      });

      return {
        issueType,
        count: item._count._all,
      };
    });
    const progressionBlockCount = errorSummary
      .filter((item) => item.issueType === 'progression_block')
      .reduce((sum, item) => sum + Number(item.count ?? 0), 0);
    const hardIssueCount = errorSummary
      .filter((item) => item.issueType !== 'progression_block')
      .reduce((sum, item) => sum + Number(item.count ?? 0), 0);
    const latestProgressionBlockCount = latestRun
      ? latestRunIssueSummary
        .filter((item) => item.issueType === 'progression_block')
        .reduce((sum, item) => sum + Number(item.count ?? 0), 0)
      : progressionBlockCount;
    const latestHardIssueCount = latestRun
      ? latestRunIssueSummary
        .filter((item) => item.issueType !== 'progression_block')
        .reduce((sum, item) => sum + Number(item.count ?? 0), 0)
      : hardIssueCount;
    const displayState = latestHardIssueCount > 0
      ? 'FAILED'
      : latestProgressionBlockCount > 0
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
        progressionBlockCount: latestProgressionBlockCount,
        hardIssueCount: latestHardIssueCount,
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
      automation: {
        loop: this.getLoopState(),
        config: mapAutomationConfig(dailyAutomationConfig),
        configs: {
          items: [
            mapAutomationConfig(dailyAutomationConfig),
            mapAutomationConfig(socialAutomationConfig),
            mapAutomationConfig(playerSimAutomationConfig),
          ],
        },
        jobs: {
          items: automationJobs.map(mapAutomationJob),
        },
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
    await this.fieldLifecycleService.settlePlayerFields(this.prisma.db, playerId);

    const matureField = await this.prisma.db.playerFieldSlot.findFirst({
      where: { playerId, status: { in: ['MATURE', 'WITHERED'] }, isUnlocked: true },
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

  private async runSimCollectField(playerId: string): Promise<RobotActionResult> {
    await this.fieldLifecycleService.settlePlayerFields(this.prisma.db, playerId);

    const matureField = await this.prisma.db.playerFieldSlot.findFirst({
      where: { playerId, status: { in: ['MATURE', 'WITHERED'] }, isUnlocked: true },
      orderBy: { slotIndex: 'asc' },
      select: { id: true, status: true },
    });
    if (!matureField) {
      const counts = await this.getPlayerFieldStatusCounts(playerId);
      return {
        actionName: 'wait-field-harvest',
        resultSummary: {
          summary: '当前没有成熟田可收，等待田地成长。',
          reason: 'no_collectable_field',
          ...counts,
        },
      };
      throw new RobotProgressionBlockError('当前没有可收取的成熟或枯萎田地。', {
        reason: 'no_collectable_field',
      });
    }

    const wallet = await this.prisma.db.playerWallet.findUniqueOrThrow({
      where: { playerId },
      select: { balanceVersion: true },
    });
    const result = await this.clientCommandService.collectField({
      playerId,
      request: {
        fieldId: matureField.id,
        walletVersion: wallet.balanceVersion,
        collectMode: 'ripe',
        requestIdempotencyKey: `player-sim-collect-${playerId}-${Date.now()}`,
      },
    });

    return {
      actionName: 'collect-field',
      resultSummary: {
        summary: result.summary,
        fieldId: matureField.id,
        fieldStatus: matureField.status,
        collectedGold: result.result.collectedGold,
      },
    };
  }

  private async runSimStartCultivation(playerId: string): Promise<RobotActionResult> {
    await this.fieldLifecycleService.settlePlayerFields(this.prisma.db, playerId);

    const emptyField = await this.prisma.db.playerFieldSlot.findFirst({
      where: { playerId, status: 'EMPTY', isUnlocked: true },
      orderBy: { slotIndex: 'asc' },
      select: { id: true },
    });
    if (!emptyField) {
      const counts = await this.getPlayerFieldStatusCounts(playerId);
      return {
        actionName: 'wait-field-slot',
        resultSummary: {
          summary: '当前没有空田可播种，等待田地进入可操作状态。',
          reason: 'no_empty_field',
          ...counts,
        },
      };
      throw new RobotProgressionBlockError('当前没有空田可播种。', {
        reason: 'no_empty_field',
      });
    }

    const result = await this.clientCommandService.startCultivation({
      playerId,
      request: {
        fieldId: emptyField.id,
        plantType: ROBOT_SEED_ID,
      },
      idempotencyKey: `player-sim-start-${playerId}-${Date.now()}`,
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

  private async runSimFarmCycle(playerId: string): Promise<RobotActionResult> {
    await this.fieldLifecycleService.settlePlayerFields(this.prisma.db, playerId);

    let harvestedCount = 0;
    let plantedCount = 0;
    let collectedGold = 0;
    const harvestedFieldIds: string[] = [];
    const plantedFieldIds: string[] = [];

    while (true) {
      const matureField = await this.prisma.db.playerFieldSlot.findFirst({
        where: { playerId, status: { in: ['MATURE', 'WITHERED'] }, isUnlocked: true },
        orderBy: { slotIndex: 'asc' },
        select: { id: true, status: true },
      });
      if (!matureField) {
        break;
      }

      const wallet = await this.prisma.db.playerWallet.findUniqueOrThrow({
        where: { playerId },
        select: { balanceVersion: true },
      });
      const result = await this.clientCommandService.collectField({
        playerId,
        request: {
          fieldId: matureField.id,
          walletVersion: wallet.balanceVersion,
          collectMode: 'ripe',
          requestIdempotencyKey: `player-sim-farm-collect-${playerId}-${matureField.id}-${Date.now()}`,
        },
      });
      harvestedCount += 1;
      collectedGold += result.result.collectedGold;
      harvestedFieldIds.push(matureField.id);
      await this.fieldLifecycleService.settlePlayerFields(this.prisma.db, playerId);
    }

    while (true) {
      const emptyField = await this.prisma.db.playerFieldSlot.findFirst({
        where: { playerId, status: 'EMPTY', isUnlocked: true },
        orderBy: { slotIndex: 'asc' },
        select: { id: true },
      });
      if (!emptyField) {
        break;
      }

      await this.clientCommandService.startCultivation({
        playerId,
        request: {
          fieldId: emptyField.id,
          plantType: ROBOT_SEED_ID,
        },
        idempotencyKey: `player-sim-farm-start-${playerId}-${emptyField.id}-${Date.now()}`,
      });
      plantedCount += 1;
      plantedFieldIds.push(emptyField.id);
      await this.fieldLifecycleService.settlePlayerFields(this.prisma.db, playerId);
    }

    const counts = await this.getPlayerFieldStatusCounts(playerId);
    return {
      actionName: 'farm-cycle',
      resultSummary: {
        summary: `农田循环完成：收获 ${harvestedCount} 块，播种 ${plantedCount} 块。`,
        harvestedCount,
        plantedCount,
        collectedGold,
        harvestedFieldIds,
        plantedFieldIds,
        seedId: ROBOT_SEED_ID,
        ...counts,
      },
    };
  }

  private async getPlayerFieldStatusCounts(playerId: string): Promise<{ matureFields: number; growingFields: number; emptyFields: number }> {
    await this.fieldLifecycleService.settlePlayerFields(this.prisma.db, playerId);
    const fields = await this.prisma.db.playerFieldSlot.findMany({
      where: { playerId, isUnlocked: true },
      select: { status: true },
    });
    const counts = countFieldStatuses(fields);
    return {
      matureFields: counts.mature,
      growingFields: counts.growing,
      emptyFields: counts.empty,
    };
  }

  private async runSimRecruitArmy(playerId: string): Promise<RobotActionResult> {
    const [wallet, army] = await Promise.all([
      this.prisma.db.playerWallet.findUniqueOrThrow({
        where: { playerId },
        select: { balanceVersion: true, vaultGold: true },
      }),
      this.prisma.db.playerArmy.findUniqueOrThrow({
        where: { playerId },
        select: { armyVersion: true, totalCount: true, capacity: true },
      }),
    ]);

    if (army.totalCount >= army.capacity) {
      throw new RobotProgressionBlockError('兵力容量已满，当前不能继续练兵。', {
        reason: 'army_capacity_full',
        totalCount: army.totalCount,
        capacity: army.capacity,
      });
    }

    if (wallet.vaultGold <= 0) {
      throw new RobotProgressionBlockError('金库金币不足，当前不能练兵。', {
        reason: 'insufficient_vault_gold',
      });
    }

    const result = await this.clientCommandService.recruitArmy({
      playerId,
      request: {
        recruitCount: 5,
        walletVersion: wallet.balanceVersion,
        armyVersion: army.armyVersion,
        requestIdempotencyKey: `player-sim-recruit-${playerId}-${Date.now()}`,
      },
    });

    return {
      actionName: 'recruit-army',
      resultSummary: {
        summary: result.summary,
        requestedCount: 5,
        beforeTotalCount: army.totalCount,
        capacity: army.capacity,
      },
    };
  }

  private async runSimFriendFieldAssist(helperPlayerId: string, targetPlayerId: string): Promise<RobotActionResult> {
    try {
      return await this.runFriendFieldAssist(helperPlayerId, targetPlayerId);
    } catch (error) {
      if (error instanceof RobotProgressionBlockError && error.details.reason === 'no_friend_field_assist_available') {
        return {
          actionName: 'wait-friend-field-assist',
          resultSummary: {
            summary: '好友当前没有可助力田地，等待好友田地成长。',
            reason: 'no_friend_field_assist_available',
            targetPlayerId,
          },
        };
      }
      throw error;
    }
  }

  private async runSimNoCrossFactionRaidTarget(playerId: string): Promise<RobotActionResult> {
    return {
      actionName: 'raid-target',
      resultSummary: {
        summary: '当前没有可用的跨阵营掠夺目标，本轮跳过掠夺。',
        playerId,
        reason: 'no_cross_faction_target',
      },
    };
  }

  private async recordPlayerSimSnapshots(
    runId: string,
    players: Array<{ spec: RobotSpec; playerId: string }>,
  ): Promise<void> {
    const logs = await this.prisma.db.robotActionLog.findMany({
      where: { runId },
      select: {
        playerId: true,
        actionName: true,
        status: true,
        errorCode: true,
        errorMessage: true,
      },
    });
    const logsByPlayerId = new Map<string, typeof logs>();
    for (const log of logs) {
      const items = logsByPlayerId.get(log.playerId) ?? [];
      items.push(log);
      logsByPlayerId.set(log.playerId, items);
    }

    for (const player of players) {
      const state = await this.prisma.db.player.findUniqueOrThrow({
        where: { id: player.playerId },
        select: {
          faction: { select: { code: true } },
          wallet: { select: { vaultGold: true, walletGold: true } },
          factionMembers: {
            take: 1,
            select: { contributionScore: true },
          },
          spiritResource: {
            select: {
              spiritSoul: true,
              spiritRoot: true,
              spiritMarrow: true,
              spiritJade: true,
              ordinarySoul: true,
              rareSoul: true,
              legendarySoul: true,
            },
          },
          spiritSlots: {
            where: { isMain: true, spiritDefinitionId: { not: null } },
            take: 1,
            select: { level: true, exp: true, breakthroughStage: true, satiatedUntil: true },
          },
          army: {
            select: {
              totalCount: true,
              availableCount: true,
              capacity: true,
            },
          },
          trainingQueues: {
            where: { status: 'QUEUED' },
            select: { queuedCount: true },
          },
          fieldSlots: {
            where: { isUnlocked: true },
            select: { status: true },
          },
        },
      });
      const playerLogs = logsByPlayerId.get(player.playerId) ?? [];
      const actionSummary = summarizeActionLogs(playerLogs);
      const fieldStatusCounts = countFieldStatuses(state.fieldSlots);
      const mainSpirit = state.spiritSlots[0] ?? null;
      const snapshotSummary = {
        ...actionSummary,
        resources: {
          spiritRoot: state.spiritResource?.spiritRoot ?? 0,
          spiritMarrow: state.spiritResource?.spiritMarrow ?? 0,
          spiritJade: state.spiritResource?.spiritJade ?? 0,
        },
        spirit: {
          exp: mainSpirit?.exp ?? null,
          satiatedUntil: mainSpirit?.satiatedUntil?.toISOString() ?? null,
        },
      };
      await this.prisma.db.robotSimSnapshot.create({
        data: {
          runId,
          mode: PLAYER_SIM_V1_MODE,
          robotKey: player.spec.robotKey,
          playerId: player.playerId,
          factionCode: state.faction?.code ?? null,
          vaultGold: state.wallet?.vaultGold ?? 0,
          walletGold: state.wallet?.walletGold ?? 0,
          contributionScore: state.factionMembers[0]?.contributionScore ?? 0,
          spiritSoul: state.spiritResource?.spiritSoul ?? 0,
          ordinarySoul: state.spiritResource?.ordinarySoul ?? 0,
          rareSoul: state.spiritResource?.rareSoul ?? 0,
          legendarySoul: state.spiritResource?.legendarySoul ?? 0,
          mainSpiritLevel: mainSpirit?.level ?? null,
          mainSpiritStage: mainSpirit?.breakthroughStage ?? null,
          armyTotal: state.army?.totalCount ?? 0,
          armyAvailable: state.army?.availableCount ?? 0,
          armyCapacity: state.army?.capacity ?? 0,
          queuedArmy: state.trainingQueues.reduce((sum, item) => sum + item.queuedCount, 0),
          matureFields: fieldStatusCounts.mature,
          growingFields: fieldStatusCounts.growing,
          emptyFields: fieldStatusCounts.empty,
          successActionCount: actionSummary.success,
          blockedActionCount: actionSummary.blocked,
          failedActionCount: actionSummary.failed,
          actionSummaryJson: snapshotSummary as Prisma.InputJsonValue,
        },
      });
    }
  }

  private async runSpirit(playerId: string): Promise<RobotActionResult> {
    const slot = await this.prisma.db.playerSpiritSlot.findFirst({
      where: { playerId, spiritDefinitionId: { not: null } },
      orderBy: { slotIndex: 'asc' },
      select: { slotIndex: true, slotVersion: true, level: true, isMain: true },
    });
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

    return this.runDailySpiritGrowth(playerId, ['挂机自动结算']);
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

  private async prepareSocialFriendLinks(players: Array<{ playerId: string }>): Promise<RobotActionResult> {
    const now = new Date();
    await this.prisma.db.$transaction(async (client) => {
      for (let index = 0; index < players.length; index += 1) {
        const first = players[index];
        const second = players[(index + 1) % players.length];
        await upsertRobotFriendPair(client, {
          firstPlayerId: first.playerId,
          secondPlayerId: second.playerId,
          sourceType: 'robot-social-3',
          now,
        });
      }
    });

    return {
      actionName: 'friend-link',
      resultSummary: {
        summary: '已准备三名机器人之间的好友关系。',
        relationCount: players.length,
      },
    };
  }

  private async runFriendFieldAssist(helperPlayerId: string, targetPlayerId: string): Promise<RobotActionResult> {
    const visit = await this.socialService.visitFriendFields(helperPlayerId, { targetPlayerId });
    const harvestField = visit.fields.find((field) => field.canHarvest);
    if (harvestField) {
      const result = await this.socialService.harvestField(helperPlayerId, {
        targetPlayerId,
        fieldSlotId: harvestField.fieldSlotId,
        requestIdempotencyKey: `robot-social-harvest-${helperPlayerId}-${Date.now()}`,
      });
      return {
        actionName: 'friend-field-assist',
        resultSummary: {
          summary: result.summary,
          assistType: result.assist.assistType,
          targetPlayerId,
          fieldSlotId: harvestField.fieldSlotId,
          rewards: result.rewards,
        },
      };
    }

    const waterField = visit.fields.find((field) => field.canWater);
    if (waterField) {
      const result = await this.socialService.waterField(helperPlayerId, {
        targetPlayerId,
        fieldSlotId: waterField.fieldSlotId,
        requestIdempotencyKey: `robot-social-water-${helperPlayerId}-${Date.now()}`,
      });
      return {
        actionName: 'friend-field-assist',
        resultSummary: {
          summary: result.summary,
          assistType: result.assist.assistType,
          targetPlayerId,
          fieldSlotId: waterField.fieldSlotId,
        },
      };
    }

    throw new RobotProgressionBlockError('好友当前没有可采摘或可浇水的田地。', {
      reason: 'no_friend_field_assist_available',
      targetPlayerId,
    });
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

  private async runDailySpiritGrowth(
    playerId: string,
    sourceSummaries: string[],
    options: { blockOnBreakthrough?: boolean; feedWhenPossible?: boolean } = {},
  ): Promise<RobotActionResult> {
    const state = await this.spiritService.getSpiritState(playerId);
    const mainSlot = state.mainSlot;
    if (!mainSlot) {
      throw new Error('No main spirit available for daily robot.');
    }

    const requirement = state.breakthroughRequirement;
    if (mainSlot.isAtBreakthroughNode && requirement) {
      if (!requirement.canBreakthrough) {
        if (options.blockOnBreakthrough === false) {
          return {
            actionName: 'wait-spirit-breakthrough-material',
            resultSummary: {
              summary: `灵宠到达突破节点，等待 ${requirement.label} x${Math.max(requirement.required - requirement.owned, 0)}。`,
              level: mainSlot.level,
              breakthroughStage: mainSlot.breakthroughStage,
              required: requirement.required,
              owned: requirement.owned,
              quality: requirement.quality,
              sources: sourceSummaries,
            },
          };
        }
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

    if (options.feedWhenPossible && Number(state.spiritRoot ?? 0) >= 10 && mainSlot.satiatedRemainingSeconds < 2 * 60 * 60) {
      const result = await this.spiritService.feedSpirit(playerId, {
        slotIndex: mainSlot.slotIndex,
        actionType: 'feed_once',
        slotVersion: mainSlot.slotVersion,
        resourceVersion: state.resourceVersion,
        requestIdempotencyKey: `robot-feed-spirit-${playerId}-${Date.now()}`,
      });
      return {
        actionName: 'feed-spirit',
        resultSummary: {
          summary: result.summary,
          level: result.spirit.mainSlot?.level ?? mainSlot.level,
          exp: result.spirit.mainSlot?.exp ?? mainSlot.exp,
          spiritRoot: result.spirit.spiritRoot ?? null,
          satiatedRemainingSeconds: result.spirit.mainSlot?.satiatedRemainingSeconds ?? null,
          sources: sourceSummaries,
        },
      };
    }

    return {
      actionName: 'spirit-idle-progress',
      resultSummary: {
        summary: '灵宠挂机进度已结算，当前未到突破节点。',
        level: mainSlot.level,
        exp: mainSlot.exp,
        breakthroughStage: mainSlot.breakthroughStage,
        satiatedRemainingSeconds: mainSlot.satiatedRemainingSeconds,
        sources: sourceSummaries,
      },
    };

/*
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
*/
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

  private async prepareSocialRobotPlayer(spec: RobotSpec, playerId: string): Promise<void> {
    await this.prepareDailyRobotPlayer(spec, playerId);
    await this.prisma.transaction(async (client) => {
      const seed = await client.seedDefinition.findUniqueOrThrow({ where: { seedId: ROBOT_SEED_ID } });
      const now = Date.now();
      const cycleStartedAt = new Date(now);
      const growingReadyAt = new Date(now + 60 * 60 * 1000);
      await client.playerFieldSlot.update({
        where: {
          playerId_slotIndex: {
            playerId,
            slotIndex: 1,
          },
        },
        data: {
          isUnlocked: true,
          status: 'MATURE',
          seedDefinitionId: seed.id,
          currentClaimableGold: 200,
          seedAt: cycleStartedAt,
          matureAt: cycleStartedAt,
          readyAt: cycleStartedAt,
          lastCalculatedAt: cycleStartedAt,
          statusVersion: { increment: 1 },
        },
      });
      await client.playerFieldSlot.upsert({
        where: {
          playerId_slotIndex: {
            playerId,
            slotIndex: 2,
          },
        },
        create: {
          playerId,
          slotIndex: 2,
          isUnlocked: true,
          unlockCastleLevel: 1,
          status: 'GROWING',
          seedDefinitionId: seed.id,
          investedGold: 0,
          currentClaimableGold: 120,
          seedAt: cycleStartedAt,
          matureAt: growingReadyAt,
          readyAt: growingReadyAt,
          lastCalculatedAt: cycleStartedAt,
        },
        update: {
          isUnlocked: true,
          status: 'GROWING',
          seedDefinitionId: seed.id,
          currentClaimableGold: 120,
          seedAt: cycleStartedAt,
          matureAt: growingReadyAt,
          readyAt: growingReadyAt,
          lastCalculatedAt: cycleStartedAt,
          statusVersion: { increment: 1 },
        },
      });
    });
  }

  private async preparePlayerSimRobot(spec: RobotSpec, playerId: string): Promise<void> {
    await this.prisma.transaction(async (client) => {
      const seed = await client.seedDefinition.findUniqueOrThrow({ where: { seedId: ROBOT_SEED_ID } });
      const spirit = await client.spiritDefinition.findUniqueOrThrow({ where: { spiritId: ROBOT_STARTER_SPIRIT_ID } });
      const now = Date.now();
      const matureAt = new Date(now - 5 * 60 * 1000);

      await client.player.update({
        where: { id: playerId },
        data: {
          nickname: spec.nickname,
          protectedUntil: new Date(0),
          castleLevelCache: 10,
        },
      });

      await client.playerWallet.upsert({
        where: { playerId },
        create: {
          playerId,
          vaultGold: 500,
          vaultCapacity: 10000,
          walletGold: 0,
          walletCapacity: 1000,
        },
        update: {
          vaultGold: { set: 500 },
          vaultCapacity: { set: 10000 },
          balanceVersion: { increment: 1 },
        },
      });

      await client.playerArmy.upsert({
        where: { playerId },
        create: {
          playerId,
          totalCount: 40,
          availableCount: 40,
          frozenCount: 0,
          woundedCount: 0,
          capacity: 100,
        },
        update: {
          availableCount: { increment: 0 },
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
            seedDefinitionId: seed.id,
          },
        },
        create: {
          playerId,
          seedDefinitionId: seed.id,
          quantity: 20,
          unlockedAt: new Date(),
        },
        update: {
          quantity: { increment: 2 },
          unlockedAt: new Date(),
        },
      });

      await client.playerSpiritResource.upsert({
        where: { playerId },
        create: {
          playerId,
          spiritSoul: 0,
          ordinarySoul: 0,
          rareSoul: 0,
          legendarySoul: 0,
          tianjiTalisman: 0,
        },
        update: {
          spiritSoul: 0,
          ordinarySoul: 0,
          rareSoul: 0,
          legendarySoul: 0,
          tianjiTalisman: 0,
          spiritRoot: 0,
          spiritMarrow: 0,
          spiritJade: 0,
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
          spiritDefinitionId: spirit.id,
          isMain: true,
          level: 1,
          breakthroughStage: 0,
          element: 'WOOD',
          currentHp: 100,
          maxHp: 100,
          status: 'ACTIVE',
          acquiredAt: new Date(),
          lastExpSettledAt: new Date(now - 3 * 60 * 60 * 1000),
        },
        update: {
          spiritDefinitionId: spirit.id,
          isMain: true,
          level: 1,
          exp: 0,
          breakthroughStage: 0,
          element: 'WOOD',
          currentHp: 100,
          maxHp: 100,
          status: 'ACTIVE',
          acquiredAt: new Date(),
          satiatedUntil: null,
          lastExpSettledAt: new Date(now - 3 * 60 * 60 * 1000),
          dissolvedAt: null,
          slotVersion: { increment: 1 },
        },
      });

      for (let slotIndex = 1; slotIndex <= 4; slotIndex += 1) {
        const matureField = slotIndex === 1;
        await client.playerFieldSlot.upsert({
          where: {
            playerId_slotIndex: {
              playerId,
              slotIndex,
            },
          },
          create: {
            playerId,
            slotIndex,
            isUnlocked: true,
            unlockCastleLevel: 1,
            status: matureField ? 'MATURE' : 'EMPTY',
            seedDefinitionId: matureField ? seed.id : null,
            investedGold: 0,
            currentClaimableGold: matureField ? 160 : 0,
            seedAt: matureField ? new Date(now - 60 * 60 * 1000) : null,
            matureAt: matureField ? matureAt : null,
            readyAt: matureField ? matureAt : null,
            lastCalculatedAt: matureField ? matureAt : null,
          },
          update: {
            isUnlocked: true,
            unlockCastleLevel: 1,
            status: matureField ? 'MATURE' : 'EMPTY',
            seedDefinitionId: matureField ? seed.id : null,
            investedGold: 0,
            currentClaimableGold: matureField ? 160 : 0,
            seedAt: matureField ? new Date(now - 60 * 60 * 1000) : null,
            matureAt: matureField ? matureAt : null,
            readyAt: matureField ? matureAt : null,
            overripeAt: null,
            lastCalculatedAt: matureField ? matureAt : null,
            statusVersion: { increment: 1 },
          },
        });
      }
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

  private async persistLoopState(statusOverride?: string): Promise<void> {
    if (!this.loopState.jobId) {
      return;
    }

    await this.prisma.db.robotAutomationJob.update({
      where: { id: this.loopState.jobId },
      data: {
        status: statusOverride ?? (this.loopState.running ? 'RUNNING' : 'STOPPED'),
        intervalSeconds: this.loopState.intervalSeconds,
        maxRounds: this.loopState.maxRounds,
        hardErrorLimit: this.loopState.hardErrorLimit,
        completedRounds: this.loopState.completedRounds,
        consecutiveHardErrors: this.loopState.consecutiveHardErrors,
        lastRunId: this.loopState.lastRunId,
        lastStatus: this.loopState.lastStatus,
        lastError: this.loopState.lastError,
        stopReason: this.loopState.stopReason,
        stoppedAt: this.loopState.stoppedAt ? new Date(this.loopState.stoppedAt) : null,
        lastRunAt: this.loopState.lastRunAt ? new Date(this.loopState.lastRunAt) : null,
        nextRunAt: this.loopState.nextRunAt ? new Date(this.loopState.nextRunAt) : null,
      },
    });
  }

  private async markInterruptedAutomationJobs(): Promise<void> {
    if (this.loopState.running) {
      return;
    }

    await this.prisma.db.robotAutomationJob.updateMany({
      where: {
        mode: { in: [DAILY_3_MODE, SOCIAL_3_MODE, PLAYER_SIM_V1_MODE] },
        status: 'RUNNING',
      },
      data: {
        status: 'INTERRUPTED',
        stopReason: '服务重启，进程内循环状态已丢失',
        stoppedAt: new Date(),
        nextRunAt: null,
      },
    });
  }

  private async getOrCreateAutomationConfig(mode: RobotAutomationMode): Promise<{
    id: string;
    mode: string;
    enabled: boolean;
    intervalSeconds: number;
    maxRounds: number;
    hardErrorLimit: number;
    autoStartOnBoot: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> {
    return this.prisma.db.robotAutomationConfig.upsert({
      where: { mode },
      create: {
        id: getAutomationConfigId(mode),
        mode,
        enabled: false,
        intervalSeconds: mode === PLAYER_SIM_V1_MODE ? 5 : 10,
        maxRounds: mode === PLAYER_SIM_V1_MODE ? 0 : 20,
        hardErrorLimit: 3,
        autoStartOnBoot: false,
      },
      update: {},
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

function createIdleLoopState(): RobotLoopState {
  return {
    running: false,
    jobId: null,
    mode: null,
    intervalSeconds: 10,
    maxRounds: 20,
    completedRounds: 0,
    startedAt: null,
    stoppedAt: null,
    lastRunAt: null,
    nextRunAt: null,
    lastRunId: null,
    lastStatus: null,
    lastError: null,
    stopReason: null,
    consecutiveHardErrors: 0,
    hardErrorLimit: 3,
  };
}

function getAutomationConfigId(mode: RobotAutomationMode): string {
  if (mode === PLAYER_SIM_V1_MODE) return PLAYER_SIM_V1_CONFIG_ID;
  return mode === SOCIAL_3_MODE ? SOCIAL_3_CONFIG_ID : DAILY_3_CONFIG_ID;
}

function getAutomationModeName(mode: RobotAutomationMode): string {
  if (mode === PLAYER_SIM_V1_MODE) return '勤奋玩家模拟 v1';
  return mode === SOCIAL_3_MODE ? '3 阵营社交助力' : '3 阵营日常循环';
}

function findNextCrossFactionPlayer<T extends { spec: RobotSpec; playerId: string }>(players: T[], currentIndex: number): T | null {
  const current = players[currentIndex];
  if (!current || players.length <= 1) {
    return null;
  }

  for (let offset = 1; offset < players.length; offset += 1) {
    const candidate = players[(currentIndex + offset) % players.length];
    if (candidate && candidate.spec.factionCode !== current.spec.factionCode) {
      return candidate;
    }
  }

  return null;
}

function parseLoopStartPayload(body: unknown): { intervalSeconds: number; maxRounds: number; hardErrorLimit: number } {
  const record = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
  return {
    intervalSeconds: parseBoundedInteger(record.intervalSeconds, 10, 3, 3600),
    maxRounds: parseBoundedInteger(record.maxRounds, 20, 0, 100000),
    hardErrorLimit: parseBoundedInteger(record.hardErrorLimit, 3, 1, 20),
  };
}

function parseAutomationConfigPayload(body: unknown, fallback: RobotAutomationConfigPayload): RobotAutomationConfigPayload {
  const record = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
  return {
    enabled: parseBoolean(record.enabled, fallback.enabled),
    intervalSeconds: parseBoundedInteger(record.intervalSeconds, fallback.intervalSeconds, 3, 3600),
    maxRounds: parseBoundedInteger(record.maxRounds, fallback.maxRounds, 0, 100000),
    hardErrorLimit: parseBoundedInteger(record.hardErrorLimit, fallback.hardErrorLimit, 1, 20),
    autoStartOnBoot: parseBoolean(record.autoStartOnBoot, fallback.autoStartOnBoot),
  };
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function parseBoundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const normalized = typeof value === 'string' ? Number(value.trim()) : value;
  if (!Number.isInteger(normalized)) {
    return fallback;
  }
  return Math.min(Math.max(Number(normalized), min), max);
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

function summarizeActionLogs(logs: Array<{
  actionName: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
}>): {
  success: number;
  blocked: number;
  failed: number;
  byAction: Record<string, { success: number; blocked: number; failed: number }>;
  issues: Array<{ actionName: string; status: string; errorCode: string | null; errorMessage: string | null }>;
} {
  const summary = {
    success: 0,
    blocked: 0,
    failed: 0,
    byAction: {} as Record<string, { success: number; blocked: number; failed: number }>,
    issues: [] as Array<{ actionName: string; status: string; errorCode: string | null; errorMessage: string | null }>,
  };
  for (const log of logs) {
    const item = summary.byAction[log.actionName] ?? { success: 0, blocked: 0, failed: 0 };
    if (log.status === 'SUCCESS') {
      summary.success += 1;
      item.success += 1;
    } else if (log.status === 'BLOCKED') {
      summary.blocked += 1;
      item.blocked += 1;
      summary.issues.push(log);
    } else {
      summary.failed += 1;
      item.failed += 1;
      summary.issues.push(log);
    }
    summary.byAction[log.actionName] = item;
  }
  return summary;
}

function countFieldStatuses(fields: Array<{ status: string }>): { mature: number; growing: number; empty: number } {
  return fields.reduce((counts, field) => {
    if (field.status === 'MATURE' || field.status === 'WITHERED') counts.mature += 1;
    if (field.status === 'GROWING') counts.growing += 1;
    if (field.status === 'EMPTY') counts.empty += 1;
    return counts;
  }, { mature: 0, growing: 0, empty: 0 });
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

function mapAutomationJob(job: {
  id: string;
  name: string;
  mode: string;
  status: string;
  intervalSeconds: number;
  maxRounds: number;
  hardErrorLimit: number;
  completedRounds: number;
  consecutiveHardErrors: number;
  lastRunId: string | null;
  lastStatus: string | null;
  lastError: string | null;
  stopReason: string | null;
  startedAt: Date;
  stoppedAt: Date | null;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
}): Record<string, unknown> {
  return {
    id: job.id,
    name: job.name,
    mode: job.mode,
    status: job.status,
    intervalSeconds: job.intervalSeconds,
    maxRounds: job.maxRounds,
    hardErrorLimit: job.hardErrorLimit,
    completedRounds: job.completedRounds,
    consecutiveHardErrors: job.consecutiveHardErrors,
    lastRunId: job.lastRunId,
    lastStatus: job.lastStatus,
    lastError: job.lastError,
    stopReason: job.stopReason,
    startedAt: job.startedAt.toISOString(),
    stoppedAt: job.stoppedAt?.toISOString() ?? null,
    lastRunAt: job.lastRunAt?.toISOString() ?? null,
    nextRunAt: job.nextRunAt?.toISOString() ?? null,
  };
}

function mapAutomationConfig(config: {
  id: string;
  mode: string;
  enabled: boolean;
  intervalSeconds: number;
  maxRounds: number;
  hardErrorLimit: number;
  autoStartOnBoot: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    id: config.id,
    mode: config.mode,
    enabled: config.enabled,
    intervalSeconds: config.intervalSeconds,
    maxRounds: config.maxRounds,
    hardErrorLimit: config.hardErrorLimit,
    autoStartOnBoot: config.autoStartOnBoot,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

async function upsertRobotFriendPair(
  client: Prisma.TransactionClient,
  input: {
    firstPlayerId: string;
    secondPlayerId: string;
    sourceType: string;
    now: Date;
  },
): Promise<void> {
  if (input.firstPlayerId === input.secondPlayerId) {
    return;
  }

  await Promise.all([
    client.playerSocialRelation.upsert({
      where: {
        playerId_targetPlayerId_relationType: {
          playerId: input.firstPlayerId,
          targetPlayerId: input.secondPlayerId,
          relationType: SocialRelationType.FRIEND,
        },
      },
      create: {
        playerId: input.firstPlayerId,
        targetPlayerId: input.secondPlayerId,
        relationType: SocialRelationType.FRIEND,
        status: SocialRelationStatus.ACTIVE,
        sourceType: input.sourceType,
        intimacy: 20,
        lastInteractedAt: input.now,
      },
      update: {
        status: SocialRelationStatus.ACTIVE,
        sourceType: input.sourceType,
        lastInteractedAt: input.now,
      },
    }),
    client.playerSocialRelation.upsert({
      where: {
        playerId_targetPlayerId_relationType: {
          playerId: input.secondPlayerId,
          targetPlayerId: input.firstPlayerId,
          relationType: SocialRelationType.FRIEND,
        },
      },
      create: {
        playerId: input.secondPlayerId,
        targetPlayerId: input.firstPlayerId,
        relationType: SocialRelationType.FRIEND,
        status: SocialRelationStatus.ACTIVE,
        sourceType: input.sourceType,
        intimacy: 20,
        lastInteractedAt: input.now,
      },
      update: {
        status: SocialRelationStatus.ACTIVE,
        sourceType: input.sourceType,
        lastInteractedAt: input.now,
      },
    }),
  ]);
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
  if (key === 'social') return '社交';
  if (key === 'sim') return '勤奋玩家';
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
  if (key === 'friend-link') return '好友关系';
  if (key === 'friend-field-assist') return '灵田助力';
  if (key === 'recruit-army') return '练兵';
  if (key === 'farmer') return '种田';
  if (key === 'spirit') return '养宠';
  if (key === 'raid') return '掠夺';
  if (key === 'social') return '社交';
  if (key === 'sim') return '勤奋玩家';
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
