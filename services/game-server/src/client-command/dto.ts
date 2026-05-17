import type {
  ClientClaimDailyTaskRequest,
  ClientClaimPendingRequest,
  ClientCollectFieldRequest,
  ClientBuildingUpgradeId,
  ClientCastleExtensionUpgradeId,
  ClientRecruitArmyRequest,
  ClientUpgradeTargetType,
} from '@trinitywar/shared';

export class ClaimPendingRequestDto implements ClientClaimPendingRequest {
  source!: 'tax' | 'faction' | 'raid-overflow';
  acceptOverflowLoss?: boolean;
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

export class CollectFieldRequestDto implements ClientCollectFieldRequest {
  fieldId!: string;
  collectMode!: 'ripe' | 'early';
  fieldVersion?: number;
  walletVersion?: number;
  requestIdempotencyKey?: string;
}

export class UpgradeBuildingRequestDto {
  targetType!: ClientUpgradeTargetType;
  buildingId?: ClientBuildingUpgradeId;
  extensionId?: ClientCastleExtensionUpgradeId;
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
