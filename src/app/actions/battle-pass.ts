"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getTierFromXp,
  getXpProgressInTier,
  applyBpXp,
  BP_XP_PER_TIER,
  BP_TOTAL_TIERS,
  BP_QUEST_XP,
  BP_DAILY_ALL_QUESTS_BONUS,
} from "@/lib/battle-pass";
import { getDailyMissions } from "@/lib/gamification";

// ─── Status ───────────────────────────────────────────────────────────────────

export type BpRewardRow = {
  id:         string;
  tier:       number;
  track:      string;
  rewardType: string;
  amount:     number | null;
  itemSlot:   string | null;
  label:      string | null;
  claimed:    boolean;
  eligible:   boolean;
};

export type BpStatus = {
  season: {
    id:         string;
    name:       string;
    startsAt:   string;
    endsAt:     string;
    totalTiers: number;
    xpPerTier:  number;
  };
  user: {
    xp:        number;
    tier:      number;
    xpInTier:  number;
    xpPerTier: number;
    isPremium: boolean;
  };
  rewards: BpRewardRow[];
};

export async function getBattlePassStatus(): Promise<BpStatus | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const [season, user, claims] = await Promise.all([
    prisma.battlePassSeason.findFirst({
      where: { isActive: true },
      include: { rewards: { orderBy: [{ tier: "asc" }, { track: "asc" }] } },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { battlePassXp: true, battlePassIsPremium: true, battlePassSeasonId: true },
    }),
    prisma.claimedReward.findMany({
      where: { userId: session.user.id },
      select: { rewardId: true },
    }),
  ]);

  if (!season || !user) return null;

  const xp        = user.battlePassXp;
  const tier      = getTierFromXp(xp, season.xpPerTier, season.totalTiers);
  const xpInTier  = getXpProgressInTier(xp, season.xpPerTier);
  const claimedSet = new Set(claims.map((c) => c.rewardId));

  return {
    season: {
      id:         season.id,
      name:       season.name,
      startsAt:   season.startsAt.toISOString(),
      endsAt:     season.endsAt.toISOString(),
      totalTiers: season.totalTiers,
      xpPerTier:  season.xpPerTier,
    },
    user: {
      xp,
      tier,
      xpInTier,
      xpPerTier:  season.xpPerTier,
      isPremium:  user.battlePassIsPremium,
    },
    rewards: season.rewards.map((r) => ({
      id:         r.id,
      tier:       r.tier,
      track:      r.track,
      rewardType: r.rewardType,
      amount:     r.amount,
      itemSlot:   r.itemSlot,
      label:      r.label,
      claimed:    claimedSet.has(r.id),
      eligible:   tier >= r.tier,
    })),
  };
}

// ─── Claim reward ─────────────────────────────────────────────────────────────

export async function claimBpReward(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not signed in" };

  const rewardId = (formData.get("rewardId") as string | null)?.trim();
  if (!rewardId) return { error: "Missing rewardId" };

  const [user, reward] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { battlePassXp: true, battlePassIsPremium: true, balance: true },
    }),
    prisma.battlePassReward.findUnique({
      where: { id: rewardId },
      include: {
        season: { select: { id: true, totalTiers: true, xpPerTier: true, isActive: true } },
      },
    }),
  ]);

  if (!user || !reward) return { error: "Not found" };
  if (!reward.season.isActive) return { error: "Season is not active" };
  if (reward.track === "PREMIUM" && !user.battlePassIsPremium) {
    return { error: "Premium pass required" };
  }
  if (reward.rewardType === "CHOICE_COSMETIC") {
    return { error: "Use claimChoiceCosmetic for this reward" };
  }

  const tier = getTierFromXp(user.battlePassXp, reward.season.xpPerTier, reward.season.totalTiers);
  if (tier < reward.tier) return { error: "Tier not yet reached" };

  const existing = await prisma.claimedReward.findUnique({
    where: { userId_rewardId: { userId: session.user.id, rewardId } },
  });
  if (existing) return { error: "Already claimed" };

  await prisma.$transaction(async (tx) => {
    await tx.claimedReward.create({
      data: { userId: session.user.id, seasonId: reward.season.id, rewardId },
    });
    if (reward.rewardType === "COINS" && reward.amount) {
      await tx.user.update({
        where: { id: session.user.id },
        data: { balance: { increment: reward.amount } },
      });
      await tx.transaction.create({
        data: {
          userId:      session.user.id,
          type:        "battle_pass_reward",
          amount:      reward.amount,
          referenceId: rewardId,
        },
      });
    }
  });

  return { ok: true };
}

// ─── Claim choice cosmetic ────────────────────────────────────────────────────

