"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  CREATOR_DEPOSIT,
  REFUND_MIN_PARTICIPANTS,
  REFUND_MIN_VOLUME,
  CREATOR_REWARD_PER_PARTICIPANT,
  CREATOR_REWARD_PER_VOLUME,
  CREATOR_REWARD_CAP,
} from "@/lib/market-constants";
import {
  getDailyMissions,
  getWinMultiplier,
  getXpForAction,
  getLevelFromXp,
  NEAR_MISS_THRESHOLD,
} from "@/lib/gamification";

const createMarketSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(["yes_no", "multiple_choice"]),
  category: z.enum(["sports", "politics", "culture", "crypto", "tech"]).default("culture"),
  closesAt: z.string().datetime(),
  outcomes: z.array(z.object({ label: z.string().min(1).max(100) })).min(2),
});

export async function createMarket(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not signed in" };

  const raw = {
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    type: formData.get("type"),
    category: formData.get("category") || "culture",
    closesAt: formData.get("closesAt"),
    outcomes: JSON.parse((formData.get("outcomes") as string) || "[]"),
  };

  const parsed = createMarketSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { title, description, type, category, closesAt, outcomes } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true, winStreak: true, xp: true, level: true },
  });
  if (!user) return { error: "User not found" };
  if (user.balance < CREATOR_DEPOSIT) {
    return { error: `Insufficient balance. Need ${CREATOR_DEPOSIT} coins to create a market.` };
  }

  const newBalance = user.balance - CREATOR_DEPOSIT;

  // ─── XP + missions for creating a market ──────────────────────────────────
  const xpGained = getXpForAction("create_market");
  const today = new Date().toISOString().slice(0, 10);
  const dailyMissions = getDailyMissions(today);
  const createMission = dailyMissions.find((m) => m.type === "create_market");

  let missionCoinReward = 0;
  let missionXpGained = 0;

  const market = await prisma.$transaction(async (tx) => {
    const m = await tx.market.create({
      data: {
        title,
        description: description ?? null,
        type,
        category,
        creatorDeposit: CREATOR_DEPOSIT,
        closesAt: new Date(closesAt),
        createdById: session.user.id,
        outcomes: {
          create: outcomes.map((o, i) => ({ label: o.label, order: i })),
        },
      },
      include: { outcomes: true },
    });

    await tx.transaction.create({
      data: {
        userId: session.user.id,
        type: "deposit",
        amount: -CREATOR_DEPOSIT,
        balanceAfter: newBalance,
        referenceId: m.id,
      },
    });

    // Handle create_market mission progress
    if (createMission) {
      const existingProg = await tx.userMissionProgress.findUnique({
        where: {
          userId_missionKey_date: {
            userId: session.user.id,
            missionKey: createMission.key,
            date: today,
          },
        },
      });

      if (!existingProg?.completed) {
        const newProgress = (existingProg?.progress ?? 0) + 1;
        const nowCompleted = newProgress >= createMission.target;

        await tx.userMissionProgress.upsert({
          where: {
            userId_missionKey_date: {
              userId: session.user.id,
              missionKey: createMission.key,
              date: today,
            },
          },
          create: {
            userId: session.user.id,
            missionKey: createMission.key,
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
        });

        if (nowCompleted) {
          const multiplier = getWinMultiplier(user.winStreak);
          missionCoinReward = Math.floor(createMission.reward * multiplier);
          missionXpGained = getXpForAction("complete_mission");

          if (missionCoinReward > 0) {
            await tx.transaction.create({
              data: {
                userId: session.user.id,
                type: "mission_reward",
                amount: missionCoinReward,
                referenceId: createMission.key,
              },
            });
          }
        }
      }
    }

    const finalBalance = newBalance + missionCoinReward;
    const finalXp = user.xp + xpGained + missionXpGained;
    const finalLevel = getLevelFromXp(finalXp);

    await tx.user.update({
      where: { id: session.user.id },
      data: { balance: finalBalance, xp: finalXp, level: finalLevel },
    });

    return m;
  });

  revalidatePath("/");
  revalidatePath("/markets");
  return { marketId: market.id };
}

