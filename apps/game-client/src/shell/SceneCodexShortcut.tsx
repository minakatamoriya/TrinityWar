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

const shortcutConfig: Partial<Record<AppSceneKey, { label: string; title: string; iconSrc: string }>> = {
  battle: {
    label: '战斗',
    title: '战报',
    iconSrc: '/assets/icon/sidebar_battle_scroll_new_64.png',
  },
  faction: {
    label: '阵营',
    title: '典籍',
    iconSrc: '/assets/icon/codex_faction_scroll_64.png',
  },
  farm: {
    label: '灵田',
    title: '图鉴',
    iconSrc: '/assets/icon/codex_field_book_64.png',
  },
  social: {
    label: '社交',
    title: '动态',
    iconSrc: '/assets/icon/sidebar_chat_64.png',
  },
  spirit: {
    label: '灵宠',
    title: '图鉴',
    iconSrc: '/assets/icon/codex_pet_book_64.png',
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
      <img alt="" aria-hidden="true" className="scene-codex-icon" src={config.iconSrc} />
      <span>{config.label}</span>
      <strong>{config.title}</strong>
    </button>
  );
}
