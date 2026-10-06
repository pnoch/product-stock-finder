import type { AppSettings } from "./types";
import type { Destination, LandedCostOptions } from "./landed-cost";

/**
 * The user's shipping destination, or null when they have not chosen one (the
 * caller then falls back to the region-based path).
 */
export function resolveDestination(settings: AppSettings): Destination | null {
  if (!settings.shipToCountry) return null;
  return {
    countryCode: settings.shipToCountry,
    currency: settings.displayCurrency || "USD",
  };
}

export function landedCostOptions(settings: AppSettings): LandedCostOptions {
  return {
    taxExempt: settings.taxExempt === true,
    includeImportEstimate: settings.includeImportEstimate === true,
  };
}
