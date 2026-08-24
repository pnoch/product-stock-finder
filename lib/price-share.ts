import type { DistributorListing } from "./types";
import { convertPrice, hasExchangeRate, formatPrice } from "./currency";
import { getDistributorById } from "./distributors";

export interface PriceShareInput {
  productName: string;
  modelNumber: string;
  listings: DistributorListing[];
  displayCurrency: string;
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

export function buildShareText(input: PriceShareInput): string {
  const { productName, modelNumber, listings, displayCurrency } = input;

  const lines: string[] = [
    `${productName} (${modelNumber}) — price comparison`,
    "",
  ];

  const inStock = listings
    .filter((l) => l.stockStatus === "in_stock")
    .map((l) => ({
      listing: l,
      converted: convert(l.price, l.currency, displayCurrency),
    }))
    .filter((e) => e.converted !== null)
    .sort((a, b) => a.converted! - b.converted!)
    .slice(0, MAX_ROWS);

  let bestUrl = "";

  if (inStock.length > 0) {
    for (const { listing, converted } of inStock) {
      const dist = getDistributorById(listing.distributorId);
      lines.push(
        `${dist?.countryFlag ?? ""} ${dist?.name ?? listing.distributorId} — ${formatPrice(
          converted!,
          displayCurrency,
        )}`.trimStart(),
      );
      if (!bestUrl && listing.url) bestUrl = listing.url;
    }
  } else {
    const cheapest = [...listings].sort((a, b) => a.price - b.price)[0];
    if (cheapest) {
      const converted = convert(cheapest.price, cheapest.currency, displayCurrency);
      const priceStr =
        converted !== null
          ? formatPrice(converted, displayCurrency)
          : formatPrice(cheapest.price, cheapest.currency);
      lines.push(`All out of stock — best listed price ${priceStr}`);
      if (cheapest.url) bestUrl = cheapest.url;
    }
  }

  lines.push("", `Prices in ${displayCurrency} · via Product Stock Finder`);
  if (bestUrl) lines.push(bestUrl);

  return lines.join("\n");
}
