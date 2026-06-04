import type { FieldStatus } from '@prisma/client';

export interface DevAccountSeedData {
  providerUserId: string;
  nickname: string;
  factionCode: 'human' | 'immortal' | 'demon';
  castleLevel: number;
  wallet: {
    vaultGold: number;
    walletGold: number;
    pendingTaxGold: number;
    pendingDividendGold: number;
  };
  building: {
    vaultLevel: number;
    populationLevel: number;
    watchtowerLevel: number;
    protectionTechLevel: number;
    farmYieldTechLevel: number;
    collectWindowTechLevel: number;
    pendingClaimTechLevel: number;
  };
  army: {
    totalCount: number;
    availableCount: number;
    frozenCount: number;
    woundedCount: number;
    capacity: number;
  };
  seedInventory: Record<string, { quantity: number; unlocked: boolean }>;
  fields: Array<{
    slotIndex: number;
    isUnlocked: boolean;
    unlockCastleLevel: number;
    status: FieldStatus;
    seedId?: string;
    investedGold?: number;
    currentClaimableGold?: number;
    stageOffsetSeconds?: number;
  }>;
  taskOverrides?: Array<{
    taskId: string;
    progress: number;
    status?: 'IN_PROGRESS' | 'COMPLETED' | 'CLAIMED';
  }>;
  spirit?: {
    createStarterSpirit?: boolean;
    readyStarterSpirits?: boolean;
    spiritSoul?: number;
    ordinarySoul?: number;
    rareSoul?: number;
    legendarySoul?: number;
    tianjiTalisman?: number;
    starterSpiritId?: string;
    starterElement?: 'METAL' | 'WOOD' | 'WATER' | 'FIRE' | 'EARTH';
    starterLevel?: number;
  };
}

