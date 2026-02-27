import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOutcomeColors } from "@/lib/outcome-colors";
import { MarketStatusBadge } from "@/components/MarketStatusBadge";
import { CoinIcon } from "@/components/CoinIcon";
import { MarketImage } from "@/components/MarketImage";
import { SearchInput } from "@/components/SearchInput";

const VALID_TABS = ["trending", "sports", "politics", "culture", "crypto", "tech"] as const;

async function getMarkets(tab: string | null, q: string | null) {
  const searchWhere = q ? { title: { contains: q } } : {};

  const baseQuery = {
    include: {
      outcomes: { orderBy: { order: "asc" as const } },
      bets: true,
    },
  };

  if (tab && VALID_TABS.includes(tab as (typeof VALID_TABS)[number]) && tab !== "trending") {
    return prisma.market.findMany({
      ...baseQuery,
      where: { category: tab, ...searchWhere },
      orderBy: { createdAt: "desc" },
    });
  }

  const all = await prisma.market.findMany({
    ...baseQuery,
    where: searchWhere,
    orderBy: { createdAt: "desc" },
  });
  if (q) return all; // don't re-sort search results — relevance is order they came in
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
  const yesOutcome =
    market.outcomes.length === 2
      ? market.outcomes.find((o) => o.label.toLowerCase().startsWith("yes"))
      : null;
  const outcomeShares = market.outcomes.map((o) => {
    const pct = yesOutcome
      ? o.id === yesOutcome.id
        ? Math.round(market.currentProbability)
        : Math.round(100 - market.currentProbability)
      : total > 0
        ? Math.round(((byOutcome.get(o.id) ?? 0) / total) * 100)
        : Math.round(100 / market.outcomes.length);
    return { ...o, amount: byOutcome.get(o.id) ?? 0, pct };
  });
  return { total, outcomeShares, resolved: !!market.resolvedOutcomeId, yesOutcome };
}

async function get24hDeltas(markets: Awaited<ReturnType<typeof getMarkets>>) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yesIds: string[] = [];
  const marketByYesId = new Map<string, string>();

  for (const m of markets) {
    const yes = m.outcomes.length === 2
      ? m.outcomes.find((o) => o.label.toLowerCase().startsWith("yes"))
      : null;
    if (yes) {
      yesIds.push(yes.id);
      marketByYesId.set(yes.id, m.id);
    }
  }

  if (yesIds.length === 0) return new Map<string, number>();

  const snaps = await prisma.probabilitySnapshot.findMany({
    where: { outcomeId: { in: yesIds }, recordedAt: { lte: cutoff } },
    orderBy: { recordedAt: "desc" },
    distinct: ["outcomeId"],
    select: { outcomeId: true, probability: true },
  });

  const deltaMap = new Map<string, number>();
  for (const s of snaps) {
    const mid = marketByYesId.get(s.outcomeId);
    if (mid) deltaMap.set(mid, s.probability * 100);
  }
  return deltaMap;
}

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab, q } = await searchParams;
  const markets = await getMarkets(tab ?? null, q ?? null);
  const deltas24h = await get24hDeltas(markets);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">All markets</h1>
      </div>

      {/* Search bar */}
      <Suspense>
        <SearchInput initialValue={q ?? ""} />
      </Suspense>

      {q && (
        <p className="text-sm text-[var(--muted)]">
          {markets.length === 0
            ? `No results for "${q}"`
            : `${markets.length} result${markets.length !== 1 ? "s" : ""} for "${q}"`}
        </p>
      )}

      <ul className="space-y-4">
        {markets.map((market) => {
          const { total, outcomeShares, resolved, yesOutcome } = marketStats(market);
          const winner = market.outcomes.find((o) => o.id === market.resolvedOutcomeId);
          const past24h = yesOutcome ? deltas24h.get(market.id) : undefined;
          const delta = past24h !== undefined ? market.currentProbability - past24h : undefined;

          return (
            <li key={market.id}>
              <Link href={`/markets/${market.id}`} className="card block group">
                <div className="flex items-start gap-3">
                  <MarketImage
                    imageUrl={market.imageUrl}
                    category={market.category}
                    alt={market.title}
                    variant="thumb"
                  />
                  <div className="flex-1 min-w-0">
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
                      <p className="mt-1 line-clamp-1 text-sm text-[var(--muted)]">
                        {market.description}
                      </p>
                    )}
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
                      {!resolved && delta !== undefined && (
                        <span
                          className="rounded-md border px-2 py-0.5 text-xs font-mono"
                          style={{
                            borderColor: delta >= 0 ? "rgba(34,197,94,0.3)" : "rgba(249,115,22,0.3)",
                            color: delta >= 0 ? "#22c55e" : "#f97316",
                            backgroundColor: delta >= 0 ? "rgba(34,197,94,0.06)" : "rgba(249,115,22,0.06)",
                          }}
                        >
                          {delta >= 0 ? "▲" : "▼"}
                          {Math.abs(delta).toFixed(1)}% 24h
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-[var(--muted)]">
                      {resolved ? `Resolved: ${winner?.label ?? "—"}` : (
                        <span className="inline-flex items-center gap-1">
                          <CoinIcon size={11} />{total.toLocaleString()}
                          {" · "}
                          {market.participantCount} trader{market.participantCount !== 1 ? "s" : ""}
                        </span>
                      )}{" · "}
                      Closes {new Date(market.closesAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {markets.length === 0 && !q && (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted)]">
          No markets yet.
        </p>
      )}
    </div>
  );
}
