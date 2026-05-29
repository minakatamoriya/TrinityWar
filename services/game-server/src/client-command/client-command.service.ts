import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  APP_NAME,
  type ClientClaimStarterSeedResponse,
  type ClientClaimDailyTaskResponse,
  type ClientClaimFactionStipendResponse,
  type ClientClaimPendingResponse,
  type ClientCollectFieldResponse,
  type ClientCollectRewardItem,
  type ClientFactionTaskSubmitResponse,
  type ClientFactionStipendReward,
  type ClientFactionDonateRequest,
  type ClientResetDemoStateResponse,
  type ClientStateMutationResponse,
  type ClientUnlockPlantResponse,
} from '@trinitywar/shared';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { DailyFactionTaskLifecycleService } from '../client-read/daily-faction-task-lifecycle.service.js';
import { DailyTaskLifecycleService } from '../client-read/daily-task-lifecycle.service.js';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';
import { LandDeedService } from '../land-deed/land-deed.service.js';
import { getLocalDateKey } from '../lib/date-key.js';
import { DAILY_TASK_CONFIG, GAME_BALANCE, getFactionAdvantageConfig, getFactionStipendTier, getSeedStageGold, getSeedStageSeconds } from '../lib/game-balance.js';
import { getVaultCapacityGain } from '../lib/game-balance.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlayerInitializationService } from '../seed/player-initialization.service.js';
import { SEED_DEFINITION_SEEDS } from '../seed/seed-data/seeds.js';
import { ClientReadService } from '../client-read/client-read.service.js';
import { ArmyTrainingLifecycleService } from '../client-read/army-training-lifecycle.service.js';
import { FieldLifecycleService } from '../client-read/field-lifecycle.service.js';
import {
  BuildingUpgradeRuleService,
  type BuildingUpgradeTarget,
  type PlayerBuildingStateForUpgrade,
} from './building-upgrade-rule.service.js';
import { FieldCommandRuleService } from './field-command-rule.service.js';
import type { ClaimDailyTaskRequestDto, ClaimFactionStipendRequestDto, ClaimPendingRequestDto, ClaimStarterSeedRequestDto, CollectFieldRequestDto, FactionTaskSubmitRequestDto, RecruitArmyRequestDto, StartCultivationRequestDto, UnlockPlantRequestDto, UpgradeBuildingRequestDto } from './dto.js';

interface ClaimPendingCommandInput {
  playerId: string;
  request: ClaimPendingRequestDto;
  idempotencyKey?: string;
}

interface ClaimDailyTaskCommandInput {
  playerId: string;
  request: ClaimDailyTaskRequestDto;
  idempotencyKey?: string;
}

interface ClaimStarterSeedCommandInput {
  playerId: string;
  request: ClaimStarterSeedRequestDto;
  idempotencyKey?: string;
}

interface UpgradeBuildingCommandInput {
  playerId: string;
  request: UpgradeBuildingRequestDto;
  idempotencyKey?: string;
}

interface CollectFieldCommandInput {
  playerId: string;
  request: CollectFieldRequestDto;
  idempotencyKey?: string;
}

interface StartCultivationCommandInput {
  playerId: string;
  request: StartCultivationRequestDto;
  idempotencyKey?: string;
}

interface RecruitArmyCommandInput {
  playerId: string;
  request: RecruitArmyRequestDto;
  idempotencyKey?: string;
}

interface FactionDonateCommandInput {
  playerId: string;
  request: ClientFactionDonateRequest;
}

interface FactionTaskSubmitCommandInput {
  playerId: string;
  request: FactionTaskSubmitRequestDto;
  idempotencyKey?: string;
}

interface ClaimFactionStipendCommandInput {
  playerId: string;
  request: ClaimFactionStipendRequestDto;
  idempotencyKey?: string;
}

interface UnlockPlantCommandInput {
  playerId: string;
  request: UnlockPlantRequestDto;
  idempotencyKey?: string;
}

type ResolvableStipendReward = ClientFactionStipendReward & {
  seedPoolIds?: string[];
  essencePoolIds?: string[];
  spiritPoolIds?: string[];
};

const TUTORIAL_STARTER_SEED_ID = 'qilingya';
const TUTORIAL_STARTER_SEED_FALLBACK_ID = 'qinglingmai';
const TUTORIAL_STARTER_SEED_QUANTITY = 1;

