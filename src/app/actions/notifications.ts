"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type NotificationRow = {
  id: string;
  type: string;
  message: string;
  marketId: string | null;
  isRead: boolean;
  createdAt: string;
};

export type UserSettingsRow = {
  notifyOnMarketResolution: boolean;
  notifyOnBetResult: boolean;
};

export async function getNotifications(): Promise<NotificationRow[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return [];

  const rows = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    message: n.message,
    marketId: n.marketId,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || ids.length === 0) return;

  await prisma.notification.updateMany({
    where: { id: { in: ids }, userId: session.user.id },
    data: { isRead: true },
  });
}

export async function getUserSettings(): Promise<UserSettingsRow> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { notifyOnMarketResolution: true, notifyOnBetResult: true };
  }

  const s = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
  });

  return {
    notifyOnMarketResolution: s?.notifyOnMarketResolution ?? true,
    notifyOnBetResult: s?.notifyOnBetResult ?? true,
  };
}

export async function updateUserSettings(prefs: Partial<UserSettingsRow>): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return;

  await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      notifyOnMarketResolution: prefs.notifyOnMarketResolution ?? true,
      notifyOnBetResult: prefs.notifyOnBetResult ?? true,
    },
    update: prefs,
  });
}
