import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { BusinessError, ErrorCode } from '../common/errors/index.js';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private client: PrismaClient | null = null;

  get db(): PrismaClient {
    return this.getClient();
  }

  async transaction<T>(handler: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.getClient().$transaction(handler);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.$disconnect();
    }
  }

  private getClient(): PrismaClient {
    if (this.client) {
      return this.client;
    }

    try {
      this.client = new PrismaClient({
        log: ['error', 'warn'],
      });
      return this.client;
    } catch (error) {
      throw new BusinessError({
        code: ErrorCode.PrismaClientUnavailable,
        message: 'Prisma Client is not available. Run prisma generate after schema models are added.',
        statusCode: 500,
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
