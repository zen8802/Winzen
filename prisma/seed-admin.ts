/**
 * DEV ONLY — promote a user to admin by email.
 * Run once: npm run db:seed-admin
 * Safe to re-run (idempotent — just sets role to "admin" again).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ADMIN_EMAIL = "toast8802@gmail.com";

async function main() {
  const user = await prisma.user.update({
    where: { email: ADMIN_EMAIL },
    data: { role: "admin" },
    select: { id: true, email: true, role: true },
  });
  console.log(`✓ Promoted ${user.email} (id: ${user.id}) → role: ${user.role}`);
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
