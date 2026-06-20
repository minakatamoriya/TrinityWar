import {
  DEFAULT_SPIRIT_COLLISION_BATTLE_CONFIG,
  SPIRIT_BATTLE_INNATE_RULES,
  SPIRIT_BATTLE_TRAIT_DEFINITIONS,
  buildSpiritCollisionBattleReplay,
  type ClientRaidBattleReplay,
  type ClientRaidBattleStep,
  type ClientSpiritElement,
  type SpiritBattleTraitCode,
  type SpiritCollisionTraitInput,
  type SpiritCollisionUnitInput,
} from '@trinitywar/shared';

interface UnitOptions {
  side: 'attacker' | 'defender';
  spiritId?: string | null;
  name?: string;
  attack?: number;
  maxHp?: number;
  element?: ClientSpiritElement | null;
  traits?: SpiritCollisionTraitInput[];
}

const trait = (code: string, label: string, value: number): SpiritCollisionTraitInput => ({ code, label, value });
const officialTrait = (code: string): SpiritCollisionTraitInput => {
  const definition = SPIRIT_BATTLE_TRAIT_DEFINITIONS.find((item) => item.code === code);
  assert(definition, `Missing official trait definition: ${code}`);
  return trait(definition.code, definition.label, definition.value);
};
const stackedTrait = (code: string, count: number): SpiritCollisionTraitInput[] => Array.from({ length: count }, () => officialTrait(code));

function main(): void {
  verifyTraitDefinitions();
  verifyBaseStatTraits();
  verifyCombatTraits();
  verifyBloodTraits();
  verifyInnateRules();

  console.log('Spirit battle rule verification passed.');
}

function verifyTraitDefinitions(): void {
  assert(SPIRIT_BATTLE_TRAIT_DEFINITIONS.length === 15, `Expected 15 active traits, got ${SPIRIT_BATTLE_TRAIT_DEFINITIONS.length}.`);
  const codes = new Set(SPIRIT_BATTLE_TRAIT_DEFINITIONS.map((definition) => definition.code));
  const expectedCodes: SpiritBattleTraitCode[] = [
    'claw',
    'thick_skin',
    'crit',
    'crit_damage',
    'dodge',
    'lifesteal',
    'last_stand',
    'harvest',
    'blood_breaker',
    'disruption',
    'suppress',
    'wound',
    'blaze',
    'sharp_blade',
    'iron_bone',
  ];
  for (const code of expectedCodes) {
    assert(codes.has(code), `Trait pool is missing ${code}.`);
  }
}

function verifyBaseStatTraits(): void {
  assertSnapshotStats('claw x1', [officialTrait('claw')], { attack: 1120, maxHp: 10000 });
  assertSnapshotStats('claw x5', stackedTrait('claw', 5), { attack: 1600, maxHp: 10000 });
  assertSnapshotStats('thick_skin x1', [officialTrait('thick_skin')], { attack: 1000, maxHp: 11200 });
  assertSnapshotStats('thick_skin x5', stackedTrait('thick_skin', 5), { attack: 1000, maxHp: 16000 });
  assertSnapshotStats('sharp_blade', [officialTrait('sharp_blade')], { attack: 1300, maxHp: 9000 });
  assertSnapshotStats('iron_bone', [officialTrait('iron_bone')], { attack: 900, maxHp: 13000 });
}

