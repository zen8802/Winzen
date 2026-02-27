import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatCoins } from "@/lib/coins";
import { CoinIcon } from "@/components/CoinIcon";
import { XPBar } from "@/components/XPBar";
import { getLevelFromXp, getTitle, xpForLevel, xpForPrevLevel } from "@/lib/gamification";
import { getPortfolioSnapshots } from "@/app/actions/portfolio";
import { PortfolioPnlChart } from "@/components/PortfolioPnlChart";
import { PnLCardModal } from "./PnLCardModal";
import { BetPnLCardModal } from "@/components/BetPnLCardModal";

const TX_LABELS: Record<string, string> = {
  initial: "Welcome bonus",
  bet: "Bet placed",
  win: "Bet won",
  cashout: "Cashed out",
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
  const [user, activeBets, closedBets, transactions, snapshots] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        balance: true,
        email: true,
        name: true,
        loginStreak: true,
        winStreak: true,
        xp: true,
        level: true,
        eloRating: true,
        totalTrades: true,
        totalWins: true,
        totalLosses: true,
      },
    }),
    // Open positions (not cashed out, market not resolved)
    prisma.bet.findMany({
      where: { userId, closedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        market: {
          select: {
            id: true,
            title: true,
            resolvedOutcomeId: true,
            currentProbability: true,
          },
        },
        outcome: { select: { label: true } },
      },
    }),
    // Closed positions (cashed out or market resolved)
    prisma.bet.findMany({
      where: { userId, closedAt: { not: null } },
      orderBy: { closedAt: "desc" },
      take: 20,
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
    getPortfolioSnapshots(userId, "all"),
  ]);
  return { user, activeBets, closedBets, transactions, snapshots };
}

