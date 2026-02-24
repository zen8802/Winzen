import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  REFUND_MIN_PARTICIPANTS,
  REFUND_MIN_VOLUME,
  CREATOR_REWARD_PER_PARTICIPANT,
  CREATOR_REWARD_PER_VOLUME,
  CREATOR_REWARD_CAP,
} from "@/lib/market-constants";
import { z } from "zod";

const bodySchema = z.object({
  market_id: z.string(),
  winning_side: z.string(), // outcome id or "yes"/"no" label
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

  const { market_id: marketId, winning_side: winningSide } = parsed.data;

  // Re-fetch role from DB — never trust JWT alone for authorization
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  const isAdmin = actor?.role === "admin";

  const market = await prisma.market.findFirst({
    where: {
      id: marketId,
      // Admins can resolve any market; creators can only resolve their own
      ...(isAdmin ? {} : { createdById: session.user.id }),
    },
    include: { outcomes: true, bets: true, createdBy: true },
  });

  if (!market) {
    return NextResponse.json({ error: "Market not found or access denied" }, { status: 404 });
  }
  if (market.resolvedOutcomeId) {
    return NextResponse.json({ error: "Market already resolved" }, { status: 400 });
  }
  // Admins can force-resolve before close date; creators cannot
  if (!isAdmin && new Date() < market.closesAt) {
    return NextResponse.json({ error: "Market has not closed yet" }, { status: 400 });
  }

  const outcome = market.outcomes.find(
    (o) => o.id === winningSide || o.label.toLowerCase() === winningSide.toLowerCase()
  );
  if (!outcome) {
    return NextResponse.json(
      { error: "Invalid winning_side. Use outcome id or 'yes'/'no'." },
      { status: 400 }
    );
  }
  const outcomeId = outcome.id;

  const winningBets = market.bets.filter((b) => b.outcomeId === outcomeId);
  const totalPool = market.bets.reduce((s, b) => s + b.amount, 0);
  const winningPool = winningBets.reduce((s, b) => s + b.amount, 0);

  const totalVolume = market.totalVolume;
  const participantCount = market.participantCount;
  const creatorDeposit = market.creatorDeposit;

  const shouldRefundDeposit =
    creatorDeposit > 0 &&
    (participantCount >= REFUND_MIN_PARTICIPANTS || totalVolume >= REFUND_MIN_VOLUME);
  const creatorReward = Math.min(
    CREATOR_REWARD_CAP,
    Math.floor(
      participantCount * CREATOR_REWARD_PER_PARTICIPANT + totalVolume * CREATOR_REWARD_PER_VOLUME
    )
  );

  const creator = market.createdBy;
  const creatorWinningBets = winningBets.filter((b) => b.userId === market.createdById);
  const creatorPayout =
    winningPool > 0 && creatorWinningBets.length > 0
      ? Math.floor(
          (creatorWinningBets.reduce((s, b) => s + b.amount, 0) / winningPool) * totalPool
        )
      : 0;

  let creatorNewBalance = creator.balance + creatorPayout;
  if (shouldRefundDeposit) creatorNewBalance += creatorDeposit;
  if (creatorReward > 0) creatorNewBalance += creatorReward;

  if (totalPool === 0) {
    await prisma.$transaction([
      prisma.market.update({
        where: { id: marketId },
        data: { resolvedOutcomeId: outcomeId },
      }),
      prisma.user.update({
        where: { id: market.createdById },
        data: { balance: creatorNewBalance },
      }),
      ...(shouldRefundDeposit
        ? [
            prisma.transaction.create({
              data: {
                userId: market.createdById,
                type: "deposit_refund",
                amount: creatorDeposit,
                balanceAfter: creator.balance + creatorDeposit,
                referenceId: marketId,
              },
            }),
          ]
        : []),
      ...(creatorReward > 0
        ? [
            prisma.transaction.create({
              data: {
                userId: market.createdById,
                type: "creator_reward",
                amount: creatorReward,
                balanceAfter: creatorNewBalance,
                referenceId: marketId,
              },
            }),
          ]
        : []),
    ]);

    return NextResponse.json({
      ok: true,
      market_id: marketId,
      winning_side: outcome.label,
      deposit_refunded: shouldRefundDeposit,
      creator_reward: creatorReward,
    });
  }

  const creatorId = market.createdById;
  for (const bet of winningBets) {
    const payout = winningPool > 0 ? Math.floor((bet.amount / winningPool) * totalPool) : 0;
    if (payout <= 0) continue;

    const user = await prisma.user.findUnique({ where: { id: bet.userId } });
    if (!user) continue;

    const newBalance = user.balance + payout;
    if (bet.userId !== creatorId) {
      await prisma.user.update({
        where: { id: bet.userId },
        data: { balance: newBalance },
      });
      await prisma.transaction.create({
        data: {
          userId: bet.userId,
          type: "win",
          amount: payout,
          balanceAfter: newBalance,
          referenceId: bet.id,
        },
      });
    }
  }

  const creatorWinTx =
    creatorPayout > 0
      ? prisma.transaction.create({
          data: {
            userId: market.createdById,
            type: "win",
            amount: creatorPayout,
            balanceAfter: creator.balance + creatorPayout,
            referenceId: creatorWinningBets[0]?.id ?? marketId,
          },
        })
      : null;

  await prisma.$transaction([
    prisma.market.update({
      where: { id: marketId },
      data: { resolvedOutcomeId: outcomeId },
    }),
    prisma.user.update({
      where: { id: market.createdById },
      data: { balance: creatorNewBalance },
    }),
    ...(creatorWinTx ? [creatorWinTx] : []),
    ...(shouldRefundDeposit
      ? [
          prisma.transaction.create({
            data: {
              userId: market.createdById,
              type: "deposit_refund",
              amount: creatorDeposit,
              balanceAfter: creator.balance + creatorPayout + creatorDeposit,
              referenceId: marketId,
            },
          }),
        ]
      : []),
    ...(creatorReward > 0
      ? [
          prisma.transaction.create({
            data: {
              userId: market.createdById,
              type: "creator_reward",
              amount: creatorReward,
              balanceAfter: creatorNewBalance,
              referenceId: marketId,
            },
          }),
        ]
      : []),
  ]);

  return NextResponse.json({
    ok: true,
    market_id: marketId,
    winning_side: outcome.label,
    deposit_refunded: shouldRefundDeposit,
    creator_reward: creatorReward,
  });
}
