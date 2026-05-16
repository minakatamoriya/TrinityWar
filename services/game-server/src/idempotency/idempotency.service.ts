import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface CreateProcessingIdempotencyRecordInput {
  playerId: string;
  endpointKey: string;
  idempotencyKey: string;
  requestHash: string;
  expiresAt?: Date | null;
}

export interface CompleteIdempotencyRecordInput {
  id: string;
  responseSnapshotJson: Prisma.InputJsonValue;
  businessEntityType?: string | null;
  businessEntityId?: string | null;
}

@Injectable()
export class IdempotencyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findByKey(
    client: Prisma.TransactionClient,
    playerId: string,
    endpointKey: string,
    idempotencyKey: string,
  ) {
    return client.idempotencyRecord.findUnique({
      where: {
        playerId_endpointKey_idempotencyKey: {
          playerId,
          endpointKey,
          idempotencyKey,
        },
      },
    });
  }

  createProcessing(client: Prisma.TransactionClient, input: CreateProcessingIdempotencyRecordInput) {
    return client.idempotencyRecord.create({
      data: {
        playerId: input.playerId,
        endpointKey: input.endpointKey,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        status: 'processing',
        expiresAt: input.expiresAt ?? null,
      },
    });
  }

  markCompleted(client: Prisma.TransactionClient, input: CompleteIdempotencyRecordInput) {
    return client.idempotencyRecord.update({
      where: { id: input.id },
      data: {
        status: 'completed',
        responseSnapshotJson: input.responseSnapshotJson,
        businessEntityType: input.businessEntityType ?? null,
        businessEntityId: input.businessEntityId ?? null,
      },
    });
  }

  markFailed(client: Prisma.TransactionClient, id: string) {
    return client.idempotencyRecord.update({
      where: { id },
      data: { status: 'failed' },
    });
  }

  async runInTransaction<T>(handler: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.transaction(handler);
  }
}
