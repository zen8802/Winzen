"use client";

import { useState } from "react";
import { purchaseAgentItem, equipAgentItem } from "@/app/actions/agent";
import { CoinIcon } from "@/components/CoinIcon";
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
  price:    number;
  icon:     string | null;
  order:    number;
};

export function AgentShop({
  items,
  ownedIds,
  equippedItemIds,
}: {
  items:           AgentItem[];
  ownedIds:        Set<string>;
  equippedItemIds: Partial<Record<AvatarCategory, string | null>>;
}) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<AvatarCategory>(VISIBLE_CATEGORIES[0]);
  const [loading, setLoading]               = useState<string | null>(null);
  const [error, setError]                   = useState("");

  const filteredItems = items.filter(
    (i) => i.category === activeCategory && VISIBLE_CATEGORIES.includes(i.category as AvatarCategory),
  );

  async function handlePurchase(itemId: string) {
    setError("");
    setLoading(itemId);
    const fd = new FormData();
    fd.set("agentItemId", itemId);
    const res = await purchaseAgentItem(fd);
    setLoading(null);
    if (res?.error) { setError(res.error); return; }
    window.dispatchEvent(new CustomEvent("balance-updated"));
    router.refresh();
  }

  async function handleEquip(itemId: string | null) {
    setError("");
    setLoading(itemId ?? "unequip");
    const fd = new FormData();
    fd.set("agentItemId", itemId ?? "");
    fd.set("slot", activeCategory);
    const res = await equipAgentItem(fd);
    setLoading(null);
    if (res?.error) { setError(res.error); return; }
    router.refresh();
  }

  return (
    <>
      {/* Category tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {VISIBLE_CATEGORIES.map((cat) => (
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
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      {/* Item grid */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {filteredItems.map((item) => {
          const owned      = ownedIds.has(item.id);
          const isEquipped = equippedItemIds[activeCategory] === item.id;
          const busy       = loading === item.id || (loading === "unequip" && isEquipped);

          return (
            <div
              key={item.id}
              className={`overflow-hidden rounded-xl border transition ${
                isEquipped
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] bg-white/[0.02]"
              }`}
            >
              {/* Item image preview */}
              <div className="relative aspect-[4/7] overflow-hidden bg-[var(--bg)]">
                {item.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.icon}
                    alt={item.name}
                    className={`absolute inset-0 h-full w-full object-contain transition ${
                      owned ? "brightness-50" : ""
                    }`}
                    draggable={false}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--muted)]">
                    No preview
                  </div>
                )}

                {/* ALREADY OWNED overlay */}
                {owned && (
                  <div className="absolute inset-0 flex items-end justify-center pb-3">
                    <span className="rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/90">
                      Already Owned
                    </span>
                  </div>
                )}

                {/* EQUIPPED badge */}
                {isEquipped && (
                  <div className="absolute inset-x-0 bottom-0 bg-[var(--accent)] py-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-white">
                    ✓ Equipped
                  </div>
                )}
              </div>

              {/* Info + action */}
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-sm font-medium text-[var(--text)]">{item.name}</span>
                  {!owned && (
                    <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs text-[var(--coin)]">
                      <CoinIcon size={12} />
                      {item.price.toLocaleString()}
                    </span>
                  )}
                </div>

                {!owned ? (
                  <button
                    type="button"
                    onClick={() => handlePurchase(item.id)}
                    disabled={!!loading}
                    className="btn-primary w-full text-xs py-1.5"
                  >
                    {busy ? "Buying…" : `Buy · ${item.price.toLocaleString()}`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleEquip(isEquipped ? null : item.id)}
                    disabled={!!loading}
                    className={`w-full rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      isEquipped
                        ? "border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10"
                        : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
                    }`}
                  >
                    {busy ? "…" : isEquipped ? "Unequip" : "Equip"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <p className="py-12 text-center text-sm text-[var(--muted)]">
          No items in this category yet.
        </p>
      )}
    </>
  );
}
