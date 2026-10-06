import type { Distributor } from "./types";

// Country → region, so a country without an explicit shipping rate falls back
// to its distributor region. Covers the countries the app's distributors ship
// to; unknown countries fall through to null.
const COUNTRY_REGION: Record<string, string> = {
  TH: "Asia-Pacific",
  SG: "Asia-Pacific",
  MY: "Asia-Pacific",
  AU: "Asia-Pacific",
  NZ: "Asia-Pacific",
  JP: "Asia-Pacific",
  KR: "Asia-Pacific",
  IN: "Asia-Pacific",
  GB: "Europe",
  DE: "Europe",
  FR: "Europe",
  GR: "Europe",
  PL: "Europe",
  CZ: "Europe",
  US: "North America",
  CA: "North America",
  AE: "Middle East",
  ZA: "Africa",
};

export function regionForCountry(countryCode: string): string | null {
  // Own-property check: a prototype key like "constructor" must not resolve
  // to an inherited value.
  return Object.prototype.hasOwnProperty.call(COUNTRY_REGION, countryCode)
    ? COUNTRY_REGION[countryCode]!
    : null;
}

/**
 * Shipping cost in the distributor's native currency for a destination country.
 * Explicit country rate first, then the distributor's region rate, else null.
 */
export function resolveShipping(
  distributor: Distributor,
  countryCode: string,
): number | null {
  const table = distributor.shippingCosts;
  if (!table) return null;
  if (Object.prototype.hasOwnProperty.call(table, countryCode)) {
    return table[countryCode]!;
  }
  const region = regionForCountry(countryCode);
  if (region && Object.prototype.hasOwnProperty.call(table, region)) {
    return table[region]!;
  }
  return null;
}