const resolveSchema = z.object({
  marketId: z.string(),
  outcomeId: z.string(),
});

export async function resolveMarket(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not signed in" };

  const raw = { marketId: formData.get("marketId"), outcomeId: formData.get("outcomeId") };
  const parsed = resolveSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid input" };

  const { marketId, outcomeId } = parsed.data;

  const market = await prisma.market.findFirst({
    where: { id: marketId, createdById: session.user.id },
    include: { outcomes: true, bets: true, createdBy: true },
  });

  if (!market) return { error: "Market not found or you are not the creator" };
  if (market.resolvedOutcomeId) return { error: "Market already resolved" };
  if (new Date() < market.closesAt) return { error: "Market has not closed yet" };
  if (!market.outcomes.some((o) => o.id === outcomeId)) return { error: "Invalid outcome" };

  const winningBets = market.bets.filter((b) => b.outcomeId === outcomeId);
  const losingBets = market.bets.filter((b) => b.outcomeId !== outcomeId);
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

  // ─── Gamification: collect all affected users ──────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const dailyMissions = getDailyMissions(today);
  const winBetsMission = dailyMissions.find((m) => m.type === "win_bets");

  // Group bets by user
  const winnerIds = new Set(winningBets.map((b) => b.userId));
  const loserIds = new Set(losingBets.map((b) => b.userId));

  // Per-outcome pool for near-miss detection
  const poolByOutcome = new Map<string, number>();
  for (const bet of market.bets) {
    poolByOutcome.set(bet.outcomeId, (poolByOutcome.get(bet.outcomeId) ?? 0) + bet.amount);
  }

  // Users whose outcome had ≥ NEAR_MISS_THRESHOLD share of the pool (but lost)
  const nearMissUserIds = new Set<string>();
  if (totalPool > 0) {
    Array.from(poolByOutcome.entries()).forEach(([outId, pool]) => {
      if (outId !== outcomeId && pool / totalPool >= NEAR_MISS_THRESHOLD) {
        losingBets.filter((b) => b.outcomeId === outId).forEach((bet) => {
          nearMissUserIds.add(bet.userId);
        });
      }
    });
  }

  // Fetch all affected users' gamification data
  const affectedUserIds = Array.from(new Set(Array.from(winnerIds).concat(Array.from(loserIds))));
  const affectedUsers = await prisma.user.findMany({
    where: { id: { in: affectedUserIds } },
    select: { id: true, balance: true, winStreak: true, xp: true, level: true },
  });
  const userMap = new Map(affectedUsers.map((u) => [u.id, u]));

  // Load win_bets mission progress for winners
  const winnerIdsArr = Array.from(winnerIds);
  const existingWinProgress =
    winBetsMission && winnerIdsArr.length > 0
      ? await prisma.userMissionProgress.findMany({
          where: {
            userId: { in: winnerIdsArr },
            missionKey: winBetsMission.key,
            date: today,
          },
        })
      : [];
  const winProgressMap = new Map(existingWinProgress.map((p) => [p.userId, p]));

  // ─── Zero-pool case ────────────────────────────────────────────────────────
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
    revalidatePath("/");
    revalidatePath("/markets");
    revalidatePath(`/markets/${marketId}`);
    return { ok: true };
  }

  // ─── Process each user sequentially (SQLite single-writer) ─────────────────
  const creatorId = market.createdById;

  for (const bet of winningBets) {
    const payout = winningPool > 0 ? Math.floor((bet.amount / winningPool) * totalPool) : 0;
    if (payout <= 0 && bet.userId !== creatorId) continue;

    const betUser = userMap.get(bet.userId);
    if (!betUser) continue;

    const newWinStreak = betUser.winStreak + 1;
    const xpGained = getXpForAction("win_bet");
    let extraCoins = 0;
    let extraXp = xpGained;
    const ops = [];

    // Win_bets mission
    if (winBetsMission) {
      const prog = winProgressMap.get(bet.userId);
      if (!prog?.completed) {
        const newProg = (prog?.progress ?? 0) + 1;
        const nowCompleted = newProg >= winBetsMission.target;
        ops.push(
          prisma.userMissionProgress.upsert({
            where: {
              userId_missionKey_date: {
                userId: bet.userId,
                missionKey: winBetsMission.key,
                date: today,
              },
            },
            create: {
              userId: bet.userId,
              missionKey: winBetsMission.key,
              date: today,
              progress: newProg,
              completed: nowCompleted,
              claimedAt: nowCompleted ? new Date() : null,
            },
            update: {
              progress: newProg,
              completed: nowCompleted,
              claimedAt: nowCompleted ? new Date() : undefined,
            },
          })
        );
        if (nowCompleted) {
          const multiplier = getWinMultiplier(newWinStreak);
          extraCoins += Math.floor(winBetsMission.reward * multiplier);
          extraXp += getXpForAction("complete_mission");
          if (extraCoins > 0) {
            ops.push(
              prisma.transaction.create({
                data: {
                  userId: bet.userId,
                  type: "mission_reward",
                  amount: Math.floor(winBetsMission.reward * getWinMultiplier(newWinStreak)),
                  referenceId: winBetsMission.key,
                },
              })
            );
          }
        }
      }
    }

    if (bet.userId !== creatorId) {
      const newBalance = betUser.balance + payout + extraCoins;
      const newXp = betUser.xp + extraXp;
      const newLevel = getLevelFromXp(newXp);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: bet.userId },
          data: { balance: newBalance, winStreak: newWinStreak, xp: newXp, level: newLevel },
        }),
        prisma.transaction.create({
          data: {
            userId: bet.userId,
            type: "win",
            amount: payout,
            balanceAfter: newBalance,
            referenceId: bet.id,
          },
        }),
        ...ops,
      ]);
    } else {
      // Creator's XP/streak update (balance handled below)
      const newXp = betUser.xp + extraXp;
      const newLevel = getLevelFromXp(newXp);
      await prisma.user.update({
        where: { id: bet.userId },
        data: { winStreak: newWinStreak, xp: newXp, level: newLevel },
      });
      if (ops.length > 0) {
        await prisma.$transaction(ops);
      }
    }
  }

  // ─── Process losers: reset winStreak, near-miss consolation ───────────────
  // Deduplicate losing users
  const processedLosers = new Set<string>();
  for (const bet of losingBets) {
    if (processedLosers.has(bet.userId)) continue;
    processedLosers.add(bet.userId);

    const betUser = userMap.get(bet.userId);
    if (!betUser) continue;

    const isNearMiss = nearMissUserIds.has(bet.userId);
    const nearMissBonus = isNearMiss ? 50 : 0;
    const nearMissXp = isNearMiss ? getXpForAction("near_miss") : 0;
    const newXp = betUser.xp + nearMissXp;
    const newLevel = getLevelFromXp(newXp);
    const newBalance = betUser.balance + nearMissBonus;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: bet.userId },
        data: { winStreak: 0, xp: newXp, level: newLevel, balance: newBalance },
      }),
      ...(isNearMiss
        ? [
            prisma.transaction.create({
              data: {
                userId: bet.userId,
                type: "near_miss",
                amount: nearMissBonus,
                balanceAfter: newBalance,
                referenceId: marketId,
              },
            }),
          ]
        : []),
    ]);
  }

  // ─── Creator balance + transactions ───────────────────────────────────────
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

  revalidatePath("/");
  revalidatePath("/markets");
  revalidatePath(`/markets/${marketId}`);
  return { ok: true };
}
