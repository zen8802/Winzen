/**
 * One-time migration: convert existing parimutuel bets to AMM positions.
 * Run with: npx tsx prisma/migrate-positions.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Migrating existing markets to currentProbability=50...");
  const marketResult = await prisma.market.updateMany({
    where: { type: "yes_no" },
    data: { currentProbability: 50 },
  });
  console.log(`  Updated ${marketResult.count} yes_no markets`);

  console.log("Migrating existing bets to entryProbability=50, computing shares...");
  const bets = await prisma.bet.findMany({ where: { shares: null } });
  console.log(`  Found ${bets.length} bets to migrate`);

  let updated = 0;
  for (const bet of bets) {
    await prisma.bet.update({
      where: { id: bet.id },
      data: {
        entryProbability: 50,
        shares: bet.amount / 50,
      },
    });
    updated++;
  }
  console.log(`  Migrated ${updated} bets`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
