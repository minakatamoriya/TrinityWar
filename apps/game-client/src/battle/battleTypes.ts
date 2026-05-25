import type { ClientRaidBattleReplay } from '@trinitywar/shared';

export type RaidBattleReplay = ClientRaidBattleReplay;
export type RaidBattleSide = ClientRaidBattleReplay['attacker']['side'];
export type RaidBattlePhase = 'enter' | 'clash' | 'damage' | 'return' | 'result';

export interface BattlePlaybackState {
  phase: RaidBattlePhase;
  attackerHp: number;
  defenderHp: number;
  floatingTexts: Array<{
    id: string;
    side: RaidBattleSide;
    text: string;
    tone: 'damage' | 'miss' | 'crit' | 'buff';
  }>;
  resultVisible: boolean;
}
