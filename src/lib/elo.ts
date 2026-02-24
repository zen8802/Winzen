/**
 * ELO-style skill rating for prediction market outcomes.
 *
 * Treats each market resolution as a "match" where the user's skill is their
 * entry probability vs the market-implied probability. Correct contrarian bets
 * reward more; confident wrong bets penalise more.
 */

/**
 * Compute ELO rating update for a single bet outcome.
 *
 * @param currentRating         User's current ELO rating
 * @param entryProbability      Probability of CHOSEN outcome at entry (1–99 scale)
 * @param marketProbAtResolution Probability of SAME outcome at market resolution (1–99 scale)
 * @param won                   Whether the user's chosen outcome won
 * @param K                     ELO K-factor (default 32)
 */
export function computeEloUpdate(
  currentRating: number,
  entryProbability: number,
  marketProbAtResolution: number,
  won: boolean,
  K = 32,
): { newRating: number; delta: number } {
  // Standard ELO expected score formula
  const expected = 1 / (1 + Math.pow(10, (marketProbAtResolution - entryProbability) / 400));
  const actual = won ? 1 : 0;
  const delta = Math.round(K * (actual - expected));
  const newRating = Math.max(100, currentRating + delta); // floor at 100
  return { newRating, delta };
}
