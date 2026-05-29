import { Injectable } from '@nestjs/common';
import type { ClientBuildingUpgradeId, ClientCastleExtensionUpgradeId } from '@trinitywar/shared';
import {
  getCastleExtensionLevelConfig,
  getCastleExtensionTrack,
} from '../lib/game-balance.js';

export interface BuildingUpgradeTarget {
  key: ClientBuildingUpgradeId | ClientCastleExtensionUpgradeId;
  title: string;
  currentLevel: number;
  nextLevel: number;
  costResource: 'gold' | 'tianjiTalisman';
  costAmount: number;
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
  collectWindowTechLevel: number;
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
    const nextLevel = currentLevel + 1;
    const nextLevelConfig = getCastleExtensionLevelConfig(extensionId, nextLevel);

    if (!track || !nextLevelConfig || nextLevelConfig.level !== nextLevel) {
      throw new Error('BUILDING_MAX_LEVEL');
    }

    const costResource = nextLevelConfig.costResource === 'tianjiTalisman' ? 'tianjiTalisman' : 'gold';
    const costAmount = Math.max(Math.floor(nextLevelConfig.costAmount ?? nextLevelConfig.upgradeCost ?? 0), 0);

    return {
      key: extensionId,
      title: track.title ?? extensionId,
      currentLevel,
      nextLevel,
      costResource,
      costAmount,
      costGold: costResource === 'gold' ? costAmount : 0,
      requiredCastleLevel: nextLevelConfig.requiredCastleLevel ?? 1,
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

  if (extensionId === 'collectWindowTech') {
    return buildings.collectWindowTechLevel;
  }

  if (extensionId === 'factionOfferingTech') {
    return buildings.pendingClaimTechLevel;
  }

  return buildings.pendingClaimTechLevel;
}
