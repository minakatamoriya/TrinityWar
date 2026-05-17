import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  APP_NAME,
  type ClientClaimDailyTaskResponse,
  type ClientClaimPendingResponse,
  type ClientCollectFieldResponse,
  type ClientStateMutationResponse,
} from '@trinitywar/shared';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';
import { getLocalDateKey } from '../lib/date-key.js';
import { GAME_BALANCE } from '../lib/game-balance.js';
import { getPopulationCapacityGain, getVaultCapacityGain } from '../lib/game-balance.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClientReadService } from '../client-read/client-read.service.js';
import { ArmyTrainingLifecycleService } from '../client-read/army-training-lifecycle.service.js';
import { FieldLifecycleService } from '../client-read/field-lifecycle.service.js';
import {
  BuildingUpgradeRuleService,
  type BuildingUpgradeTarget,
  type PlayerBuildingStateForUpgrade,
} from './building-upgrade-rule.service.js';
import { FieldCommandRuleService } from './field-command-rule.service.js';
import type { ClaimDailyTaskRequestDto, ClaimPendingRequestDto, CollectFieldRequestDto, RecruitArmyRequestDto, UpgradeBuildingRequestDto } from './dto.js';

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

interface RecruitArmyCommandInput {
  playerId: string;
  request: RecruitArmyRequestDto;
  idempotencyKey?: string;
}

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
  ) {}

  async claimPending(input: ClaimPendingCommandInput): Promise<ClientClaimPendingResponse> {
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

      const availableVaultSpace = Math.max(wallet.vaultCapacity - wallet.vaultGold, 0);
      const claimedGold = Math.min(pendingGold, availableVaultSpace);
      const overflowGold = Math.max(pendingGold - claimedGold, 0);
      const acceptOverflowLoss = Boolean(input.request.acceptOverflowLoss);

      if (overflowGold > 0 && !acceptOverflowLoss) {
        const responseSnapshot = await this.buildClaimPendingResponse(client, input.playerId, {
          summary: `${getPendingClaimSourceLabel(input.request.source)}本次预计入账 ${overflowGold + claimedGold} 金币，其中约 ${overflowGold} 会因金币已满无法入账。确认后默认放弃溢出部分。`,
          source: input.request.source,
          claimedGold: 0,
          remainingPendingGold: pendingGold,
          ledger: wallet,
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
      }

      const nextVaultGold = wallet.vaultGold + claimedGold;
      const nextPendingGold = acceptOverflowLoss ? 0 : overflowGold;
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
        summary: buildClaimPendingSummary(input.request.source, claimedGold, nextPendingGold, overflowGold, acceptOverflowLoss),
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
              vaultCapacity: true,
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
      const availableVaultSpace = Math.max(playerState.wallet.vaultCapacity - playerState.wallet.vaultGold, 0);
      const claimedGold = Math.min(rewardGold, availableVaultSpace);
      const overflowGold = Math.max(rewardGold - claimedGold, 0);
      const acceptOverflowLoss = Boolean(input.request.acceptOverflowLoss);

      if (overflowGold > 0 && !acceptOverflowLoss) {
        const responseSnapshot = await this.buildClaimDailyTaskResponse(client, input.playerId, {
          summary: `${getDailyTaskTitle(taskState.taskId)} 奖励共 ${rewardGold} 金币，其中约 ${overflowGold} 会因金币已满无法入账。确认后将默认放弃溢出部分。`,
          taskId: taskState.taskId,
          rewardGold,
          claimedGold: 0,
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
      }

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
        summary: overflowGold > 0
          ? `${getDailyTaskTitle(taskState.taskId)} 已结算，入账 ${claimedGold} 金币，另有 ${overflowGold} 已确认放弃。`
          : `${getDailyTaskTitle(taskState.taskId)} 已结算，入账 ${claimedGold} 金币。`,
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

  async collectField(input: CollectFieldCommandInput): Promise<ClientCollectFieldResponse> {
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
              vaultCapacity: true,
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
              seedDefinition: {
                select: {
                  seedId: true,
                  label: true,
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

      await this.auditService.createFieldHarvestLog(client, {
        playerId: input.playerId,
        fieldSlotId: field.id,
        collectMode: input.request.collectMode,
        collectedGold: resolution.collectedGold,
        overflowGold: resolution.overflowGold,
        rewardItemsJson: resolution.rewards as unknown as Prisma.InputJsonValue,
      });

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

  async recruitArmy(input: RecruitArmyCommandInput): Promise<ClientStateMutationResponse> {
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
        },
      });

      if (!playerState?.buildings || !playerState.wallet) {
        throw new BusinessError({
          code: ErrorCode.NotFound,
          message: 'Player building or wallet state not found.',
          statusCode: 404,
        });
      }

      assertVersion('buildingVersion', input.request.buildingVersion, playerState.buildings.buildingVersion);
      assertVersion('walletVersion', input.request.walletVersion, playerState.wallet.balanceVersion);

      const target = this.resolveTarget(playerState.buildings, input.request);

      if (playerState.buildings.castleLevel < target.requiredCastleLevel) {
        throw new BusinessError({
          code: ErrorCode.Forbidden,
          message: `Castle level ${target.requiredCastleLevel} is required.`,
          statusCode: 403,
        });
      }

      if (playerState.wallet.vaultGold < target.costGold) {
        throw new BusinessError({
          code: ErrorCode.InsufficientVaultGold,
          message: 'Insufficient vault gold.',
          statusCode: 409,
        });
      }

      const nextVaultGold = playerState.wallet.vaultGold - target.costGold;
      await client.playerBuilding.update({
        where: { playerId: input.playerId },
        data: buildBuildingUpdateData(target),
      });
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

      if (target.key === 'castle') {
        await client.player.update({
          where: { id: input.playerId },
          data: { castleLevelCache: target.nextLevel },
        });
      }

      if (target.key === 'population') {
        await client.playerArmy.update({
          where: { playerId: input.playerId },
          data: {
            capacity: { increment: getPopulationCapacityGain(target.currentLevel) },
            armyVersion: { increment: 1 },
          },
        });
      }

      await this.auditService.createWalletChangeLog(client, {
        playerId: input.playerId,
        walletBucket: 'vault',
        changeType: 'upgrade-building',
        deltaGold: -target.costGold,
        beforeGold: playerState.wallet.vaultGold,
        afterGold: nextVaultGold,
        relatedEntityType: target.isExtension ? 'castle-extension' : 'building',
        relatedEntityId: target.key,
        requestIdempotencyKey: idempotencyKey,
        note: `Upgrade ${target.key} from Lv.${target.currentLevel} to Lv.${target.nextLevel}.`,
      });
      await this.auditService.createBuildingUpgradeLog(client, {
        playerId: input.playerId,
        buildingKey: target.key,
        oldLevel: target.currentLevel,
        newLevel: target.nextLevel,
        costGold: target.costGold,
        requestIdempotencyKey: idempotencyKey,
      });

      const responseSnapshot: ClientStateMutationResponse = {
        app: APP_NAME,
        summary: `已升级 ${target.key}：Lv.${target.currentLevel} -> Lv.${target.nextLevel}`,
        home: await this.clientReadService.getHomeSummary(input.playerId, client),
        scenes: await this.clientReadService.getSceneContent(input.playerId, client),
      };

      if (idempotencyRecord?.id) {
        await this.idempotencyService.markCompleted(client, {
          id: idempotencyRecord.id,
          responseSnapshotJson: responseSnapshot as unknown as Prisma.InputJsonValue,
          businessEntityType: target.isExtension ? 'castle-extension' : 'building',
          businessEntityId: target.key,
        });
      }

      return responseSnapshot;
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

    throwBadRequest('targetType must be building or castle-extension.');
  }

  private wrapRuleError(handler: () => BuildingUpgradeTarget): BuildingUpgradeTarget {
    try {
      return handler();
    } catch (error) {
      if (error instanceof Error && error.message === 'FIELD_SLOT_AUTO_UNLOCK') {
        throw new BusinessError({
          code: ErrorCode.BadRequest,
          message: 'Field slots are unlocked automatically by castle level.',
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

function hashRecruitArmyRequest(request: RecruitArmyRequestDto): string {
  return createHash('sha256')
    .update(JSON.stringify({
      recruitCount: request.recruitCount,
      walletVersion: request.walletVersion ?? null,
      armyVersion: request.armyVersion ?? null,
    }))
    .digest('hex');
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
  overflowGold: number,
  acceptOverflowLoss: boolean,
): string {
  const sourceLabel = getPendingClaimSourceLabel(source);

  if (acceptOverflowLoss && overflowGold > 0) {
    return `${sourceLabel}本次入账 ${claimedGold} 金币，另有 ${overflowGold} 已确认放弃。`;
  }

  if (claimedGold > 0) {
    return `${sourceLabel}本次入账 ${claimedGold} 金币，剩余待领取 ${remainingPendingGold}。`;
  }

  return `金币空间不足，当前没有可入账的${sourceLabel}。`;
}

function getDailyTaskTitle(taskId: string): string {
  const titleMap: Record<string, string> = {
    'daily-harvest-once': '收一次田地',
    'daily-start-cultivation': '开始一次培育',
    'daily-upgrade-building': '升级一次建筑',
    'daily-recruit-army': '征召一次战力',
    'daily-donate-faction': '上缴一次阵营资源',
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
  } else if (target.key === 'population') {
    data.populationLevel = target.nextLevel;
  } else if (target.key === 'watchtower') {
    data.watchtowerLevel = target.nextLevel;
  } else if (target.key === 'protectionTech') {
    data.protectionTechLevel = target.nextLevel;
  } else if (target.key === 'farmYieldTech') {
    data.farmYieldTechLevel = target.nextLevel;
  } else if (target.key === 'ripeWindowTech') {
    data.ripeWindowTechLevel = target.nextLevel;
  } else if (target.key === 'pendingClaimTech') {
    data.pendingClaimTechLevel = target.nextLevel;
  }

  return data;
}
