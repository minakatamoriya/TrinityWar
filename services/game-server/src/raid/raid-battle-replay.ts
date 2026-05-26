import type {
  ClientRaidBattleEvent,
  ClientRaidBattleFloatingTone,
  ClientRaidBattleReplay,
  ClientRaidRewardItem,
  ClientSpiritElement,
} from '@trinitywar/shared';
import type { SpiritBattleSnapshot } from './raid-settlement-rule.service.js';

export interface RaidBattleReplaySettlementInput {
  result: string;
  lootGold: number;
  attackerLoss: number;
  defenderLoss: number;
  reportSummary: string;
  rewardItemsJson: unknown;
}

export interface RaidBattleReplayOrderInput {
  attackerSnapshotJson: unknown;
  defenderSnapshotJson: unknown;
  attacker: { nickname: string };
  defender: { nickname: string };
}

export function buildRaidBattleReplay(
  orderId: string,
  settlement: RaidBattleReplaySettlementInput,
  order: RaidBattleReplayOrderInput,
): ClientRaidBattleReplay {
  const rewards = normalizeRaidRewards(settlement.rewardItemsJson);
  const battleEvents = normalizeRaidBattleEvents(settlement.rewardItemsJson);
  const attackerSpirit = readSpiritSnapshot(order.attackerSnapshotJson);
  const defenderSpirit = readSpiritSnapshot(order.defenderSnapshotJson);
  const attacker = buildBattleUnit('attacker', order.attacker.nickname, attackerSpirit, settlement.attackerLoss);
  const defender = buildBattleUnit('defender', order.defender.nickname, defenderSpirit, settlement.defenderLoss);
  const floatingSteps = battleEvents.slice(0, 4).map((event, index) => ({
    type: 'floatingText' as const,
    side: resolveBattleEventSide(event, index),
    text: event.label,
    tone: resolveBattleEventTone(event),
    durationMs: 520,
  }));

  return {
    orderId,
    result: normalizeBattleResult(settlement.result),
    title: settlement.result === 'WIN' ? '掠夺成功' : settlement.result === 'LOSS' ? '掠夺失利' : '双方相持',
    summary: settlement.reportSummary,
    attacker,
    defender,
    events: battleEvents,
    steps: [
      { type: 'enter', durationMs: 520 },
      { type: 'clash', durationMs: 360 },
      ...floatingSteps,
      { type: 'hpChange', side: 'attacker', from: attacker.hpBefore, to: attacker.hpAfter, max: attacker.maxHp, durationMs: 520 },
      { type: 'hpChange', side: 'defender', from: defender.hpBefore, to: defender.hpAfter, max: defender.maxHp, durationMs: 520 },
      { type: 'return', durationMs: 480 },
      { type: 'result', title: settlement.result === 'WIN' ? '胜利' : settlement.result === 'LOSS' ? '失败' : '平局', summary: settlement.reportSummary, durationMs: 1 },
    ],
    rewardsPreview: {
      goldLoot: settlement.lootGold,
      items: rewards,
    },
  };
}

export function normalizeRaidRewards(value: unknown): ClientRaidRewardItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => item as { type?: string; seedId?: string; spiritId?: string; label?: string; quantity?: number })
    .filter((item) => item.type !== 'battleEvent' && typeof item.label === 'string' && typeof item.quantity === 'number')
    .map((item) => ({
      seedId: item.seedId ?? item.spiritId ?? item.type ?? 'raid-reward',
      label: item.label ?? '奖励',
      quantity: Math.max(Math.floor(item.quantity ?? 0), 0),
    }))
    .filter((item) => item.quantity > 0);
}

export function normalizeRaidBattleEvents(value: unknown): ClientRaidBattleEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const supportedTypes = new Set<ClientRaidBattleEvent['type']>(['dodge', 'execute', 'element', 'critical', 'lifesteal', 'counter', 'damage', 'soul-drop', 'status']);

  return value
    .map((item) => item as { type?: string; label?: string; description?: string })
    .filter((item) => item.type === 'battleEvent' && typeof item.label === 'string' && typeof item.description === 'string')
    .map((item) => ({
      type: supportedTypes.has(item.type as ClientRaidBattleEvent['type']) ? item.type as ClientRaidBattleEvent['type'] : 'damage',
      label: item.label ?? '',
      description: item.description ?? '',
    }));
}

export function parseRaidBattleReplay(value: unknown): ClientRaidBattleReplay | undefined {
  const replay = value as Partial<ClientRaidBattleReplay> | null;
  if (!replay || typeof replay !== 'object' || typeof replay.orderId !== 'string' || !replay.attacker || !replay.defender || !Array.isArray(replay.steps)) {
    return undefined;
  }

  return replay as ClientRaidBattleReplay;
}

function readSpiritSnapshot(value: unknown): SpiritBattleSnapshot | null {
  const snapshot = value as { mainSpirit?: unknown } | null;
  const mainSpirit = snapshot?.mainSpirit as SpiritBattleSnapshot | null;
  return mainSpirit && typeof mainSpirit === 'object' && typeof mainSpirit.slotId === 'string' ? mainSpirit : null;
}

