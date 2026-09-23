import type { DistributorListing } from "./types";
import { getBestPrice } from "./currency";
import { bestPricePoints } from "./product-insights";

export interface PriceChange {
  pct: number;
  isDown: boolean;
}

// Percentage change of the current best orderable price vs the historical
// minimum in-stock price. Both sides must be in-stock minimums: comparing the
// current best against the oldest point of *any* listing (including
// out-of-stock) produced fake drops — e.g. a 1000 out-of-stock point vs a 100
// current best showed -90%.
export function computePriceChange(
  listings: DistributorListing[],
  displayCurrency: string,
): PriceChange | null {
  const best = getBestPrice(listings, displayCurrency);
  if (!best || best.price <= 0) return null;
  const history = bestPricePoints(listings, displayCurrency);
  if (history.length < 2) return null;
  const oldest = history[0].v;
  if (oldest <= 0) return null;
  const pct = ((best.price - oldest) / oldest) * 100;
  if (Math.abs(pct) < 0.5) return null;
  return { pct, isDown: pct < 0 };
}
