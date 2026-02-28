"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBatchAvatarData } from "@/app/actions/agent";
import type { AvatarEquipped } from "@/lib/avatar";

export type CommentRow = {
  id:              string;
  userId:          string;
  username:        string;
  content:         string;
  createdAt:       string; // ISO string
  avatarEquipped?: AvatarEquipped;
};

export async function getComments(marketId: string): Promise<CommentRow[]> {
  const rows = await prisma.comment.findMany({
    where: { marketId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, userId: true, username: true, content: true, createdAt: true },
  });

  const uniqueUserIds = Array.from(new Set(rows.map((r) => r.userId)));
  const avatarMap = await getBatchAvatarData(uniqueUserIds);

  return rows.map((r) => {
    const av = avatarMap.get(r.userId);
    return {
      id:              r.id,
      userId:          r.userId,
      username:        r.username,
      content:         r.content,
      createdAt:       r.createdAt.toISOString(),
      avatarEquipped:  av?.equipped,
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

  await prisma.comment.create({
    data: {
      marketId,
      userId: session.user.id,
      // Prefer display name; fall back to email prefix
      username: session.user.name ?? session.user.email?.split("@")[0] ?? "Anonymous",
      content,
    },
  });

  return {};
}
