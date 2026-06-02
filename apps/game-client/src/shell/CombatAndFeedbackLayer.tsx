import type { ClientRaidBattleReplay } from '@trinitywar/shared';
import { RaidBattleScreen } from '../battle/RaidBattleScreen';
import { RewardBubbleStack, type RewardBubbleItem } from '../ui/common/RewardBubbleStack';
import { formatNumber } from '../utils/format';
import type { ToastState } from './appStateTypes';

interface CombatAndFeedbackLayerProps {
  raidBattleAutoStart: boolean;
  raidBattleReplay: ClientRaidBattleReplay | null;
  rewardBubbles: RewardBubbleItem[];
  toast: ToastState | null;
  onRaidBattleComplete: () => void;
}

export function CombatAndFeedbackLayer(props: CombatAndFeedbackLayerProps): JSX.Element {
  const {
    raidBattleAutoStart,
    raidBattleReplay,
    rewardBubbles,
    toast,
    onRaidBattleComplete,
  } = props;

  return (
    <>
      {raidBattleReplay ? (
        <RaidBattleScreen
          autoStart={raidBattleAutoStart}
          onComplete={onRaidBattleComplete}
          replay={raidBattleReplay}
        />
      ) : null}
      <RewardBubbleStack bubbles={rewardBubbles} formatNumber={formatNumber} />
      {toast ? (
        <div className={`top-toast top-toast-${toast.tone}`}>
          <span>{toast.message}</span>
        </div>
      ) : null}
    </>
  );
}
