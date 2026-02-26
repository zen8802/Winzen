/**
 * scripts/runSimulation.ts
 * Continuous bot-driven trading simulation for Winzen prediction markets.
 *
 * SAFETY:
 *  - Only runs when ENABLE_SIMULATION=true
 *  - All bets have isBot=true and never affect real-user balances
 *  - Does NOT create Activity feed entries (keeps live feed clean)
 *  - Does NOT trigger gamification, missions, or notifications
 *
 * Usage:
 *   ENABLE_SIMULATION=true npm run simulate
 *   (or add ENABLE_SIMULATION=true to your .env file, then: npm run simulate)
 */

// ─── Safety check — must be first ────────────────────────────────────────────
if (process.env.ENABLE_SIMULATION !== "true") {
  console.error("❌  Simulation is disabled.");
  console.error("    Set ENABLE_SIMULATION=true in your .env file, or run:");
  console.error("    ENABLE_SIMULATION=true npm run simulate");
  process.exit(1);
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: [] });

// ─── AMM formula (mirrors src/lib/probability.ts) ────────────────────────────

function computeAmmProbability(
  current: number,
  amount: number,
  direction: 1 | -1,
  liquidity: number,
): number {
  return Math.min(99, Math.max(1, current + direction * (amount / liquidity) * 100));
}

// ─── Bot strategy system ─────────────────────────────────────────────────────
//
//  Strategies are derived from the bot's index number:
//    bot_001–bot_020  → random          (50/50 side, medium bet)
//    bot_021–bot_040  → trend_follower  (bets whichever side is currently leading)
//    bot_041–bot_060  → contrarian      (bets against the leading side)
//    bot_061–bot_080  → whale           (large infrequent bets, 20% skip chance)
//    bot_081–bot_100  → conservative    (tiny frequent bets)

type Strategy = "random" | "trend_follower" | "contrarian" | "whale" | "conservative";

function deriveStrategy(botName: string): Strategy {
  const num = parseInt(botName.replace("bot_", ""), 10);
  if (isNaN(num)) return "random";
  if (num <= 20)  return "random";
  if (num <= 40)  return "trend_follower";
  if (num <= 60)  return "contrarian";
  if (num <= 80)  return "whale";
  return "conservative";
}

function getBetAmount(strategy: Strategy, balance: number): number {
  const r = Math.random();
  let amount: number;
  switch (strategy) {
    case "whale":        amount = Math.floor(r * 700) + 300; break; // 300–1,000
    case "conservative": amount = Math.floor(r *  40) +  10; break; // 10–50
    case "trend_follower":
    case "contrarian":   amount = Math.floor(r * 120) +  30; break; // 30–150
    default:             amount = Math.floor(r * 150) +  50; break; // 50–200
  }
  return Math.min(amount, balance);
}

function getSide(strategy: Strategy, currentYesProb: number): "YES" | "NO" {
  switch (strategy) {
    case "trend_follower": return currentYesProb >= 50 ? "YES" : "NO";
    case "contrarian":     return currentYesProb >= 50 ? "NO"  : "YES";
    default:               return Math.random() < 0.5   ? "YES" : "NO";
  }
}

// ─── Single simulation tick ───────────────────────────────────────────────────

let tickCount = 0;
let tradesThisMinute = 0;
let minuteStart = Date.now();

