"use client";

import { useState } from "react";
import { equipAgentItem } from "@/app/actions/agent";
import { useRouter } from "next/navigation";

type AgentItem = {
  id: string;
  category: string;
  name: string;
};

type Equipped = {
  headware: string | null;
  shirt: string | null;
  pants: string | null;
  shoes: string | null;
  accessories: string | null;
};

const LABELS = {
  headware: "Headware",
  shirt: "Shirt",
  pants: "Pants",
  shoes: "Shoes",
  accessories: "Accessories",
} as const;

export function AgentCollection({
  ownedByCategory,
  equipped,
}: {
  ownedByCategory: Record<string, AgentItem[]>;
  equipped: Equipped;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleEquip(item: AgentItem, isEquipped: boolean) {
    setLoading(item.id);
    const formData = new FormData();
    formData.set("agentItemId", isEquipped ? "" : item.id);
    formData.set("slot", item.category);
    const res = await equipAgentItem(formData);
    setLoading(null);
    if (!res?.error) router.refresh();
  }

  return (
    <section className="card space-y-4">
      <h2 className="text-lg font-semibold text-[var(--text)]">My Collection</h2>
      <div className="space-y-4">
        {(["headware", "shirt", "pants", "shoes", "accessories"] as const).map((cat) => {
          const list = ownedByCategory[cat] ?? [];
          if (list.length === 0) return null;

          return (
            <div key={cat}>
              <p className="mb-2 text-sm font-medium text-[var(--muted)]">{LABELS[cat]}</p>
              <div className="flex flex-wrap gap-2">
                {list.map((item) => {
                  const isEquipped = equipped[cat] === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleEquip(item, isEquipped)}
                      disabled={!!loading}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition hover:opacity-90 disabled:opacity-50 ${
                        isEquipped
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "border-[var(--border)] bg-white/5 text-[var(--text)] hover:border-[var(--accent)]/50"
                      }`}
                    >
                      {loading === item.id ? "…" : item.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
