import { NestFactory } from '@nestjs/core';
import { AuthService } from '../auth/auth.service.js';
import { AppModule } from '../modules/app/app.module.js';
import { NotificationService } from '../notification/notification.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SeasonService } from '../season/season.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const notificationService = app.get(NotificationService);
    const prisma = app.get(PrismaService).db;
    const seasonService = app.get(SeasonService);
    const suffix = Date.now();
    const login = await authService.devLogin({
      providerUserId: `verify-season-reward-${suffix}`,
      nickname: `season-reward-${suffix}`,
      factionCode: 'human',
    });
    const playerId = login.player.id;
    const season = seasonService.getCurrentSeason();

    await prisma.factionMember.updateMany({
      where: { playerId },
      data: { contributionScore: 800 },
    });
    await prisma.playerSeasonSignIn.createMany({
      data: [1, 2, 3].map((dayIndex) => ({
        playerId,
        seasonNumber: season.seasonNumber,
        dayIndex,
        rewardTianjiTalisman: 1,
      })),
      skipDuplicates: true,
    });
    await prisma.playerSeasonActivity.createMany({
      data: ['2026-06-01', '2026-06-02', '2026-06-03'].map((dateKey) => ({
        playerId,
        seasonNumber: season.seasonNumber,
        dateKey,
      })),
      skipDuplicates: true,
    });
    const shardSpirit = await prisma.spiritDefinition.findUniqueOrThrow({
      where: { spiritId: 'canglang' },
      select: { id: true, shardUnlockRequired: true, baseHp: true, growthHp: true },
    });
    await prisma.playerSpiritSlot.upsert({
      where: {
        playerId_slotIndex: {
          playerId,
          slotIndex: 1,
        },
      },
      create: {
        playerId,
        slotIndex: 1,
        spiritDefinitionId: shardSpirit.id,
        isMain: true,
        level: 12,
        element: 'FIRE',
        currentHp: shardSpirit.baseHp + shardSpirit.growthHp * 11,
        maxHp: shardSpirit.baseHp + shardSpirit.growthHp * 11,
        status: 'ACTIVE',
        acquiredAt: new Date(),
      },
      update: {
        spiritDefinitionId: shardSpirit.id,
        isMain: true,
        level: 12,
        element: 'FIRE',
        currentHp: shardSpirit.baseHp + shardSpirit.growthHp * 11,
        maxHp: shardSpirit.baseHp + shardSpirit.growthHp * 11,
        status: 'ACTIVE',
        dissolvedAt: null,
        acquiredAt: new Date(),
      },
    });

    const beforeResource = await prisma.playerSpiritResource.findUniqueOrThrow({
      where: { playerId },
      select: { tianjiTalisman: true, ordinarySoul: true },
    });
    const beforeCodex = await prisma.playerSpiritCodex.findUnique({
      where: {
        playerId_spiritDefinitionId: {
          playerId,
          spiritDefinitionId: shardSpirit.id,
        },
      },
      select: { shardCount: true },
    });
    await seasonService.generateSeasonSnapshots(prisma, season.seasonNumber);
    await seasonService.generateSeasonSnapshots(prisma, season.seasonNumber);

    const grants = await prisma.playerSeasonRewardGrant.findMany({
      where: { playerId, seasonNumber: season.seasonNumber },
      orderBy: { rewardType: 'asc' },
    });
    if (grants.length < 2) {
      throw new Error(`Expected at least 2 season reward grants, got ${grants.length}.`);
    }
    if (!grants.some((grant) => grant.rewardType === 'participation')) {
      throw new Error('Expected participation reward grant.');
    }
    const spiritGrant = grants.find((grant) => grant.rewardType === 'domain_spirit');
    if (!spiritGrant) {
      throw new Error('Expected spirit domain reward grant.');
    }
    if (spiritGrant.rewardTier !== 'season-spirit-silver') {
      throw new Error(`Expected spirit tier season-spirit-silver, got ${spiritGrant.rewardTier ?? 'null'}.`);
    }
    const contributionGrant = grants.find((grant) => grant.rewardType === 'contribution_tier');
    if (!contributionGrant) {
      throw new Error('Expected contribution tier reward grant.');
    }
    if (contributionGrant.rewardTier !== 'season-contribution-800') {
      throw new Error(`Expected contribution tier season-contribution-800, got ${contributionGrant.rewardTier ?? 'null'}.`);
    }
    if (grants.some((grant) => grant.status !== 'notified' || !grant.notificationId)) {
      throw new Error('Expected season reward grants to be linked to claimable notifications.');
    }

    const rewardsBeforeClaim = await seasonService.getSeasonRewards(prisma, playerId);
    const currentSeasonRewards = rewardsBeforeClaim.items.filter((item) => item.seasonNumber === season.seasonNumber);
    const currentClaimableCount = currentSeasonRewards.filter((item) => item.status === 'notified').length;
    if (currentClaimableCount !== grants.length) {
      throw new Error(`Expected ${grants.length} current season claimable rewards, got ${currentClaimableCount}.`);
    }

    const notification = await prisma.playerNotification.findUniqueOrThrow({
      where: { id: contributionGrant.notificationId ?? '' },
      select: { id: true, titleSnapshot: true, bodySnapshot: true, claimStatus: true, attachmentJson: true, expiresAt: true },
    });
    if (notification.claimStatus !== 'UNCLAIMED') {
      throw new Error(`Expected season reward notification to be unclaimed, got ${notification.claimStatus}.`);
    }
    if (!notification.titleSnapshot.includes('赛季奖励')) {
      throw new Error(`Expected season reward notification title to be Chinese, got ${notification.titleSnapshot}.`);
    }
    if (!notification.bodySnapshot.includes('探索战斗领域') && !notification.bodySnapshot.includes('贡献领域')) {
      throw new Error(`Expected season reward notification body to be Chinese, got ${notification.bodySnapshot}.`);
    }
    if (notification.titleSnapshot.includes('Season') || notification.bodySnapshot.includes('Your Season')) {
      throw new Error('Expected season reward notification snapshots not to contain English copy.');
    }
    if (!notification.expiresAt || notification.expiresAt.getTime() <= Date.now()) {
      throw new Error('Expected season reward notification to have a future expiry.');
    }

    let expectedTalismanReward = 0;
    let expectedOrdinarySoulReward = 0;
    let expectedShardReward = 0;
    let foundMedal = false;
    const attachments = Array.isArray(notification.attachmentJson) ? notification.attachmentJson : [];
    for (const reward of attachments) {
      if (!reward || typeof reward !== 'object' || Array.isArray(reward)) {
        continue;
      }
      const record = reward as { kind?: unknown; quantity?: unknown; spiritId?: unknown };
      if (record.kind === 'tianjiTalisman') {
        expectedTalismanReward += Number(record.quantity ?? 0);
      }
      if (record.kind === 'ordinarySoul') {
        expectedOrdinarySoulReward += Number(record.quantity ?? 0);
      }
      if (record.kind === 'spiritShard' && record.spiritId === 'canglang') {
        expectedShardReward += Number(record.quantity ?? 0);
      }
      if (record.kind === 'medal') {
        foundMedal = true;
      }
      if (record.kind === 'tianjiTalisman' && (record as { label?: unknown }).label !== '天机符') {
        throw new Error('Expected season reward item label to be Chinese.');
      }
    }
    if (expectedOrdinarySoulReward <= 0) {
      throw new Error('Expected contribution reward to include ordinary soul.');
    }
    if (expectedShardReward <= 0) {
      throw new Error('Expected contribution reward to include spirit shard.');
    }
    if (!foundMedal) {
      throw new Error('Expected contribution reward to include a season medal attachment.');
    }
    await notificationService.claimPlayerNotification(playerId, notification.id);

    const afterResource = await prisma.playerSpiritResource.findUniqueOrThrow({
      where: { playerId },
      select: { tianjiTalisman: true, ordinarySoul: true },
    });
    if (afterResource.tianjiTalisman !== beforeResource.tianjiTalisman + expectedTalismanReward) {
      throw new Error('Expected season reward talisman grant to be credited.');
    }
    if (afterResource.ordinarySoul !== beforeResource.ordinarySoul + expectedOrdinarySoulReward) {
      throw new Error('Expected season reward ordinary soul grant to be credited.');
    }

    const afterCodex = await prisma.playerSpiritCodex.findUniqueOrThrow({
      where: {
        playerId_spiritDefinitionId: {
          playerId,
          spiritDefinitionId: shardSpirit.id,
        },
      },
      select: { shardCount: true },
    });
    const expectedShardCount = Math.min((beforeCodex?.shardCount ?? 0) + expectedShardReward, shardSpirit.shardUnlockRequired);
    if (afterCodex.shardCount !== expectedShardCount) {
      throw new Error('Expected season reward spirit shard grant to be credited.');
    }

    const essenceLogCount = await prisma.essenceTransactionLog.count({
      where: {
        playerId,
        reason: 'season-reward',
        sourceId: contributionGrant.id,
      },
    });
    if (essenceLogCount <= 0) {
      throw new Error('Expected season reward essence transaction log.');
    }
    const claimedGrant = await prisma.playerSeasonRewardGrant.findUniqueOrThrow({
      where: { id: contributionGrant.id },
      select: { status: true, claimedAt: true },
    });
    if (claimedGrant.status !== 'claimed' || !claimedGrant.claimedAt) {
      throw new Error('Expected notification claim to mark season reward grant claimed.');
    }
    const contributionAchievement = await prisma.playerSeasonAchievement.findFirst({
      where: {
        playerId,
        seasonNumber: season.seasonNumber,
        achievementKey: 'season-contribution-800',
        rewardGrantId: contributionGrant.id,
      },
      select: { id: true },
    });
    if (!contributionAchievement) {
      throw new Error('Expected season contribution achievement to be recorded.');
    }
    const rewardsAfterClaim = await seasonService.getSeasonRewards(prisma, playerId);
    const currentCabinet = rewardsAfterClaim.medalCabinet.medalsBySeason.find((item) => item.seasonNumber === season.seasonNumber);
    if (!currentCabinet || !currentCabinet.title.includes(`S${season.seasonNumber}`)) {
      throw new Error('Expected current season medal cabinet.');
    }
    if (!currentCabinet.medals.some((medal) => medal.achievementKey === 'season-contribution-800' && medal.title === '赛季贡献铜章' && medal.titleEn === 'Season Contribution Bronze')) {
      throw new Error('Expected bilingual contribution medal in cabinet.');
    }

    try {
      await notificationService.claimPlayerNotification(playerId, notification.id);
      throw new Error('Expected duplicate season reward claim to fail.');
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('already been claimed')) {
        throw error;
      }
    }

    console.log(JSON.stringify({
      ok: true,
      suffix,
      seasonNumber: season.seasonNumber,
      playerId,
      grantCount: grants.length,
      claimedGrantId: contributionGrant.id,
    }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
