import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOutcomeColors } from "@/lib/outcome-colors";
import { MarketStatusBadge } from "@/components/MarketStatusBadge";
import { StreakBanner } from "@/components/StreakBanner";
import { DailyMissions } from "@/components/DailyMissions";

const VALID_TABS = ["trending", "sports", "politics", "culture", "crypto", "tech"] as const;

async function getMarkets(tab: string | null) {
  const baseQuery = {
    include: {
      outcomes: { orderBy: { order: "asc" as const } },
      bets: true,
      createdBy: { select: { name: true } },
    },
  };

  if (tab && VALID_TABS.includes(tab as (typeof VALID_TABS)[number]) && tab !== "trending") {
    return prisma.market.findMany({
      ...baseQuery,
      where: { category: tab },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  // Trending: sort by total pool (sum of bets) descending
  const all = await prisma.market.findMany({
    ...baseQuery,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const withTotal = all
    .map((m) => ({
      ...m,
      totalPool: m.bets.reduce((s, b) => s + b.amount, 0),
    }))
    .sort((a, b) => b.totalPool - a.totalPool)
    .slice(0, 12);
  return withTotal;
}

function marketStats(market: Awaited<ReturnType<typeof getMarkets>>[0]) {
  const total = market.bets.reduce((s, b) => s + b.amount, 0);
  const byOutcome = new Map<string, number>();
  for (const b of market.bets) {
    byOutcome.set(b.outcomeId, (byOutcome.get(b.outcomeId) ?? 0) + b.amount);
  }
  const outcomeShares = market.outcomes.map((o) => ({
    ...o,
    amount: byOutcome.get(o.id) ?? 0,
    pct: total > 0 ? Math.round(((byOutcome.get(o.id) ?? 0) / total) * 100) : 50,
  }));
  return { total, outcomeShares, resolved: !!market.resolvedOutcomeId };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const markets = await getMarkets(tab ?? null);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text)]">
          Virtual prediction markets
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Bet with virtual coins on yes/no and multiple choice markets. Free, no real money.
        </p>
      </section>

      <StreakBanner />
      <DailyMissions />

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent markets</h2>
          <Link href={tab ? `/markets?tab=${tab}` : "/markets"} className="btn-ghost text-sm">
            View all
          </Link>
        </div>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {markets.map((market) => {
            const { total, outcomeShares, resolved } = marketStats(market);
            const winner = market.outcomes.find((o) => o.id === market.resolvedOutcomeId);
            return (
              <li key={market.id}>
                <Link href={`/markets/${market.id}`} className="card block">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[var(--logo)]/20 px-2 py-0.5 text-xs font-medium capitalize text-[var(--logo)]">
                      {market.category}
                    </span>
                    <MarketStatusBadge
                      closesAt={market.closesAt}
                      resolvedOutcomeId={market.resolvedOutcomeId}
                    />
                  </div>
                  <p className="font-medium text-[var(--text)]">{market.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {outcomeShares.map((o, i) => {
                      const c = getOutcomeColors(i);
                      const isWinner = o.id === market.resolvedOutcomeId;
                      return (
                        <span
                          key={o.id}
                          className="rounded-md border px-2 py-0.5 text-xs font-mono"
                          style={{
                            borderColor: c.border,
                            backgroundColor: isWinner ? c.bg : "rgba(255,255,255,0.05)",
                            color: isWinner ? c.text : "var(--muted)",
                          }}
                        >
                          {o.label} {o.pct}%
                        </span>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {resolved ? `Resolved: ${winner?.label ?? "—"}` : `Pool: ${total} coins`} ·{" "}
                    Closes {new Date(market.closesAt).toLocaleDateString()}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
        {markets.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted)]">
            No markets yet.{" "}
            <Link href="/register" className="text-[var(--accent)] hover:underline">
              Sign up
            </Link>{" "}
            and create the first one.
          </p>
        )}
      </section>
    </div>
  );
}
