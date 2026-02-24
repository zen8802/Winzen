// Server-safe static badge — no client hooks.
// Computed once at server render time; correct on page load.
// For a live-updating countdown on the market detail page, use CountdownTimer instead.
import { getMarketStatus } from "@/lib/market-status";

export function MarketStatusBadge({
  closesAt,
  resolvedOutcomeId,
}: {
  closesAt: Date | string;
  resolvedOutcomeId?: string | null;
}) {
  const status = getMarketStatus(closesAt, resolvedOutcomeId);

  if (status === "RESOLVED") {
    return (
      <span className="inline-flex items-center rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-0.5 text-xs font-semibold text-fuchsia-400">
        ✓ Resolved
      </span>
    );
  }

  if (status === "CLOSED") {
    return (
      <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)]">
        Awaiting resolution
      </span>
    );
  }

  if (status === "RESOLVING_SOON") {
    return (
      <span className="inline-flex items-center rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-xs font-semibold text-yellow-400">
        ⚡ Resolving soon
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-400">
      Active
    </span>
  );
}
