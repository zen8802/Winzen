/**
 * Compute clamped parimutuel probabilities for all outcomes.
 * Returns a map from outcomeId → probability as float 0.01–0.99.
 * When there are no bets yet (empty map), distributes equally across all outcomes.
 * Used for ProbabilitySnapshot chart data (legacy / multiple_choice markets).
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

/**
 * AMM liquidity-based pricing for YES/NO markets.
 * Returns the new YES probability (1–99 scale) after a bet is placed.
 *
 * @param current  Current YES probability (1–99)
 * @param amount   Coins staked
 * @param direction  +1 for YES bet, -1 for NO bet
 * @param liquidity  Market liquidity parameter (default 1,000)
 */
export function computeAmmProbability(
  current: number,
  amount: number,
  direction: 1 | -1,
  liquidity: number,
): number {
  const delta = amount / liquidity;
  return Math.min(99, Math.max(1, current + direction * delta * 100));
}
