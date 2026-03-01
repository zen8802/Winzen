import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const bots = await prisma.user.findMany({ where: { isBot: true }, select: { id: true } });
  for (const bot of bots) {
    await prisma.user.update({
      where: { id: bot.id },
      data: { balance: Math.floor(Math.random() * 400_000) + 100_000 },
    });
  }
  console.log(`✅ Updated ${bots.length} bots to 100k–500k balance`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
