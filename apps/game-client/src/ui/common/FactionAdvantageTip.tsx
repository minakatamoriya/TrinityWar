import type { ClientFactionAdvantagePanel } from '@trinitywar/shared';

interface FactionAdvantageTipProps {
  advantage: ClientFactionAdvantagePanel;
}

export function FactionAdvantageTip(props: FactionAdvantageTipProps): JSX.Element {
  const { advantage } = props;

  return (
    <article className="panel-card faction-advantage-panel">
      <div className="faction-advantage-tipbar">
        <div className="faction-advantage-tipcopy">
          <span className="soft-tag">{advantage.factionName}优势</span>
          <strong>{advantage.title}</strong>
        </div>
        <button className="faction-advantage-dismiss-button" disabled type="button">
          本赛季不再提示
        </button>
      </div>
      <p className="panel-text">{advantage.summary}</p>
    </article>
  );
}