export const DEV_ACCOUNT_SEEDS: DevAccountSeedData[] = [
  {
    providerUserId: 'dev-newbie',
    nickname: '新手测试号',
    factionCode: 'human',
    castleLevel: 1,
    wallet: { vaultGold: 0, walletGold: 0, pendingTaxGold: 0, pendingDividendGold: 0 },
    building: {
      vaultLevel: 1,
      populationLevel: 1,
      watchtowerLevel: 1,
      protectionTechLevel: 0,
      farmYieldTechLevel: 0,
      collectWindowTechLevel: 0,
      pendingClaimTechLevel: 0,
    },
    army: { totalCount: 10, availableCount: 10, frozenCount: 0, woundedCount: 0, capacity: 10 },
    seedInventory: {
      qilingya: { quantity: 1, unlocked: true },
    },
    fields: [
      { slotIndex: 1, isUnlocked: true, unlockCastleLevel: 1, status: 'EMPTY' },
      { slotIndex: 2, isUnlocked: true, unlockCastleLevel: 1, status: 'EMPTY' },
      { slotIndex: 3, isUnlocked: true, unlockCastleLevel: 1, status: 'EMPTY' },
      { slotIndex: 4, isUnlocked: true, unlockCastleLevel: 1, status: 'EMPTY' },
    ],
    spirit: {
      createStarterSpirit: false,
      readyStarterSpirits: true,
    },
  },
  {
    providerUserId: 'dev-main-loop',
    nickname: '主循环测试号',
    factionCode: 'immortal',
    castleLevel: 10,
    wallet: { vaultGold: 1800, walletGold: 160, pendingTaxGold: 80, pendingDividendGold: 32 },
    building: {
      vaultLevel: 4,
      populationLevel: 3,
      watchtowerLevel: 3,
      protectionTechLevel: 1,
      farmYieldTechLevel: 1,
      collectWindowTechLevel: 1,
      pendingClaimTechLevel: 1,
    },
    army: { totalCount: 30, availableCount: 26, frozenCount: 0, woundedCount: 4, capacity: 30 },
    seedInventory: {
      qinglingmai: { quantity: 8, unlocked: true },
      xunyamai: { quantity: 8, unlocked: true },
      ninglucao: { quantity: 4, unlocked: true },
      suixinhua: { quantity: 2, unlocked: true },
      huichuncao: { quantity: 1, unlocked: true },
    },
    fields: [
      {
        slotIndex: 1,
        isUnlocked: true,
        unlockCastleLevel: 1,
        status: 'MATURE',
        seedId: 'qinglingmai',
        investedGold: 0,
        currentClaimableGold: 200,
        stageOffsetSeconds: 3 * 60 * 60,
      },
      {
        slotIndex: 2,
        isUnlocked: true,
        unlockCastleLevel: 1,
        status: 'GROWING',
        seedId: 'ninglucao',
        investedGold: 0,
        currentClaimableGold: 100,
        stageOffsetSeconds: 95 * 60,
      },
      { slotIndex: 3, isUnlocked: true, unlockCastleLevel: 1, status: 'EMPTY' },
      { slotIndex: 4, isUnlocked: true, unlockCastleLevel: 1, status: 'EMPTY' },
    ],
    taskOverrides: [
      { taskId: 'daily-start-cultivation', progress: 1, status: 'COMPLETED' },
    ],
    spirit: {
      ordinarySoul: 999,
      rareSoul: 999,
      legendarySoul: 999,
      tianjiTalisman: 3,
      starterSpiritId: 'canglang',
      starterElement: 'WOOD',
      starterLevel: 10,
    },
  },
  {
    providerUserId: 'dev-stable-flow-2',
    nickname: '稳定测试号2',
    factionCode: 'human',
    castleLevel: 10,
    wallet: { vaultGold: 1600, walletGold: 180, pendingTaxGold: 60, pendingDividendGold: 24 },
    building: {
      vaultLevel: 4,
      populationLevel: 3,
      watchtowerLevel: 3,
      protectionTechLevel: 1,
      farmYieldTechLevel: 1,
      collectWindowTechLevel: 1,
      pendingClaimTechLevel: 1,
    },
    army: { totalCount: 30, availableCount: 30, frozenCount: 0, woundedCount: 0, capacity: 30 },
    seedInventory: {
      qinglingmai: { quantity: 8, unlocked: true },
      xunyamai: { quantity: 8, unlocked: true },
      ninglucao: { quantity: 4, unlocked: true },
      suixinhua: { quantity: 2, unlocked: true },
      huichuncao: { quantity: 1, unlocked: true },
    },
    fields: [
      {
        slotIndex: 1,
        isUnlocked: true,
        unlockCastleLevel: 1,
        status: 'EMPTY',
      },
      {
        slotIndex: 2,
        isUnlocked: true,
        unlockCastleLevel: 1,
        status: 'EMPTY',
      },
      { slotIndex: 3, isUnlocked: true, unlockCastleLevel: 1, status: 'EMPTY' },
      { slotIndex: 4, isUnlocked: true, unlockCastleLevel: 1, status: 'EMPTY' },
    ],
    taskOverrides: [
      { taskId: 'daily-start-cultivation', progress: 0, status: 'IN_PROGRESS' },
    ],
    spirit: {
      ordinarySoul: 999,
      rareSoul: 999,
      legendarySoul: 999,
      tianjiTalisman: 3,
      starterSpiritId: 'linglu',
      starterElement: 'WATER',
      starterLevel: 10,
    },
  },
  {
    providerUserId: 'dev-raid-target-a',
    nickname: '掠夺目标甲',
    factionCode: 'demon',
    castleLevel: 15,
    wallet: { vaultGold: 3200, walletGold: 480, pendingTaxGold: 180, pendingDividendGold: 64 },
    building: {
      vaultLevel: 6,
      populationLevel: 5,
      watchtowerLevel: 4,
      protectionTechLevel: 2,
      farmYieldTechLevel: 2,
      collectWindowTechLevel: 2,
      pendingClaimTechLevel: 2,
    },
    army: { totalCount: 55, availableCount: 48, frozenCount: 0, woundedCount: 7, capacity: 70 },
    seedInventory: {
      qinglingmai: { quantity: 12, unlocked: true },
      xunyamai: { quantity: 12, unlocked: true },
      xueyuehua: { quantity: 3, unlocked: true },
      jingdaosong: { quantity: 2, unlocked: true },
      zhanqingsi: { quantity: 1, unlocked: true },
    },
    fields: [
      {
        slotIndex: 1,
        isUnlocked: true,
        unlockCastleLevel: 1,
        status: 'MATURE',
        seedId: 'zhanqingsi',
        currentClaimableGold: 1200,
        stageOffsetSeconds: 4 * 60 * 60,
      },
      {
        slotIndex: 2,
        isUnlocked: true,
        unlockCastleLevel: 1,
        status: 'MATURE',
        seedId: 'jingdaosong',
        currentClaimableGold: 620,
        stageOffsetSeconds: 5 * 60 * 60,
      },
      {
        slotIndex: 3,
        isUnlocked: true,
        unlockCastleLevel: 1,
        status: 'GROWING',
        seedId: 'xueyuehua',
        currentClaimableGold: 300,
        stageOffsetSeconds: 2 * 60 * 60,
      },
      { slotIndex: 4, isUnlocked: true, unlockCastleLevel: 1, status: 'EMPTY' },
    ],
  },
  {
    providerUserId: 'dev-admin-debug',
    nickname: '后台排障测试号',
    factionCode: 'human',
    castleLevel: 12,
    wallet: { vaultGold: 900, walletGold: 260, pendingTaxGold: 220, pendingDividendGold: 120 },
    building: {
      vaultLevel: 5,
      populationLevel: 4,
      watchtowerLevel: 2,
      protectionTechLevel: 1,
      farmYieldTechLevel: 2,
      collectWindowTechLevel: 1,
      pendingClaimTechLevel: 1,
    },
    army: { totalCount: 42, availableCount: 18, frozenCount: 10, woundedCount: 14, capacity: 50 },
    seedInventory: {
      qinglingmai: { quantity: 6, unlocked: true },
      xunyamai: { quantity: 6, unlocked: true },
      baiyulian: { quantity: 4, unlocked: true },
      hundunguo: { quantity: 1, unlocked: true },
    },
    fields: [
      {
        slotIndex: 1,
        isUnlocked: true,
        unlockCastleLevel: 1,
        status: 'WITHERED',
        seedId: 'baiyulian',
        currentClaimableGold: 180,
        stageOffsetSeconds: 6 * 60 * 60,
      },
      {
        slotIndex: 2,
        isUnlocked: true,
        unlockCastleLevel: 1,
        status: 'GROWING',
        seedId: 'qinglingmai',
        currentClaimableGold: 40,
        stageOffsetSeconds: 20 * 60,
      },
      { slotIndex: 3, isUnlocked: true, unlockCastleLevel: 1, status: 'EMPTY' },
      { slotIndex: 4, isUnlocked: true, unlockCastleLevel: 1, status: 'EMPTY' },
    ],
  },
];
