import type { PriceAlert } from "./types";
import { convertPrice } from "./currency";

// Triggered alerts that actually contributed a saving: a drop alert whose
// triggered price came in below target. A "rise" alert fires when the price
// goes UP (the user wants to know, e.g. to sell), so its delta is not a saving.
// The banner's "Across N triggered alerts" count must use this too, or it
// counts alerts the total excludes.
export function savingAlerts(alerts: PriceAlert[]): PriceAlert[] {
  return alerts.filter(
    (a) =>
      a.triggeredPrice != null &&
      a.direction !== "rise" &&
      a.targetPrice - a.triggeredPrice > 0,
  );
}

// Sum of money saved by triggered price alerts, converted to the display
// currency. Only "drop" alerts count: counting a rise alert made the
// "Total Saved" banner claim savings that never happened.
export function computeTotalSaved(
  alerts: PriceAlert[],
  displayCurrency: string,
): number {
  let total = 0;
  for (const alert of savingAlerts(alerts)) {
    const delta = alert.targetPrice - alert.triggeredPrice!;
    const converted = convertPrice(delta, alert.currency, displayCurrency);
    if (converted === null) continue;
    total += converted;
  }
  return total;
}
