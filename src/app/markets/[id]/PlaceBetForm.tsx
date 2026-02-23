"use client";

import { useState } from "react";
import { placeBet } from "@/app/actions/bets";
import { useRouter } from "next/navigation";
import { formatCoins } from "@/lib/coins";
import { getOutcomeColors } from "@/lib/outcome-colors";

type OutcomeShare = { id: string; label: string; amount: number; pct: number };

export function PlaceBetForm({
  marketId,
  outcomes,
  outcomeShares,
  totalPool,
  userBalance,
  existingOutcomeId,
}: {
  marketId: string;
  outcomes: { id: string; label: string }[];
  outcomeShares: OutcomeShare[];
  totalPool: number;
  userBalance: number;
  existingOutcomeId?: string | null;
}) {
  const router = useRouter();
  const lockedOutcome = existingOutcomeId ?? null;
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>(
    lockedOutcome ?? outcomes[0]?.id ?? ""
  );
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedShare = outcomeShares.find((o) => o.id === selectedOutcomeId);
  const amountNum = parseInt(amount, 10) || 0;
  const validAmount = amountNum >= 1 && amountNum <= userBalance;
  // Parimutuel: if this outcome wins, you get amount * (totalPool + amount) / (outcomePool + amount)
  const potentialPayout =
    validAmount && selectedShare
      ? Math.round((amountNum * (totalPool + amountNum)) / (selectedShare.amount + amountNum))
      : 0;
  const potentialPct =
    validAmount && selectedShare && totalPool + amountNum > 0
      ? Math.round((100 * (selectedShare.amount + amountNum)) / (totalPool + amountNum))
      : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const num = parseInt(amount, 10);
    if (!num || num < 1) {
      setError("Enter a valid amount");
      return;
    }
    if (num > userBalance) {
      setError("Insufficient balance");
      return;
    }
    if (!selectedOutcomeId) {
      setError("Select an outcome");
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.set("marketId", marketId);
    formData.set("outcomeId", selectedOutcomeId);
    formData.set("amount", String(num));
    const result = await placeBet(formData);
    setLoading(false);
    if (result?.error) {
      setError(typeof result.error === "string" ? result.error : "Failed to place bet");
      return;
    }
    window.dispatchEvent(new CustomEvent("balance-updated"));
    router.refresh();
    setAmount("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border-t border-[var(--border)] pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-[var(--muted)]">
          Your balance: <span className="font-mono text-[var(--coin)]">{formatCoins(userBalance)}</span>
        </p>
        <p className="text-xs text-[var(--muted)]">
          Total pool: <span className="font-mono text-[var(--text)]">{formatCoins(totalPool)}</span>
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--muted)]">
          {lockedOutcome ? "Add to your position" : "Pick an outcome (one side only)"}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {outcomeShares.map((o, i) => {
            const c = getOutcomeColors(i);
            const isSelected = selectedOutcomeId === o.id;
            const isLocked = !!lockedOutcome;
            const isDisabled = isLocked && o.id !== lockedOutcome;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => !isDisabled && setSelectedOutcomeId(o.id)}
                disabled={isDisabled}
                className="flex flex-col items-start rounded-xl border-2 p-3 text-left transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  borderColor: isSelected ? c.border : "var(--border)",
                  backgroundColor: isSelected ? c.bg : "rgba(255,255,255,0.03)",
                }}
              >
                <span className="font-medium text-[var(--text)]">{o.label}</span>
                <span className="mt-1 font-mono text-xs" style={{ color: c.text }}>
                  {o.pct}% · {o.amount} coins
                </span>
                {isDisabled && (
                  <span className="mt-1 text-xs text-[var(--muted)]">Already bet on other side</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-4">
        <label htmlFor="amount" className="mb-2 block text-sm font-medium text-[var(--muted)]">
          Amount to bet (coins)
        </label>
        <input
          id="amount"
          type="number"
          min={1}
          max={userBalance}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 50"
          className="mb-3 w-full max-w-[200px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />
        {validAmount && selectedShare && (
          <div className="space-y-1 text-sm">
            <p className="text-[var(--muted)]">
              If <span className="font-medium text-[var(--text)]">{selectedShare.label}</span> wins:
            </p>
            <p className="font-mono text-[var(--accent)]">
              Potential payout: ~{formatCoins(potentialPayout)} ({potentialPct}% of pool)
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading || !selectedOutcomeId || !validAmount}
        className="btn-primary w-full sm:w-auto"
      >
        {loading ? "Placing…" : "Place bet"}
      </button>
    </form>
  );
}
