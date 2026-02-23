"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function getAgent() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  return prisma.userAgent.findUnique({
    where: { userId: session.user.id },
  });
}

export async function getAgentWithItems() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const [agent, items, purchases] = await Promise.all([
    prisma.userAgent.findUnique({ where: { userId: session.user.id } }),
    prisma.agentItem.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] }),
    prisma.agentPurchase.findMany({
      where: { userId: session.user.id },
      select: { agentItemId: true },
    }),
  ]);

  const ownedIds = new Set(purchases.map((p) => p.agentItemId));

  // Fetch equipped item colors for mannequin display - use item color or default when equipped
  const defaults = { headware: "#475569", shirt: "#64748b", pants: "#475569", shoes: "#374151", accessories: "#94a3b8" };
  const slots = [
    { id: agent?.equippedHeadwareId, key: "headware" as const },
    { id: agent?.equippedShirtId, key: "shirt" as const },
    { id: agent?.equippedPantsId, key: "pants" as const },
    { id: agent?.equippedShoesId, key: "shoes" as const },
    { id: agent?.equippedAccessoryId, key: "accessories" as const },
  ];
  const equippedColors: Record<string, string | null> = {};
  for (const { id, key } of slots) {
    if (!id) {
      equippedColors[key] = null;
      continue;
    }
    const item = await prisma.agentItem.findUnique({
      where: { id },
      select: { color: true },
    });
    equippedColors[key] = item?.color ?? defaults[key];
  }

  return {
    agent,
    items,
    ownedIds,
    equippedHeadwareColor: equippedColors.headware ?? null,
    equippedShirtColor: equippedColors.shirt ?? null,
    equippedPantsColor: equippedColors.pants ?? null,
    equippedShoesColor: equippedColors.shoes ?? null,
    equippedAccessoryColor: equippedColors.accessories ?? null,
  };
}

const setGenderSchema = z.object({ gender: z.enum(["male", "female"]) });

export async function setAgentGender(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not signed in" };

  const parsed = setGenderSchema.safeParse({ gender: formData.get("gender") });
  if (!parsed.success) return { error: "Invalid gender" };

  await prisma.userAgent.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, gender: parsed.data.gender },
    update: { gender: parsed.data.gender },
  });

  revalidatePath("/agent");
  return { ok: true };
}

const purchaseSchema = z.object({ agentItemId: z.string() });

export async function purchaseAgentItem(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not signed in" };

  const parsed = purchaseSchema.safeParse({ agentItemId: formData.get("agentItemId") });
  if (!parsed.success) return { error: "Invalid item" };

  const [user, item, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.agentItem.findUnique({ where: { id: parsed.data.agentItemId } }),
    prisma.agentPurchase.findUnique({
      where: {
        userId_agentItemId: { userId: session.user.id, agentItemId: parsed.data.agentItemId },
      },
    }),
  ]);

  if (!user) return { error: "User not found" };
  if (!item) return { error: "Item not found" };
  if (existing) return { error: "Already owned" };
  if (user.balance < item.price) return { error: "Insufficient balance" };

  const newBalance = user.balance - item.price;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { balance: newBalance },
    }),
    prisma.agentPurchase.create({
      data: { userId: session.user.id, agentItemId: item.id },
    }),
    prisma.transaction.create({
      data: {
        userId: session.user.id,
        type: "purchase",
        amount: -item.price,
        balanceAfter: newBalance,
        referenceId: item.id,
      },
    }),
  ]);

  revalidatePath("/agent");
  revalidatePath("/");
  return { ok: true };
}

const equipSchema = z.object({
  agentItemId: z.string().nullable(),
  slot: z.enum(["headware", "shirt", "pants", "shoes", "accessories"]),
});

export async function equipAgentItem(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not signed in" };

  const agentItemId = formData.get("agentItemId");
  const parsed = equipSchema.safeParse({
    agentItemId: agentItemId === "" || agentItemId === "null" ? null : agentItemId,
    slot: formData.get("slot"),
  });
  if (!parsed.success) return { error: "Invalid data" };

  if (parsed.data.agentItemId) {
    const owned = await prisma.agentPurchase.findUnique({
      where: {
        userId_agentItemId: { userId: session.user.id, agentItemId: parsed.data.agentItemId },
      },
    });
    if (!owned) return { error: "You don't own this item" };

    const item = await prisma.agentItem.findUnique({
      where: { id: parsed.data.agentItemId },
    });
    if (!item || item.category !== parsed.data.slot) return { error: "Invalid item for slot" };
  }

  const slot = parsed.data.slot;
  const updateData = {
    headware: { equippedHeadwareId: parsed.data.agentItemId },
    shirt: { equippedShirtId: parsed.data.agentItemId },
    pants: { equippedPantsId: parsed.data.agentItemId },
    shoes: { equippedShoesId: parsed.data.agentItemId },
    accessories: { equippedAccessoryId: parsed.data.agentItemId },
  }[slot];

  await prisma.userAgent.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      gender: "male",
      ...updateData,
    },
    update: updateData,
  });

  revalidatePath("/agent");
  return { ok: true };
}
