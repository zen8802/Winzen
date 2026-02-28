import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBattlePassStatus } from "@/app/actions/battle-pass";
import { BattlePassUI } from "./BattlePassUI";

export default async function BattlePassPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const status = await getBattlePassStatus();

  if (!status) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-4xl">🏆</p>
          <h1 className="text-2xl font-bold text-[var(--text)]">No Active Season</h1>
          <p className="text-[var(--muted)]">Check back soon for Season 1!</p>
        </div>
      </div>
    );
  }

  return <BattlePassUI initial={status} />;
}
