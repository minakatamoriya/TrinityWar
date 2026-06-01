import { NestFactory } from '@nestjs/core';
import { AuthService } from '../auth/auth.service.js';
import { AppModule } from '../modules/app/app.module.js';
import { ShareAssistService } from '../share-assist/share-assist.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const shareAssistService = app.get(ShareAssistService);
    const suffix = Date.now();

    const owner = await authService.devLogin({
      providerUserId: `verify-share-owner-${suffix}`,
      nickname: `share-owner-${suffix}`,
      factionCode: 'human',
    });
    const helper = await authService.devLogin({
      providerUserId: `verify-share-helper-${suffix}`,
      nickname: `share-helper-${suffix}`,
      factionCode: 'human',
    });

    for (let index = 0; index < 5; index += 1) {
      await shareAssistService.createCampaign(owner.player.id, { campaignType: 'water' });
    }
    await expectRejected(
      () => shareAssistService.createCampaign(owner.player.id, { campaignType: 'water' }),
      'Daily water assist share limit reached.',
    );

    const inviteOwner = await authService.devLogin({
      providerUserId: `verify-share-invite-owner-${suffix}`,
      nickname: `share-invite-owner-${suffix}`,
      factionCode: 'human',
    });
    for (let index = 0; index < 3; index += 1) {
      await shareAssistService.createCampaign(inviteOwner.player.id, { campaignType: 'friend_invite' });
    }
    await expectRejected(
      () => shareAssistService.createCampaign(inviteOwner.player.id, { campaignType: 'friend_invite' }),
      'Daily friend invite share limit reached.',
    );

    const selfAssistOwner = await authService.devLogin({
      providerUserId: `verify-share-self-owner-${suffix}`,
      nickname: `share-self-owner-${suffix}`,
      factionCode: 'human',
    });
    const selfAssistCampaign = await shareAssistService.createCampaign(selfAssistOwner.player.id, { campaignType: 'water' });
    await expectRejected(
      () => shareAssistService.confirmAssist(selfAssistCampaign.campaign.id, {
        audience: 'returning-user',
        helperPlayerId: selfAssistOwner.player.id,
      }),
      'Cannot assist your own water share.',
    );

    for (let index = 0; index < 10; index += 1) {
      const target = await authService.devLogin({
        providerUserId: `verify-share-target-${suffix}-${index}`,
        nickname: `share-target-${suffix}-${index}`,
        factionCode: 'human',
      });
      const campaign = await shareAssistService.createCampaign(target.player.id, { campaignType: 'water' });
      await shareAssistService.confirmAssist(campaign.campaign.id, {
        audience: 'returning-user',
        helperPlayerId: helper.player.id,
      });
    }

    const overflowTarget = await authService.devLogin({
      providerUserId: `verify-share-target-${suffix}-overflow`,
      nickname: `share-target-${suffix}-overflow`,
      factionCode: 'human',
    });
    const overflowCampaign = await shareAssistService.createCampaign(overflowTarget.player.id, { campaignType: 'water' });
    await expectRejected(
      () => shareAssistService.confirmAssist(overflowCampaign.campaign.id, {
        audience: 'returning-user',
        helperPlayerId: helper.player.id,
      }),
      'Daily public assist limit reached.',
    );

    console.log(JSON.stringify({ ok: true, suffix }, null, 2));
  } finally {
    await app.close();
  }
}

async function expectRejected(action: () => Promise<unknown>, expectedMessage: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(expectedMessage)) {
      return;
    }
    throw new Error(`Expected "${expectedMessage}" but got "${message}".`);
  }

  throw new Error(`Expected action to reject with "${expectedMessage}".`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
