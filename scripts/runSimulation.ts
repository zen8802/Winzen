/**
 * scripts/runSimulation.ts
 * Upgraded continuous bot simulation for Winzen prediction markets.
 *
 * SAFETY:
 *  - Only runs when ENABLE_SIMULATION=true
 *  - All bets flagged isBot=true — never affects real-user balances
 *  - Does NOT trigger gamification, missions, ELO, or notifications
 *  - Bot trades DO appear in the Activity feed (human-readable usernames)
 *
 * Features:
 *  - Multi-bot ticks (1–3 normal, 5–15 during viral spikes)
 *  - Bot memory: aggression level, preferred side, last action time
 *  - Viral event spikes: sudden trading bursts biased toward one side
 *  - Structured health logging (JSON) every 15 seconds
 *  - Rolling latency tracking with health status heuristic
 *  - Configurable via SIM_CONFIG
 *
 * Usage:
 *   ENABLE_SIMULATION=true npm run simulate
 */

// ─── Safety check — must be first ────────────────────────────────────────────
if (process.env.ENABLE_SIMULATION !== "true") {
  console.error("❌  Simulation is disabled.");
  console.error("    Set ENABLE_SIMULATION=true in your .env file, or run:");
  console.error("    ENABLE_SIMULATION=true npm run simulate");
  process.exit(1);
}

import { PrismaClient } from "@prisma/client";
import { BOT_STRATEGIES, type BotStrategy } from "./generateBotUsername";

const prisma = new PrismaClient({ log: [] });

// ─── Configuration ────────────────────────────────────────────────────────────

const SIM_CONFIG = {
  /** Base ms between ticks (actual = base + random jitter) */
  tickIntervalMs: 2_000,
  /** Random jitter added to each tick delay (0–N ms) */
  tickIntervalJitterMs: 1_000,
  /** Max bots activated per tick during normal operation */
  maxBotsPerTick: 3,
  /** Chance a selected bot skips its turn (overridden per aggression level) */
  botSkipChance: 0.30,
  /** Min ms between viral spike triggers */
  spikeMinDelayMs: 2 * 60_000,
  /** Max ms between viral spike triggers */
  spikeMaxDelayMs: 10 * 60_000,
  /** How long a spike lasts */
  spikeDurationMs: 60_000,
  /** Bots activated per tick during a spike */
  spikeBotsPerTick: [5, 15] as [number, number], // [min, max]
  /** Multiplier applied to bet sizes during a spike */
  spikeBetMultiplier: 2.5,
  /** Tick interval is halved during a spike */
  spikeTickFactor: 0.5,
  /** Probability a spike-mode bot follows the spike side */
  spikeSideBias: 0.75,
  /** Health log output interval in ms */
  logIntervalMs: 15_000,
  /** Number of trades to keep in rolling latency window */
  latencyWindowSize: 20,
};

// ─── In-memory bot state ──────────────────────────────────────────────────────

type AggressionLevel = "low" | "medium" | "high";

interface BotState {
  lastActionTime: number;
  preferredSide?: "YES" | "NO";
  aggression: AggressionLevel;
}

const botStates = new Map<string, BotState>();

function getBotState(botId: string): BotState {
  if (!botStates.has(botId)) {
    const r = Math.random();
    botStates.set(botId, {
      lastActionTime: 0,
      aggression: r < 0.33 ? "low" : r < 0.67 ? "medium" : "high",
    });
  }
  return botStates.get(botId)!;
}

// ─── Viral spike state ────────────────────────────────────────────────────────

let spikeActive  = false;
let spikeEndTime = 0;
let spikeSide: "YES" | "NO" = "YES";
let nextSpikeAt  = Date.now() + randomSpikeDelay();

function randomSpikeDelay(): number {
  return SIM_CONFIG.spikeMinDelayMs +
    Math.random() * (SIM_CONFIG.spikeMaxDelayMs - SIM_CONFIG.spikeMinDelayMs);
}

