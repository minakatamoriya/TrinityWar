export function getMillisecondsUntilNextChinaMidnight(): number {
  const now = Date.now();
  const chinaNow = new Date(now + 8 * 60 * 60 * 1000);
  const nextMidnightUtc = Date.UTC(
    chinaNow.getUTCFullYear(),
    chinaNow.getUTCMonth(),
    chinaNow.getUTCDate() + 1,
    -8,
    0,
    2,
  );

  return Math.max(nextMidnightUtc - now, 1000);
}
