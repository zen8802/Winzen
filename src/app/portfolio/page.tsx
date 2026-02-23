import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatCoins } from "@/lib/coins";
import { XPBar } from "@/components/XPBar";
import { getLevelFromXp, getTitle, xpForLevel, xpForPrevLevel } from "@/lib/gamification";

const TX_LABELS: Record<string, string> = {
  initial: "Welcome bonus",
  bet: "Bet placed",
  win: "Bet won",
  refund: "Refund",
  purchase: "Item purchased",
  deposit: "Market deposit",
  deposit_refund: "Deposit refunded",
  creator_reward: "Creator reward",
  streak_bonus: "Login streak bonus",
  mission_reward: "Mission completed",
  near_miss: "Close call bonus",
};

async function getPortfolio(userId: string) {
  const [user, bets, transactions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, email: true, name: true, loginStreak: true, winStreak: true, xp: true, level: true },
    }),
    prisma.bet.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        market: { select: { id: true, title: true, resolvedOutcomeId: true } },
        outcome: { select: { label: true } },
      },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return { user, bets, transactions };
}

export default async function PortfolioPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { user, bets, transactions } = await getPortfolio(session.user.id);
  if (!user) redirect("/login");

  const level = getLevelFromXp(user.xp);
  const title = getTitle(level);
  const currentLevelXp = xpForPrevLevel(level);
  const nextLevelXp = xpForLevel(level);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Portfolio</h1>

      <XPBar
        xp={user.xp}
        level={level}
        title={title}
        currentLevelXp={currentLevelXp}
        nextLevelXp={nextLevelXp}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <section className="card">
          <p className="text-sm text-[var(--muted)]">Balance</p>
          <p className="text-3xl font-mono text-[var(--coin)]">{formatCoins(user.balance)}</p>
        </section>

        <section className="card flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <div>
            <p className="text-sm text-[var(--muted)]">Login streak</p>
            <p className="text-xl font-bold text-[var(--text)]">{user.loginStreak} days</p>
          </div>
        </section>

        <section className="card flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <p className="text-sm text-[var(--muted)]">Win streak</p>
            <p className="text-xl font-bold text-[var(--text)]">{user.winStreak} wins</p>
          </div>
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your bets</h2>
        <ul className="space-y-2">
          {bets.map((bet) => (
            <li key={bet.id} className="card flex items-center justify-between gap-4">
              <div>
                <Link
                  href={`/markets/${bet.market.id}`}
                  className="font-medium text-[var(--text)] hover:text-[var(--accent)]"
                >
                  {bet.market.title}
                </Link>
                <p className="text-sm text-[var(--muted)]">
                  {bet.outcome.label} · {bet.amount} coins
                </p>
              </div>
              <span className="text-xs text-[var(--muted)]">
                {bet.market.resolvedOutcomeId
                  ? bet.outcomeId === bet.market.resolvedOutcomeId
                    ? "Won"
                    : "Lost"
                  : "Pending"}
              </span>
            </li>
          ))}
        </ul>
        {bets.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-[var(--muted)]">
            No bets yet.{" "}
            <Link href="/markets" className="text-[var(--accent)] hover:underline">
              Browse markets
            </Link>
            .
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent transactions</h2>
        <ul className="space-y-2">
          {transactions.map((tx) => (
            <li
              key={tx.id}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm"
            >
              <span className="text-[var(--muted)]">{TX_LABELS[tx.type] ?? tx.type}</span>
              <span className={tx.amount >= 0 ? "text-[var(--accent)]" : "text-red-400"}>
                {tx.amount >= 0 ? "+" : ""}
                {tx.amount} coins
              </span>
            </li>
          ))}
        </ul>
        {transactions.length === 0 && (
          <p className="text-sm text-[var(--muted)]">No transactions yet.</p>
        )}
      </section>
    </div>
  );
}
