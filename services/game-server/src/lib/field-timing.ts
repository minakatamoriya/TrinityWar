import { getSeedStageSeconds } from './game-balance.js';

export interface FieldTimingProjection {
  seedAt: Date | null;
  matureAt: Date | null;
  readyAt: Date | null;
  lastCalculatedAt?: Date | null;
}

export interface FieldReadyAtUpdate {
  matureAt: Date;
  readyAt: Date;
}

export function getCultivationSeconds(seedId: string): number {
  return getSeedStageSeconds(seedId, 'seeded') + getSeedStageSeconds(seedId, 'growing');
}

export function getFieldCultivationStartedAt(field: FieldTimingProjection, now: Date): Date {
  return field.seedAt ?? field.lastCalculatedAt ?? now;
}

export function getFieldReadyAt(field: FieldTimingProjection, seedId: string, now: Date): Date {
  const startedAt = getFieldCultivationStartedAt(field, now);
  return field.readyAt
    ?? field.matureAt
    ?? addSeconds(startedAt, getCultivationSeconds(seedId));
}

export function getLegacyGrowingReadyAt(field: FieldTimingProjection, seedId: string, now: Date): Date {
  const startedAt = field.matureAt ?? getFieldCultivationStartedAt(field, now);
  return field.readyAt ?? addSeconds(startedAt, getSeedStageSeconds(seedId, 'growing'));
}

export function getMatureStartedAt(field: FieldTimingProjection, now: Date): Date {
  return field.readyAt ?? field.matureAt ?? field.seedAt ?? field.lastCalculatedAt ?? now;
}

export function buildFieldReadyAtUpdate(readyAt: Date): FieldReadyAtUpdate {
  return {
    matureAt: readyAt,
    readyAt: readyAt,
  };
}

export function addSeconds(source: Date, seconds: number): Date {
  return new Date(source.getTime() + Math.max(Math.floor(seconds), 0) * 1000);
}
