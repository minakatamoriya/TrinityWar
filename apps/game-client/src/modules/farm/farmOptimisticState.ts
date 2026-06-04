import type { ClientFarmField } from '@trinitywar/shared';

export type FarmOptimisticMutation =
  | {
    id: string;
    kind: 'collect-field';
    fieldId: string;
    fieldCode: string;
    estimatedGold: number;
    submittedAt: number;
  };

export function createCollectFieldOptimisticMutation(field: ClientFarmField): FarmOptimisticMutation {
  return {
    id: `collect-field:${field.id}:${Date.now()}`,
    kind: 'collect-field',
    fieldId: field.id,
    fieldCode: field.code,
    estimatedGold: field.yieldGold,
    submittedAt: Date.now(),
  };
}

export function applyFarmOptimisticMutations(
  fields: ClientFarmField[],
  mutations: FarmOptimisticMutation[],
): ClientFarmField[] {
  if (mutations.length <= 0) {
    return fields;
  }

  const collectedFieldIds = new Set(
    mutations
      .filter((mutation) => mutation.kind === 'collect-field')
      .map((mutation) => mutation.fieldId),
  );

  if (collectedFieldIds.size <= 0) {
    return fields;
  }

  return fields.map((field) => {
    if (!collectedFieldIds.has(field.id)) {
      return field;
    }

    return {
      ...field,
      title: '收取中',
      badge: '收取',
      cropName: undefined,
      tone: 'empty',
      progressRemainingSeconds: 0,
      progressTotalSeconds: 1,
      yieldGold: 0,
      description: '正在确认收取结果，确认后即可安排下一轮培育。',
      actions: [],
    };
  });
}

export function removeFarmOptimisticMutation(
  mutations: FarmOptimisticMutation[],
  mutationId: string,
): FarmOptimisticMutation[] {
  return mutations.filter((mutation) => mutation.id !== mutationId);
}
