import { Injectable } from '@nestjs/common';
import type { FieldStatus, Prisma } from '@prisma/client';
import { getCastleExtensionLevelConfig, getSeedStageGold } from '../lib/game-balance.js';
import {
  getFactionFarmMatureYieldMultiplier,
  getFactionFarmCollectWindowSeconds,
  type FactionAdvantageCode,
} from '../lib/faction-advantage-formulas.js';
import {
  addSeconds,
  getFieldReadyAt,
  getMatureStartedAt,
} from '../lib/field-timing.js';

interface FieldLifecycleSlot {
  id: string;
  isUnlocked: boolean;
  status: FieldStatus;
  seedAt: Date | null;
  matureAt: Date | null;
  readyAt: Date | null;
  overripeAt: Date | null;
  lastCalculatedAt: Date | null;
  currentClaimableGold: number;
  seedDefinition: {
    seedId: string;
    collectWindowSeconds: number;
  } | null;
}

@Injectable()
export class FieldLifecycleService {
  async settlePlayerFields(client: Prisma.TransactionClient, playerId: string, now: Date = new Date()): Promise<void> {
    const player = await client.player.findUnique({
      where: { id: playerId },
      select: {
        faction: {
          select: {
            code: true,
          },
        },
        buildings: {
          select: {
            farmYieldTechLevel: true,
            collectWindowTechLevel: true,
          },
        },
        fieldSlots: {
          select: {
            id: true,
            isUnlocked: true,
            status: true,
            seedAt: true,
            matureAt: true,
            readyAt: true,
            overripeAt: true,
            lastCalculatedAt: true,
            currentClaimableGold: true,
            seedDefinition: {
              select: {
                seedId: true,
                collectWindowSeconds: true,
              },
            },
          },
        },
      },
    });

    if (!player) {
      return;
    }

    const factionCode = (player.faction?.code ?? null) as FactionAdvantageCode;
    const farmYieldMultiplier = getFarmYieldMultiplier(player.buildings?.farmYieldTechLevel ?? 0);
    const matureWindowBonusSeconds = getMatureWindowBonusSeconds(player.buildings?.collectWindowTechLevel ?? 0);
    const farmMatureYieldMultiplier = getFactionFarmMatureYieldMultiplier(factionCode);

    for (const field of player.fieldSlots) {
      const update = buildFieldLifecycleUpdate(
        field,
        farmYieldMultiplier,
        matureWindowBonusSeconds,
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
  matureWindowBonusSeconds: number,
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
    matureWindowBonusSeconds,
    factionCode,
    farmMatureYieldMultiplier,
    now,
  );
  const changed = next.status !== field.status
    || next.currentClaimableGold !== field.currentClaimableGold
    || !sameDate(next.seedAt, field.seedAt)
    || !sameDate(next.matureAt, field.matureAt)
    || !sameDate(next.readyAt, field.readyAt)
    || !sameDate(next.overripeAt, field.overripeAt);

  if (!changed) {
    return null;
  }

  return {
    status: next.status,
    currentClaimableGold: next.currentClaimableGold,
    seedAt: next.seedAt,
    matureAt: next.matureAt,
    readyAt: next.readyAt,
    overripeAt: next.overripeAt,
    lastCalculatedAt: now,
    statusVersion: { increment: 1 },
  };
}

function settleField(
  field: FieldLifecycleSlot,
  farmYieldMultiplier: number,
  matureWindowBonusSeconds: number,
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
      readyAt: field.readyAt,
      overripeAt: field.overripeAt,
    };
  }

  let status = field.status;
  const seedAt = field.seedAt ?? field.lastCalculatedAt ?? now;
  let matureAt = field.matureAt;
  let readyAt = field.readyAt;
  let overripeAt = field.overripeAt;
  let stageStartedAt = getStageStartedAt(field, now);
  const nowMs = now.getTime();

  while (true) {
    if (status === 'GROWING') {
      const targetReadyAt = getFieldReadyAt(field, seedId, now);

      if (nowMs < targetReadyAt.getTime()) {
        break;
      }

      stageStartedAt = targetReadyAt;
      matureAt = stageStartedAt;
      readyAt = stageStartedAt;
      status = 'MATURE';
      continue;
    }

    if (status === 'MATURE') {
      const witherWindowSeconds = getWitherWindowSeconds(field, matureWindowBonusSeconds, factionCode);

      if (nowMs < stageStartedAt.getTime() + witherWindowSeconds * 1000) {
        break;
      }

      stageStartedAt = addSeconds(stageStartedAt, witherWindowSeconds);
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
    readyAt,
    overripeAt,
  };
}

function getStageStartedAt(field: FieldLifecycleSlot, now: Date): Date {
  if (field.status === 'GROWING') {
    return field.seedAt ?? field.lastCalculatedAt ?? now;
  }

  if (field.status === 'MATURE') {
    return getMatureStartedAt(field, now);
  }

  return field.overripeAt ?? getMatureStartedAt(field, now);
}

function toBalanceStatus(status: FieldStatus): 'growing' | 'mature' | 'withered' {
  if (status === 'GROWING') {
    return 'growing';
  }

  if (status === 'MATURE') {
    return 'mature';
  }

  if (status === 'WITHERED') {
    return 'withered';
  }

  return 'growing';
}

function getWitherWindowSeconds(
  field: FieldLifecycleSlot,
  matureWindowBonusSeconds: number,
  factionCode: FactionAdvantageCode,
): number {
  return getFactionFarmCollectWindowSeconds(
    field.seedDefinition?.collectWindowSeconds ?? 30 * 60,
    matureWindowBonusSeconds,
    factionCode,
  );
}

function getFarmYieldMultiplier(level: number): number {
  const config = getCastleExtensionLevelConfig('farmYieldTech', level);

  if (!config) {
    return 1;
  }

  return 1 + Math.max(config.effectValue, 0) / 100;
}

function getMatureWindowBonusSeconds(level: number): number {
  const config = getCastleExtensionLevelConfig('collectWindowTech', level);

  if (!config) {
    return 0;
  }

  return Math.max(config.effectValue, 0) * 60;
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
