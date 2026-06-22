import type { FactionContributionTier } from '../../shell/appStateTypes';

export function buildFactionContributionTiers(): FactionContributionTier[] {
  return [
    { threshold: '0 贡献', label: '基础俸禄', rewards: ['金币 x20', '灵根 x10', '随机灵宠碎片 x1', '普通兽魂 x5'] },
    { threshold: '50 贡献', label: '小有供奉', rewards: ['金币 x25', '灵根 x14', '随机灵宠碎片 x2', '普通兽魂 x8'] },
    { threshold: '100 贡献', label: '稳定供奉', rewards: ['金币 x30', '灵根 x18', '随机灵宠碎片 x3', '普通兽魂 x10'] },
    { threshold: '150 贡献', label: '阵营骨干', rewards: ['金币 x40', '灵根 x24', '随机灵宠碎片 x3', '灵髓 x2', '稀有兽魂 x2', '普通兽魂 x8'] },
    { threshold: '200 贡献', label: '高阶供奉', rewards: ['金币 x50', '灵根 x32', '随机灵宠碎片 x4', '灵髓 x4', '稀有兽魂 x4'] },
    { threshold: '300 贡献', label: '阵营重臣', rewards: ['金币 x60', '灵根 x45', '随机灵宠碎片 x5', '灵髓 x6', '灵玉 x1', '稀有兽魂 x8'] },
  ];
}
