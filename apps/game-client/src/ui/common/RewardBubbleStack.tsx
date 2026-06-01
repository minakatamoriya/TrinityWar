export type RewardBubbleTone = 'gold' | 'essence' | 'spirit' | 'item';

export interface RewardBubbleItem {
  id: number;
  label: string;
  quantity: number;
  tone: RewardBubbleTone;
}

interface RewardBubbleStackProps {
  bubbles: RewardBubbleItem[];
  formatNumber: (value: number) => string;
}

export function RewardBubbleStack({ bubbles, formatNumber }: RewardBubbleStackProps): JSX.Element | null {
  if (bubbles.length === 0) {
    return null;
  }

  return (
    <div className="reward-bubble-stack" aria-live="polite">
      {bubbles.map((bubble) => (
        <div className={`reward-bubble reward-bubble-${bubble.tone}`} key={bubble.id}>
          <span>+{formatNumber(bubble.quantity)}</span>
          <strong>{bubble.label}</strong>
        </div>
      ))}
    </div>
  );
}
