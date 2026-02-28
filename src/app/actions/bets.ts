"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  getDailyMissions,
  getWinMultiplier,
  getXpForAction,
  getLevelFromXp,
  isTrendingMarket,
} from "@/lib/gamification";
import { computeAmmProbability } from "@/lib/probability";
import { awardBattlePassXp, awardBpQuestXp } from "@/app/actions/battle-pass";
import { BP_FIRST_BET_XP } from "@/lib/battle-pass";

const placeBetSchema = z.object({
  marketId: z.string(),
  outcomeId: z.string(),
  amount: z.number().int().min(1),
});

export async function placeBet(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not signed in" };

  const raw = {
    marketId: formData.get("marketId"),
    outcomeId: formData.get("outcomeId"),
    amount: Number(formData.get("amount")),
  };
  const parsed = placeBetSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid amount or selection" };

  const { marketId, outcomeId, amount } = parsed.data;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [user, market, existingBets, firstBetToday] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { balance: true, winStreak: true, xp: true, level: true, name: true },
    }),
    prisma.market.findUnique({
      where: { id: marketId },
      include: { outcomes: true },
    }),
    prisma.bet.findMany({
      where: { userId: session.user.id, marketId },
      select: { outcomeId: true },
    }),
    prisma.bet.findFirst({
      where: { userId: session.user.id, createdAt: { gte: todayStart } },
      select: { id: true },
    }),
  ]);

  if (!user) return { error: "User not found" };
  if (!market) return { error: "Market not found" };
  if (market.resolvedOutcomeId) return { error: "Market already resolved" };
  if (new Date() > market.closesAt) return { error: "Market has closed" };
  if (!market.outcomes.some((o) => o.id === outcomeId)) return { error: "Invalid outcome" };
  if (user.balance < amount) return { error: "Insufficient balance" };

  const chosenOutcome = market.outcomes.find((o) => o.id === outcomeId)!;
  const isYes = chosenOutcome.label.toLowerCase().startsWith("yes");
  const direction: 1 | -1 = isYes ? 1 : -1;

  // ─── AMM Pricing ──────────────────────────────────────────────────────────
  const newYesProb = computeAmmProbability(
    market.currentProbability,
    amount,
    direction,
    market.liquidity,
  );
  // entryProbability = probability of the CHOSEN outcome (1–99 scale)
  const entryProbability = isYes ? newYesProb : 100 - newYesProb;
  const shares = amount / entryProbability;

  const newBalance = user.balance - amount;
  const isNewParticipant = existingBets.length === 0;

  const snapshotNow = new Date();

  // ─── XP ───────────────────────────────────────────────────────────────────
  const xpGained = getXpForAction("place_bet");

  // ─── Daily missions ───────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const dailyMissions = getDailyMissions(today);
  const isTrending = isTrendingMarket(market.totalVolume, market.participantCount);

  const relevantMissions = dailyMissions.filter(
    (m) => m.type === "place_bets" || (m.type === "bet_trending" && isTrending),
  );

  const missionKeys = relevantMissions.map((m) => m.key);
  const existingProgress =
    missionKeys.length > 0
      ? await prisma.userMissionProgress.findMany({
          where: { userId: session.user.id, date: today, missionKey: { in: missionKeys } },
        })
      : [];
  const progressMap = new Map(existingProgress.map((p) => [p.missionKey, p]));

  type MissionOutcome = {
    key: string;
    newProgress: number;
    nowCompleted: boolean;
    coinReward: number;
    xpReward: number;
  };
  let missionCoinRewards = 0;
  let missionXpGained = 0;
  const missionOutcomes: MissionOutcome[] = [];

  for (const mission of relevantMissions) {
    const existing = progressMap.get(mission.key);
    if (existing?.completed) continue;

    const currentProgress = existing?.progress ?? 0;
    const newProgress = currentProgress + 1;
    const nowCompleted = newProgress >= mission.target;
    let coinReward = 0;
    let xpReward = 0;

    if (nowCompleted) {
      const multiplier = getWinMultiplier(user.winStreak);
      coinReward = Math.floor(mission.reward * multiplier);
      xpReward = getXpForAction("complete_mission");
      missionCoinRewards += coinReward;
      missionXpGained += xpReward;
    }

    missionOutcomes.push({ key: mission.key, newProgress, nowCompleted, coinReward, xpReward });
  }

  const finalBalance = newBalance + missionCoinRewards;
  const finalXp = user.xp + xpGained + missionXpGained;
  const finalLevel = getLevelFromXp(finalXp);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.user.id },
      data: { balance: finalBalance, xp: finalXp, level: finalLevel, totalTrades: { increment: 1 } },
    });

    await tx.bet.create({
      data: {
        userId: session.user.id,
        marketId,
        outcomeId,
        amount,
        entryProbability,
        shares,
      },
    });

    await tx.market.update({
      where: { id: marketId },
      data: {
        currentProbability: newYesProb,
        totalVolume: { increment: amount },
        ...(isNewParticipant ? { participantCount: { increment: 1 } } : {}),
      },
    });

    await tx.transaction.create({
      data: {
        userId: session.user.id,
        type: "bet",
        amount: -amount,
        balanceAfter: newBalance,
        referenceId: marketId,
      },
    });

    for (const mo of missionOutcomes) {
      await tx.userMissionProgress.upsert({
        where: {
          userId_missionKey_date: {
            userId: session.user.id,
            missionKey: mo.key,
            date: today,
          },
        },
        create: {
          userId: session.user.id,
          missionKey: mo.key,
          date: today,
          progress: mo.newProgress,
          completed: mo.nowCompleted,
          claimedAt: mo.nowCompleted ? new Date() : null,
        },
        update: {
          progress: mo.newProgress,
          completed: mo.nowCompleted,
          claimedAt: mo.nowCompleted ? new Date() : undefined,
        },
      });

      if (mo.nowCompleted && mo.coinReward > 0) {
        await tx.transaction.create({
          data: {
            userId: session.user.id,
            type: "mission_reward",
            amount: mo.coinReward,
            referenceId: mo.key,
          },
        });
      }
    }

    // Probability snapshot (0.01–0.99 scale for chart compatibility)
    await tx.probabilitySnapshot.createMany({
      data: market.outcomes.map((o) => {
        const oIsYes = o.label.toLowerCase().startsWith("yes");
        return {
          marketId,
          outcomeId: o.id,
          probability: oIsYes ? newYesProb / 100 : (100 - newYesProb) / 100,
          recordedAt: snapshotNow,
        };
      }),
    });
  });

  // ─── Battle Pass XP (fire-and-forget) ────────────────────────────────────
  if (!firstBetToday) {
    void awardBattlePassXp(session.user.id, BP_FIRST_BET_XP);
  }
  const completedMissions = missionOutcomes.filter((mo) => mo.nowCompleted);
  if (completedMissions.length > 0) {
    void awardBpQuestXp(session.user.id, today);
  }

  // ─── Activity feed entry ──────────────────────────────────────────────────
  const side = chosenOutcome.label.toLowerCase().startsWith("yes") ? "YES" : "NO";
  await prisma.activity.create({
    data: {
      type: "TRADE",
      userId: session.user.id,
      username: user.name ?? undefined,
      marketId,
      marketTitle: market.title,
      side,
      amount,
      price: entryProbability,
    },
  });
  // Trim activity table to 200 most recent entries
  const toDelete = await prisma.activity.findMany({
    orderBy: { createdAt: "desc" },
    skip: 200,
    select: { id: true },
  });
  if (toDelete.length > 0) {
    await prisma.activity.deleteMany({ where: { id: { in: toDelete.map((a) => a.id) } } });
  }

  revalidatePath("/");
  revalidatePath("/markets");
  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/portfolio");
  return { ok: true, missionRewards: missionCoinRewards };
}

