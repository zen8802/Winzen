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

  const [user, market, existingBets] = await Promise.all([
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

  let missionCoinRewards = 0;
  let missionXpGained = 0;

  type UpsertOp = ReturnType<typeof prisma.userMissionProgress.upsert>;
  type TxCreateOp = ReturnType<typeof prisma.transaction.create>;

  const missionUpserts: UpsertOp[] = [];
  const missionTxCreates: TxCreateOp[] = [];

  for (const mission of relevantMissions) {
    const existing = progressMap.get(mission.key);
    if (existing?.completed) continue;

    const currentProgress = existing?.progress ?? 0;
    const newProgress = currentProgress + 1;
    const nowCompleted = newProgress >= mission.target;

    missionUpserts.push(
      prisma.userMissionProgress.upsert({
        where: {
          userId_missionKey_date: {
            userId: session.user.id,
            missionKey: mission.key,
            date: today,
          },
        },
        create: {
          userId: session.user.id,
          missionKey: mission.key,
          date: today,
          progress: newProgress,
          completed: nowCompleted,
          claimedAt: nowCompleted ? new Date() : null,
        },
        update: {
          progress: newProgress,
          completed: nowCompleted,
          claimedAt: nowCompleted ? new Date() : undefined,
        },
      })
    );

    if (nowCompleted) {
      const multiplier = getWinMultiplier(user.winStreak);
      const coinReward = Math.floor(mission.reward * multiplier);
      missionCoinRewards += coinReward;
      missionXpGained += getXpForAction("complete_mission");

      if (coinReward > 0) {
        missionTxCreates.push(
          prisma.transaction.create({
            data: {
              userId: session.user.id,
              type: "mission_reward",
              amount: coinReward,
              referenceId: mission.key,
            },
          })
        );
      }
    }
  }

  const finalBalance = newBalance + missionCoinRewards;
  const finalXp = user.xp + xpGained + missionXpGained;
  const finalLevel = getLevelFromXp(finalXp);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { balance: finalBalance, xp: finalXp, level: finalLevel },
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
    ...missionUpserts,
    ...missionTxCreates,
  ]);

  revalidatePath("/");
  revalidatePath("/markets");
  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/portfolio");
  return { ok: true, missionRewards: missionCoinRewards };
}