async function tick() {
  const now = new Date();

  // Pick a random bot with enough balance
  const bots = await prisma.user.findMany({
    where: { isBot: true, balance: { gte: 10 } },
    select: { id: true, name: true, balance: true },
  });
  if (bots.length === 0) {
    console.warn("[SIM] No bots with sufficient balance — consider re-seeding.");
    return;
  }
  const bot = bots[Math.floor(Math.random() * bots.length)];

  // Pick a random open binary market
  const markets = await prisma.market.findMany({
    where: { resolvedOutcomeId: null, closesAt: { gt: now }, type: "yes_no" },
    include: { outcomes: { orderBy: { order: "asc" } } },
  });
  if (markets.length === 0) return;
  const market = markets[Math.floor(Math.random() * markets.length)];

  // Locate YES / NO outcomes
  const yesOutcome = market.outcomes.find(o => o.label.toLowerCase().startsWith("yes"));
  const noOutcome  = market.outcomes.find(o => o.label.toLowerCase().startsWith("no"));
  if (!yesOutcome || !noOutcome) return;

  // Whales occasionally skip a tick (low activity feel)
  const strategy = deriveStrategy(bot.name);
  if (strategy === "whale" && Math.random() < 0.20) return;

  const side      = getSide(strategy, market.currentProbability);
  const isYes     = side === "YES";
  const chosen    = isYes ? yesOutcome : noOutcome;
  const direction: 1 | -1 = isYes ? 1 : -1;
  const amount    = getBetAmount(strategy, bot.balance);
  if (amount < 1) return;

  const newYesProb       = computeAmmProbability(market.currentProbability, amount, direction, market.liquidity);
  const entryProbability = isYes ? newYesProb : 100 - newYesProb;
  const shares           = amount / entryProbability;
  const newBalance       = bot.balance - amount;
  const snapshotNow      = new Date();

  const hasExisting = await prisma.bet.findFirst({
    where: { userId: bot.id, marketId: market.id },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.bet.create({
      data: {
        userId:           bot.id,
        marketId:         market.id,
        outcomeId:        chosen.id,
        amount,
        entryProbability,
        shares,
        isBot:            true,
      },
    });

    await tx.user.update({
      where: { id: bot.id },
      data:  { balance: newBalance },
    });

    await tx.market.update({
      where: { id: market.id },
      data: {
        currentProbability: newYesProb,
        totalVolume:        { increment: amount },
        ...(!hasExisting ? { participantCount: { increment: 1 } } : {}),
      },
    });

    // Snapshot for probability chart
    await tx.probabilitySnapshot.createMany({
      data: market.outcomes.map(o => ({
        marketId:   market.id,
        outcomeId:  o.id,
        probability: o.label.toLowerCase().startsWith("yes")
          ? newYesProb / 100
          : (100 - newYesProb) / 100,
        recordedAt: snapshotNow,
      })),
    });
  });

  tickCount++;
  tradesThisMinute++;

  // Log every trade
  const shortTitle = market.title.length > 45
    ? market.title.slice(0, 42) + "…"
    : market.title;
  console.log(
    `[SIM #${tickCount}] ${bot.name} (${strategy.padEnd(14)}) ` +
    `bet ${String(amount).padStart(4)} on ${side.padEnd(3)} ` +
    `@ ${entryProbability.toFixed(1).padStart(4)}% | ` +
    `"${shortTitle}" → YES ${newYesProb.toFixed(1)}%`,
  );

  // Print trades-per-minute stat every 60 seconds
  const elapsed = Date.now() - minuteStart;
  if (elapsed >= 60_000) {
    console.log(`\n[SIM] ${tradesThisMinute} trades in the last minute\n`);
    tradesThisMinute = 0;
    minuteStart = Date.now();
  }
}

// ─── Main loop ────────────────────────────────────────────────────────────────

let running = true;
process.on("SIGINT", () => {
  console.log("\n⏹  Stopping simulation…");
  running = false;
});

(async () => {
  const marketCount = await prisma.market.count({
    where: { resolvedOutcomeId: null, type: "yes_no" },
  });
  const botCount = await prisma.user.count({ where: { isBot: true } });

  console.log("🤖 Winzen Simulation Engine");
  console.log(`   Active YES/NO markets : ${marketCount}`);
  console.log(`   Bot users             : ${botCount}`);
  console.log(`   Interval              : 1–3 seconds`);
  console.log("   Press Ctrl+C to stop.\n");

  if (botCount === 0) {
    console.error("❌  No bots found. Run: npm run simulate:seed");
    await prisma.$disconnect();
    process.exit(1);
  }
  if (marketCount === 0) {
    console.warn("⚠️  No open markets. Create some markets first.");
  }

  while (running) {
    try {
      await tick();
    } catch (err) {
      console.error("[SIM] Tick error:", err);
    }
    if (!running) break;
    const delay = Math.floor(Math.random() * 2_000) + 1_000; // 1–3 s
    await new Promise(r => setTimeout(r, delay));
  }

  await prisma.$disconnect();
  console.log(`✅ Simulation stopped after ${tickCount} trades.`);
})();
