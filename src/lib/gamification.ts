// ─── Streak Rewards ───────────────────────────────────────────────────────────

export function getStreakReward(streak: number): number {
  if (streak >= 7) return 2000;
  if (streak >= 4) return 1500;
  return 1000; // days 1–3
}

// ─── Win Streak Multiplier ────────────────────────────────────────────────────

export function getWinMultiplier(winStreak: number): number {
  if (winStreak >= 3) return 2.0;
  if (winStreak >= 2) return 1.5;
  if (winStreak >= 1) return 1.2;
  return 1.0;
}

// ─── XP ───────────────────────────────────────────────────────────────────────

export type XpAction =
  | "place_bet"
  | "win_bet"
  | "daily_login"
  | "complete_mission"
  | "create_market"
  | "near_miss";

export function getXpForAction(action: XpAction): number {
  switch (action) {
    case "place_bet":        return 20;
    case "win_bet":          return 50;
    case "daily_login":      return 25;
    case "complete_mission": return 30;
    case "create_market":    return 15;
    case "near_miss":        return 10;
  }
}

// ─── Leveling ─────────────────────────────────────────────────────────────────
// Total XP required to reach level N = N^2 * 100
// Level 2 = 100 XP | Level 5 = 2500 XP | Level 10 = 10000 XP | Level 30 = 90000 XP

export function getLevelFromXp(xp: number): number {
  let level = 1;
  while (level * level * 100 <= xp) level++;
  return level;
}

export function xpForLevel(level: number): number {
  return level * level * 100;
}

export function xpForPrevLevel(level: number): number {
  return (level - 1) * (level - 1) * 100;
}

// ─── Titles ───────────────────────────────────────────────────────────────────

export function getTitle(level: number): string {
  if (level >= 30) return "Grand BetMaster";
  if (level >= 10) return "BetMaster";
  return "BetRookie";
}

// ─── Daily Missions ───────────────────────────────────────────────────────────

export type MissionType = "place_bets" | "win_bets" | "bet_trending" | "create_market";

export interface MissionTemplate {
  key: string;
  type: MissionType;
  target: number;
  reward: number;
  label: string;
}

export const MISSION_TEMPLATES: MissionTemplate[] = [
  { key: "place_2_bets",  type: "place_bets",    target: 2, reward: 500, label: "Place 2 bets" },
  { key: "place_3_bets",  type: "place_bets",    target: 3, reward: 700, label: "Place 3 bets" },
  { key: "place_5_bets",  type: "place_bets",    target: 5, reward: 1000, label: "Place 5 bets" },
  { key: "win_1_bet",     type: "win_bets",       target: 1, reward: 500, label: "Win 1 bet" },
  { key: "win_2_bets",    type: "win_bets",       target: 2, reward: 800, label: "Win 2 bets" },
  { key: "bet_trending",  type: "bet_trending",   target: 1, reward: 300, label: "Bet on a trending market" },
  { key: "create_market", type: "create_market",  target: 1, reward: 400, label: "Create a market" },
];

function seededHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Returns `count` missions for the given date string (YYYY-MM-DD), same for all users. */
export function getDailyMissions(dateStr: string, count = 3): MissionTemplate[] {
  const sorted = [...MISSION_TEMPLATES].sort(
    (a, b) => seededHash(a.key + dateStr) - seededHash(b.key + dateStr)
  );
  return sorted.slice(0, count);
}

/** A market is "trending" if it has enough volume or participants. */
export function isTrendingMarket(totalVolume: number, participantCount: number): boolean {
  return totalVolume >= 500 || participantCount >= 3;
}

/** Near-miss: the losing outcome held ≥35% of the pool. */
export const NEAR_MISS_THRESHOLD = 0.35;
