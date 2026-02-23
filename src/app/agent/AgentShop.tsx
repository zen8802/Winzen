"use client";

import { useState } from "react";
import { setAgentGender, purchaseAgentItem, equipAgentItem } from "@/app/actions/agent";
import { formatCoins } from "@/lib/coins";
import { useRouter } from "next/navigation";

type AgentItem = {
  id: string;
  category: string;
  name: string;
  price: number;
  gender: string;
  order: number;
};

type Category = { id: string; label: string };

type Equipped = {
  headware: string | null;
  shirt: string | null;
  pants: string | null;
  shoes: string | null;
  accessories: string | null;
};

export function AgentShop({
  categories,
  items,
  ownedIds,
  equipped,
  needsGender,
}: {
  categories: readonly Category[];
  items: AgentItem[];
  ownedIds: Set<string>;
  equipped: Equipped;
  needsGender: boolean;
}) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "headware");
  const [genderModal, setGenderModal] = useState(needsGender);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filteredItems = items.filter((i) => i.category === activeCategory);
  const equippedId = equipped[activeCategory as keyof Equipped] ?? null;

  async function handleSetGender(g: "male" | "female") {
    setError("");
    const formData = new FormData();
    formData.set("gender", g);
    const res = await setAgentGender(formData);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setGenderModal(false);
    router.refresh();
  }

  async function handlePurchase(itemId: string) {
    setError("");
    setLoading(itemId);
    const formData = new FormData();
    formData.set("agentItemId", itemId);
    const res = await purchaseAgentItem(formData);
    setLoading(null);
    if (res?.error) {
      setError(res.error);
      return;
    }
    window.dispatchEvent(new CustomEvent("balance-updated"));
    router.refresh();
  }

  async function handleEquip(itemId: string | null) {
    setError("");
    setLoading(itemId ?? "unequip");
    const formData = new FormData();
    formData.set("agentItemId", itemId ?? "");
    formData.set("slot", activeCategory);
    const res = await equipAgentItem(formData);
    setLoading(null);
    if (res?.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <>
      {genderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card mx-4 max-w-md space-y-4">
            <h2 className="text-xl font-semibold text-[var(--text)]">
              Choose your gender
            </h2>
            <p className="text-sm text-[var(--muted)]">
              This helps us show the right mannequin and item fits.
            </p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => handleSetGender("male")}
                className="btn-primary flex-1"
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => handleSetGender("female")}
                className="btn-primary flex-1"
              >
                Female
              </button>
            </div>
            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-4">
          <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategory(c.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                activeCategory === c.id
                  ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                  : "bg-white/5 text-[var(--muted)] hover:bg-white/10 hover:text-[var(--text)]"
              }`}
            >
              {c.label}
            </button>
          ))}
          </div>
          {!needsGender && (
            <button
              type="button"
              onClick={() => setGenderModal(true)}
              className="btn-ghost text-xs"
            >
              Change gender
            </button>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const owned = ownedIds.has(item.id);
            const isEquipped = equippedId === item.id;

            return (
              <div
                key={item.id}
                className={`rounded-xl border p-4 ${
                  isEquipped
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border)] bg-white/[0.02]"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-[var(--text)]">{item.name}</span>
                  <span className="font-mono text-sm text-[var(--coin)]">
                    {formatCoins(item.price)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!owned ? (
                    <button
                      type="button"
                      onClick={() => handlePurchase(item.id)}
                      disabled={!!loading}
                      className="btn-primary text-sm"
                    >
                      {loading === item.id ? "Buying…" : "Buy"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleEquip(isEquipped ? null : item.id)}
                      disabled={!!loading}
                      className={`text-sm ${
                        isEquipped
                          ? "text-[var(--accent)]"
                          : "btn-ghost text-sm"
                      }`}
                    >
                      {loading === item.id || loading === "unequip"
                        ? "..."
                        : isEquipped
                          ? "Equipped"
                          : "Equip"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <p className="py-8 text-center text-[var(--muted)]">
            No items in this category.
          </p>
        )}
      </div>
    </>
  );
}
