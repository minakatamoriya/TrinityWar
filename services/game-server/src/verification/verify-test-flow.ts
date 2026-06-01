import '../config/load-env.js';
import 'reflect-metadata';
import http from 'node:http';
import https from 'node:https';
import { PrismaClient } from '@prisma/client';
import { NestFactory } from '@nestjs/core';
import {
  ADMIN_API_PREFIX,
  APP_NAME,
  CLIENT_API_PREFIX,
  type ClientCollectFieldResponse,
  type ClientRaidActionResponse,
  type ClientSceneContentResponse,
  type ClientSpiritMutationResponse,
  type ClientStateMutationResponse,
  type HomeSummaryResponse,
} from '@trinitywar/shared';
import { AppModule } from '../modules/app/app.module.js';
import { RaidSettlementService } from '../raid/raid-settlement.service.js';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';
const SPIRIT_SOUL_GOLD_PRICE = 100;
const SPIRIT_LEVEL_10_UPGRADE_COST = 15;
const SMOKE_SEED_ID = 'ninglucao';

interface DevLoginResult {
  accessToken: string;
  player: {
    id: string;
    nickname: string;
    castleLevel: number;
  };
}

interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

const baseUrl = (process.env.VERIFY_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
const prisma = new PrismaClient();

async function main(): Promise<void> {
  await assertServerHealthy();

  const user1 = await devLogin('dev-verifier-1', 'smoke-user-1', 'human');
  const user2 = await devLogin('dev-verifier-2', 'smoke-user-2', 'demon');
  assertEqual(user1.player.castleLevel, 10, 'test user 1 castle level');
  assertEqual(user2.player.castleLevel, 10, 'test user 2 castle level');

  const baseline = await readVerificationState(user1.player.id, user2.player.id);
  assertEqual(baseline.user1.wallet?.vaultGold, 5000, 'test user 1 baseline vault gold');
  assertEqual(baseline.user1.spiritSlot?.level, 10, 'test user 1 baseline spirit level');
  assertEqual(baseline.user2.spiritSlot?.level, 10, 'test user 2 baseline spirit level');
  assertEqual(baseline.user1Target?.targetPlayerId, user2.player.id, 'test user 1 sees test user 2');
  assertEqual(baseline.user2Target?.targetPlayerId, user1.player.id, 'test user 2 sees test user 1');

  await assertBootstrapHomeAndScenes(user1, user2);
  await verifyAdminTaskConfigRead();
  await verifyFieldCultivationAndCollect(user1);
  await verifyBuildingUpgrade(user1);
  await verifySpiritPurchaseAndUpgrade(user1);
  await verifySpiritRecovery(user1);
  await verifySpiritBreakthrough(user1);
  await verifyFarmBoard(user1);
  await verifyDeepIntel(user1, baseline.user1Target?.id ?? '');
  await verifyRaidAndMessage(user1, user2);

  console.log('verify:test-flow passed');
}

async function assertServerHealthy(): Promise<void> {
  const health = await fetchJson<{ app: string; status: string }>('/api/health');
  assertEqual(health.app, APP_NAME, 'health app');
  assertEqual(health.status, 'ok', 'health status');
}

async function devLogin(providerUserId: string, nickname: string, factionCode: string): Promise<DevLoginResult> {
  return fetchJson<DevLoginResult>(`${CLIENT_API_PREFIX}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerUserId, nickname, factionCode }),
  });
}

async function assertBootstrapHomeAndScenes(user1: DevLoginResult, user2: DevLoginResult): Promise<void> {
  const [bootstrap1, home1, scene1, scene2] = await Promise.all([
    fetchJson<{ backpack: { globalItemInventory: { tianjiTalisman: number } } }>(`${CLIENT_API_PREFIX}/bootstrap`, {
      headers: authHeaders(user1),
    }),
    fetchJson<HomeSummaryResponse>(`${CLIENT_API_PREFIX}/home-summary`, {
      headers: authHeaders(user1),
    }),
    fetchJson<ClientSceneContentResponse>(`${CLIENT_API_PREFIX}/scene-content`, {
      headers: authHeaders(user1),
    }),
    fetchJson<ClientSceneContentResponse>(`${CLIENT_API_PREFIX}/scene-content`, {
      headers: authHeaders(user2),
    }),
  ]);

  assertAtLeast(bootstrap1.backpack.globalItemInventory.tianjiTalisman, 3, 'test user 1 baseline tianji talisman');
  assertEqual(home1.app, APP_NAME, 'home summary app');
  assert(scene1.raid.targets.some((target) => target.name === user2.player.nickname), 'test user 1 scene should list test user 2');
  assert(scene2.raid.targets.some((target) => target.name === user1.player.nickname), 'test user 2 scene should list test user 1');
}

async function verifyAdminTaskConfigRead(): Promise<void> {
  const tasks = await fetchJson<{ items: unknown[]; pagination: { total: number } }>(`${ADMIN_API_PREFIX}/config/tasks`, {
    headers: adminHeaders(),
  });
  assert(tasks.items.length > 0, 'admin task config should return items');
  assertAtLeast(tasks.pagination.total, tasks.items.length, 'admin task config total');
}

async function verifyFieldCultivationAndCollect(user: DevLoginResult): Promise<void> {
  const field = await prisma.playerFieldSlot.findFirst({
    where: {
      playerId: user.player.id,
      isUnlocked: true,
      status: 'GROWING',
      seedDefinition: { seedId: SMOKE_SEED_ID },
    },
    orderBy: { slotIndex: 'asc' },
    select: { id: true },
  });
  assert(field, `test user should have a growing ${SMOKE_SEED_ID} field`);

  await prisma.playerFieldSlot.update({
    where: { id: field.id },
    data: {
      status: 'EMPTY',
      seedDefinition: { disconnect: true },
      currentClaimableGold: 0,
      investedGold: 0,
      seedAt: null,
      matureAt: null,
      readyAt: null,
      overripeAt: null,
      lastCalculatedAt: new Date(),
      statusVersion: { increment: 1 },
    },
  });

  const startKey = `verify-start-cultivation-${Date.now()}`;
  await fetchJson<ClientStateMutationResponse>(`${CLIENT_API_PREFIX}/actions/start-cultivation`, {
    method: 'POST',
    headers: {
      ...authHeaders(user),
      'Content-Type': 'application/json',
      'X-Idempotency-Key': startKey,
    },
    body: JSON.stringify({
      fieldId: field.id,
      plantType: SMOKE_SEED_ID,
    }),
  });

  const planted = await prisma.playerFieldSlot.findUniqueOrThrow({
    where: { id: field.id },
    select: {
      status: true,
      statusVersion: true,
      seedDefinition: { select: { seedId: true, baseYieldGold: true } },
    },
  });
  assertEqual(planted.status, 'GROWING', 'field should be growing after start cultivation');
  assertEqual(planted.seedDefinition?.seedId, SMOKE_SEED_ID, 'field seed after start cultivation');

  const now = new Date();
  await prisma.playerFieldSlot.update({
    where: { id: field.id },
    data: {
      status: 'MATURE',
      currentClaimableGold: Math.max(planted.seedDefinition?.baseYieldGold ?? 120, 1),
      matureAt: new Date(now.getTime() - 60_000),
      readyAt: new Date(now.getTime() - 60_000),
      overripeAt: new Date(now.getTime() + 3_600_000),
      lastCalculatedAt: now,
      statusVersion: { increment: 1 },
    },
  });

  const wallet = await prisma.playerWallet.findUniqueOrThrow({
      where: { playerId: user.player.id },
      select: { balanceVersion: true },
  });
  const collectKey = `verify-collect-field-${Date.now()}`;
  const collectResponse = await fetchJson<ClientCollectFieldResponse>(`${CLIENT_API_PREFIX}/actions/collect-field`, {
    method: 'POST',
    headers: {
      ...authHeaders(user),
      'Content-Type': 'application/json',
      'X-Idempotency-Key': collectKey,
    },
    body: JSON.stringify({
      fieldId: field.id,
      collectMode: 'ripe',
      walletVersion: wallet.balanceVersion,
      requestIdempotencyKey: collectKey,
    }),
  });
  assertAtLeast(collectResponse.result.collectedGold, 1, 'collect field gold');

  const [afterCollect, harvestLog] = await Promise.all([
    prisma.playerFieldSlot.findUniqueOrThrow({
      where: { id: field.id },
      select: { status: true, seedDefinitionId: true },
    }),
    prisma.fieldHarvestLog.findFirst({
      where: { playerId: user.player.id, fieldSlotId: field.id, collectMode: 'ripe' },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  assertEqual(afterCollect.status, 'EMPTY', 'field should be empty after collect');
  assertEqual(afterCollect.seedDefinitionId, null, 'field seed should clear after collect');
  assert(harvestLog, 'field harvest log should exist');
}

async function verifyBuildingUpgrade(user: DevLoginResult): Promise<void> {
  const before = await prisma.player.findUniqueOrThrow({
    where: { id: user.player.id },
    select: {
      wallet: { select: { vaultGold: true, balanceVersion: true } },
      buildings: { select: { protectionTechLevel: true, buildingVersion: true } },
      spiritResource: { select: { tianjiTalisman: true, resourceVersion: true } },
    },
  });
  const beforeGold = mustNumber(before.wallet?.vaultGold, 'building upgrade before vault gold');
  const beforeWalletVersion = mustNumber(before.wallet?.balanceVersion, 'building upgrade before wallet version');
  const beforeProtectionTechLevel = mustNumber(before.buildings?.protectionTechLevel, 'building upgrade before protection tech level');
  const beforeBuildingVersion = mustNumber(before.buildings?.buildingVersion, 'building upgrade before building version');
  const beforeTianjiTalisman = mustNumber(before.spiritResource?.tianjiTalisman, 'building upgrade before tianji talisman');
  const beforeSpiritResourceVersion = mustNumber(before.spiritResource?.resourceVersion, 'building upgrade before spirit resource version');
  const idempotencyKey = `verify-building-${Date.now()}`;

  await fetchJson(`${CLIENT_API_PREFIX}/actions/upgrade-building`, {
    method: 'POST',
    headers: {
      ...authHeaders(user),
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      targetType: 'territory-tech',
      territoryUpgradeId: 'protectionTech',
      buildingVersion: beforeBuildingVersion,
      walletVersion: beforeWalletVersion,
      requestIdempotencyKey: idempotencyKey,
    }),
  });

  const after = await prisma.player.findUniqueOrThrow({
    where: { id: user.player.id },
    select: {
      wallet: { select: { vaultGold: true, balanceVersion: true } },
      buildings: { select: { protectionTechLevel: true, buildingVersion: true } },
      spiritResource: { select: { tianjiTalisman: true, resourceVersion: true } },
      buildingUpgradeLogs: {
        where: { requestIdempotencyKey: idempotencyKey },
        select: { costGold: true, oldLevel: true, newLevel: true },
      },
    },
  });
  const upgradeLog = after.buildingUpgradeLogs[0];
  assert(upgradeLog, 'building upgrade log should exist');
  assertEqual(upgradeLog.oldLevel, beforeProtectionTechLevel, 'building upgrade old level');
  assertEqual(upgradeLog.newLevel, beforeProtectionTechLevel + 1, 'building upgrade new level');
  assertEqual(after.buildings?.protectionTechLevel, beforeProtectionTechLevel + 1, 'protection tech level should increase');
  if (beforeProtectionTechLevel >= 5) {
    assertEqual(upgradeLog.costGold, 0, 'tianji spell upgrade should not log gold cost');
    assertEqual(after.wallet?.vaultGold, beforeGold, 'vault gold should not change for tianji spell upgrade');
    assertEqual(after.wallet?.balanceVersion, beforeWalletVersion, 'wallet version should not change for tianji spell upgrade');
    assertEqual(after.spiritResource?.tianjiTalisman, beforeTianjiTalisman - 2, 'tianji spell upgrade should spend talisman');
    assertEqual(after.spiritResource?.resourceVersion, beforeSpiritResourceVersion + 1, 'spirit resource version should increase after tianji spell upgrade');
  } else {
    assertEqual(after.wallet?.vaultGold, beforeGold - upgradeLog.costGold, 'vault gold should decrease by upgrade cost');
    assertEqual(after.wallet?.balanceVersion, beforeWalletVersion + 1, 'wallet version should increase after building upgrade');
    assertEqual(after.spiritResource?.tianjiTalisman, beforeTianjiTalisman, 'gold spell upgrade should not spend talisman');
  }
  assertEqual(after.buildings?.buildingVersion, beforeBuildingVersion + 1, 'building version should increase');
}

async function verifySpiritPurchaseAndUpgrade(user: DevLoginResult): Promise<void> {
  const beforePurchase = await readPlayerSpiritAndWallet(user.player.id);
  const buyGoldAmount = SPIRIT_SOUL_GOLD_PRICE * 2;
  const buyKey = `verify-spirit-buy-${Date.now()}`;

  await fetchJson(`${CLIENT_API_PREFIX}/spirit/buy-soul`, {
    method: 'POST',
    headers: {
      ...authHeaders(user),
      'Content-Type': 'application/json',
      'X-Idempotency-Key': buyKey,
    },
    body: JSON.stringify({
      goldAmount: buyGoldAmount,
      walletVersion: beforePurchase.wallet.balanceVersion,
      resourceVersion: beforePurchase.resource.resourceVersion,
      requestIdempotencyKey: buyKey,
    }),
  });

  const afterPurchase = await readPlayerSpiritAndWallet(user.player.id);
  assertEqual(afterPurchase.wallet.vaultGold, beforePurchase.wallet.vaultGold - buyGoldAmount, 'spirit buy should deduct gold');
  assertEqual(afterPurchase.resource.spiritSoul, beforePurchase.resource.spiritSoul + 2, 'spirit buy should add soul');

  const upgradeKey = `verify-spirit-upgrade-${Date.now()}`;
  await fetchJson(`${CLIENT_API_PREFIX}/spirit/upgrade`, {
    method: 'POST',
    headers: {
      ...authHeaders(user),
      'Content-Type': 'application/json',
      'X-Idempotency-Key': upgradeKey,
    },
    body: JSON.stringify({
      slotIndex: 1,
      slotVersion: afterPurchase.slot.slotVersion,
      resourceVersion: afterPurchase.resource.resourceVersion,
      requestIdempotencyKey: upgradeKey,
    }),
  });

  const afterUpgrade = await readPlayerSpiritAndWallet(user.player.id);
  assertEqual(afterUpgrade.slot.level, beforePurchase.slot.level + 1, 'main spirit level should increase');
  assertEqual(afterUpgrade.resource.spiritSoul, afterPurchase.resource.spiritSoul - SPIRIT_LEVEL_10_UPGRADE_COST, 'spirit upgrade should spend level 10 cost');
}

async function verifySpiritRecovery(user: DevLoginResult): Promise<void> {
  const before = await prisma.playerSpiritSlot.findUniqueOrThrow({
    where: { playerId_slotIndex: { playerId: user.player.id, slotIndex: 1 } },
    select: { maxHp: true },
  });
  await prisma.playerSpiritSlot.update({
    where: { playerId_slotIndex: { playerId: user.player.id, slotIndex: 1 } },
    data: {
      currentHp: Math.max(before.maxHp - 1, 1),
      status: 'WOUNDED',
      slotVersion: { increment: 1 },
    },
  });
  const [slot, resource] = await Promise.all([
    prisma.playerSpiritSlot.findUniqueOrThrow({
      where: { playerId_slotIndex: { playerId: user.player.id, slotIndex: 1 } },
      select: { slotVersion: true, maxHp: true },
    }),
    prisma.playerSpiritResource.findUniqueOrThrow({
      where: { playerId: user.player.id },
      select: { resourceVersion: true },
    }),
  ]);
  const recoverKey = `verify-spirit-recover-${Date.now()}`;
  const response = await fetchJson<ClientSpiritMutationResponse>(`${CLIENT_API_PREFIX}/spirit/recover`, {
    method: 'POST',
    headers: {
      ...authHeaders(user),
      'Content-Type': 'application/json',
      'X-Idempotency-Key': recoverKey,
    },
    body: JSON.stringify({
      slotIndex: 1,
      slotVersion: slot.slotVersion,
      resourceVersion: resource.resourceVersion,
      requestIdempotencyKey: recoverKey,
    }),
  });
  assertEqual(response.spirit.mainSlot?.currentHp, slot.maxHp, 'main spirit hp after recover');
  assertEqual(response.spirit.mainSlot?.status, 'active', 'main spirit status after recover');
}

async function verifySpiritBreakthrough(user: DevLoginResult): Promise<void> {
  await prisma.playerSpiritSlot.update({
    where: { playerId_slotIndex: { playerId: user.player.id, slotIndex: 1 } },
    data: {
      level: 9,
      exp: 0,
      breakthroughStage: 0,
      lastExpSettledAt: new Date(),
      slotVersion: { increment: 1 },
    },
  });
  const [slot, resource] = await Promise.all([
    prisma.playerSpiritSlot.findUniqueOrThrow({
      where: { playerId_slotIndex: { playerId: user.player.id, slotIndex: 1 } },
      select: { slotVersion: true },
    }),
    prisma.playerSpiritResource.findUniqueOrThrow({
      where: { playerId: user.player.id },
      select: { resourceVersion: true, ordinarySoul: true },
    }),
  ]);
  assertAtLeast(resource.ordinarySoul, 5, 'ordinary soul before breakthrough');

  const breakthroughKey = `verify-spirit-breakthrough-${Date.now()}`;
  const response = await fetchJson<ClientSpiritMutationResponse>(`${CLIENT_API_PREFIX}/spirit/breakthrough`, {
    method: 'POST',
    headers: {
      ...authHeaders(user),
      'Content-Type': 'application/json',
      'X-Idempotency-Key': breakthroughKey,
    },
    body: JSON.stringify({
      slotIndex: 1,
      targetStage: 1,
      slotVersion: slot.slotVersion,
      resourceVersion: resource.resourceVersion,
      requestIdempotencyKey: breakthroughKey,
    }),
  });
  assertEqual(response.spirit.mainSlot?.level, 10, 'main spirit level after breakthrough');
  assertEqual(response.spirit.mainSlot?.breakthroughStage, 1, 'main spirit breakthrough stage');
  const breakthroughLog = await prisma.spiritBreakthroughLog.findFirst({
    where: { playerId: user.player.id, requestIdempotencyKey: breakthroughKey },
  });
  assert(breakthroughLog, 'spirit breakthrough log should exist');
}

async function verifyFarmBoard(user: DevLoginResult): Promise<void> {
  const before = await fetchJson<{ farmBoardVersion: number }>(`${CLIENT_API_PREFIX}/profile/farm-board`, {
    headers: authHeaders(user),
  });
  const message = `verify-board-${Date.now().toString().slice(-6)}`;

  await fetchJson(`${CLIENT_API_PREFIX}/profile/farm-board`, {
    method: 'POST',
    headers: {
      ...authHeaders(user),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      farmBoardVersion: before.farmBoardVersion,
    }),
  });

  const board = await prisma.playerFarmBoard.findUniqueOrThrow({
    where: { playerId: user.player.id },
    select: { message: true },
  });
  assertEqual(board.message, message, 'farm board message should persist');
}

async function verifyDeepIntel(user: DevLoginResult, targetId: string): Promise<void> {
  assert(targetId, 'target id is required for deep intel');
  const before = await prisma.playerSpiritResource.findUniqueOrThrow({
    where: { playerId: user.player.id },
    select: { dailyIntelFreeUsed: true, dailyIntelTalismanUsed: true, tianjiTalisman: true },
  });

  await fetchJson(`${CLIENT_API_PREFIX}/raid-targets/${targetId}/deep-intel`, {
    method: 'POST',
    headers: {
      ...authHeaders(user),
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  const after = await prisma.playerSpiritResource.findUniqueOrThrow({
    where: { playerId: user.player.id },
    select: { dailyIntelFreeUsed: true, dailyIntelTalismanUsed: true, tianjiTalisman: true },
  });
  assertEqual(after.dailyIntelFreeUsed, before.dailyIntelFreeUsed + 1, 'deep intel should use one free count first');
  assertEqual(after.dailyIntelTalismanUsed, before.dailyIntelTalismanUsed, 'first deep intel should not spend talisman count');
  assertEqual(after.tianjiTalisman, before.tianjiTalisman, 'first deep intel should not spend talisman item');
}

async function verifyRaidAndMessage(user1: DevLoginResult, user2: DevLoginResult): Promise<void> {
  const scene = await fetchJson<ClientSceneContentResponse>(`${CLIENT_API_PREFIX}/scene-content`, {
    headers: authHeaders(user1),
  });
  const target = scene.raid.targets.find((entry) => entry.name === user2.player.nickname);
  assert(target, 'test user 1 should have a visible target for test user 2');
  const army = await prisma.playerArmy.findUniqueOrThrow({
    where: { playerId: user1.player.id },
    select: { armyVersion: true },
  });
  const raidKey = `verify-raid-${Date.now()}`;
  const raidResponse = await fetchJson<ClientRaidActionResponse>(`${CLIENT_API_PREFIX}/actions/raid-target`, {
    method: 'POST',
    headers: {
      ...authHeaders(user1),
      'Content-Type': 'application/json',
      'X-Idempotency-Key': raidKey,
    },
    body: JSON.stringify({
      targetId: target.id,
      armyVersion: army.armyVersion,
      requestIdempotencyKey: raidKey,
    }),
  });
  const orderId = raidResponse.result.orderId;
  assert(orderId, 'raid order id should be returned');
  assert(raidResponse.result.battleReplay, 'raid response should include battle replay');
  assertEqual(raidResponse.result.battleReplay.orderId, orderId, 'battle replay order id');
  assert(raidResponse.result.battleReplay.steps.length >= 5, 'battle replay should include playback steps');
  assertAtLeast(raidResponse.result.battleReplay.attacker.maxHp, 1, 'battle replay attacker max hp');
  assertAtLeast(raidResponse.result.battleReplay.defender.maxHp, 1, 'battle replay defender max hp');

  const orderBeforeSettlement = await prisma.raidOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      status: true,
      attackerPlayerId: true,
      defenderPlayerId: true,
      assetLocks: { select: { lockedGold: true, status: true } },
    },
  });
  assert(['LOCKED', 'SETTLING', 'SETTLED'].includes(orderBeforeSettlement.status), `raid order should be locked or settled, got ${orderBeforeSettlement.status}`);
  assertEqual(orderBeforeSettlement.attackerPlayerId, user1.player.id, 'raid attacker should be test user 1');
  assertEqual(orderBeforeSettlement.defenderPlayerId, user2.player.id, 'raid defender should be test user 2');
  assertAtLeast(orderBeforeSettlement.assetLocks[0]?.lockedGold ?? 0, 1, 'raid asset lock should lock gold');

  if (orderBeforeSettlement.status !== 'SETTLED') {
    const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
    try {
      await app.get(RaidSettlementService).settleRaidOrder(orderId);
    } finally {
      await app.close();
    }
  }

  const settlement = await prisma.raidSettlement.findUniqueOrThrow({
    where: { raidOrderId: orderId },
    select: { lootGold: true, battleReplayJson: true },
  });
  const savedReplay = settlement.battleReplayJson as { orderId?: string; steps?: unknown[] } | null;
  assert(savedReplay, 'raid settlement should persist battle replay json');
  assertEqual(savedReplay.orderId, orderId, 'persisted battle replay order id');
  assert(Array.isArray(savedReplay.steps) && savedReplay.steps.length >= 5, 'persisted battle replay should include playback steps');
  const replayResponse = await fetchJson<{ replay: { orderId: string; steps: unknown[] } }>(`${CLIENT_API_PREFIX}/raid-orders/${orderId}/battle-replay`, {
    headers: authHeaders(user1),
  });
  assertEqual(replayResponse.replay.orderId, orderId, 'readonly battle replay order id');
  assert(replayResponse.replay.steps.length >= 5, 'readonly battle replay should include playback steps');
  const orderAfterSettlement = await prisma.raidOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: { status: true },
  });
  const reports = await prisma.battleReport.findMany({
    where: { raidOrderId: orderId },
    select: { title: true, ownerPlayerId: true },
  });
  assertEqual(orderAfterSettlement.status, 'SETTLED', 'raid order should settle');
  assertAtLeast(settlement.lootGold, 0, 'raid settlement loot should be non-negative');
  assertEqual(reports.length, 2, 'raid settlement should write two battle reports');

  const messageTemplateId = scene.raid.messageTemplates[0]?.templateId;
  assert(messageTemplateId, 'raid message template should exist');
  await fetchJson(`${CLIENT_API_PREFIX}/raid-orders/${orderId}/message`, {
    method: 'POST',
    headers: {
      ...authHeaders(user1),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messageTemplateId }),
  });

  const message = await prisma.raidOrderMessage.findUniqueOrThrow({
    where: { raidOrderId: orderId },
    select: { templateId: true, authorPlayerId: true, receiverPlayerId: true },
  });
  assertEqual(message.templateId, messageTemplateId, 'raid message template should persist');
  assertEqual(message.authorPlayerId, user1.player.id, 'raid message author should be attacker');
  assertEqual(message.receiverPlayerId, user2.player.id, 'raid message receiver should be defender');
}

async function readVerificationState(user1Id: string, user2Id: string) {
  const [user1, user2, user1Target, user2Target] = await Promise.all([
    readPlayerCoreState(user1Id),
    readPlayerCoreState(user2Id),
    prisma.raidTargetPool.findFirst({
      where: { ownerPlayerId: user1Id, targetPlayerId: user2Id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, targetPlayerId: true },
    }),
    prisma.raidTargetPool.findFirst({
      where: { ownerPlayerId: user2Id, targetPlayerId: user1Id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, targetPlayerId: true },
    }),
  ]);

  return { user1, user2, user1Target, user2Target };
}

async function readPlayerCoreState(playerId: string) {
  return prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    select: {
      wallet: { select: { vaultGold: true } },
      spiritSlots: {
        where: { slotIndex: 1 },
        take: 1,
        select: { level: true },
      },
    },
  }).then((player) => ({
    wallet: player.wallet,
    spiritSlot: player.spiritSlots[0] ?? null,
  }));
}

async function readPlayerSpiritAndWallet(playerId: string) {
  const player = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    select: {
      wallet: {
        select: {
          vaultGold: true,
          balanceVersion: true,
        },
      },
      spiritResource: {
        select: {
          spiritSoul: true,
          resourceVersion: true,
        },
      },
      spiritSlots: {
        where: { slotIndex: 1 },
        take: 1,
        select: {
          level: true,
          slotVersion: true,
        },
      },
    },
  });
  const wallet = player.wallet;
  const resource = player.spiritResource;
  const slot = player.spiritSlots[0];
  assert(wallet, 'player wallet should exist');
  assert(resource, 'player spirit resource should exist');
  assert(slot, 'player main spirit slot should exist');

  return { wallet, resource, slot };
}

async function fetchJson<T>(path: string, init: HttpRequestOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  const response = await requestJson(url, init);
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`HTTP ${response.statusCode} for ${url}${response.body ? `: ${response.body}` : ''}`);
  }

  return JSON.parse(response.body) as T;
}

async function requestJson(url: string, init: HttpRequestOptions): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const request = transport.request({
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: init.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...init.headers,
      },
    }, (response) => {
      const chunks: Buffer[] = [];

      response.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });

    request.on('error', reject);

    if (init.body) {
      request.write(init.body);
    }

    request.end();
  });
}

function authHeaders(session: DevLoginResult): Record<string, string> {
  return {
    Authorization: `Bearer ${session.accessToken}`,
  };
}

function adminHeaders(): Record<string, string> {
  const debugKey = process.env.ADMIN_DEBUG_KEY?.trim();
  return debugKey ? { 'x-admin-debug-key': debugKey } : {};
}

function mustNumber(value: number | undefined | null, label: string): number {
  assert(typeof value === 'number', `${label} should be a number`);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertAtLeast(actual: number, minimum: number, label: string): void {
  if (actual < minimum) {
    throw new Error(`${label}: expected >= ${minimum}, got ${actual}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error('verify:test-flow failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
