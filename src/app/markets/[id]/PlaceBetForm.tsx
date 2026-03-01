"use client";

import { useState, useTransition, useMemo } from "react";
import { placeBet } from "@/app/actions/bets";
import { useRouter } from "next/navigation";
import { formatCoins } from "@/lib/coins";
import { computeAmmProbability } from "@/lib/probability";
import { CoinIcon } from "@/components/CoinIcon";

const QUICK_AMOUNTS = [100, 500, 1000];

export function PlaceBetForm({
  marketId,
  outcomes,
  currentProbability,
  userBalance,
  liquidity,
  totalVolume,
}: {
  marketId: string;
  outcomes: { id: string; label: string }[];
  currentProbability: number; // 1–99, probability of YES
  userBalance: number;
  liquidity: number;
  totalVolume: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const yesOutcome = outcomes.find((o) => o.label.toLowerCase().startsWith("yes")) ?? outcomes[0];
  const noOutcome = outcomes.find((o) => o.label.toLowerCase().startsWith("no")) ?? outcomes[1];

  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>(yesOutcome?.id ?? "");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const amountNum = parseInt(amount, 10) || 0;
  const validAmount = amountNum >= 1 && amountNum <= userBalance;

  const isYesSelected =
    outcomes.find((o) => o.id === selectedOutcomeId)?.label.toLowerCase().startsWith("yes") ??
    true;

  // Preview: compute new probability and shares if this bet were placed
  const preview = useMemo(() => {
    if (!validAmount) return null;
    const newYesProb = computeAmmProbability(currentProbability, amountNum, isYesSelected ? 1 : -1, liquidity, totalVolume);
    const entryProb = isYesSelected ? newYesProb : 100 - newYesProb;
    const shares = amountNum / entryProb;
    const maxWin = Math.floor(shares * 100);
    const multiplier = 100 / entryProb;
    return { newYesProb, entryProb, shares, maxWin, pnl: maxWin - amountNum, multiplier };
  }, [validAmount, amountNum, isYesSelected, currentProbability, liquidity, totalVolume]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const num = parseInt(amount, 10);
    if (!num || num < 1) { setError("Enter a valid amount"); return; }
    if (num > userBalance) { setError("Insufficient balance"); return; }
    if (!selectedOutcomeId) { setError("Select YES or NO"); return; }
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
    setAmount("");
    // Non-blocking refresh — page stays interactive while server data updates
    startTransition(() => { router.refresh(); });
  }

  const yesProb = currentProbability;
  const noProb = 100 - yesProb;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border-t border-[var(--border)] pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-[var(--muted)]">
          Balance:{" "}
          <span className="inline-flex items-center gap-1 font-mono text-[var(--coin)]">
            <CoinIcon size={13} />
            {userBalance.toLocaleString()}
          </span>
        </p>
      </div>

      {/* Side selector */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { outcome: yesOutcome, prob: yesProb, isYes: true },
          { outcome: noOutcome, prob: noProb, isYes: false },
        ].map(({ outcome, prob, isYes }) => {
          if (!outcome) return null;
          const isSelected = selectedOutcomeId === outcome.id;
          return (
            <button
              key={outcome.id}
              type="button"
              onClick={() => setSelectedOutcomeId(outcome.id)}
              className="flex flex-col items-center rounded-xl border-2 p-3 sm:p-4 text-center transition-all hover:opacity-90"
              style={{
                borderColor: isSelected
                  ? isYes
                    ? "#22c55e"
                    : "#f97316"
                  : "var(--border)",
                backgroundColor: isSelected
                  ? isYes
                    ? "rgba(34,197,94,0.1)"
                    : "rgba(249,115,22,0.1)"
                  : "rgba(255,255,255,0.03)",
              }}
            >
              <span
                className="text-xl font-extrabold"
                style={{ color: isYes ? "#22c55e" : "#f97316" }}
              >
                {prob.toFixed(1)}%
              </span>
              <span
                className="mt-0.5 text-xs font-semibold"
                style={{ color: isYes ? "rgba(34,197,94,0.6)" : "rgba(249,115,22,0.6)" }}
              >
                {(100 / prob).toFixed(2)}×
              </span>
              <span className="mt-1 text-sm font-semibold text-[var(--text)]">
                {isYes ? "YES" : "NO"}
              </span>
              <span className="mt-0.5 text-xs text-[var(--muted)]">
                {isSelected ? "Selected" : `Buy ${outcome.label}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Amount input */}
      <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-4 space-y-3">
        <label htmlFor="amount" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--muted)]">
          <CoinIcon size={13} /> to spend
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          {QUICK_AMOUNTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setAmount(String(Math.min(q, userBalance)))}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-mono text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)] transition"
            >
              {q}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAmount(String(userBalance))}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-mono text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)] transition"
          >
            MAX
          </button>
        </div>
        <input
          id="amount"
          type="number"
          min={1}
          max={userBalance}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 100"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />

        {/* Preview */}
        {preview && (
          <div className="space-y-1 text-sm border-t border-[var(--border)] pt-3">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Shares</span>
              <span className="font-mono text-[var(--text)]">{preview.shares.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Multiplier</span>
              <span
                className="font-mono font-bold"
                style={{ color: isYesSelected ? "#22c55e" : "#f97316" }}
              >
                {preview.multiplier.toFixed(2)}×
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Max payout</span>
              <span className="inline-flex items-center gap-1 font-mono text-[var(--accent)]">
                <CoinIcon size={13} />
                {preview.maxWin.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Profit if {isYesSelected ? "YES" : "NO"}</span>
              <span
                className="inline-flex items-center gap-1 font-mono"
                style={{ color: preview.pnl >= 0 ? "#22c55e" : "#f97316" }}
              >
                {preview.pnl >= 0 ? "+" : ""}
                <CoinIcon size={13} />{preview.pnl.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--muted)]">Price impact</span>
              <span className="font-mono text-[var(--muted)]">
                {currentProbability.toFixed(1)}% → {preview.newYesProb.toFixed(1)}% YES{" "}
                <span
                  style={{
                    color:
                      preview.newYesProb > currentProbability ? "#22c55e" : "#f97316",
                  }}
                >
                  ({preview.newYesProb > currentProbability ? "+" : ""}
                  {(preview.newYesProb - currentProbability).toFixed(1)}pp)
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading || isPending || !selectedOutcomeId || !validAmount}
        className="btn-primary w-full sm:w-auto"
      >
        {loading ? "Placing…" : isPending ? "Updating…" : validAmount ? (
          <span className="inline-flex items-center gap-1.5">
            Buy {isYesSelected ? "YES" : "NO"} · <CoinIcon size={14} /> {amountNum.toLocaleString()}
          </span>
        ) : "Place bet"}
      </button>
    </form>
  );
}
