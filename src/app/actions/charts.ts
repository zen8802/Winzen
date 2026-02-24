"use server";

import { prisma } from "@/lib/prisma";

export type SnapshotRow = {
  outcomeId: string;
  probability: number;
  recordedAt: string; // ISO string
};

export type BetPosition = {
  outcomeId: string;
  entryProbability: number; // 1–99
  entryTimestamp: string;   // ISO string of bet.createdAt
} | null;

export async function getMarketSnapshots(marketId: string): Promise<SnapshotRow[]> {
  // Fetch newest 400 rows desc, then reverse so chart is chronological.
  // Caps DB work and wire transfer on every 3-second poll.
  const rows = await prisma.probabilitySnapshot.findMany({
    where: { marketId },
    orderBy: { recordedAt: "desc" },
    take: 400,
    select: { outcomeId: true, probability: true, recordedAt: true },
  });
  return rows
    .reverse()
    .map((r) => ({
      outcomeId: r.outcomeId,
      probability: r.probability,
      recordedAt: r.recordedAt.toISOString(),
    }));
}

export async function getUserBetPosition(
  marketId: string,
  userId: string,
): Promise<BetPosition> {
  const bet = await prisma.bet.findFirst({
    where: { marketId, userId },
    orderBy: { createdAt: "asc" },
    select: { outcomeId: true, entryProbability: true, createdAt: true },
  });
  if (!bet || bet.entryProbability === null) return null;
  return {
    outcomeId: bet.outcomeId,
    entryProbability: bet.entryProbability,
    entryTimestamp: bet.createdAt.toISOString(),
  };
}