function verifyCombatTraits(): void {
  const base = damageToDefender(replay({
    attacker: unit({ side: 'attacker', attack: 1000, maxHp: 10000 }),
    defender: unit({ side: 'defender', attack: 0, maxHp: 10000 }),
  }));

  const wound = damageToDefender(replay({
    attacker: unit({ side: 'attacker', attack: 1000, maxHp: 10000, traits: [officialTrait('wound')] }),
    defender: unit({ side: 'defender', attack: 0, maxHp: 10000 }),
  }));
  assert(wound > base, `wound should increase damage. base=${base}, wound=${wound}`);

  const suppressed = damageToDefender(replay({
    attacker: unit({ side: 'attacker', attack: 1000, maxHp: 10000 }),
    defender: unit({ side: 'defender', attack: 0, maxHp: 10000, traits: [officialTrait('suppress')] }),
  }));
  assert(suppressed < base, `suppress should reduce incoming attack damage. base=${base}, suppressed=${suppressed}`);

  const bloodBreakerInactive = damageToDefender(replay({
    attacker: unit({ side: 'attacker', attack: 1000, maxHp: 10000, traits: [officialTrait('blood_breaker')] }),
    defender: unit({ side: 'defender', attack: 0, maxHp: 10000 }),
  }));
  const bloodBreakerActive = damageToDefender(replay({
    attacker: unit({ side: 'attacker', attack: 1000, maxHp: 10000, traits: [officialTrait('blood_breaker')] }),
    defender: unit({ side: 'defender', attack: 0, maxHp: 15000 }),
  }));
  assert(bloodBreakerInactive === base, `blood_breaker should not trigger against equal maxHp. base=${base}, got=${bloodBreakerInactive}`);
  assert(bloodBreakerActive > base, `blood_breaker should trigger against higher maxHp target. base=${base}, got=${bloodBreakerActive}`);

  const harvestInactive = damageToDefender(replay({
    attacker: unit({ side: 'attacker', attack: 450, maxHp: 10000, traits: [officialTrait('harvest')] }),
    defender: unit({ side: 'defender', attack: 0, maxHp: 10000 }),
    seed: 40,
  }), 1);
  const harvestActiveReplay = replay({
    attacker: unit({ side: 'attacker', attack: 3000, maxHp: 10000, traits: [officialTrait('harvest')] }),
    defender: unit({ side: 'defender', attack: 0, maxHp: 10000 }),
    seed: 40,
  });
  assert(hasTraitEvent(harvestActiveReplay, '收割'), 'harvest should trigger after target is below 50% hp.');
  assert(damageToDefender(harvestActiveReplay, 2) > harvestInactive, 'harvest round 2 damage should be higher after target is low.');

  const lastStandReplay = replay({
    attacker: unit({ side: 'attacker', attack: 450, maxHp: 10000, traits: [officialTrait('last_stand')] }),
    defender: unit({ side: 'defender', attack: 6000, maxHp: 10000 }),
    seed: 44,
  });
  assert(hasTraitEvent(lastStandReplay, '背水'), 'last_stand should trigger after self hp is below 50%.');

  const critReplay = replay({
    attacker: unit({ side: 'attacker', attack: 1000, maxHp: 10000, traits: [trait('crit', '暴击', 100)] }),
    defender: unit({ side: 'defender', attack: 0, maxHp: 10000 }),
  });
  assert(critReplay.events.some((event) => event.type === 'critical'), 'crit should be able to force critical when chance reaches 100%.');

  const critDamage = damageToDefender(replay({
    attacker: unit({ side: 'attacker', attack: 1000, maxHp: 10000, traits: [trait('crit', '暴击', 100), officialTrait('crit_damage')] }),
    defender: unit({ side: 'defender', attack: 0, maxHp: 10000 }),
  }));
  const critOnly = damageToDefender(critReplay);
  assert(critDamage > critOnly, `crit_damage should increase critical damage. critOnly=${critOnly}, critDamage=${critDamage}`);

  const dodgeReplay = replay({
    attacker: unit({ side: 'attacker', attack: 1000, maxHp: 10000 }),
    defender: unit({ side: 'defender', attack: 0, maxHp: 10000, traits: [trait('dodge', '闪避', 100)] }),
  });
  assert(damageToDefender(dodgeReplay) === 0, 'dodge at capped chance with deterministic seed should avoid damage.');
  assert(dodgeReplay.events.some((event) => event.type === 'dodge'), 'dodge should produce a dodge event.');

  const lifestealReplay = replay({
    attacker: unit({ side: 'attacker', attack: 0, maxHp: 10000 }),
    defender: unit({ side: 'defender', attack: 1000, maxHp: 10000, traits: [officialTrait('lifesteal')] }),
    seed: 55,
  });
  assert(damageToAttacker(lifestealReplay) > 0, 'lifesteal control scenario should damage attacker.');
  assert(healingForSide(lifestealReplay, 'defender') > 0, 'lifesteal should heal the damage dealer.');

  const disruptedReplay = replay({
    attacker: unit({ side: 'attacker', attack: 0, maxHp: 10000, traits: [officialTrait('disruption')] }),
    defender: unit({ side: 'defender', attack: 1000, maxHp: 10000, traits: [officialTrait('lifesteal')] }),
    seed: 55,
  });
  assert(healingForSide(disruptedReplay, 'defender') < healingForSide(lifestealReplay, 'defender'), 'disruption should reduce target healing.');

  const strongElement = damageToDefender(replay({
    attacker: unit({ side: 'attacker', attack: 1000, maxHp: 10000, element: 'fire' }),
    defender: unit({ side: 'defender', attack: 0, maxHp: 10000, element: 'metal' }),
  }));
  const weakElement = damageToDefender(replay({
    attacker: unit({ side: 'attacker', attack: 1000, maxHp: 10000, element: 'metal' }),
    defender: unit({ side: 'defender', attack: 0, maxHp: 10000, element: 'fire' }),
  }));
  assert(strongElement > base, `element advantage should increase final damage. base=${base}, strong=${strongElement}`);
  assert(weakElement < base, `element disadvantage should reduce final damage. base=${base}, weak=${weakElement}`);
}

