export function parseViteBoolean(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}
