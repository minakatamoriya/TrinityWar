import type {
  ClientBuySpiritSoulRequest,
  ClientBreakthroughSpiritRequest,
  ClientBuySpiritShopItemRequest,
  ClientClaimSpiritAdRewardRequest,
  ClientComposeSpiritRequest,
  ClientDissolveSpiritRequest,
  ClientFeedSpiritRequest,
  ClientRecoverSpiritRequest,
  ClientRollSpiritTraitsRequest,
  ClientSetMainSpiritRequest,
  ClientUpgradeSpiritRequest,
} from '@trinitywar/shared';

export class BuySpiritSoulRequestDto implements ClientBuySpiritSoulRequest {
  goldAmount!: number;
  walletVersion?: number;
  resourceVersion?: number;
  requestIdempotencyKey?: string;
}

export class UpgradeSpiritRequestDto implements ClientUpgradeSpiritRequest {
  slotIndex!: number;
  slotVersion?: number;
  resourceVersion?: number;
  requestIdempotencyKey?: string;
}

export class SetMainSpiritRequestDto implements ClientSetMainSpiritRequest {
  slotIndex!: number;
  slotVersion?: number;
  requestIdempotencyKey?: string;
}

export class RecoverSpiritRequestDto implements ClientRecoverSpiritRequest {
  slotIndex!: number;
  slotVersion?: number;
  resourceVersion?: number;
  requestIdempotencyKey?: string;
}

export class DissolveSpiritRequestDto implements ClientDissolveSpiritRequest {
  slotIndex!: number;
  slotVersion?: number;
  requestIdempotencyKey?: string;
}

export class ComposeSpiritRequestDto implements ClientComposeSpiritRequest {
  spiritId!: string;
  slotIndex!: number;
  element!: ClientComposeSpiritRequest['element'];
  requestIdempotencyKey?: string;
}

export class FeedSpiritRequestDto implements ClientFeedSpiritRequest {
  slotIndex!: number;
  actionType!: ClientFeedSpiritRequest['actionType'];
  slotVersion?: number;
  resourceVersion?: number;
  requestIdempotencyKey?: string;
}

export class BreakthroughSpiritRequestDto implements ClientBreakthroughSpiritRequest {
  slotIndex!: number;
  targetStage?: number;
  slotVersion?: number;
  resourceVersion?: number;
  requestIdempotencyKey?: string;
}

export class RollSpiritTraitsRequestDto implements ClientRollSpiritTraitsRequest {
  slotIndex!: number;
  mode!: ClientRollSpiritTraitsRequest['mode'];
  lockedSlotIndex?: number;
  targetSlotIndex?: number;
  targetTraitCode?: ClientRollSpiritTraitsRequest['targetTraitCode'];
  slotVersion?: number;
  walletVersion?: number;
  resourceVersion?: number;
  requestIdempotencyKey?: string;
}

export class BuySpiritShopItemRequestDto implements ClientBuySpiritShopItemRequest {
  itemId!: string;
  resourceVersion?: number;
  requestIdempotencyKey?: string;
}

export class ClaimSpiritAdRewardRequestDto implements ClientClaimSpiritAdRewardRequest {
  resourceVersion?: number;
  requestIdempotencyKey?: string;
}
