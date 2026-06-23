import { sceneKeys, sceneNavLabels, type AppSceneKey } from '../config/sceneConfig';
import { canOpenSceneInTutorial, type TutorialStage } from '../tutorial/tutorialFlow';

interface BottomDockProps {
  activeScene: AppSceneKey;
  tutorialStage: TutorialStage;
  onNavigate: (scene: AppSceneKey) => void;
}

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
            {sceneNavLabels[scene]}
          </button>
        );
      })}
    </footer>
  );
}
