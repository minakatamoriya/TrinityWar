import type {
  ClientBuildingUpgradeId,
  ClientCastleExtensionUpgradeId,
  ClientUpgradeTargetType,
} from '@trinitywar/shared';

export class UpgradeBuildingRequestDto {
  targetType!: ClientUpgradeTargetType;
  buildingId?: ClientBuildingUpgradeId;
  extensionId?: ClientCastleExtensionUpgradeId;
  buildingVersion?: number;
  walletVersion?: number;
  requestIdempotencyKey?: string;
}
