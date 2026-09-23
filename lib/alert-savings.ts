import type { PriceAlert } from "./types";
import { convertPrice } from "./currency";

// Sum of money saved by triggered price alerts, converted to the display
// currency. Only "drop" alerts count: a "rise" alert fires when the price goes
// UP (the user wants to know, e.g. to sell), so its delta is not a saving.
// Counting it made the "Total Saved" banner claim savings that never happened.
export function computeTotalSaved(
  alerts: PriceAlert[],
  displayCurrency: string,
): number {
  let total = 0;
  for (const alert of alerts) {
    if (alert.triggeredPrice == null) continue;
    if (alert.direction === "rise") continue;
    const delta = alert.targetPrice - alert.triggeredPrice;
    if (!(delta > 0)) continue;
    const converted = convertPrice(delta, alert.currency, displayCurrency);
    if (converted === null) continue;
    total += converted;
  }
  return total;
}
