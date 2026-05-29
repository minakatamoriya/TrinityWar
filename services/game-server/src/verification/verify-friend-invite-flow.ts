import { NestFactory } from '@nestjs/core';
import { SocialRelationStatus, SocialRelationType } from '@prisma/client';
import { AuthService } from '../auth/auth.service.js';
import { AppModule } from '../modules/app/app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ShareAssistService } from '../share-assist/share-assist.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const shareAssistService = app.get(ShareAssistService);
    const prisma = app.get(PrismaService).db;
    const suffix = Date.now();

    const inviter = await authService.devLogin({
      providerUserId: `verify-inviter-${suffix}`,
      nickname: `邀请者_${suffix}`,
      factionCode: 'human',
    });
    const campaign = await shareAssistService.createCampaign(inviter.player.id, {
      campaignType: 'friend_invite',
    });
    const invited = await authService.devLogin({
      providerUserId: `verify-invited-${suffix}`,
      nickname: `新用户_${suffix}`,
      factionCode: 'human',
    });

    const completion = await shareAssistService.completeInviteTutorial(invited.player.id, {
      campaignId: campaign.campaign.id,
    });
    const [inviterRelation, invitedRelation] = await Promise.all([
      prisma.playerSocialRelation.findUnique({
        where: {
          playerId_targetPlayerId_relationType: {
            playerId: inviter.player.id,
            targetPlayerId: invited.player.id,
            relationType: SocialRelationType.FRIEND,
          },
        },
      }),
      prisma.playerSocialRelation.findUnique({
        where: {
          playerId_targetPlayerId_relationType: {
            playerId: invited.player.id,
            targetPlayerId: inviter.player.id,
            relationType: SocialRelationType.FRIEND,
          },
        },
      }),
    ]);

    if (!completion.bound || !completion.rewarded) {
      throw new Error(`Invite tutorial completion failed: ${JSON.stringify(completion)}`);
    }
    if (inviterRelation?.status !== SocialRelationStatus.ACTIVE || invitedRelation?.status !== SocialRelationStatus.ACTIVE) {
      throw new Error('Friend invite did not create active two-way friend relations.');
    }

    console.log(JSON.stringify({
      ok: true,
      inviter: inviter.player.nickname,
      invited: invited.player.nickname,
      campaignId: campaign.campaign.id,
      relationIds: [inviterRelation.id, invitedRelation.id],
    }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
