import { CLIENT_SPIRIT_TRAIT_ROLL_RULES, type ClientSpiritActiveRollMode, type ClientSpiritTraitCode, type ClientSpiritTraitRollCandidate } from '@trinitywar/shared';

export const SPIRIT_TRAIT_DEFINITIONS: Array<{ code: ClientSpiritTraitCode; label: string; value: number; description: string }> = [
  { code: 'claw', label: '利爪', value: 10, description: '攻击 +10%' },
  { code: 'thick_skin', label: '厚皮', value: 10, description: '生命 +10%' },
  { code: 'crit', label: '暴击', value: 6, description: '暴击率 +6%' },
  { code: 'crit_damage', label: '爆伤', value: 20, description: '暴击伤害 +20%' },
  { code: 'dodge', label: '闪避', value: 5, description: '闪避率 +5%' },
  { code: 'counter', label: '反击', value: 10, description: '受击 +10% 概率反击，造成 50% 伤害' },
  { code: 'lifesteal', label: '吸血', value: 10, description: '造成伤害的 10% 回复自身' },
  { code: 'tenacity', label: '韧性', value: 10, description: '受暴击时伤害降低 10%' },
];

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
  const definition = SPIRIT_TRAIT_DEFINITIONS.find((trait) => trait.code === code);
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