function updateSpikeState(): void {
  const now = Date.now();
  if (spikeActive && now >= spikeEndTime) {
    spikeActive = false;
    console.log("[SIM] ⬇  VIRAL SPIKE ENDED — returning to normal activity");
    nextSpikeAt = now + randomSpikeDelay();
  }
  if (!spikeActive && now >= nextSpikeAt) {
    spikeActive  = true;
    spikeEndTime = now + SIM_CONFIG.spikeDurationMs;
    spikeSide    = Math.random() < 0.5 ? "YES" : "NO";
    console.log(
      `[SIM] ⚡ VIRAL SPIKE STARTED — ${spikeSide} bias for ` +
      `${SIM_CONFIG.spikeDurationMs / 1_000}s`,
    );
  }
}

// ─── Stats & performance tracking ────────────────────────────────────────────

let totalTrades        = 0;
let tradesThisInterval = 0;
let lastLogTime        = Date.now();
const latencyHistory: number[] = [];

function recordLatency(ms: number): void {
  latencyHistory.push(ms);
  if (latencyHistory.length > SIM_CONFIG.latencyWindowSize) latencyHistory.shift();
}

function avgLatency(): number {
  if (latencyHistory.length === 0) return 0;
  return latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length;
}

function systemStatus(latencyMs: number): "Idle" | "Healthy" | "Sluggish" | "Degrading" {
  if (totalTrades === 0)  return "Idle";
  if (latencyMs < 200)   return "Healthy";
  if (latencyMs < 500)   return "Sluggish";
  return "Degrading";
}

function printHealthLog(activeMarkets: number): void {
  const latency = Math.round(avgLatency());
  const status  = systemStatus(latency);
  const elapsed = SIM_CONFIG.logIntervalMs / 60_000; // interval in minutes
  const tpm     = Math.round(tradesThisInterval / elapsed);

  // Structured JSON log for easy parsing / monitoring
  console.log(
    JSON.stringify({
      bots:         botStates.size,
      tradesTotal:  totalTrades,
      tradesRecent: tradesThisInterval,
      tpm,
      spike:        spikeActive,
      spikeSide:    spikeActive ? spikeSide : null,
      avgLatencyMs: latency,
      activeMarkets,
      status,
    }),
  );

  if (status === "Sluggish" || status === "Degrading") {
    console.warn(`[SIM] ⚠  System ${status} — avg latency ${latency} ms`);
  }

  tradesThisInterval = 0;
}

// ─── AMM formula (mirrors src/lib/probability.ts) ────────────────────────────

function computeAmmProbability(
  current: number,
  amount: number,
  direction: 1 | -1,
  liquidity: number,
): number {
  return Math.min(99, Math.max(1, current + direction * (amount / liquidity) * 100));
}

// ─── Strategy helpers ─────────────────────────────────────────────────────────

function deriveStrategy(email: string): BotStrategy {
  const match = email.match(/^bot_([a-z_]+)_\d+@simulation\.internal$/);
  const s = match?.[1] as BotStrategy | undefined;
  if (s && (BOT_STRATEGIES as readonly string[]).includes(s)) return s;
  return "random";
}

function getBetAmount(
  strategy: BotStrategy,
  balance: number,
  state: BotState,
  duringSpike: boolean,
): number {
  const r = Math.random();
  let base: number;
  switch (strategy) {
    case "whale":         base = Math.floor(r * 700) + 300; break; // 300–1,000
    case "conservative":  base = Math.floor(r *  40) +  10; break; //  10–50
    case "trend_follower":
    case "contrarian":    base = Math.floor(r * 120) +  30; break; //  30–150
    default:              base = Math.floor(r * 150) +  50; break; //  50–200
  }
  const aggrMult  = state.aggression === "high" ? 1.5 : state.aggression === "low" ? 0.7 : 1.0;
  const spikeMult = duringSpike ? SIM_CONFIG.spikeBetMultiplier : 1.0;
  return Math.min(Math.floor(base * aggrMult * spikeMult), balance);
}

function getSide(
  strategy: BotStrategy,
  currentYesProb: number,
  state: BotState,
): "YES" | "NO" {
  // During spike: bias toward spike side
  if (spikeActive && Math.random() < SIM_CONFIG.spikeSideBias) return spikeSide;
  // Preferred side stickiness (60% chance to repeat)
  if (state.preferredSide && Math.random() < 0.60) return state.preferredSide;
  switch (strategy) {
    case "trend_follower": return currentYesProb >= 50 ? "YES" : "NO";
    case "contrarian":     return currentYesProb >= 50 ? "NO"  : "YES";
    default:               return Math.random() < 0.5   ? "YES" : "NO";
  }
}

