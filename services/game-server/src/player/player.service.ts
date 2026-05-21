import { Inject, Injectable } from '@nestjs/common';
import {
  APP_NAME,
  type ClientFarmBoardState,
  type ClientFarmBoardUpdateRequest,
  type ClientFarmBoardUpdateResponse,
} from '@trinitywar/shared';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
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

  async getFarmBoard(playerId: string): Promise<ClientFarmBoardState> {
    const board = await this.prisma.db.playerFarmBoard.upsert({
      where: { playerId },
      create: {
        playerId,
        message: '',
        boardVersion: 1,
      },
      update: {},
    });

    return toFarmBoardState(board);
  }

  async updateFarmBoard(
    playerId: string,
    request: ClientFarmBoardUpdateRequest,
  ): Promise<ClientFarmBoardUpdateResponse> {
    const message = normalizeFarmBoardMessage(request.message);

    const board = await this.prisma.transaction(async (client) => {
      const currentBoard = await client.playerFarmBoard.upsert({
        where: { playerId },
        create: {
          playerId,
          message: '',
          boardVersion: 1,
        },
        update: {},
      });

      if (typeof request.farmBoardVersion === 'number' && request.farmBoardVersion !== currentBoard.boardVersion) {
        throw new BusinessError({
          code: ErrorCode.StateVersionConflict,
          message: 'farmBoardVersion conflict.',
          statusCode: 409,
          details: { expected: request.farmBoardVersion, actual: currentBoard.boardVersion },
        });
      }

      return client.playerFarmBoard.update({
        where: { playerId },
        data: {
          message,
          hiddenAt: null,
          boardVersion: { increment: 1 },
        },
      });
    });

    return {
      app: APP_NAME,
      summary: 'Farm board message updated.',
      board: toFarmBoardState(board),
    };
  }
}

function toFarmBoardState(board: {
  message: string;
  updatedAt: Date;
  boardVersion: number;
  hiddenAt: Date | null;
}): ClientFarmBoardState {
  return {
    farmBoardMessage: board.hiddenAt ? '' : board.message,
    farmBoardUpdatedAt: board.updatedAt.toISOString(),
    farmBoardVersion: board.boardVersion,
  };
}

function normalizeFarmBoardMessage(rawMessage: unknown): string {
  if (typeof rawMessage !== 'string') {
    throwBadFarmBoardMessage('Farm board message is required.');
  }

  const message = rawMessage.trim().replace(/\s+/g, ' ');

  if (message.length <= 0) {
    throwBadFarmBoardMessage('Farm board message cannot be blank.');
  }

  if (message.length > 40) {
    throwBadFarmBoardMessage('Farm board message must be 40 characters or fewer.');
  }

  if (/https?:\/\/|www\.|@|微信|QQ|电话|手机|vx|wechat/i.test(message)) {
    throwBadFarmBoardMessage('Farm board message cannot contain links or contact information.');
  }

  if (!/^[\p{Script=Han}A-Za-z0-9，。！？、,.!?·\-\s]+$/u.test(message)) {
    throwBadFarmBoardMessage('Farm board message contains unsupported characters.');
  }

  return message;
}

function throwBadFarmBoardMessage(message: string): never {
  throw new BusinessError({
    code: ErrorCode.BadRequest,
    message,
    statusCode: 400,
  });
}