export async function claimChoiceCosmetic(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not signed in" };

  const rewardId = (formData.get("rewardId") as string | null)?.trim();
  const itemId   = (formData.get("itemId")   as string | null)?.trim();
  if (!rewardId || !itemId) return { error: "Missing fields" };

  const [user, reward, item] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { battlePassXp: true, battlePassIsPremium: true },
    }),
    prisma.battlePassReward.findUnique({
      where: { id: rewardId },
      include: {
        season: { select: { id: true, totalTiers: true, xpPerTier: true, isActive: true } },
      },
    }),
    prisma.agentItem.findUnique({
      where: { id: itemId },
      select: { id: true, category: true },
    }),
  ]);

  if (!user || !reward || !item) return { error: "Not found" };
  if (!reward.season.isActive)   return { error: "Season not active" };
  if (!user.battlePassIsPremium) return { error: "Premium pass required" };
  if (reward.rewardType !== "CHOICE_COSMETIC") return { error: "Wrong reward type" };

  // Map BP itemSlot → AgentItem category
  const slotCategoryMap: Record<string, string> = {
    hat:    "hat",
    top:    "top",
    bottom: "bottom",
    shoes:  "shoes",
  };
  const expectedCategory = reward.itemSlot ? slotCategoryMap[reward.itemSlot] : null;
  if (expectedCategory && item.category !== expectedCategory) {
    return { error: "Item slot mismatch" };
  }

  const tier = getTierFromXp(user.battlePassXp, reward.season.xpPerTier, reward.season.totalTiers);
  if (tier < reward.tier) return { error: "Tier not yet reached" };

  const existing = await prisma.claimedReward.findUnique({
    where: { userId_rewardId: { userId: session.user.id, rewardId } },
  });
  if (existing) return { error: "Already claimed" };

  await prisma.$transaction(async (tx) => {
    await tx.claimedReward.create({
      data: {
        userId:       session.user.id,
        seasonId:     reward.season.id,
        rewardId,
        choiceItemId: itemId,
      },
    });
    // Grant item to inventory (AgentPurchase, price 0)
    await tx.agentPurchase.upsert({
      where:  { userId_agentItemId: { userId: session.user.id, agentItemId: itemId } },
      create: { userId: session.user.id, agentItemId: itemId },
      update: {},
    });
  });

  return { ok: true };
}

// ─── Toggle premium (dev / admin) ────────────────────────────────────────────

export async function togglePremium(): Promise<{ error?: string; isPremium?: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not signed in" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, battlePassIsPremium: true },
  });
  if (!user) return { error: "User not found" };

  const isAllowed =
    user.role === "admin" || process.env.NODE_ENV === "development";
  if (!isAllowed) return { error: "Admin only" };

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data:  { battlePassIsPremium: !user.battlePassIsPremium },
    select: { battlePassIsPremium: true },
  });
  return { isPremium: updated.battlePassIsPremium };
}

// ─── Award BP XP (internal — called from bets/markets/comments) ───────────────

/**
 * Awards battle-pass XP to a user, applying tier-based boost and season cap.
 * Fire-and-forget: does NOT need to be awaited by callers.
 */
export async function awardBattlePassXp(userId: string, baseXp: number): Promise<void> {
  const season = await prisma.battlePassSeason.findFirst({
    where: { isActive: true },
    select: { id: true, totalTiers: true, xpPerTier: true },
  });
  if (!season) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { battlePassXp: true, battlePassIsPremium: true },
  });
  if (!user) return;

  const tier  = getTierFromXp(user.battlePassXp, season.xpPerTier, season.totalTiers);
  const delta = applyBpXp(
    baseXp,
    user.battlePassXp,
    tier,
    user.battlePassIsPremium,
    season.totalTiers,
    season.xpPerTier,
  );
  if (delta <= 0) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      battlePassXp:       { increment: delta },
      battlePassSeasonId: season.id,
    },
  });
}

// ─── Award BP XP for quest completion (internal) ──────────────────────────────

/**
 * Awards BP_QUEST_XP for a completed mission, plus BP_DAILY_ALL_QUESTS_BONUS
 * if all quests for today are now complete.
 * Fire-and-forget.
 */
export async function awardBpQuestXp(userId: string, dateStr: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { battlePassIsPremium: true },
  });
  if (!user) return;

  const missionCount = user.battlePassIsPremium ? 4 : 3;
  const todayMissions = getDailyMissions(dateStr, missionCount);
  const missionKeys = todayMissions.map((m) => m.key);

  const completedRecords = await prisma.userMissionProgress.findMany({
    where: { userId, date: dateStr, missionKey: { in: missionKeys }, completed: true },
    select: { missionKey: true },
  });

  const completedCount = completedRecords.length;
  const allDone = completedCount >= missionCount;

  // Award base quest XP + bonus if all done
  const totalXp = BP_QUEST_XP + (allDone ? BP_DAILY_ALL_QUESTS_BONUS : 0);
  await awardBattlePassXp(userId, totalXp);
}

// ─── Get items for choice cosmetic picker ────────────────────────────────────

export async function getBpShopItems(slot: string) {
  const slotCategoryMap: Record<string, string> = {
    hat:    "hat",
    top:    "top",
    bottom: "bottom",
    shoes:  "shoes",
  };
  const category = slotCategoryMap[slot];
  if (!category) return [];

  return prisma.agentItem.findMany({
    where:   { category },
    orderBy: { order: "asc" },
    select:  { id: true, name: true, icon: true, category: true },
  });
}
