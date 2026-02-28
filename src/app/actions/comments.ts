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
  avatarEquipped?: AvatarEquipped;
  isPremium?:      boolean;
};

export async function getComments(marketId: string): Promise<CommentRow[]> {
  const rows = await prisma.comment.findMany({
    where: { marketId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, userId: true, username: true, content: true, createdAt: true },
  });

  const uniqueUserIds = Array.from(new Set(rows.map((r) => r.userId)));
  const [avatarMap, premiumUsers] = await Promise.all([
    getBatchAvatarData(uniqueUserIds),
    prisma.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: { id: true, battlePassIsPremium: true },
    }),
  ]);
  const premiumMap = new Map(premiumUsers.map((u) => [u.id, u.battlePassIsPremium]));

  return rows.map((r) => {
    const av = avatarMap.get(r.userId);
    return {
      id:              r.id,
      userId:          r.userId,
      username:        r.username,
      content:         r.content,
      createdAt:       r.createdAt.toISOString(),
      avatarEquipped:  av?.equipped,
      isPremium:       premiumMap.get(r.userId) ?? false,
    };
  });
}

export async function postComment(
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Sign in to comment" };

  const marketId = (formData.get("marketId") as string | null)?.trim();
  const content = (formData.get("content") as string | null)?.trim() ?? "";

  if (!marketId) return { error: "Missing market" };
  if (!content) return { error: "Comment cannot be empty" };
  if (content.length > 300) return { error: "Max 300 characters" };

  // Verify market exists
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { id: true },
  });
  if (!market) return { error: "Market not found" };

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const firstCommentToday = await prisma.comment.findFirst({
    where: { userId: session.user.id, createdAt: { gte: todayStart } },
    select: { id: true },
  });

  await prisma.comment.create({
    data: {
      marketId,
      userId: session.user.id,
      // Prefer display name; fall back to email prefix
      username: session.user.name ?? session.user.email?.split("@")[0] ?? "Anonymous",
      content,
    },
  });

  // Battle Pass XP: first comment of the day (fire-and-forget)
  if (!firstCommentToday) {
    void awardBattlePassXp(session.user.id, BP_FIRST_COMMENT_XP);
  }

  return {};
}
