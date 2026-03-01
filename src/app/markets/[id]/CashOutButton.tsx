"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cashOut } from "@/app/actions/bets";

export function CashOutButton({
  betId,
  payout,
  onSuccess,
}: {
  betId: string;
  payout: number;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  async function handleCashOut() {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    setLoading(true);
    setError("");
    const formData = new FormData();
    formData.set("betId", betId);
    const result = await cashOut(formData);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      setConfirmed(false);
      return;
    }
    window.dispatchEvent(new CustomEvent("balance-updated"));
    onSuccess?.();
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleCashOut}
        disabled={loading}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
          confirmed
            ? "bg-orange-500 text-white hover:bg-orange-600"
            : "border border-[var(--border)] text-[var(--muted)] hover:border-orange-400 hover:text-orange-400"
        }`}
      >
        {loading ? "Cashing out…" : confirmed ? `Confirm · ${payout} coins` : "Cash Out"}
      </button>
      {confirmed && !loading && (
        <button
          onClick={() => setConfirmed(false)}
          className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
        >
          Cancel
        </button>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
