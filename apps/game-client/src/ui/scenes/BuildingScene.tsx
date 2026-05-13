import type { ClientBuildingUpgrade, ClientCastleExtensionUpgrade, ClientCastleExtensionUpgradeId, ClientSceneAction } from '@trinitywar/shared';
import { ActionButton } from '../ActionButton';

interface BuildingSceneProps {
  castleLevel: number;
  upgrades: ClientBuildingUpgrade[];
  extensions: ClientCastleExtensionUpgrade[];
  onUpgradeAction: (action: ClientSceneAction, upgradeId: ClientBuildingUpgrade['id'] | ClientCastleExtensionUpgradeId, context: string, targetType: 'building' | 'castle-extension') => void;
}

function getUpgradeCostText(costText: string): string {
  return costText.startsWith('消耗 ') ? costText.replace('消耗 ', '') : costText;
}

function getUnlockLevel(costText: string): number | null {
  const matchedLevel = costText.match(/Lv\.(\d+)/);
  return matchedLevel ? Number(matchedLevel[1]) : null;
}

function getUpgradeTrackSummary(upgrade: ClientBuildingUpgrade | ClientCastleExtensionUpgrade): string {
  const unlockLevel = getUnlockLevel(upgrade.costText);

  if (upgrade.locked && unlockLevel) {
    if ('levelText' in upgrade) {
      return `${upgrade.levelText}，主城 Lv.${unlockLevel} 解锁。`;
    }

    return `主城 Lv.${unlockLevel} 解锁下一档。`;
  }

  if ('effectText' in upgrade) {
    return upgrade.effectText;
  }

  return upgrade.description;
}

function getFieldGiftRule(castleLevel: number): string {
  if (castleLevel < 5) {
    return '农场解锁规则：主城 Lv.5 / Lv.10 / Lv.15 自动开启第 2 / 3 / 4 块田。';
  }

  if (castleLevel < 10) {
    return '农场解锁规则：已送第 2 块田；主城 Lv.10 / Lv.15 继续送第 3 / 4 块田。';
  }

  if (castleLevel < 15) {
    return '农场解锁规则：已送第 2、3 块田；主城 Lv.15 自动送第 4 块田。';
  }

  return '农场解锁规则：4 块田已全部由主城里程碑赠送开启。';
}

function getSeedGiftRule(castleLevel: number): string {
  if (castleLevel < 5) {
    return '种子赠送规则：主城 Lv.5 送普通种，Lv.10 送稀有种，Lv.20 送传说种。';
  }

  if (castleLevel < 10) {
    return '种子赠送规则：已送普通种；主城 Lv.10 送稀有种，Lv.20 送传说种。';
  }

  if (castleLevel < 20) {
    return '种子赠送规则：已送普通种、稀有种；主城 Lv.20 送传说种。';
  }

  return '种子赠送规则：普通、稀有、传说种均已按主城里程碑赠送。';
}

function renderUpgradeAction(
  upgrade: ClientBuildingUpgrade | ClientCastleExtensionUpgrade,
  upgradeId: ClientBuildingUpgrade['id'] | ClientCastleExtensionUpgradeId,
  title: string,
  targetType: 'building' | 'castle-extension',
  onUpgradeAction: BuildingSceneProps['onUpgradeAction'],
): JSX.Element | null {
  if (upgrade.locked || !upgrade.costText.startsWith('消耗 ')) {
    return null;
  }

  return (
    <div className="building-mini-card-footer">
      <strong className="building-mini-card-price">{getUpgradeCostText(upgrade.costText)}</strong>
      <ActionButton action={upgrade.action} onClick={(action) => {
        onUpgradeAction(action, upgradeId, title, targetType);
      }} />
    </div>
  );
}

export function BuildingScene(props: BuildingSceneProps): JSX.Element {
  const { castleLevel, upgrades, extensions, onUpgradeAction } = props;
  const castleUpgrade = upgrades.find((upgrade) => upgrade.id === 'castle');
  const vaultUpgrade = upgrades.find((upgrade) => upgrade.id === 'vault');
  const populationUpgrade = upgrades.find((upgrade) => upgrade.id === 'population');
  const compactUpgrades = [
    vaultUpgrade,
    populationUpgrade,
    ...extensions,
  ].filter((upgrade): upgrade is ClientBuildingUpgrade | ClientCastleExtensionUpgrade => Boolean(upgrade));

  return (
    <div className="scene-shell">
      <div className="scene-scroll building-scene-scroll">
        <article className="panel-card castle-overview-card">
          <div className="building-summary-head castle-overview-head">
            <div>
              <div>主城 Lv.{castleLevel}</div>
            </div>
          </div>
          <div className="castle-overview-body">
            {castleUpgrade ? (
              <div className="castle-overview-upgrade">
                <div className="castle-overview-copy">
                  <strong>{castleUpgrade.description}</strong>
                  <span>{castleUpgrade.locked ? castleUpgrade.costText : '继续提升主城可逐步解锁更多升级档与赠送里程碑。'}</span>
                </div>
                <div className="castle-overview-action-row">
                  <strong className="building-upgrade-price">{getUpgradeCostText(castleUpgrade.costText)}</strong>
                  <ActionButton action={castleUpgrade.action} onClick={(action) => {
                    onUpgradeAction(action, castleUpgrade.id, castleUpgrade.title, 'building');
                  }} />
                </div>
              </div>
            ) : null}
            <div className="castle-rule-list">
              <div className="castle-rule-row">
                <strong>农场解锁</strong>
                <span>{getFieldGiftRule(castleLevel)}</span>
              </div>
              <div className="castle-rule-row">
                <strong>种子赠送</strong>
                <span>{getSeedGiftRule(castleLevel)}</span>
              </div>
            </div>
          </div>
        </article>

        <div className="card-grid compact-grid building-six-upgrade-grid">
          {compactUpgrades.map((upgrade) => {
            const targetType = 'levelText' in upgrade ? 'castle-extension' : 'building';
            const upgradeId = 'levelText' in upgrade ? upgrade.id : upgrade.id;

            return (
              <article className={`upgrade-card building-mini-card ${upgrade.locked ? 'locked' : 'active'}`} key={upgrade.id}>
                <div className="building-mini-card-top">
                  <h4>{upgrade.title}</h4>
                  <span className={`building-mini-card-state ${upgrade.locked ? 'locked' : 'active'}`}>
                    {upgrade.locked ? '未解锁' : '可升级'}
                  </span>
                </div>
                <div className="building-mini-card-copy">
                  <p>{getUpgradeTrackSummary(upgrade)}</p>
                  <p className="building-mini-card-unlock">
                    {upgrade.locked ? upgrade.costText : ('levelText' in upgrade ? upgrade.levelText : '当前已解锁，可继续升级。')}
                  </p>
                </div>
                {renderUpgradeAction(upgrade, upgradeId, upgrade.title, targetType, onUpgradeAction)}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}