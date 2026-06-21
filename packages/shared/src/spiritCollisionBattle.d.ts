import type { ClientRaidBattleReplay, ClientRaidRewardItem, ClientSpiritElement } from './index.js';
export type SpiritCollisionBattleResult = 'WIN' | 'LOSS';
export type SpiritCollisionBattleSide = 'attacker' | 'defender';
export interface SpiritCollisionTraitInput {
    code: string;
    label: string;
    value: number;
}
export interface SpiritCollisionUnitInput {
    side: SpiritCollisionBattleSide;
    playerName: string;
    spiritId: string | null;
    spiritName: string;
    rarity: string | null;
    element: ClientSpiritElement | null;
    level: number;
    attack: number;
    maxHp: number;
    traits?: SpiritCollisionTraitInput[];
}
export interface SpiritCollisionBattleConfig {
    maxRounds: number;
    baseStealRatio: number;
    defenderLostHpStealFactor: number;
    attackerWinBonus: number;
    minStealRatio: number;
    maxStealRatio: number;
    minDamageByTargetMaxHpRatio: number;
    bloodModeInitialHpLossRatio: number;
    bloodModeHpLossRatioIncrement: number;
    maxBloodModeRounds: number;
    clashDurationMs: number;
    hpChangeDurationMs: number;
    returnDurationMs: number;
    noticeDurationMs: number;
}
export interface SpiritCollisionBattleInput {
    orderId: string;
    attacker: SpiritCollisionUnitInput;
    defender: SpiritCollisionUnitInput;
    seed?: number;
    config?: Partial<SpiritCollisionBattleConfig>;
    goldPool?: number;
    rewards?: ClientRaidRewardItem[];
}
export declare const DEFAULT_SPIRIT_COLLISION_BATTLE_CONFIG: SpiritCollisionBattleConfig;
export declare function buildSpiritCollisionBattleReplay(input: SpiritCollisionBattleInput): ClientRaidBattleReplay;
