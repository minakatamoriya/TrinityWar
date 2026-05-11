import type { ClientBuildingUpgrade, ClientBuildingUpgradeId, ClientSceneAction } from '@trinitywar/shared';
import { ActionButton } from '../ActionButton';

interface BuildingSceneProps {
  castleLevel: number;
  upgrades: ClientBuildingUpgrade[];
  onUpgradeAction: (action: ClientSceneAction, buildingId: ClientBuildingUpgradeId, context: string) => void;
}

function getUpgradeCostText(costText: string): string {
  return costText.startsWith('消耗 ') ? costText.replace('消耗 ', '') : costText;
}

export function BuildingScene(props: BuildingSceneProps): JSX.Element {
  const { castleLevel, upgrades, onUpgradeAction } = props;
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
                    onUpgradeAction(action, castleUpgrade.id, castleUpgrade.title);
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
              <span>当前仅按未解锁田地与金币消耗控制，尚未挂主城等级。</span>
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
                  onUpgradeAction(action, upgrade.id, upgrade.title);
                }} />
                <strong className="building-upgrade-price">{getUpgradeCostText(upgrade.costText)}</strong>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}