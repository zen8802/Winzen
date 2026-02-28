// ─── Season constants ──────────────────────────────────────────────────────────

/** XP needed to advance one tier */
export const BP_XP_PER_TIER = 300;
/** Season length */
export const BP_TOTAL_TIERS = 30;
/** Absolute cap: completing all tiers */
export const BP_MAX_XP = BP_TOTAL_TIERS * BP_XP_PER_TIER;

// ─── XP sources ────────────────────────────────────────────────────────────────

/** Awarded when a single daily quest is completed */
export const BP_QUEST_XP = 50;
/** Bonus awarded when ALL daily quests are completed on the same day */
export const BP_DAILY_ALL_QUESTS_BONUS = 150;
/** Awarded for the first bet placed in a UTC day */
export const BP_FIRST_BET_XP = 25;
/** Awarded for the first comment posted in a UTC day */
export const BP_FIRST_COMMENT_XP = 10;

// ─── Tier computation ──────────────────────────────────────────────────────────

/** 1-indexed tier from XP, capped at totalTiers. */
export function getTierFromXp(
  xp: number,
  xpPerTier = BP_XP_PER_TIER,
  totalTiers = BP_TOTAL_TIERS,
): number {
  return Math.min(Math.floor(xp / xpPerTier) + 1, totalTiers);
}

/** XP already earned within the current tier (0 … xpPerTier-1). */
export function getXpProgressInTier(xp: number, xpPerTier = BP_XP_PER_TIER): number {
  return xp % xpPerTier;
}

// ─── Milestone helpers ─────────────────────────────────────────────────────────

export function isHalfway(tier: number, totalTiers = BP_TOTAL_TIERS): boolean {
  return tier >= Math.ceil(totalTiers / 2);
}
export function isSeasonComplete(tier: number, totalTiers = BP_TOTAL_TIERS): boolean {
  return tier >= totalTiers;
}

// ─── XP boost multiplier ───────────────────────────────────────────────────────

/**
 * Returns the multiplier applied to incoming BP XP gains.
 * Free:    +5 % at halfway, +12 % at completion.
 * Premium: +10 % at halfway, +25 % at completion.
 */
export function getBpXpMultiplier(
  tier: number,
  isPremium: boolean,
  totalTiers = BP_TOTAL_TIERS,
): number {
  if (isSeasonComplete(tier, totalTiers)) return isPremium ? 1.25 : 1.12;
  if (isHalfway(tier, totalTiers))        return isPremium ? 1.10 : 1.05;
  return 1.0;
}

/**
 * Applies the XP boost to a base amount, caps at season max, and returns the
 * actual delta to add to the user's battlePassXp.
 */
export function applyBpXp(
  baseXp: number,
  currentXp: number,
  tier: number,
  isPremium: boolean,
  totalTiers = BP_TOTAL_TIERS,
  xpPerTier = BP_XP_PER_TIER,
): number {
  const mult   = getBpXpMultiplier(tier, isPremium, totalTiers);
  const gained = Math.round(baseXp * mult);
  const cap    = totalTiers * xpPerTier;
  const newXp  = Math.min(currentXp + gained, cap);
  return newXp - currentXp; // may be 0 if already capped
}

// ─── Market creation limit ─────────────────────────────────────────────────────

/** Daily cap for non-battle-pass users */
export const DAILY_MARKET_LIMIT_BASE = 5;
/** Daily cap for any battle-pass participant (either track) */
export const DAILY_MARKET_LIMIT_BP = 6;

/** Returns the market creation limit for a user. */
export function getDailyMarketLimit(hasBattlePass: boolean): number {
  return hasBattlePass ? DAILY_MARKET_LIMIT_BP : DAILY_MARKET_LIMIT_BASE;
}

// ─── Premium styling ───────────────────────────────────────────────────────────

/** Violet-400 — the end of the Winzen logo gradient. */
export const PREMIUM_PURPLE = "#a78bfa";
