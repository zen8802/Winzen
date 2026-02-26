/**
 * scripts/cleanupSimulation.ts
 * Safely removes ALL simulation data (bot users, bot bets) and
 * recalculates market stats from the remaining real bets.
 *
 * Usage:
 *   npm run cleanup:bots          ← prompts for confirmation
 *   npm run cleanup:bots -- --yes ← skip prompt (CI / scripted)
 */

import { PrismaClient } from "@prisma/client";
import * as readline from "readline";

const prisma = new PrismaClient({ log: [] });

// ─── AMM replay (same formula as src/lib/probability.ts) ─────────────────────

function computeAmmProbability(
  current: number,
  amount: number,
  direction: 1 | -1,
  liquidity: number,
): number {
  return Math.min(99, Math.max(1, current + direction * (amount / liquidity) * 100));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

function confirmed(ans: string): boolean {
  return ans.trim().toLowerCase() === "yes" || ans.trim().toLowerCase() === "y";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const skipConfirm = process.argv.includes("--yes") || process.argv.includes("-y");

  // ── Audit ────────────────────────────────────────────────────────────────
  const botUserCount  = await prisma.user.count({ where: { isBot: true } });
  const botBetCount   = await prisma.bet.count({ where: { isBot: true } });

  console.log("=== Winzen Simulation Cleanup ===\n");
  console.log(`  Bot users : ${botUserCount}`);
  console.log(`  Bot bets  : ${botBetCount}`);

  if (botUserCount === 0 && botBetCount === 0) {
    console.log("\nNothing to clean up.");
    return;
  }

  // ── Confirmation ──────────────────────────────────────────────────────────
  if (!skipConfirm) {
    const ans = await prompt(
      `\n⚠️  Permanently delete all ${botUserCount} bot users and ` +
      `${botBetCount} bot bets? [yes/no]: `,
    );
    if (!confirmed(ans)) {
      console.log("Aborted.");
      return;
    }
  }

  console.log("\nRunning cleanup…\n");

  // ── 1. Collect IDs before deleting ──────────────────────────────────────
  const botUsers = await prisma.user.findMany({
    where:  { isBot: true },
    select: { id: true },
  });
  const botIds = botUsers.map(u => u.id);

  const affectedMarkets = await prisma.bet.findMany({
    where:    { isBot: true },
    select:   { marketId: true },
    distinct: ["marketId"],
  });
  const affectedMarketIds = affectedMarkets.map(b => b.marketId);

  // ── 2. Delete bot bets (FK Restrict — must go before users) ──────────────
  const { count: deletedBets } = await prisma.bet.deleteMany({ where: { isBot: true } });
  console.log(`  ✓ Deleted ${deletedBets} bot bets`);

  // ── 3. Delete bot transactions (FK Restrict — must go before users) ──────
  const { count: deletedTx } = await prisma.transaction.deleteMany({
    where: { userId: { in: botIds } },
  });
  console.log(`  ✓ Deleted ${deletedTx} bot transactions`);

  // ── 4. Delete bot users (cascades to: UserMissionProgress, UserAgent, ────
  //       AgentPurchase, PortfolioSnapshot, Comment, Notification, UserSettings)
  const { count: deletedUsers } = await prisma.user.deleteMany({ where: { isBot: true } });
  console.log(`  ✓ Deleted ${deletedUsers} bot users`);

  // ── 5. Recalculate market stats by replaying remaining real bets ──────────
  if (affectedMarketIds.length > 0) {
    console.log(`\n  Recalculating stats for ${affectedMarketIds.length} affected markets…`);

    for (const marketId of affectedMarketIds) {
      const market = await prisma.market.findUnique({
        where:  { id: marketId },
        select: { liquidity: true },
      });
      if (!market) continue;

      // Fetch all remaining (real) bets in chronological order
      const remainingBets = await prisma.bet.findMany({
        where:   { marketId },
        include: { outcome: { select: { label: true } } },
        orderBy: { createdAt: "asc" },
      });

      const totalVolume       = remainingBets.reduce((s, b) => s + b.amount, 0);
      const uniqueParticipants = new Set(remainingBets.map(b => b.userId)).size;

      // Replay AMM from 50 → get accurate final probability
      let prob = 50;
      for (const bet of remainingBets) {
        const isYes    = bet.outcome.label.toLowerCase().startsWith("yes");
        const dir: 1 | -1 = isYes ? 1 : -1;
        prob = computeAmmProbability(prob, bet.amount, dir, market.liquidity);
      }

      await prisma.market.update({
        where: { id: marketId },
        data:  { totalVolume, participantCount: uniqueParticipants, currentProbability: prob },
      });
    }

    console.log("  ✓ Market stats recalculated");
  }

  console.log("\n✅ Cleanup complete.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
