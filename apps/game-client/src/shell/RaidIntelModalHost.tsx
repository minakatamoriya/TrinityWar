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

  return (
    <RaidIntelScreen
      allowDeepIntel={allowDeepIntel}
      allowFollow={allowFollow}
      detail={detail}
      error={error}
      followed={followedTargetIds.includes(modal.targetId)}
      loading={loading}
      mode={modal.mode}
      onAction={(action) => onAction(action, detail?.name)}
      onClose={onClose}
      onRevealDeepIntel={onRevealDeepIntel}
      onToggleFollow={() => {
        const target = raidTargetsById.get(modal.targetId);
        if (target) {
          onToggleFollowTarget(target);
        }
      }}
      targetName={modal.targetName}
    />
  );
}
