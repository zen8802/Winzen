const INITIAL_COINS = parseInt(process.env.INITIAL_COINS ?? "1000", 10);

export function getInitialCoins(): number {
  return INITIAL_COINS;
}

export function formatCoins(amount: number): string {
  return `${amount.toLocaleString()} coins`;
}