// ─── Single bot action ────────────────────────────────────────────────────────

interface BotRow {
  id: string;
  name: string;
  email: string;
  balance: number;
}

interface MarketRow {
  id: string;
  title: string;
  currentProbability: number;
  liquidity: number;
  outcomes: Array<{ id: string; label: string }>;
}

async function executeBotAction(bot: BotRow, market: MarketRow): Promise<boolean> {
  const state    = getBotState(bot.id);
  const strategy = deriveStrategy(bot.email);

  // Skip logic based on aggression
  const skipChance =
    state.aggression === "low"  ? 0.50 :
    state.aggression === "high" ? 0.10 : SIM_CONFIG.botSkipChance;
  if (Math.random() < skipChance) return false;

  // Whales occasionally hold back (rarer, bigger trades feel intentional)
  if (strategy === "whale" && Math.random() < 0.20) return false;

  const yesOutcome = market.outcomes.find(o => o.label.toLowerCase().startsWith("yes"));
  const noOutcome  = market.outcomes.find(o => o.label.toLowerCase().startsWith("no"));
  if (!yesOutcome || !noOutcome) return false;

  const side      = getSide(strategy, market.currentProbability, state);
  const isYes     = side === "YES";
  const chosen    = isYes ? yesOutcome : noOutcome;
  const direction: 1 | -1 = isYes ? 1 : -1;
  const amount    = getBetAmount(strategy, bot.balance, state, spikeActive);
  if (amount < 1) return false;

  const newYesProb       = computeAmmProbability(market.currentProbability, amount, direction, market.liquidity);
  const entryProbability = isYes ? newYesProb : 100 - newYesProb;
  const shares           = amount / entryProbability;
  const snapshotNow      = new Date();

  const startTime = Date.now();

  const hasExisting = await prisma.bet.findFirst({
    where:  { userId: bot.id, marketId: market.id },
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
      data:  { balance: { decrement: amount } },
    });

    await tx.market.update({
      where: { id: market.id },
      data: {
        currentProbability: newYesProb,
        totalVolume:        { increment: amount },
        ...(!hasExisting ? { participantCount: { increment: 1 } } : {}),
      },
    });

    await tx.probabilitySnapshot.createMany({
      data: market.outcomes.map(o => ({
        marketId:    market.id,
        outcomeId:   o.id,
        probability: o.label.toLowerCase().startsWith("yes")
          ? newYesProb / 100
          : (100 - newYesProb) / 100,
        recordedAt: snapshotNow,
      })),
    });
  });

  // Activity feed entry
  await prisma.activity.create({
    data: {
      type:        "TRADE",
      userId:      bot.id,
      username:    bot.name,
      marketId:    market.id,
      marketTitle: market.title,
      side,
      amount,
      price:       entryProbability,
    },
  });

  // Update bot memory
  state.lastActionTime = Date.now();
  if (Math.random() < 0.20) state.preferredSide = side;

  recordLatency(Date.now() - startTime);
  totalTrades++;
  tradesThisInterval++;

  const shortTitle = market.title.length > 42 ? market.title.slice(0, 39) + "…" : market.title;
  const spikeTag   = spikeActive ? " ⚡" : "";
  console.log(
    `[SIM #${String(totalTrades).padStart(5)}]${spikeTag} ` +
    `${bot.name.padEnd(20)} (${strategy.padEnd(14)}) ` +
    `${state.aggression.padEnd(6)} | ` +
    `bet ${String(amount).padStart(5)} on ${side.padEnd(3)} ` +
    `@ ${entryProbability.toFixed(1).padStart(4)}% | "${shortTitle}"`,
  );

  return true;
}

// ─── Tick ─────────────────────────────────────────────────────────────────────

let tickCount = 0;

