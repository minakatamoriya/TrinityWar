import { Inject, Injectable } from '@nestjs/common';
import { APP_NAME } from '@trinitywar/shared';
import { Prisma } from '@prisma/client';
import { BusinessError, ErrorCode } from '../common/errors/index.js';
import { AppConfigService } from '../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlayerInitializationService } from '../seed/player-initialization.service.js';
import { AuthTokenService } from './auth-token.service.js';

export interface DevLoginRequestBody {
  providerUserId?: string;
  nickname?: string;
  factionCode?: string;
}

export interface DevLoginResponse {
  app: string;
  accessToken: string;
  expiresAt: string;
  player: CurrentPlayerSummary;
}

export interface CurrentPlayerSummary {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  faction: {
    id: string;
    code: string;
    name: string;
  } | null;
  castleLevel: number;
  auth: {
    provider: 'DEV_FAKE' | 'WECHAT';
    providerUserId: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PlayerInitializationService) private readonly playerInitializationService: PlayerInitializationService,
    @Inject(AuthTokenService) private readonly authTokenService: AuthTokenService,
  ) {}

  async devLogin(input: DevLoginRequestBody): Promise<DevLoginResponse> {
    if (!['development', 'test'].includes(this.config.nodeEnv)) {
      throw new BusinessError({
        code: ErrorCode.Forbidden,
        message: 'Development login is only available in development and test environments.',
        statusCode: 403,
      });
    }

    const providerUserId = normalizeProviderUserId(input.providerUserId);
    const nickname = input.nickname?.trim() || providerUserId;
    const factionCode = input.factionCode?.trim() || 'human';

    const result = await this.prisma.transaction(async (client) => {
      const faction = await client.faction.findUniqueOrThrow({
        where: { code: factionCode },
      });
      const existingIdentity = await client.playerAuthIdentity.findUnique({
        where: {
          provider_providerUserId: {
            provider: 'DEV_FAKE',
            providerUserId,
          },
        },
        include: { player: true },
      });

      const player = existingIdentity
        ? await client.player.update({
          where: { id: existingIdentity.playerId },
          data: {
            lastLoginAt: new Date(),
          },
        })
        : await client.player.create({
          data: {
            nickname,
            factionId: faction.id,
            castleLevelCache: 1,
            lastLoginAt: new Date(),
            authIdentities: {
              create: {
                provider: 'DEV_FAKE',
                providerUserId,
              },
            },
            factionMembers: {
              create: {
                factionId: faction.id,
                contributionScore: 0,
              },
            },
          },
        });

      await this.playerInitializationService.initialize(client, {
        playerId: player.id,
        castleLevel: player.castleLevelCache,
      });

      const authIdentity = existingIdentity
        ?? await client.playerAuthIdentity.findUniqueOrThrow({
          where: {
            provider_providerUserId: {
              provider: 'DEV_FAKE',
              providerUserId,
            },
          },
        });

      const summary = await getCurrentPlayerSummary(client, player.id, authIdentity.id, providerUserId);

      return {
        authIdentityId: authIdentity.id,
        summary,
      };
    });

    const token = this.authTokenService.issueAccessToken({
      playerId: result.summary.id,
      authIdentityId: result.authIdentityId,
      provider: 'DEV_FAKE',
      providerUserId,
    });

    return {
      app: APP_NAME,
      accessToken: token.accessToken,
      expiresAt: token.expiresAt,
      player: result.summary,
    };
  }
}

function normalizeProviderUserId(providerUserId: string | undefined): string {
  const normalized = providerUserId?.trim() || 'dev-newbie';

  if (!/^[a-zA-Z0-9._:-]{3,64}$/.test(normalized)) {
    throw new BusinessError({
      code: ErrorCode.BadRequest,
      message: 'providerUserId must be 3-64 characters and contain only letters, numbers, dot, underscore, colon or hyphen.',
      statusCode: 400,
    });
  }

  return normalized;
}

async function getCurrentPlayerSummary(
  client: Prisma.TransactionClient,
  playerId: string,
  authIdentityId: string,
  providerUserId: string,
): Promise<CurrentPlayerSummary> {
  void authIdentityId;

  const player = await client.player.findUniqueOrThrow({
    where: { id: playerId },
    include: {
      faction: true,
      buildings: true,
    },
  });

  return {
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
    auth: {
      provider: 'DEV_FAKE',
      providerUserId,
    },
  };
}
