import type { ClientBuildingUpgrade, ClientCastleExtensionUpgrade, ClientCastleExtensionUpgradeId, ClientSceneAction } from '@trinitywar/shared';
import { ActionButton } from '../ActionButton';

interface BuildingSceneProps {
  upgrades: ClientBuildingUpgrade[];
  extensions: ClientCastleExtensionUpgrade[];
  onUpgradeAction: (action: ClientSceneAction, upgradeId: ClientBuildingUpgrade['id'] | ClientCastleExtensionUpgradeId, context: string, targetType: 'building' | 'castle-extension') => void;
}

const upgradeDescriptions: Record<string, string> = {
  protectionTech: '延长被掠夺后的保护时间，减少短时间内连续被打的压力。',
  farmYieldTech: '提高农田作物金币收益，让种菜成为更稳定的主要金币来源。',
  ripeWindowTech: '延长丰熟可收窗口，降低错过成熟时间带来的损失。',
  factionOfferingTech: '强化阵营供奉收益，提升每日俸禄中的材料价值，不放大金币返还。',
};

function getUpgradeCostText(costText: string): string {
  return costText.startsWith('消耗') ? costText.replace('消耗', '').trim() : costText;
}

function getUpgradeDescription(upgrade: ClientBuildingUpgrade | ClientCastleExtensionUpgrade): string {
  return upgradeDescriptions[upgrade.id] ?? upgrade.description;
}

function getUpgradeEffect(upgrade: ClientBuildingUpgrade | ClientCastleExtensionUpgrade): string {
  if ('effectText' in upgrade) {
    return upgrade.effectText;
  }

  return upgrade.description;
}

function renderUpgradeAction(
  upgrade: ClientBuildingUpgrade | ClientCastleExtensionUpgrade,
  upgradeId: ClientBuildingUpgrade['id'] | ClientCastleExtensionUpgradeId,
  title: string,
  targetType: 'building' | 'castle-extension',
  onUpgradeAction: BuildingSceneProps['onUpgradeAction'],
): JSX.Element | null {
  if (upgrade.locked || !upgrade.costText.startsWith('消耗')) {
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
  const { upgrades, extensions, onUpgradeAction } = props;
  const upgradeItems = [...upgrades, ...extensions];

  return (
    <div className="scene-shell">
      <div className="scene-scroll building-scene-scroll">
        <div className="card-grid compact-grid building-six-upgrade-grid">
          {upgradeItems.map((upgrade) => {
            const targetType = 'levelText' in upgrade ? 'castle-extension' : 'building';
            const upgradeId = 'levelText' in upgrade ? upgrade.id : upgrade.id;

            return (
              <article className={`upgrade-card building-mini-card ${upgrade.locked ? 'locked' : 'active'}`} key={upgrade.id}>
                <div className="building-mini-card-top">
                  <h4>{upgrade.title}</h4>
                  <span className={`building-mini-card-state ${upgrade.locked ? 'locked' : 'active'}`}>
                    {upgrade.locked ? '已满级' : '可升级'}
                  </span>
                </div>
                <div className="building-mini-card-copy">
                  <p>{getUpgradeDescription(upgrade)}</p>
                  <p className="building-mini-card-unlock">{getUpgradeEffect(upgrade)}</p>
                  {'levelText' in upgrade ? <p className="building-mini-card-level">{upgrade.levelText}</p> : null}
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
