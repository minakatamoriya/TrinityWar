import type {
  ClientBuildingUpgradeId,
  ClientCastleExtensionUpgradeId,
  ClientTerritoryUpgradeId,
  ClientUpgradeBuildingRequest,
  ClientUpgradeTargetType,
} from '@trinitywar/shared';

export function buildUpgradeRequest(
  targetType: ClientUpgradeTargetType,
  upgradeId: ClientBuildingUpgradeId | ClientCastleExtensionUpgradeId,
  buildingVersion: number,
  walletVersion: number,
): ClientUpgradeBuildingRequest {
  if (targetType === 'building') {
    return {
      targetType,
      buildingId: upgradeId as ClientBuildingUpgradeId,
      buildingVersion,
      walletVersion,
    };
  }

  if (targetType === 'territory-tech') {
    return {
      targetType,
      territoryUpgradeId: upgradeId as ClientTerritoryUpgradeId,
      buildingVersion,
      walletVersion,
    };
  }

  return {
    targetType,
    extensionId: upgradeId as ClientCastleExtensionUpgradeId,
    buildingVersion,
    walletVersion,
  };
}
