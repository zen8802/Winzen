import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CoinIcon } from "@/components/CoinIcon";

const MEDAL = ["🥇", "🥈", "🥉"] as const;

const RANK_STYLES: Record<number, { border: string; bg: string; glow: string }> = {
  0: { border: "#f59e0b", bg: "rgba(245,158,11,0.08)", glow: "rgba(245,158,11,0.15)" },
  1: { border: "#94a3b8", bg: "rgba(148,163,184,0.06)", glow: "rgba(148,163,184,0.12)" },
  2: { border: "#b45309", bg: "rgba(180,83,9,0.06)", glow: "rgba(180,83,9,0.12)" },
};

export default async function LeaderboardPage() {
  const users = await prisma.user.findMany({
    where: { isBot: false, OR: [{ totalTrades: { gt: 0 } }, { totalWins: { gt: 0 } }] },
    select: {
      id: true,
      name: true,
      totalTrades: true,
      totalWins: true,
      totalLosses: true,
      totalProfit: true,
      winStreak: true,
    },
    orderBy: { totalProfit: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ranked by net profit across all resolved markets.
        </p>
      </div>

      {users.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center text-[var(--muted)]">
          No trades yet — be the first to place a bet!
        </p>
      ) : (
        <div className="space-y-2">
          {users.map((user, idx) => {
            const marketsPlayed = user.totalWins + user.totalLosses;
            const accuracy = marketsPlayed > 0 ? (user.totalWins / marketsPlayed) * 100 : null;
            const style = RANK_STYLES[idx];

            return (
              <Link
                key={user.id}
                href={`/users/${user.id}`}
                className="flex items-center gap-4 rounded-xl border px-5 py-4 transition hover:opacity-80"
                style={
                  style
                    ? {
                        borderColor: style.border,
                        backgroundColor: style.bg,
                        boxShadow: `0 0 16px ${style.glow}`,
                      }
                    : { borderColor: "var(--border)", backgroundColor: "var(--surface)" }
                }
              >
                {/* Rank */}
                <div className="w-8 shrink-0 text-center">
                  {idx < 3 ? (
                    <span className="text-xl">{MEDAL[idx]}</span>
                  ) : (
                    <span className="font-mono text-sm font-semibold text-[var(--muted)]">
                      #{idx + 1}
                    </span>
                  )}
                </div>

                {/* Name */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[var(--text)]">{user.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {user.totalTrades} trade{user.totalTrades !== 1 ? "s" : ""}
                    {marketsPlayed > 0 && ` · ${user.totalWins}W / ${user.totalLosses}L`}
                    {user.winStreak > 1 && ` · 🔥 ${user.winStreak} streak`}
                  </p>
                </div>

                {/* Accuracy — hidden on mobile */}
                {accuracy !== null && (
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {accuracy.toFixed(0)}%
                    </p>
                    <p className="text-xs text-[var(--muted)]">accuracy</p>
                  </div>
                )}

                {/* Profit */}
                <div className="shrink-0 text-right">
                  <p
                    className="inline-flex items-center gap-1 font-mono text-sm font-bold"
                    style={{ color: user.totalProfit >= 0 ? "#22c55e" : "#f97316" }}
                  >
                    {user.totalProfit >= 0 ? "+" : ""}
                    <CoinIcon size={13} />
                    {user.totalProfit.toLocaleString()}
                  </p>
                  <p className="text-xs text-[var(--muted)]">profit</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
