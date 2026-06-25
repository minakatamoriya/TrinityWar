import { useMemo, useState } from 'react';
import { getSpiritBattleInnateRules, type ClientSpiritCodexEntry } from '@trinitywar/shared';
import {
  getFirstVisibleSpiritCodexId,
  getSpiritCodexName,
  getSpiritCodexProgressLabel,
  getSpiritCodexRarityLabel,
  getSpiritCodexShardProgress,
  getSpiritCodexStatusLabel,
  getSpiritFactionLabel,
  getSpiritRoleLabel,
  isSpiritCodexVisible,
} from '../../modules/spirit/spiritCodexPresentation';
import { FullScreenToolShell } from './ModalShell';
import { SpiritCardShowcaseModal } from './SpiritCardShowcaseModal';

interface SpiritCodexModalProps {
  entries: ClientSpiritCodexEntry[];
  selectedSpiritId: string | null;
  stableFull: boolean;
  onClose: () => void;
  onSelectSpirit: (spiritId: string) => void;
}

const codexRarityGroups = [
  { key: 'common', label: '普通', rarity: 'common' as const },
  { key: 'rare', label: '稀有', rarity: 'rare' as const },
  { key: 'legend', label: '传说', rarity: 'legendary' as const },
];

export function SpiritCodexModal(props: SpiritCodexModalProps): JSX.Element | null {
  const {
    entries,
    selectedSpiritId,
    stableFull,
    onClose,
    onSelectSpirit,
  } = props;
  void stableFull;

  const [showcaseSpiritId, setShowcaseSpiritId] = useState<string | null>(null);
  const codexById = useMemo(() => new Map(entries.map((entry) => [entry.spiritId, entry])), [entries]);
  const fallbackSpiritId = getFirstVisibleSpiritCodexId(entries);
  const resolvedSpiritId = selectedSpiritId && codexById.has(selectedSpiritId)
    ? selectedSpiritId
    : fallbackSpiritId;
  const selectedEntry = resolvedSpiritId ? codexById.get(resolvedSpiritId) ?? null : null;
  const showcaseEntry = showcaseSpiritId ? codexById.get(showcaseSpiritId) ?? null : null;
  const codexGroups = codexRarityGroups.map((group) => ({
    ...group,
    pets: entries.filter((entry) => entry.definition.rarity === group.rarity),
  }));

  if (!selectedEntry) {
    return null;
  }

  return (
    <>
      <FullScreenToolShell
        ariaLabel="灵宠图鉴"
        bodyClassName="seed-codex-body"
        className="spirit-codex-screen"
        description="点击已可见灵宠图标查看卡片展示。"
        onBack={onClose}
        title="灵宠图鉴"
      >
        {codexGroups.map((group) => (
          <section className="panel-card seed-codex-rarity-row" key={group.key}>
            <div className="seed-codex-rarity-head">
              <strong>{group.label}</strong>
            </div>
            <div className="seed-codex-icon-grid spirit-compose-icon-grid">
              {group.pets.map((entry) => {
                const visible = isSpiritCodexVisible(entry);
                const spiritName = getSpiritCodexName(entry);

                return (
                  <div className="spirit-compose-icon-item spirit-codex-icon-item" key={entry.spiritId}>
                    <button
                      aria-label={visible ? spiritName : `${group.label}未可见灵宠`}
                      className={`seed-codex-icon ${visible ? 'is-unlocked' : 'is-locked'} ${entry.spiritId === selectedEntry.spiritId ? 'is-selected' : ''}`}
                      onClick={() => {
                        onSelectSpirit(entry.spiritId);
                        if (visible) {
                          setShowcaseSpiritId(entry.spiritId);
                        }
                      }}
                      type="button"
                    >
                      <span>{visible ? spiritName.slice(0, 2) : '??'}</span>
                    </button>
                    <small>{getSpiritCodexShardProgress(entry).replace(' / ', '/')}</small>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </FullScreenToolShell>

      {showcaseEntry && isSpiritCodexVisible(showcaseEntry) ? (
        <SpiritCardShowcaseModal
          data={buildCodexShowcaseData(showcaseEntry)}
          onClose={() => setShowcaseSpiritId(null)}
        />
      ) : null}
    </>
  );
}

function buildCodexShowcaseData(entry: ClientSpiritCodexEntry) {
  const innateRules = getSpiritBattleInnateRules(entry.spiritId);

  return {
    label: getSpiritCodexName(entry),
    artSrc: getSpiritCodexArtSrc(entry.spiritId),
    ownerLabel: '灵宠图鉴',
    rarity: entry.definition.rarity,
    relationLabel: getSpiritCodexProgressLabel(entry),
    slotLabel: getSpiritCodexRarityLabel(entry.definition.rarity),
    element: null,
    detailTitle: '本体特性',
    detailEyebrow: getSpiritCodexStatusLabel(entry),
    detailIntro: entry.definition.lore ?? '暂无背景描述。',
    detailBadges: [
      getSpiritCodexRarityLabel(entry.definition.rarity),
      getSpiritFactionLabel(entry.definition.factionAffinity),
      getSpiritRoleLabel(entry.definition.role),
      getSpiritCodexShardProgress(entry).replace(' / ', '/'),
    ],
    traits: innateRules.map((rule) => ({
      label: rule.label,
      description: rule.description,
    })),
    emptyDetailTitle: '特性待开放',
    emptyDetailText: '这只灵宠还没有录入可展示的本体特性说明。',
  };
}

function getSpiritCodexArtSrc(spiritId: string): string | undefined {
  if (spiritId === 'canglang') {
    return '/assets/pet/canglang_3.png';
  }

  return undefined;
}
