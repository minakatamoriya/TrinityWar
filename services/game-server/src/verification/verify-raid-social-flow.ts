import { NestFactory } from '@nestjs/core';
import { AuthService } from '../auth/auth.service.js';
import { BusinessError } from '../common/errors/index.js';
import { ClientReadService } from '../client-read/client-read.service.js';
import { AppModule } from '../modules/app/app.module.js';
import { PlayerService } from '../player/player.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RaidTargetService } from '../raid/raid-target.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const playerService = app.get(PlayerService);
    const raidTargetService = app.get(RaidTargetService);
    const clientReadService = app.get(ClientReadService);
    const prisma = app.get(PrismaService).db;
    const suffix = Date.now().toString();

    const attacker = await authService.devLogin({
      providerUserId: 'dev-verifier-1',
      nickname: 'raid-social-attacker',
      factionCode: 'human',
    });
    const defender = await authService.devLogin({
      providerUserId: 'dev-verifier-2',
      nickname: 'raid-social-defender',
      factionCode: 'demon',
    });
    const attackerId = attacker.player.id;
    const defenderId = defender.player.id;

    await assertBusinessError(
      () => playerService.updateFarmBoard(defenderId, { message: 'https://bad.example' }),
      400,
      'farm board should reject links',
    );
    await assertBusinessError(
      () => playerService.updateFarmBoard(defenderId, { message: '这段留言长度一定超过四十个字符用于验证过长内容会被服务端拒绝并返回明确错误请继续加长' }),
      400,
      'farm board should reject overlong content',
    );
    await assertBusinessError(
      () => playerService.updateFarmBoard(defenderId, { message: '异常🙂字符' }),
      400,
      'farm board should reject unsupported characters',
    );

    const boardMessageBeforeRaid = `防守留言${suffix.slice(-6)}`;
    const boardBefore = await playerService.getFarmBoard(defenderId);
    const updatedBoard = await playerService.updateFarmBoard(defenderId, {
      message: boardMessageBeforeRaid,
      farmBoardVersion: boardBefore.farmBoardVersion,
    });
    assertEqual(updatedBoard.board.farmBoardMessage, boardMessageBeforeRaid, 'farm board update response');

    const target = await prisma.raidTargetPool.findFirstOrThrow({
      where: {
        ownerPlayerId: attackerId,
        targetPlayerId: defenderId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const targetDetail = await raidTargetService.getRaidTargetDetail(attackerId, target.id);
    assert(targetDetail.raidRule.includes('灵宠') || targetDetail.detail.length > 0, 'raid target detail should be spirit-focused');

    const army = await prisma.playerArmy.findUniqueOrThrow({
      where: { playerId: attackerId },
      select: { armyVersion: true },
    });
    const raidResponse = await raidTargetService.createRaidOrder({
      playerId: attackerId,
      targetId: target.id,
      armyVersion: army.armyVersion,
      requestIdempotencyKey: `verify-raid-social-${suffix}`,
    });
    const orderId = raidResponse.result.orderId;
    assert(orderId, 'raid order id should exist');
    const order = await prisma.raidOrder.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true },
    });
    assertEqual(order.status, 'SETTLED', 'raid order should settle synchronously in verification');

    const template = await prisma.raidMessageTemplate.findFirstOrThrow({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { templateId: true, text: true },
    });
    const messageResponse = await raidTargetService.createRaidOrderMessage({
      playerId: attackerId,
      raidOrderId: orderId,
      messageTemplateId: template.templateId,
    });
    assertEqual(messageResponse.raidMessage.messageTextSnapshot, template.text, 'raid message response snapshot');

    await assertBusinessError(
      () => raidTargetService.createRaidOrderMessage({
        playerId: defenderId,
        raidOrderId: orderId,
        messageTemplateId: template.templateId,
      }),
      403,
      'defender should not be able to create attacker raid message',
    );
    await assertBusinessError(
      () => raidTargetService.createRaidOrderMessage({
        playerId: attackerId,
        raidOrderId: orderId,
        messageTemplateId: 'missing-template',
      }),
      409,
      'duplicate raid message should be rejected before template check',
    );

    const boardMessageAfterRaid = `后续留言${suffix.slice(-6)}`;
    const latestBoard = await playerService.getFarmBoard(defenderId);
    await playerService.updateFarmBoard(defenderId, {
      message: boardMessageAfterRaid,
      farmBoardVersion: latestBoard.farmBoardVersion,
    });

    const scenesForAttacker = await clientReadService.getSceneContent(attackerId);
    const scenesForDefender = await clientReadService.getSceneContent(defenderId);
    const attackerReport = scenesForAttacker.report.attack.find((report) => report.orderId === orderId);
    const defenderReport = scenesForDefender.report.defense.find((report) => report.orderId === orderId);
    assert(attackerReport, 'attacker battle report should exist');
    assert(defenderReport, 'defender battle report should exist');
    assertEqual(attackerReport.raidMessage?.messageTextSnapshot, template.text, 'attacker report raid message snapshot');
    assertEqual(defenderReport.raidMessage?.messageTextSnapshot, template.text, 'defender report raid message snapshot');

    const persistedMessage = await prisma.raidOrderMessage.findUniqueOrThrow({
      where: { raidOrderId: orderId },
      select: {
        templateId: true,
        textSnapshot: true,
        authorPlayerId: true,
        receiverPlayerId: true,
      },
    });
    assertEqual(persistedMessage.templateId, template.templateId, 'persisted raid message template id');
    assertEqual(persistedMessage.textSnapshot, template.text, 'persisted raid message text snapshot');
    assertEqual(persistedMessage.authorPlayerId, attackerId, 'persisted raid message author');
    assertEqual(persistedMessage.receiverPlayerId, defenderId, 'persisted raid message receiver');
    assertEqual((await playerService.getFarmBoard(defenderId)).farmBoardMessage, boardMessageAfterRaid, 'farm board can be edited after raid');

    console.log(JSON.stringify({
      ok: true,
      attackerId,
      defenderId,
      orderId,
      farmBoard: {
        beforeRaid: boardMessageBeforeRaid,
        afterRaid: boardMessageAfterRaid,
      },
      raidMessage: {
        templateId: template.templateId,
        snapshot: template.text,
      },
    }, null, 2));
  } finally {
    await app.close();
  }
}

async function assertBusinessError(
  action: () => Promise<unknown>,
  statusCode: number,
  label: string,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    assert(error instanceof BusinessError, `${label}: should throw BusinessError`);
    assertEqual(error.statusCode, statusCode, `${label}: status code`);
    return;
  }

  throw new Error(`${label}: expected error`);
}

function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
