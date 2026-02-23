import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({
  market_id: z.string(),
  side: z.string(), // outcome id or "yes"/"no" label
  amount: z.number().int().min(1),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { market_id: marketId, side, amount } = parsed.data;

  const [user, market, existingBets] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.market.findUnique({
      where: { id: marketId },
      include: { outcomes: true },
    }),
    prisma.bet.findMany({
      where: { userId: session.user.id, marketId },
      select: { outcomeId: true },
    }),
  ]);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });
  if (market.resolvedOutcomeId) {
    return NextResponse.json({ error: "Market already resolved" }, { status: 400 });
  }
  if (new Date() > market.closesAt) {
    return NextResponse.json({ error: "Market has closed" }, { status: 400 });
  }

  const outcome = market.outcomes.find(
    (o) => o.id === side || o.label.toLowerCase() === side.toLowerCase()
  );
  if (!outcome) {
    return NextResponse.json({ error: "Invalid side. Use outcome id or 'yes'/'no'." }, { status: 400 });
  }
  const outcomeId = outcome.id;

  if (user.balance < amount) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
  }

  const betOutcomes = [...new Set(existingBets.map((b) => b.outcomeId))];
  if (betOutcomes.length > 0 && !betOutcomes.includes(outcomeId)) {
    const existingOutcome = market.outcomes.find((o) => o.id === betOutcomes[0]);
    return NextResponse.json(
      {
        error: `You've already bet on "${existingOutcome?.label ?? "this outcome"}". You can only add to your position, not switch sides.`,
      },
      { status: 400 }
    );
  }

  const newBalance = user.balance - amount;
  const isNewParticipant = existingBets.length === 0;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { balance: newBalance },
    }),
    prisma.bet.create({
      data: { userId: session.user.id, marketId, outcomeId, amount },
    }),
    prisma.market.update({
      where: { id: marketId },
      data: {
        totalVolume: { increment: amount },
        ...(isNewParticipant ? { participantCount: { increment: 1 } } : {}),
      },
    }),
    prisma.transaction.create({
      data: {
        userId: session.user.id,
        type: "bet",
        amount: -amount,
        balanceAfter: newBalance,
        referenceId: marketId,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    market_id: marketId,
    side: outcome.label,
    amount,
    balance_after: newBalance,
  });
}
