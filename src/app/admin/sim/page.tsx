"use client";

import { useEffect, useState, useCallback } from "react";
import { getSimStats, type SimStats } from "@/app/actions/sim";
import Link from "next/link";
import { CoinIcon } from "@/components/CoinIcon";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ tpm, recentTrades }: { tpm: number; recentTrades: number }) {
  const status =
    recentTrades === 0 ? "Idle" :
    tpm >= 30          ? "Active" :
                         "Low";
  const color =
    status === "Active" ? "#22c55e" :
    status === "Low"    ? "#f59e0b" :
                          "#8b9cb3";
  const dot =
    status === "Active" ? "animate-pulse" : "";

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
      style={{ borderColor: color + "55", color, background: color + "15" }}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} style={{ background: color }} />
      {status}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card flex flex-col gap-1">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="font-mono text-2xl font-bold text-[var(--text)]">{value}</p>
      {sub && <p className="text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const POLL_INTERVAL = 5_000; // refresh every 5 s

export default function SimDashboard() {
  const [stats, setStats]     = useState<SimStats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getSimStats();
      setStats(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("[SimDashboard] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [refresh]);

  const tpm = stats ? Math.round(stats.recentBotTrades / 5) : 0; // trades per minute (~5 min window)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Sim Monitor</h1>
          {stats && <StatusBadge tpm={tpm} recentTrades={stats.recentBotTrades} />}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <p className="text-xs text-[var(--muted)]">
              Updated {lastUpdated.toLocaleTimeString()} · auto-refresh {POLL_INTERVAL / 1000}s
            </p>
          )}
          <button onClick={refresh} className="btn-ghost text-xs">
            ↻ Refresh
          </button>
          <Link href="/admin" className="btn-ghost text-sm">
            ← Admin
          </Link>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      )}

      {stats && (
        <>
          {/* Stats row */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Bot users"
              value={stats.botCount}
              sub={`Σ balance: ${stats.botBalanceTotal.toLocaleString()} coins`}
            />
            <StatCard
              label="Total bot trades"
              value={stats.totalBotTrades.toLocaleString()}
            />
            <StatCard
              label="Trades (last 5 min)"
              value={stats.recentBotTrades}
              sub={`≈ ${tpm} trades/min`}
            />
            <StatCard
              label="Active markets"
              value={stats.activeMarkets}
            />
          </div>

          {/* Top markets */}
          {stats.topMarkets.length > 0 && (
            <section className="card">
              <h2 className="mb-3 text-sm font-semibold text-[var(--muted)] uppercase tracking-wide">
                Top markets by volume
              </h2>
              <ul className="space-y-2">
                {stats.topMarkets.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-4 text-sm">
                    <Link
                      href={`/markets/${m.id}`}
                      className="min-w-0 flex-1 truncate text-[var(--text)] hover:text-[var(--accent)]"
                    >
                      {m.title}
                    </Link>
                    <div className="flex shrink-0 items-center gap-4 font-mono text-xs text-[var(--muted)]">
                      <span className="text-green-400">{m.yesProb.toFixed(1)}% YES</span>
                      <span>{m.botTradeCount} bot trades</span>
                      <span className="inline-flex items-center gap-0.5">
                        <CoinIcon size={10} />{m.totalVolume.toLocaleString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Live activity feed */}
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold text-[var(--muted)] uppercase tracking-wide">
              Live activity (last 60 entries)
            </h2>
            <div className="max-h-[480px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                    <th className="pb-2 pr-4 font-medium">Time</th>
                    <th className="pb-2 pr-4 font-medium">User</th>
                    <th className="pb-2 pr-4 font-medium">Side</th>
                    <th className="pb-2 pr-4 font-medium">Amount</th>
                    <th className="pb-2 pr-4 font-medium">@ Prob</th>
                    <th className="pb-2 font-medium">Market</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentActivity.map((a) => {
                    const time = new Date(a.createdAt).toLocaleTimeString([], {
                      hour: "2-digit", minute: "2-digit", second: "2-digit",
                    });
                    return (
                      <tr
                        key={a.id}
                        className="border-b border-[var(--border)]/40"
                        style={{ opacity: a.isBot ? 0.75 : 1 }}
                      >
                        <td className="py-1.5 pr-4 font-mono text-[var(--muted)]">{time}</td>
                        <td className="py-1.5 pr-4">
                          <span style={{ color: a.isBot ? "#8b9cb3" : "#e6edf5" }}>
                            {a.username ?? "—"}
                          </span>
                          {a.isBot && (
                            <span className="ml-1 rounded px-1 py-0.5 text-[9px] font-semibold"
                              style={{ background: "#1e293b", color: "#64748b" }}>
                              BOT
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 pr-4">
                          <span style={{ color: a.side === "YES" ? "#22c55e" : "#f97316" }}>
                            {a.side ?? "—"}
                          </span>
                        </td>
                        <td className="py-1.5 pr-4 font-mono">
                          {a.amount != null ? (
                            <span className="inline-flex items-center gap-0.5">
                              <CoinIcon size={9} />{a.amount.toLocaleString()}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="py-1.5 pr-4 font-mono text-[var(--muted)]">
                          {a.price != null ? `${a.price.toFixed(1)}%` : "—"}
                        </td>
                        <td className="max-w-[200px] truncate py-1.5 text-[var(--muted)]">
                          {a.marketTitle ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {stats.recentActivity.length === 0 && (
                <p className="py-8 text-center text-[var(--muted)]">
                  No activity yet. Start the simulation with{" "}
                  <code className="rounded bg-white/5 px-1">npm run simulate</code>.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