function buildBattleUnit(
  side: 'attacker' | 'defender',
  playerName: string,
  spirit: SpiritBattleSnapshot | null,
  lossPercent: number,
): ClientRaidBattleReplay['attacker'] {
  const maxHp = Math.max(Math.floor(spirit?.maxHp ?? 120), 1);
  const hpBefore = Math.min(Math.max(Math.floor(spirit?.currentHp ?? maxHp), 0), maxHp);
  const hpAfter = Math.min(Math.max(Math.round(maxHp * (1 - Math.max(lossPercent, 0) / 100)), 0), maxHp);
  const stats = buildBattleStats(spirit);
  const healthStatus = resolveBattleHealthStatus(hpBefore, maxHp);

  return {
    side,
    playerName,
    spiritId: spirit?.spiritDefinition.spiritId ?? null,
    spiritName: spirit?.spiritDefinition.label ?? '守备灵宠',
    rarity: spirit?.spiritDefinition.rarity ?? null,
    element: mapBattleElement(spirit?.element ?? null),
    level: Math.max(Math.floor(spirit?.level ?? 1), 1),
    hpBefore,
    hpAfter,
    maxHp,
    attack: stats.attack,
    healthStatus: healthStatus.code,
    healthStatusLabel: healthStatus.label,
    attackCoefficient: healthStatus.attackCoefficient,
    traits: buildBattleTraits(spirit),
  };
}

function buildBattleTraits(spirit: SpiritBattleSnapshot | null): NonNullable<ClientRaidBattleReplay['attacker']['traits']> {
  return (spirit?.traits ?? [])
    .filter((trait) => trait.traitValue !== 0)
    .map((trait) => ({
      code: trait.traitCode,
      label: getTraitLabel(trait.traitCode),
      value: trait.traitValue,
      valueType: 'percent' as const,
      source: 'spirit' as const,
      visible: true,
    }));
}

function getTraitLabel(code: string): string {
  const labels: Record<string, string> = {
    claw: '利爪',
    thick_skin: '厚皮',
    crit: '暴击',
    crit_damage: '暴伤',
    dodge: '闪避',
    counter: '反击',
    lifesteal: '吸血',
    tenacity: '韧性',
  };

  return labels[code] ?? code;
}

function buildBattleStats(spirit: SpiritBattleSnapshot | null): { attack: number } {
  if (!spirit?.spiritDefinition) {
    return { attack: 50 };
  }

  const levelDelta = Math.max(spirit.level - 1, 0);
  const rarityMultiplier = getRarityGrowthMultiplier(spirit.spiritDefinition.rarity, spirit.level);
  const healthStatus = resolveBattleHealthStatus(spirit.currentHp, spirit.maxHp);
  return {
    attack: Math.round((spirit.spiritDefinition.baseAttack + levelDelta * spirit.spiritDefinition.growthAttack * rarityMultiplier) * healthStatus.attackCoefficient),
  };
}

function resolveBattleHealthStatus(currentHp: number, maxHp: number): {
  code: NonNullable<ClientRaidBattleReplay['attacker']['healthStatus']>;
  label: string;
  attackCoefficient: number;
} {
  const ratio = maxHp > 0 ? currentHp / maxHp : 0;
  if (currentHp <= 0 || ratio <= 0) {
    return { code: 'down', label: '不可出战', attackCoefficient: 0 };
  }
  if (ratio < 0.3) {
    return { code: 'injured', label: '重伤：攻击 30%', attackCoefficient: 0.3 };
  }
  if (ratio < 0.7) {
    return { code: 'low', label: '低迷：攻击 70%', attackCoefficient: 0.7 };
  }
  return { code: 'normal', label: '正常：攻击 100%', attackCoefficient: 1 };
}

function getRarityGrowthMultiplier(rarity: string, level: number): number {
  if (rarity === 'LEGENDARY') return level <= 10 ? 0.9 : level <= 30 ? 1.02 : 1.18;
  if (rarity === 'RARE') return level <= 10 ? 0.96 : level <= 30 ? 1.06 : 1.08;
  return level <= 30 ? 1 : 0.92;
}

function mapBattleElement(element: string | null): ClientSpiritElement | null {
  if (element === 'METAL') return 'metal';
  if (element === 'WOOD') return 'wood';
  if (element === 'WATER') return 'water';
  if (element === 'FIRE') return 'fire';
  if (element === 'EARTH') return 'earth';
  return null;
}

function normalizeBattleResult(result: string): ClientRaidBattleReplay['result'] {
  if (result === 'WIN' || result === 'LOSS' || result === 'DRAW') {
    return result;
  }

  return 'DRAW';
}

function resolveBattleEventTone(event: ClientRaidBattleEvent): ClientRaidBattleFloatingTone {
  if (event.type === 'dodge') return 'miss';
  if (event.type === 'critical') return 'crit';
  if (event.type === 'element' || event.type === 'lifesteal' || event.type === 'counter' || event.type === 'status') return 'buff';
  return 'damage';
}

function resolveBattleEventSide(event: ClientRaidBattleEvent, index: number): 'attacker' | 'defender' {
  if (event.description.includes('防守方') || event.label.includes('防守')) {
    return 'defender';
  }
  if (event.description.includes('进攻方') || event.label.includes('进攻')) {
    return 'attacker';
  }
  return index % 2 === 0 ? 'defender' : 'attacker';
}
