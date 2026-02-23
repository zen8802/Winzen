import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getInitialCoins } from "@/lib/coins";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(100).trim(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name } = bodySchema.parse(body);

    const [existingEmail, existingName] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { name: name.trim() } }),
    ]);
    if (existingEmail) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }
    if (existingName) {
      return NextResponse.json({ error: "Name already taken" }, { status: 400 });
    }

    const hashed = await hash(password, 12);
    const initialCoins = getInitialCoins();

    const user = await prisma.user.create({
      data: {
        email,
        name: name.trim(),
        password: hashed,
        balance: initialCoins,
      },
    });

    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: "initial",
        amount: initialCoins,
        balanceAfter: initialCoins,
      },
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      balance: user.balance,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
