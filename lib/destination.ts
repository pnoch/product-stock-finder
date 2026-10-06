import type { Destination, LandedCostOptions } from "./landed-cost";

/**
 * The user's shipping destination, or null when they have not chosen one (the
 * caller then falls back to the region-based path).
 */
export function resolveDestination(
  shipToCountry: string | undefined,
  displayCurrency: string | undefined,
): Destination | null {
  if (!shipToCountry) return null;
  return { countryCode: shipToCountry, currency: displayCurrency || "USD" };
}

export function landedCostOptions(
  taxExempt: boolean | undefined,
  includeImportEstimate: boolean | undefined,
): LandedCostOptions {
  return {
    taxExempt: taxExempt === true,
    includeImportEstimate: includeImportEstimate === true,
  };
}
