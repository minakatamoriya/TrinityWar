import type { SeedCatalogItem } from '../config/seedCatalog';
import { SeedRewardModal } from '../ui/common/SeedRewardModal';
import type { SeedRewardModalState } from './appStateTypes';

interface SeedRewardModalHostProps {
  modal: SeedRewardModalState | null;
  notificationActionId: string | null;
  pendingActionKey: string | null;
  seedCatalogMap: Map<string, SeedCatalogItem>;
  onClear: () => void;
  onClaimFactionStipend: () => void;
  onClaimNotification: () => void;
  onClaimStarterSeeds: () => void;
  onRunAfterConfirmActions: () => void;
}

export function SeedRewardModalHost(props: SeedRewardModalHostProps): JSX.Element | null {
  const {
    modal,
    notificationActionId,
    pendingActionKey,
    seedCatalogMap,
    onClear,
    onClaimFactionStipend,
    onClaimNotification,
    onClaimStarterSeeds,
    onRunAfterConfirmActions,
  } = props;

  if (!modal) {
    return null;
  }

  return (
    <SeedRewardModal
      confirming={
        pendingActionKey === 'faction:stipend'
        || pendingActionKey === 'spirit:ad-reward'
        || pendingActionKey === 'tutorial:starter-seeds'
        || (modal.confirmAction === 'claim-notification' && notificationActionId === `claim:${modal.notificationId}`)
      }
      getItemLabel={(item) => {
        const seed = item.seedId ? seedCatalogMap.get(item.seedId) : undefined;
        if (modal.confirmAction === 'claim-faction-stipend' && seed) {
          return `${seed.name}精华`;
        }
        return seed?.name ?? item.label ?? item.itemId ?? item.seedId ?? '奖励';
      }}
      items={modal.items}
      onConfirm={() => {
        if (modal.confirmAction === 'claim-faction-stipend') {
          onClaimFactionStipend();
          return;
        }
        if (modal.confirmAction === 'claim-starter-seeds') {
          onClaimStarterSeeds();
          return;
        }
        if (modal.confirmAction === 'claim-notification') {
          onClaimNotification();
          return;
        }

        onClear();
        onRunAfterConfirmActions();
      }}
      summary={modal.summary}
      title={modal.title}
    />
  );
}
