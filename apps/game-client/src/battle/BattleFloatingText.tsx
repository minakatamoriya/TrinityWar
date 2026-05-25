import type { BattlePlaybackState } from './battleTypes';

interface BattleFloatingTextProps {
  texts: BattlePlaybackState['floatingTexts'];
  side: 'attacker' | 'defender';
}

export function BattleFloatingText(props: BattleFloatingTextProps): JSX.Element {
  const sideTexts = props.texts.filter((item) => item.side === props.side);

  return (
    <div className={`battle-floating-stack ${props.side}`}>
      {sideTexts.map((item) => (
        <span className={`battle-floating-text ${item.tone}`} key={item.id}>
          {item.text}
        </span>
      ))}
    </div>
  );
}
