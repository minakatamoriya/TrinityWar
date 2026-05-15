import { Injectable } from '@nestjs/common';

@Injectable()
export class AppConfigService {
  get nodeEnv(): string {
    return process.env.NODE_ENV ?? 'development';
  }

  get host(): string {
    return process.env.HOST ?? '0.0.0.0';
  }

  get port(): number {
    const parsedPort = Number(process.env.PORT ?? 3000);

    if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
      throw new Error(`Invalid PORT value: ${process.env.PORT}`);
    }

    return parsedPort;
  }

  get databaseUrl(): string | undefined {
    return process.env.DATABASE_URL;
  }

  get redisUrl(): string {
    return process.env.REDIS_URL ?? 'redis://localhost:6379';
  }

  get logLevel(): string {
    return process.env.LOG_LEVEL ?? 'info';
  }

  get authTokenSecret(): string {
    return process.env.AUTH_TOKEN_SECRET ?? 'trinitywar-local-dev-secret';
  }

  get authTokenTtlSeconds(): number {
    const parsedTtl = Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24);

    if (!Number.isInteger(parsedTtl) || parsedTtl <= 0) {
      throw new Error(`Invalid AUTH_TOKEN_TTL_SECONDS value: ${process.env.AUTH_TOKEN_TTL_SECONDS}`);
    }

    return parsedTtl;
  }
}