@Injectable()
export class ClientCommandService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(IdempotencyService) private readonly idempotencyService: IdempotencyService,
    @Inject(BuildingUpgradeRuleService) private readonly buildingUpgradeRuleService: BuildingUpgradeRuleService,
    @Inject(FieldCommandRuleService) private readonly fieldCommandRuleService: FieldCommandRuleService,
    @Inject(ArmyTrainingLifecycleService) private readonly armyTrainingLifecycleService: ArmyTrainingLifecycleService,
    @Inject(FieldLifecycleService) private readonly fieldLifecycleService: FieldLifecycleService,
    @Inject(ClientReadService) private readonly clientReadService: ClientReadService,
    @Inject(DailyTaskLifecycleService) private readonly dailyTaskLifecycleService: DailyTaskLifecycleService,
    @Inject(DailyFactionTaskLifecycleService) private readonly dailyFactionTaskLifecycleService: DailyFactionTaskLifecycleService,
    @Inject(PlayerInitializationService) private readonly playerInitializationService: PlayerInitializationService,
    @Inject(LandDeedService) private readonly landDeedService: LandDeedService,
  ) {}

  async claimPending(input: ClaimPendingCommandInput): Promise<ClientClaimPendingResponse> {
    validateClaimPendingRequest(input.request);
    const endpointKey = 'client.actions.claim-pending';
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey ?? input.request.requestIdempotencyKey);
    const requestHash = hashClaimPendingRequest(input.request);

    return this.prisma.transaction<ClientClaimPendingResponse>(async (client) => {
      const idempotencyRecord = idempotencyKey
        ? await this.prepareIdempotencyRecord(client, input.playerId, endpointKey, idempotencyKey, requestHash)
        : null;

      if (idempotencyRecord?.status === 'completed') {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientClaimPendingResponse;
      }

      const wallet = await client.playerWallet.findUnique({
        where: { playerId: input.playerId },
        select: {
          vaultGold: true,
          vaultCapacity: true,
          pendingTaxGold: true,
          pendingDividendGold: true,
          pendingRaidOverflowGold: true,
          pendingRaidOverflowExpiresAt: true,
          balanceVersion: true,
        },
      });

      if (!wallet) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Player wallet state not found.',
          statusCode: 404,
        });
      }

      assertVersion('walletVersion', input.request.walletVersion, wallet.balanceVersion);

      const pendingGold = getPendingGoldBySource(wallet, input.request.source);
      if (pendingGold <= 0) {
        throw new BusinessError({
          code: ErrorCode.NoPendingClaim,
          message: 'No pending gold available for claim.',
          statusCode: 409,
        });
      }

      const claimedGold = pendingGold;
      const overflowGold = 0;

      const nextVaultGold = wallet.vaultGold + claimedGold;
      const nextPendingGold = 0;
      const walletUpdateData = buildPendingClaimWalletUpdate(input.request.source, nextVaultGold, nextPendingGold);
      const nextBalanceVersion = claimedGold > 0 ? wallet.balanceVersion + 1 : wallet.balanceVersion;

      await client.playerWallet.update({
        where: { playerId: input.playerId },
        data: walletUpdateData,
      });

      if (claimedGold > 0) {
        await this.auditService.createWalletChangeLog(client, {
          playerId: input.playerId,
          walletBucket: 'vault',
          changeType: 'claim-pending',
          deltaGold: claimedGold,
          beforeGold: wallet.vaultGold,
          afterGold: nextVaultGold,
          relatedEntityType: 'pending-claim',
          relatedEntityId: input.request.source,
          requestIdempotencyKey: idempotencyKey,
          note: `Claim pending gold from ${input.request.source}.`,
        });
      }

      const responseSnapshot = await this.buildClaimPendingResponse(client, input.playerId, {
        summary: buildClaimPendingSummary(input.request.source, claimedGold, nextPendingGold, overflowGold),
        source: input.request.source,
        claimedGold,
        remainingPendingGold: nextPendingGold,
        ledger: {
          ...wallet,
          vaultGold: nextVaultGold,
          pendingTaxGold: input.request.source === 'tax' ? nextPendingGold : wallet.pendingTaxGold,
          pendingDividendGold: input.request.source === 'faction' ? nextPendingGold : wallet.pendingDividendGold,
          pendingRaidOverflowGold: input.request.source === 'raid-overflow' ? nextPendingGold : wallet.pendingRaidOverflowGold,
          pendingRaidOverflowExpiresAt: input.request.source === 'raid-overflow' && nextPendingGold <= 0 ? null : wallet.pendingRaidOverflowExpiresAt,
          balanceVersion: nextBalanceVersion,
        },
      });

      if (idempotencyRecord?.id) {
        await this.idempotencyService.markCompleted(client, {
          id: idempotencyRecord.id,
          responseSnapshotJson: responseSnapshot as unknown as Prisma.InputJsonValue,
          businessEntityType: 'pending-claim',
          businessEntityId: input.request.source,
        });
      }

      return responseSnapshot;
    });
  }

  async claimDailyTask(input: ClaimDailyTaskCommandInput): Promise<ClientClaimDailyTaskResponse> {
    validateClaimDailyTaskRequest(input.request);
    const endpointKey = 'client.actions.claim-daily-task';
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey ?? input.request.requestIdempotencyKey);
    const requestHash = hashClaimDailyTaskRequest(input.request);

    return this.prisma.transaction<ClientClaimDailyTaskResponse>(async (client) => {
      const idempotencyRecord = idempotencyKey
        ? await this.prepareIdempotencyRecord(client, input.playerId, endpointKey, idempotencyKey, requestHash)
        : null;

      if (idempotencyRecord?.status === 'completed') {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientClaimDailyTaskResponse;
      }

      const effectiveDateKey = input.request.taskDateKey?.trim() || getLocalDateKey();
      const playerState = await client.player.findUnique({
        where: { id: input.playerId },
        select: {
          wallet: {
            select: {
              vaultGold: true,
              balanceVersion: true,
            },
          },
          taskStates: {
            where: {
              dateKey: effectiveDateKey,
              taskId: input.request.taskId,
            },
            take: 1,
            select: {
              id: true,
              taskId: true,
              dateKey: true,
              rewardGold: true,
              status: true,
            },
          },
        },
      });

      if (!playerState?.wallet) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Player wallet state not found.',
          statusCode: 404,
        });
      }

      assertVersion('walletVersion', input.request.walletVersion, playerState.wallet.balanceVersion);

      const taskState = playerState.taskStates[0] ?? null;
      if (!taskState) {
        throw new BusinessError({
          code: ErrorCode.TaskNotFound,
          message: 'Daily task not found.',
          statusCode: 404,
        });
      }

      if (taskState.status === 'CLAIMED') {
        throw new BusinessError({
          code: ErrorCode.TaskAlreadyClaimed,
          message: 'Daily task reward already claimed.',
          statusCode: 409,
        });
      }

      if (taskState.status !== 'COMPLETED') {
        throw new BusinessError({
          code: ErrorCode.TaskNotCompleted,
          message: 'Daily task is not completed yet.',
          statusCode: 409,
        });
      }

      const rewardGold = taskState.rewardGold;
      const claimedGold = Math.max(rewardGold, 0);
      const overflowGold = 0;

      const nextVaultGold = playerState.wallet.vaultGold + claimedGold;
      await client.playerDailyTaskState.update({
        where: { id: taskState.id },
        data: {
          status: 'CLAIMED',
          claimedAt: new Date(),
        },
      });

      if (claimedGold > 0) {
        await client.playerWallet.update({
          where: { playerId: input.playerId },
          data: {
            vaultGold: nextVaultGold,
            balanceVersion: { increment: 1 },
          },
        });

        await this.auditService.createWalletChangeLog(client, {
          playerId: input.playerId,
          walletBucket: 'vault',
          changeType: 'claim-daily-task',
          deltaGold: claimedGold,
          beforeGold: playerState.wallet.vaultGold,
          afterGold: nextVaultGold,
          relatedEntityType: 'daily-task',
          relatedEntityId: taskState.taskId,
          requestIdempotencyKey: idempotencyKey,
          note: `Claim daily task reward for ${taskState.taskId}.`,
        });
      }

      await this.auditService.createTaskRewardLog(client, {
        playerId: input.playerId,
        taskStateId: taskState.id,
        taskId: taskState.taskId,
        rewardGold,
        requestIdempotencyKey: idempotencyKey,
      });

      const responseSnapshot = await this.buildClaimDailyTaskResponse(client, input.playerId, {
        summary: `${getDailyTaskTitle(taskState.taskId)} 已结算，入账 ${claimedGold} 金币。`,
        taskId: taskState.taskId,
        rewardGold,
        claimedGold,
        overflowGold,
      });

      if (idempotencyRecord?.id) {
        await this.idempotencyService.markCompleted(client, {
          id: idempotencyRecord.id,
          responseSnapshotJson: responseSnapshot as unknown as Prisma.InputJsonValue,
          businessEntityType: 'daily-task',
          businessEntityId: taskState.taskId,
        });
      }

      return responseSnapshot;
    });
  }

  async claimStarterSeeds(input: ClaimStarterSeedCommandInput): Promise<ClientClaimStarterSeedResponse> {
    validateClaimStarterSeedRequest(input.request);
    const endpointKey = 'client.actions.claim-starter-seeds';
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey ?? input.request.requestIdempotencyKey);
    const requestHash = hashClaimStarterSeedRequest(input.request);

    return this.prisma.transaction<ClientClaimStarterSeedResponse>(async (client) => {
      const now = new Date();
      const idempotencyRecord = idempotencyKey
        ? await this.prepareIdempotencyRecord(client, input.playerId, endpointKey, idempotencyKey, requestHash)
        : null;

      if (idempotencyRecord?.status === 'completed') {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientClaimStarterSeedResponse;
      }

      const dateKey = getLocalDateKey();
      const [spiritResource, seedDefinitions] = await Promise.all([
        client.playerSpiritResource.findUnique({
          where: { playerId: input.playerId },
          select: {
            playerId: true,
            dailyStarterSeedClaimDateKey: true,
            resourceVersion: true,
          },
        }),
        client.seedDefinition.findMany({
          where: { seedId: { in: [TUTORIAL_STARTER_SEED_ID, TUTORIAL_STARTER_SEED_FALLBACK_ID] } },
          select: { id: true, seedId: true, label: true },
        }),
      ]);

      if (!spiritResource) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Player spirit resource state not found.',
          statusCode: 404,
        });
      }

      if (spiritResource.dailyStarterSeedClaimDateKey === dateKey) {
        throw new BusinessError({
          code: ErrorCode.TaskAlreadyClaimed,
          message: 'Starter seeds already claimed today.',
          statusCode: 409,
        });
      }

      const seedDefinition = seedDefinitions.find((item) => item.seedId === TUTORIAL_STARTER_SEED_ID)
        ?? seedDefinitions.find((item) => item.seedId === TUTORIAL_STARTER_SEED_FALLBACK_ID)
        ?? null;
      if (!seedDefinition) {
        const createdSeedDefinition = await ensureSeedDefinitionExists(client, TUTORIAL_STARTER_SEED_ID)
          ?? await ensureSeedDefinitionExists(client, TUTORIAL_STARTER_SEED_FALLBACK_ID);
        if (!createdSeedDefinition) {
          throw new BusinessError({
            code: ErrorCode.NotFound,
            message: 'Tutorial starter seed definition not found.',
            statusCode: 404,
          });
        }

        await client.playerSpiritResource.update({
          where: { playerId: input.playerId },
          data: {
            dailyStarterSeedClaimDateKey: dateKey,
            resourceVersion: { increment: 1 },
          },
        });

        await client.playerSeedInventory.upsert({
          where: {
            playerId_seedDefinitionId: {
              playerId: input.playerId,
              seedDefinitionId: createdSeedDefinition.id,
            },
          },
          create: {
            playerId: input.playerId,
            seedDefinitionId: createdSeedDefinition.id,
            quantity: TUTORIAL_STARTER_SEED_QUANTITY,
            unlockedAt: now,
          },
          update: {
            quantity: { increment: TUTORIAL_STARTER_SEED_QUANTITY },
            unlockedAt: now,
            inventoryVersion: { increment: 1 },
          },
        });

        const responseSnapshot: ClientClaimStarterSeedResponse = {
          app: APP_NAME,
          summary: `已领取 ${createdSeedDefinition.label} x${TUTORIAL_STARTER_SEED_QUANTITY}。`,
          bootstrap: await this.clientReadService.getBootstrap(input.playerId, client),
          home: await this.clientReadService.getHomeSummary(input.playerId, client),
          scenes: await this.clientReadService.getSceneContent(input.playerId, client),
        };

        if (idempotencyRecord?.id) {
          await this.idempotencyService.markCompleted(client, {
            id: idempotencyRecord.id,
            responseSnapshotJson: responseSnapshot as unknown as Prisma.InputJsonValue,
            businessEntityType: 'starter-seeds',
            businessEntityId: input.playerId,
          });
        }

        return responseSnapshot;
      }

      await client.playerSpiritResource.update({
        where: { playerId: input.playerId },
        data: {
          dailyStarterSeedClaimDateKey: dateKey,
          resourceVersion: { increment: 1 },
        },
      });

      await client.playerSeedInventory.upsert({
        where: {
          playerId_seedDefinitionId: {
            playerId: input.playerId,
            seedDefinitionId: seedDefinition.id,
          },
        },
        create: {
          playerId: input.playerId,
          seedDefinitionId: seedDefinition.id,
          quantity: TUTORIAL_STARTER_SEED_QUANTITY,
          unlockedAt: now,
        },
        update: {
          quantity: { increment: TUTORIAL_STARTER_SEED_QUANTITY },
          unlockedAt: now,
          inventoryVersion: { increment: 1 },
        },
      });

      const responseSnapshot: ClientClaimStarterSeedResponse = {
        app: APP_NAME,
        summary: `已领取 ${seedDefinition.label} x${TUTORIAL_STARTER_SEED_QUANTITY}。`,
        bootstrap: await this.clientReadService.getBootstrap(input.playerId, client),
        home: await this.clientReadService.getHomeSummary(input.playerId, client),
        scenes: await this.clientReadService.getSceneContent(input.playerId, client),
      };

      if (idempotencyRecord?.id) {
        await this.idempotencyService.markCompleted(client, {
          id: idempotencyRecord.id,
          responseSnapshotJson: responseSnapshot as unknown as Prisma.InputJsonValue,
          businessEntityType: 'starter-seeds',
          businessEntityId: input.playerId,
        });
      }

      return responseSnapshot;
    });
  }

  async collectField(input: CollectFieldCommandInput): Promise<ClientCollectFieldResponse> {
    validateCollectFieldRequest(input.request);
    const endpointKey = 'client.actions.collect-field';
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey ?? input.request.requestIdempotencyKey);
    const requestHash = hashCollectFieldRequest(input.request);

    return this.prisma.transaction<ClientCollectFieldResponse>(async (client) => {
      const idempotencyRecord = idempotencyKey
        ? await this.prepareIdempotencyRecord(client, input.playerId, endpointKey, idempotencyKey, requestHash)
        : null;

      if (idempotencyRecord?.status === 'completed') {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientCollectFieldResponse;
      }

      await this.fieldLifecycleService.settlePlayerFields(client, input.playerId);

      const playerState = await client.player.findUnique({
        where: { id: input.playerId },
        select: {
          wallet: {
            select: {
              vaultGold: true,
              balanceVersion: true,
            },
          },
          fieldSlots: {
            where: { id: input.request.fieldId },
            take: 1,
            select: {
              id: true,
              slotIndex: true,
              isUnlocked: true,
              status: true,
              statusVersion: true,
              currentClaimableGold: true,
              harvestedGoldTotal: true,
              expectedEssenceYield: true,
              stolenEssenceYield: true,
                seedDefinition: {
                  select: {
                    seedId: true,
                    label: true,
                    rarity: true,
                  },
                },
              },
            },
        },
      });

      if (!playerState?.wallet) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Player wallet state not found.',
          statusCode: 404,
        });
      }

      const field = playerState.fieldSlots[0] ?? null;

      if (!field) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Field not found.',
          statusCode: 404,
        });
      }

      assertVersion('fieldVersion', input.request.fieldVersion, field.statusVersion);
      assertVersion('walletVersion', input.request.walletVersion, playerState.wallet.balanceVersion);

      const resolution = this.fieldCommandRuleService.resolveCollectField(field, playerState.wallet, input.request);

      await client.playerFieldSlot.update({
        where: { id: field.id },
        data: {
          status: 'EMPTY',
          seedDefinition: { disconnect: true },
          investedGold: 0,
          currentClaimableGold: 0,
          expectedEssenceYield: 0,
          stolenEssenceYield: 0,
          harvestedEssenceYield: resolution.rewards
            .filter((reward) => reward.kind === 'essence')
            .reduce((sum, reward) => sum + Math.max(Math.floor(reward.quantity), 0), 0),
          lastStolenAt: null,
          harvestedGoldTotal: { increment: resolution.collectedGold + resolution.overflowGold },
          seedAt: null,
          matureAt: null,
          fullMatureAt: null,
          overripeAt: null,
          lastCalculatedAt: new Date(),
          statusVersion: { increment: 1 },
        },
      });

      if (resolution.collectedGold > 0) {
        const nextVaultGold = playerState.wallet.vaultGold + resolution.collectedGold;

        await client.playerWallet.update({
          where: { playerId: input.playerId },
          data: {
            vaultGold: nextVaultGold,
            balanceVersion: { increment: 1 },
          },
        });

        await this.auditService.createWalletChangeLog(client, {
          playerId: input.playerId,
          walletBucket: 'vault',
          changeType: 'collect-field',
          deltaGold: resolution.collectedGold,
          beforeGold: playerState.wallet.vaultGold,
          afterGold: nextVaultGold,
          relatedEntityType: 'field',
          relatedEntityId: field.id,
          requestIdempotencyKey: idempotencyKey,
          note: `Collect ${field.id} with mode ${input.request.collectMode}.`,
        });
      }

      await applyEssenceCollectRewards(client, input.playerId, resolution.rewards, field.id);
      await applySeedCollectRewards(client, input.playerId, resolution.rewards);
      await applySpiritCropRewards(client, input.playerId, resolution.rewards);

      await this.auditService.createFieldHarvestLog(client, {
        playerId: input.playerId,
        fieldSlotId: field.id,
        collectMode: input.request.collectMode,
        collectedGold: resolution.collectedGold,
        overflowGold: resolution.overflowGold,
        rewardItemsJson: resolution.rewards as unknown as Prisma.InputJsonValue,
      });

      if (
        field.seedDefinition?.seedId !== TUTORIAL_STARTER_SEED_ID
        && input.request.collectMode === 'ripe'
        && (field.status === 'MATURE' || field.status === 'WITHERED')
      ) {
        await this.recordDailyTaskProgress(client, input.playerId, 'collect-field');
      }

      await this.landDeedService.reconcilePlayerLandDeeds(client, input.playerId);

      const responseSnapshot: ClientCollectFieldResponse = {
        app: APP_NAME,
        summary: resolution.summary,
        home: await this.clientReadService.getHomeSummary(input.playerId, client),
        scenes: await this.clientReadService.getSceneContent(input.playerId, client),
        result: {
          collectedGold: resolution.collectedGold,
          overflowGold: resolution.overflowGold,
          rewards: resolution.rewards,
        },
      };

      if (idempotencyRecord?.id) {
        await this.idempotencyService.markCompleted(client, {
          id: idempotencyRecord.id,
          responseSnapshotJson: responseSnapshot as unknown as Prisma.InputJsonValue,
          businessEntityType: 'field',
          businessEntityId: field.id,
        });
      }

      return responseSnapshot;
    });
  }

  async startCultivation(input: StartCultivationCommandInput): Promise<ClientStateMutationResponse> {
    validateStartCultivationRequest(input.request);
    const endpointKey = 'client.actions.start-cultivation';
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
    const requestHash = hashStartCultivationRequest(input.request);

    return this.prisma.transaction<ClientStateMutationResponse>(async (client) => {
      const idempotencyRecord = idempotencyKey
        ? await this.prepareIdempotencyRecord(client, input.playerId, endpointKey, idempotencyKey, requestHash)
        : null;

      if (idempotencyRecord?.status === 'completed') {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientStateMutationResponse;
      }

      await this.fieldLifecycleService.settlePlayerFields(client, input.playerId);

      const [field, seedDefinition] = await Promise.all([
        client.playerFieldSlot.findFirst({
          where: {
            id: input.request.fieldId,
            playerId: input.playerId,
          },
          select: {
            id: true,
            slotIndex: true,
            isUnlocked: true,
            status: true,
            statusVersion: true,
            player: {
              select: {
                faction: {
                  select: {
                    code: true,
                  },
                },
              },
            },
          },
        }),
        client.seedDefinition.findUnique({
          where: { seedId: getRequestedPlantType(input.request) },
          select: {
            id: true,
            seedId: true,
            label: true,
            rarity: true,
          },
        }),
      ]);

      if (!field) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Field not found.',
          statusCode: 404,
        });
      }

      if (!seedDefinition) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Seed definition not found.',
          statusCode: 404,
        });
      }

      if (!field.isUnlocked || field.status === 'LOCKED') {
        throw new BusinessError({
          code: ErrorCode.Forbidden,
          message: 'Field is not unlocked.',
          statusCode: 403,
        });
      }

      if (field.status !== 'EMPTY') {
        throw new BusinessError({
          code: ErrorCode.StateVersionConflict,
          message: 'Field is not empty.',
          statusCode: 409,
        });
      }

      const inventory = await client.playerSeedInventory.findUnique({
        where: {
          playerId_seedDefinitionId: {
            playerId: input.playerId,
            seedDefinitionId: seedDefinition.id,
          },
        },
        select: {
          id: true,
          quantity: true,
          unlockedAt: true,
        },
      });

      if (!inventory || !inventory.unlockedAt) {
        throw new BusinessError({
          code: ErrorCode.Forbidden,
          message: 'Seed is not unlocked.',
          statusCode: 403,
        });
      }

      const now = new Date();
      await client.playerFieldSlot.update({
        where: { id: field.id },
        data: {
          status: 'SEEDED',
          seedDefinition: { connect: { id: seedDefinition.id } },
          expectedEssenceYield: getExpectedEssenceYield(seedDefinition.rarity),
          stolenEssenceYield: 0,
          harvestedEssenceYield: 0,
          lastStolenAt: null,
          investedGold: 0,
          currentClaimableGold: getCultivationStageGold(seedDefinition.seedId, 'seeded', field.player?.faction?.code ?? null),
          seedAt: now,
          matureAt: addSeconds(now, getSeedStageSeconds(seedDefinition.seedId, 'seeded')),
          fullMatureAt: null,
          overripeAt: null,
          lastCalculatedAt: now,
          statusVersion: { increment: 1 },
        },
      });

      if (seedDefinition.seedId !== TUTORIAL_STARTER_SEED_ID) {
        await this.recordDailyTaskProgress(client, input.playerId, 'start-cultivation');
        await this.recordDailyTaskProgress(client, input.playerId, 'farm-cycle');
      }

      const responseSnapshot: ClientStateMutationResponse = {
        app: APP_NAME,
        summary: `${seedDefinition.label} 已开始培育。`,
        home: await this.clientReadService.getHomeSummary(input.playerId, client),
        scenes: await this.clientReadService.getSceneContent(input.playerId, client),
      };

      if (idempotencyRecord?.id) {
        await this.idempotencyService.markCompleted(client, {
          id: idempotencyRecord.id,
          responseSnapshotJson: responseSnapshot as unknown as Prisma.InputJsonValue,
          businessEntityType: 'field',
          businessEntityId: field.id,
        });
      }

      return responseSnapshot;
    });
  }

  async recruitArmy(input: RecruitArmyCommandInput): Promise<ClientStateMutationResponse> {
    validateRecruitArmyRequest(input.request);
    const endpointKey = 'client.actions.recruit-army';
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey ?? input.request.requestIdempotencyKey);
    const requestHash = hashRecruitArmyRequest(input.request);

    return this.prisma.transaction<ClientStateMutationResponse>(async (client) => {
      const idempotencyRecord = idempotencyKey
        ? await this.prepareIdempotencyRecord(client, input.playerId, endpointKey, idempotencyKey, requestHash)
        : null;

      if (idempotencyRecord?.status === 'completed') {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientStateMutationResponse;
      }

      await this.armyTrainingLifecycleService.settlePlayerTrainingQueues(client, input.playerId);

      const playerState = await client.player.findUnique({
        where: { id: input.playerId },
        select: {
          wallet: {
            select: {
              vaultGold: true,
              balanceVersion: true,
            },
          },
          army: {
            select: {
              totalCount: true,
              capacity: true,
              armyVersion: true,
            },
          },
          trainingQueues: {
            where: { status: 'QUEUED' },
            orderBy: { finishAt: 'desc' },
            take: 1,
            select: {
              id: true,
              queuedCount: true,
              totalCostGold: true,
              startedAt: true,
              finishAt: true,
            },
          },
        },
      });

      if (!playerState?.wallet || !playerState.army) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Player army or wallet state not found.',
          statusCode: 404,
        });
      }

      assertVersion('walletVersion', input.request.walletVersion, playerState.wallet.balanceVersion);
      assertVersion('armyVersion', input.request.armyVersion, playerState.army.armyVersion);

      const requestedCount = Math.max(Math.floor(input.request.recruitCount), 0);
      if (requestedCount <= 0) {
        throw new BusinessError({
          code: ErrorCode.BadRequest,
          message: 'Recruit count must be greater than zero.',
          statusCode: 400,
        });
      }

      const currentQueue = playerState.trainingQueues[0] ?? null;
      const queuedArmyCount = currentQueue?.queuedCount ?? 0;
      const availableArmySpace = Math.max(playerState.army.capacity - playerState.army.totalCount - queuedArmyCount, 0);
      if (availableArmySpace <= 0) {
        throw new BusinessError({
          code: ErrorCode.ArmyCapacityExceeded,
          message: 'Army capacity is full.',
          statusCode: 409,
        });
      }

      const affordableCount = Math.floor(playerState.wallet.vaultGold / GAME_BALANCE.army.recruitGoldCostPerUnit);
      if (affordableCount <= 0) {
        throw new BusinessError({
          code: ErrorCode.InsufficientVaultGold,
          message: 'Insufficient vault gold.',
          statusCode: 409,
        });
      }

      const actualRecruitCount = Math.min(requestedCount, availableArmySpace, affordableCount);
      const totalCost = actualRecruitCount * GAME_BALANCE.army.recruitGoldCostPerUnit;
      const remainingSeconds = currentQueue
        ? Math.max(Math.ceil((currentQueue.finishAt.getTime() - Date.now()) / 1000), 0)
        : 0;
      const nextTotalSeconds = remainingSeconds + actualRecruitCount * GAME_BALANCE.army.recruitSecondsPerUnit;
      const now = new Date();
      const nextFinishAt = new Date(now.getTime() + nextTotalSeconds * 1000);
      const nextVaultGold = playerState.wallet.vaultGold - totalCost;

      await client.playerWallet.update({
        where: { playerId: input.playerId },
        data: {
          vaultGold: nextVaultGold,
          balanceVersion: { increment: 1 },
        },
      });

      await client.playerArmy.update({
        where: { playerId: input.playerId },
        data: {
          armyVersion: { increment: 1 },
        },
      });

      if (currentQueue) {
        await client.armyTrainingQueue.update({
          where: { id: currentQueue.id },
          data: {
            queuedCount: { increment: actualRecruitCount },
            totalCostGold: { increment: totalCost },
            finishAt: nextFinishAt,
            startedAt: now,
          },
        });
      } else {
        await client.armyTrainingQueue.create({
          data: {
            playerId: input.playerId,
            queuedCount: actualRecruitCount,
            unitCostGold: GAME_BALANCE.army.recruitGoldCostPerUnit,
            totalCostGold: totalCost,
            startedAt: now,
            finishAt: nextFinishAt,
            status: 'QUEUED',
          },
        });
      }

      await this.auditService.createWalletChangeLog(client, {
        playerId: input.playerId,
        walletBucket: 'vault',
        changeType: 'recruit-army',
        deltaGold: -totalCost,
        beforeGold: playerState.wallet.vaultGold,
        afterGold: nextVaultGold,
        relatedEntityType: 'army-training-queue',
        relatedEntityId: currentQueue?.id ?? null,
        requestIdempotencyKey: idempotencyKey,
        note: `Recruit ${actualRecruitCount} army units.`,
      });

      await this.recordDailyTaskProgress(client, input.playerId, 'recruit-army');

      const responseSnapshot: ClientStateMutationResponse = {
        app: APP_NAME,
        summary: actualRecruitCount < requestedCount
          ? `本次新增 ${actualRecruitCount} 名士兵进入训练队列，已立即扣除 ${totalCost} 金币；其余部分受金币或兵力上限限制。`
          : currentQueue
            ? `已追加 ${actualRecruitCount} 名士兵到当前训练队列，金币已立即扣除，剩余训练时间已重算。`
            : `已开始训练 ${actualRecruitCount} 名士兵，金币已立即扣除，倒计时结束后才会增加战力。`,
        home: await this.clientReadService.getHomeSummary(input.playerId, client),
        scenes: await this.clientReadService.getSceneContent(input.playerId, client),
      };

      if (idempotencyRecord?.id) {
        await this.idempotencyService.markCompleted(client, {
          id: idempotencyRecord.id,
          responseSnapshotJson: responseSnapshot as unknown as Prisma.InputJsonValue,
          businessEntityType: 'army-training-queue',
          businessEntityId: currentQueue?.id ?? 'new',
        });
      }

      return responseSnapshot;
    });
  }

  async upgradeBuilding(input: UpgradeBuildingCommandInput): Promise<ClientStateMutationResponse> {
    const endpointKey = 'client.actions.upgrade-building';
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey ?? input.request.requestIdempotencyKey);
    const requestHash = hashRequest(input.request);

    return this.prisma.transaction<ClientStateMutationResponse>(async (client) => {
      const idempotencyRecord = idempotencyKey
        ? await this.prepareIdempotencyRecord(client, input.playerId, endpointKey, idempotencyKey, requestHash)
        : null;

      if (idempotencyRecord?.status === 'completed') {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientStateMutationResponse;
      }

      const playerState = await client.player.findUnique({
        where: { id: input.playerId },
        select: {
          id: true,
          buildings: true,
          wallet: true,
          spiritResource: {
            select: {
              tianjiTalisman: true,
              resourceVersion: true,
            },
          },
        },
      });

      if (!playerState?.buildings || !playerState.wallet) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Player building or wallet state not found.',
          statusCode: 404,
        });
      }

      const target = this.resolveTarget(playerState.buildings, input.request);
      assertVersion('buildingVersion', input.request.buildingVersion, playerState.buildings.buildingVersion);

      if (playerState.buildings.castleLevel < target.requiredCastleLevel) {
        throw new BusinessError({
          code: ErrorCode.Forbidden,
          message: `Castle level ${target.requiredCastleLevel} is required.`,
          statusCode: 403,
        });
      }

      await client.playerBuilding.update({
        where: { playerId: input.playerId },
        data: buildBuildingUpdateData(target),
      });

      if (target.costResource === 'gold') {
        assertVersion('walletVersion', input.request.walletVersion, playerState.wallet.balanceVersion);

        if (playerState.wallet.vaultGold < target.costAmount) {
          throw new BusinessError({
            code: ErrorCode.InsufficientVaultGold,
            message: 'Insufficient vault gold.',
            statusCode: 409,
          });
        }

        const nextVaultGold = playerState.wallet.vaultGold - target.costAmount;
        await client.playerWallet.update({
          where: { playerId: input.playerId },
          data: {
            vaultGold: nextVaultGold,
            vaultCapacity: target.key === 'vault'
              ? playerState.wallet.vaultCapacity + getVaultCapacityGain(target.currentLevel)
              : playerState.wallet.vaultCapacity,
            balanceVersion: { increment: 1 },
          },
        });

        await this.auditService.createWalletChangeLog(client, {
          playerId: input.playerId,
          walletBucket: 'vault',
          changeType: 'upgrade-building',
          deltaGold: -target.costAmount,
          beforeGold: playerState.wallet.vaultGold,
          afterGold: nextVaultGold,
          relatedEntityType: target.isExtension ? 'territory-tech' : 'building',
          relatedEntityId: target.key,
          requestIdempotencyKey: idempotencyKey,
          note: `Upgrade ${target.key} from Lv.${target.currentLevel} to Lv.${target.nextLevel}.`,
        });
      } else {
        if (!playerState.spiritResource) {
          throw new BusinessError({
            code: ErrorCode.NotFound,
            message: 'Player spirit resource not found.',
            statusCode: 404,
          });
        }

        const talismanSpend = await client.playerSpiritResource.updateMany({
          where: {
            playerId: input.playerId,
            tianjiTalisman: { gte: target.costAmount },
          },
          data: {
            tianjiTalisman: { decrement: target.costAmount },
            resourceVersion: { increment: 1 },
          },
        });

        if (talismanSpend.count !== 1) {
          throw new BusinessError({
            code: ErrorCode.Conflict,
            message: 'Insufficient Tianji talisman.',
            statusCode: 409,
          });
        }
      }

      if (target.key === 'castle') {
        await client.player.update({
          where: { id: input.playerId },
          data: { castleLevelCache: target.nextLevel },
        });
      }

      await this.auditService.createBuildingUpgradeLog(client, {
        playerId: input.playerId,
        buildingKey: target.key,
        oldLevel: target.currentLevel,
        newLevel: target.nextLevel,
        costGold: target.costGold,
        requestIdempotencyKey: idempotencyKey,
      });

      await this.recordDailyTaskProgress(client, input.playerId, target.isExtension ? 'upgrade-territory-tech' : 'upgrade-building');
      if (target.key === 'castle' || target.key === 'vault' || target.key === 'watchtower') {
        await this.recordDailyTaskProgress(client, input.playerId, 'upgrade-core-line');
      }
      if (target.key === 'castle' || target.key === 'vault') {
        await this.recordDailyTaskProgress(client, input.playerId, 'upgrade-core-building');
      }
      await this.landDeedService.reconcilePlayerLandDeeds(client, input.playerId);

      const responseSnapshot: ClientStateMutationResponse = {
        app: APP_NAME,
        summary: `已修习 ${target.title}：Lv.${target.currentLevel} -> Lv.${target.nextLevel}`,
        home: await this.clientReadService.getHomeSummary(input.playerId, client),
        scenes: await this.clientReadService.getSceneContent(input.playerId, client),
      };

      if (idempotencyRecord?.id) {
        await this.idempotencyService.markCompleted(client, {
          id: idempotencyRecord.id,
          responseSnapshotJson: responseSnapshot as unknown as Prisma.InputJsonValue,
          businessEntityType: target.isExtension ? 'territory-tech' : 'building',
          businessEntityId: target.key,
        });
      }

      return responseSnapshot;
    });
  }

  async donateFaction(input: FactionDonateCommandInput): Promise<ClientStateMutationResponse> {
    validateFactionDonateRequest(input.request);
    return this.prisma.transaction<ClientStateMutationResponse>(async (client) => {
      return {
        app: APP_NAME,
        summary: '金币不再直接兑换阵营贡献，请在今日阵营任务中上缴精华。',
        home: await this.clientReadService.getHomeSummary(input.playerId, client),
        scenes: await this.clientReadService.getSceneContent(input.playerId, client),
      };
    });
  }

  async submitFactionTask(input: FactionTaskSubmitCommandInput): Promise<ClientFactionTaskSubmitResponse> {
    validateFactionTaskSubmitRequest(input.request);
    const endpointKey = 'client.actions.submit-faction-task';
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey ?? input.request.requestIdempotencyKey);
    const requestHash = hashFactionTaskSubmitRequest(input.request);

    return this.prisma.transaction<ClientFactionTaskSubmitResponse>(async (client) => {
      const idempotencyRecord = idempotencyKey
        ? await this.prepareIdempotencyRecord(client, input.playerId, endpointKey, idempotencyKey, requestHash)
        : null;

      if (idempotencyRecord?.status === 'completed') {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientFactionTaskSubmitResponse;
      }

      const dateKey = getLocalDateKey();
      await this.dailyFactionTaskLifecycleService.ensurePlayerDailyFactionTasks(client, input.playerId, dateKey);

      const task = await client.dailyFactionTask.findFirst({
        where: {
          id: input.request.taskId,
          playerId: input.playerId,
          taskDate: dateKey,
        },
        select: {
          id: true,
          factionId: true,
          taskType: true,
          requiredEssenceType: true,
          requiredAmount: true,
          progressAmount: true,
          rewardContribution: true,
          status: true,
        },
      });

      if (!task) {
        throw new BusinessError({
          code: ErrorCode.TaskNotFound,
          message: 'Faction task not found.',
          statusCode: 404,
        });
      }

      if (task.status === 'CLAIMED') {
        throw new BusinessError({
          code: ErrorCode.TaskAlreadyClaimed,
          message: 'Faction task already completed.',
          statusCode: 409,
        });
      }

      if (!task.requiredEssenceType) {
        throw new BusinessError({
          code: ErrorCode.BadRequest,
          message: 'This faction task cannot be submitted with essence.',
          statusCode: 400,
        });
      }

      const remainingAmount = Math.max(task.requiredAmount - task.progressAmount, 0);
      const submitAmount = Math.min(Math.max(Math.floor(input.request.amount ?? remainingAmount), 1), remainingAmount);
      const seedDefinition = await client.seedDefinition.findUnique({
        where: { seedId: task.requiredEssenceType },
        select: { id: true, seedId: true, label: true },
      });

      if (!seedDefinition) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Essence definition not found.',
          statusCode: 404,
        });
      }

      const inventory = await client.playerSeedInventory.findUnique({
        where: {
          playerId_seedDefinitionId: {
            playerId: input.playerId,
            seedDefinitionId: seedDefinition.id,
          },
        },
        select: { id: true, quantity: true },
      });

      if (!inventory || inventory.quantity < submitAmount) {
        throw new BusinessError({
          code: ErrorCode.Conflict,
          message: 'Insufficient essence inventory.',
          statusCode: 409,
        });
      }

      const nextQuantity = inventory.quantity - submitAmount;
      await client.playerSeedInventory.update({
        where: { id: inventory.id },
        data: {
          quantity: { decrement: submitAmount },
          inventoryVersion: { increment: 1 },
        },
      });

      await createEssenceTransaction(client, {
        playerId: input.playerId,
        essenceType: seedDefinition.seedId,
        delta: -submitAmount,
        reason: 'faction-task-submit',
        sourceId: task.id,
        balanceAfter: nextQuantity,
      });

      const nextProgress = Math.min(task.progressAmount + submitAmount, task.requiredAmount);
      const completed = nextProgress >= task.requiredAmount;
      await client.dailyFactionTask.update({
        where: { id: task.id },
        data: {
          progressAmount: nextProgress,
          status: completed ? 'CLAIMED' : 'IN_PROGRESS',
          completedAt: completed ? new Date() : null,
        },
      });

      if (completed) {
        await grantFactionContribution(client, {
          playerId: input.playerId,
          factionId: task.factionId,
          contribution: task.rewardContribution,
          sourceType: 'faction-task-submit',
          sourceId: task.id,
          metadata: {
            essenceType: seedDefinition.seedId,
            submittedAmount: nextProgress,
          },
        });
        await this.landDeedService.reconcilePlayerLandDeeds(client, input.playerId);
      }

      const home = await this.clientReadService.getHomeSummary(input.playerId, client);
      const responseSnapshot: ClientFactionTaskSubmitResponse = {
        app: APP_NAME,
        summary: completed
          ? `已上缴${seedDefinition.label}精华 x${submitAmount}，贡献 +${task.rewardContribution}。`
          : `已上缴${seedDefinition.label}精华 x${submitAmount}。`,
        home,
        scenes: await this.clientReadService.getSceneContent(input.playerId, client),
        task: home.factionTasks.find((item) => item.id === task.id) ?? home.factionTasks[0],
      };

      if (idempotencyRecord?.id) {
        await this.idempotencyService.markCompleted(client, {
          id: idempotencyRecord.id,
          responseSnapshotJson: responseSnapshot as unknown as Prisma.InputJsonValue,
          businessEntityType: 'daily-faction-task',
          businessEntityId: task.id,
        });
      }

      return responseSnapshot;
    });
  }

  async claimFactionStipend(input: ClaimFactionStipendCommandInput): Promise<ClientClaimFactionStipendResponse> {
    validateClaimFactionStipendRequest(input.request);
    const endpointKey = 'client.actions.claim-faction-stipend';
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey ?? input.request.requestIdempotencyKey);
    const requestHash = hashClaimFactionStipendRequest(input.request);

    return this.prisma.transaction<ClientClaimFactionStipendResponse>(async (client) => {
      const idempotencyRecord = idempotencyKey
        ? await this.prepareIdempotencyRecord(client, input.playerId, endpointKey, idempotencyKey, requestHash)
        : null;

      if (idempotencyRecord?.status === 'completed') {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientClaimFactionStipendResponse;
      }

      const dateKey = getLocalDateKey();
      const playerState = await client.player.findUnique({
        where: { id: input.playerId },
        select: {
          factionId: true,
          wallet: { select: { vaultGold: true, balanceVersion: true } },
          factionMembers: {
            take: 1,
            select: {
              contributionScore: true,
            },
          },
        },
      });

      if (!playerState?.wallet) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Player wallet state not found.',
          statusCode: 404,
        });
      }

      if (!playerState.factionId || playerState.factionMembers.length <= 0) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Player faction membership not found.',
          statusCode: 404,
        });
      }

      assertVersion('walletVersion', input.request.walletVersion, playerState.wallet.balanceVersion);

      const [existingClaim, priorClaimCount] = await Promise.all([
        client.playerFactionStipendState.findUnique({
          where: {
            playerId_dateKey: {
              playerId: input.playerId,
              dateKey,
            },
          },
        }),
        client.playerFactionStipendState.count({
          where: {
            playerId: input.playerId,
            claimedAt: { not: null },
          },
        }),
      ]);

      if (existingClaim?.claimedAt) {
        throw new BusinessError({
          code: ErrorCode.Conflict,
          message: 'Daily faction stipend has already been claimed.',
          statusCode: 409,
        });
      }

      const contribution = playerState.factionMembers[0]?.contributionScore ?? 0;
      const tier = getFactionStipendTier(contribution);
      const rewards = priorClaimCount <= 0
        ? await resolveFirstFactionStipendRewards(client, (tier?.rewards ?? []) as ResolvableStipendReward[])
        : await resolveStipendRewards(client, (tier?.rewards ?? []) as ResolvableStipendReward[]);
      const now = new Date();
      const goldReward = sumRewardQuantity(rewards, 'gold');
      const ordinarySoulReward = sumRewardQuantity(rewards, 'ordinary-soul');
      const rareSoulReward = sumRewardQuantity(rewards, 'rare-soul');
      const legendarySoulReward = sumRewardQuantity(rewards, 'legendary-soul');
      const essenceRewards = rewards.filter((entry) => entry.kind === 'essence' && entry.essenceType);
      const spiritShardRewards = rewards.filter((entry) => entry.kind === 'spirit-shard' && entry.spiritId);

      if (goldReward > 0) {
        const nextVaultGold = playerState.wallet.vaultGold + goldReward;

        await client.playerWallet.update({
          where: { playerId: input.playerId },
          data: {
            vaultGold: nextVaultGold,
            balanceVersion: { increment: 1 },
          },
        });

        await this.auditService.createWalletChangeLog(client, {
          playerId: input.playerId,
          walletBucket: 'vault',
          changeType: 'faction-stipend',
          deltaGold: goldReward,
          beforeGold: playerState.wallet.vaultGold,
          afterGold: nextVaultGold,
          relatedEntityType: 'faction-stipend',
          relatedEntityId: dateKey,
          requestIdempotencyKey: idempotencyKey,
          note: 'Claim daily faction stipend gold.',
        });
      }

      if (ordinarySoulReward > 0 || rareSoulReward > 0 || legendarySoulReward > 0) {
        await client.playerSpiritResource.upsert({
          where: { playerId: input.playerId },
          create: {
            playerId: input.playerId,
            ordinarySoul: ordinarySoulReward,
            rareSoul: rareSoulReward,
            legendarySoul: legendarySoulReward,
          },
          update: {
            ordinarySoul: ordinarySoulReward > 0 ? { increment: ordinarySoulReward } : undefined,
            rareSoul: rareSoulReward > 0 ? { increment: rareSoulReward } : undefined,
            legendarySoul: legendarySoulReward > 0 ? { increment: legendarySoulReward } : undefined,
            resourceVersion: { increment: 1 },
          },
        });
      }

      for (const reward of essenceRewards) {
        if (!reward.essenceType) {
          continue;
        }

        const seedDefinition = await client.seedDefinition.findUnique({
          where: { seedId: reward.essenceType },
          select: { id: true },
        });

        if (!seedDefinition) {
          continue;
        }

        await client.playerSeedInventory.upsert({
          where: {
            playerId_seedDefinitionId: {
              playerId: input.playerId,
              seedDefinitionId: seedDefinition.id,
            },
          },
          create: {
            playerId: input.playerId,
            seedDefinitionId: seedDefinition.id,
            quantity: reward.quantity,
          },
          update: {
            quantity: { increment: reward.quantity },
            inventoryVersion: { increment: 1 },
          },
        });
      }

      for (const reward of spiritShardRewards) {
        if (!reward.spiritId) {
          continue;
        }

        const spiritDefinition = await client.spiritDefinition.findUnique({
          where: { spiritId: reward.spiritId },
          select: { id: true, shardUnlockRequired: true },
        });

        if (!spiritDefinition) {
          continue;
        }

        const existing = await client.playerSpiritCodex.findUnique({
          where: {
            playerId_spiritDefinitionId: {
              playerId: input.playerId,
              spiritDefinitionId: spiritDefinition.id,
            },
          },
          select: { shardCount: true },
        });
        const nextShardCount = Math.min((existing?.shardCount ?? 0) + reward.quantity, spiritDefinition.shardUnlockRequired);

        await client.playerSpiritCodex.upsert({
          where: {
            playerId_spiritDefinitionId: {
              playerId: input.playerId,
              spiritDefinitionId: spiritDefinition.id,
            },
          },
          create: {
            playerId: input.playerId,
            spiritDefinitionId: spiritDefinition.id,
            hasSeen: true,
            shardCount: nextShardCount,
            readyToCompose: nextShardCount >= spiritDefinition.shardUnlockRequired,
            firstSeenAt: now,
            readyAt: nextShardCount >= spiritDefinition.shardUnlockRequired ? now : null,
          },
          update: {
            hasSeen: true,
            shardCount: nextShardCount,
            readyToCompose: nextShardCount >= spiritDefinition.shardUnlockRequired,
            firstSeenAt: existing ? undefined : now,
            readyAt: nextShardCount >= spiritDefinition.shardUnlockRequired ? now : undefined,
            codexVersion: { increment: 1 },
          },
        });
      }

      const stipendState = await client.playerFactionStipendState.upsert({
        where: {
          playerId_dateKey: {
            playerId: input.playerId,
            dateKey,
          },
        },
        create: {
          playerId: input.playerId,
          dateKey,
          contributionSnapshot: contribution,
          tierKey: tier?.tierKey ?? 'contribution-0',
          rewardJson: rewards as unknown as Prisma.InputJsonValue,
          claimedAt: now,
        },
        update: {
          contributionSnapshot: contribution,
          tierKey: tier?.tierKey ?? 'contribution-0',
          rewardJson: rewards as unknown as Prisma.InputJsonValue,
          claimedAt: now,
        },
      });

      if (priorClaimCount <= 0) {
        await client.playerSpiritSlot.updateMany({
          where: {
            playerId: input.playerId,
            spiritDefinitionId: { not: null },
            dissolvedAt: null,
          },
          data: {
            exp: 0,
            lastExpSettledAt: now,
            slotVersion: { increment: 1 },
          },
        });
      }

      const home = await this.clientReadService.getHomeSummary(input.playerId, client);
      const scenes = await this.clientReadService.getSceneContent(input.playerId, client);
      const bootstrap = await this.clientReadService.getBootstrap(input.playerId, client);
      const responseSnapshot: ClientClaimFactionStipendResponse = {
        app: APP_NAME,
        summary: `阵营俸禄已领取：${formatRewardSummary(rewards)}。`,
        stipend: {
          title: '每日阵营俸禄',
          description: '每日按当前个人贡献领取一次，精华和灵宠精魄会抽取为具体碎片。',
          status: 'claimed',
          dateKey,
          contribution,
          tierKey: stipendState.tierKey,
          tierLabel: tier?.label ?? '基础俸禄',
          rewards,
          claimedAt: stipendState.claimedAt?.toISOString() ?? now.toISOString(),
          action: null,
        },
        rewards,
        home,
        scenes,
        bootstrap,
      };

      if (idempotencyRecord?.id) {
        await this.idempotencyService.markCompleted(client, {
          id: idempotencyRecord.id,
          responseSnapshotJson: responseSnapshot as unknown as Prisma.InputJsonValue,
          businessEntityType: 'faction-stipend',
          businessEntityId: dateKey,
        });
      }

      return responseSnapshot;
    });
  }

  async unlockPlant(input: UnlockPlantCommandInput): Promise<ClientUnlockPlantResponse> {
    validateUnlockPlantRequest(input.request);
    const endpointKey = 'client.actions.unlock-plant';
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey ?? input.request.requestIdempotencyKey);
    const requestHash = hashUnlockPlantRequest(input.request);

    return this.prisma.transaction<ClientUnlockPlantResponse>(async (client) => {
      const idempotencyRecord = idempotencyKey
        ? await this.prepareIdempotencyRecord(client, input.playerId, endpointKey, idempotencyKey, requestHash)
        : null;

      if (idempotencyRecord?.status === 'completed') {
        return idempotencyRecord.responseSnapshotJson as unknown as ClientUnlockPlantResponse;
      }

      const plantType = input.request.plantType.trim();
      const player = await client.player.findUnique({
        where: { id: input.playerId },
        select: {
          factionMembers: {
            take: 1,
            select: { contributionScore: true },
          },
        },
      });
      const seedDefinition = await client.seedDefinition.findUnique({
        where: { seedId: plantType },
        select: { id: true, seedId: true, label: true, rarity: true, sortOrder: true },
      });

      if (!seedDefinition) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Plant definition not found.',
          statusCode: 404,
        });
      }

      const requirement = getPlantUnlockRequirement(seedDefinition.seedId, seedDefinition.rarity, seedDefinition.sortOrder);
      if (requirement.essenceRequired <= 0) {
        throw new BusinessError({
          code: ErrorCode.BadRequest,
          message: 'This plant is unlocked by tutorial or base progression.',
          statusCode: 400,
        });
      }

      const inventory = await client.playerSeedInventory.findUnique({
        where: {
          playerId_seedDefinitionId: {
            playerId: input.playerId,
            seedDefinitionId: seedDefinition.id,
          },
        },
        select: { id: true, quantity: true, unlockedAt: true },
      });

      if (inventory?.unlockedAt) {
        throw new BusinessError({
          code: ErrorCode.Conflict,
          message: 'Plant is already unlocked.',
          statusCode: 409,
        });
      }

      const research = await client.playerPlantResearch.findUnique({
        where: {
          playerId_seedDefinitionId: {
            playerId: input.playerId,
            seedDefinitionId: seedDefinition.id,
          },
        },
        select: { id: true },
      });

      if (!research) {
        throw new BusinessError({
          code: ErrorCode.Conflict,
          message: 'Plant has not been discovered.',
          statusCode: 409,
        });
      }

      const contribution = player?.factionMembers[0]?.contributionScore ?? 0;
      if (contribution < requirement.contributionRequired) {
        throw new BusinessError({
          code: ErrorCode.Conflict,
          message: 'Contribution requirement is not met.',
          statusCode: 409,
          details: {
            required: requirement.contributionRequired,
            current: contribution,
          },
        });
      }

      if (!inventory || inventory.quantity < requirement.essenceRequired) {
        throw new BusinessError({
          code: ErrorCode.Conflict,
          message: 'Essence requirement is not met.',
          statusCode: 409,
          details: {
            required: requirement.essenceRequired,
            current: inventory?.quantity ?? 0,
          },
        });
      }

      const now = new Date();
      const nextQuantity = inventory.quantity - requirement.essenceRequired;
      await client.playerSeedInventory.update({
        where: { id: inventory.id },
        data: {
          quantity: { decrement: requirement.essenceRequired },
          unlockedAt: now,
          inventoryVersion: { increment: 1 },
        },
      });

      await client.playerPlantResearch.update({
        where: { id: research.id },
        data: {
          researchVersion: { increment: 1 },
        },
      });

      await createEssenceTransaction(client, {
        playerId: input.playerId,
        essenceType: seedDefinition.seedId,
        delta: -requirement.essenceRequired,
        reason: 'plant-unlock',
        sourceId: research.id,
        balanceAfter: nextQuantity,
      });

      const scenes = await this.clientReadService.getSceneContent(input.playerId, client);
      const plant = scenes.farm.plants?.find((item) => item.plantType === seedDefinition.seedId);
      const responseSnapshot: ClientUnlockPlantResponse = {
        app: APP_NAME,
        summary: `已解锁${seedDefinition.label}，现在可以永久播种。`,
        bootstrap: await this.clientReadService.getBootstrap(input.playerId, client),
        home: await this.clientReadService.getHomeSummary(input.playerId, client),
        scenes,
        plant: plant ?? {
          plantType: seedDefinition.seedId,
          essenceType: seedDefinition.seedId,
          plantName: seedDefinition.label,
          essenceLabel: `${seedDefinition.label}精华`,
          rarity: seedDefinition.rarity === 'legendary' ? 'legendary' : seedDefinition.rarity === 'rare' ? 'rare' : 'common',
          unlocked: true,
          discovered: true,
          researchStatus: 'unlocked',
          unlockEssenceRequired: requirement.essenceRequired,
          unlockContributionRequired: requirement.contributionRequired,
          canUnlock: false,
          essenceQuantity: nextQuantity,
          growSeconds: 0,
          matureSeconds: 0,
          expectedEssenceYield: getExpectedEssenceYield(seedDefinition.rarity),
        },
      };

      if (idempotencyRecord?.id) {
        await this.idempotencyService.markCompleted(client, {
          id: idempotencyRecord.id,
          responseSnapshotJson: responseSnapshot as unknown as Prisma.InputJsonValue,
          businessEntityType: 'plant-unlock',
          businessEntityId: seedDefinition.seedId,
        });
      }

      return responseSnapshot;
    });
  }

  async resetDemoState(input: { playerId: string }): Promise<ClientResetDemoStateResponse> {
    if (!['development', 'test'].includes(process.env.NODE_ENV ?? 'development')) {
      throw new BusinessError({
        code: ErrorCode.Forbidden,
        message: 'Demo state reset is only available in development and test environments.',
        statusCode: 403,
      });
    }

    return this.prisma.transaction<ClientResetDemoStateResponse>(async (client) => {
      await this.playerInitializationService.initialize(client, {
        playerId: input.playerId,
        resetExisting: true,
      });

      return {
        app: APP_NAME,
        summary: 'Development player state has been reset.',
        home: await this.clientReadService.getHomeSummary(input.playerId, client),
        scenes: await this.clientReadService.getSceneContent(input.playerId, client),
      };
    });
  }

  private async prepareIdempotencyRecord(
    client: Prisma.TransactionClient,
    playerId: string,
    endpointKey: string,
    idempotencyKey: string,
    requestHash: string,
  ) {
    const existingRecord = await this.idempotencyService.findByKey(client, playerId, endpointKey, idempotencyKey);

    if (existingRecord) {
      if (existingRecord.requestHash !== requestHash) {
        throw new BusinessError({
          code: ErrorCode.Conflict,
          message: 'Idempotency key was already used with a different request.',
          statusCode: 409,
        });
      }

      if (existingRecord.status === 'completed') {
        return existingRecord;
      }

      throw new BusinessError({
        code: ErrorCode.Conflict,
        message: 'Idempotency request is still processing.',
        statusCode: 409,
      });
    }

    return this.idempotencyService.createProcessing(client, {
      playerId,
      endpointKey,
      idempotencyKey,
      requestHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  }

  private resolveTarget(
    buildings: PlayerBuildingStateForUpgrade,
    request: UpgradeBuildingRequestDto,
  ): BuildingUpgradeTarget {
    if (request.targetType === 'building') {
      if (!request.buildingId) {
        throwBadRequest('buildingId is required.');
      }

      const buildingId = request.buildingId;
      return this.wrapRuleError(() => this.buildingUpgradeRuleService.resolveBuildingTarget(buildings, buildingId));
    }

    if (request.targetType === 'castle-extension') {
      if (!request.extensionId) {
        throwBadRequest('extensionId is required.');
      }

      const extensionId = request.extensionId;
      return this.wrapRuleError(() => this.buildingUpgradeRuleService.resolveExtensionTarget(buildings, extensionId));
    }

    if (request.targetType === 'territory-tech') {
      const territoryUpgradeId = request.territoryUpgradeId ?? request.extensionId;
      if (!territoryUpgradeId) {
        throwBadRequest('territoryUpgradeId is required.');
      }

      return this.wrapRuleError(() => this.buildingUpgradeRuleService.resolveExtensionTarget(buildings, territoryUpgradeId));
    }

    throwBadRequest('targetType must be building, castle-extension or territory-tech.');
  }

  private wrapRuleError(handler: () => BuildingUpgradeTarget): BuildingUpgradeTarget {
    try {
      return handler();
    } catch (error) {
      if (error instanceof Error && error.message === 'FIELD_SLOT_AUTO_UNLOCK') {
        throw new BusinessError({
          code: ErrorCode.BadRequest,
          message: 'Field slots are unlocked by land deed tasks.',
          statusCode: 400,
        });
      }

      if (error instanceof Error && error.message === 'LEGACY_BUILDING_UPGRADE_RETIRED') {
        throw new BusinessError({
          code: ErrorCode.BadRequest,
          message: 'Legacy building upgrades are retired. Use spell study upgrades.',
          statusCode: 400,
        });
      }

      if (error instanceof Error && error.message === 'POPULATION_UPGRADE_REMOVED') {
        throw new BusinessError({
          code: ErrorCode.BadRequest,
          message: 'Population upgrade has been removed. Spirits now progress by level.',
          statusCode: 400,
        });
      }

      if (error instanceof Error && error.message === 'BUILDING_MAX_LEVEL') {
        throw new BusinessError({
          code: ErrorCode.BadRequest,
          message: 'Building target has reached the configured max level.',
          statusCode: 400,
        });
      }

      throw error;
    }
  }

  private async buildClaimPendingResponse(
    client: Prisma.TransactionClient,
    playerId: string,
    state: {
      summary: string;
      source: ClaimPendingRequestDto['source'];
      claimedGold: number;
      remainingPendingGold: number;
      ledger: {
        vaultGold: number;
        vaultCapacity: number;
        pendingTaxGold: number;
        pendingDividendGold: number;
        pendingRaidOverflowGold: number;
        pendingRaidOverflowExpiresAt: Date | null;
        balanceVersion: number;
      };
    },
  ): Promise<ClientClaimPendingResponse> {
    return {
      app: APP_NAME,
      summary: state.summary,
      source: state.source,
      claimedGold: state.claimedGold,
      remainingPendingGold: state.remainingPendingGold,
      ledger: {
        vaultGold: state.ledger.vaultGold,
        vaultCapacity: state.ledger.vaultCapacity,
        taxPendingGold: state.ledger.pendingTaxGold,
        factionDividendGold: state.ledger.pendingDividendGold,
      },
      home: await this.clientReadService.getHomeSummary(playerId, client),
      scenes: await this.clientReadService.getSceneContent(playerId, client),
    };
  }

  private async buildClaimDailyTaskResponse(
    client: Prisma.TransactionClient,
    playerId: string,
    state: {
      summary: string;
      taskId: string;
      rewardGold: number;
      claimedGold: number;
      overflowGold: number;
    },
  ): Promise<ClientClaimDailyTaskResponse> {
    return {
      app: APP_NAME,
      summary: state.summary,
      taskId: state.taskId,
      rewardGold: state.rewardGold,
      claimedGold: state.claimedGold,
      overflowGold: state.overflowGold,
      home: await this.clientReadService.getHomeSummary(playerId, client),
      scenes: await this.clientReadService.getSceneContent(playerId, client),
    };
  }

  private async recordDailyTaskProgress(
    client: Prisma.TransactionClient,
    playerId: string,
    objectiveType: string,
    amount = 1,
  ): Promise<void> {
    if (amount <= 0) {
      return;
    }

    const taskIds = getDailyTaskIdsByObjective(objectiveType);

    if (taskIds.length <= 0) {
      return;
    }

    const dateKey = getLocalDateKey();
    await this.dailyTaskLifecycleService.ensurePlayerDailyTasks(client, playerId, dateKey);

    const taskStates = await client.playerDailyTaskState.findMany({
      where: {
        playerId,
        dateKey,
        taskId: { in: taskIds },
        status: 'IN_PROGRESS',
      },
      select: {
        id: true,
        progress: true,
        target: true,
      },
    });

    for (const taskState of taskStates) {
      const nextProgress = Math.min(taskState.progress + amount, taskState.target);

      await client.playerDailyTaskState.update({
        where: { id: taskState.id },
        data: {
          progress: nextProgress,
          status: nextProgress >= taskState.target ? 'COMPLETED' : 'IN_PROGRESS',
        },
      });
    }
  }
}

function validateClaimPendingRequest(request: ClaimPendingRequestDto): void {
  const body = assertRequestBody(request);
  if (!['tax', 'faction', 'raid-overflow'].includes(String(body.source))) {
    throwBadRequest('source must be tax, faction, or raid-overflow.');
  }
  assertOptionalNumber(body.walletVersion, 'walletVersion');
}

function validateClaimDailyTaskRequest(request: ClaimDailyTaskRequestDto): void {
  const body = assertRequestBody(request);
  assertRequiredString(body.taskId, 'taskId');
  assertOptionalNumber(body.walletVersion, 'walletVersion');
}

function validateClaimStarterSeedRequest(request: ClaimStarterSeedRequestDto): void {
  assertRequestBody(request);
}

function validateCollectFieldRequest(request: CollectFieldRequestDto): void {
  const body = assertRequestBody(request);
  assertRequiredString(body.fieldId, 'fieldId');
  if (body.collectMode !== 'ripe' && body.collectMode !== 'early') {
    throwBadRequest('collectMode must be ripe or early.');
  }
  assertOptionalNumber(body.fieldVersion, 'fieldVersion');
  assertOptionalNumber(body.walletVersion, 'walletVersion');
}

function validateStartCultivationRequest(request: StartCultivationRequestDto): void {
  const body = assertRequestBody(request);
  assertRequiredString(body.fieldId, 'fieldId');
  const plantType = typeof body.plantType === 'string'
    ? body.plantType
    : typeof body.seedId === 'string'
      ? body.seedId
      : '';
  assertRequiredString(plantType, 'plantType');
}

function validateRecruitArmyRequest(request: RecruitArmyRequestDto): void {
  const body = assertRequestBody(request);
  assertPositiveInteger(body.recruitCount, 'recruitCount');
  assertOptionalNumber(body.armyVersion, 'armyVersion');
  assertOptionalNumber(body.walletVersion, 'walletVersion');
}

function validateFactionDonateRequest(request: ClientFactionDonateRequest): void {
  const body = assertRequestBody(request);
  assertPositiveInteger(body.goldAmount, 'goldAmount');
}

function validateFactionTaskSubmitRequest(request: FactionTaskSubmitRequestDto): void {
  const body = assertRequestBody(request);
  assertRequiredString(body.taskId, 'taskId');
  if (body.amount !== undefined) {
    assertPositiveInteger(body.amount, 'amount');
  }
}

function validateUnlockPlantRequest(request: UnlockPlantRequestDto): void {
  if (!request.plantType || request.plantType.trim().length <= 0) {
    throwBadRequest('plantType is required.');
  }
}

function validateClaimFactionStipendRequest(request: ClaimFactionStipendRequestDto): void {
  const body = assertRequestBody(request);
  assertOptionalNumber(body.walletVersion, 'walletVersion');
}

function assertRequestBody(request: unknown): Record<string, unknown> {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throwBadRequest('Request body must be a JSON object.');
  }

  return request as Record<string, unknown>;
}

