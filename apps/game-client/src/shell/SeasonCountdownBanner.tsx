interface SeasonCountdownBannerProps {
  visible: boolean;
  remainingLabel: string;
}

export function SeasonCountdownBanner(props: SeasonCountdownBannerProps): JSX.Element | null {
  if (!props.visible) {
    return null;
  }

  return (
    <aside className="season-countdown-banner" aria-live="polite">
      <span>赛季即将结束</span>
      <strong>{props.remainingLabel}</strong>
    </aside>
  );
}
