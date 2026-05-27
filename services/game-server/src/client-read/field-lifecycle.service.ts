import { Injectable } from '@nestjs/common';
import type { FieldStatus, Prisma } from '@prisma/client';
import { getCastleExtensionLevelConfig, getSeedStageGold, getSeedStageSeconds } from '../lib/game-balance.js';
import { getFactionFarmMatureYieldMultiplier, getFactionFarmRipeWindowSeconds, type FactionAdvantageCode } from '../lib/faction-advantage-formulas.js';

interface FieldLifecycleSlot {
  id: string;
  isUnlocked: boolean;
  status: FieldStatus;
  seedAt: Date | null;
  matureAt: Date | null;
  fullMatureAt: Date | null;
  overripeAt: Date | null;
  lastCalculatedAt: Date | null;
  currentClaimableGold: number;
  seedDefinition: {
    seedId: string;
    ripeWindowSeconds: number;
  } | null;
}

@Injectable()
export class FieldLifecycleService {
  async settlePlayerFields(client: Prisma.TransactionClient, playerId: string, now: Date = new Date()): Promise<void> {
    const player = await client.player.findUnique({
      where: { id: playerId },
      select: {
        buildings: {
          select: {
            farmYieldTechLevel: true,
            ripeWindowTechLevel: true,
          },
        },
        faction: {
          select: {
            code: true,
          },
        },
        fieldSlots: {
          select: {
            id: true,
            isUnlocked: true,
            status: true,
            seedAt: true,
            matureAt: true,
            fullMatureAt: true,
            overripeAt: true,
            lastCalculatedAt: true,
            currentClaimableGold: true,
            seedDefinition: {
              select: {
                seedId: true,
                ripeWindowSeconds: true,
              },
            },
          },
        },
      },
    });

    if (!player) {
      return;
    }

    const farmYieldMultiplier = getFarmYieldMultiplier(player.buildings?.farmYieldTechLevel ?? 0);
    const ripeWindowBonusSeconds = getRipeWindowBonusSeconds(player.buildings?.ripeWindowTechLevel ?? 0);
    const factionCode = (player.faction?.code ?? null) as FactionAdvantageCode;
    const farmMatureYieldMultiplier = getFactionFarmMatureYieldMultiplier(factionCode);

    for (const field of player.fieldSlots) {
      const update = buildFieldLifecycleUpdate(
        field,
        farmYieldMultiplier,
        ripeWindowBonusSeconds,
        factionCode,
        farmMatureYieldMultiplier,
        now,
      );

      if (!update) {
        continue;
      }

      await client.playerFieldSlot.update({
        where: { id: field.id },
        data: update,
      });
    }
  }
}

function buildFieldLifecycleUpdate(
  field: FieldLifecycleSlot,
  farmYieldMultiplier: number,
  ripeWindowBonusSeconds: number,
  factionCode: FactionAdvantageCode,
  farmMatureYieldMultiplier: number,
  now: Date,
): Prisma.PlayerFieldSlotUpdateInput | null {
  if (!field.isUnlocked || !field.seedDefinition || field.status === 'LOCKED' || field.status === 'EMPTY') {
    return null;
  }

  const next = settleField(
    field,
    farmYieldMultiplier,
    ripeWindowBonusSeconds,
    factionCode,
    farmMatureYieldMultiplier,
    now,
  );
  const changed = next.status !== field.status
    || next.currentClaimableGold !== field.currentClaimableGold
    || !sameDate(next.seedAt, field.seedAt)
    || !sameDate(next.matureAt, field.matureAt)
    || !sameDate(next.fullMatureAt, field.fullMatureAt)
    || !sameDate(next.overripeAt, field.overripeAt);

  if (!changed) {
    return null;
  }

  return {
    status: next.status,
    currentClaimableGold: next.currentClaimableGold,
    seedAt: next.seedAt,
    matureAt: next.matureAt,
    fullMatureAt: next.fullMatureAt,
    overripeAt: next.overripeAt,
    lastCalculatedAt: now,
    statusVersion: { increment: 1 },
  };
}

