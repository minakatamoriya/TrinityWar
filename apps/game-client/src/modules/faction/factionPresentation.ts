import type { FactionContributionTier } from '../../shell/appStateTypes';

export function buildFactionContributionTiers(): FactionContributionTier[] {
  return [
    { threshold: '0 贡献', label: '基础俸禄', rewards: ['金币 x20', '随机普通精华 x3', '普通兽魂 x2'] },
    { threshold: '100 贡献', label: '小有供奉', rewards: ['金币 x30', '随机普通精华 x5', '普通兽魂 x5'] },
    { threshold: '300 贡献', label: '稳定供奉', rewards: ['金币 x40', '指定普通精华 x8', '普通兽魂 x10'] },
    { threshold: '600 贡献', label: '阵营骨干', rewards: ['金币 x50', '随机稀有精华 x6', '稀有兽魂 x4', '普通灵宠精魄 x2'] },
    { threshold: '1000 贡献', label: '高阶供奉', rewards: ['金币 x60', '指定稀有精华 x10', '稀有兽魂 x8', '稀有灵宠精魄 x3'] },
    { threshold: '2000 贡献', label: '阵营重臣', rewards: ['金币 x80', '随机传说精华 x8', '传说兽魂 x2', '传说灵宠精魄 x2'] },
  ];
}
