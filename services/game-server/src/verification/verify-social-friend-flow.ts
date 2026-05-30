import { NestFactory } from '@nestjs/core';
import { SocialFeedType, SocialRelationStatus, SocialRelationType } from '@prisma/client';
import { AuthService } from '../auth/auth.service.js';
import { AppModule } from '../modules/app/app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SocialService } from '../social/social.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const socialService = app.get(SocialService);
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
      factionCode: 'human',
    });

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
): Promise<void> {
  const relation = await prisma.playerSocialRelation.findUnique({
    where: {
      playerId_targetPlayerId_relationType: {
        playerId,
        targetPlayerId,
        relationType: SocialRelationType.FRIEND,
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