async function tick(): Promise<void> {
  updateSpikeState();
  tickCount++;

  // Periodic health log
  if (Date.now() - lastLogTime >= SIM_CONFIG.logIntervalMs) {
    const activeMarkets = await prisma.market.count({
      where: { resolvedOutcomeId: null, type: "yes_no" },
    });
    printHealthLog(activeMarkets);
    lastLogTime = Date.now();
  }

  // Trim activity table to 200 rows (once per tick, not per trade)
  const toDelete = await prisma.activity.findMany({
    orderBy: { createdAt: "desc" },
    skip:    200,
    select:  { id: true },
  });
  if (toDelete.length > 0) {
    await prisma.activity.deleteMany({ where: { id: { in: toDelete.map(a => a.id) } } });
  }

  // Fetch all eligible bots and open markets once per tick
  const [allBots, markets] = await Promise.all([
    prisma.user.findMany({
      where:  { isBot: true, balance: { gte: 10 } },
      select: { id: true, name: true, email: true, balance: true },
    }),
    prisma.market.findMany({
      where:   { resolvedOutcomeId: null, closesAt: { gt: new Date() }, type: "yes_no" },
      include: { outcomes: { orderBy: { order: "asc" as const } } },
    }),
  ]);

  if (allBots.length === 0) {
    console.warn("[SIM] No bots with sufficient balance — consider re-seeding.");
    return;
  }
  if (markets.length === 0) return;

  // Determine how many bots act this tick
  const [spikeMin, spikeMax] = SIM_CONFIG.spikeBotsPerTick;
  const botsPerTick = spikeActive
    ? Math.floor(Math.random() * (spikeMax - spikeMin + 1)) + spikeMin
    : Math.floor(Math.random() * SIM_CONFIG.maxBotsPerTick) + 1;

  // Shuffle and select bots
  const shuffled = allBots.slice().sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(botsPerTick, shuffled.length));

  // Execute sequentially to keep market probability consistent
  for (const bot of selected) {
    const market = markets[Math.floor(Math.random() * markets.length)];
    try {
      await executeBotAction(bot, market);
    } catch (err) {
      console.error(`[SIM] Bot ${bot.name} error:`, err);
    }
  }
}

// ─── Main loop ────────────────────────────────────────────────────────────────

let running = true;

process.on("SIGINT", () => {
  console.log("\n⏹  Stopping simulation…");
  running = false;
});

(async () => {
  const [marketCount, botCount] = await Promise.all([
    prisma.market.count({ where: { resolvedOutcomeId: null, type: "yes_no" } }),
    prisma.user.count({ where: { isBot: true } }),
  ]);

  console.log("🤖 Winzen Simulation Engine v2");
  console.log(`   Active YES/NO markets : ${marketCount}`);
  console.log(`   Bot users             : ${botCount}`);
  console.log(`   Tick interval         : ${SIM_CONFIG.tickIntervalMs / 1_000}–${(SIM_CONFIG.tickIntervalMs + SIM_CONFIG.tickIntervalJitterMs) / 1_000} s (normal)`);
  console.log(`   Bots per tick         : 1–${SIM_CONFIG.maxBotsPerTick} (normal) | ${SIM_CONFIG.spikeBotsPerTick[0]}–${SIM_CONFIG.spikeBotsPerTick[1]} (spike)`);
  console.log(`   Spike chance          : every ${SIM_CONFIG.spikeMinDelayMs / 60_000}–${SIM_CONFIG.spikeMaxDelayMs / 60_000} min, lasts ${SIM_CONFIG.spikeDurationMs / 1_000}s`);
  console.log(`   Health logs           : every ${SIM_CONFIG.logIntervalMs / 1_000}s`);
  console.log("   Press Ctrl+C to stop.\n");

  if (botCount === 0) {
    console.error("❌  No bots found. Run: npm run simulate:seed");
    await prisma.$disconnect();
    process.exit(1);
  }
  if (marketCount === 0) {
    console.warn("⚠️  No open markets found — create some first.");
  }

  while (running) {
    try {
      await tick();
    } catch (err) {
      console.error("[SIM] Tick error:", err);
    }
    if (!running) break;

    const jitter = Math.random() * SIM_CONFIG.tickIntervalJitterMs;
    const delay  = spikeActive
      ? Math.floor((SIM_CONFIG.tickIntervalMs * SIM_CONFIG.spikeTickFactor) + jitter)
      : Math.floor(SIM_CONFIG.tickIntervalMs + jitter);

    await new Promise(r => setTimeout(r, delay));
  }

  await prisma.$disconnect();
  console.log(`\n✅ Simulation stopped after ${totalTrades} trades (${tickCount} ticks).`);
})();
