"use server";

import { prisma } from "@/lib/prisma";

export interface SimStats {
  botCount: number;
  botBalanceTotal: number;
  totalBotTrades: number;
  recentBotTrades: number; // last 5 minutes
  activeMarkets: number;
  topMarkets: Array<{
    id: string;
    title: string;
    yesProb: number;
    botTradeCount: number;
    totalVolume: number;
  }>;
  recentActivity: Array<{
    id: string;
    username: string | null;
    side: string | null;
    amount: number | null;
    price: number | null;
    marketTitle: string | null;
    createdAt: string;
    isBot: boolean;
  }>;
}

export async function getSimStats(): Promise<SimStats> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000);

  const [
    botCount,
    botBalanceResult,
    totalBotTrades,
    recentBotTrades,
    activeMarkets,
    topMarketsRaw,
    recentActivity,
  ] = await Promise.all([
    // Total bot users
    prisma.user.count({ where: { isBot: true } }),

    // Sum of all bot balances
    prisma.user.aggregate({
      where: { isBot: true },
      _sum: { balance: true },
    }),

    // Total bot bets ever placed
    prisma.bet.count({ where: { isBot: true } }),

    // Bot bets in last 5 minutes
    prisma.bet.count({
      where: { isBot: true, createdAt: { gte: fiveMinutesAgo } },
    }),

    // Open yes_no markets
    prisma.market.count({
      where: { resolvedOutcomeId: null, type: "yes_no" },
    }),

    // Top 5 most active markets for bots
    prisma.market.findMany({
      where: { resolvedOutcomeId: null, type: "yes_no" },
      orderBy: { totalVolume: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        currentProbability: true,
        totalVolume: true,
        _count: { select: { bets: { where: { isBot: true } } } },
      },
    }),

    // Last 60 activity entries (bots + real users interleaved)
    prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        username: true,
        side: true,
        amount: true,
        price: true,
        marketTitle: true,
        createdAt: true,
        userId: true,
      },
    }),
  ]);

  // Determine which activity entries belong to bots
  const botUserIds = new Set(
    (
      await prisma.user.findMany({
        where: { isBot: true },
        select: { id: true },
      })
    ).map((u) => u.id),
  );

  return {
    botCount,
    botBalanceTotal: botBalanceResult._sum.balance ?? 0,
    totalBotTrades,
    recentBotTrades,
    activeMarkets,
    topMarkets: topMarketsRaw.map((m) => ({
      id: m.id,
      title: m.title,
      yesProb: m.currentProbability,
      botTradeCount: m._count.bets,
      totalVolume: m.totalVolume,
    })),
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      username: a.username,
      side: a.side,
      amount: a.amount,
      price: a.price,
      marketTitle: a.marketTitle,
      createdAt: a.createdAt.toISOString(),
      isBot: botUserIds.has(a.userId ?? ""),
    })),
  };
}
