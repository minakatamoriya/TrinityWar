import type { FactionContributionTier } from '../../shell/appStateTypes';

export function buildFactionContributionTiers(): FactionContributionTier[] {
  return [
    { threshold: '0 贡献', label: '基础俸禄', rewards: ['金币 x20', '普通兽魂 x5'] },
    { threshold: '100 贡献', label: '小有供奉', rewards: ['金币 x30', '普通兽魂 x10'] },
    { threshold: '300 贡献', label: '稳定供奉', rewards: ['金币 x40', '普通兽魂 x18'] },
    { threshold: '600 贡献', label: '阵营骨干', rewards: ['金币 x50', '稀有兽魂 x10', '普通灵宠精魄 x2'] },
    { threshold: '1000 贡献', label: '高阶供奉', rewards: ['金币 x60', '稀有兽魂 x18', '稀有灵宠精魄 x3'] },
    { threshold: '2000 贡献', label: '阵营重臣', rewards: ['金币 x80', '传说兽魂 x10', '传说灵宠精魄 x2'] },
  ];
}
