export type SeedRarity = 'common' | 'rare' | 'legendary';

export interface SeedCatalogItem {
  id: string;
  name: string;
  rarity: SeedRarity;
  sortOrder: number;
  description: string;
  lore: string;
  stageGold: {
    growing: number;
    mature: number;
    withered: number;
  };
  growthSeconds: number;
  unlockedByDefault: boolean;
}

export const seedCatalog: SeedCatalogItem[] = [
  { id: 'qilingya', name: '启灵芽', rarity: 'common', sortOrder: 1, description: '新手教程种，10 秒完成第一轮收获。', lore: '只在开荒时授予的一枚灵芽，破土极快，用来帮新人从零点亮第一笔资金。', stageGold: { growing: 20, mature: 50, withered: 50 }, growthSeconds: 10, unlockedByDefault: true },
  { id: 'qinglingmai', name: '青灵麦', rarity: 'common', sortOrder: 10, description: '免费开放的基础稳收种，适合进入日常经营。', lore: '田野间最常见的灵粮，穗头泛淡青光泽，脱壳后熬粥清香回甘。凡人食之强身，修士食之略养经脉。春种秋收，从不妖异。', stageGold: { growing: 100, mature: 200, withered: 100 }, growthSeconds: 10800, unlockedByDefault: true },
  { id: 'xunyamai', name: '风云稻', rarity: 'common', sortOrder: 20, description: '免费开放的基础快收种，适合切碎片时间。', lore: '稻芒起势极快，晨起沾露便能成势，半个时辰内就能完成一轮收益。', stageGold: { growing: 100, mature: 200, withered: 100 }, growthSeconds: 1800, unlockedByDefault: true },
  { id: 'ninglucao', name: '凝露草', rarity: 'common', sortOrder: 30, description: '普通、短线快收种，适合高频上线卡成熟。', lore: '叶尖常凝夜露，晨时如泪珠滚落，有清心明目之效。低阶弟子多用其露水研磨朱砂画符，成功率能稍许提升。', stageGold: { growing: 100, mature: 140, withered: 40 }, growthSeconds: 7200, unlockedByDefault: false },
  { id: 'suixinhua', name: '碎心花', rarity: 'common', sortOrder: 40, description: '普通、高折损高回报种，成熟收益高但枯萎折损明显。', lore: '花瓣薄如蝉翼，嫣红带紫纹，看似艳丽。但有微毒，采摘时指尖会传来一阵短暂的钻心刺痛，故名。可入麻醉类丹药。', stageGold: { growing: 120, mature: 300, withered: 50 }, growthSeconds: 10800, unlockedByDefault: false },
  { id: 'baiyulian', name: '白玉莲', rarity: 'common', sortOrder: 50, description: '普通、低频保值种，错过窗口也不容易血亏。', lore: '纯白无瑕，瓣如凝脂，生于清澈浅塘。花心微黄，清香远溢。凡人供于佛前，修士取其花瓣泡茶，可净体内杂气。', stageGold: { growing: 160, mature: 220, withered: 180 }, growthSeconds: 16200, unlockedByDefault: false },
  { id: 'yingyuezhu', name: '影月竹', rarity: 'common', sortOrder: 60, description: '普通、稳健中速种，适合平衡型经营。', lore: '竹身乌青，夜来月光下会在地上投出淡淡银影，竹节修长如剑。常种于书斋窗外，能助人凝神夜读，抵御睡魔。', stageGold: { growing: 150, mature: 230, withered: 140 }, growthSeconds: 12600, unlockedByDefault: false },
  { id: 'qianjiteng', name: '牵机藤', rarity: 'common', sortOrder: 70, description: '普通、高成熟收益种，适合稳定等到成熟后收取。', lore: '藤蔓天生细密纹路，如牵机阵法。缠绕古木或篱笆，可束缚小妖、守护庭院，是低阶阵法师最喜搭配的活体材料。', stageGold: { growing: 170, mature: 360, withered: 120 }, growthSeconds: 12600, unlockedByDefault: false },
  { id: 'huichuncao', name: '回春草', rarity: 'rare', sortOrder: 110, description: '稀有、回种保值种，上线不稳时更稳。', lore: '通体碧玉，全草如翡翠，五十年才成熟一株。煮水内服可愈沉疴暗伤，对外伤亦有奇效。一株值百金，药农视若性命。', stageGold: { growing: 320, mature: 480, withered: 380 }, growthSeconds: 14400, unlockedByDefault: false },
  { id: 'xueyuehua', name: '雪月花', rarity: 'rare', sortOrder: 120, description: '稀有、高成熟收益种，适合准时收取。', lore: '只在高寒雪山顶的月圆之夜盛开，花瓣冰白带银纹，花蕊一点淡蓝。盛开时方圆十丈飘雪，花谢后雪融。可炼“寒魄丹”，助冰系功法。', stageGold: { growing: 300, mature: 760, withered: 180 }, growthSeconds: 12600, unlockedByDefault: false },
  { id: 'jingdaosong', name: '劲道松', rarity: 'rare', sortOrder: 130, description: '稀有、长周期高保值种，适合重仓慢收。', lore: '矮松，树皮龟裂如铁，松针短而刚硬。长在罡风口的悬崖上，木质极密、韧性惊人。折断一松枝制成剑胚，便是不错的筑基法器。', stageGold: { growing: 450, mature: 620, withered: 520 }, growthSeconds: 18000, unlockedByDefault: false },
  { id: 'hundunguo', name: '混沌果', rarity: 'rare', sortOrder: 140, description: '稀有、后期抽水种，中后段高价值诱盗目标。', lore: '拳头大的圆果，灰蒙蒙无纹，剖开内里一片浑浊。罕见地生长在灵脉与地脉交错的混乱处。炼化后可让修士短暂进入“混沌”状态，免疫五行术法一炷香。', stageGold: { growing: 420, mature: 880, withered: 260 }, growthSeconds: 19800, unlockedByDefault: false },
  { id: 'zhanqingsi', name: '斩情丝', rarity: 'legendary', sortOrder: 210, description: '传说、高风险斩杀种，高收益也高失败代价。', lore: '茎如金丝，赤红纤细，一旦被它缠住手指，便会暂时斩断某人对另一人的爱慕或怨恨。传说上古有大能以此草炼制“绝情丹”，后被各派联手销毁，仅余深山数株。', stageGold: { growing: 520, mature: 1200, withered: 200 }, growthSeconds: 14400, unlockedByDefault: false },
  { id: 'wangchuanying', name: '忘川影', rarity: 'legendary', sortOrder: 220, description: '传说、长周期隐性暴利种，后段重投入慢兑现。', lore: '水边黑色丝状藻类，夜来投影如人影晃动。用它泡水喝下，会看到一段不属于自己的前世片段，往往是最痛苦的那一瞬。邪修常用其拷问死者的秘密。', stageGold: { growing: 760, mature: 1200, withered: 960 }, growthSeconds: 21600, unlockedByDefault: false },
  { id: 'zhaoyouming', name: '照幽冥', rarity: 'legendary', sortOrder: 230, description: '传说、极限成熟收益种，终局上限最高之一。', lore: '通体漆黑的矮草，夜里发出微弱青光，能照亮脚下三尺的地气与亡魂足迹。相传若手握此草走进刚死之人的屋子，可看见死者徘徊不去的淡影，并与之做最后交谈。', stageGold: { growing: 700, mature: 1600, withered: 680 }, growthSeconds: 18000, unlockedByDefault: false },
];

export const seedRarityLabels: Record<SeedRarity, string> = {
  common: '普通',
  rare: '稀有',
  legendary: '传说',
};

export function compareSeedCatalogItems(left: SeedCatalogItem, right: SeedCatalogItem): number {
  return left.sortOrder - right.sortOrder || left.id.localeCompare(right.id);
}

export const defaultUnlockedSeedIds = seedCatalog
  .filter((seed) => seed.unlockedByDefault)
  .sort(compareSeedCatalogItems)
  .map((seed) => seed.id);

export const emptySeedInventory = seedCatalog.reduce<Record<string, number>>((inventory, seed) => {
  inventory[seed.id] = 0;
  return inventory;
}, {});
