import { NestFactory } from '@nestjs/core';
import { AuthService } from '../auth/auth.service.js';
import { AppModule } from '../modules/app/app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SpiritService } from '../spirit/spirit.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const spiritService = app.get(SpiritService);
    const prisma = app.get(PrismaService).db;
    const suffix = Date.now();
    const login = await authService.devLogin({
      providerUserId: `verify-spirit-ad-${suffix}`,
      nickname: `spirit-ad-${suffix}`,
      factionCode: 'human',
    });

    const before = await prisma.playerSpiritResource.findUniqueOrThrow({
      where: { playerId: login.player.id },
      select: { tianjiTalisman: true, resourceVersion: true },
    });

    let resourceVersion = before.resourceVersion;
    for (let index = 0; index < 3; index += 1) {
      const result = await spiritService.claimAdReward(login.player.id, {
        resourceVersion,
        requestIdempotencyKey: `verify-spirit-ad-${suffix}-${index}`,
      });
      resourceVersion = result.spirit.resourceVersion;
      const expectedTalisman = before.tianjiTalisman + (index + 1) * 5;
      if (result.spirit.tianjiTalisman !== expectedTalisman) {
        throw new Error(`Expected ${expectedTalisman} talismans after claim ${index + 1}, got ${result.spirit.tianjiTalisman}.`);
      }
      if (result.spirit.shop?.adReward.usedToday !== index + 1) {
        throw new Error(`Expected ad usedToday=${index + 1}, got ${result.spirit.shop?.adReward.usedToday}.`);
      }
    }

    await expectRejected(
      () => spiritService.claimAdReward(login.player.id, {
        resourceVersion,
        requestIdempotencyKey: `verify-spirit-ad-${suffix}-overflow`,
      }),
      'Daily ad reward limit reached.',
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
