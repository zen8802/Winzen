import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AdminResolveButton } from "./AdminResolveButton";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  // Always re-verify role from DB — never trust JWT alone
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (actor?.role !== "admin") redirect("/");

  const markets = await prisma.market.findMany({
    where: { resolvedOutcomeId: null },
    include: {
      outcomes: { orderBy: { order: "asc" } },
    },
    orderBy: { closesAt: "asc" },
  });

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {markets.length} unresolved market{markets.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/sim" className="btn-ghost text-sm">
            Sim Monitor →
          </Link>
          <Link href="/" className="btn-ghost text-sm">
            ← Back to home
          </Link>
        </div>
      </div>

      <ul className="space-y-4">
        {markets.map((market) => {
          const isOpen = now < market.closesAt;
          return (
            <li key={market.id} className="card space-y-3">
              {/* Market info */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[var(--logo)]/20 px-2 py-0.5 text-xs font-medium capitalize text-[var(--logo)]">
                      {market.category}
                    </span>
                    {isOpen && (
                      <span className="rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-400">
                        Open
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/markets/${market.id}`}
                    className="mt-1 block font-medium text-[var(--text)] hover:text-[var(--accent)]"
                  >
                    {market.title}
                  </Link>
                  <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">
                    Vol: {market.totalVolume.toLocaleString()} coins ·{" "}
                    YES: {Math.round(market.currentProbability)}% ·{" "}
                    Closes {new Date(market.closesAt).toLocaleDateString([], {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Resolve buttons */}
              <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                {market.outcomes.map((outcome) => (
                  <AdminResolveButton
                    key={outcome.id}
                    marketId={market.id}
                    marketTitle={market.title}
                    outcomeId={outcome.id}
                    outcomeLabel={outcome.label}
                  />
                ))}
              </div>
            </li>
          );
        })}

        {markets.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted)]">
            All markets resolved.
          </p>
        )}
      </ul>
    </div>
  );
}
