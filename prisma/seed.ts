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

  // ─── Agent shop items ─────────────────────────────────────────────────────
  // To add new items: place PNG at /public/avatar/items/[category]/[slug].png
  // then add an entry below (or via admin panel). No code changes needed.
  // Categories: skin | eyes | mouth | hair | top | bottom | shoes | hat | accessory_front | accessory_back
  const existingItems = await prisma.agentItem.count();
  if (existingItems === 0) {
    await prisma.agentItem.createMany({
      data: [
        // ── Skin tones ────────────────────────────────────────────────────
        { category: "skin",   name: "Light Tone",     price: 0,   order: 0, icon: null },
        { category: "skin",   name: "Medium Tone",    price: 50,  order: 1, icon: null },
        { category: "skin",   name: "Dark Tone",      price: 50,  order: 2, icon: null },
        // ── Eyes ──────────────────────────────────────────────────────────
        { category: "eyes",   name: "Sunglasses",     price: 150, order: 0, icon: null },
        { category: "eyes",   name: "Round Frames",   price: 120, order: 1, icon: null },
        { category: "eyes",   name: "Eye Mask",       price: 200, order: 2, icon: null },
        // ── Mouth ─────────────────────────────────────────────────────────
        { category: "mouth",  name: "Big Smile",      price: 80,  order: 0, icon: null },
        { category: "mouth",  name: "Cool Smirk",     price: 100, order: 1, icon: null },
        { category: "mouth",  name: "Tongue Out",     price: 120, order: 2, icon: null },
        // ── Hair ──────────────────────────────────────────────────────────
        { category: "hair",   name: "Messy Hair",     price: 100, order: 0, icon: null },
        { category: "hair",   name: "Slick Back",     price: 130, order: 1, icon: null },
        { category: "hair",   name: "Curly",          price: 140, order: 2, icon: null },
        { category: "hair",   name: "Long Waves",     price: 160, order: 3, icon: null },
        // ── Tops ──────────────────────────────────────────────────────────
        { category: "top",    name: "T-Shirt",        price: 100, order: 0, icon: null },
        { category: "top",    name: "Hoodie",         price: 170, order: 1, icon: null },
        { category: "top",    name: "Button-Up",      price: 140, order: 2, icon: null },
        { category: "top",    name: "Polo",           price: 130, order: 3, icon: null },
        // ── Bottoms ───────────────────────────────────────────────────────
        { category: "bottom", name: "Jeans",          price: 110, order: 0, icon: null },
        { category: "bottom", name: "Shorts",         price: 90,  order: 1, icon: null },
        { category: "bottom", name: "Cargo Pants",    price: 150, order: 2, icon: null },
        { category: "bottom", name: "Sweatpants",     price: 120, order: 3, icon: null },
        // ── Shoes ─────────────────────────────────────────────────────────
        { category: "shoes",  name: "Sneakers",       price: 120, order: 0, icon: null },
        { category: "shoes",  name: "Boots",          price: 160, order: 1, icon: null },
        { category: "shoes",  name: "Sandals",        price: 90,  order: 2, icon: null },
        { category: "shoes",  name: "Loafers",        price: 130, order: 3, icon: null },
        // ── Hats ──────────────────────────────────────────────────────────
        { category: "hat",    name: "Baseball Cap",   price: 80,  order: 0, icon: null },
        { category: "hat",    name: "Beanie",         price: 120, order: 1, icon: null },
        { category: "hat",    name: "Sun Visor",      price: 90,  order: 2, icon: null },
        { category: "hat",    name: "Fedora",         price: 200, order: 3, icon: null },
        // ── Accessories ───────────────────────────────────────────────────
        { category: "accessory_front", name: "Gold Chain",   price: 180, order: 0, icon: null },
        { category: "accessory_front", name: "Bow Tie",      price: 130, order: 1, icon: null },
        { category: "accessory_back",  name: "Angel Wings",  price: 300, order: 0, icon: null },
        { category: "accessory_back",  name: "Backpack",     price: 200, order: 1, icon: null },
      ],
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
