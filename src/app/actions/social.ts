"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBatchAvatarData } from "@/app/actions/agent";
import type { AvatarEquipped } from "@/lib/avatar";

export type FollowedTrade = {
  userId:           string;
  username:         string;
  outcomeId:        string;
  entryProbability: number;  // 1–99
  entryTimestamp:   string;  // ISO
  amount:           number;
  equipped:         AvatarEquipped;
};

/** Follow a user. No-op if already following. */
export async function followUser(followingId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return;
  const followerId = session.user.id;
  if (followerId === followingId) return;
  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId, followingId } },
    update: {},
    create: { followerId, followingId },
  });
}

/** Unfollow a user. No-op if not following. */
export async function unfollowUser(followingId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return;
  const followerId = session.user.id;
  await prisma.follow.deleteMany({ where: { followerId, followingId } });
}

/** Returns true if the current session user follows the given user. */
export async function getFollowStatus(followingId: string): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;
  const row = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: session.user.id, followingId } },
  });
  return !!row;
}

/** Returns follower and following counts for a given user. */
export async function getFollowCounts(
  userId: string,
): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.follow.count({ where: { followerId: userId } }),
  ]);
  return { followers, following };
}

/** Returns the list of users the current session user follows, with avatar data. */
export async function getFollowingUsers(): Promise<
  { id: string; name: string; eloRating: number; equipped: AvatarEquipped }[]
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return [];

  const follows = await prisma.follow.findMany({
    where: { followerId: session.user.id },
    select: { followingId: true },
    orderBy: { createdAt: "desc" },
  });

  if (follows.length === 0) return [];

  const ids = follows.map((f) => f.followingId);

  const [users, avatarMap] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, eloRating: true },
    }),
    getBatchAvatarData(ids),
  ]);

  return ids.flatMap((id) => {
    const user = users.find((u) => u.id === id);
    if (!user) return [];
    return [{ ...user, equipped: avatarMap.get(id)?.equipped ?? {} }];
  });
}

/**
 * Returns trade entries (open bets) made by followed users on a specific market.
 * Only returns entries for users who have allowTradeVisibility = true.
 */
export async function getFollowedTradesOnMarket(
  marketId: string,
): Promise<FollowedTrade[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return [];

  // Get followed user IDs
  const follows = await prisma.follow.findMany({
    where: { followerId: session.user.id },
    select: { followingId: true },
  });
  if (follows.length === 0) return [];

  const followedIds = follows.map((f) => f.followingId);

  // Filter to those with trade visibility enabled
  const visibleUsers = await prisma.user.findMany({
    where: { id: { in: followedIds }, allowTradeVisibility: true },
    select: { id: true, name: true },
  });
  if (visibleUsers.length === 0) return [];

  const visibleIds = visibleUsers.map((u) => u.id);

  // Fetch their open bets on this market
  const bets = await prisma.bet.findMany({
    where: {
      marketId,
      userId: { in: visibleIds },
      closedAt: null,
      entryProbability: { not: null },
    },
    select: {
      userId: true,
      outcomeId: true,
      entryProbability: true,
      amount: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (bets.length === 0) return [];

  // Batch avatar data
  const uniqueBetUserIds = Array.from(new Set(bets.map((b) => b.userId)));
  const avatarMap = await getBatchAvatarData(uniqueBetUserIds);

  const nameMap = new Map(visibleUsers.map((u) => [u.id, u.name]));

  return bets.map((b) => ({
    userId:           b.userId,
    username:         nameMap.get(b.userId) ?? "Unknown",
    outcomeId:        b.outcomeId,
    entryProbability: b.entryProbability!,
    entryTimestamp:   b.createdAt.toISOString(),
    amount:           b.amount,
    equipped:         avatarMap.get(b.userId)?.equipped ?? {},
  }));
}
