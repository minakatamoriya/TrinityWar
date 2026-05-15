import { Inject, Injectable } from '@nestjs/common';
import { APP_NAME } from '@trinitywar/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CurrentPlayerContext } from '../auth/current-player-context.js';

export interface CurrentPlayerResponse {
  app: string;
  player: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
    faction: {
      id: string;
      code: string;
      name: string;
    } | null;
    castleLevel: number;
    lastLoginAt: string | null;
    stateVersion: number;
  };
  auth: {
    provider?: 'DEV_FAKE' | 'WECHAT';
    providerUserId?: string;
    tokenExpiresAt?: string;
  };
}

@Injectable()
export class PlayerService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getCurrentPlayer(context: CurrentPlayerContext): Promise<CurrentPlayerResponse> {
    const player = await this.prisma.db.player.findUniqueOrThrow({
      where: { id: context.playerId },
      include: {
        faction: true,
        buildings: true,
      },
    });

    return {
      app: APP_NAME,
      player: {
        id: player.id,
        nickname: player.nickname,
        avatarUrl: player.avatarUrl,
        faction: player.faction
          ? {
            id: player.faction.id,
            code: player.faction.code,
            name: player.faction.name,
          }
          : null,
        castleLevel: player.buildings?.castleLevel ?? player.castleLevelCache,
        lastLoginAt: player.lastLoginAt?.toISOString() ?? null,
        stateVersion: player.stateVersion,
      },
      auth: {
        provider: context.provider,
        providerUserId: context.providerUserId,
        tokenExpiresAt: context.tokenExpiresAt,
      },
    };
  }
}
