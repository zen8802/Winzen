import { PrismaClient } from "@prisma/client";
import {
  getStreakReward,
  getWinMultiplier,
  getXpForAction,
  getLevelFromXp,
} from "./gamification";

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function isYesterday(date: Date, today: Date): boolean {
  const d = new Date(today);
  d.setDate(d.getDate() - 1);
  return toDateStr(date) === toDateStr(d);
}

export interface StreakLoginResult {
  newStreak: number;
  reward: number;
}

/**
 * Call this on every credential-based login.
 * - If user already logged in today, returns reward=0.
 * - If user logged in yesterday, increments streak.
 * - Otherwise resets streak to 1.
 * Applies win multiplier to the coin reward and awards XP.
 */
export async function applyStreakLogin(
  userId: string,
  prisma: PrismaClient
): Promise<StreakLoginResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      loginStreak: true,
      lastLoginDate: true,
      winStreak: true,
      xp: true,
      level: true,
      balance: true,
    },
  });
  if (!user) return { newStreak: 0, reward: 0 };

  const today = new Date();
  const todayStr = toDateStr(today);

  // Already logged in today — no reward
  if (user.lastLoginDate && toDateStr(user.lastLoginDate) === todayStr) {
    return { newStreak: user.loginStreak, reward: 0 };
  }

  // Determine new streak
  let newStreak: number;
  if (user.lastLoginDate && isYesterday(user.lastLoginDate, today)) {
    newStreak = user.loginStreak + 1;
  } else {
    newStreak = 1;
  }

  const baseReward = getStreakReward(newStreak);
  const multiplier = getWinMultiplier(user.winStreak);
  const reward = Math.floor(baseReward * multiplier);

  const newXp = user.xp + getXpForAction("daily_login");
  const newLevel = getLevelFromXp(newXp);
  const newBalance = user.balance + reward;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        loginStreak: newStreak,
        lastLoginDate: today,
        xp: newXp,
        level: newLevel,
        balance: newBalance,
      },
    }),
    ...(reward > 0
      ? [
          prisma.transaction.create({
            data: {
              userId,
              type: "streak_bonus",
              amount: reward,
              balanceAfter: newBalance,
            },
          }),
        ]
      : []),
  ]);

  return { newStreak, reward };
}
