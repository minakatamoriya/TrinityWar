import type { Prisma } from '@prisma/client';

export async function grantFactionContribution(
  client: Prisma.TransactionClient,
  input: {
    playerId: string;
    contribution: number;
    sourceType: string;
    sourceId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  const contribution = Math.max(Math.floor(input.contribution), 0);
  if (contribution <= 0) {
    return;
  }

  const player = await client.player.findUnique({
    where: { id: input.playerId },
    select: { factionId: true },
  });

  if (!player?.factionId) {
    return;
  }

  await client.faction.update({
    where: { id: player.factionId },
    data: { contributionScore: { increment: contribution } },
  });

  await client.factionMember.updateMany({
    where: {
      playerId: input.playerId,
      factionId: player.factionId,
    },
    data: { contributionScore: { increment: contribution } },
  });

  await client.factionContributionLog.create({
    data: {
      factionId: player.factionId,
      playerId: input.playerId,
      donatedGold: 0,
      contributionDelta: contribution,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadataJson: input.metadata,
    },
  });
}
