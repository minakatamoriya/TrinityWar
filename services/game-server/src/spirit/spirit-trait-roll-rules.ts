import {
  CLIENT_SPIRIT_TRAIT_ROLL_RULES,
  LEGACY_SPIRIT_BATTLE_TRAIT_DEFINITIONS,
  SPIRIT_BATTLE_TRAIT_DEFINITIONS,
  type ClientSpiritActiveRollMode,
  type ClientSpiritTraitCode,
  type ClientSpiritTraitRollCandidate,
} from '@trinitywar/shared';

export const SPIRIT_TRAIT_DEFINITIONS = SPIRIT_BATTLE_TRAIT_DEFINITIONS;
const LEGACY_TRAIT_DEFINITIONS = LEGACY_SPIRIT_BATTLE_TRAIT_DEFINITIONS;

export const SPIRIT_TRAIT_ROLL_RULES: Record<ClientSpiritActiveRollMode, {
  candidateCount: number;
  unlockBreakthroughStage: number;
  cost: { marrow: number; jade: number; gold: number };
}> = {
  basic: {
    candidateCount: CLIENT_SPIRIT_TRAIT_ROLL_RULES.basic.candidateCount,
    unlockBreakthroughStage: CLIENT_SPIRIT_TRAIT_ROLL_RULES.basic.unlockBreakthroughStage,
    cost: CLIENT_SPIRIT_TRAIT_ROLL_RULES.basic.cost,
  },
  normal: {
    candidateCount: CLIENT_SPIRIT_TRAIT_ROLL_RULES.normal.candidateCount,
    unlockBreakthroughStage: CLIENT_SPIRIT_TRAIT_ROLL_RULES.normal.unlockBreakthroughStage,
    cost: CLIENT_SPIRIT_TRAIT_ROLL_RULES.normal.cost,
  },
  advanced: {
    candidateCount: CLIENT_SPIRIT_TRAIT_ROLL_RULES.advanced.candidateCount,
    unlockBreakthroughStage: CLIENT_SPIRIT_TRAIT_ROLL_RULES.advanced.unlockBreakthroughStage,
    cost: CLIENT_SPIRIT_TRAIT_ROLL_RULES.advanced.cost,
  },
};

const ADVANCED_TRAIT_CODES = new Set<ClientSpiritTraitCode>(SPIRIT_TRAIT_DEFINITIONS.map((definition) => definition.code));

export function isActiveTraitRollMode(mode: string): mode is ClientSpiritActiveRollMode {
  return mode === 'basic' || mode === 'normal' || mode === 'advanced';
}

export function getTraitDefinition(code: string) {
  const definition = [...SPIRIT_TRAIT_DEFINITIONS, ...LEGACY_TRAIT_DEFINITIONS].find((trait) => trait.code === code);
  if (!definition) {
    return SPIRIT_TRAIT_DEFINITIONS[0];
  }
  return definition;
}

export function assertKnownTraitCode(code: string, throwBadRequest: (message: string) => never): void {
  if (!SPIRIT_TRAIT_DEFINITIONS.some((trait) => trait.code === code)) {
    throwBadRequest('Unknown trait code.');
  }
}

export function toTraitRollCandidate(code: string): ClientSpiritTraitRollCandidate {
  const definition = getTraitDefinition(code);
  return {
    candidateId: definition.code,
    traitCode: definition.code,
    label: definition.label,
    description: definition.description,
    value: definition.value,
  };
}

export function rollTraitCandidates(
  mode: ClientSpiritActiveRollMode,
  currentTraitCode: string | null,
  excludeCandidateIds: string[] = [],
): ClientSpiritTraitRollCandidate[] {
  const rule = SPIRIT_TRAIT_ROLL_RULES[mode];
  const excludedTraitCodes = new Set(
    excludeCandidateIds.map((candidateId) => getTraitDefinition(candidateId).code),
  );
  const basePool = SPIRIT_TRAIT_DEFINITIONS.filter((definition) => definition.code !== currentTraitCode && !excludedTraitCodes.has(definition.code));
  const candidatePool = mode === 'advanced'
    ? basePool.filter((definition) => ADVANCED_TRAIT_CODES.has(definition.code))
    : basePool;
  const shuffled = shuffleTraitDefinitions(candidatePool);

  return shuffled.slice(0, Math.min(rule.candidateCount, shuffled.length)).map((definition) => toTraitRollCandidate(definition.code));
}

function shuffleTraitDefinitions<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function rollFullRandomTraits(unlockedSlots: number): Array<{ slotIndex: number; traitCode: ClientSpiritTraitCode }> {
  const result: Array<{ slotIndex: number; traitCode: ClientSpiritTraitCode }> = [];
  for (let slotIndex = 1; slotIndex <= unlockedSlots; slotIndex += 1) {
    const definition = SPIRIT_TRAIT_DEFINITIONS[Math.floor(Math.random() * SPIRIT_TRAIT_DEFINITIONS.length)] ?? SPIRIT_TRAIT_DEFINITIONS[0];
    result.push({ slotIndex, traitCode: definition.code });
  }
  return result;
}