function verifyBloodTraits(): void {
  const base = replay({
    attacker: unit({ side: 'attacker', attack: 0, maxHp: 10000 }),
    defender: unit({ side: 'defender', attack: 0, maxHp: 10000 }),
    config: { maxRounds: 1 },
  });
  const blaze = replay({
    attacker: unit({ side: 'attacker', attack: 0, maxHp: 10000, traits: [officialTrait('blaze')] }),
    defender: unit({ side: 'defender', attack: 0, maxHp: 10000 }),
    config: { maxRounds: 1 },
  });
  assert(firstBloodLoss(base, 'defender') === 800, `base first blood loss should be 8% of 10000.`);
  assert(firstBloodLoss(blaze, 'defender') === 1100, `blaze should add 3% maxHp blood loss to target.`);

  const shuanghu = replay({
    attacker: unit({ side: 'attacker', attack: 0, maxHp: 10000, spiritId: 'shuanghu' }),
    defender: unit({ side: 'defender', attack: 0, maxHp: 10000 }),
    config: { maxRounds: 1 },
  });
  const xuanshe = replay({
    attacker: unit({ side: 'attacker', attack: 0, maxHp: 10000, spiritId: 'xuangui' }),
    defender: unit({ side: 'defender', attack: 0, maxHp: 10000 }),
    config: { maxRounds: 1 },
  });
  assert(firstBloodLoss(shuanghu, 'attacker') === 500, 'shuanghu should reduce first blood loss from 8% to 5%.');
  assert(firstBloodLoss(xuanshe, 'attacker') === 400, 'xuangui should reduce first blood loss from 8% to 4%.');
}

