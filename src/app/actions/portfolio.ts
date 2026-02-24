"use server";

import { prisma } from "@/lib/prisma";

export type PnlSnapshot = { totalValue: number; date: string };

export async function getPortfolioSnapshots(
  userId: string,
  range: "24h" | "7d" | "30d" | "all",
): Promise<PnlSnapshot[]> {
  const now = new Date();
  let since: Date | undefined;
  if (range === "24h") since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  else if (range === "7d") since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  else if (range === "30d") since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const rows = await prisma.portfolioSnapshot.findMany({
    where: {
      userId,
      ...(since ? { date: { gte: since } } : {}),
    },
    orderBy: { date: "asc" },
    select: { totalValue: true, date: true },
  });

  return rows.map((r) => ({ totalValue: r.totalValue, date: r.date.toISOString() }));
}
