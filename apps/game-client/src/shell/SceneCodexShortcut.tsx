import type { AppSceneKey } from '../config/sceneConfig';

interface SceneCodexShortcutProps {
  activeScene: AppSceneKey;
  disabled?: boolean;
  onOpenPlantCodex: () => void;
  onOpenSpiritCodex: () => void;
}

const shortcutConfig: Partial<Record<AppSceneKey, { label: string; title: string }>> = {
  farm: {
    label: '灵植',
    title: '图鉴',
  },
  spirit: {
    label: '灵宠',
    title: '图鉴',
  },
};

export function SceneCodexShortcut(props: SceneCodexShortcutProps): JSX.Element | null {
  const {
    activeScene,
    disabled = false,
    onOpenPlantCodex,
    onOpenSpiritCodex,
  } = props;
  const config = shortcutConfig[activeScene];

  if (!config || disabled) {
    return null;
  }

  const handleClick = activeScene === 'farm' ? onOpenPlantCodex : onOpenSpiritCodex;

  return (
    <button className="scene-codex-shortcut" onClick={handleClick} type="button">
      <span>{config.label}</span>
      <strong>{config.title}</strong>
    </button>
  );
}
