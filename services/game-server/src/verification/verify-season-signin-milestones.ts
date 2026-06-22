import { NestFactory } from '@nestjs/core';
import { AuthService } from '../auth/auth.service.js';
import { ClientCommandService } from '../client-command/client-command.service.js';
import { ClientReadService } from '../client-read/client-read.service.js';
import { AppModule } from '../modules/app/app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SeasonService } from '../season/season.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const clientCommandService = app.get(ClientCommandService);
    const clientReadService = app.get(ClientReadService);
    const seasonService = app.get(SeasonService);
    const prisma = app.get(PrismaService).db;
    const suffix = Date.now();
    const login = await authService.devLogin({
      providerUserId: `verify-signin-milestone-${suffix}`,
      nickname: `signin-milestone-${suffix}`,
      factionCode: 'human',
    });
    const playerId = login.player.id;
    const season = seasonService.getCurrentSeason();
    await seasonService.ensurePlayerSeason(prisma, playerId);

    await prisma.playerSeasonSignIn.createMany({
      data: [1, 2, 3, 4, 5, 6, 7].map((dayIndex) => ({
        playerId,
        seasonNumber: season.seasonNumber,
        dayIndex,
        rewardTianjiTalisman: 1,
      })),
      skipDuplicates: true,
    });

    const initialSignIn = await clientReadService.getSeasonSignIn(playerId);
    const beforeResource = await prisma.playerSpiritResource.findUniqueOrThrow({
      where: { playerId },
      select: {
        tianjiTalisman: true,
        ordinarySoul: true,
        rareSoul: true,
        legendarySoul: true,
      },
    });

    const day1Claim = await clientCommandService.claimSeasonSignInMilestone({
      playerId,
      request: { dayCount: 1 },
    });
    const day7Claim = await clientCommandService.claimSeasonSignInMilestone({
      playerId,
      request: { dayCount: 7 },
    });

    const duplicateRejected = await clientCommandService.claimSeasonSignInMilestone({
      playerId,
      request: { dayCount: 1 },
    }).then(() => false).catch(() => true);

    const afterResource = await prisma.playerSpiritResource.findUniqueOrThrow({
      where: { playerId },
      select: {
        tianjiTalisman: true,
        ordinarySoul: true,
        rareSoul: true,
        legendarySoul: true,
      },
    });

    const codexDay7Spirit = day7Claim.rewards.find((reward) => reward.kind === 'spiritShard' && reward.spiritId)?.spiritId ?? null;
    const codexDefinition = codexDay7Spirit
      ? await prisma.spiritDefinition.findUnique({
        where: { spiritId: codexDay7Spirit },
        select: { id: true },
      })
      : null;
    const codexAfter = codexDefinition
      ? await prisma.playerSpiritCodex.findUnique({
        where: {
          playerId_spiritDefinitionId: {
            playerId,
            spiritDefinitionId: codexDefinition.id,
          },
        },
        select: {
          shardCount: true,
          hasSeen: true,
        },
      })
      : null;

    const refreshedSignIn = await clientReadService.getSeasonSignIn(playerId);
    const claimedMilestones = refreshedSignIn.milestones.filter((milestone) => milestone.claimed).map((milestone) => milestone.dayCount);

    const expectedTalismanGain = sumRewardQuantity([...day1Claim.rewards, ...day7Claim.rewards], 'tianjiTalisman');
    const expectedOrdinarySoulGain = sumRewardQuantity([...day1Claim.rewards, ...day7Claim.rewards], 'ordinarySoul');
    const expectedRareSoulGain = sumRewardQuantity([...day1Claim.rewards, ...day7Claim.rewards], 'rareSoul');
    const expectedLegendarySoulGain = sumRewardQuantity([...day1Claim.rewards, ...day7Claim.rewards], 'legendarySoul');
    const expectedShardGain = sumRewardQuantity(day7Claim.rewards, 'spiritShard');

    if (!initialSignIn.milestones.some((milestone) => milestone.dayCount === 1 && milestone.claimable)) {
      throw new Error('Expected 1-day milestone to be claimable in test mode.');
    }
    if (!initialSignIn.milestones.some((milestone) => milestone.dayCount === 7 && milestone.claimable)) {
      throw new Error('Expected 7-day milestone to be claimable in test mode.');
    }
    if (!duplicateRejected) {
      throw new Error('Expected duplicate milestone claim to be rejected.');
    }
    if (afterResource.tianjiTalisman !== beforeResource.tianjiTalisman + expectedTalismanGain) {
      throw new Error('Expected milestone talisman rewards to be credited.');
    }
    if (afterResource.ordinarySoul !== beforeResource.ordinarySoul + expectedOrdinarySoulGain) {
      throw new Error('Expected milestone ordinary soul rewards to be credited.');
    }
    if (afterResource.rareSoul !== beforeResource.rareSoul + expectedRareSoulGain) {
      throw new Error('Expected milestone rare soul rewards to be credited.');
    }
    if (afterResource.legendarySoul !== beforeResource.legendarySoul + expectedLegendarySoulGain) {
      throw new Error('Expected milestone legendary soul rewards to be credited.');
    }
    if (expectedShardGain > 0 && (!codexAfter || !codexAfter.hasSeen || codexAfter.shardCount < expectedShardGain)) {
      throw new Error('Expected milestone spirit shard rewards to be credited into codex.');
    }
    if (!claimedMilestones.includes(1) || !claimedMilestones.includes(7)) {
      throw new Error(`Expected claimed milestones to include 1 and 7, got ${claimedMilestones.join(',')}.`);
    }

    console.log(JSON.stringify({
      ok: true,
      suffix,
      seasonNumber: season.seasonNumber,
      playerId,
      claimedMilestones,
      talismanGain: expectedTalismanGain,
      ordinarySoulGain: expectedOrdinarySoulGain,
      rareSoulGain: expectedRareSoulGain,
      legendarySoulGain: expectedLegendarySoulGain,
      shardSpiritId: codexDay7Spirit,
      shardGain: expectedShardGain,
    }, null, 2));
  } finally {
    await app.close();
  }
}

function sumRewardQuantity(
  rewards: Array<{ kind: string; quantity: number }>,
  kind: string,
): number {
  return rewards
    .filter((reward) => reward.kind === kind)
    .reduce((sum, reward) => sum + reward.quantity, 0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
