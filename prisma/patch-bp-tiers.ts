/**
 * Patch Season 1 battle pass tier rewards in-place (no deletes — avoids FK constraint).
 *   npx tsx prisma/patch-bp-tiers.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const season = await prisma.battlePassSeason.findFirstOrThrow({
    where: { id: "season_1" },
  });

  // Tier 5 PREMIUM: was coins → now "Free Hat of the Season"
  await prisma.battlePassReward.updateMany({
    where: { seasonId: season.id, tier: 5, track: "PREMIUM" },
    data: { rewardType: "CHOICE_COSMETIC", itemSlot: "hat", label: "Free Hat of the Season", amount: null },
  });

  // Tier 10 PREMIUM: now "+10% EXP BOOST"
  await prisma.battlePassReward.updateMany({
    where: { seasonId: season.id, tier: 10, track: "PREMIUM" },
    data: { rewardType: "XP_BOOST_MARKER", itemSlot: null, label: "+10% EXP BOOST", amount: null },
  });

  // Tier 10 FREE: was coins → now "+5% XP Boost"
  await prisma.battlePassReward.updateMany({
    where: { seasonId: season.id, tier: 10, track: "FREE" },
    data: { rewardType: "XP_BOOST_MARKER", itemSlot: null, label: "+5% XP Boost", amount: null },
  });

  // Tier 15 FREE: was "+5% XP Boost" → back to coins
  await prisma.battlePassReward.updateMany({
    where: { seasonId: season.id, tier: 15, track: "FREE" },
    data: { rewardType: "COINS", itemSlot: null, label: null, amount: 500 + (15 - 10) * 50 }, // 750
  });

  // Tier 30 PREMIUM: now "+25% EXP BOOST"
  await prisma.battlePassReward.updateMany({
    where: { seasonId: season.id, tier: 30, track: "PREMIUM" },
    data: { rewardType: "XP_BOOST_MARKER", itemSlot: null, label: "+25% EXP BOOST · Season Complete!", amount: null },
  });

  console.log("✅ Patched tiers 5, 10, 15, 30");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
