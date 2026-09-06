import type { DistributorListing } from "./types";
import { formatPrice } from "@shared/currency";
import { convertPrice, hasExchangeRate } from "./currency";
import { getDistributorById } from "@shared/distributors";

export interface PriceShareInput {
  productName?: string;
  modelNumber?: string;
  product?: { name: string; modelNumber: string };
  listings: DistributorListing[];
  displayCurrency: string;
  limit?: number;
}

const MAX_ROWS = 5;

function convert(
  price: number,
  currency: string,
  displayCurrency: string,
): number | null {
  if (!(price > 0)) return null;
  if (
    !currency ||
    !hasExchangeRate(currency) ||
    !hasExchangeRate(displayCurrency)
  ) {
    return null;
  }
  return convertPrice(price, currency, displayCurrency);
}

export interface ShareRow {
  flag: string;
  name: string;
  price: number;
}

export interface ShareRowsResult {
  rows: ShareRow[];
  bestUrl: string;
  allOutOfStock: boolean;
  fallbackPrice: string | null;
}

export function buildShareRows(
  listings: DistributorListing[],
  displayCurrency: string,
): ShareRowsResult {
  const inStock = listings
    .filter((l) => l.stockStatus === "in_stock")
    .map((l) => ({
      listing: l,
      converted: convert(l.price, l.currency, displayCurrency),
    }))
    .filter((e) => e.converted !== null)
    .sort((a, b) => a.converted! - b.converted!)
    .slice(0, MAX_ROWS);

  if (inStock.length > 0) {
    return {
      rows: inStock.map(({ listing, converted }) => {
        const dist = getDistributorById(listing.distributorId);
        return {
          flag: dist?.countryFlag ?? "",
          name: dist?.name ?? listing.distributorId,
          price: converted!,
        };
      }),
      bestUrl: inStock[0].listing.url ?? "",
      allOutOfStock: false,
      fallbackPrice: null,
    };
  }

  const convertedCandidates = listings
    .map((l) => ({
      listing: l,
      converted: convert(l.price, l.currency, displayCurrency),
    }))
    .filter((e) => e.converted !== null)
    .sort((a, b) => a.converted! - b.converted!);
  if (convertedCandidates.length > 0) {
    const cheapest = convertedCandidates[0].listing;
    const converted = convertedCandidates[0].converted!;
    return {
      rows: [],
      bestUrl: cheapest.url ?? "",
      allOutOfStock: true,
      fallbackPrice: formatPrice(converted, displayCurrency),
    };
  }
  const cheapest = [...listings].sort((a, b) => a.price - b.price)[0];
  if (!cheapest) {
    return { rows: [], bestUrl: "", allOutOfStock: false, fallbackPrice: null };
  }
  return {
    rows: [],
    bestUrl: cheapest.url ?? "",
    allOutOfStock: true,
    fallbackPrice: formatPrice(cheapest.price, cheapest.currency),
  };
}

export function buildShareText(input: PriceShareInput): string {
  const rawName = input.productName ?? input.product?.name ?? "Product";
  const rawModel = input.modelNumber ?? input.product?.modelNumber ?? "";
  const { listings, displayCurrency } = input;
  const limit = input.limit;
  const productName = rawName;
  const modelNumber = rawModel;
  const lines: string[] = [
    rawModel ? `${productName} (${modelNumber}) — price comparison` : `${productName} — price comparison`,
    "",
  ];
  const shareRows = buildShareRows(listings, displayCurrency);
  const rows = typeof limit === "number" ? shareRows.rows.slice(0, limit) : shareRows.rows;
  const { bestUrl, allOutOfStock, fallbackPrice } = shareRows;

  if (allOutOfStock && fallbackPrice) {
    lines.push(`All out of stock — best listed price ${fallbackPrice}`);
  }
  for (const row of rows) {
    lines.push(
      `${row.flag} ${row.name} — ${formatPrice(row.price, displayCurrency)}`.trimStart(),
    );
  }

  lines.push("", `Prices in ${displayCurrency} · via Product Stock Finder`);
  if (bestUrl) lines.push(bestUrl);
  return lines.join("\n");
}
