import type { ClientSpiritElement } from '@trinitywar/shared';
import type { SpiritCollisionUnitInput } from '@trinitywar/shared';

interface DemoScenario {
  id: string;
  name: string;
  description: string;
  seed: number;
  attacker: SpiritCollisionUnitInput;
  defender: SpiritCollisionUnitInput;
}

function trait(code: string, label: string, value: number) {
  return { code, label, value };
}

function createUnit(input: {
  side: 'attacker' | 'defender';
  playerName: string;
  spiritId: string;
  spiritName: string;
  rarity: string;
  element: ClientSpiritElement;
  level: number;
  attack: number;
  maxHp: number;
  traits: Array<{ code: string; label: string; value: number }>;
}): SpiritCollisionUnitInput {
  return {
    side: input.side,
    playerName: input.playerName,
    spiritId: input.spiritId,
    spiritName: input.spiritName,
    rarity: input.rarity,
    element: input.element,
    level: input.level,
    attack: input.attack,
    maxHp: input.maxHp,
    traits: input.traits,
  };
}

export const BATTLE_CANVAS_DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'fast-burst',
    name: '快攻爆杀',
    description: '验证前 5 回合的冲撞节奏、暴击反馈和中心停顿是否够硬。',
    seed: 20260621,
    attacker: createUnit({
      side: 'attacker',
      playerName: '测试玩家',
      spiritId: 'canglang',
      spiritName: '苍狼',
      rarity: 'common',
      element: 'fire',
      level: 20,
      attack: 132,
      maxHp: 780,
      traits: [
        trait('claw', '利爪', 12),
        trait('sharp_blade', '利刃', 30),
        trait('crit', '暴击', 8),
        trait('crit_damage', '暴伤', 25),
        trait('harvest', '收割', 18),
      ],
    }),
    defender: createUnit({
      side: 'defender',
      playerName: '守田者',
      spiritId: 'chenghuang',
      spiritName: '乘黄',
      rarity: 'rare',
      element: 'metal',
      level: 20,
      attack: 96,
      maxHp: 1120,
      traits: [
        trait('thick_skin', '厚皮', 12),
        trait('lifesteal', '吸血', 12),
        trait('dodge', '闪避', 6),
        trait('suppress', '压制', 8),
        trait('iron_bone', '铁骨', 30),
      ],
    }),
  },
  {
    id: 'stall-blood',
    name: '血牛拖燃',
    description: '验证长局进入燃血时的 notice、压暗和燃血扣血节奏。',
    seed: 20260622,
    attacker: createUnit({
      side: 'attacker',
      playerName: '测试玩家',
      spiritId: 'hegui',
      spiritName: '岩龟',
      rarity: 'common',
      element: 'earth',
      level: 20,
      attack: 68,
      maxHp: 1800,
      traits: [
        trait('thick_skin', '厚皮', 12),
        trait('thick_skin', '厚皮', 12),
        trait('iron_bone', '铁骨', 30),
        trait('lifesteal', '吸血', 12),
        trait('blaze', '炽燃', 3),
      ],
    }),
    defender: createUnit({
      side: 'defender',
      playerName: '守田者',
      spiritId: 'xueyan',
      spiritName: '血魇',
      rarity: 'legendary',
      element: 'water',
      level: 20,
      attack: 82,
      maxHp: 1780,
      traits: [
        trait('claw', '利爪', 12),
        trait('crit', '暴击', 8),
        trait('crit_damage', '暴伤', 25),
        trait('lifesteal', '吸血', 12),
        trait('sharp_blade', '利刃', 30),
      ],
    }),
  },
  {
    id: 'counter-blood-tank',
    name: '反血牛',
    description: '验证破血、裂伤这类偏克制型对局是否依然读得清。',
    seed: 20260623,
    attacker: createUnit({
      side: 'attacker',
      playerName: '测试玩家',
      spiritId: 'zhuyan',
      spiritName: '朱厌',
      rarity: 'rare',
      element: 'wood',
      level: 20,
      attack: 116,
      maxHp: 920,
      traits: [
        trait('blood_breaker', '破血', 18),
        trait('blood_breaker', '破血', 18),
        trait('wound', '裂伤', 8),
        trait('claw', '利爪', 12),
        trait('crit', '暴击', 8),
      ],
    }),
    defender: createUnit({
      side: 'defender',
      playerName: '守田者',
      spiritId: 'yinglong',
      spiritName: '应龙',
      rarity: 'legendary',
      element: 'earth',
      level: 20,
      attack: 96,
      maxHp: 1550,
      traits: [
        trait('thick_skin', '厚皮', 12),
        trait('thick_skin', '厚皮', 12),
        trait('iron_bone', '铁骨', 30),
        trait('lifesteal', '吸血', 12),
        trait('disruption', '断续', 20),
      ],
    }),
  },
  {
    id: 'last-stand',
    name: '残血反打',
    description: '验证残血翻盘时，扣血、回位和结果提示是否还能跟得住。',
    seed: 20260624,
    attacker: createUnit({
      side: 'attacker',
      playerName: '测试玩家',
      spiritId: 'qingyuan',
      spiritName: '青猿',
      rarity: 'common',
      element: 'water',
      level: 20,
      attack: 108,
      maxHp: 980,
      traits: [
        trait('last_stand', '背水', 25),
        trait('last_stand', '背水', 25),
        trait('lifesteal', '吸血', 12),
        trait('crit', '暴击', 8),
        trait('crit_damage', '暴伤', 25),
      ],
    }),
    defender: createUnit({
      side: 'defender',
      playerName: '守田者',
      spiritId: 'yingbao',
      spiritName: '影豹',
      rarity: 'common',
      element: 'fire',
      level: 20,
      attack: 126,
      maxHp: 900,
      traits: [
        trait('harvest', '收割', 18),
        trait('claw', '利爪', 12),
        trait('crit', '暴击', 8),
        trait('crit_damage', '暴伤', 25),
        trait('dodge', '闪避', 6),
      ],
    }),
  },
  {
    id: 'disruption',
    name: '干扰压制',
    description: '验证压制型对局的观感是否足够稳，不会只剩机械播片感。',
    seed: 20260625,
    attacker: createUnit({
      side: 'attacker',
      playerName: '测试玩家',
      spiritId: 'guishou',
      spiritName: '讹兽',
      rarity: 'rare',
      element: 'metal',
      level: 20,
      attack: 104,
      maxHp: 1080,
      traits: [
        trait('suppress', '压制', 8),
        trait('disruption', '断续', 20),
        trait('wound', '裂伤', 8),
        trait('thick_skin', '厚皮', 12),
        trait('harvest', '收割', 18),
      ],
    }),
    defender: createUnit({
      side: 'defender',
      playerName: '守田者',
      spiritId: 'xuanhu',
      spiritName: '玄虎',
      rarity: 'common',
      element: 'wood',
      level: 20,
      attack: 130,
      maxHp: 900,
      traits: [
        trait('claw', '利爪', 12),
        trait('sharp_blade', '利刃', 30),
        trait('crit', '暴击', 8),
        trait('crit_damage', '暴伤', 25),
        trait('lifesteal', '吸血', 12),
      ],
    }),
  },
  {
    id: 'dodge-gamble',
    name: '闪避赌命',
    description: '验证 miss 节奏是否足够轻快，不会拖慢整轮碰撞。',
    seed: 20260626,
    attacker: createUnit({
      side: 'attacker',
      playerName: '测试玩家',
      spiritId: 'shuanghu',
      spiritName: '霜狐',
      rarity: 'common',
      element: 'fire',
      level: 20,
      attack: 100,
      maxHp: 980,
      traits: [
        trait('dodge', '闪避', 6),
        trait('dodge', '闪避', 6),
        trait('dodge', '闪避', 6),
        trait('crit', '暴击', 8),
        trait('lifesteal', '吸血', 12),
      ],
    }),
    defender: createUnit({
      side: 'defender',
      playerName: '守田者',
      spiritId: 'canglang',
      spiritName: '苍狼',
      rarity: 'common',
      element: 'water',
      level: 20,
      attack: 125,
      maxHp: 900,
      traits: [
        trait('claw', '利爪', 12),
        trait('sharp_blade', '利刃', 30),
        trait('crit', '暴击', 8),
        trait('crit_damage', '暴伤', 25),
        trait('harvest', '收割', 18),
      ],
    }),
  },
];

export type { DemoScenario };
