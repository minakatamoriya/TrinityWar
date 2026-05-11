import type { ClientArmyTrainingQueue } from '@trinitywar/shared';
import { ArmyRecruitScreen } from './ArmyRecruitScreen';

interface ArmySceneProps {
  currentArmy: number;
  armyCapacity: number;
  currentGold: number;
  selectedCount: number;
  onSelectCount: (count: number) => void;
  onConfirm: () => void;
  confirming: boolean;
  trainingQueue: ClientArmyTrainingQueue | null;
  unitCostGold: number;
  unitTrainingSeconds: number;
}

export function ArmyScene(props: ArmySceneProps): JSX.Element {
  const { currentArmy, armyCapacity, currentGold, selectedCount, onSelectCount, onConfirm, confirming, trainingQueue, unitCostGold, unitTrainingSeconds } = props;

  return (
    <div className="scene-shell">
      <div className="scene-scroll army-scene-scroll">
        <ArmyRecruitScreen
          armyCapacity={armyCapacity}
          confirming={confirming}
          currentArmy={currentArmy}
          currentGold={currentGold}
          embedded
          onConfirm={onConfirm}
          onSelectCount={onSelectCount}
          selectedCount={selectedCount}
          trainingQueue={trainingQueue}
          unitCostGold={unitCostGold}
          unitTrainingSeconds={unitTrainingSeconds}
        />
      </div>
    </div>
  );
}