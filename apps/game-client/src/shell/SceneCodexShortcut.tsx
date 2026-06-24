import type { AppSceneKey } from '../config/sceneConfig';

interface SceneCodexShortcutProps {
  activeScene: AppSceneKey;
  disabled?: boolean;
  onOpenBattleReports: () => void;
  onOpenFactionLogs: () => void;
  onOpenPlantCodex: () => void;
  onOpenSocialFeed: () => void;
  onOpenSpiritCodex: () => void;
}

const shortcutConfig: Partial<Record<AppSceneKey, { label: string; title: string }>> = {
  battle: {
    label: '战斗',
    title: '战报',
  },
  faction: {
    label: '阵营',
    title: '记录',
  },
  farm: {
    label: '灵植',
    title: '图鉴',
  },
  social: {
    label: '社交',
    title: '动态',
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
    onOpenBattleReports,
    onOpenFactionLogs,
    onOpenPlantCodex,
    onOpenSocialFeed,
    onOpenSpiritCodex,
  } = props;
  const config = shortcutConfig[activeScene];

  if (!config || disabled) {
    return null;
  }

  let handleClick = onOpenSpiritCodex;
  if (activeScene === 'battle') {
    handleClick = onOpenBattleReports;
  } else if (activeScene === 'faction') {
    handleClick = onOpenFactionLogs;
  } else if (activeScene === 'farm') {
    handleClick = onOpenPlantCodex;
  } else if (activeScene === 'social') {
    handleClick = onOpenSocialFeed;
  }

  return (
    <button className="scene-codex-shortcut" onClick={handleClick} type="button">
      <span>{config.label}</span>
      <strong>{config.title}</strong>
    </button>
  );
}
