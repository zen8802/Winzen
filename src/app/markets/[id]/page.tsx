import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PlaceBetForm } from "./PlaceBetForm";
import { ResolveForm } from "./ResolveForm";
import { CashOutButton } from "./CashOutButton";
import { ProbabilityChart } from "@/components/ProbabilityChart";
import { CountdownTimer } from "@/components/CountdownTimer";
import { MarketComments } from "@/components/MarketComments";
import { getMarketSnapshots, getUserBetPosition } from "@/app/actions/charts";
import { getComments } from "@/app/actions/comments";
import Link from "next/link";

async function getMarket(id: string) {
  return prisma.market.findUnique({
    where: { id },
    include: {
      outcomes: { orderBy: { order: "asc" } },
      bets: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export default async function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const market = await getMarket(id);
  if (!market) notFound();

  const session = await getServerSession(authOptions);
  const resolved = !!market.resolvedOutcomeId;
  const isCreator = session?.user?.id === market.createdById;
  const canResolve = isCreator && !resolved && new Date() >= market.closesAt;
  const marketClosed = resolved || new Date() >= market.closesAt;

  const yesProb = Math.round(market.currentProbability);
  const noProb = 100 - yesProb;

  // User's open positions on this market
  let userOpenBets: Array<{
    id: string;
    amount: number;
    entryProbability: number;
    shares: number;
    outcomeLabel: string;
    isYes: boolean;
    currentProb: number;
    currentValue: number;
    pnl: number;
    cashOutPayout: number;
  }> = [];
  let userBalance = 0;

  if (session?.user?.id) {
    const myBets = market.bets.filter((b) => b.userId === session.user.id && !b.closedAt);
    userOpenBets = myBets.map((b) => {
      const outcome = market.outcomes.find((o) => o.id === b.outcomeId);
      const isYes = outcome?.label.toLowerCase().startsWith("yes") ?? true;
      const shares = b.shares ?? b.amount / 50;
      const entryProb = b.entryProbability ?? 50;
      const currentProb = isYes ? market.currentProbability : 100 - market.currentProbability;
      const currentValue = shares * currentProb;
      return {
        id: b.id,
        amount: b.amount,
        entryProbability: entryProb,
        shares,
        outcomeLabel: outcome?.label ?? "?",
        isYes,
        currentProb,
        currentValue,
        pnl: currentValue - b.amount,
        cashOutPayout: Math.floor(shares * currentProb),
      };
    });

    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { balance: true },
    });
    userBalance = u?.balance ?? 0;
  }

  const [initialSnapshots, userPosition, initialComments] = await Promise.all([
    getMarketSnapshots(id),
    session?.user?.id ? getUserBetPosition(id, session.user.id) : Promise.resolve(null),
    getComments(id),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/markets" className="text-sm text-[var(--muted)] hover:text-[var(--accent)]">
        ← Back to markets
      </Link>
      <article className="card space-y-6">
        {/* Header */}
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded bg-[var(--logo)]/20 px-2 py-0.5 text-xs font-medium capitalize text-[var(--logo)]">
              {market.category}
            </span>
            <CountdownTimer
              closesAt={market.closesAt.toISOString()}
              resolved={resolved}
            />
          </div>
          <h1 className="text-2xl font-bold">{market.title}</h1>
          {market.description && (
            <p className="mt-2 text-[var(--muted)]">{market.description}</p>
          )}
          <p className="mt-2 text-xs text-[var(--muted)]">
            Closes {new Date(market.closesAt).toLocaleString()}
            {resolved &&
              ` · Resolved: ${market.outcomes.find((o) => o.id === market.resolvedOutcomeId)?.label ?? "—"}`}
          </p>
        </div>

        {/* Current Probability Display */}
        <div className="flex items-center gap-6 rounded-xl border border-[var(--border)] bg-white/[0.02] p-4">
          <div className="flex-1 text-center">
            <p className="text-3xl font-extrabold text-green-400">{yesProb}%</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              YES
            </p>
          </div>
          <div className="h-12 w-px bg-[var(--border)]" />
          <div className="flex-1 text-center">
            <p className="text-3xl font-extrabold text-orange-400">{noProb}%</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              NO
            </p>
          </div>
        </div>

        {/* Probability Chart */}
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--muted)]">Probability over time</p>
          <ProbabilityChart
            marketId={market.id}
            outcomes={market.outcomes}
            initialSnapshots={initialSnapshots}
            userPosition={userPosition}
            marketClosed={marketClosed}
          />
        </div>

        {/* User Positions */}
        {userOpenBets.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--muted)]">Your positions</p>
            <ul className="space-y-2">
              {userOpenBets.map((pos) => (
                <li
                  key={pos.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-white/[0.02] px-4 py-3"
                >
                  <div className="space-y-0.5">
                    <p
                      className="font-semibold"
                      style={{ color: pos.isYes ? "#22c55e" : "#f97316" }}
                    >
                      {pos.outcomeLabel}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      Entry: {pos.entryProbability.toFixed(1)}% · {pos.shares.toFixed(3)} shares ·{" "}
                      {pos.amount} coins
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      Now: {pos.currentProb.toFixed(1)}% · Value:{" "}
                      {pos.currentValue.toFixed(0)} coins
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className="font-mono text-sm font-bold"
                      style={{ color: pos.pnl >= 0 ? "#22c55e" : "#f97316" }}
                    >
                      {pos.pnl >= 0 ? "+" : ""}
                      {pos.pnl.toFixed(0)} coins
                    </span>
                    {!marketClosed && (
                      <CashOutButton betId={pos.id} payout={pos.cashOutPayout} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Bet Form */}
        {session?.user && !resolved && new Date() < market.closesAt && (
          <PlaceBetForm
            marketId={market.id}
            outcomes={market.outcomes}
            currentProbability={market.currentProbability}
            userBalance={userBalance}
            liquidity={market.liquidity}
          />
        )}

        {canResolve && <ResolveForm marketId={market.id} outcomes={market.outcomes} />}
      </article>

      {/* Comments */}
      <section className="card">
        <MarketComments
          marketId={market.id}
          initialComments={initialComments}
          isSignedIn={!!session?.user?.id}
        />
      </section>
    </div>
  );
}
