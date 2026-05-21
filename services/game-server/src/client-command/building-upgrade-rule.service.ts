import { Injectable } from '@nestjs/common';
import type { ClientBuildingUpgradeId, ClientCastleExtensionUpgradeId } from '@trinitywar/shared';
import {
  getBuildingUpgradeCost,
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
    if (buildingId === 'field-slot') {
      throw new Error('FIELD_SLOT_AUTO_UNLOCK');
    }

    const currentLevel = getBuildingLevel(buildings, buildingId);
    const costGold = getBuildingUpgradeCost(buildingId, currentLevel);

    if (typeof costGold !== 'number') {
      throw new Error('BUILDING_MAX_LEVEL');
    }

    return {
      key: buildingId,
      currentLevel,
      nextLevel: currentLevel + 1,
      costGold,
      requiredCastleLevel: 1,
      isExtension: false,
    };
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

function getBuildingLevel(buildings: PlayerBuildingStateForUpgrade, buildingId: ClientBuildingUpgradeId): number {
  if (buildingId === 'castle') {
    return buildings.castleLevel;
  }

  if (buildingId === 'vault') {
    return buildings.vaultLevel;
  }

  if (buildingId === 'watchtower') {
    return buildings.watchtowerLevel;
  }

  return 1;
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

  return buildings.pendingClaimTechLevel;
}
