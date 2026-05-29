import assert from 'node:assert/strict';
import {
  applyFactionBattlePostRecovery,
  applyFactionSpiritPassiveExpBonus,
  getFactionBattleAttackMultiplier,
  getFactionFarmMatureYieldMultiplier,
  getFactionFarmCollectWindowSeconds,
  getFactionSpiritFeedDurationSeconds,
} from '../lib/faction-advantage-formulas.js';

function main(): void {
  assert.equal(getFactionFarmMatureYieldMultiplier('human'), 1.05);
  assert.equal(Math.round(200 * getFactionFarmMatureYieldMultiplier('human')), 210);
  assert.equal(getFactionFarmMatureYieldMultiplier('immortal'), 1);

  assert.equal(getFactionFarmCollectWindowSeconds(1800, 600, 'human'), 2760);
  assert.equal(getFactionFarmCollectWindowSeconds(900, 600, 'human'), 1680);
  assert.equal(getFactionFarmCollectWindowSeconds(1800, 600, 'immortal'), 2400);

  assert.equal(applyFactionSpiritPassiveExpBonus(5000, 'immortal'), 5500);
  assert.equal(applyFactionSpiritPassiveExpBonus(500, 'immortal'), 550);
  assert.equal(getFactionSpiritFeedDurationSeconds(2 * 60 * 60, 'immortal'), 9000);
  assert.equal(getFactionSpiritFeedDurationSeconds(2 * 60 * 60, 'human'), 7200);

  assert.equal(getFactionBattleAttackMultiplier('demon'), 1.05);
  assert.equal(getFactionBattleAttackMultiplier('human'), 1);
  assert.equal(applyFactionBattlePostRecovery(40, 100, 'demon'), 52);
  assert.equal(applyFactionBattlePostRecovery(40, 100, 'human'), 40);

  console.log('verify:faction-advantages passed');
}

main();
