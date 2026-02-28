"use client";

import { useState } from "react";
import { purchaseAgentItem, equipAgentItem } from "@/app/actions/agent";
import { CoinIcon } from "@/components/CoinIcon";
import { useRouter } from "next/navigation";
import { type AvatarCategory } from "@/lib/avatar";

const GRAD     = "linear-gradient(135deg, #f472b6 0%, #a78bfa 100%)";
const GRAD_DIM = "linear-gradient(135deg, rgba(244,114,182,0.12) 0%, rgba(167,139,250,0.12) 100%)";

const CATEGORY_IMG_TRANSFORM: Record<string, string> = {
  hat:             "scale(2.5)",
  bottom:          "scale(3.0)",
  shoes:           "scale(3.0)",
  accessory_front: "scale(1.4)",
};

const CATEGORY_IMG_ORIGIN: Record<string, string> = {
  hat:             "center 15%",
  bottom:          "center 90%",
  shoes:           "center 97%",
  accessory_front: "center center",
};

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
  price:    number;
  icon:     string | null;
  tags:     string;
  order:    number;
};

export function AgentShop({
  items,
  ownedIds,
  equippedItemIds,
  userLevel,
}: {
  items:           AgentItem[];
  ownedIds:        Set<string>;
  equippedItemIds: Partial<Record<AvatarCategory, string | null>>;
  userLevel:       number;
}) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<AvatarCategory>(VISIBLE_CATEGORIES[0]);
  const [loading, setLoading]               = useState<string | null>(null);
  const [error, setError]                   = useState("");
  const [query, setQuery]                   = useState("");

  const isLocked = activeCategory === "accessory_front" && userLevel < 5;

  function switchCategory(cat: AvatarCategory) {
    setActiveCategory(cat);
    setQuery("");
  }

  const q = query.trim().toLowerCase();
  const filteredItems = items.filter((i) => {
    if (i.category !== activeCategory) return false;
    if (!q) return true;
    if (i.name.toLowerCase().includes(q)) return true;
    return (i.tags ?? "").split(",").some((t) => t.trim().toLowerCase().includes(q));
  });

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
      {/* Category icon tabs */}
      <div className="mb-4 flex border-b border-[var(--border)] pb-3">
        {VISIBLE_CATEGORIES.map((cat) => {
          const active = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => switchCategory(cat)}
              title={CATEGORY_LABEL[cat]}
              style={active ? { background: GRAD_DIM } : undefined}
              className={`flex flex-1 justify-center rounded-xl p-2.5 transition ${
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

      {/* Lock gate for accessories */}
      {isLocked ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg className="mb-3 h-10 w-10 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V7a4.5 4.5 0 10-9 0v3.5M5 10.5h14a1 1 0 011 1V20a1 1 0 01-1 1H5a1 1 0 01-1-1v-8.5a1 1 0 011-1z" />
          </svg>
          <p className="font-semibold text-[var(--text)]">Opens after Level 5</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Keep trading to level up!</p>
        </div>
      ) : (
      <>
      {/* Search */}
      <div className="relative mb-4">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${CATEGORY_LABEL[activeCategory]}…`}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-3 text-sm text-[var(--text)] placeholder-[var(--muted)] outline-none focus:border-pink-400/50"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
          >
            ✕
          </button>
        )}
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
              style={isEquipped ? { borderColor: "#f472b6", background: GRAD_DIM } : undefined}
              className={`overflow-hidden rounded-xl border transition ${
                isEquipped ? "border" : "border-[var(--border)] bg-white/[0.02]"
              }`}
            >
              {/* Item image */}
              <div className="relative aspect-square overflow-hidden bg-[var(--bg)]">
                {item.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.icon}
                    alt={item.name}
                    style={{ transform: CATEGORY_IMG_TRANSFORM[item.category], transformOrigin: CATEGORY_IMG_ORIGIN[item.category] }}
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
                  <div
                    style={{ background: GRAD }}
                    className="absolute inset-x-0 bottom-0 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-white"
                  >
                    ✓ Equipped
                  </div>
                )}
              </div>

              {/* Info + action */}
              <div className="space-y-2 p-3">
                <div>
                  <p className="truncate text-sm font-medium text-[var(--text)]">{item.name}</p>
                  {!owned && (
                    <p className="inline-flex items-center gap-1 font-mono text-xs text-[var(--coin)]">
                      <CoinIcon size={12} />
                      {item.price.toLocaleString()}
                    </p>
                  )}
                </div>

                {!owned ? (
                  <button
                    type="button"
                    onClick={() => handlePurchase(item.id)}
                    disabled={!!loading}
                    className="btn-gradient w-full text-xs py-1.5"
                  >
                    {busy ? "Buying…" : "Buy"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleEquip(isEquipped ? null : item.id)}
                    disabled={!!loading}
                    style={isEquipped ? { background: GRAD } : undefined}
                    className={`w-full rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      isEquipped
                        ? "border-transparent text-white"
                        : "border-[var(--border)] text-[var(--muted)] hover:border-pink-400/40 hover:text-[var(--text)]"
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
          {q ? `No items match "${query}".` : "No items in this category yet."}
        </p>
      )}
      </>
      )}
    </>
  );
}