function assertRequiredString(value: unknown, fieldName: string): void {
  if (typeof value !== 'string' || value.trim().length <= 0) {
    throwBadRequest(`${fieldName} is required.`);
  }
}

function assertPositiveInteger(value: unknown, fieldName: string): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throwBadRequest(`${fieldName} must be a positive integer.`);
  }
}

function assertOptionalNumber(value: unknown, fieldName: string): void {
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
    throwBadRequest(`${fieldName} must be a number.`);
  }
}

function normalizeIdempotencyKey(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function hashRequest(request: UpgradeBuildingRequestDto): string {
  return createHash('sha256')
    .update(JSON.stringify({
      targetType: request.targetType,
      buildingId: request.buildingId ?? null,
      extensionId: request.extensionId ?? null,
      territoryUpgradeId: request.territoryUpgradeId ?? null,
      buildingVersion: request.buildingVersion ?? null,
      walletVersion: request.walletVersion ?? null,
    }))
    .digest('hex');
}

function hashClaimPendingRequest(request: ClaimPendingRequestDto): string {
  return createHash('sha256')
    .update(JSON.stringify({
      source: request.source,
      acceptOverflowLoss: Boolean(request.acceptOverflowLoss),
      walletVersion: request.walletVersion ?? null,
    }))
    .digest('hex');
}

function hashClaimDailyTaskRequest(request: ClaimDailyTaskRequestDto): string {
  return createHash('sha256')
    .update(JSON.stringify({
      taskId: request.taskId,
      taskDateKey: request.taskDateKey ?? null,
      acceptOverflowLoss: Boolean(request.acceptOverflowLoss),
      walletVersion: request.walletVersion ?? null,
    }))
    .digest('hex');
}

function hashClaimStarterSeedRequest(request: ClaimStarterSeedRequestDto): string {
  return createHash('sha256')
    .update(JSON.stringify({
      requestIdempotencyKey: request.requestIdempotencyKey ?? null,
    }))
    .digest('hex');
}

function hashRecruitArmyRequest(request: RecruitArmyRequestDto): string {
  return createHash('sha256')
    .update(JSON.stringify({
      recruitCount: request.recruitCount,
      walletVersion: request.walletVersion ?? null,
      armyVersion: request.armyVersion ?? null,
    }))
    .digest('hex');
}

function hashStartCultivationRequest(request: StartCultivationRequestDto): string {
  return createHash('sha256')
    .update(JSON.stringify({
      fieldId: request.fieldId,
      plantType: getRequestedPlantType(request),
    }))
    .digest('hex');
}

function hashFactionTaskSubmitRequest(request: FactionTaskSubmitRequestDto): string {
  return createHash('sha256')
    .update(JSON.stringify({
      taskId: request.taskId,
      amount: request.amount ?? null,
    }))
    .digest('hex');
}

function hashUnlockPlantRequest(request: UnlockPlantRequestDto): string {
  return createHash('sha256')
    .update(JSON.stringify({
      plantType: request.plantType.trim(),
    }))
    .digest('hex');
}

function hashClaimFactionStipendRequest(request: ClaimFactionStipendRequestDto): string {
  return createHash('sha256')
    .update(JSON.stringify({
      walletVersion: request.walletVersion ?? null,
    }))
    .digest('hex');
}

function getCultivationStageGold(
  seedId: string,
  stage: 'seeded' | 'growing' | 'mature' | 'withered',
  factionCode: string | null,
): number {
  const base = getSeedStageGold(seedId, stage);
  const config = getFactionAdvantageConfig(factionCode);
  if (stage !== 'mature') {
    return base;
  }

  const multiplier = 1 + ((config?.modifiers.farmMatureYieldBonusPercent ?? 0) / 100);
  return Math.round(base * multiplier);
}

function addSeconds(source: Date, seconds: number): Date {
  return new Date(source.getTime() + Math.max(Math.floor(seconds), 0) * 1000);
}

function getPendingGoldBySource(wallet: {
  pendingTaxGold: number;
  pendingDividendGold: number;
  pendingRaidOverflowGold: number;
  pendingRaidOverflowExpiresAt: Date | null;
}, source: ClaimPendingRequestDto['source']): number {
  if (source === 'tax') {
    return wallet.pendingTaxGold;
  }

  if (source === 'faction') {
    return wallet.pendingDividendGold;
  }

  if (!wallet.pendingRaidOverflowExpiresAt || wallet.pendingRaidOverflowExpiresAt.getTime() <= Date.now()) {
    return 0;
  }

  return wallet.pendingRaidOverflowGold;
}

function buildPendingClaimWalletUpdate(
  source: ClaimPendingRequestDto['source'],
  nextVaultGold: number,
  nextPendingGold: number,
): Prisma.PlayerWalletUpdateInput {
  if (source === 'tax') {
    return {
      vaultGold: nextVaultGold,
      pendingTaxGold: nextPendingGold,
      balanceVersion: { increment: 1 },
    };
  }

  if (source === 'faction') {
    return {
      vaultGold: nextVaultGold,
      pendingDividendGold: nextPendingGold,
      balanceVersion: { increment: 1 },
    };
  }

  return {
    vaultGold: nextVaultGold,
    pendingRaidOverflowGold: nextPendingGold,
    pendingRaidOverflowExpiresAt: nextPendingGold > 0 ? undefined : null,
    balanceVersion: { increment: 1 },
  };
}

function getPendingClaimSourceLabel(source: ClaimPendingRequestDto['source']): string {
  if (source === 'tax') {
    return '主城税收';
  }

  if (source === 'faction') {
    return '阵营分红';
  }

  return '临时待领取';
}

function buildClaimPendingSummary(
  source: ClaimPendingRequestDto['source'],
  claimedGold: number,
  remainingPendingGold: number,
  _overflowGold: number,
): string {
  const sourceLabel = getPendingClaimSourceLabel(source);

  if (claimedGold > 0) {
    return `${sourceLabel}本次入账 ${claimedGold} 金币，剩余待领取 ${remainingPendingGold}。`;
  }

  return `当前没有可入账的${sourceLabel}。`;
}

function normalizeStipendRewards(rewards: ClientFactionStipendReward[]): ClientFactionStipendReward[] {
  return rewards
    .map((reward) => ({
      kind: reward.kind,
      label: reward.label,
      quantity: Math.max(Math.floor(reward.quantity), 0),
      seedId: reward.seedId,
      essenceType: reward.essenceType,
      spiritId: reward.spiritId,
    }))
    .filter((reward) => reward.label.trim().length > 0 && reward.quantity > 0);
}

async function resolveStipendRewards(
  client: Prisma.TransactionClient,
  rewards: ResolvableStipendReward[],
): Promise<ClientFactionStipendReward[]> {
  const [essenceLabelById, spiritLabelById] = await loadStipendRewardLabels(client, rewards);
  const resolvedRewards: ClientFactionStipendReward[] = [];

  for (const reward of rewards) {
    const quantity = Math.max(Math.floor(reward.quantity), 0);

    if (quantity <= 0) {
      continue;
    }

    if (reward.kind === 'essence' && reward.essencePoolIds?.length) {
      resolvedRewards.push(...drawGroupedRewards({
        kind: 'essence',
        poolIds: reward.essencePoolIds,
        quantity,
        labelById: essenceLabelById,
        missingMessage: 'Faction stipend essence pool definitions not found. Please seed plant definitions first.',
      }));
      continue;
    }

    if (reward.kind === 'spirit-shard' && reward.spiritPoolIds?.length) {
      resolvedRewards.push(...drawGroupedRewards({
        kind: 'spirit-shard',
        poolIds: reward.spiritPoolIds,
        quantity,
        labelById: spiritLabelById,
        missingMessage: 'Faction stipend spirit pool definitions not found. Please seed spirit definitions first.',
      }));
      continue;
    }

    if (reward.kind === 'seed' && reward.seedPoolIds?.length) {
      resolvedRewards.push(...drawGroupedRewards({
        kind: 'seed',
        poolIds: reward.seedPoolIds,
        quantity,
        labelById: essenceLabelById,
        missingMessage: 'Faction stipend seed pool definitions not found. Please seed seed definitions first.',
      }));
      continue;
    }

    if (reward.kind === 'essence' && reward.essenceType) {
      resolvedRewards.push({
        ...reward,
        label: reward.label || `${essenceLabelById.get(reward.essenceType) ?? reward.essenceType}精华`,
      });
      continue;
    }

    if (reward.kind === 'spirit-shard' && reward.spiritId) {
      resolvedRewards.push({
        ...reward,
        label: reward.label || `${spiritLabelById.get(reward.spiritId) ?? reward.spiritId}精魄`,
      });
      continue;
    }

    if (reward.kind !== 'seed') {
      resolvedRewards.push(...normalizeStipendRewards([reward]));
      continue;
    }
  }

  return normalizeStipendRewards(resolvedRewards);
}

async function resolveFirstFactionStipendRewards(
  client: Prisma.TransactionClient,
  rewards: ResolvableStipendReward[],
): Promise<ClientFactionStipendReward[]> {
  const resolvedNonEssenceRewards = await resolveStipendRewards(
    client,
    rewards.filter((reward) => reward.kind !== 'essence' && reward.kind !== 'seed'),
  );
  const seedDefinitions = await client.seedDefinition.findMany({
    where: { seedId: { in: ['qinglingmai', 'xunyamai'] } },
    select: { seedId: true, label: true },
  });
  const seedLabelById = new Map(seedDefinitions.map((seed) => [seed.seedId, seed.label]));

  if (!seedLabelById.has('qinglingmai') || !seedLabelById.has('xunyamai')) {
    throw new BusinessError({
      code: ErrorCode.NotFound,
      message: 'First faction stipend seed definitions not found. Please seed seed definitions first.',
      statusCode: 404,
    });
  }

  return normalizeStipendRewards([
    ...resolvedNonEssenceRewards,
    { kind: 'essence', essenceType: 'qinglingmai', label: `${seedLabelById.get('qinglingmai') ?? '青灵麦'}精华`, quantity: 3 },
    { kind: 'essence', essenceType: 'xunyamai', label: `${seedLabelById.get('xunyamai') ?? '风云稻'}精华`, quantity: 3 },
  ]);
}

async function loadStipendRewardLabels(
  client: Prisma.TransactionClient,
  rewards: ResolvableStipendReward[],
): Promise<[Map<string, string>, Map<string, string>]> {
  const essencePoolIds = Array.from(new Set(
    rewards
      .flatMap((reward) => [
        ...(reward.kind === 'essence' ? reward.essencePoolIds ?? [] : []),
        ...(reward.kind === 'seed' ? reward.seedPoolIds ?? [] : []),
        reward.kind === 'essence' ? reward.essenceType : undefined,
      ])
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
  ));
  const spiritPoolIds = Array.from(new Set(
    rewards
      .flatMap((reward) => [
        ...(reward.kind === 'spirit-shard' ? reward.spiritPoolIds ?? [] : []),
        reward.kind === 'spirit-shard' ? reward.spiritId : undefined,
      ])
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
  ));
  const [seedDefinitions, spiritDefinitions] = await Promise.all([
    essencePoolIds.length > 0
      ? client.seedDefinition.findMany({
        where: { seedId: { in: essencePoolIds } },
        select: { seedId: true, label: true },
      })
      : Promise.resolve([]),
    spiritPoolIds.length > 0
      ? client.spiritDefinition.findMany({
        where: { spiritId: { in: spiritPoolIds } },
        select: { spiritId: true, label: true },
      })
      : Promise.resolve([]),
  ]);

  return [
    new Map(seedDefinitions.map((seed) => [seed.seedId, seed.label])),
    new Map(spiritDefinitions.map((spirit) => [spirit.spiritId, spirit.label])),
  ];
}

function drawGroupedRewards(input: {
  kind: 'seed' | 'essence' | 'spirit-shard';
  poolIds: string[];
  quantity: number;
  labelById: Map<string, string>;
  missingMessage: string;
}): ClientFactionStipendReward[] {
  const availablePool = input.poolIds.filter((id) => input.labelById.has(id));
  if (availablePool.length <= 0) {
    throw new BusinessError({
      code: ErrorCode.NotFound,
      message: input.missingMessage,
      statusCode: 404,
    });
  }

  const groupedRewards = new Map<string, ClientFactionStipendReward>();
  for (let index = 0; index < input.quantity; index += 1) {
    const id = availablePool[Math.floor(Math.random() * availablePool.length)];
    const existing = groupedRewards.get(id);

    if (existing) {
      existing.quantity += 1;
      continue;
    }

    const baseLabel = input.labelById.get(id) ?? id;
    groupedRewards.set(id, {
      kind: input.kind,
      ...(input.kind === 'seed' ? { seedId: id } : {}),
      ...(input.kind === 'essence' ? { essenceType: id } : {}),
      ...(input.kind === 'spirit-shard' ? { spiritId: id } : {}),
      label: input.kind === 'essence' ? `${baseLabel}精华` : input.kind === 'spirit-shard' ? `${baseLabel}精魄` : baseLabel,
      quantity: 1,
    });
  }

  return Array.from(groupedRewards.values());
}

function sumRewardQuantity(rewards: ClientFactionStipendReward[], kind: ClientFactionStipendReward['kind']): number {
  return rewards
    .filter((reward) => reward.kind === kind)
    .reduce((sum, reward) => sum + reward.quantity, 0);
}

function formatRewardSummary(rewards: ClientFactionStipendReward[]): string {
  const summary = rewards.map((reward) => `${reward.label} x${reward.quantity}`).join('、');
  return summary || '暂无奖励';
}

async function applySpiritCropRewards(
  client: Prisma.TransactionClient,
  playerId: string,
  rewards: ClientCollectRewardItem[],
): Promise<void> {
  const spiritRoot = sumCollectRewardQuantity(rewards, 'spirit-root');
  const spiritMarrow = sumCollectRewardQuantity(rewards, 'spirit-marrow');
  const spiritJade = sumCollectRewardQuantity(rewards, 'spirit-jade');

  if (spiritRoot <= 0 && spiritMarrow <= 0 && spiritJade <= 0) {
    return;
  }

  await client.playerSpiritResource.upsert({
    where: { playerId },
    create: {
      playerId,
      spiritRoot,
      spiritMarrow,
      spiritJade,
    },
    update: {
      spiritRoot: spiritRoot > 0 ? { increment: spiritRoot } : undefined,
      spiritMarrow: spiritMarrow > 0 ? { increment: spiritMarrow } : undefined,
      spiritJade: spiritJade > 0 ? { increment: spiritJade } : undefined,
      resourceVersion: { increment: 1 },
    },
  });
}

async function applySeedCollectRewards(
  client: Prisma.TransactionClient,
  playerId: string,
  rewards: ClientCollectRewardItem[],
): Promise<void> {
  const seedRewards = rewards
    .filter((reward): reward is ClientCollectRewardItem & { kind: 'seed'; seedId: string } => (
      reward.kind === 'seed'
      && typeof reward.seedId === 'string'
      && reward.seedId.trim().length > 0
      && reward.quantity > 0
    ))
    .map((reward) => ({
      seedId: reward.seedId,
      quantity: Math.max(Math.floor(reward.quantity), 0),
    }));

  if (seedRewards.length <= 0) {
    return;
  }

  const groupedSeedRewards = new Map<string, number>();
  for (const reward of seedRewards) {
    groupedSeedRewards.set(reward.seedId, (groupedSeedRewards.get(reward.seedId) ?? 0) + reward.quantity);
  }

  const seedDefinitions = await client.seedDefinition.findMany({
    where: { seedId: { in: Array.from(groupedSeedRewards.keys()) } },
    select: { id: true, seedId: true },
  });
  const seedDefinitionBySeedId = new Map(seedDefinitions.map((seedDefinition) => [seedDefinition.seedId, seedDefinition]));
  const now = new Date();

  for (const [seedId, quantity] of groupedSeedRewards.entries()) {
    if (quantity <= 0) {
      continue;
    }

    let seedDefinition = seedDefinitionBySeedId.get(seedId) ?? null;
    if (!seedDefinition) {
      seedDefinition = await ensureSeedDefinitionExists(client, seedId);
      if (seedDefinition) {
        seedDefinitionBySeedId.set(seedId, seedDefinition);
      }
    }

    if (!seedDefinition) {
      continue;
    }

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
        quantity,
      },
      update: {
        quantity: { increment: quantity },
        inventoryVersion: { increment: 1 },
      },
    });

    await discoverPlant(client, {
      playerId,
      seedDefinitionId: seedDefinition.id,
      discoveredAt: now,
    });
  }
}

