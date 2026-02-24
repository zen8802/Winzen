"use client";

import { useState, useTransition } from "react";
import { resolveMarket } from "@/app/actions/markets";
import { useRouter } from "next/navigation";

type Props = {
  marketId: string;
  marketTitle: string;
  outcomeId: string;
  outcomeLabel: string;
};

export function AdminResolveButton({ marketId, marketTitle, outcomeId, outcomeLabel }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const isYes = outcomeLabel.toLowerCase().startsWith("yes");
  const color = isYes ? "#22c55e" : "#f97316";

  async function handleResolve() {
    setError("");
    const fd = new FormData();
    fd.set("marketId", marketId);
    fd.set("outcomeId", outcomeId);
    const result = await resolveMarket(fd);
    if (result?.error) {
      setError(typeof result.error === "string" ? result.error : "Failed to resolve");
      setConfirming(false);
      return;
    }
    console.log(`[ADMIN] Resolved market "${marketTitle}" → ${outcomeLabel}`);
    window.dispatchEvent(new CustomEvent("balance-updated"));
    setConfirming(false);
    startTransition(() => { router.refresh(); });
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <span className="text-xs text-[var(--muted)]">
          Resolve as <strong style={{ color }}>{outcomeLabel}</strong>? This cannot be undone.
        </span>
        <button
          onClick={handleResolve}
          disabled={isPending}
          className="rounded-md px-3 py-1 text-xs font-bold text-white transition hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: color }}
        >
          {isPending ? "Resolving…" : "Confirm"}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(""); }}
          disabled={isPending}
          className="rounded-md px-3 py-1 text-xs text-[var(--muted)] transition hover:text-[var(--text)]"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-lg border px-3 py-1.5 text-sm font-semibold transition hover:opacity-80"
      style={{ borderColor: color, color }}
    >
      Resolve {outcomeLabel}
    </button>
  );
}
