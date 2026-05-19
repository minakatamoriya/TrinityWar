import type {
  ClientBuySpiritSoulRequest,
  ClientComposeSpiritRequest,
  ClientDissolveSpiritRequest,
  ClientRecoverSpiritRequest,
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