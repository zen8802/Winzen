import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ResolvedBetsList } from "./ResolvedBetsList";
import Link from "next/link";

async function getResolvedBets(userId: string) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return prisma.bet.findMany({
    where: {
      userId,
      closedAt: null,
      market: {
        resolvedOutcomeId: { not: null },
        OR: [
          { resolvedAt: null },             // legacy: resolved before field existed
          { resolvedAt: { lte: oneHourAgo } }, // resolved more than 1 hour ago
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      market: {
        select: {
          id: true,
          title: true,
          resolvedOutcomeId: true,
          resolvedAt: true,
        },
      },
      outcome: { select: { id: true, label: true } },
    },
  });
}

export default async function ResolvedBetsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const bets = await getResolvedBets(session.user.id);

  return (
    <div className="space-y-6">
      <section className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text)]">Resolved Bets</h1>
          <p className="mt-2 text-[var(--muted)]">
            All your bets on markets that have been resolved.
          </p>
        </div>
        <Link href="/portfolio" className="btn-ghost text-sm shrink-0">
          ← Portfolio
        </Link>
      </section>

      <ResolvedBetsList bets={bets} />
    </div>
  );
}
