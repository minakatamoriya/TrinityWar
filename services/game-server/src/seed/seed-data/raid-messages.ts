export interface RaidMessageTemplateSeedData {
  templateId: string;
  text: string;
  sortOrder: number;
  isActive: boolean;
}

export const RAID_MESSAGE_TEMPLATE_SEEDS: RaidMessageTemplateSeedData[] = [
  {
    templateId: 'steady-harvest',
    text: '今日借一程，来日还一礼。',
    sortOrder: 10,
    isActive: true,
  },
  {
    templateId: 'field-well-kept',
    text: '田照顾得不错，我记下了。',
    sortOrder: 20,
    isActive: true,
  },
  {
    templateId: 'next-time-guard',
    text: '下次记得把成熟田守紧。',
    sortOrder: 30,
    isActive: true,
  },
  {
    templateId: 'fair-raid',
    text: '各凭本事，不伤和气。',
    sortOrder: 40,
    isActive: true,
  },
  {
    templateId: 'come-again',
    text: '这次收下了，改日再会。',
    sortOrder: 50,
    isActive: true,
  },
];
