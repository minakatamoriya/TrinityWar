import { FarmBoardEditorModal } from '../ui/common/FarmBoardEditorModal';
import { SeedSelectionScreen } from '../ui/scenes/SeedSelectionScreen';
import type { SeedViewGroup } from '../modules/farm/seedPresentation';
import type { FarmBoardEditorState, SeedSelectionState } from './appStateTypes';

interface FarmModalLayerProps {
  farmBoardEditor: FarmBoardEditorState | null;
  pendingActionKey: string | null;
  seedGroups: SeedViewGroup[];
  seedSelectionState: SeedSelectionState | null;
  selectedSeedId: string | null;
  onChangeFarmBoardMessage: (message: string) => void;
  onCloseFarmBoardEditor: () => void;
  onCloseSeedSelection: () => void;
  onConfirmSeedCultivation: () => void;
  onConfirmSeedCultivationAll: () => void;
  onSelectSeed: (seedId: string) => void;
}

export function FarmModalLayer(props: FarmModalLayerProps): JSX.Element {
  const {
    farmBoardEditor,
    pendingActionKey,
    seedGroups,
    seedSelectionState,
    selectedSeedId,
    onChangeFarmBoardMessage,
    onCloseFarmBoardEditor,
    onCloseSeedSelection,
    onConfirmSeedCultivation,
    onConfirmSeedCultivationAll,
    onSelectSeed,
  } = props;

  return (
    <>
      {seedSelectionState ? (
        <SeedSelectionScreen
          availableFieldCount={seedSelectionState.availableFields.length}
          confirming={pendingActionKey === `farm:${seedSelectionState.fieldId}:开始培育`}
          confirmingAll={pendingActionKey === 'farm:batch-start-cultivation'}
          fieldCode={seedSelectionState.fieldCode}
          onClose={onCloseSeedSelection}
          onConfirm={onConfirmSeedCultivation}
          onConfirmAll={onConfirmSeedCultivationAll}
          onSelect={onSelectSeed}
          seedGroups={seedGroups}
          selectedSeedId={selectedSeedId}
        />
      ) : null}
      {farmBoardEditor ? (
        <FarmBoardEditorModal
          message={farmBoardEditor.message}
          onChangeMessage={onChangeFarmBoardMessage}
          onClose={onCloseFarmBoardEditor}
          saving={farmBoardEditor.saving}
        />
      ) : null}
    </>
  );
}
