import type {
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
