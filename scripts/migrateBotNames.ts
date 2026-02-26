/**
 * scripts/migrateBotNames.ts
 * One-time migration: rename existing "bot_001" style bots to human-readable
 * usernames and update their emails to encode strategy.
 *
 * Safe to re-run — skips bots that already have the new format.
 *
 * Usage:
 *   npm run simulate:migrate
 */

import { PrismaClient } from "@prisma/client";
import { BOT_STRATEGIES, generateBotUsername } from "./generateBotUsername";

const prisma = new PrismaClient({ log: [] });

const BOT_COUNT = 100;

// Reproduce the same strategy-band logic as seedBots.ts
function strategyForOldIndex(i: number): string {
  return BOT_STRATEGIES[
    Math.floor(((i - 1) / BOT_COUNT) * BOT_STRATEGIES.length)
  ];
}

async function main() {
  console.log("=== Winzen Bot Name Migration ===\n");

  // All bots in DB
  const allBots = await prisma.user.findMany({
    where:  { isBot: true },
    select: { id: true, name: true, email: true },
  });

  // Old-format bots: name matches "bot_001" … "bot_999"
  const oldFormatBots = allBots.filter(b => /^bot_\d+$/.test(b.name));

  if (oldFormatBots.length === 0) {
    console.log("No old-format bots found — nothing to migrate.");
    return;
  }

  console.log(`Found ${oldFormatBots.length} bots to migrate.\n`);

  // Pre-load ALL user names to avoid collisions with real users too
  const allUsers = await prisma.user.findMany({ select: { name: true } });
  const usedNames = new Set(allUsers.map(u => u.name));

  let updated = 0;
  let failed  = 0;

  for (const bot of oldFormatBots) {
    // Extract old index from name like "bot_001" → 1
    const oldIndex = parseInt(bot.name.replace("bot_", ""), 10);
    if (isNaN(oldIndex)) {
      console.warn(`  ⚠ Skipping "${bot.name}" — unexpected format`);
      failed++;
      continue;
    }

    const strategy = strategyForOldIndex(oldIndex);
    const newEmail = `bot_${strategy}_${String(oldIndex).padStart(3, "0")}@simulation.internal`;

    let newName: string;
    try {
      newName = generateBotUsername(usedNames);
    } catch (err) {
      console.error(`  ✗ Could not generate name for ${bot.name}:`, err);
      failed++;
      continue;
    }

    await prisma.user.update({
      where: { id: bot.id },
      data:  { name: newName, email: newEmail },
    });

    console.log(`  ${bot.name.padEnd(10)} → ${newName.padEnd(22)} (${strategy})`);
    updated++;
  }

  console.log(`\nMigration complete.`);
  console.log(`  Updated : ${updated}`);
  if (failed > 0) console.log(`  Failed  : ${failed}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
