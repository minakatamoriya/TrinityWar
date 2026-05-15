export interface FactionSeedData {
  code: string;
  name: string;
  treasuryGold: number;
  hourlyBaseDividend: number;
  hourlyContributionDividendPerTen: number;
}

export const FACTION_SEEDS: FactionSeedData[] = [
  {
    code: 'human',
    name: '人界',
    treasuryGold: 0,
    hourlyBaseDividend: 8,
    hourlyContributionDividendPerTen: 3,
  },
  {
    code: 'immortal',
    name: '仙界',
    treasuryGold: 0,
    hourlyBaseDividend: 8,
    hourlyContributionDividendPerTen: 3,
  },
  {
    code: 'demon',
    name: '魔界',
    treasuryGold: 0,
    hourlyBaseDividend: 8,
    hourlyContributionDividendPerTen: 3,
  },
];
