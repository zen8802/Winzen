"use client";

import { useState } from "react";
import Link from "next/link";
import { CoinIcon } from "@/components/CoinIcon";

type ResolvedBet = {
  id: string;
  amount: number;
  shares: number | null;
  market: {
    id: string;
    title: string;
    resolvedOutcomeId: string | null;
    resolvedAt: Date | null;
  };
  outcome: { id: string; label: string };
};

export function ResolvedBetsList({ bets }: { bets: ResolvedBet[] }) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? bets.filter((b) => b.market.title.toLowerCase().includes(q))
    : bets;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
          fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by market name…"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-9 text-sm text-[var(--text)] placeholder-[var(--muted)] outline-none focus:border-pink-400/50"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
          >
            ✕
          </button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] py-12 text-center text-sm text-[var(--muted)]">
          {q ? `No resolved bets match "${query}".` : "No resolved bets yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((bet) => {
            const won    = bet.market.resolvedOutcomeId === bet.outcome.id;
            const shares = bet.shares ?? bet.amount / 50;
            const payout = won ? Math.floor(shares * 100) : 0;
            const pnl    = payout - bet.amount;
            const resolvedAt = bet.market.resolvedAt
              ? new Date(bet.market.resolvedAt).toLocaleDateString(undefined, {
                  month: "short", day: "numeric", year: "numeric",
                })
              : null;

            return (
              <li key={bet.id} className="card flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/markets/${bet.market.id}`}
                    className="font-medium text-[var(--text)] hover:text-[var(--accent)] truncate block"
                  >
                    {bet.market.title}
                  </Link>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">
                    {bet.outcome.label}
                    {resolvedAt && <span> · Resolved {resolvedAt}</span>}
                    {" · "}
                    <span className="inline-flex items-center gap-0.5">
                      <CoinIcon size={11} />{bet.amount.toLocaleString()} staked
                    </span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className="inline-flex items-center gap-1 font-mono text-sm font-bold"
                    style={{ color: won ? "#22c55e" : "#f97316" }}
                  >
                    {won
                      ? <>{"+"}  <CoinIcon size={13} />{payout.toLocaleString()}</>
                      : <>{"−"}<CoinIcon size={13} />{bet.amount.toLocaleString()}</>}
                  </p>
                  <p
                    className="inline-flex items-center gap-0.5 text-xs"
                    style={{ color: pnl >= 0 ? "#22c55e" : "#f97316" }}
                  >
                    ({pnl >= 0 ? "+" : "−"}<CoinIcon size={10} />{Math.abs(pnl).toLocaleString()} PnL)
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
