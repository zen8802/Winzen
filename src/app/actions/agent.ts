"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { resolveEquipped, type AvatarCategory, type AvatarEquipped } from "@/lib/avatar";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentItemRow = {
  id:       string;
  category: string;
  name:     string;
  price:    number;
  icon:     string | null;
  order:    number;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

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

  // Build icon map for equipped items
  const equippedIdList = [
    agent?.equippedSkinId,
    agent?.equippedEyesId,
    agent?.equippedMouthId,
    agent?.equippedHairId,
    agent?.equippedTopId,
    agent?.equippedBottomId,
    agent?.equippedShoesId,
    agent?.equippedHatId,
    agent?.equippedAccessoryFrontId,
    agent?.equippedAccessoryBackId,
  ].filter(Boolean) as string[];

  const equippedItems = equippedIdList.length
    ? await prisma.agentItem.findMany({ where: { id: { in: equippedIdList } } })
    : [];

  const iconMap = new Map(equippedItems.map((i) => [i.id, i.icon ?? ""]));
  const equipped = resolveEquipped(agent, iconMap);

  // Category → equipped item ID (for isEquipped checks in UI)
  const equippedItemIds: Partial<Record<AvatarCategory, string | null>> = {
    skin:             agent?.equippedSkinId,
    eyes:             agent?.equippedEyesId,
    mouth:            agent?.equippedMouthId,
    hair:             agent?.equippedHairId,
    top:              agent?.equippedTopId,
    bottom:           agent?.equippedBottomId,
    shoes:            agent?.equippedShoesId,
    hat:              agent?.equippedHatId,
    accessory_front:  agent?.equippedAccessoryFrontId,
    accessory_back:   agent?.equippedAccessoryBackId,
  };

  return {
    agent,
    items: items as AgentItemRow[],
    ownedIds,
    equipped,
    equippedItemIds,
  };
}

/** Fetch avatar display data for any user (used on profile, leaderboard, comments). */
export async function getUserAvatarData(userId: string): Promise<{
  equipped: AvatarEquipped;
} | null> {
  const agent = await prisma.userAgent.findUnique({ where: { userId } });
  if (!agent) return null;

  const ids = [
    agent.equippedSkinId,
    agent.equippedEyesId,
    agent.equippedMouthId,
    agent.equippedHairId,
    agent.equippedTopId,
    agent.equippedBottomId,
    agent.equippedShoesId,
    agent.equippedHatId,
    agent.equippedAccessoryFrontId,
    agent.equippedAccessoryBackId,
  ].filter(Boolean) as string[];

  const items = ids.length
    ? await prisma.agentItem.findMany({ where: { id: { in: ids } } })
    : [];

  const iconMap = new Map(items.map((i) => [i.id, i.icon ?? ""]));

  return { equipped: resolveEquipped(agent, iconMap) };
}

/** Batch-fetch avatar data for multiple users in 2 queries (for comments/leaderboard). */
export async function getBatchAvatarData(
  userIds: string[],
): Promise<Map<string, { equipped: AvatarEquipped }>> {
  if (userIds.length === 0) return new Map();

  const agents = await prisma.userAgent.findMany({
    where: { userId: { in: userIds } },
  });

  const allIds = agents.flatMap((a) =>
    [
      a.equippedSkinId, a.equippedEyesId, a.equippedMouthId, a.equippedHairId,
      a.equippedTopId, a.equippedBottomId, a.equippedShoesId, a.equippedHatId,
      a.equippedAccessoryFrontId, a.equippedAccessoryBackId,
    ].filter(Boolean)
  ) as string[];

  const items = allIds.length
    ? await prisma.agentItem.findMany({ where: { id: { in: allIds } } })
    : [];

  const iconMap = new Map(items.map((i) => [i.id, i.icon ?? ""]));

  const result = new Map<string, { equipped: AvatarEquipped }>();
  for (const a of agents) {
    result.set(a.userId, { equipped: resolveEquipped(a, iconMap) });
  }
  return result;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

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
    prisma.user.update({ where: { id: session.user.id }, data: { balance: newBalance } }),
    prisma.agentPurchase.create({ data: { userId: session.user.id, agentItemId: item.id } }),
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

const SLOT_FIELD: Record<AvatarCategory, string> = {
  skin:             "equippedSkinId",
  eyes:             "equippedEyesId",
  mouth:            "equippedMouthId",
  hair:             "equippedHairId",
  top:              "equippedTopId",
  bottom:           "equippedBottomId",
  shoes:            "equippedShoesId",
  hat:              "equippedHatId",
  accessory_front:  "equippedAccessoryFrontId",
  accessory_back:   "equippedAccessoryBackId",
};

const equipSchema = z.object({
  agentItemId: z.string().nullable(),
  slot: z.enum([
    "skin", "eyes", "mouth", "hair", "top", "bottom",
    "shoes", "hat", "accessory_front", "accessory_back",
  ]),
});

export async function equipAgentItem(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not signed in" };

  const raw = formData.get("agentItemId");
  const parsed = equipSchema.safeParse({
    agentItemId: raw === "" || raw === "null" ? null : raw,
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

    const item = await prisma.agentItem.findUnique({ where: { id: parsed.data.agentItemId } });
    if (!item || item.category !== parsed.data.slot) return { error: "Invalid item for slot" };
  }

  const field = SLOT_FIELD[parsed.data.slot];
  const updateData = { [field]: parsed.data.agentItemId };

  await prisma.userAgent.upsert({
    where:  { userId: session.user.id },
    create: { userId: session.user.id, ...updateData },
    update: updateData,
  });

  revalidatePath("/agent");
  return { ok: true };
}
