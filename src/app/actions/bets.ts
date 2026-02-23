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
import { computeProbabilities } from "@/lib/probability";

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

  const [user, market, existingBets, currentBetTotals] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { balance: true, winStreak: true, xp: true, level: true },
    }),
    prisma.market.findUnique({
      where: { id: marketId },
      include: { outcomes: true },
    }),
    prisma.bet.findMany({
      where: { userId: session.user.id, marketId },
      select: { outcomeId: true },
    }),
    prisma.bet.groupBy({
      by: ["outcomeId"],
      where: { marketId },
      _sum: { amount: true },
    }),
  ]);

  if (!user) return { error: "User not found" };
  if (!market) return { error: "Market not found" };
  if (market.resolvedOutcomeId) return { error: "Market already resolved" };
  if (new Date() > market.closesAt) return { error: "Market has closed" };
  if (!market.outcomes.some((o) => o.id === outcomeId)) return { error: "Invalid outcome" };
  if (user.balance < amount) return { error: "Insufficient balance" };

  const betOutcomes = Array.from(new Set(existingBets.map((b) => b.outcomeId)));
  if (betOutcomes.length > 0 && !betOutcomes.includes(outcomeId)) {
    const existingOutcome = market.outcomes.find((o) => o.id === betOutcomes[0]);
    return {
      error: `You've already bet on "${existingOutcome?.label ?? "this outcome"}". You can only add to your position, not switch sides.`,
    };
  }

  const newBalance = user.balance - amount;
  const isNewParticipant = existingBets.length === 0;

  // ─── Probability snapshot (post-bet state) ────────────────────────────────
  const poolByOutcome = new Map<string, number>();
  for (const row of currentBetTotals) {
    poolByOutcome.set(row.outcomeId, row._sum.amount ?? 0);
  }
  const simulatedPool = new Map(poolByOutcome);
  simulatedPool.set(outcomeId, (simulatedPool.get(outcomeId) ?? 0) + amount);
  const postBetProbs = computeProbabilities(market.outcomes, simulatedPool);
  const entryProbability = postBetProbs.get(outcomeId)!;
  const snapshotNow = new Date();

  // ─── XP ───────────────────────────────────────────────────────────────────
  const xpGained = getXpForAction("place_bet");

  // ─── Daily missions ───────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const dailyMissions = getDailyMissions(today);
  const isTrending = isTrendingMarket(market.totalVolume, market.participantCount);

  const relevantMissions = dailyMissions.filter(
    (m) => m.type === "place_bets" || (m.type === "bet_trending" && isTrending)
  );

  const missionKeys = relevantMissions.map((m) => m.key);
  const existingProgress =
    missionKeys.length > 0
      ? await prisma.userMissionProgress.findMany({
          where: { userId: session.user.id, date: today, missionKey: { in: missionKeys } },
        })
      : [];
  const progressMap = new Map(existingProgress.map((p) => [p.missionKey, p]));

  // Pre-compute mission outcomes
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
      data: { balance: finalBalance, xp: finalXp, level: finalLevel },
    });

    await tx.bet.create({
      data: { userId: session.user.id, marketId, outcomeId, amount, entryProbability },
    });

    await tx.market.update({
      where: { id: marketId },
      data: {
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

    // Mission upserts
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

    // Probability snapshot
    await tx.probabilitySnapshot.createMany({
      data: market.outcomes.map((o) => ({
        marketId,
        outcomeId: o.id,
        probability: postBetProbs.get(o.id)!,
        recordedAt: snapshotNow,
      })),
    });
  });

  revalidatePath("/");
  revalidatePath("/markets");
  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/portfolio");
  return { ok: true, missionRewards: missionCoinRewards };
}
