import type { ClientSpiritElement } from '@trinitywar/shared';

export interface SpiritCardShowcaseTrait {
  label: string;
  description?: string | null;
}

export interface SpiritCardShowcaseSection {
  title: string;
  items: SpiritCardShowcaseTrait[];
}

export interface SpiritCardShowcaseData {
  label: string;
  rarity: 'common' | 'rare' | 'legendary' | null;
  element: ClientSpiritElement | null;
  traits?: SpiritCardShowcaseTrait[];
  detailTitle?: string;
  detailEyebrow?: string;
  detailIntro?: string;
  detailSummary?: string;
  detailBadges?: string[];
  detailSections?: SpiritCardShowcaseSection[];
  emptyDetailTitle?: string;
  emptyDetailText?: string;
  compactDetail?: boolean;
}

interface SpiritCardShowcaseModalProps {
  data: SpiritCardShowcaseData;
  onClose: () => void;
  showDetail?: boolean;
}

export function SpiritCardShowcaseModal(props: SpiritCardShowcaseModalProps): JSX.Element {
  const { data, onClose, showDetail = true } = props;
  const rarityClass = getRarityClass(data.rarity);
  const elementClass = getElementClass(data.element);
  const detailTraits = data.traits ?? [];
  const detailSections = data.detailSections ?? [];
  const compactDetail = data.compactDetail === true;

  return (
    <div
      aria-hidden="true"
      className="spirit-card-showcase-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <section
        aria-label={`${data.label}卡片展示`}
        aria-modal="true"
        className="spirit-card-showcase-shell"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button className="spirit-card-showcase-close" onClick={onClose} type="button">
          关闭
        </button>

        <div className="spirit-card-showcase-stage">
          <article className={`spirit-card-showcase-card ${rarityClass}`}>
            <div className="spirit-card-showcase-cardback" aria-hidden="true" />
            <div className="spirit-card-showcase-frame" aria-hidden="true" />

            {data.element ? (
              <div className={`spirit-card-showcase-element-badge ${elementClass}`} aria-hidden="true">
                <span>{formatElement(data.element)}</span>
              </div>
            ) : null}

            <div className="spirit-card-showcase-art">
              <div className="spirit-card-showcase-glyph" aria-hidden="true">
                <span>{getSpiritGlyph(data.label)}</span>
              </div>
            </div>

            <div className="spirit-card-showcase-nameplate">
              <h3>{data.label}</h3>
            </div>
          </article>
        </div>

        {showDetail ? (
          <section className="spirit-card-showcase-detail">
            <div className="spirit-card-showcase-detail-head">
              <div>
                {data.detailEyebrow ? <p className="eyebrow">{data.detailEyebrow}</p> : null}
                <h4>{data.detailTitle ?? data.label}</h4>
              </div>
            </div>

            {data.detailSummary ? <p className="spirit-card-showcase-summary">{data.detailSummary}</p> : null}
            {data.detailIntro ? <p className="spirit-card-showcase-intro">{data.detailIntro}</p> : null}

            {detailSections.length > 0 ? (
              <div className="spirit-card-showcase-section-list">
                {detailSections.map((section) => (
                  <section className="spirit-card-showcase-section" key={section.title}>
                    <div className="spirit-card-showcase-section-head">
                      <strong>{section.title}</strong>
                    </div>
                    <div className="spirit-card-showcase-trait-list">
                      {section.items.length > 0 ? section.items.map((trait, index) => (
                        <article className={`spirit-card-showcase-trait${compactDetail ? ' compact' : ''}`} key={`${section.title}-${trait.label}-${index}`}>
                          <strong>{`${trait.label}：`}</strong>
                          <p>{trait.description ?? '暂无说明'}</p>
                        </article>
                      )) : (
                        <article className="spirit-card-showcase-trait is-empty">
                          <strong>{data.emptyDetailTitle ?? '暂无信息'}</strong>
                          <p>{data.emptyDetailText ?? '这里暂时没有可展示的信息。'}</p>
                        </article>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="spirit-card-showcase-trait-list">
                {detailTraits.length > 0 ? (
                  detailTraits.map((trait, index) => (
                    <article
                      className={`spirit-card-showcase-trait${compactDetail ? ' compact' : ''}`}
                      key={`${data.label}-${trait.label}-${index}`}
                    >
                      <strong>{`${trait.label}：`}</strong>
                      <p>{trait.description ?? '暂无说明'}</p>
                    </article>
                  ))
                ) : (
                  <article className="spirit-card-showcase-trait is-empty">
                    <strong>{data.emptyDetailTitle ?? '暂无信息'}</strong>
                    <p>{data.emptyDetailText ?? '这里会展示当前灵宠的相关说明。'}</p>
                  </article>
                )}
              </div>
            )}
          </section>
        ) : null}
      </section>
    </div>
  );
}

function getSpiritGlyph(label: string): string {
  return Array.from(label.trim())[0] ?? '灵';
}

function formatElement(element: ClientSpiritElement): string {
  if (element === 'metal') return '金';
  if (element === 'wood') return '木';
  if (element === 'water') return '水';
  if (element === 'fire') return '火';
  return '土';
}

function getElementClass(element: ClientSpiritElement | null): string {
  if (element === 'metal') return 'spirit-element-metal';
  if (element === 'wood') return 'spirit-element-wood';
  if (element === 'water') return 'spirit-element-water';
  if (element === 'fire') return 'spirit-element-fire';
  if (element === 'earth') return 'spirit-element-earth';
  return '';
}

function getRarityClass(rarity: SpiritCardShowcaseData['rarity']): string {
  if (rarity === 'legendary') return 'rarity-legendary';
  if (rarity === 'rare') return 'rarity-rare';
  return 'rarity-common';
}
