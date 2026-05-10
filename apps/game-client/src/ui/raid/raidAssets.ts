import type { ClientFarmField } from '@trinitywar/shared';

export const raidFieldPreviewImageMap: Record<ClientFarmField['tone'], string> = {
  seeded: '/assets/farm/bozhong.png',
  growing: '/assets/farm/chengzhang.png',
  mature: '/assets/farm/chengshu.png',
  withered: '/assets/farm/kuwei.png',
  empty: '/assets/farm/weibozhong.png',
  locked: '/assets/farm/weibozhong.png',
};