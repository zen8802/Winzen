"use client";

import { useState } from "react";
import { resolveMarket } from "@/app/actions/markets";
import { getOutcomeColors } from "@/lib/outcome-colors";
import { useRouter } from "next/navigation";

type Outcome = { id: string; label: string };

export function ResolveForm({ marketId, outcomes }: { marketId: string; outcomes: Outcome[] }) {
  const router = useRouter();
  const [outcomeId, setOutcomeId] = useState(outcomes[0]?.id ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData();
    formData.set("marketId", marketId);
    formData.set("outcomeId", outcomeId);
    const result = await resolveMarket(formData);
    setLoading(false);
    if (result?.error) {
      setError(typeof result.error === "string" ? result.error : "Failed to resolve");
      return;
    }
    window.dispatchEvent(new CustomEvent("balance-updated"));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border-t border-[var(--border)] pt-4">
      <p className="text-sm font-medium text-[var(--accent)]">Resolve market (creator only)</p>
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
      <div>
        <label className="mb-2 block text-sm text-[var(--muted)]">Winning outcome</label>
        <div className="flex flex-wrap gap-2">
          {outcomes.map((o, i) => {
            const c = getOutcomeColors(i);
            return (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition"
                style={{
                  borderColor: outcomeId === o.id ? c.border : "var(--border)",
                  backgroundColor: outcomeId === o.id ? c.bg : "rgba(255,255,255,0.03)",
                }}
              >
                <input
                  type="radio"
                  name="resolveOutcome"
                  value={o.id}
                  checked={outcomeId === o.id}
                  onChange={() => setOutcomeId(o.id)}
                  className="rounded border-[var(--border)] bg-[var(--surface)] focus:ring-2"
                  style={{ accentColor: c.border }}
                />
                <span style={{ color: outcomeId === o.id ? c.text : "var(--text)" }}>{o.label}</span>
              </label>
            );
          })}
        </div>
      </div>
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Resolving…" : "Resolve market"}
      </button>
    </form>
  );
}