async function ensureSeedDefinitionExists(
  client: Prisma.TransactionClient,
  seedId: string,
): Promise<{ id: string; seedId: string; label: string } | null> {
  const seed = SEED_DEFINITION_SEEDS.find((entry) => entry.seedId === seedId);
  if (!seed) {
    return null;
  }

  return client.seedDefinition.upsert({
    where: { seedId: seed.seedId },
    create: seed,
    update: {
      label: seed.label,
      rarity: seed.rarity,
      sortOrder: seed.sortOrder,
      seedSeconds: seed.seedSeconds,
      growSeconds: seed.growSeconds,
      matureSeconds: seed.matureSeconds,
      ripeWindowSeconds: seed.ripeWindowSeconds,
      baseYieldGold: seed.baseYieldGold,
      harvestSeedReturn: seed.harvestSeedReturn,
      strategyNote: seed.strategyNote,
      lore: seed.lore,
    },
    select: {
      id: true,
      seedId: true,
      label: true,
    },
  });
}

async function applyEssenceCollectRewards(
  client: Prisma.TransactionClient,
  playerId: string,
  rewards: ClientCollectRewardItem[],
  sourceId?: string,
): Promise<void> {
  const essenceRewards = rewards
    .filter((reward): reward is ClientCollectRewardItem & { essenceType: string } => (
      reward.kind === 'essence'
      && typeof reward.essenceType === 'string'
      && reward.essenceType.trim().length > 0
      && reward.quantity > 0
    ))
    .map((reward) => ({
      essenceType: reward.essenceType,
      quantity: Math.max(Math.floor(reward.quantity), 0),
    }));

  if (essenceRewards.length <= 0) {
    return;
  }

  const groupedRewards = new Map<string, number>();
  for (const reward of essenceRewards) {
    groupedRewards.set(reward.essenceType, (groupedRewards.get(reward.essenceType) ?? 0) + reward.quantity);
  }

  const seedDefinitions = await client.seedDefinition.findMany({
    where: { seedId: { in: Array.from(groupedRewards.keys()) } },
    select: { id: true, seedId: true },
  });
  const seedDefinitionBySeedId = new Map(seedDefinitions.map((seedDefinition) => [seedDefinition.seedId, seedDefinition]));
  const now = new Date();

  for (const [essenceType, quantity] of groupedRewards.entries()) {
    if (quantity <= 0) {
      continue;
    }

    const seedDefinition = seedDefinitionBySeedId.get(essenceType);
    if (!seedDefinition) {
      continue;
    }

    if (essenceType === TUTORIAL_STARTER_SEED_ID) {
      const inventory = await client.playerSeedInventory.findUnique({
        where: {
          playerId_seedDefinitionId: {
            playerId,
            seedDefinitionId: seedDefinition.id,
          },
        },
        select: {
          quantity: true,
        },
      });

      await discoverPlant(client, {
        playerId,
        seedDefinitionId: seedDefinition.id,
        discoveredAt: now,
      });

      await createEssenceTransaction(client, {
        playerId,
        essenceType,
        delta: quantity,
        reason: 'field-harvest',
        sourceId,
        balanceAfter: inventory?.quantity ?? 0,
      });
      continue;
    }

    const inventory = await client.playerSeedInventory.upsert({
      where: {
        playerId_seedDefinitionId: {
          playerId,
          seedDefinitionId: seedDefinition.id,
        },
      },
      create: {
        playerId,
        seedDefinitionId: seedDefinition.id,
        quantity,
      },
      update: {
        quantity: { increment: quantity },
        inventoryVersion: { increment: 1 },
      },
      select: {
        quantity: true,
      },
    });

    await discoverPlant(client, {
      playerId,
      seedDefinitionId: seedDefinition.id,
      discoveredAt: now,
    });

    await createEssenceTransaction(client, {
      playerId,
      essenceType,
      delta: quantity,
      reason: 'field-harvest',
      sourceId,
      balanceAfter: inventory.quantity,
    });
  }
}

