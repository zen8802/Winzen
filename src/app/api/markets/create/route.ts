import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CREATOR_DEPOSIT } from "@/lib/market-constants";
import { z } from "zod";

const bodySchema = z.object({
  question: z.string().min(1).max(200),
  category: z.enum(["sports", "politics", "culture", "crypto", "tech"]).default("culture"),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { question, category } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.balance < CREATOR_DEPOSIT) {
    return NextResponse.json(
      { error: `Insufficient balance. Need ${CREATOR_DEPOSIT} coins to create a market.` },
      { status: 400 }
    );
  }

  const closesAt = new Date();
  closesAt.setDate(closesAt.getDate() + 7);

  const newBalance = user.balance - CREATOR_DEPOSIT;

  const market = await prisma.$transaction(async (tx) => {
    const m = await tx.market.create({
      data: {
        title: question,
        type: "yes_no",
        category,
        creatorDeposit: CREATOR_DEPOSIT,
        closesAt,
        createdById: session.user.id,
        outcomes: {
          create: [
            { label: "Yes", order: 0 },
            { label: "No", order: 1 },
          ],
        },
      },
      include: { outcomes: true },
    });
    await tx.user.update({
      where: { id: session.user.id },
      data: { balance: newBalance },
    });
    await tx.transaction.create({
      data: {
        userId: session.user.id,
        type: "deposit",
        amount: -CREATOR_DEPOSIT,
        balanceAfter: newBalance,
        referenceId: m.id,
      },
    });
    return m;
  });

  return NextResponse.json({
    market_id: market.id,
    question: market.title,
    category: market.category,
  });
}
