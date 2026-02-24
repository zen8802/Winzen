export type MarketStatus = "ACTIVE" | "RESOLVING_SOON" | "CLOSED" | "RESOLVED";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * Compute a market's status from its close date and resolution state.
 * Pure function — safe to call on server or client.
 */
export function getMarketStatus(
  closesAt: Date | string,
  resolvedOutcomeId: string | null | undefined,
): MarketStatus {
  if (resolvedOutcomeId) return "RESOLVED";
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return "CLOSED";
  if (ms < SIX_HOURS_MS) return "RESOLVING_SOON";
  return "ACTIVE";
}

export function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "Closing...";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}
