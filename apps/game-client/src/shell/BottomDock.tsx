import { sceneKeys, sceneNavLabels, type AppSceneKey } from '../config/sceneConfig';
import { canOpenSceneInTutorial, type TutorialStage } from '../tutorial/tutorialFlow';

interface BottomDockProps {
  activeScene: AppSceneKey;
  tutorialStage: TutorialStage;
  onNavigate: (scene: AppSceneKey) => void;
}

const dockIconMap: Record<AppSceneKey, string> = {
  farm: '/assets/icon/dock_field_64.png',
  spirit: '/assets/icon/dock_pet_64.png',
  battle: '/assets/icon/dock_battle_64.png',
  social: '/assets/icon/dock_social_64.png',
  faction: '/assets/icon/dock_faction_64.png',
};

const dockLabelMap: Record<AppSceneKey, string> = {
  farm: '灵田',
  spirit: '灵宠',
  battle: '战斗',
  social: '社交',
  faction: '阵营',
};

export function BottomDock(props: BottomDockProps): JSX.Element {
  const {
    activeScene,
    tutorialStage,
    onNavigate,
  } = props;

  return (
    <footer className="bottom-dock">
      {sceneKeys.map((scene) => {
        const unlocked = canOpenSceneInTutorial(scene, tutorialStage);

        return (
          <button
            aria-disabled={!unlocked}
            className={`nav-item ${activeScene === scene ? 'active' : ''} ${unlocked ? '' : 'locked'}`}
            key={scene}
            onClick={() => onNavigate(scene)}
            type="button"
          >
            <img
              alt=""
              aria-hidden="true"
              className="dock-nav-icon"
              src={dockIconMap[scene]}
            />
            <span className="dock-nav-label">{dockLabelMap[scene] ?? sceneNavLabels[scene]}</span>
          </button>
        );
      })}
    </footer>
  );
}
