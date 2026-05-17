import { Injectable } from '@nestjs/common';

export interface RaidSettlementRuleInput {
  lockedGold: number;
  dispatchedUnitCount: number;
  attackerAvailableAtDispatch: number;
  defenderSnapshotPower: number;
  vaultGold: number;
  vaultCapacity: number;
}

export interface RaidSettlementRuleResult {
  result: 'WIN' | 'LOSS' | 'DRAW';
  lootGold: number;
  depositedGold: number;
  overflowGold: number;
  attackerLoss: number;
  defenderLoss: number;
  reportSummary: string;
}

@Injectable()
export class RaidSettlementRuleService {
  calculate(input: RaidSettlementRuleInput): RaidSettlementRuleResult {
    const dispatchedUnitCount = Math.max(Math.floor(input.dispatchedUnitCount), 0);
    const lockedGold = Math.max(Math.floor(input.lockedGold), 0);
    const defenderSnapshotPower = Math.max(Math.floor(input.defenderSnapshotPower), 1);
    const attackerPower = Math.max(dispatchedUnitCount * 10, 1);
    const winRatio = attackerPower / (attackerPower + defenderSnapshotPower);
    const result: RaidSettlementRuleResult['result'] = winRatio >= 0.45 ? 'WIN' : 'LOSS';
    const lootRatio = result === 'WIN' ? Math.min(0.75, Math.max(0.25, winRatio)) : 0;
    const lootGold = Math.min(lockedGold, Math.floor(lockedGold * lootRatio));
    const availableVaultSpace = Math.max(input.vaultCapacity - input.vaultGold, 0);
    const depositedGold = Math.min(lootGold, availableVaultSpace);
    const overflowGold = Math.max(lootGold - depositedGold, 0);
    const attackerLoss = Math.min(dispatchedUnitCount, Math.max(1, Math.ceil(dispatchedUnitCount * (result === 'WIN' ? 0.1 : 0.25))));
    const defenderLoss = result === 'WIN' ? Math.max(1, Math.ceil(attackerLoss * 0.5)) : 0;

    return {
      result,
      lootGold,
      depositedGold,
      overflowGold,
      attackerLoss,
      defenderLoss,
      reportSummary: result === 'WIN'
        ? `掠夺结算完成，带回 ${lootGold} 金币，战损 ${attackerLoss}。`
        : `掠夺结算完成，未能带回金币，战损 ${attackerLoss}。`,
    };
  }
}
