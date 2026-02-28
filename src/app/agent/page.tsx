import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAgentWithItems } from "@/app/actions/agent";
import { AgentCollection } from "./AgentCollection";
import { Avatar } from "@/components/Avatar";
import { AVATAR_CATEGORIES } from "@/lib/avatar";
import Link from "next/link";

export default async function AgentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const data = await getAgentWithItems();
  if (!data) redirect("/login");

  const { items, ownedIds, equipped, equippedItemIds } = data;

  const ownedItems = items.filter((i) => ownedIds.has(i.id));
  const ownedByCategory = Object.fromEntries(
    AVATAR_CATEGORIES.map((cat) => [cat, ownedItems.filter((i) => i.category === cat)])
  );

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text)]">My Agent</h1>
        <p className="mt-2 text-[var(--muted)]">
          Customize your character. Earn coins from prediction markets to buy items.
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* Avatar display */}
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-b from-[var(--surface)] to-[var(--bg)] p-2">
            <Avatar equipped={equipped} size="xl" animate />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6 min-w-0">
          {ownedItems.length > 0 && (
            <AgentCollection
              ownedByCategory={ownedByCategory}
              equippedItemIds={equippedItemIds}
            />
          )}

          {/* Shop CTA */}
          <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center space-y-3">
            <p className="text-sm text-[var(--muted)]">
              {ownedItems.length === 0
                ? "You don't own any items yet. Head to the shop to get started!"
                : "Want more items? Browse the full catalogue."}
            </p>
            <Link href="/agent/shop" className="btn-gradient inline-block">
              Browse Shop →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
