export function parseNumberText(value: string): number {
  const normalized = value.replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  return normalized ? Number(normalized) : 0;
}

export function parseCurrentAndCapacity(value: string): { current: number; capacity: number } {
  const [currentText = '0', capacityText = '0'] = value.split('/');

  return {
    current: parseNumberText(currentText),
    capacity: parseNumberText(capacityText),
  };
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
