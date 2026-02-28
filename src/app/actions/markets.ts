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
import { getDailyMarketLimit } from "@/lib/battle-pass";
import { awardBpQuestXp } from "@/app/actions/battle-pass";
import {
  getDailyMissions,
  getWinMultiplier,
  getXpForAction,
  getLevelFromXp,
  NEAR_MISS_THRESHOLD,
} from "@/lib/gamification";
import { computeProbabilities } from "@/lib/probability";
import { computeEloUpdate } from "@/lib/elo";

const createMarketSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional(),
  type: z.enum(["yes_no", "multiple_choice"]),
  category: z.enum(["sports", "politics", "culture", "crypto", "tech"]).default("culture"),
  closesAt: z.string().datetime(),
  outcomes: z.array(z.object({ label: z.string().min(1).max(100) })).min(2),
});

export async function createMarket(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not signed in" };

  const imageUrlRaw = (formData.get("imageUrl") as string | null) ?? "";
  const raw = {
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    imageUrl: imageUrlRaw.trim() || undefined,
    type: formData.get("type"),
    category: formData.get("category") || "culture",
    closesAt: formData.get("closesAt"),
    outcomes: JSON.parse((formData.get("outcomes") as string) || "[]"),
  };

  const parsed = createMarketSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { title, description, imageUrl, type, category, closesAt, outcomes } = parsed.data;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [user, marketsToday] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { balance: true, winStreak: true, xp: true, level: true, battlePassSeasonId: true },
    }),
    prisma.market.count({
      where: { createdById: session.user.id, createdAt: { gte: todayStart } },
    }),
  ]);
  if (!user) return { error: "User not found" };
  if (user.balance < CREATOR_DEPOSIT) {
    return { error: `Insufficient balance. Need ${CREATOR_DEPOSIT} coins to create a market.` };
  }

  const dailyLimit = getDailyMarketLimit(!!user.battlePassSeasonId);
  if (marketsToday >= dailyLimit) {
    return { error: `Daily market creation limit reached (${dailyLimit}/day).` };
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
        imageUrl: imageUrl ?? null,
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

    // ─── Initial probability snapshot ─────────────────────────────────────────
    const snapshotNow = new Date();
    const initialProbs = computeProbabilities(m.outcomes, new Map());
    await tx.probabilitySnapshot.createMany({
      data: m.outcomes.map((o) => ({
        marketId: m.id,
        outcomeId: o.id,
        probability: initialProbs.get(o.id)!,
        recordedAt: snapshotNow,
      })),
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

  // ─── BP XP for quest completion (fire-and-forget) ────────────────────────
  if (missionCoinReward > 0) {
    // missionCoinReward > 0 means the create_market mission just completed
    void awardBpQuestXp(session.user.id, today);
  }

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

  // Fetch role fresh from DB — never trust JWT alone for authorization
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
    include: {
      outcomes: true,
      bets: { select: { id: true, userId: true, outcomeId: true, amount: true, shares: true, entryProbability: true, closedAt: true } },
      createdBy: { select: { id: true, balance: true, eloRating: true } },
    },
  });

  if (!market) return { error: "Market not found or access denied" };
  if (market.resolvedOutcomeId) return { error: "Market already resolved" };
  // Admins can force-resolve before the close date; creators cannot
  if (!isAdmin && new Date() < market.closesAt) return { error: "Market has not closed yet" };
  if (!market.outcomes.some((o) => o.id === outcomeId)) return { error: "Invalid outcome" };

  const winningOutcome = market.outcomes.find((o) => o.id === outcomeId)!;

  // Only process active (non-cashed-out) bets
  const activeBets = market.bets.filter((b) => !b.closedAt);

  const totalVolume = market.totalVolume;
  const participantCount = market.participantCount;
  const creatorDeposit = market.creatorDeposit;

  const shouldRefundDeposit =
    creatorDeposit > 0 &&
    (participantCount >= REFUND_MIN_PARTICIPANTS || totalVolume >= REFUND_MIN_VOLUME);
  const creatorReward = Math.min(
    CREATOR_REWARD_CAP,
    Math.floor(
      participantCount * CREATOR_REWARD_PER_PARTICIPANT + totalVolume * CREATOR_REWARD_PER_VOLUME,
    ),
  );

  // ─── Build per-user summaries ──────────────────────────────────────────────
  type BetRow = (typeof activeBets)[number];
  type UserSummary = {
    userId: string;
    won: boolean; // has at least one winning bet
    winningBets: BetRow[];
    losingBets: BetRow[];
  };

  const userSummaryMap = new Map<string, UserSummary>();
  for (const bet of activeBets) {
    const s = userSummaryMap.get(bet.userId) ?? {
      userId: bet.userId,
      won: false,
      winningBets: [],
      losingBets: [],
    };
    if (bet.outcomeId === outcomeId) {
      s.won = true;
      s.winningBets.push(bet);
    } else {
      s.losingBets.push(bet);
    }
    userSummaryMap.set(bet.userId, s);
  }

  // ─── Near-miss detection ──────────────────────────────────────────────────
  const poolByOutcome = new Map<string, number>();
  for (const bet of activeBets) {
    poolByOutcome.set(bet.outcomeId, (poolByOutcome.get(bet.outcomeId) ?? 0) + bet.amount);
  }
  const totalActiveAmount = activeBets.reduce((s, b) => s + b.amount, 0);
  const nearMissUserIds = new Set<string>();
  if (totalActiveAmount > 0) {
    Array.from(poolByOutcome.entries()).forEach(([outId, pool]) => {
      if (outId !== outcomeId && pool / totalActiveAmount >= NEAR_MISS_THRESHOLD) {
        activeBets
          .filter((b) => b.outcomeId === outId)
          .forEach((bet) => nearMissUserIds.add(bet.userId));
      }
    });
  }

  // ─── Gamification setup ───────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const dailyMissions = getDailyMissions(today);
  const winBetsMission = dailyMissions.find((m) => m.type === "win_bets");

  const affectedUserIds = Array.from(userSummaryMap.keys());
  const affectedUsers = await prisma.user.findMany({
    where: { id: { in: affectedUserIds } },
    select: { id: true, balance: true, winStreak: true, xp: true, level: true, eloRating: true, name: true },
  });
  const userMap = new Map(affectedUsers.map((u) => [u.id, u]));

  const winnerIdsArr = Array.from(userSummaryMap.values())
    .filter((s) => s.won)
    .map((s) => s.userId);
  const existingWinProgress =
    winBetsMission && winnerIdsArr.length > 0
      ? await prisma.userMissionProgress.findMany({
          where: { userId: { in: winnerIdsArr }, missionKey: winBetsMission.key, date: today },
        })
      : [];
  const winProgressMap = new Map(existingWinProgress.map((p) => [p.userId, p]));

  // ─── Mark market resolved ─────────────────────────────────────────────────
  await prisma.market.update({
    where: { id: marketId },
    data: { resolvedOutcomeId: outcomeId },
  });

  // ─── Process each user ───────────────────────────────────────────────────
  for (const summary of Array.from(userSummaryMap.values())) {
    const betUser = userMap.get(summary.userId);
    if (!betUser) continue;

    // ── Compute ELO delta across all this user's active bets ──────────────
    let eloDelta = 0;
    let runningRating = betUser.eloRating;
    for (const bet of [...summary.winningBets, ...summary.losingBets]) {
      const betOutcome = market.outcomes.find((o) => o.id === bet.outcomeId);
      const betIsYes = betOutcome?.label.toLowerCase().startsWith("yes") ?? true;
      const betWon = bet.outcomeId === outcomeId;
      // marketProbAtResolution = prob of CHOSEN outcome at market resolution
      const marketProbAtRes = betWon
        ? betIsYes
          ? market.currentProbability
          : 100 - market.currentProbability
        : betIsYes
          ? 100 - market.currentProbability
          : market.currentProbability;
      const entryProb = bet.entryProbability ?? 50;
      const { delta } = computeEloUpdate(runningRating, entryProb, marketProbAtRes, betWon);
      eloDelta += delta;
      runningRating = Math.max(100, runningRating + delta);
    }
    const newEloRating = Math.max(100, betUser.eloRating + eloDelta);

    if (summary.won) {
      // ── Winner processing ────────────────────────────────────────────────
      const totalPayout = summary.winningBets.reduce(
        (s: number, b: BetRow) => s + Math.floor((b.shares ?? b.amount / 50) * 100),
        0,
      );
      const totalWinStake = summary.winningBets.reduce((s: number, b: BetRow) => s + b.amount, 0);
      const totalLoseStake = summary.losingBets.reduce((s: number, b: BetRow) => s + b.amount, 0);
      const netProfit = totalPayout - totalWinStake - totalLoseStake;
      const newWinStreak = betUser.winStreak + 1;
      const xpGained = getXpForAction("win_bet");
      let extraCoins = 0;
      let extraXp = xpGained;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const missionOps: any[] = [];

      if (winBetsMission) {
        const prog = winProgressMap.get(summary.userId);
        if (!prog?.completed) {
          const newProg = (prog?.progress ?? 0) + 1;
          const nowCompleted = newProg >= winBetsMission.target;
          missionOps.push(
            prisma.userMissionProgress.upsert({
              where: {
                userId_missionKey_date: {
                  userId: summary.userId,
                  missionKey: winBetsMission.key,
                  date: today,
                },
              },
              create: {
                userId: summary.userId,
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
            }),
          );
          if (nowCompleted) {
            const multiplier = getWinMultiplier(newWinStreak);
            extraCoins = Math.floor(winBetsMission.reward * multiplier);
            extraXp += getXpForAction("complete_mission");
            if (extraCoins > 0) {
              missionOps.push(
                prisma.transaction.create({
                  data: {
                    userId: summary.userId,
                    type: "mission_reward",
                    amount: extraCoins,
                    referenceId: winBetsMission.key,
                  },
                }),
              );
            }
          }
        }
      }

      const newBalance = betUser.balance + totalPayout + extraCoins;
      const newXp = betUser.xp + extraXp;
      const newLevel = getLevelFromXp(newXp);

      // Create one win transaction per winning bet
      const winTxOps = summary.winningBets.map((b: BetRow) => {
        const betPayout = Math.floor((b.shares ?? b.amount / 50) * 100);
        return prisma.transaction.create({
          data: {
            userId: summary.userId,
            type: "win",
            amount: betPayout,
            referenceId: b.id,
          },
        });
      });

      await prisma.$transaction([
        prisma.user.update({
          where: { id: summary.userId },
          data: {
            balance: newBalance,
            winStreak: newWinStreak,
            xp: newXp,
            level: newLevel,
            eloRating: newEloRating,
            totalWins: { increment: 1 },
            totalProfit: { increment: netProfit },
          },
        }),
        ...winTxOps,
        prisma.portfolioSnapshot.create({
          data: { userId: summary.userId, totalValue: newBalance },
        }),
        ...missionOps,
      ]);
    } else {
      // ── Loser processing ─────────────────────────────────────────────────
      const isNearMiss = nearMissUserIds.has(summary.userId);
      const nearMissBonus = isNearMiss ? 50 : 0;
      const nearMissXp = isNearMiss ? getXpForAction("near_miss") : 0;
      const newXp = betUser.xp + nearMissXp;
      const newLevel = getLevelFromXp(newXp);
      const newBalance = betUser.balance + nearMissBonus;
      const totalLost = summary.losingBets.reduce((s: number, b: BetRow) => s + b.amount, 0);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: summary.userId },
          data: {
            winStreak: 0,
            xp: newXp,
            level: newLevel,
            balance: newBalance,
            eloRating: newEloRating,
            totalLosses: { increment: 1 },
            totalProfit: { decrement: totalLost },
          },
        }),
        prisma.portfolioSnapshot.create({
          data: { userId: summary.userId, totalValue: newBalance },
        }),
        ...(isNearMiss
          ? [
              prisma.transaction.create({
                data: {
                  userId: summary.userId,
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
  }

  // ─── Notifications for bettors ────────────────────────────────────────────
  const resolvedLabel = market.outcomes.find((o) => o.id === outcomeId)?.label ?? outcomeId;
  const bettorIds = Array.from(userSummaryMap.keys());
  if (bettorIds.length > 0) {
    const settingsList = await prisma.userSettings.findMany({
      where: { userId: { in: bettorIds } },
      select: { userId: true, notifyOnMarketResolution: true, notifyOnBetResult: true },
    });
    const settingsMap = new Map(settingsList.map((s) => [s.userId, s]));

    const notifData: { userId: string; type: string; message: string; marketId: string }[] = [];
    for (const summary of Array.from(userSummaryMap.values())) {
      const prefs = settingsMap.get(summary.userId);
      const wantsBetResult = prefs?.notifyOnBetResult ?? true;
      const wantsResolution = prefs?.notifyOnMarketResolution ?? true;
      if (!wantsBetResult && !wantsResolution) continue;

      if (wantsBetResult) {
        if (summary.won) {
          const payout = summary.winningBets.reduce(
            (s: number, b: BetRow) => s + Math.floor((b.shares ?? b.amount / 50) * 100),
            0,
          );
          notifData.push({
            userId: summary.userId,
            type: "BET_RESULT",
            message: `You WON ${payout.toLocaleString()} coins on "${market.title}"`,
            marketId,
          });
        } else {
          const lost = summary.losingBets.reduce((s: number, b: BetRow) => s + b.amount, 0);
          notifData.push({
            userId: summary.userId,
            type: "BET_RESULT",
            message: `You LOST ${lost.toLocaleString()} coins on "${market.title}"`,
            marketId,
          });
        }
      } else {
        notifData.push({
          userId: summary.userId,
          type: "MARKET_RESOLVED",
          message: `"${market.title}" resolved: ${resolvedLabel}`,
          marketId,
        });
      }
    }
    if (notifData.length > 0) {
      await prisma.notification.createMany({ data: notifData });
    }
  }

  // ─── Global activity entry ────────────────────────────────────────────────
  await prisma.activity.create({
    data: {
      type: "MARKET_RESOLVED",
      marketId,
      marketTitle: market.title,
      side: resolvedLabel,
    },
  });
  const activityToDelete = await prisma.activity.findMany({
    orderBy: { createdAt: "desc" },
    skip: 200,
    select: { id: true },
  });
  if (activityToDelete.length > 0) {
    await prisma.activity.deleteMany({ where: { id: { in: activityToDelete.map((a) => a.id) } } });
  }

  // ─── Creator deposit refund + reward ──────────────────────────────────────
  const creatorTxOps = [];
  if (shouldRefundDeposit) {
    creatorTxOps.push(
      prisma.user.update({
        where: { id: market.createdById },
        data: { balance: { increment: creatorDeposit } },
      }),
      prisma.transaction.create({
        data: {
          userId: market.createdById,
          type: "deposit_refund",
          amount: creatorDeposit,
          referenceId: marketId,
        },
      }),
    );
  }
  if (creatorReward > 0) {
    creatorTxOps.push(
      prisma.user.update({
        where: { id: market.createdById },
        data: { balance: { increment: creatorReward } },
      }),
      prisma.transaction.create({
        data: {
          userId: market.createdById,
          type: "creator_reward",
          amount: creatorReward,
          referenceId: marketId,
        },
      }),
    );
  }

  // Run creator ops sequentially (SQLite single-writer)
  for (const op of creatorTxOps) {
    await op;
  }

  revalidatePath("/");
  revalidatePath("/markets");
  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/portfolio");
  revalidatePath("/leaderboard");
  return { ok: true };
}
