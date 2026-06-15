import type {
  ClientSpiritCodexEntry,
  ClientSpiritElement,
  ClientSpiritState,
} from '@trinitywar/shared';
import type { TutorialFlowAction } from '../../tutorial/tutorialFlow';
import type { GlobalUnlockModalState } from '../../shell/appStateTypes';

const spiritElementLabels: Record<ClientSpiritElement, string> = {
  earth: '土',
  fire: '火',
  metal: '金',
  water: '水',
  wood: '木',
};

export function buildSpiritComposeUnlockModal(input: {
  afterConfirmActions: TutorialFlowAction[];
  element: ClientSpiritElement;
  slotIndex: number;
  spirit: ClientSpiritState;
  spiritId: string;
}): GlobalUnlockModalState {
  const composedSlot = input.spirit.slots.find((slot) => slot.slotIndex === input.slotIndex);
  const composedEntry = input.spirit.codex.find((entry) => entry.spiritId === input.spiritId);
  const spiritLabel = composedEntry?.definition.label ?? input.spirit.mainSlot?.spiritId ?? '首只灵宠';

  return {
    title: '灵宠已结契',
    summary: `你获得了${spiritElementLabels[input.element]}属性灵宠 ${spiritLabel}。`,
    items: [{
      id: input.spiritId,
      label: composedEntry?.definition.label ?? '第一只灵宠',
      kind: 'spirit',
      description: composedSlot?.isMain ? '已入主位' : '已结契',
    }],
    afterConfirmActions: input.afterConfirmActions,
  };
}

export function buildSpiritCodexVisibleUnlockModal(input: {
  spirit: ClientSpiritState;
  spiritId: string;
}): GlobalUnlockModalState | null {
  const codexEntry = input.spirit.codex.find((entry) => entry.spiritId === input.spiritId);
  if (!codexEntry) {
    return null;
  }

  const progressText = formatSpiritCodexRevealProgress(codexEntry);

  return {
    title: '灵宠图鉴已可见',
    summary: `你已首次获得 ${codexEntry.definition.label} 精魄，现在可以在图鉴和合成栏中查看这只灵宠的真实信息与收集进度。`,
    completionKind: 'spirit-codex-visible',
    subjectId: codexEntry.spiritId,
    items: [{
      id: codexEntry.spiritId,
      label: codexEntry.definition.label,
      kind: 'spirit',
      description: progressText,
    }],
  };
}

function formatSpiritCodexRevealProgress(entry: ClientSpiritCodexEntry): string {
  const required = Math.max(entry.definition.shardUnlockRequired, 0);
  const current = Math.min(Math.max(entry.shardCount, 0), required);

  if (entry.readyToCompose) {
    return '已满足合成条件';
  }

  return `当前精魄 ${current}/${required}`;
}