function verifyInnateRules(): void {
  assert(Object.keys(SPIRIT_BATTLE_INNATE_RULES).length === 18, `Expected 18 innate spirit rule entries.`);
  const expectedSpiritIds = [
    'canglang',
    'xuanhu',
    'linglu',
    'qingyuan',
    'hegui',
    'shuanghu',
    'yingbao',
    'yundiao',
    'shanxiong',
    'chenghuang',
    'guishou',
    'xuangui',
    'taowu',
    'dangchang',
    'zhuyan',
    'fenghuang',
    'xueyan',
    'yinglong',
  ];
  for (const spiritId of expectedSpiritIds) {
    assert((SPIRIT_BATTLE_INNATE_RULES[spiritId] ?? []).length > 0, `Missing innate rule for ${spiritId}.`);
  }

  assertInnateTraitEvent('canglang', '先扑', { attackerAttack: 1000, defenderAttack: 0 });
  assertInnateTraitEvent('xuanhu', '追猎', { attackerAttack: 3000, defenderAttack: 0 });
  assertFixedHeal('linglu', '回春', 3);
  assertInnateTraitEvent('qingyuan', '背水', { attackerAttack: 450, defenderAttack: 6000 });
  assertInnateTraitEvent('hegui', '厚甲', { attackerSpirit: 'canglang', defenderSpirit: 'hegui', attackerAttack: 1000, defenderAttack: 0 });
  assertInnateTraitEvent('yingbao', '收割', { attackerAttack: 3000, defenderAttack: 0 });
  assertInnateTraitEvent('yundiao', '暴起', { attackerAttack: 1000, defenderAttack: 0, extraTraits: [trait('crit', '暴击', 85)] });
  assertInnateTraitEvent('shanxiong', '残守', { attackerSpirit: 'canglang', defenderSpirit: 'shanxiong', attackerAttack: 6000, defenderAttack: 0 });
  assertFixedHeal('chenghuang', '稳步', 2);
  assertInnateTraitEvent('guishou', '逆势', { attackerAttack: 1000, defenderAttack: 0, attackerMaxHp: 10000, defenderMaxHp: 20000 });
  assertInnateTraitEvent('xuangui', '玄息', { attackerSpirit: 'canglang', defenderSpirit: 'xuangui', attackerAttack: 1000, defenderAttack: 0, config: { maxRounds: 1 } });
  assertInnateTraitEvent('taowu', '后凶', { attackerAttack: 1000, defenderAttack: 0, config: { maxRounds: 4 } });
  assertSnapshotStats('dangchang innate maxHp', [], { attack: 1000, maxHp: 11000 }, 'dangchang');
  assertInnateTraitEvent('zhuyan', '破血', { attackerAttack: 1000, defenderAttack: 0, attackerMaxHp: 10000, defenderMaxHp: 20000 });
  assertFixedHeal('fenghuang', '不熄', 3);
  assertInnateTraitEvent('xueyan', '血猎', { attackerAttack: 1000, defenderAttack: 0 });
  assertSnapshotStats('yinglong innate maxHp', [], { attack: 1000, maxHp: 11200 }, 'yinglong');
  assertInnateTraitEvent('yinglong', '镇场', { attackerAttack: 450, defenderAttack: 6000 });
}

function assertSnapshotStats(
  name: string,
  traits: SpiritCollisionTraitInput[],
  expected: { attack: number; maxHp: number },
  spiritId: string | null = null,
): void {
  const result = replay({
    attacker: unit({ side: 'attacker', spiritId, attack: 1000, maxHp: 10000, traits }),
    defender: unit({ side: 'defender', attack: 0, maxHp: 10000 }),
  });
  assert(result.attacker.attack === expected.attack, `${name}: expected attack ${expected.attack}, got ${result.attacker.attack}.`);
  assert(result.attacker.maxHp === expected.maxHp, `${name}: expected maxHp ${expected.maxHp}, got ${result.attacker.maxHp}.`);
}

function assertFixedHeal(spiritId: string, label: string, round: number): void {
  const result = replay({
    attacker: unit({ side: 'attacker', spiritId, attack: 0, maxHp: 10000 }),
    defender: unit({ side: 'defender', attack: 0, maxHp: 10000 }),
    config: { maxRounds: Math.max(round, 3) },
  });
  assert(hasTraitEvent(result, label), `${spiritId} should trigger fixed heal label ${label}.`);
}

