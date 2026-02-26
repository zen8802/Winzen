/**
 * scripts/seedBots.ts
 * Creates simulation bot users. Safe to re-run — skips existing bots.
 *
 * Usage:
 *   npm run simulate:seed
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient({ log: [] });

// ─── Config ───────────────────────────────────────────────────────────────────

const BOT_COUNT = 100;

// Strategy bands (bots 1–20 = random, 21–40 = trend_follower, …)
const STRATEGIES = [
  "random",
  "trend_follower",
  "contrarian",
  "whale",
  "conservative",
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomBalance(): number {
  return Math.floor(Math.random() * (20_000 - 5_000 + 1)) + 5_000;
}

function strategyForIndex(i: number): string {
  return STRATEGIES[Math.floor(((i - 1) / BOT_COUNT) * STRATEGIES.length)];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Winzen Bot Seeder ===\n");

  // Bots can't sign in — placeholder hash is intentionally invalid for login
  const pw = await hash("__BOT_ACCOUNT_NOT_FOR_LOGIN__", 10);

  let created = 0;
  let skipped = 0;

  for (let i = 1; i <= BOT_COUNT; i++) {
    const name  = `bot_${String(i).padStart(3, "0")}`;
    const email = `${name}@simulation.internal`;

    const exists = await prisma.user.findFirst({ where: { name } });
    if (exists) {
      skipped++;
      continue;
    }

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
    if (i % 10 === 0) {
      console.log(`  [${i}/${BOT_COUNT}] Created ${name} (${strategyForIndex(i)})`);
    }
  }

  console.log(`\nDone.`);
  console.log(`  Created : ${created}`);
  console.log(`  Skipped : ${skipped} (already exist)\n`);
  console.log("Strategy bands:");
  STRATEGIES.forEach((s, idx) => {
    const from = Math.floor((idx     / STRATEGIES.length) * BOT_COUNT) + 1;
    const to   = Math.floor(((idx+1) / STRATEGIES.length) * BOT_COUNT);
    console.log(
      `  ${s.padEnd(16)} → bot_${String(from).padStart(3,"0")}` +
      ` – bot_${String(to).padStart(3,"0")}`,
    );
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
