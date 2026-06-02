import { formatNumber } from '../utils/format';

interface GlobalResourceBarProps {
  gold: number;
  showTopResourceButtons: boolean;
  tianjiTalisman: number;
  onOpenResources: () => void;
  onOpenSeedCodex: () => void;
  onOpenSpiritCodex: () => void;
}

export function GlobalResourceBar(props: GlobalResourceBarProps): JSX.Element {
  const {
    gold,
    showTopResourceButtons,
    tianjiTalisman,
    onOpenResources,
    onOpenSeedCodex,
    onOpenSpiritCodex,
  } = props;

  return (
    <section className="global-resource-bar">
      <div className="global-resource-pill global-gold-pill">
        <span className="global-gold-icon" aria-hidden="true">金</span>
        <strong>{formatNumber(gold)}</strong>
      </div>
      {showTopResourceButtons ? (
        <>
          <div className="global-resource-pill global-tianji-pill">
            <span className="global-tianji-icon" aria-hidden="true">符</span>
            <strong>{formatNumber(tianjiTalisman)}</strong>
          </div>
          <button className="global-resource-pill global-resource-entry" onClick={onOpenSeedCodex} type="button">
            灵植图鉴
          </button>
          <button className="global-resource-pill global-resource-entry" onClick={onOpenSpiritCodex} type="button">
            宠物图鉴
          </button>
          <button className="global-resource-pill global-resource-entry" onClick={onOpenResources} type="button">
            我的资源
          </button>
        </>
      ) : null}
    </section>
  );
}
