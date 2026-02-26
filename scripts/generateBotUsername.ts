/**
 * scripts/generateBotUsername.ts
 * Shared utility for generating human-like bot usernames and strategy types.
 * Imported by seedBots.ts, migrateBotNames.ts, and runSimulation.ts.
 */

// ─── Strategy definitions ─────────────────────────────────────────────────────

export const BOT_STRATEGIES = [
  "random",
  "trend_follower",
  "contrarian",
  "whale",
  "conservative",
] as const;

export type BotStrategy = (typeof BOT_STRATEGIES)[number];

// ─── Word lists ───────────────────────────────────────────────────────────────

const ADJECTIVES = [
  "Silent",  "Neon",    "Crimson", "Rapid",   "Lucky",   "Shadow",  "Golden",
  "Cosmic",  "Blazing", "Iron",    "Swift",   "Dark",    "Electric","Frozen",
  "Wild",    "Lunar",   "Solar",   "Atomic",  "Mystic",  "Stellar", "Turbo",
  "Chrome",  "Onyx",    "Phantom", "Hyper",   "Savage",  "Noble",   "Hollow",
  "Ancient", "Velvet",  "Jade",    "Obsidian","Ember",   "Primal",  "Digital",
];

const NOUNS = [
  "Tiger",  "Falcon", "Orbit",  "Vortex", "Hawk",   "Wolf",   "Nova",
  "Phoenix","Storm",  "Raven",  "Comet",  "Blade",  "Echo",   "Pulse",
  "Ridge",  "Surge",  "Drift",  "Blaze",  "Frost",  "Dusk",   "Panda",
  "Cobra",  "Lynx",   "Crest",  "Flare",  "Shift",  "Vault",  "Spark",
  "Cipher", "Matrix", "Zenith", "Apex",   "Nexus",  "Vector", "Circuit",
];

// ─── Generator ────────────────────────────────────────────────────────────────

/**
 * Generate a unique human-like username (e.g. "SilentTiger", "NeonFalcon42").
 *
 * @param usedNames  Set of names already taken (pre-load from DB). Mutated in place.
 */
export function generateBotUsername(usedNames: Set<string>): string {
  for (let attempt = 0; attempt < 2_000; attempt++) {
    const adj  = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];

    // Add a two-digit numeric suffix ~40% of the time;
    // always after the first collision to help break ties.
    const addNum = attempt > 0 || Math.random() < 0.4;
    const num    = addNum ? String(Math.floor(Math.random() * 90) + 10) : "";
    const name   = `${adj}${noun}${num}`;

    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }

  throw new Error("generateBotUsername: exhausted 2,000 attempts — expand word lists.");
}
