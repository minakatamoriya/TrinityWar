export const seedLabelMap: Record<string, string> = {
  qilingya: '启灵芽',
  qinglingmai: '青灵麦',
  xunyamai: '风云稻',
  ninglucao: '凝露草',
  suixinhua: '碎心花',
  baiyulian: '白玉莲',
  yingyuezhu: '影月竹',
  qianjiteng: '牵机藤',
  huichuncao: '回春草',
  xueyuehua: '雪月花',
  jingdaosong: '劲道松',
  hundunguo: '混沌果',
  zhanqingsi: '斩情丝',
  wangchuanying: '忘川影',
  zhaoyouming: '照幽冥',
};

const mockSeedStageGold: Record<string, { growing: number; mature: number; withered: number }> = {
  qilingya: { growing: 20, mature: 50, withered: 50 },
  qinglingmai: { growing: 100, mature: 200, withered: 100 },
  xunyamai: { growing: 100, mature: 200, withered: 100 },
  ninglucao: { growing: 100, mature: 800, withered: 400 },
  suixinhua: { growing: 120, mature: 300, withered: 50 },
  baiyulian: { growing: 160, mature: 220, withered: 180 },
  yingyuezhu: { growing: 150, mature: 230, withered: 140 },
  qianjiteng: { growing: 170, mature: 360, withered: 120 },
  huichuncao: { growing: 320, mature: 480, withered: 380 },
  xueyuehua: { growing: 300, mature: 760, withered: 180 },
  jingdaosong: { growing: 450, mature: 620, withered: 520 },
  hundunguo: { growing: 420, mature: 880, withered: 260 },
  zhanqingsi: { growing: 520, mature: 1200, withered: 200 },
  wangchuanying: { growing: 760, mature: 1200, withered: 960 },
  zhaoyouming: { growing: 700, mature: 1600, withered: 680 },
};

const mockSeedGrowthSeconds: Record<string, number> = {
  qilingya: 10,
  qinglingmai: 10800,
  xunyamai: 1800,
  ninglucao: 36000,
  suixinhua: 10800,
  baiyulian: 16200,
  yingyuezhu: 12600,
  qianjiteng: 12600,
  huichuncao: 14400,
  xueyuehua: 12600,
  jingdaosong: 18000,
  hundunguo: 19800,
  zhanqingsi: 14400,
  wangchuanying: 21600,
  zhaoyouming: 18000,
};

export function getMockSeedGrowthSeconds(seedId: string): number {
  return mockSeedGrowthSeconds[seedId] ?? 10800;
}

export function getMockCultivationSeconds(seedId: string): number {
  return getMockSeedGrowthSeconds(seedId);
}

export function getMockSeedStageGold(seedId: string, stage: 'growing' | 'mature' | 'withered'): number {
  return mockSeedStageGold[seedId]?.[stage] ?? 520;
}
