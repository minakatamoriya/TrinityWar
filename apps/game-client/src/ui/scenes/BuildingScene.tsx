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

export function BuildingScene(props: BuildingSceneProps): JSX.Element {
  const { castleLevel, upgrades, extensions, onUpgradeAction } = props;
  const castleUpgrade = upgrades.find((upgrade) => upgrade.id === 'castle');
  const visibleUpgrades = upgrades.filter((upgrade) => upgrade.id !== 'castle');
  const castleLockedNotes = upgrades.filter((upgrade) => upgrade.costText.includes('需要主城'));

  return (
    <div className="scene-shell">
      <div className="scene-scroll building-scene-scroll">
        <article className="panel-card building-summary-card">
          <div className="building-summary-head">
            <div>
              <p className="eyebrow">主城总览</p>
              <h4>主城 Lv.{castleLevel}</h4>
            </div>
            <span className="soft-tag">升级入口</span>
          </div>
          <div className="building-summary-list">
            {castleUpgrade ? (
              <div className="building-summary-row building-summary-row-upgrade">
                <div className="building-summary-row-copy">
                  <strong>主城升级</strong>
                  <span>{castleUpgrade.description}</span>
                </div>
                <div className="building-upgrade-action-row building-upgrade-action-row-summary">
                  <ActionButton action={castleUpgrade.action} onClick={(action) => {
                    onUpgradeAction(action, castleUpgrade.id, castleUpgrade.title, 'building');
                  }} />
                  <strong className="building-upgrade-price">{getUpgradeCostText(castleUpgrade.costText)}</strong>
                </div>
              </div>
            ) : null}
            <div className="building-summary-row">
              <strong>当前已接主城等级挂钩</strong>
              <span>{castleLockedNotes.length > 0 ? castleLockedNotes.map((upgrade) => upgrade.title).join('、') : '暂未配置'}</span>
            </div>
            <div className="building-summary-row">
              <strong>防守建筑</strong>
              <span>{castleLockedNotes.find((upgrade) => upgrade.id === 'watchtower')?.costText ?? '当前未设置主城门槛'}</span>
            </div>
            <div className="building-summary-row">
              <strong>田地位</strong>
              <span>田地位随主城里程碑自动赠送开启，不需要玩家额外花钱购买。</span>
            </div>
          </div>
        </article>

        <div className="card-grid compact-grid building-upgrade-list">
          {visibleUpgrades.map((upgrade) => (
            <article className={`upgrade-card building-upgrade-item ${upgrade.locked ? 'locked' : ''}`} key={upgrade.title}>
              <div className="building-upgrade-copy">
                <h4>{upgrade.title}</h4>
                <p>{upgrade.description}</p>
              </div>
              <div className="building-upgrade-action-row">
                <ActionButton action={upgrade.action} onClick={(action) => {
                  onUpgradeAction(action, upgrade.id, upgrade.title, 'building');
                }} />
                <strong className="building-upgrade-price">{getUpgradeCostText(upgrade.costText)}</strong>
              </div>
            </article>
          ))}
        </div>

        <article className="panel-card building-summary-card">
          <div className="building-summary-head">
            <div>
              <p className="eyebrow">主城扩展</p>
              <h4>四条内政分支</h4>
            </div>
            <span className="soft-tag">持续抽水</span>
          </div>
          <div className="card-grid compact-grid building-upgrade-list">
            {extensions.map((extension) => (
              <article className={`upgrade-card building-upgrade-item ${extension.locked ? 'locked' : ''}`} key={extension.id}>
                <div className="building-upgrade-copy">
                  <h4>{extension.title}</h4>
                  <p>{extension.levelText}</p>
                  <p>{extension.description}</p>
                  <p>{extension.effectText}</p>
                </div>
                <div className="building-upgrade-action-row">
                  <ActionButton action={extension.action} onClick={(action) => {
                    onUpgradeAction(action, extension.id, extension.title, 'castle-extension');
                  }} />
                  <strong className="building-upgrade-price">{getUpgradeCostText(extension.costText)}</strong>
                </div>
              </article>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}