function settleField(
  field: FieldLifecycleSlot,
  farmYieldMultiplier: number,
  ripeWindowBonusSeconds: number,
  factionCode: FactionAdvantageCode,
  farmMatureYieldMultiplier: number,
  now: Date,
) {
  const seedId = field.seedDefinition?.seedId;

  if (!seedId) {
    return {
      status: field.status,
      currentClaimableGold: field.currentClaimableGold,
      seedAt: field.seedAt,
      matureAt: field.matureAt,
      fullMatureAt: field.fullMatureAt,
      overripeAt: field.overripeAt,
    };
  }

  let status = field.status;
  const seedAt = field.seedAt ?? field.lastCalculatedAt ?? now;
  let matureAt = field.matureAt;
  let fullMatureAt = field.fullMatureAt;
  let overripeAt = field.overripeAt;
  let stageStartedAt = getStageStartedAt(field, now);
  const nowMs = now.getTime();

  while (true) {
    if (status === 'SEEDED') {
      const seededSeconds = getSeedStageSeconds(seedId, 'seeded');

      if (nowMs < stageStartedAt.getTime() + seededSeconds * 1000) {
        break;
      }

      stageStartedAt = addSeconds(stageStartedAt, seededSeconds);
      matureAt = stageStartedAt;
      status = 'GROWING';
      continue;
    }

    if (status === 'GROWING') {
      const growingSeconds = getSeedStageSeconds(seedId, 'growing');

      if (nowMs < stageStartedAt.getTime() + growingSeconds * 1000) {
        break;
      }

      stageStartedAt = addSeconds(stageStartedAt, growingSeconds);
      fullMatureAt = stageStartedAt;
      status = 'MATURE';
      continue;
    }

    if (status === 'MATURE') {
      const ripeWindowSeconds = getFactionFarmRipeWindowSeconds(
        field.seedDefinition?.ripeWindowSeconds ?? 0,
        ripeWindowBonusSeconds,
        factionCode,
      );

      if (nowMs < stageStartedAt.getTime() + ripeWindowSeconds * 1000) {
        break;
      }

      stageStartedAt = addSeconds(stageStartedAt, ripeWindowSeconds);
      overripeAt = stageStartedAt;
      status = 'WITHERED';
      break;
    }

    break;
  }

  return {
    status,
    currentClaimableGold: Math.round(
      getSeedStageGold(seedId, toBalanceStatus(status))
      * farmYieldMultiplier
      * (status === 'MATURE' ? farmMatureYieldMultiplier : 1),
    ),
    seedAt,
    matureAt,
    fullMatureAt,
    overripeAt,
  };
}

function getStageStartedAt(field: FieldLifecycleSlot, now: Date): Date {
  if (field.status === 'SEEDED') {
    return field.seedAt ?? field.lastCalculatedAt ?? now;
  }

  if (field.status === 'GROWING') {
    return field.matureAt ?? field.seedAt ?? field.lastCalculatedAt ?? now;
  }

  if (field.status === 'MATURE') {
    return field.fullMatureAt ?? field.matureAt ?? field.seedAt ?? field.lastCalculatedAt ?? now;
  }

  return field.overripeAt ?? field.fullMatureAt ?? field.matureAt ?? field.seedAt ?? field.lastCalculatedAt ?? now;
}

function getFarmYieldMultiplier(farmYieldTechLevel: number): number {
  const config = getCastleExtensionLevelConfig('farmYieldTech', farmYieldTechLevel);
  return 1 + (config?.effectValue ?? 0) / 100;
}

function getRipeWindowBonusSeconds(ripeWindowTechLevel: number): number {
  const config = getCastleExtensionLevelConfig('ripeWindowTech', ripeWindowTechLevel);
  return (config?.effectValue ?? 0) * 60;
}

function toBalanceStatus(status: FieldStatus): 'seeded' | 'growing' | 'mature' | 'withered' {
  if (status === 'GROWING') {
    return 'growing';
  }

  if (status === 'MATURE') {
    return 'mature';
  }

  if (status === 'WITHERED') {
    return 'withered';
  }

  return 'seeded';
}

function addSeconds(source: Date, seconds: number): Date {
  return new Date(source.getTime() + Math.max(Math.floor(seconds), 0) * 1000);
}

function sameDate(left: Date | null, right: Date | null): boolean {
  if (left === null && right === null) {
    return true;
  }

  if (left === null || right === null) {
    return false;
  }

  return left.getTime() === right.getTime();
}
