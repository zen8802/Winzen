"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBatchAvatarData } from "@/app/actions/agent";
import type { AvatarEquipped } from "@/lib/avatar";
import { awardBattlePassXp } from "@/app/actions/battle-pass";
import { BP_FIRST_COMMENT_XP } from "@/lib/battle-pass";

export type CommentRow = {
  id:              string;
  userId:          string;
  username:        string;
  content:         string;
  createdAt:       string; // ISO string
  parentId?:       string | null;
  avatarEquipped?: AvatarEquipped;
  isPremium?:      boolean;
  replies?:        CommentRow[];
};

export async function getComments(marketId: string): Promise<CommentRow[]> {
  // Fetch top-level comments only (parentId = null)
  const topLevel = await prisma.comment.findMany({
    where: { marketId, parentId: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, userId: true, username: true, content: true, createdAt: true },
  });

  // Fetch all replies for those comments
  const topLevelIds = topLevel.map((r) => r.id);
  const replies = topLevelIds.length > 0
    ? await prisma.comment.findMany({
        where: { parentId: { in: topLevelIds } },
        orderBy: { createdAt: "asc" },
        select: { id: true, userId: true, username: true, content: true, createdAt: true, parentId: true },
      })
    : [];

  // Collect all unique user IDs across both levels
  const allUserIds = Array.from(new Set([
    ...topLevel.map((r) => r.userId),
    ...replies.map((r) => r.userId),
  ]));

  const [avatarMap, premiumUsers] = await Promise.all([
    getBatchAvatarData(allUserIds),
    prisma.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, battlePassIsPremium: true },
    }),
  ]);
  const premiumMap = new Map(premiumUsers.map((u) => [u.id, u.battlePassIsPremium]));

  function toRow(r: {
    id: string; userId: string; username: string;
    content: string; createdAt: Date; parentId?: string | null;
  }): CommentRow {
    const av = avatarMap.get(r.userId);
    return {
      id:             r.id,
      userId:         r.userId,
      username:       r.username,
      content:        r.content,
      createdAt:      r.createdAt.toISOString(),
      parentId:       r.parentId ?? null,
      avatarEquipped: av?.equipped,
      isPremium:      premiumMap.get(r.userId) ?? false,
    };
  }

  // Group replies by parentId
  const repliesByParent = new Map<string, typeof replies>();
  for (const r of replies) {
    if (!r.parentId) continue;
    const arr = repliesByParent.get(r.parentId) ?? [];
    arr.push(r);
    repliesByParent.set(r.parentId, arr);
  }

  return topLevel.map((row) => ({
    ...toRow(row),
    replies: (repliesByParent.get(row.id) ?? []).map(toRow),
  }));
}

export async function postComment(
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Sign in to comment" };

  const marketId = (formData.get("marketId") as string | null)?.trim();
  const content  = (formData.get("content")  as string | null)?.trim() ?? "";
  const parentId = (formData.get("parentId") as string | null)?.trim() || null;

  if (!marketId) return { error: "Missing market" };
  if (!content)  return { error: "Comment cannot be empty" };
  if (content.length > 300) return { error: "Max 300 characters" };

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { id: true },
  });
  if (!market) return { error: "Market not found" };

  // Validate parent (if replying)
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { marketId: true, parentId: true },
    });
    if (!parent || parent.marketId !== marketId) return { error: "Invalid parent comment" };
    if (parent.parentId) return { error: "Cannot reply to a reply" };
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const firstCommentToday = await prisma.comment.findFirst({
    where: { userId: session.user.id, createdAt: { gte: todayStart } },
    select: { id: true },
  });

  await prisma.comment.create({
    data: {
      marketId,
      userId:   session.user.id,
      username: session.user.name ?? session.user.email?.split("@")[0] ?? "Anonymous",
      content,
      ...(parentId ? { parentId } : {}),
    },
  });

  if (!firstCommentToday) {
    void awardBattlePassXp(session.user.id, BP_FIRST_COMMENT_XP);
  }

  return {};
}
