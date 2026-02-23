import { notFound } from "next/navigation";
import { getOutcomeColors } from "@/lib/outcome-colors";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PlaceBetForm } from "./PlaceBetForm";
import { ResolveForm } from "./ResolveForm";
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

function marketStats(market: NonNullable<Awaited<ReturnType<typeof getMarket>>>) {
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
  return { total, outcomeShares };
}

export default async function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const market = await getMarket(id);
  if (!market) notFound();

  const session = await getServerSession(authOptions);
  const { total, outcomeShares } = marketStats(market);
  const resolved = !!market.resolvedOutcomeId;
  const isCreator = session?.user?.id === market.createdById;
  const canResolve = isCreator && !resolved && new Date() >= market.closesAt;

  let existingOutcomeId: string | null = null;
  if (session?.user?.id) {
    const myBets = market.bets.filter((b) => b.userId === session.user.id);
    const outcomeIds = [...new Set(myBets.map((b) => b.outcomeId))];
    if (outcomeIds.length === 1) existingOutcomeId = outcomeIds[0];
  }

  return (
    <div className="space-y-6">
      <Link href="/markets" className="text-sm text-[var(--muted)] hover:text-[var(--accent)]">
        ← Back to markets
      </Link>
      <article className="card space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{market.title}</h1>
          {market.description && (
            <p className="mt-2 text-[var(--muted)]">{market.description}</p>
          )}
          <p className="mt-2 text-xs text-[var(--muted)]">
            Closes {new Date(market.closesAt).toLocaleString()}
            {resolved && ` · Resolved: ${market.outcomes.find((o) => o.id === market.resolvedOutcomeId)?.label ?? "—"}`}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--muted)]">Outcomes & pool share</p>
          <div className="space-y-2">
            {outcomeShares.map((o, i) => {
              const c = getOutcomeColors(i);
              return (
                <div key={o.id} className="flex items-center gap-3">
                  <div className="flex-1 overflow-hidden rounded-lg border" style={{ borderColor: c.border, backgroundColor: c.bg }}>
                    <div
                      className="h-8 rounded-lg transition-all"
                      style={{ width: `${Math.max(o.pct, 4)}%`, backgroundColor: c.border, opacity: 0.8 }}
                    />
                  </div>
                  <span className="w-24 text-right font-mono text-sm" style={{ color: c.text }}>
                    {o.label} {o.pct}% ({o.amount} coins)
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-[var(--muted)]">Total pool: {total} coins</p>
        </div>

        {session?.user && !resolved && new Date() < market.closesAt && (
          <PlaceBetForm
            marketId={market.id}
            outcomes={market.outcomes}
            outcomeShares={outcomeShares}
            totalPool={total}
            userBalance={session.user.id ? await (async () => {
              const u = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { balance: true },
              });
              return u?.balance ?? 0;
            })() : 0}
            existingOutcomeId={existingOutcomeId}
          />
        )}

        {canResolve && (
          <ResolveForm marketId={market.id} outcomes={market.outcomes} />
        )}
      </article>
    </div>
  );
}
