"use client";

import { useState } from "react";
import { equipAgentItem } from "@/app/actions/agent";
import { useRouter } from "next/navigation";
import { type AvatarCategory } from "@/lib/avatar";

const GRAD     = "linear-gradient(135deg, #f472b6 0%, #a78bfa 100%)";
const GRAD_DIM = "linear-gradient(135deg, rgba(244,114,182,0.12) 0%, rgba(167,139,250,0.12) 100%)";

const VISIBLE_CATEGORIES: AvatarCategory[] = ["hat", "top", "bottom", "shoes", "accessory_front"];

const CATEGORY_LABEL: Record<string, string> = {
  hat:             "Hat",
  top:             "Top",
  bottom:          "Bottom",
  shoes:           "Shoes",
  accessory_front: "Accessories",
};

function CategoryIcon({ category }: { category: string }) {
  const cls = "h-5 w-5";
  const shared = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (category === "hat") return (
    <svg viewBox="0 0 24 24" className={cls} {...shared}>
      <path d="M4 14C4 9 7.8 6 12 6s8 3 8 8" />
      <path d="M4 14h16" />
      <path d="M4 14v2.5A1.5 1.5 0 005.5 18h13a1.5 1.5 0 001.5-1.5V14" />
      <path d="M20 16h2" />
    </svg>
  );

  if (category === "top") return (
    <svg viewBox="0 0 24 24" className={cls} {...shared}>
      <path d="M3 8l4-3c1 2 2.5 3 5 3s4-1 5-3l4 3-2 3-2-1v10H7V10L5 11 3 8z" />
    </svg>
  );

  if (category === "bottom") return (
    <svg viewBox="0 0 24 24" className={cls} {...shared}>
      <path d="M4 5h16v5l-4 10h-3l-1-7-1 7H8L4 10V5z" />
    </svg>
  );

  if (category === "shoes") return (
    <svg viewBox="0 0 24 24" className={cls} {...shared}>
      <path d="M3 13c0-1 .5-3 2-3l4 1 4-2 3-1c2 0 5 1.5 5 4v1H3v-1z" />
      <path d="M3 16h18v1.5a.5.5 0 01-.5.5H3.5a.5.5 0 01-.5-.5V16z" />
    </svg>
  );

  // accessory_front → gem/jewelry
  return (
    <svg viewBox="0 0 24 24" className={cls} {...shared}>
      <path d="M6 9l6 12 6-12" />
      <path d="M6 9l3-5h6l3 5" />
      <path d="M6 9h12" />
      <path d="M9 4l3 5 3-4" />
    </svg>
  );
}

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
  const [activeCategory, setActiveCategory] = useState<AvatarCategory>(VISIBLE_CATEGORIES[0]);
  const [loading, setLoading] = useState<string | null>(null);

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

      {/* Category icon tabs — always show all 5 */}
      <div className="flex gap-1 border-b border-[var(--border)] pb-3">
        {VISIBLE_CATEGORIES.map((cat) => {
          const active = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              title={CATEGORY_LABEL[cat]}
              style={active ? { background: GRAD_DIM } : undefined}
              className={`rounded-xl p-2.5 transition ${
                active
                  ? "text-pink-400 border border-pink-400/30"
                  : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]"
              }`}
            >
              <CategoryIcon category={cat} />
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
                style={isEquipped
                  ? { borderColor: "#f472b6", background: GRAD_DIM }
                  : undefined}
                className={`group overflow-hidden rounded-xl border transition disabled:opacity-60 ${
                  isEquipped
                    ? "border"
                    : "border-[var(--border)] bg-white/[0.02] hover:border-pink-400/30"
                }`}
              >
                {/* Image area */}
                <div className="relative aspect-square overflow-hidden bg-[var(--bg)]">
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
                    <div
                      style={{ background: GRAD }}
                      className="absolute inset-x-0 bottom-0 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-white"
                    >
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
