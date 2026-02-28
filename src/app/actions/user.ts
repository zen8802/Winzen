"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getLevelFromXp,
  getTitle,
  getWinMultiplier,
  getDailyMissions,
  xpForLevel,
  xpForPrevLevel,
} from "@/lib/gamification";

export async function getCurrentUserBalance() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true, email: true, name: true },
  });
  return user;
}

export async function getGamificationData() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const today = new Date().toISOString().slice(0, 10);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { loginStreak: true, winStreak: true, xp: true, level: true, battlePassIsPremium: true },
  });
  if (!user) return null;

  const level = getLevelFromXp(user.xp);
  const title = getTitle(level);
  const winMultiplier = getWinMultiplier(user.winStreak);
  const currentLevelXp = xpForPrevLevel(level);
  const nextLevelXp = xpForLevel(level);

  const missionCount = user.battlePassIsPremium ? 4 : 3;
  const dailyTemplates = getDailyMissions(today, missionCount);

  const progressRecords = await prisma.userMissionProgress.findMany({
    where: {
      userId: session.user.id,
      date: today,
      missionKey: { in: dailyTemplates.map((m) => m.key) },
    },
  });

  const progressMap = new Map(progressRecords.map((p) => [p.missionKey, p]));

  const dailyMissions = dailyTemplates.map((template) => {
    const rec = progressMap.get(template.key);
    return {
      ...template,
      progress: rec?.progress ?? 0,
      completed: rec?.completed ?? false,
    };
  });

  return {
    loginStreak: user.loginStreak,
    winStreak: user.winStreak,
    xp: user.xp,
    level,
    title,
    winMultiplier,
    currentLevelXp,
    nextLevelXp,
    dailyMissions,
  };
}