async function createEssenceTransaction(
  client: Prisma.TransactionClient,
  data: {
    playerId: string;
    essenceType: string;
    delta: number;
    reason: string;
    sourceId?: string | null;
    balanceAfter: number;
  },
): Promise<void> {
  await client.essenceTransactionLog.create({
    data: {
      playerId: data.playerId,
      essenceType: data.essenceType,
      delta: data.delta,
      reason: data.reason,
      sourceId: data.sourceId,
      balanceAfter: data.balanceAfter,
    },
  });
}

async function discoverPlant(
  client: Prisma.TransactionClient,
  input: {
    playerId: string;
    seedDefinitionId: string;
    discoveredAt?: Date;
  },
): Promise<void> {
  await client.playerPlantResearch.upsert({
    where: {
      playerId_seedDefinitionId: {
        playerId: input.playerId,
        seedDefinitionId: input.seedDefinitionId,
      },
    },
    create: {
      playerId: input.playerId,
      seedDefinitionId: input.seedDefinitionId,
      discoveredAt: input.discoveredAt ?? new Date(),
    },
    update: {
      researchVersion: { increment: 1 },
    },
  });
}

async function grantFactionContribution(
  client: Prisma.TransactionClient,
  input: {
    playerId: string;
    factionId: string;
    contribution: number;
    sourceType: string;
    sourceId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  const contribution = Math.max(Math.floor(input.contribution), 0);
  if (contribution <= 0) {
    return;
  }

  await client.faction.update({
    where: { id: input.factionId },
    data: { contributionScore: { increment: contribution } },
  });

  await client.factionMember.updateMany({
    where: {
      playerId: input.playerId,
      factionId: input.factionId,
    },
    data: { contributionScore: { increment: contribution } },
  });

  await client.factionContributionLog.create({
    data: {
      factionId: input.factionId,
      playerId: input.playerId,
      donatedGold: 0,
      contributionDelta: contribution,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadataJson: input.metadata,
    },
  });
}

function getRequestedPlantType(request: StartCultivationRequestDto): string {
  return (request.plantType ?? request.seedId ?? '').trim();
}

function getExpectedEssenceYield(rarity: string): number {
  if (rarity === 'legendary') {
    return 8;
  }

  if (rarity === 'rare') {
    return 6;
  }

  return 10;
}

function getPlantUnlockRequirement(seedId: string, rarity: string, sortOrder: number): { essenceRequired: number; contributionRequired: number } {
  if (seedId === 'qilingya' || seedId === 'qinglingmai' || seedId === 'xunyamai') {
    return { essenceRequired: 0, contributionRequired: 0 };
  }

  if (rarity === 'legendary') {
    return { essenceRequired: 30, contributionRequired: 800 };
  }

  if (rarity === 'rare') {
    return { essenceRequired: 12, contributionRequired: 300 };
  }

  if (sortOrder >= 50) {
    return { essenceRequired: 6, contributionRequired: 120 };
  }

  return { essenceRequired: 3, contributionRequired: 50 };
}

function sumCollectRewardQuantity(rewards: ClientCollectRewardItem[], kind: NonNullable<ClientCollectRewardItem['kind']>): number {
  return rewards
    .filter((reward) => reward.kind === kind)
    .reduce((sum, reward) => sum + Math.max(Math.floor(reward.quantity), 0), 0);
}

function getDailyTaskTitle(taskId: string): string {
  const titleMap: Record<string, string> = {
    'daily-harvest-once': '收一次田地',
    'daily-start-cultivation': '开始一次培育',
    'daily-upgrade-building': '修习一次法术',
    'daily-feed-spirit': '投喂一次灵宠',
    'daily-recruit-army': '征召一次士兵',
  };

  return titleMap[taskId] ?? taskId;
}

function hashCollectFieldRequest(request: CollectFieldRequestDto): string {
  return createHash('sha256')
    .update(JSON.stringify({
      fieldId: request.fieldId,
      collectMode: request.collectMode,
      fieldVersion: request.fieldVersion ?? null,
      walletVersion: request.walletVersion ?? null,
    }))
    .digest('hex');
}

function getDailyTaskIdsByObjective(objectiveType: string): string[] {
  return [
    ...DAILY_TASK_CONFIG.fixedTasks,
    ...DAILY_TASK_CONFIG.randomTasks,
    ...DAILY_TASK_CONFIG.catchupTasks,
  ]
    .filter((task) => task.objective.type === objectiveType)
    .map((task) => task.id);
}

function assertVersion(label: string, expected: number | undefined, actual: number): void {
  if (typeof expected !== 'number') {
    return;
  }

  if (expected !== actual) {
    throw new BusinessError({
      code: ErrorCode.StateVersionConflict,
      message: `${label} conflict.`,
      statusCode: 409,
      details: { expected, actual },
    });
  }
}

function throwBadRequest(message: string): never {
  throw new BusinessError({
    code: ErrorCode.BadRequest,
    message,
    statusCode: 400,
  });
}

function buildBuildingUpdateData(target: BuildingUpgradeTarget): Prisma.PlayerBuildingUpdateInput {
  const data: Prisma.PlayerBuildingUpdateInput = {
    buildingVersion: { increment: 1 },
  };

  if (target.key === 'castle') {
    data.castleLevel = target.nextLevel;
  } else if (target.key === 'vault') {
    data.vaultLevel = target.nextLevel;
  } else if (target.key === 'watchtower') {
    data.watchtowerLevel = target.nextLevel;
  } else if (target.key === 'protectionTech') {
    data.protectionTechLevel = target.nextLevel;
  } else if (target.key === 'farmYieldTech') {
    data.farmYieldTechLevel = target.nextLevel;
  } else if (target.key === 'ripeWindowTech') {
    data.ripeWindowTechLevel = target.nextLevel;
  } else if (target.key === 'factionOfferingTech' || target.key === 'pendingClaimTech') {
    data.pendingClaimTechLevel = target.nextLevel;
  }

  return data;
}

