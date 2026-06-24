import type { ClientRaidActionResponse } from '@trinitywar/shared';
import type { SeedRewardModalState } from '../../shell/appStateTypes';
import { formatNumber } from '../../utils/format';

type RaidResult = ClientRaidActionResponse['result'];

export function buildSettledRaidRewardModal(result: RaidResult): SeedRewardModalState {
  const battleEventSummary = result.battleEvents?.length
    ? ` 关键事件：${result.battleEvents.map((event) => event.label).join('、')}`
    : '';
  const hasNewSpiritCodexReveal = result.codexPrompts?.some((prompt) => prompt.type === 'spirit-codex-visible') ?? false;

  return {
    title: '战斗所得',
    contributionGain: result.contributionGain ?? 0,
    summary: result.overflowGold > 0
      ? `本次战斗获得 ${formatNumber(result.goldLoot)} 金币，其中 ${formatNumber(result.depositedGold)} 已入账，另有 ${formatNumber(result.overflowGold)} 转入待领取。${result.reportSummary}${battleEventSummary}`
      : `获得 ${formatNumber(result.goldLoot)} 金币。${result.reportSummary}${battleEventSummary}`,
    footerHint: hasNewSpiritCodexReveal ? '获得新的灵宠精魄，请到图鉴或合成栏位查看。' : undefined,
    items: [
      {
        seedId: 'raid-gold',
        label: '金币',
        quantity: result.goldLoot,
      },
      ...result.rewards.map((reward) => ({
        seedId: reward.seedId,
        quantity: reward.quantity,
        label: reward.label,
      })),
    ],
  };
}
