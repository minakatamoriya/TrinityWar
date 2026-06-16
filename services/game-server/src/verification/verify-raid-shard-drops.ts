import assert from 'node:assert/strict';
import { RaidSettlementRuleService, type SpiritBattleSnapshot } from '../raid/raid-settlement-rule.service.js';

const FIXED_RANDOM_VALUE = 0.5;

function main(): void {
  const service = new RaidSettlementRuleService();

  withFixedRandom(FIXED_RANDOM_VALUE, () => {
    assertShardDrop(service, { rarity: 'COMMON', attackerBaseAttack: 60, defenderBaseAttack: 45, expectedTier: 'minor_win', expectedQuantity: 2 });
    assertShardDrop(service, { rarity: 'COMMON', attackerBaseAttack: 65, defenderBaseAttack: 40, expectedTier: 'major_win', expectedQuantity: 3 });
    assertShardDrop(service, { rarity: 'COMMON', attackerBaseAttack: 80, defenderBaseAttack: 40, expectedTier: 'perfect_win', expectedQuantity: 4 });
    assertShardDrop(service, {
      rarity: 'COMMON',
      attackerBaseAttack: 60,
      defenderBaseAttack: 45,
      expectedTier: 'minor_win',
      expectedQuantity: 2,
      shardDropDisplayLabel: '？？',
      expectedDisplayLabel: '？？',
    });

    assertShardDrop(service, { rarity: 'RARE', attackerBaseAttack: 55, defenderBaseAttack: 40, expectedTier: 'minor_win', expectedQuantity: 1 });
    assertShardDrop(service, { rarity: 'RARE', attackerBaseAttack: 65, defenderBaseAttack: 40, expectedTier: 'major_win', expectedQuantity: 2 });
    assertShardDrop(service, { rarity: 'RARE', attackerBaseAttack: 80, defenderBaseAttack: 40, expectedTier: 'perfect_win', expectedQuantity: 3 });

    assertShardDrop(service, { rarity: 'LEGENDARY', attackerBaseAttack: 55, defenderBaseAttack: 40, expectedTier: 'minor_win', expectedQuantity: 1 });
    assertShardDrop(service, { rarity: 'LEGENDARY', attackerBaseAttack: 65, defenderBaseAttack: 40, expectedTier: 'major_win', expectedQuantity: 1 });
    assertShardDrop(service, { rarity: 'LEGENDARY', attackerBaseAttack: 80, defenderBaseAttack: 40, expectedTier: 'perfect_win', expectedQuantity: 2 });
  });

  console.log('verify:raid-shard-drops passed');
}

function assertShardDrop(
  service: RaidSettlementRuleService,
  input: {
    rarity: 'COMMON' | 'RARE' | 'LEGENDARY';
    attackerBaseAttack: number;
    defenderBaseAttack: number;
    expectedTier: 'minor_win' | 'major_win' | 'perfect_win';
    expectedQuantity: number;
    shardDropDisplayLabel?: string;
    expectedDisplayLabel?: string;
  },
): void {
  const result = service.calculate({
    lockedGold: 100,
    vaultGold: 0,
    attackerFactionName: null,
    defenderFactionName: null,
    attackerSpirit: buildSpiritSnapshot({
      spiritId: 'attacker-spirit',
      label: 'Attacker Spirit',
      rarity: 'COMMON',
      baseAttack: input.attackerBaseAttack,
    }),
    defenderSpirit: buildSpiritSnapshot({
      spiritId: `${input.rarity.toLowerCase()}-defender`,
      label: `${input.rarity} Defender`,
      rarity: input.rarity,
      baseAttack: input.defenderBaseAttack,
    }),
    shardDropDisplayLabel: input.shardDropDisplayLabel,
  });

  assert.equal(result.result, 'WIN');
  assert.equal(result.tier, input.expectedTier);
  assert.equal(result.shardDrop?.quantity ?? 0, input.expectedQuantity);
  assert.equal(result.shardDrop?.displayLabel ?? null, input.expectedDisplayLabel ?? `${input.rarity} Defender`);
}

function buildSpiritSnapshot(input: {
  spiritId: string;
  label: string;
  rarity: 'COMMON' | 'RARE' | 'LEGENDARY';
  baseAttack: number;
}): SpiritBattleSnapshot {
  return {
    slotId: `${input.spiritId}-slot`,
    slotIndex: 1,
    level: 1,
    element: null,
    maxHp: 100,
    status: 'ACTIVE',
    spiritDefinition: {
      id: `${input.spiritId}-definition`,
      spiritId: input.spiritId,
      label: input.label,
      rarity: input.rarity,
      factionAffinity: 'human',
      role: 'ATTACK',
      baseAttack: input.baseAttack,
      baseHp: 100,
      growthAttack: 0,
      growthHp: 0,
    },
    traits: [],
  };
}

function withFixedRandom(value: number, run: () => void): void {
  const originalRandom = Math.random;
  Math.random = () => value;
  try {
    run();
  } finally {
    Math.random = originalRandom;
  }
}

main();
