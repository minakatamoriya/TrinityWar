import type { FactionContributionTier } from '../../shell/appStateTypes';

export function buildFactionContributionTiers(): FactionContributionTier[] {
  return [
    { threshold: '0 贡献', label: '基础俸禄', rewards: ['金币 x20', '灵根 x20', '普通兽魂 x5'] },
    { threshold: '100 贡献', label: '小有供奉', rewards: ['金币 x30', '灵根 x35', '普通兽魂 x10'] },
    { threshold: '300 贡献', label: '稳定供奉', rewards: ['金币 x40', '灵根 x50', '灵髓 x2', '稀有兽魂 x2', '普通兽魂 x8'] },
    { threshold: '600 贡献', label: '阵营骨干', rewards: ['金币 x50', '灵根 x70', '灵髓 x4', '稀有兽魂 x6'] },
    { threshold: '1000 贡献', label: '高阶供奉', rewards: ['金币 x60', '灵根 x90', '灵髓 x6', '灵玉 x1', '稀有兽魂 x10'] },
    { threshold: '2000 贡献', label: '阵营重臣', rewards: ['金币 x80', '灵根 x120', '灵髓 x8', '灵玉 x2', '传说兽魂 x2'] },
  ];
}