function assertInnateTraitEvent(spiritId: string, label: string, options: {
  attackerSpirit?: string;
  defenderSpirit?: string;
  attackerAttack: number;
  defenderAttack: number;
  attackerMaxHp?: number;
  defenderMaxHp?: number;
  extraTraits?: SpiritCollisionTraitInput[];
  config?: Partial<typeof DEFAULT_SPIRIT_COLLISION_BATTLE_CONFIG>;
}): void {
  const attackerSpirit = options.attackerSpirit ?? spiritId;
  const defenderSpirit = options.defenderSpirit ?? null;
  const result = replay({
    attacker: unit({
      side: 'attacker',
      spiritId: attackerSpirit,
      attack: options.attackerAttack,
      maxHp: options.attackerMaxHp ?? 10000,
      traits: options.extraTraits,
    }),
    defender: unit({
      side: 'defender',
      spiritId: defenderSpirit,
      attack: options.defenderAttack,
      maxHp: options.defenderMaxHp ?? 10000,
    }),
    config: options.config,
    seed: 70,
  });
  assert(hasTraitEvent(result, label), `${spiritId} should trigger innate label ${label}.`);
}

function replay(input: {
  attacker: SpiritCollisionUnitInput;
  defender: SpiritCollisionUnitInput;
  seed?: number;
  config?: Partial<typeof DEFAULT_SPIRIT_COLLISION_BATTLE_CONFIG>;
}): ClientRaidBattleReplay {
  return buildSpiritCollisionBattleReplay({
    orderId: 'verify-spirit-battle-rules',
    attacker: input.attacker,
    defender: input.defender,
    seed: input.seed ?? 11,
    config: {
      ...input.config,
      baseStealRatio: 0,
      attackerWinBonus: 0,
      defenderLostHpStealFactor: 0,
    },
    goldPool: 10000,
  });
}

function unit(options: UnitOptions): SpiritCollisionUnitInput {
  return {
    side: options.side,
    playerName: options.side === 'attacker' ? 'Verifier A' : 'Verifier D',
    spiritId: options.spiritId ?? null,
    spiritName: options.name ?? options.spiritId ?? options.side,
    rarity: 'common',
    element: options.element ?? null,
    level: 1,
    attack: options.attack ?? 1000,
    maxHp: options.maxHp ?? 10000,
    traits: options.traits,
  };
}

function damageToDefender(result: ClientRaidBattleReplay, round = 1): number {
  return hpDelta(result, 'defender', round);
}

function damageToAttacker(result: ClientRaidBattleReplay, round = 1): number {
  return hpDelta(result, 'attacker', round);
}

function hpDelta(result: ClientRaidBattleReplay, side: 'attacker' | 'defender', round: number): number {
  const step = result.steps.find((item): item is Extract<ClientRaidBattleStep, { type: 'hpChange' }> => {
    return item.type === 'hpChange' && item.side === side && item.round === round && item.bloodRound === undefined;
  });
  assert(step, `Missing hpChange step for ${side} round ${round}.`);
  return Math.max(step.from - step.to, 0);
}

function healingForSide(result: ClientRaidBattleReplay, side: 'attacker' | 'defender'): number {
  return result.steps
    .filter((item): item is Extract<ClientRaidBattleStep, { type: 'floatingText' }> => item.type === 'floatingText' && item.side === side && item.tone === 'buff')
    .map((item) => Number(item.text.replace(/^\+/, '')))
    .filter((value) => Number.isFinite(value))
    .reduce((total, value) => total + value, 0);
}

function firstBloodLoss(result: ClientRaidBattleReplay, side: 'attacker' | 'defender'): number {
  const step = result.steps.find((item): item is Extract<ClientRaidBattleStep, { type: 'hpChange' }> => {
    return item.type === 'hpChange' && item.side === side && item.bloodRound === 1;
  });
  assert(step, `Missing first blood hpChange step for ${side}.`);
  return Math.max(step.from - step.to, 0);
}

function hasTraitEvent(result: ClientRaidBattleReplay, label: string): boolean {
  return result.events.some((event) => event.type === 'trait' && event.label.includes(label));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

main();
