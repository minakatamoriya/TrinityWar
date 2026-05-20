import { createContext, useContext, type ReactNode } from 'react';
import { CharacterDialog } from '../ui/common/CharacterDialog';
import type { CharacterDialogController } from './useCharacterDialog';

const CharacterDialogContext = createContext<CharacterDialogController | null>(null);

interface CharacterDialogProviderProps {
  controller: CharacterDialogController;
  portalTarget?: HTMLElement | null;
  children: ReactNode;
}

export function CharacterDialogProvider({ controller, portalTarget, children }: CharacterDialogProviderProps): JSX.Element {
  return (
    <CharacterDialogContext.Provider value={controller}>
      {children}
      <CharacterDialog
        dialog={controller.activeDialog}
        onAdvance={controller.advanceDialog}
        onClose={controller.closeDialog}
        portalTarget={portalTarget}
      />
    </CharacterDialogContext.Provider>
  );
}

export function useCharacterDialogController(): CharacterDialogController {
  const controller = useContext(CharacterDialogContext);

  if (!controller) {
    throw new Error('useCharacterDialogController must be used within CharacterDialogProvider.');
  }

  return controller;
}
