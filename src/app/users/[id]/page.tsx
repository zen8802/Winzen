import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CoinIcon } from "@/components/CoinIcon";
import { MarketStatusBadge } from "@/components/MarketStatusBadge";
import { getLevelFromXp, getTitle } from "@/lib/gamification";
import { Avatar } from "@/components/Avatar";
import { getUserAvatarData } from "@/app/actions/agent";
import { getFollowCounts, getFollowStatus } from "@/app/actions/social";
import { getPortfolioSnapshots } from "@/app/actions/portfolio";
import { FollowButton } from "@/components/FollowButton";
import { PortfolioPnlChart } from "@/components/PortfolioPnlChart";

async function getUserProfile(id: string) {
  const [user, createdMarkets, recentBets] = await Promise.all([
    prisma.user.findFirst({
      where: { id, isBot: false },
      select: {
        id: true,
        name: true,
        eloRating: true,
        xp: true,
        level: true,
        totalTrades: true,
        totalWins: true,
        totalLosses: true,
        totalProfit: true,
        winStreak: true,
        battlePassIsPremium: true,
      },
    }),
    prisma.market.findMany({
      where: { createdById: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        category: true,
        resolvedOutcomeId: true,
        closesAt: true,
        participantCount: true,
        totalVolume: true,
      },
    }),
    prisma.bet.findMany({
      where: {
        userId: id,
        OR: [
          { closedAt: { not: null } },
          { market: { resolvedOutcomeId: { not: null } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: {
        market: { select: { id: true, title: true, resolvedOutcomeId: true } },
        outcome: { select: { id: true, label: true } },
      },
    }),
  ]);

  return { user, createdMarkets, recentBets };
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const isOwnProfile = session?.user?.id === id;

  const [{ user, createdMarkets, recentBets }, avatarData, followCounts, isFollowing, portfolioSnapshots] = await Promise.all([
    getUserProfile(id),
    getUserAvatarData(id),
    getFollowCounts(id),
    !isOwnProfile && session?.user?.id ? getFollowStatus(id) : Promise.resolve(false),
    getPortfolioSnapshots(id, "all"),
  ]);
  if (!user) notFound();

  const level = getLevelFromXp(user.xp);
  const title = getTitle(level);
  const marketsPlayed = user.totalWins + user.totalLosses;
  const winRate = marketsPlayed > 0
    ? ((user.totalWins / marketsPlayed) * 100).toFixed(1)
    : null;
  const initial = (user.name ?? "?")[0].toUpperCase();

  return (
    <div className="space-y-8">
      <Link href="/leaderboard" className="text-sm text-[var(--muted)] hover:text-[var(--accent)]">
        ← Leaderboard
      </Link>

      {/* Profile header */}
      <div className="card">
        <div className="flex flex-wrap items-start gap-6">
          {/* Avatar or initial fallback */}
          {avatarData ? (
            <Avatar equipped={avatarData.equipped} size="lg" />
          ) : (
            <div
              className="flex h-[140px] w-[140px] shrink-0 items-center justify-center rounded-xl text-2xl font-bold text-white"
              style={{ background: "linear-gradient(135deg, #f472b6 0%, #a78bfa 100%)" }}
            >
              {initial}
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            <div>
              <h1
                className="text-2xl font-bold"
                style={{ color: user.battlePassIsPremium ? "#a78bfa" : undefined }}
              >
                {user.name ?? "Anonymous"}
              </h1>
              <p className="text-sm text-[var(--muted)]">{title} · Level {level}</p>
            </div>
            <div>
              <p className="text-xl font-mono font-bold text-[var(--accent)]">{user.eloRating}</p>
              <p className="text-xs text-[var(--muted)]">ELO rating</p>
            </div>
            {/* Follower counts + Follow button */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-[var(--muted)]">
                <span className="font-semibold text-[var(--text)]">{followCounts.followers.toLocaleString()}</span> followers
              </span>
              <span className="text-xs text-[var(--muted)]">
                <span className="font-semibold text-[var(--text)]">{followCounts.following.toLocaleString()}</span> following
              </span>
              {!isOwnProfile && session?.user?.id && (
                <FollowButton
                  followingId={id}
                  initialIsFollowing={isFollowing}
                  followerCount={followCounts.followers}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <section className="card">
          <p className="text-xs text-[var(--muted)]">Win Rate</p>
          <p className="text-2xl font-mono text-[var(--text)]">
            {winRate !== null ? `${winRate}%` : "—"}
          </p>
        </section>
        <section className="card">
          <p className="text-xs text-[var(--muted)]">Trades</p>
          <p className="text-2xl font-mono text-[var(--text)]">{user.totalTrades}</p>
        </section>
        <section className="card">
          <p className="text-xs text-[var(--muted)]">W / L</p>
          <p className="text-2xl font-mono text-[var(--text)]">
            {user.totalWins} / {user.totalLosses}
          </p>
        </section>
        <section className="card">
          <p className="text-xs text-[var(--muted)]">Net Profit</p>
          <p
            className="inline-flex items-center gap-1 text-2xl font-mono"
            style={{ color: user.totalProfit >= 0 ? "#22c55e" : "#f97316" }}
          >
            {user.totalProfit >= 0 ? "+" : ""}
            <CoinIcon size={18} />
            {user.totalProfit.toLocaleString()}
          </p>
        </section>
      </div>

      {/* Portfolio PnL chart */}
      {portfolioSnapshots.length > 0 && (
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Portfolio Value</h2>
          <PortfolioPnlChart snapshots={portfolioSnapshots} />
        </section>
      )}

      {/* Created markets */}
      {createdMarkets.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Created Markets</h2>
          <ul className="space-y-2">
            {createdMarkets.map((m) => (
              <li key={m.id}>
                <Link href={`/markets/${m.id}`} className="card block">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--text)]">{m.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        <span className="capitalize">{m.category}</span>
                        {" · "}
                        <span className="inline-flex items-center gap-0.5">
                          <CoinIcon size={10} />{m.totalVolume.toLocaleString()}
                        </span>
                        {" · "}
                        {m.participantCount} trader{m.participantCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <MarketStatusBadge
                      closesAt={m.closesAt}
                      resolvedOutcomeId={m.resolvedOutcomeId}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recent bets */}
      {recentBets.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Recent Bets</h2>
          <ul className="space-y-2">
            {recentBets.map((bet) => {
              const isYes = bet.outcome.label.toLowerCase().startsWith("yes");
              const shares = bet.shares ?? bet.amount / 50;
              const isCashout = !!bet.closedAt && !!bet.exitProbability;
              const isResolved = !!bet.market.resolvedOutcomeId;
              const won = isResolved && bet.market.resolvedOutcomeId === bet.outcome.id;

              let payout = 0;
              if (isCashout && bet.exitProbability) {
                payout = shares * bet.exitProbability;
              } else if (won) {
                payout = Math.floor(shares * 100);
              }
              const pnl = payout - bet.amount;

              let resultLabel = "";
              if (isCashout) resultLabel = "cashed out";
              else if (isResolved) resultLabel = won ? "won" : "lost";

              return (
                <li key={bet.id}>
                  <Link href={`/markets/${bet.market.id}`} className="card block">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 font-medium text-[var(--text)]">
                          {bet.market.title}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          <span
                            className="font-semibold"
                            style={{ color: isYes ? "#22c55e" : "#f97316" }}
                          >
                            {bet.outcome.label}
                          </span>
                          {" · "}
                          <span className="inline-flex items-center gap-0.5">
                            <CoinIcon size={10} />{bet.amount.toLocaleString()} wagered
                          </span>
                          {bet.entryProbability
                            ? ` · Entry: ${bet.entryProbability.toFixed(0)}%`
                            : ""}
                        </p>
                      </div>
                      {resultLabel && (
                        <div className="shrink-0 text-right">
                          <p
                            className="inline-flex items-center gap-0.5 font-mono text-sm font-bold"
                            style={{ color: pnl >= 0 ? "#22c55e" : "#f97316" }}
                          >
                            {pnl >= 0 ? "+" : ""}
                            <CoinIcon size={12} />
                            {Math.abs(Math.round(pnl)).toLocaleString()}
                          </p>
                          <p className="text-xs text-[var(--muted)]">{resultLabel}</p>
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {recentBets.length === 0 && createdMarkets.length === 0 && (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted)]">
          No activity yet.
        </p>
      )}
    </div>
  );
}
