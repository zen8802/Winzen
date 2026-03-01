"use client";

import { useState, useEffect } from "react";
import { getMarketStatus, formatTimeLeft } from "@/lib/market-status";

/**
 * Live-updating status badge + countdown for the market detail page.
 * Updates every second; stops ticking once market closes or is resolved.
 */
export function CountdownTimer({
  closesAt,
  resolved,
}: {
  closesAt: string;
  resolved: boolean;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    if (resolved) return;
    const closeTs = new Date(closesAt).getTime();
    if (Date.now() >= closeTs) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [closesAt, resolved]);

  const closeTs = new Date(closesAt).getTime();
  const ms = now !== null ? closeTs - now : null;
  const status = resolved ? "RESOLVED" : getMarketStatus(closesAt, resolved ? "resolved" : null);

  if (status === "RESOLVED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold text-fuchsia-400">
        ✓ Resolved
      </span>
    );
  }

  if (ms !== null && ms <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
        Closed · Awaiting resolution
      </span>
    );
  }

  if (status === "RESOLVING_SOON") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
        ⚡ Resolves in {ms !== null ? formatTimeLeft(ms) : "…"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-400">
      Active · {ms !== null ? formatTimeLeft(ms) : "…"}
    </span>
  );
}
