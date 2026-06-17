import assert from 'node:assert/strict';
import {
  applyFactionFarmHarvestSpiritRootBonus,
  applyFactionBattlePostRecovery,
  applyFactionRaidDefenseLootLossReduction,
  applyFactionSpiritBreakthroughSoulCost,
  applyFactionSpiritPassiveExpBonus,
  applyFactionSpiritTraitRollGoldCost,
  getFactionBattleAttackMultiplier,
  getFactionBattleDefenseMainSpiritMaxHpMultiplier,
  getFactionFarmMatureSeconds,
  getFactionFarmMatureYieldMultiplier,
  getFactionFarmCollectWindowSeconds,
  runWithFactionAdvantageRuleSet,
} from '../lib/faction-advantage-formulas.js';
import { FACTION_STIPEND_CONFIG, SPIRIT_ROOT_ECONOMY_CONFIG } from '../lib/game-balance.js';

function main(): void {
  assert.equal(SPIRIT_ROOT_ECONOMY_CONFIG.feed.accelerateSecondsPerFeed, 2 * 60 * 60);
  assert.equal(SPIRIT_ROOT_ECONOMY_CONFIG.feed.rootCostPerFeed, 10);
  assert.equal(SPIRIT_ROOT_ECONOMY_CONFIG.feed.expBonusBps, 5000);
  assert.deepEqual(FACTION_STIPEND_CONFIG.tiers.map((tier) => (
    tier.rewards.find((reward) => reward.kind === 'spirit-root')?.quantity
  )), [10, 18, 25, 35, 45, 60]);

  assert.equal(getFactionFarmMatureYieldMultiplier('human'), 1.05);
  assert.equal(Math.round(200 * getFactionFarmMatureYieldMultiplier('human')), 210);
  assert.equal(getFactionFarmMatureYieldMultiplier('immortal'), 1);

  assert.equal(getFactionFarmCollectWindowSeconds(1800, 600, 'human'), 2760);
  assert.equal(getFactionFarmCollectWindowSeconds(900, 600, 'human'), 1680);
  assert.equal(getFactionFarmCollectWindowSeconds(1800, 600, 'immortal'), 2400);

  assert.equal(applyFactionSpiritPassiveExpBonus(5000, 'immortal'), 5500);
  assert.equal(applyFactionSpiritPassiveExpBonus(500, 'immortal'), 550);
  assert.equal(getFactionBattleAttackMultiplier('demon'), 1.05);
  assert.equal(getFactionBattleAttackMultiplier('human'), 1);
  assert.equal(applyFactionBattlePostRecovery(40, 100, 'demon'), 52);
  assert.equal(applyFactionBattlePostRecovery(40, 100, 'human'), 40);

  runWithFactionAdvantageRuleSet('v0.2', () => {
    assert.equal(getFactionFarmMatureYieldMultiplier('human'), 1.1);
    assert.equal(getFactionFarmMatureSeconds(10800, 'demon'), 9720);
    assert.equal(applyFactionFarmHarvestSpiritRootBonus(10, 'immortal'), 11);

    assert.equal(applyFactionSpiritPassiveExpBonus(5000, 'immortal'), 5500);
    assert.equal(applyFactionSpiritTraitRollGoldCost(500, 'human'), 450);
    assert.equal(applyFactionSpiritBreakthroughSoulCost(12, 'demon'), 11);
    assert.equal(applyFactionSpiritBreakthroughSoulCost(5, 'demon'), 5);

    assert.equal(getFactionBattleAttackMultiplier('demon'), 1);
    assert.equal(getFactionBattleAttackMultiplier('demon', { isRaidAttack: true }), 1.06);
    assert.equal(applyFactionBattlePostRecovery(40, 100, 'demon'), 40);
    assert.equal(applyFactionRaidDefenseLootLossReduction(100, 'human'), 80);
    assert.equal(getFactionBattleDefenseMainSpiritMaxHpMultiplier('immortal'), 1.05);
  });

  runWithFactionAdvantageRuleSet('none', () => {
    assert.equal(getFactionFarmMatureYieldMultiplier('human'), 1);
    assert.equal(getFactionFarmCollectWindowSeconds(1800, 600, 'human'), 2400);
    assert.equal(applyFactionSpiritPassiveExpBonus(5000, 'immortal'), 5000);
    assert.equal(getFactionBattleAttackMultiplier('demon'), 1);
    assert.equal(applyFactionBattlePostRecovery(40, 100, 'demon'), 40);
  });

  console.log('verify:faction-advantages passed');
}

main();
