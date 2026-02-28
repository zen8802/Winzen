/**
 * Seed Season 1 of the Battle Pass.
 * Safe to re-run: upserts season, deletes + recreates rewards.
 *
 *   npx tsx prisma/seed-battle-pass.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Season window (30 days from "now" at seed time) ──────────────────────────
const SEASON_NAME  = "Season 1";
const TOTAL_TIERS  = 30;
const XP_PER_TIER  = 300;

// ─── Reward layout ────────────────────────────────────────────────────────────
// Each entry defines a reward for one track at one tier.
// Coin values increase as tiers progress.
// XP_BOOST_MARKER rows are visual milestones — the boost is auto-applied in code.
// CHOICE_COSMETIC rows let premium users pick a free item from a slot.

type RewardDef = {
  tier:       number;
  track:      "FREE" | "PREMIUM";
  rewardType: "COINS" | "CHOICE_COSMETIC" | "XP_BOOST_MARKER";
  amount?:    number;
  itemSlot?:  string;
  label?:     string;
};

function freeCoins(tier: number): number {
  if (tier <= 5)  return 150 + tier * 30;         // 180–300
  if (tier <= 10) return 300 + (tier - 5) * 40;   // 340–500
  if (tier <= 15) return 500 + (tier - 10) * 50;  // 550–750
  if (tier <= 20) return 750 + (tier - 15) * 60;  // 810–1050
  if (tier <= 25) return 1050 + (tier - 20) * 70; // 1120–1400
  return 1400 + (tier - 25) * 100;                // 1500–1900 (tiers 26-30)
}

function premCoins(tier: number): number {
  return Math.round(freeCoins(tier) * 1.6); // premium gets ~60% more coins
}

const rewards: RewardDef[] = [];

for (let tier = 1; tier <= TOTAL_TIERS; tier++) {
  // ── Free track ──────────────────────────────────────────────────
  if (tier === 15) {
    // Halfway XP boost marker (auto-applied in code, +5% free / +10% premium)
    rewards.push({ tier, track: "FREE", rewardType: "XP_BOOST_MARKER", label: "+5% XP Boost" });
  } else if (tier === 30) {
    rewards.push({ tier, track: "FREE", rewardType: "XP_BOOST_MARKER", label: "+12% XP Boost · Season Complete!" });
  } else {
    rewards.push({ tier, track: "FREE", rewardType: "COINS", amount: freeCoins(tier) });
  }

  // ── Premium track ───────────────────────────────────────────────
  if (tier === 10) {
    rewards.push({ tier, track: "PREMIUM", rewardType: "CHOICE_COSMETIC", itemSlot: "hat",    label: "Free Hat of the Season" });
  } else if (tier === 15) {
    rewards.push({ tier, track: "PREMIUM", rewardType: "CHOICE_COSMETIC", itemSlot: "top",    label: "Free Shirt of the Season" });
  } else if (tier === 20) {
    rewards.push({ tier, track: "PREMIUM", rewardType: "CHOICE_COSMETIC", itemSlot: "bottom", label: "Free Pants of the Season" });
  } else if (tier === 25) {
    rewards.push({ tier, track: "PREMIUM", rewardType: "CHOICE_COSMETIC", itemSlot: "shoes",  label: "Free Shoes of the Season" });
  } else if (tier === 30) {
    rewards.push({ tier, track: "PREMIUM", rewardType: "COINS", amount: 5000, label: "Season Complete Bonus!" });
  } else {
    rewards.push({ tier, track: "PREMIUM", rewardType: "COINS", amount: premCoins(tier) });
  }
}

async function main() {
  // Upsert Season 1
  const now      = new Date();
  const endsAt   = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days

  // Deactivate any existing active season first
  await prisma.battlePassSeason.updateMany({
    where: { isActive: true },
    data:  { isActive: false },
  });

  const season = await prisma.battlePassSeason.upsert({
    where:  { id: "season_1" },
    update: { name: SEASON_NAME, startsAt: now, endsAt, totalTiers: TOTAL_TIERS, xpPerTier: XP_PER_TIER, isActive: true },
    create: { id: "season_1", name: SEASON_NAME, startsAt: now, endsAt, totalTiers: TOTAL_TIERS, xpPerTier: XP_PER_TIER, isActive: true },
  });

  // Delete old rewards for this season then recreate
  await prisma.battlePassReward.deleteMany({ where: { seasonId: season.id } });
  await prisma.battlePassReward.createMany({
    data: rewards.map((r) => ({
      seasonId:   season.id,
      tier:       r.tier,
      track:      r.track,
      rewardType: r.rewardType,
      amount:     r.amount ?? null,
      itemSlot:   r.itemSlot ?? null,
      label:      r.label ?? null,
    })),
  });

  console.log(`✅ Season 1 seeded — ${rewards.length} rewards across ${TOTAL_TIERS} tiers`);
  console.log(`   Starts: ${now.toISOString().slice(0, 10)}`);
  console.log(`   Ends:   ${endsAt.toISOString().slice(0, 10)}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
