import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOutcomeColors } from "@/lib/outcome-colors";
import { MarketStatusBadge } from "@/components/MarketStatusBadge";

const VALID_TABS = ["trending", "sports", "politics", "culture", "crypto", "tech"] as const;

async function getMarkets(tab: string | null) {
  const baseQuery = {
    include: {
      outcomes: { orderBy: { order: "asc" as const } },
      bets: true,
    },
  };

  if (tab && VALID_TABS.includes(tab as (typeof VALID_TABS)[number]) && tab !== "trending") {
    return prisma.market.findMany({
      ...baseQuery,
      where: { category: tab },
      orderBy: { createdAt: "desc" },
    });
  }

  const all = await prisma.market.findMany({
    ...baseQuery,
    orderBy: { createdAt: "desc" },
  });
  return all
    .map((m) => ({
      ...m,
      totalPool: m.bets.reduce((s, b) => s + b.amount, 0),
    }))
    .sort((a, b) => b.totalPool - a.totalPool);
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

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const markets = await getMarkets(tab ?? null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">All markets</h1>
      <ul className="space-y-4">
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
                {market.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
                    {market.description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {outcomeShares.map((o, i) => {
                    const c = getOutcomeColors(i);
                    const isWinner = o.id === market.resolvedOutcomeId;
                    return (
                      <span
                        key={o.id}
                        className="rounded-md border px-2 py-1 text-sm font-mono"
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
          No markets yet.
        </p>
      )}
    </div>
  );
}
