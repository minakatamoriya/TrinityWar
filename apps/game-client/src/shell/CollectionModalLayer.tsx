import type { ClientSpiritState } from '@trinitywar/shared';
import type { BackpackResourceItem } from '../ui/common/ResourceBackpackModal';
import { PlantCodexModal } from '../ui/common/PlantCodexModal';
import { ResourceBackpackModal } from '../ui/common/ResourceBackpackModal';
import { SpiritCodexModal } from '../ui/common/SpiritCodexModal';
import type { SeedViewGroup, SeedViewItem } from '../modules/farm/seedPresentation';
import { formatNumber, formatProtectionCountdown } from '../utils/format';
import type { TopResourcePanel } from './appStateTypes';

interface CollectionModalLayerProps {
  backpackResourceItems: BackpackResourceItem[];
  pendingActionKey: string | null;
  seedGroups: SeedViewGroup[];
  selectedSeedCodexItem: SeedViewItem | null;
  spiritStableFull: boolean;
  spiritState: ClientSpiritState | null;
  topResourcePanel: TopResourcePanel | null;
  topSpiritCodexSelectedId: string | null;
  onCloseResourcePanel: () => void;
  onCloseSeedCodex: () => void;
  onSelectPlant: (plantId: string) => void;
  onSelectSpirit: (spiritId: string) => void;
  onUnlockPlant: (plantId: string) => void;
}

export function CollectionModalLayer(props: CollectionModalLayerProps): JSX.Element {
  const {
    backpackResourceItems,
    pendingActionKey,
    seedGroups,
    selectedSeedCodexItem,
    spiritStableFull,
    spiritState,
    topResourcePanel,
    topSpiritCodexSelectedId,
    onCloseResourcePanel,
    onCloseSeedCodex,
    onSelectPlant,
    onSelectSpirit,
    onUnlockPlant,
  } = props;

  return (
    <>
      {selectedSeedCodexItem ? (
        <PlantCodexModal
          formatDuration={formatProtectionCountdown}
          formatNumber={formatNumber}
          groups={seedGroups.map((group) => ({ ...group, plants: group.seeds }))}
          busyPlantId={pendingActionKey?.startsWith('plant-unlock:') ? pendingActionKey.replace('plant-unlock:', '') : null}
          onClose={onCloseSeedCodex}
          onSelectPlant={onSelectPlant}
          onUnlockPlant={onUnlockPlant}
          selectedPlant={selectedSeedCodexItem}
        />
      ) : null}
      {topResourcePanel === 'spirit-codex' && spiritState ? (
        <SpiritCodexModal
          entries={spiritState.codex}
          onClose={onCloseResourcePanel}
          onSelectSpirit={onSelectSpirit}
          selectedSpiritId={topSpiritCodexSelectedId}
          stableFull={spiritStableFull}
        />
      ) : null}
      {topResourcePanel === 'resources' ? (
        <ResourceBackpackModal
          formatNumber={formatNumber}
          items={backpackResourceItems}
          onClose={onCloseResourcePanel}
        />
      ) : null}
    </>
  );
}
