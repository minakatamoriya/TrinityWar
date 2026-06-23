import type { ClientSceneKey } from '@trinitywar/shared';
import type { DevFactionChoice } from '../api';

export type AppSceneKey = 'farm' | 'spirit' | 'battle' | 'social' | 'faction';

export interface FactionChoiceCard {
  code: DevFactionChoice;
  name: string;
  title: string;
  traits: string[];
  leaderSummary: string;
}

export const sceneNavLabels: Record<AppSceneKey, string> = {
  farm: '灵田',
  spirit: '灵宠',
  battle: '战斗',
  social: '社交',
  faction: '阵营',
};

export const sceneKeys: AppSceneKey[] = ['farm', 'spirit', 'battle', 'social', 'faction'];

const factionBackgroundMap: Record<string, string> = {
  人界: '/assets/backgrounds/renjie.png',
  仙界: '/assets/backgrounds/xianjie.png',
  魔界: '/assets/backgrounds/mojie.png',
};

const sceneBackgroundMap: Record<AppSceneKey | 'building', string> = {
  building: '/assets/backgrounds/jianzhu.png',
  farm: '/assets/backgrounds/nongchang.png',
  spirit: '/assets/backgrounds/lueduo.png',
  battle: '/assets/backgrounds/zhanbao.png',
  faction: '/assets/backgrounds/zhenying.png',
  social: '/assets/backgrounds/zhenying.png',
};

export const factionChoiceCards: FactionChoiceCard[] = [
  {
    code: 'human',
    name: '人界',
    title: '种田更强',
    traits: ['更适合种田经营', '收菜节奏更稳', '适合长期发展'],
    leaderSummary: '人界更擅长经营灵田，收成更稳，种田节奏也更从容。前期更容易靠稳定资源养起整条成长线，适合喜欢慢慢铺开的玩家。',
  },
  {
    code: 'immortal',
    name: '仙界',
    title: '养宠更强',
    traits: ['更适合灵宠成长', '养成推进更顺', '主宠提升更明显'],
    leaderSummary: '仙界更擅长培育灵宠，主宠成长更快，养成推进也更顺手。更容易把第一只灵宠尽快养成主力，适合喜欢围绕灵宠持续投入的玩家。',
  },
  {
    code: 'demon',
    name: '魔界',
    title: '战斗更强',
    traits: ['更适合主动战斗', '出手更狠', '连续作战更有优势'],
    leaderSummary: '魔界更擅长主动战斗，出手更狠，战斗节奏也更直接。更容易在对战和目标争夺中打出优势，适合喜欢主动进攻的玩家。',
  },
];

export const FRIEND_INVITE_DEMO_INVITER = {
  name: '测试好友',
  factionCode: 'human' as const,
  factionName: '人界',
};

export const factionCodeByName: Record<string, DevFactionChoice> = {
  人界: 'human',
  仙界: 'immortal',
  魔界: 'demon',
};

function getFactionBackground(factionName: string): string {
  return factionBackgroundMap[factionName] ?? factionBackgroundMap['人界'];
}

export function getSceneBackground(scene: AppSceneKey | ClientSceneKey, factionName: string): string {
  if (scene === 'home') {
    return sceneBackgroundMap.farm;
  }
  if (scene === 'raid') {
    return sceneBackgroundMap.battle;
  }
  if (scene === 'report') {
    return sceneBackgroundMap.battle;
  }

  return sceneBackgroundMap[scene as AppSceneKey | 'building'] ?? getFactionBackground(factionName);
}
