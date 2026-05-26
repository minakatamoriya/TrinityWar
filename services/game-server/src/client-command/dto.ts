import type {
  ClientClaimStarterSeedRequest,
  ClientClaimDailyTaskRequest,
  ClientClaimPendingRequest,
  ClientClaimFactionStipendRequest,
  ClientCollectFieldRequest,
  ClientFactionDonateRequest,
  ClientBuildingUpgradeId,
  ClientCastleExtensionUpgradeId,
  ClientTerritoryUpgradeId,
  ClientRecruitArmyRequest,
  ClientRaidActionRequest,
  ClientStartCultivationRequest,
  ClientUpgradeTargetType,
} from '@trinitywar/shared';

export class ClaimPendingRequestDto implements ClientClaimPendingRequest {
  source!: 'tax' | 'faction' | 'raid-overflow';
  acceptOverflowLoss?: boolean;
  walletVersion?: number;
  requestIdempotencyKey?: string;
}

export class FactionDonateRequestDto implements ClientFactionDonateRequest {
  goldAmount!: number;
}

export class ClaimFactionStipendRequestDto implements ClientClaimFactionStipendRequest {
  walletVersion?: number;
  requestIdempotencyKey?: string;
}

export class ClaimDailyTaskRequestDto implements ClientClaimDailyTaskRequest {
  taskId!: string;
  acceptOverflowLoss?: boolean;
  taskDateKey?: string;
  walletVersion?: number;
  requestIdempotencyKey?: string;
}

export class ClaimStarterSeedRequestDto implements ClientClaimStarterSeedRequest {
  requestIdempotencyKey?: string;
}

export class CollectFieldRequestDto implements ClientCollectFieldRequest {
  fieldId!: string;
  collectMode!: 'ripe' | 'early';
  fieldVersion?: number;
  walletVersion?: number;
  requestIdempotencyKey?: string;
}

export class StartCultivationRequestDto implements ClientStartCultivationRequest {
  fieldId!: string;
  seedId!: string;
}

export class UpgradeBuildingRequestDto {
  targetType!: ClientUpgradeTargetType;
  buildingId?: ClientBuildingUpgradeId;
  extensionId?: ClientCastleExtensionUpgradeId;
  territoryUpgradeId?: ClientTerritoryUpgradeId;
  buildingVersion?: number;
  walletVersion?: number;
  requestIdempotencyKey?: string;
}

export class RecruitArmyRequestDto implements ClientRecruitArmyRequest {
  recruitCount!: number;
  armyVersion?: number;
  walletVersion?: number;
  requestIdempotencyKey?: string;
}

export class RaidTargetRequestDto implements ClientRaidActionRequest {
  targetId!: string;
  mode?: 'raid' | 'revenge';
  armyVersion?: number;
  requestIdempotencyKey?: string;
}
