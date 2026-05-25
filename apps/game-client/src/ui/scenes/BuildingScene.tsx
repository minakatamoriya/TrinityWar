import type { ClientBuildingUpgrade, ClientCastleExtensionUpgrade, ClientCastleExtensionUpgradeId, ClientSceneAction, ClientUpgradeTargetType } from '@trinitywar/shared';
import { ActionButton } from '../ActionButton';

interface BuildingSceneProps {
  upgrades: ClientBuildingUpgrade[];
  extensions: ClientCastleExtensionUpgrade[];
  onUpgradeAction: (action: ClientSceneAction, upgradeId: ClientBuildingUpgrade['id'] | ClientCastleExtensionUpgradeId, context: string, targetType: ClientUpgradeTargetType, costText: string) => void;
}

const upgradeDescriptions: Record<string, string> = {
  protectionTech: '结阵护住灵田与本命灵宠，延长被成功掠夺后的保护时间。',
  farmYieldTech: '引灵雨滋养田垄，提升作物成长与丰熟阶段的金币收益。',
  ripeWindowTech: '观天象定农时，延长作物进入丰熟后的可收窗口。',
  factionOfferingTech: '凝聚同道心念，提升金币上缴时获得的个人阵营贡献。',
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
  targetType: ClientUpgradeTargetType,
  onUpgradeAction: BuildingSceneProps['onUpgradeAction'],
): JSX.Element | null {
  if (upgrade.locked || !upgrade.costText.startsWith('消耗')) {
    return null;
  }

  return (
    <div className="building-mini-card-footer">
      <strong className="building-mini-card-price">{getUpgradeCostText(upgrade.costText)}</strong>
      <ActionButton action={upgrade.action} onClick={(action) => {
        onUpgradeAction(action, upgradeId, title, targetType, upgrade.costText);
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
            const targetType: ClientUpgradeTargetType = 'levelText' in upgrade ? 'territory-tech' : 'building';
            const upgradeId = 'levelText' in upgrade ? upgrade.id : upgrade.id;

            return (
              <article className={`upgrade-card building-mini-card ${upgrade.locked ? 'locked' : 'active'}`} key={upgrade.id}>
                <div className="building-mini-card-top">
                  <h4>{upgrade.title}</h4>
                  <span className={`building-mini-card-state ${upgrade.locked ? 'locked' : 'active'}`}>
                    {upgrade.locked ? '已满级' : '可修习'}
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
