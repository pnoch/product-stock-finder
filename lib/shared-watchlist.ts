import type {
  DistributorListing,
  PricePoint,
  Product,
  StockStatus,
} from "./types";

const STOCK_STATUSES: ReadonlySet<string> = new Set([
  "in_stock",
  "back_order",
  "out_of_stock",
  "unknown",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStockStatus(value: unknown): StockStatus {
  return typeof value === "string" && STOCK_STATUSES.has(value)
    ? (value as StockStatus)
    : "unknown";
}

function asPricePoint(value: unknown): PricePoint | null {
  if (!isRecord(value)) return null;
  if (typeof value.price !== "number" || !Number.isFinite(value.price)) return null;
  return {
    date: typeof value.date === "string" ? value.date : new Date().toISOString(),
    price: value.price,
    currency: typeof value.currency === "string" ? value.currency : "USD",
    stockStatus: asStockStatus(value.stockStatus),
  };
}

function asListing(value: unknown, productId: string): DistributorListing | null {
  if (!isRecord(value)) return null;
  const distributorId = asTrimmedString(value.distributorId);
  const price = value.price;
  if (!distributorId || typeof price !== "number" || !Number.isFinite(price)) {
    return null;
  }
  const priceHistory = Array.isArray(value.priceHistory)
    ? value.priceHistory
        .map(asPricePoint)
        .filter((point): point is PricePoint => point !== null)
    : [];
  return {
    distributorId,
    productId,
    price,
    currency: typeof value.currency === "string" ? value.currency : "USD",
    stockStatus: asStockStatus(value.stockStatus),
    url: typeof value.url === "string" ? value.url : "",
    lastChecked:
      typeof value.lastChecked === "string"
        ? value.lastChecked
        : new Date().toISOString(),
    priceHistory,
    taxRate: typeof value.taxRate === "number" ? value.taxRate : undefined,
  };
}

export function normalizeSharedWatchlistProduct(input: unknown): Product {
  if (!isRecord(input)) {
    throw new Error("Shared product id and name are required");
  }
  const id = asTrimmedString(input.id);
  const name = asTrimmedString(input.name);
  if (!id || !name) {
    throw new Error("Shared product id and name are required");
  }
  const listings = Array.isArray(input.listings)
    ? input.listings
        .map((listing) => asListing(listing, id))
        .filter((listing): listing is DistributorListing => listing !== null)
    : [];
  const tags = Array.isArray(input.tags)
    ? input.tags.filter((tag): tag is string => typeof tag === "string")
    : undefined;

  return {
    id,
    name,
    modelNumber: asTrimmedString(input.modelNumber) || id,
    brand: asTrimmedString(input.brand),
    category: asTrimmedString(input.category),
    description: typeof input.description === "string" ? input.description : "",
    addedAt:
      typeof input.addedAt === "string" ? input.addedAt : new Date().toISOString(),
    isWatched: true,
    listings,
    ...(tags ? { tags } : {}),
  };
}