export default async function PortfolioPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { user, activeBets, closedBets, transactions, snapshots } = await getPortfolio(
    session.user.id,
  );
  if (!user) redirect("/login");

  const level = getLevelFromXp(user.xp);
  const title = getTitle(level);
  const currentLevelXp = xpForPrevLevel(level);
  const nextLevelXp = xpForLevel(level);

  // Separate active (market open) vs pending settlement (market resolved, bet won)
  const openPositions = activeBets.filter((b) => !b.market.resolvedOutcomeId);
  const pendingPositions = activeBets.filter((b) => !!b.market.resolvedOutcomeId);

  // Compute unrealized PnL for open positions
  const unrealizedPnl = openPositions.reduce((sum, bet) => {
    const isYes = bet.outcome.label.toLowerCase().startsWith("yes");
    const currentProb = isYes
      ? bet.market.currentProbability
      : 100 - bet.market.currentProbability;
    const shares = bet.shares ?? bet.amount / 50;
    return sum + (shares * currentProb - bet.amount);
  }, 0);

  // Realized PnL: sum of (cashout payout - amount) for closed bets
  const realizedPnl = closedBets.reduce((sum, bet) => {
    if (!bet.exitProbability) return sum;
    const shares = bet.shares ?? bet.amount / 50;
    const cashoutValue = shares * bet.exitProbability;
    return sum + (cashoutValue - bet.amount);
  }, 0);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">
        Portfolio{user.name ? <span className="text-[var(--muted)]"> · {user.name}</span> : null}
      </h1>

      <XPBar
        xp={user.xp}
        level={level}
        title={title}
        currentLevelXp={currentLevelXp}
        nextLevelXp={nextLevelXp}
      />

      {/* Stats row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <section className="card">
          <p className="text-sm text-[var(--muted)]">Balance</p>
          <p className="inline-flex items-center gap-2 text-2xl sm:text-3xl font-mono text-[var(--coin)]">
            <CoinIcon size={24} />
            {user.balance.toLocaleString()}
          </p>
        </section>

        <section className="card">
          <p className="text-sm text-[var(--muted)]">ELO Rating</p>
          <p className="text-2xl sm:text-3xl font-mono text-[var(--accent)]">{user.eloRating}</p>
        </section>

        <section className="card">
          <p className="text-sm text-[var(--muted)]">Unrealized PnL</p>
          <p
            className="inline-flex items-center gap-2 text-2xl sm:text-3xl font-mono"
            style={{ color: unrealizedPnl >= 0 ? "#22c55e" : "#f97316" }}
          >
            {unrealizedPnl >= 0 ? "+" : "−"}
            <CoinIcon size={24} />
            {Math.abs(Math.round(unrealizedPnl))}
          </p>
        </section>

        <section className="card">
          <p className="text-sm text-[var(--muted)]">Realized PnL</p>
          <p
            className="inline-flex items-center gap-2 text-2xl sm:text-3xl font-mono"
            style={{ color: realizedPnl >= 0 ? "#22c55e" : "#f97316" }}
          >
            {realizedPnl >= 0 ? "+" : "−"}
            <CoinIcon size={24} />
            {Math.abs(Math.round(realizedPnl))}
          </p>
        </section>
      </div>

      {/* Share PnL Card */}
      <div className="flex">
        <PnLCardModal
          userName={user.name ?? "Trader"}
          eloRating={user.eloRating}
          totalTrades={user.totalTrades}
          totalWins={user.totalWins}
          totalLosses={user.totalLosses}
          realizedPnl={realizedPnl}
          unrealizedPnl={unrealizedPnl}
          snapshots={snapshots}
        />
      </div>

      {/* PnL Chart */}
      {snapshots.length > 1 && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Portfolio Value</h2>
          <PortfolioPnlChart snapshots={snapshots} />
        </section>
      )}

      {/* Open Positions */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Open Positions</h2>
        <ul className="space-y-2">
          {openPositions.map((bet) => {
            const isYes = bet.outcome.label.toLowerCase().startsWith("yes");
            const currentProb = isYes
              ? bet.market.currentProbability
              : 100 - bet.market.currentProbability;
            const shares = bet.shares ?? bet.amount / 50;
            const entryProb = bet.entryProbability ?? 50;
            const currentValue = shares * currentProb;
            const pnl = currentValue - bet.amount;
            return (
              <li
                key={bet.id}
                className="card flex flex-wrap items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/markets/${bet.market.id}`}
                    className="font-medium text-[var(--text)] hover:text-[var(--accent)]"
                  >
                    {bet.market.title}
                  </Link>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">
                    <span
                      className="font-semibold"
                      style={{ color: isYes ? "#22c55e" : "#f97316" }}
                    >
                      {bet.outcome.label}
                    </span>{" "}
                    · Entry: {entryProb.toFixed(1)}% → Now: {currentProb.toFixed(1)}% ·{" "}
                    {shares.toFixed(3)} shares
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className="inline-flex items-center gap-1 font-mono text-sm font-bold"
                    style={{ color: pnl >= 0 ? "#22c55e" : "#f97316" }}
                  >
                    {pnl >= 0 ? "+" : "−"}
                    <CoinIcon size={13} />{Math.abs(parseFloat(pnl.toFixed(0))).toLocaleString()}
                  </p>
                  <p className="flex items-center justify-end gap-0.5 text-xs text-[var(--muted)]">
                    <CoinIcon size={10} />{bet.amount.toLocaleString()} spent
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        {openPositions.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-[var(--muted)]">
            No open positions.{" "}
            <Link href="/markets" className="text-[var(--accent)] hover:underline">
              Browse markets
            </Link>
            .
          </p>
        )}
      </section>

      {/* Pending Settlement */}
      {pendingPositions.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Pending Settlement</h2>
          <ul className="space-y-2">
            {pendingPositions.map((bet) => {
              const won = bet.market.resolvedOutcomeId === bet.outcomeId;
              const shares = bet.shares ?? bet.amount / 50;
              const payout = won ? Math.floor(shares * 100) : 0;
              return (
                <li key={bet.id} className="card flex items-center justify-between gap-4">
                  <div>
                    <Link
                      href={`/markets/${bet.market.id}`}
                      className="font-medium text-[var(--text)] hover:text-[var(--accent)]"
                    >
                      {bet.market.title}
                    </Link>
                    <p className="text-sm text-[var(--muted)]">
                      {bet.outcome.label} ·{" "}
                      <span className="inline-flex items-center gap-0.5">
                        <CoinIcon size={11} />{bet.amount.toLocaleString()}
                      </span>
                    </p>
                  </div>
                  <span
                    className="inline-flex items-center gap-1 text-sm font-bold"
                    style={{ color: won ? "#22c55e" : "#f97316" }}
                  >
                    {won ? <>Won · +<CoinIcon size={13} /> {payout.toLocaleString()}</> : "Lost"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Closed Positions */}
      {closedBets.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Closed Positions</h2>
          <ul className="space-y-2">
            {closedBets.map((bet) => {
              const shares = bet.shares ?? bet.amount / 50;
              const exitProb = bet.exitProbability ?? 0;
              const payout = Math.floor(shares * exitProb);
              const pnl = payout - bet.amount;
              const isYes = bet.outcome.label.toLowerCase().startsWith("yes");
              return (
                <li key={bet.id} className="card flex items-center justify-between gap-4">
                  <div>
                    <Link
                      href={`/markets/${bet.market.id}`}
                      className="font-medium text-[var(--text)] hover:text-[var(--accent)]"
                    >
                      {bet.market.title}
                    </Link>
                    <p className="text-sm text-[var(--muted)]">
                      <span style={{ color: isYes ? "#22c55e" : "#f97316" }}>
                        {bet.outcome.label}
                      </span>{" "}
                      · Entry {(bet.entryProbability ?? 50).toFixed(1)}% → Exit{" "}
                      {exitProb.toFixed(1)}%
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p
                      className="inline-flex items-center gap-1 font-mono text-sm font-bold"
                      style={{ color: pnl >= 0 ? "#22c55e" : "#f97316" }}
                    >
                      {pnl >= 0 ? "+" : "−"}<CoinIcon size={13} />{Math.abs(pnl).toLocaleString()}
                    </p>
                    <p className="text-xs text-[var(--muted)]">Cashed out</p>
                    <BetPnLCardModal
                      userName={user.name ?? "Trader"}
                      marketTitle={bet.market.title}
                      side={isYes ? "YES" : "NO"}
                      amount={bet.amount}
                      entryProbability={bet.entryProbability ?? 50}
                      exitProb={exitProb}
                      pnl={pnl}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Streaks */}
      <div className="grid gap-3 sm:grid-cols-2">
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

      {/* Transactions */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent transactions</h2>
        <ul className="space-y-2">
          {transactions.map((tx) => (
            <li
              key={tx.id}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm"
            >
              <span className="text-[var(--muted)]">{TX_LABELS[tx.type] ?? tx.type}</span>
              <span className={`inline-flex items-center gap-1 font-mono ${tx.amount >= 0 ? "text-[var(--accent)]" : "text-red-400"}`}>
                {tx.amount >= 0 ? "+" : ""}
                <CoinIcon size={13} />{tx.amount.toLocaleString()}
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
