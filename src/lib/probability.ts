/**
 * Compute clamped parimutuel probabilities for all outcomes.
 * Returns a map from outcomeId → probability as float 0.01–0.99.
 * When there are no bets yet (empty map), distributes equally across all outcomes.
 */
export function computeProbabilities(
  outcomes: { id: string }[],
  betsByOutcome: Map<string, number>, // outcomeId → total coins staked
): Map<string, number> {
  const n = outcomes.length;
  const totalPool = Array.from(betsByOutcome.values()).reduce((s, v) => s + v, 0);
  const result = new Map<string, number>();
  for (const outcome of outcomes) {
    const raw = totalPool === 0 ? 1 / n : (betsByOutcome.get(outcome.id) ?? 0) / totalPool;
    result.set(outcome.id, Math.min(0.99, Math.max(0.01, raw)));
  }
  return result;
}
