import { NestFactory } from '@nestjs/core';
import { SocialFeedType, SocialRelationStatus, SocialRelationType } from '@prisma/client';
import { AuthService } from '../auth/auth.service.js';
import { AppModule } from '../modules/app/app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SeasonService } from '../season/season.service.js';
import { SOCIAL_FOLLOW_LIMIT_CONFIG, SOCIAL_FRIEND_LIMIT_CONFIG, SocialService } from '../social/social.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const socialService = app.get(SocialService);
    const seasonService = app.get(SeasonService);
    const prisma = app.get(PrismaService).db;
    const suffix = Date.now();

    const playerA = await authService.devLogin({
      providerUserId: `verify-social-a-${suffix}`,
      nickname: `社交验证A_${suffix}`,
      factionCode: 'human',
    });
    const playerB = await authService.devLogin({
      providerUserId: `verify-social-b-${suffix}`,
      nickname: `社交验证B_${suffix}`,
      factionCode: 'demon',
    });

    const followed = await socialService.follow(playerA.player.id, {
      targetPlayerId: playerB.player.id,
    });
    if (followed.relation.status !== 'active' || followed.relation.relationType !== 'following') {
      throw new Error(`Follow did not create an active following relation: ${JSON.stringify(followed)}`);
    }

    const request = await socialService.requestFriend(playerA.player.id, {
      targetPlayerId: playerB.player.id,
    });
    if (request.relation.status !== 'pending' || request.reverseRelation?.status !== 'pending') {
      throw new Error(`Friend request did not create pending relations: ${JSON.stringify(request)}`);
    }

    const requestFeed = await prisma.playerSocialFeed.findFirst({
      where: {
        playerId: playerB.player.id,
        actorPlayerId: playerA.player.id,
        feedType: SocialFeedType.FRIEND_REQUESTED,
        relatedEntityId: request.reverseRelation?.id,
        expiresAt: null,
      },
    });
    if (!requestFeed) {
      throw new Error('Friend request did not create an incoming social feed item.');
    }

    const accepted = await socialService.acceptFriendRequest(playerB.player.id, request.reverseRelation?.id ?? '');
    if (accepted.relation.status !== 'active' || accepted.reverseRelation?.status !== 'active') {
      throw new Error(`Accept did not activate both relations: ${JSON.stringify(accepted)}`);
    }

    await assertRelationStatus(prisma, playerA.player.id, playerB.player.id, SocialRelationStatus.ACTIVE);
    await assertRelationStatus(prisma, playerB.player.id, playerA.player.id, SocialRelationStatus.ACTIVE);
    await assertRelationStatus(prisma, playerA.player.id, playerB.player.id, SocialRelationStatus.MUTED, SocialRelationType.FOLLOWING);

    const friendsA = await socialService.listRelations(playerA.player.id, SocialRelationType.FRIEND);
    const friendsB = await socialService.listRelations(playerB.player.id, SocialRelationType.FRIEND);
    if (!friendsA.items.some((item) => item.target.playerId === playerB.player.id) || !friendsB.items.some((item) => item.target.playerId === playerA.player.id)) {
      throw new Error('Accepted friends are missing from one of the friend lists.');
    }

    const deleted = await socialService.deleteFriend(playerA.player.id, playerB.player.id);
    if (deleted.relation.status !== 'muted' || deleted.reverseRelation?.status !== 'muted') {
      throw new Error(`Delete did not mute both relations: ${JSON.stringify(deleted)}`);
    }

    const friendsAfterDelete = await socialService.listRelations(playerA.player.id, SocialRelationType.FRIEND);
    if (friendsAfterDelete.items.some((item) => item.target.playerId === playerB.player.id)) {
      throw new Error('Deleted friend still appears in friend list.');
    }

    const followingAfterDelete = await socialService.listRelations(playerA.player.id, SocialRelationType.FOLLOWING);
    if (followingAfterDelete.items.some((item) => item.target.playerId === playerB.player.id)) {
      throw new Error('Deleting a friend restored an old following relation.');
    }

    const deletedFeeds = await prisma.playerSocialFeed.findMany({
      where: {
        feedType: SocialFeedType.FRIEND_DELETED,
        OR: [
          { playerId: playerA.player.id, actorPlayerId: playerB.player.id },
          { playerId: playerB.player.id, actorPlayerId: playerA.player.id },
        ],
      },
    });
    if (deletedFeeds.length !== 2) {
      throw new Error(`Friend delete did not create both social feed items: ${JSON.stringify(deletedFeeds)}`);
    }

    let immediateReRequestRejected = false;
    try {
      await socialService.requestFriend(playerA.player.id, {
        targetPlayerId: playerB.player.id,
      });
    } catch (error) {
      immediateReRequestRejected = error instanceof Error && error.message.includes('好友申请过于频繁');
    }
    if (!immediateReRequestRejected) {
      throw new Error('Friend re-request immediately after deletion was not rate-limited.');
    }

    const followedAfterDelete = await socialService.follow(playerA.player.id, {
      targetPlayerId: playerB.player.id,
    });
    if (followedAfterDelete.relation.status !== 'active') {
      throw new Error(`Follow after deleting friend failed: ${JSON.stringify(followedAfterDelete)}`);
    }

    const unfollowed = await socialService.unfollow(playerA.player.id, playerB.player.id);
    if (unfollowed.relation.status !== 'muted') {
      throw new Error(`Unfollow did not mute following relation: ${JSON.stringify(unfollowed)}`);
    }

    const followingAfterUnfollow = await socialService.listRelations(playerA.player.id, SocialRelationType.FOLLOWING);
    if (followingAfterUnfollow.items.some((item) => item.target.playerId === playerB.player.id)) {
      throw new Error('Unfollowed player still appears in following list.');
    }

    for (let index = 0; index < SOCIAL_FOLLOW_LIMIT_CONFIG.baseLimit; index += 1) {
      const target = await authService.devLogin({
        providerUserId: `verify-social-follow-target-${suffix}-${index}`,
        nickname: `关注上限目标_${suffix}_${index}`,
        factionCode: index % 2 === 0 ? 'human' : 'immortal',
      });
      await socialService.follow(playerA.player.id, {
        targetPlayerId: target.player.id,
      });
    }

    const summaryAtLimit = await socialService.getSummary(playerA.player.id);
    if (
      summaryAtLimit.counts.following !== SOCIAL_FOLLOW_LIMIT_CONFIG.baseLimit ||
      summaryAtLimit.counts.followingLimit !== SOCIAL_FOLLOW_LIMIT_CONFIG.baseLimit ||
      summaryAtLimit.counts.followingMaxLimit !== SOCIAL_FOLLOW_LIMIT_CONFIG.hardLimit
    ) {
      throw new Error(`Unexpected following limit summary: ${JSON.stringify(summaryAtLimit.counts)}`);
    }

    const overflowTarget = await authService.devLogin({
      providerUserId: `verify-social-follow-overflow-${suffix}`,
      nickname: `关注溢出目标_${suffix}`,
      factionCode: 'demon',
    });
    let overLimitRejected = false;
    try {
      await socialService.follow(playerA.player.id, {
        targetPlayerId: overflowTarget.player.id,
      });
    } catch (error) {
      overLimitRejected = error instanceof Error && error.message.includes('关注人数已达上限');
    }
    if (!overLimitRejected) {
      throw new Error('Following over the configured limit was not rejected.');
    }

    const fullFriendPlayer = await authService.devLogin({
      providerUserId: `verify-social-full-friend-${suffix}`,
      nickname: `好友满员验证_${suffix}`,
      factionCode: 'human',
    });
    for (let index = 0; index < SOCIAL_FRIEND_LIMIT_CONFIG.baseLimit; index += 1) {
      const friend = await authService.devLogin({
        providerUserId: `verify-social-friend-limit-target-${suffix}-${index}`,
        nickname: `好友上限目标_${suffix}_${index}`,
        factionCode: index % 2 === 0 ? 'human' : 'demon',
      });
      await prisma.playerSocialRelation.createMany({
        data: [
          {
            playerId: fullFriendPlayer.player.id,
            targetPlayerId: friend.player.id,
            relationType: SocialRelationType.FRIEND,
            status: SocialRelationStatus.ACTIVE,
            sourceType: 'verify-friend-limit',
          },
          {
            playerId: friend.player.id,
            targetPlayerId: fullFriendPlayer.player.id,
            relationType: SocialRelationType.FRIEND,
            status: SocialRelationStatus.ACTIVE,
            sourceType: 'verify-friend-limit',
          },
        ],
      });
    }

    const fullFriendSummary = await socialService.getSummary(fullFriendPlayer.player.id);
    if (
      fullFriendSummary.counts.friends !== SOCIAL_FRIEND_LIMIT_CONFIG.baseLimit ||
      fullFriendSummary.counts.friendLimit !== SOCIAL_FRIEND_LIMIT_CONFIG.baseLimit ||
      fullFriendSummary.counts.friendMaxLimit !== SOCIAL_FRIEND_LIMIT_CONFIG.hardLimit
    ) {
      throw new Error(`Unexpected friend limit summary: ${JSON.stringify(fullFriendSummary.counts)}`);
    }

    const overflowFriendTarget = await authService.devLogin({
      providerUserId: `verify-social-friend-overflow-${suffix}`,
      nickname: `好友溢出目标_${suffix}`,
      factionCode: 'immortal',
    });
    let friendOverLimitRejected = false;
    try {
      await socialService.requestFriend(fullFriendPlayer.player.id, {
        targetPlayerId: overflowFriendTarget.player.id,
      });
    } catch (error) {
      friendOverLimitRejected = error instanceof Error && error.message.includes('好友人数已达上限');
    }
    if (!friendOverLimitRejected) {
      throw new Error('Friend request over the configured limit was not rejected.');
    }

    const seasonPlayer = await authService.devLogin({
      providerUserId: `verify-social-season-player-${suffix}`,
      nickname: `赛季社交保留_${suffix}`,
      factionCode: 'human',
    });
    const seasonFriend = await authService.devLogin({
      providerUserId: `verify-social-season-friend-${suffix}`,
      nickname: `赛季好友保留_${suffix}`,
      factionCode: 'demon',
    });
    const seasonFollowing = await authService.devLogin({
      providerUserId: `verify-social-season-following-${suffix}`,
      nickname: `赛季关注保留_${suffix}`,
      factionCode: 'immortal',
    });
    const seasonRequest = await socialService.requestFriend(seasonPlayer.player.id, {
      targetPlayerId: seasonFriend.player.id,
    });
    await socialService.acceptFriendRequest(seasonFriend.player.id, seasonRequest.reverseRelation?.id ?? '');
    await socialService.follow(seasonPlayer.player.id, {
      targetPlayerId: seasonFollowing.player.id,
    });

    const currentSeason = seasonService.getCurrentSeason();
    if (currentSeason.seasonNumber > 1) {
      await prisma.playerSeasonState.upsert({
        where: { playerId: seasonPlayer.player.id },
        create: {
          playerId: seasonPlayer.player.id,
          currentSeasonNumber: currentSeason.seasonNumber - 1,
          lastResetSeasonNumber: currentSeason.seasonNumber - 1,
        },
        update: {
          currentSeasonNumber: currentSeason.seasonNumber - 1,
          lastResetSeasonNumber: currentSeason.seasonNumber - 1,
        },
      });
      await seasonService.ensurePlayerSeason(prisma, seasonPlayer.player.id);
    }

    const seasonFriendsAfterReset = await socialService.listRelations(seasonPlayer.player.id, SocialRelationType.FRIEND);
    const seasonFollowingAfterReset = await socialService.listRelations(seasonPlayer.player.id, SocialRelationType.FOLLOWING);
    const seasonSummaryAfterReset = await socialService.getSummary(seasonPlayer.player.id);
    if (!seasonFriendsAfterReset.items.some((item) => item.target.playerId === seasonFriend.player.id && item.status === 'active')) {
      throw new Error('Season reset removed an active friend relation.');
    }
    if (!seasonFollowingAfterReset.items.some((item) => item.target.playerId === seasonFollowing.player.id && item.status === 'active')) {
      throw new Error('Season reset removed an active following relation.');
    }
    if (
      seasonSummaryAfterReset.counts.friendLimit !== SOCIAL_FRIEND_LIMIT_CONFIG.baseLimit ||
      seasonSummaryAfterReset.counts.friendMaxLimit !== SOCIAL_FRIEND_LIMIT_CONFIG.hardLimit ||
      seasonSummaryAfterReset.counts.followingLimit !== SOCIAL_FOLLOW_LIMIT_CONFIG.baseLimit ||
      seasonSummaryAfterReset.counts.followingMaxLimit !== SOCIAL_FOLLOW_LIMIT_CONFIG.hardLimit
    ) {
      throw new Error(`Season reset changed social limits: ${JSON.stringify(seasonSummaryAfterReset.counts)}`);
    }

    const staleFriendRequestAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await prisma.playerSocialRelation.updateMany({
      where: {
        relationType: SocialRelationType.FRIEND,
        OR: [
          { playerId: playerA.player.id, targetPlayerId: playerB.player.id },
          { playerId: playerB.player.id, targetPlayerId: playerA.player.id },
        ],
      },
      data: {
        updatedAt: staleFriendRequestAt,
        lastInteractedAt: staleFriendRequestAt,
      },
    });

    const requestAgain = await socialService.requestFriend(playerA.player.id, {
      targetPlayerId: playerB.player.id,
    });
    if (requestAgain.relation.status !== 'pending' || requestAgain.reverseRelation?.status !== 'pending') {
      throw new Error(`Re-request did not restore muted relations to pending: ${JSON.stringify(requestAgain)}`);
    }

    console.log(JSON.stringify({
      ok: true,
      playerA: playerA.player.nickname,
      playerB: playerB.player.nickname,
      requestRelationId: request.relation.id,
      requestFeedId: requestFeed.id,
      followedRelationId: followed.relation.id,
      friendLimit: fullFriendSummary.counts.friendLimit,
      followingLimit: summaryAtLimit.counts.followingLimit,
      immediateReRequestRejected,
      seasonSocialPreserved: true,
      reRequestRelationId: requestAgain.relation.id,
    }, null, 2));
  } finally {
    await app.close();
  }
}

async function assertRelationStatus(
  prisma: PrismaService['db'],
  playerId: string,
  targetPlayerId: string,
  expected: SocialRelationStatus,
  relationType: SocialRelationType = SocialRelationType.FRIEND,
): Promise<void> {
  const relation = await prisma.playerSocialRelation.findUnique({
    where: {
      playerId_targetPlayerId_relationType: {
        playerId,
        targetPlayerId,
        relationType,
      },
    },
  });

  if (relation?.status !== expected) {
    throw new Error(`Expected ${playerId} -> ${targetPlayerId} to be ${expected}, got ${relation?.status ?? 'missing'}.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
