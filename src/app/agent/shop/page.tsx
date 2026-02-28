import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAgentWithItems } from "@/app/actions/agent";
import { AgentShop } from "../AgentShop";
import { Avatar } from "@/components/Avatar";
import Link from "next/link";

export default async function AgentShopPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const data = await getAgentWithItems();
  if (!data) redirect("/login");

  const { items, ownedIds, equipped, equippedItemIds } = data;

  return (
    <div className="space-y-8">
      <section className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text)]">Shop</h1>
          <p className="mt-2 text-[var(--muted)]">
            Browse and buy items for your character.
          </p>
        </div>
        <Link href="/agent" className="btn-ghost text-sm shrink-0">
          ← My Agent
        </Link>
      </section>

      {/* Avatar preview + shop side by side on large screens */}
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        {/* Avatar live preview */}
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-b from-[var(--surface)] to-[var(--bg)] p-5">
            <Avatar equipped={equipped} size="lg" animate={false} />
          </div>
          <p className="text-xs text-[var(--muted)]">Currently equipped</p>
        </div>

        {/* Shop */}
        <div className="min-w-0">
          <AgentShop
            items={items}
            ownedIds={ownedIds}
            equippedItemIds={equippedItemIds}
          />
        </div>
      </div>
    </div>
  );
}
