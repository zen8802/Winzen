import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAgentWithItems } from "@/app/actions/agent";
import { AgentShop } from "./AgentShop";
import { AgentCollection } from "./AgentCollection";
import { Avatar } from "@/components/Avatar";
import { AVATAR_CATEGORIES } from "@/lib/avatar";

export default async function AgentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const data = await getAgentWithItems();
  if (!data) redirect("/login");

  const { items, ownedIds, equipped } = data;

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
          <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-b from-[var(--surface)] to-[var(--bg)] p-6">
            <Avatar equipped={equipped} size="xl" animate />
          </div>
          <p className="text-xs text-[var(--muted)]">Idle animation · breathes + blinks</p>
        </div>

        {/* Right column */}
        <div className="space-y-6 min-w-0">
          {ownedItems.length > 0 && (
            <AgentCollection
              ownedByCategory={ownedByCategory}
              equipped={equipped}
            />
          )}

          <section>
            <h2 className="mb-4 text-lg font-semibold text-[var(--text)]">Shop</h2>
            <AgentShop
              items={items}
              ownedIds={ownedIds}
              equipped={equipped}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
