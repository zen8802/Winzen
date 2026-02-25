"use server";

import { prisma } from "@/lib/prisma";

export async function getRecentActivity() {
  return prisma.activity.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      type: true,
      username: true,
      marketId: true,
      marketTitle: true,
      side: true,
      amount: true,
      price: true,
      createdAt: true,
    },
  });
}

export type ActivityItem = Awaited<ReturnType<typeof getRecentActivity>>[0];
