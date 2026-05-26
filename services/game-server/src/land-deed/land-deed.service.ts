import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { LAND_DEED_CONFIG } from '../lib/game-balance.js';

type PrismaClientLike = Prisma.TransactionClient | PrismaClient;

interface RequirementProgress {
  key: string;
  label: string;
  current: number;
  target: number;
  completed: boolean;
}

@Injectable()
export class LandDeedService {
  async reconcilePlayerLandDeeds(client: PrismaClientLike, playerId: string, now: Date = new Date()): Promise<void> {
    const metrics = await this.loadMetrics(client, playerId, now);

    for (const config of LAND_DEED_CONFIG) {
      const requirements = config.requirements.map((requirement) => buildRequirementProgress(requirement, metrics));
      const alternativeRequirements = config.alternativeRequirements?.map((requirement) => buildRequirementProgress(requirement, metrics)) ?? [];
      const mainCompleted = requirements.every((requirement) => requirement.completed);
      const alternativeCompleted = alternativeRequirements.length > 0 && alternativeRequirements.every((requirement) => requirement.completed);
      const targetField = await client.playerFieldSlot.findUnique({
        where: {
          playerId_slotIndex: {
            playerId,
            slotIndex: config.targetFieldSlotIndex,
          },
        },
        select: {
          id: true,
          isUnlocked: true,
          status: true,
        },
      });
      const completed = mainCompleted || alternativeCompleted;
      const shouldClaim = completed || Boolean(targetField?.isUnlocked);
      const existingProgress = await client.playerLandDeedProgress.findUnique({
        where: {
          playerId_deedKey: {
            playerId,
            deedKey: config.deedKey,
          },
        },
        select: {
          claimedAt: true,
        },
      });
      const status = shouldClaim ? 'claimed' : 'in_progress';
      const claimedAt = shouldClaim ? existingProgress?.claimedAt ?? now : null;
      const progressJson = {
        requirements,
        alternativeRequirements,
      } as unknown as Prisma.InputJsonValue;

      await client.playerLandDeedProgress.upsert({
        where: {
          playerId_deedKey: {
            playerId,
            deedKey: config.deedKey,
          },
        },
        create: {
          playerId,
          deedKey: config.deedKey,
          status,
          progressJson,
          claimedAt,
        },
        update: {
          status,
          progressJson,
          claimedAt,
        },
      });

      if (completed && targetField && !targetField.isUnlocked) {
        await client.playerFieldSlot.update({
          where: { id: targetField.id },
          data: {
            isUnlocked: true,
            status: targetField.status === 'LOCKED' ? 'EMPTY' : targetField.status,
            statusVersion: { increment: 1 },
          },
        });
      }
    }
  }

  private async loadMetrics(client: PrismaClientLike, playerId: string, now: Date): Promise<Record<string, number>> {
    const tutorialSeedId = 'qilingya';
    const [player, harvestCount, factionMember, successfulRaidCount, factionDonateCount, buildingUpgradeCount] = await Promise.all([
      client.player.findUnique({
        where: { id: playerId },
        select: { createdAt: true },
      }),
      client.fieldHarvestLog.count({
        where: {
          playerId,
          fieldSlot: {
            seedDefinition: {
              seedId: {
                not: tutorialSeedId,
              },
            },
          },
        },
      }),
      client.factionMember.findFirst({
        where: { playerId },
        select: { contributionScore: true },
      }),
      client.raidOrder.count({
        where: {
          attackerPlayerId: playerId,
          status: 'SETTLED',
          settlement: { result: 'WIN' },
        },
      }),
      client.factionContributionLog.count({ where: { playerId } }),
      client.buildingUpgradeLog.count({ where: { playerId } }),
    ]);

    return {
      accountAgeDays: player ? Math.floor(Math.max(now.getTime() - player.createdAt.getTime(), 0) / 86_400_000) : 0,
      harvestCount,
      factionContribution: factionMember?.contributionScore ?? 0,
      successfulRaidCount,
      factionDonateCount,
      buildingUpgradeCount,
    };
  }
}

function buildRequirementProgress(requirement: { key: string; label: string; target: number }, metrics: Record<string, number>): RequirementProgress {
  const current = Math.max(Math.floor(metrics[requirement.key] ?? 0), 0);

  return {
    key: requirement.key,
    label: requirement.label,
    current,
    target: requirement.target,
    completed: current >= requirement.target,
  };
}
