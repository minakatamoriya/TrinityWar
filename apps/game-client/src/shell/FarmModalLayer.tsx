import { SeedSelectionScreen } from '../ui/scenes/SeedSelectionScreen';
import type { SeedViewGroup } from '../modules/farm/seedPresentation';
import type { SeedSelectionState } from './appStateTypes';

interface FarmModalLayerProps {
  pendingActionKey: string | null;
  seedGroups: SeedViewGroup[];
  seedSelectionState: SeedSelectionState | null;
  selectedSeedId: string | null;
  onCloseSeedSelection: () => void;
  onConfirmSeedCultivation: () => void;
  onConfirmSeedCultivationAll: () => void;
  onSelectSeed: (seedId: string) => void;
}

export function FarmModalLayer(props: FarmModalLayerProps): JSX.Element {
  const {
    pendingActionKey,
    seedGroups,
    seedSelectionState,
    selectedSeedId,
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
    </>
  );
}
