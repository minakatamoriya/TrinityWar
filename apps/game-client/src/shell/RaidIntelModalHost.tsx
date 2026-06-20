import type {
  ClientRaidDeepIntelResponse,
  ClientRaidTarget,
  ClientRaidTargetDetailResponse,
  ClientSceneAction,
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
  raidTargetsById: Map<string, ClientRaidTarget>;
  onAction: (action: ClientSceneAction, context?: string) => void;
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
    raidTargetsById,
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
      onAction={(action) => onAction(action, detail?.name)}
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
