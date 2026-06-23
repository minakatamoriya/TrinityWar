import type {
  ClientRaidDeepIntelResponse,
  ClientRaidTarget,
  ClientRaidTargetDetailResponse,
  ClientSceneAction,
  ClientSpiritState,
} from '@trinitywar/shared';
import { RaidIntelScreen } from '../ui/raid/RaidIntelScreen';
import type { RaidTargetModalState } from './appStateTypes';

interface RaidIntelModalHostProps {
  allowDeepIntel: boolean;
  allowFollow: boolean;
  detail: ClientRaidTargetDetailResponse | null;
  error: string | null;
  followedTargetIds: string[];
  friendTargetIds: string[];
  loading: boolean;
  modal: RaidTargetModalState | null;
  pendingAction: boolean;
  raidTargetsById: Map<string, ClientRaidTarget>;
  spiritState: ClientSpiritState | null;
  onAction: (action: ClientSceneAction, context?: string, selectedAttackerSpiritId?: string | null) => void;
  onClose: () => void;
  onRevealDeepIntel: (targetId: string) => Promise<ClientRaidDeepIntelResponse>;
  onToggleFollowTarget: (target: ClientRaidTarget) => void;
}

export function RaidIntelModalHost(props: RaidIntelModalHostProps): JSX.Element | null {
  const {
    allowDeepIntel,
    allowFollow,
    detail,
    error,
    followedTargetIds,
    friendTargetIds,
    loading,
    modal,
    pendingAction,
    raidTargetsById,
    spiritState,
    onAction,
    onClose,
    onRevealDeepIntel,
    onToggleFollowTarget,
  } = props;

  if (!modal) {
    return null;
  }

  const target = raidTargetsById.get(modal.targetId);
  const isFriend = target ? friendTargetIds.includes(target.targetPlayerId) : false;

  return (
    <RaidIntelScreen
      allowDeepIntel={allowDeepIntel}
      allowFollow={allowFollow && !isFriend}
      detail={detail}
      error={error}
      followed={target ? followedTargetIds.includes(target.targetPlayerId) : false}
      friend={isFriend}
      loading={loading}
      mode={modal.mode}
      pendingAction={pendingAction}
      spiritState={spiritState}
      onAction={(action, selectedAttackerSpiritId) => onAction(action, detail?.name, selectedAttackerSpiritId)}
      onClose={onClose}
      onRevealDeepIntel={onRevealDeepIntel}
      onToggleFollow={() => {
        if (target && !isFriend) {
          onToggleFollowTarget(target);
        }
      }}
      targetName={modal.targetName}
    />
  );
}
