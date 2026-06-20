import type { ClientRaidBattleFloatingTone, ClientRaidBattleReplay } from '@trinitywar/shared';

export type RaidBattleReplay = ClientRaidBattleReplay;
export type RaidBattleSide = ClientRaidBattleReplay['attacker']['side'];
export type RaidBattlePhase = 'enter' | 'notice' | 'clash' | 'damage' | 'return' | 'result';

export interface BattlePlaybackState {
  phase: RaidBattlePhase;
  attackerHp: number;
  defenderHp: number;
  floatingTexts: Array<{
    id: string;
    side: RaidBattleSide;
    text: string;
    tone: ClientRaidBattleFloatingTone;
  }>;
  notice: {
    title: string;
    summary?: string;
    tone: 'default' | 'blood';
  } | null;
  resultVisible: boolean;
}