// ─── Cash Out (early exit) ────────────────────────────────────────────────────

const cashOutSchema = z.object({ betId: z.string() });

export async function cashOut(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not signed in" };

  const parsed = cashOutSchema.safeParse({ betId: formData.get("betId") });
  if (!parsed.success) return { error: "Invalid input" };

  const { betId } = parsed.data;

  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    include: {
      market: { select: { id: true, currentProbability: true, resolvedOutcomeId: true } },
      outcome: { select: { label: true } },
    },
  });

  if (!bet) return { error: "Bet not found" };
  if (bet.userId !== session.user.id) return { error: "Not your bet" };
  if (bet.closedAt) return { error: "Position already closed" };
  if (bet.market.resolvedOutcomeId) return { error: "Market already resolved — use winnings" };

  const isYes = bet.outcome.label.toLowerCase().startsWith("yes");
  const currentProbForChosen = isYes
    ? bet.market.currentProbability
    : 100 - bet.market.currentProbability;
  const shares = bet.shares ?? bet.amount / 50;
  const payout = Math.floor(shares * currentProbForChosen);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true },
  });
  if (!user) return { error: "User not found" };

  const newBalance = user.balance + payout;

  await prisma.$transaction(async (tx) => {
    await tx.bet.update({
      where: { id: betId },
      data: { closedAt: new Date(), exitProbability: currentProbForChosen },
    });

    await tx.user.update({
      where: { id: session.user.id },
      data: { balance: newBalance },
    });

    await tx.transaction.create({
      data: {
        userId: session.user.id,
        type: "cashout",
        amount: payout,
        balanceAfter: newBalance,
        referenceId: betId,
      },
    });

    await tx.portfolioSnapshot.create({
      data: { userId: session.user.id, totalValue: newBalance },
    });
  });

  revalidatePath(`/markets/${bet.market.id}`);
  revalidatePath("/portfolio");
  return { ok: true, payout };
}
