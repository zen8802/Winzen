"use client";

import { useState } from "react";
import { purchaseAgentItem, equipAgentItem } from "@/app/actions/agent";
import { CoinIcon } from "@/components/CoinIcon";
import { useRouter } from "next/navigation";
import { AVATAR_CATEGORIES, CATEGORY_LABELS, type AvatarEquipped } from "@/lib/avatar";

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
  equipped,
}: {
  items:    AgentItem[];
  ownedIds: Set<string>;
  equipped: AvatarEquipped;
}) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string>(AVATAR_CATEGORIES[0]);
  const [loading, setLoading]               = useState<string | null>(null);
  const [error, setError]                   = useState("");

  const filteredItems = items.filter((i) => i.category === activeCategory);
  const equippedId    = equipped[activeCategory as keyof AvatarEquipped] ?? null;

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
      <div className="card space-y-4">
        {/* Category tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-4">
          <div className="flex flex-wrap gap-2">
            {AVATAR_CATEGORIES.map((cat) => (
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
        </div>

        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

        {/* Item grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const owned      = ownedIds.has(item.id);
            const isEquipped = equippedId === item.id;

            return (
              <div
                key={item.id}
                className={`rounded-xl border p-4 space-y-3 ${
                  isEquipped
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border)] bg-white/[0.02]"
                }`}
              >
                {/* Item preview image */}
                {item.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.icon}
                    alt={item.name}
                    className="mx-auto h-20 w-auto object-contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                )}

                <div className="flex items-center justify-between">
                  <span className="font-medium text-[var(--text)]">{item.name}</span>
                  {!owned && (
                    <span className="inline-flex items-center gap-1 font-mono text-sm text-[var(--coin)]">
                      <CoinIcon size={13} />
                      {item.price.toLocaleString()}
                    </span>
                  )}
                </div>

                <div>
                  {!owned ? (
                    <button
                      type="button"
                      onClick={() => handlePurchase(item.id)}
                      disabled={!!loading}
                      className="btn-primary w-full text-sm"
                    >
                      {loading === item.id ? "Buying…" : `Buy · ${item.price.toLocaleString()}`}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleEquip(isEquipped ? null : item.id)}
                      disabled={!!loading}
                      className={`w-full rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                        isEquipped
                          ? "border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10"
                          : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
                      }`}
                    >
                      {loading === item.id || (loading === "unequip" && isEquipped)
                        ? "…"
                        : isEquipped
                          ? "✓ Equipped"
                          : "Equip"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--muted)]">
            No items in this category yet.
          </p>
        )}
      </div>
    </>
  );
}
