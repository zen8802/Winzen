import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const pw = await hash("demo123", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo@winzen.app" },
    update: {},
    create: {
      email: "demo@winzen.app",
      name: "Demo User",
      password: pw,
      balance: 1000,
    },
  });

  const txCount = await prisma.transaction.count({ where: { userId: user.id, type: "initial" } });
  if (txCount === 0) {
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: "initial",
        amount: 1000,
        balanceAfter: 1000,
      },
    });
  }

  const closesAt = new Date();
  closesAt.setDate(closesAt.getDate() + 7);

  const m1 = await prisma.market.create({
    data: {
      title: "Will it rain in NYC next Saturday?",
      description: "Any measurable precipitation in Central Park.",
      type: "yes_no",
      category: "culture",
      closesAt,
      createdById: user.id,
      outcomes: {
        create: [
          { label: "Yes", order: 0 },
          { label: "No", order: 1 },
        ],
      },
    },
    include: { outcomes: true },
  });

  const m2 = await prisma.market.create({
    data: {
      title: "Who wins the next election?",
      type: "multiple_choice",
      category: "politics",
      closesAt,
      createdById: user.id,
      outcomes: {
        create: [
          { label: "Candidate A", order: 0 },
          { label: "Candidate B", order: 1 },
          { label: "Candidate C", order: 2 },
        ],
      },
    },
    include: { outcomes: true },
  });

  const m3 = await prisma.market.create({
    data: {
      title: "Will the Lakers make the playoffs?",
      description: "NBA Western Conference playoff berth.",
      type: "yes_no",
      category: "sports",
      closesAt,
      createdById: user.id,
      outcomes: {
        create: [
          { label: "Yes", order: 0 },
          { label: "No", order: 1 },
        ],
      },
    },
    include: { outcomes: true },
  });

  const m4 = await prisma.market.create({
    data: {
      title: "Will Bitcoin hit $100k this year?",
      type: "yes_no",
      category: "crypto",
      closesAt,
      createdById: user.id,
      outcomes: {
        create: [
          { label: "Yes", order: 0 },
          { label: "No", order: 1 },
        ],
      },
    },
    include: { outcomes: true },
  });

  const m5 = await prisma.market.create({
    data: {
      title: "Will Apple announce a new VR headset at WWDC?",
      type: "yes_no",
      category: "tech",
      closesAt,
      createdById: user.id,
      outcomes: {
        create: [
          { label: "Yes", order: 0 },
          { label: "No", order: 1 },
        ],
      },
    },
    include: { outcomes: true },
  });

  // Agent marketplace items
  const existingItems = await prisma.agentItem.count();
  if (existingItems === 0) {
    const prices = [80, 120, 150, 90, 200];
    await prisma.agentItem.createMany({
      data: [
        ...["Baseball Cap", "Beanie", "Headband", "Sun Visor", "Fedora"].map((name, i) => ({
          category: "headware",
          name,
          price: prices[i] ?? 100,
          gender: "unisex",
          order: i,
        })),
        ...["T-Shirt", "Polo", "Hoodie", "Tank Top", "Button-Up"].map((name, i) => ({
          category: "shirt",
          name,
          price: (prices[i] ?? 100) + 20,
          gender: "unisex",
          order: i,
        })),
        { category: "shirt", name: "Red Shirt", price: 500, gender: "unisex", order: 10, color: "#ef4444" },
        ...["Jeans", "Shorts", "Cargo Pants", "Chinos", "Sweatpants"].map((name, i) => ({
          category: "pants",
          name,
          price: (prices[i] ?? 100) + 30,
          gender: "unisex",
          order: i,
        })),
        ...["Sneakers", "Boots", "Sandals", "Loafers", "Flip-Flops"].map((name, i) => ({
          category: "shoes",
          name,
          price: (prices[i] ?? 100) + 40,
          gender: "unisex",
          order: i,
        })),
        ...["Watch", "Bracelet", "Sunglasses", "Backpack", "Scarf"].map((name, i) => ({
          category: "accessories",
          name,
          price: (prices[i] ?? 100) + 10,
          gender: "unisex",
          order: i,
        })),
      ],
    });
  }

  // Ensure Red Shirt exists (in case seed ran before it was added)
  const redShirt = await prisma.agentItem.findFirst({
    where: { category: "shirt", name: "Red Shirt" },
  });
  if (!redShirt) {
    await prisma.agentItem.create({
      data: {
        category: "shirt",
        name: "Red Shirt",
        price: 500,
        gender: "unisex",
        order: 10,
        color: "#ef4444",
      },
    });
  }

  console.log("Seed done. Demo user: demo@winzen.app / demo123");
  console.log("Markets created:", m1.id, m2.id, m3.id, m4.id, m5.id);
  console.log("Agent items:", await prisma.agentItem.count());
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
