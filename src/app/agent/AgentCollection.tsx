"use client";

import { useState } from "react";
import { equipAgentItem } from "@/app/actions/agent";
import { useRouter } from "next/navigation";
import { AVATAR_CATEGORIES, CATEGORY_LABELS, type AvatarCategory, type AvatarEquipped } from "@/lib/avatar";
import { Avatar } from "@/components/Avatar";

type AgentItem = {
  id:       string;
  category: string;
  name:     string;
  icon:     string | null;
};

export function AgentCollection({
  ownedByCategory,
  equipped,
}: {
  ownedByCategory: Record<string, AgentItem[]>;
  equipped:        AvatarEquipped;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [preview, setPreview] = useState<AvatarEquipped>(equipped);

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

      <div className="flex gap-6">
        {/* Live preview — hover an item to see it on the avatar */}
        <div className="hidden sm:block shrink-0">
          <Avatar equipped={preview} size="lg" />
        </div>

        <div className="flex-1 space-y-4 min-w-0">
          {AVATAR_CATEGORIES.map((cat) => {
            const list = ownedByCategory[cat] ?? [];
            if (list.length === 0) return null;

            return (
              <div key={cat}>
                <p className="mb-2 text-sm font-medium text-[var(--muted)]">{CATEGORY_LABELS[cat]}</p>
                <div className="flex flex-wrap gap-2">
                  {list.map((item) => {
                    const isEquipped = equipped[cat as AvatarCategory] === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleEquip(item, isEquipped)}
                        onMouseEnter={() =>
                          setPreview((p) => ({ ...p, [cat]: item.icon ?? null }))
                        }
                        onMouseLeave={() =>
                          setPreview((p) => ({ ...p, [cat]: equipped[cat as AvatarCategory] ?? null }))
                        }
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
      </div>
    </section>
  );
}
