import { Injectable } from '@nestjs/common';
import type { ClientBuildingUpgradeId, ClientCastleExtensionUpgradeId } from '@trinitywar/shared';
import {
  getCastleExtensionLevelConfig,
  getCastleExtensionTrack,
} from '../lib/game-balance.js';

export interface BuildingUpgradeTarget {
  key: ClientBuildingUpgradeId | ClientCastleExtensionUpgradeId;
  currentLevel: number;
  nextLevel: number;
  costGold: number;
  requiredCastleLevel: number;
  isExtension: boolean;
}

export interface PlayerBuildingStateForUpgrade {
  castleLevel: number;
  vaultLevel: number;
  populationLevel: number;
  watchtowerLevel: number;
  protectionTechLevel: number;
  farmYieldTechLevel: number;
  ripeWindowTechLevel: number;
  pendingClaimTechLevel: number;
}

@Injectable()
export class BuildingUpgradeRuleService {
  resolveBuildingTarget(buildings: PlayerBuildingStateForUpgrade, buildingId: ClientBuildingUpgradeId): BuildingUpgradeTarget {
    void buildings;
    void buildingId;

    throw new Error('LEGACY_BUILDING_UPGRADE_RETIRED');
  }

  resolveExtensionTarget(buildings: PlayerBuildingStateForUpgrade, extensionId: ClientCastleExtensionUpgradeId): BuildingUpgradeTarget {
    const currentLevel = getExtensionLevel(buildings, extensionId);
    const track = getCastleExtensionTrack(extensionId);
    const nextLevelConfig = getCastleExtensionLevelConfig(extensionId, currentLevel + 1);

    if (!track || !nextLevelConfig) {
      throw new Error('BUILDING_MAX_LEVEL');
    }

    return {
      key: extensionId,
      currentLevel,
      nextLevel: currentLevel + 1,
      costGold: nextLevelConfig.upgradeCost,
      requiredCastleLevel: nextLevelConfig.requiredCastleLevel,
      isExtension: true,
    };
  }
}

function getExtensionLevel(buildings: PlayerBuildingStateForUpgrade, extensionId: ClientCastleExtensionUpgradeId): number {
  if (extensionId === 'protectionTech') {
    return buildings.protectionTechLevel;
  }

  if (extensionId === 'farmYieldTech') {
    return buildings.farmYieldTechLevel;
  }

  if (extensionId === 'ripeWindowTech') {
    return buildings.ripeWindowTechLevel;
  }

  if (extensionId === 'factionOfferingTech') {
    return buildings.pendingClaimTechLevel;
  }

  return buildings.pendingClaimTechLevel;
}
