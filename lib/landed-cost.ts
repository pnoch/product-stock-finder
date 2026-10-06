import type { Distributor, DistributorListing } from "./types";
import { convertPrice } from "./currency";
import { estimateImportDuty } from "@shared/duty";
import { getDistributorById } from "@shared/distributors";

// Country → region, so a country without an explicit shipping rate falls back
// to its distributor region. Covers every country in shared/src/countries.ts
// (guarded by tests/countries.test.ts); unknown countries fall through to null.
const COUNTRY_REGION: Record<string, string> = {
  TH: "Asia-Pacific",
  SG: "Asia-Pacific",
  MY: "Asia-Pacific",
  AU: "Asia-Pacific",
  NZ: "Asia-Pacific",
  JP: "Asia-Pacific",
  KR: "Asia-Pacific",
  IN: "Asia-Pacific",
  HK: "Asia-Pacific",
  PH: "Asia-Pacific",
  ID: "Asia-Pacific",
  VN: "Asia-Pacific",
  TW: "Asia-Pacific",
  CN: "Asia-Pacific",
  PK: "Asia-Pacific",
  BD: "Asia-Pacific",
  LK: "Asia-Pacific",
  NP: "Asia-Pacific",
  KH: "Asia-Pacific",
  GB: "Europe",
  DE: "Europe",
  FR: "Europe",
  GR: "Europe",
  PL: "Europe",
  CZ: "Europe",
  ES: "Europe",
  IT: "Europe",
  NL: "Europe",
  SE: "Europe",
  NO: "Europe",
  DK: "Europe",
  FI: "Europe",
  IE: "Europe",
  PT: "Europe",
  AT: "Europe",
  BE: "Europe",
  CH: "Europe",
  RO: "Europe",
  HU: "Europe",
  TR: "Europe",
  UA: "Europe",
  RS: "Europe",
  BG: "Europe",
  HR: "Europe",
  SK: "Europe",
  SI: "Europe",
  LT: "Europe",
  LV: "Europe",
  EE: "Europe",
  US: "North America",
  CA: "North America",
  MX: "North America",
  AE: "Middle East",
  SA: "Middle East",
  IL: "Middle East",
  QA: "Middle East",
  KW: "Middle East",
  ZA: "Africa",
  EG: "Africa",
  KE: "Africa",
  NG: "Africa",
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

export interface LandedCost {
  distributorId: string;
  price: number;
  shipping: number;
  storeTax: number;
  importEstimate: number;
  total: number;
  currency: string;
  isEstimate: boolean;
}

export interface Destination {
  countryCode: string;
  currency: string;
}

export interface LandedCostOptions {
  taxExempt?: boolean;
  includeImportEstimate?: boolean;
  category?: string;
}

/**
 * True cost to the buyer's door: converted price + shipping + the store's tax
 * (per its taxMode) + an optional destination import estimate. Returns null when
 * shipping is unknown, so the UI can show "shipping unknown" rather than a wrong
 * number.
 */
export function computeLandedCost(
  listing: DistributorListing,
  distributor: Distributor,
  destination: Destination,
  options: LandedCostOptions,
): LandedCost | null {
  const shippingNative = resolveShipping(distributor, destination.countryCode);
  if (shippingNative === null) return null;

  const price = convertPrice(
    listing.price,
    listing.currency,
    destination.currency,
  );
  if (price === null) return null;
  const shipping = convertPrice(
    shippingNative,
    distributor.currency,
    destination.currency,
  );
  if (shipping === null) return null;

  const taxExempt = options.taxExempt === true;

  let storeTax = 0;
  if (!taxExempt) {
    if (distributor.taxMode === "origin") {
      const rate =
        typeof listing.taxRate === "number" && Number.isFinite(listing.taxRate)
          ? listing.taxRate
          : 0;
      storeTax = price * rate;
    } else if (distributor.taxMode === "destination") {
      const est = estimateImportDuty(
        price,
        options.category ?? "",
        destination.countryCode,
      );
      storeTax = est ? price * est.vatRate : 0;
    }
  }

  let importEstimate = 0;
  if (!taxExempt && options.includeImportEstimate === true) {
    const est = estimateImportDuty(
      price,
      options.category ?? "",
      destination.countryCode,
    );
    if (est) {
      const base = price + shipping;
      // A destination-tax store already collected VAT in storeTax, so the
      // import estimate must not charge it a second time.
      const rate =
        distributor.taxMode === "destination"
          ? est.dutyRate
          : est.vatRate + est.dutyRate;
      importEstimate = base * rate;
    }
  }

  return {
    distributorId: distributor.id,
    price,
    shipping,
    storeTax,
    importEstimate,
    total: price + shipping + storeTax + importEstimate,
    currency: destination.currency,
    isEstimate: true,
  };
}

/**
 * Landed-cost-ranked listings for a destination. Listings whose distributor is
 * unknown or whose shipping is unknown are dropped (they cannot be ranked
 * fairly). Ties break by distributor id for determinism.
 */
export function rankByLandedCost(
  listings: DistributorListing[],
  destination: Destination,
  options: LandedCostOptions,
): LandedCost[] {
  const out: LandedCost[] = [];
  for (const listing of listings) {
    // Only purchasable listings can be ranked (matches getBestPrice): an
    // out-of-stock or unknown-availability row must not top the list.
    if (
      listing.stockStatus !== "in_stock" &&
      listing.stockStatus !== "back_order"
    ) {
      continue;
    }
    // Matches findBestDeal/getBestPrice: a zero or unusable price is not a deal.
    if (!(listing.price > 0)) continue;
    const distributor = getDistributorById(listing.distributorId);
    if (!distributor) continue;
    const cost = computeLandedCost(listing, distributor, destination, options);
    if (cost) out.push(cost);
  }
  return out.sort(
    (a, b) =>
      a.total - b.total || a.distributorId.localeCompare(b.distributorId),
  );
}
