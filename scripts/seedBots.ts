/**
 * scripts/seedBots.ts
 * Creates simulation bot users with human-like usernames. Safe to re-run.
 *
 * Strategy is stored in the email address (never shown to users) so
 * runSimulation.ts can derive it without an extra DB column:
 *   email = bot_${strategy}_${index}@simulation.internal
 *   name  = <human-readable, e.g. "SilentTiger42">
 *
 * Usage:
 *   npm run simulate:seed
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { BOT_STRATEGIES, generateBotUsername } from "./generateBotUsername";

const prisma = new PrismaClient({ log: [] });

// ─── Config ───────────────────────────────────────────────────────────────────

const BOT_COUNT = 100;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomBalance(): number {
  return Math.floor(Math.random() * (20_000 - 5_000 + 1)) + 5_000;
}

function strategyForIndex(i: number): string {
  return BOT_STRATEGIES[Math.floor(((i - 1) / BOT_COUNT) * BOT_STRATEGIES.length)];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Winzen Bot Seeder ===\n");

  // Pre-load every existing username so generateBotUsername avoids collisions
  const existing = await prisma.user.findMany({ select: { name: true, email: true } });
  const usedNames  = new Set(existing.map(u => u.name));
  const usedEmails = new Set(existing.map(u => u.email));

  // Count already-seeded bots by email pattern to skip gracefully
  const existingBotEmails = new Set(
    existing
      .filter(u => u.email.endsWith("@simulation.internal"))
      .map(u => u.email),
  );

  // Bots can't sign in — placeholder hash is intentionally not a valid credential
  const pw = await hash("__BOT_ACCOUNT_NOT_FOR_LOGIN__", 10);

  let created = 0;
  let skipped = 0;

  for (let i = 1; i <= BOT_COUNT; i++) {
    const strategy = strategyForIndex(i);
    const email    = `bot_${strategy}_${String(i).padStart(3, "0")}@simulation.internal`;

    // Skip if this exact bot slot already exists
    if (existingBotEmails.has(email) || usedEmails.has(email)) {
      skipped++;
      continue;
    }

    const name = generateBotUsername(usedNames);

    await prisma.user.create({
      data: {
        name,
        email,
        password: pw,
        balance: randomBalance(),
        isBot: true,
      },
    });

    created++;
    if (i % 10 === 0 || i === BOT_COUNT) {
      console.log(`  [${i}/${BOT_COUNT}] ${name} (${strategy})`);
    }
  }

  console.log(`\nDone.`);
  console.log(`  Created : ${created}`);
  console.log(`  Skipped : ${skipped} (already exist)\n`);
  console.log("Strategy bands:");
  BOT_STRATEGIES.forEach((s, idx) => {
    const from = Math.floor((idx     / BOT_STRATEGIES.length) * BOT_COUNT) + 1;
    const to   = Math.floor(((idx+1) / BOT_STRATEGIES.length) * BOT_COUNT);
    console.log(`  ${s.padEnd(16)} → bots ${from}–${to}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
