"use client";

import { useState } from "react";
import { equipAgentItem } from "@/app/actions/agent";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS, type AvatarCategory } from "@/lib/avatar";

// Hair removed from display
const VISIBLE_CATEGORIES: AvatarCategory[] = [
  "skin", "eyes", "mouth", "top", "bottom", "shoes",
  "hat", "accessory_front", "accessory_back",
];

type AgentItem = {
  id:       string;
  category: string;
  name:     string;
  icon:     string | null;
};

export function AgentCollection({
  ownedByCategory,
  equippedItemIds,
}: {
  ownedByCategory:  Record<string, AgentItem[]>;
  equippedItemIds:  Partial<Record<AvatarCategory, string | null>>;
}) {
  const router  = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  // Default to first visible category that has owned items
  const firstCatWithItems =
    VISIBLE_CATEGORIES.find((cat) => (ownedByCategory[cat] ?? []).length > 0) ??
    VISIBLE_CATEGORIES[0];
  const [activeCategory, setActiveCategory] = useState<AvatarCategory>(firstCatWithItems);

  const items = ownedByCategory[activeCategory] ?? [];

  async function handleEquip(item: AgentItem, isEquipped: boolean) {
    setLoading(item.id);
    const fd = new FormData();
    fd.set("agentItemId", isEquipped ? "" : item.id);
    fd.set("slot", item.category);
    const res = await equipAgentItem(fd);
    setLoading(null);
    if (!res?.error) router.refresh();
  }

  return (
    <section className="card space-y-4">
      <h2 className="text-lg font-semibold text-[var(--text)]">My Collection</h2>

      {/* Category filter tabs — only show tabs with owned items */}
      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-3">
        {VISIBLE_CATEGORIES.map((cat) => {
          const count = (ownedByCategory[cat] ?? []).length;
          if (count === 0) return null;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                activeCategory === cat
                  ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                  : "bg-white/5 text-[var(--muted)] hover:bg-white/10 hover:text-[var(--text)]"
              }`}
            >
              {CATEGORY_LABELS[cat]}
              <span className="ml-1.5 opacity-50 text-xs">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Item grid */}
      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--muted)]">
          Nothing owned in this category yet.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {items.map((item) => {
            const isEquipped = equippedItemIds[activeCategory] === item.id;
            const busy       = loading === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={busy}
                onClick={() => handleEquip(item, isEquipped)}
                className={`group overflow-hidden rounded-xl border transition disabled:opacity-60 ${
                  isEquipped
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border)] bg-white/[0.02] hover:border-[var(--accent)]/40"
                }`}
              >
                {/* Image area */}
                <div className="relative aspect-[4/7] overflow-hidden bg-[var(--bg)]">
                  {item.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.icon}
                      alt={item.name}
                      className="absolute inset-0 h-full w-full object-contain"
                      draggable={false}
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center p-2 text-[10px] leading-tight text-[var(--muted)]">
                      {item.name}
                    </span>
                  )}

                  {/* Equipped badge */}
                  {isEquipped && (
                    <div className="absolute inset-x-0 bottom-0 bg-[var(--accent)] py-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-white">
                      {busy ? "…" : "✓ Equipped"}
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="px-2 py-1.5 text-center">
                  <p className="truncate text-xs font-medium text-[var(--text)]">{item.name}</p>
                  <p className="text-[10px] text-[var(--muted)]">
                    {busy ? "…" : isEquipped ? "Tap to unequip" : "Tap to equip"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
