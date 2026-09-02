import type { Product } from "./types";
import { convertPrice, hasExchangeRate } from "./currency";
import { getDistributorById } from "./distributors";

export type MoversWindow = 7 | 30 | null;

export interface PriceMove {
  productId: string;
  productName: string;
  distributorId: string;
  distributorName: string;
  countryFlag: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
  changePct: number;
}

export interface MoversResult {
  drops: PriceMove[];
  gainers: PriceMove[];
}

export interface BasketValueResult {
  total: number;
  productCount: number;
  excludedCount: number;
}

export interface StockHealthResult {
  totalListings: number;
  inStockPct: number;
  fullyOutOfStock: number;
  backOrderOnly: number;
}

export interface DataFreshnessResult {
  avgHistoryPoints: number;
  staleCount: number;
  neverCheckedCount: number;
  oldestCheck: string | null;
}

export interface WatchlistStats {
  movers: MoversResult;
  basket: BasketValueResult;
  stockHealth: StockHealthResult;
  freshness: DataFreshnessResult;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_MS = 7 * DAY_MS;

function convertToDisplay(
  price: number,
  currency: string,
  displayCurrency: string,
): number | null {
  if (!(price > 0)) return null;
  if (!currency || !hasExchangeRate(currency) || !hasExchangeRate(displayCurrency)) {
    return null;
  }
  return convertPrice(price, currency, displayCurrency);
}

export function computeMovers(
  watchlist: Product[],
  displayCurrency: string,
  days: MoversWindow,
  now: number = Date.now(),
): MoversResult {
  const cutoff = days !== null ? now - days * DAY_MS : null;
  const moves: PriceMove[] = [];

  for (const product of watchlist) {
    for (const listing of product.listings ?? []) {
      const points = (listing.priceHistory ?? [])
        .map((p) => ({ ...p, t: Date.parse(p.date) }))
        .filter((p) => Number.isFinite(p.t))
        .sort((a, b) => a.t - b.t);
      const windowed =
        cutoff !== null ? points.filter((p) => p.t >= cutoff) : points;
      if (windowed.length < 2) continue;

      const oldest = windowed[0];
      const newest = windowed[windowed.length - 1];
      const oldConverted = convertToDisplay(oldest.price, oldest.currency, displayCurrency);
      const newConverted = convertToDisplay(newest.price, newest.currency, displayCurrency);
      if (oldConverted === null || newConverted === null) continue;

      const changePct = Math.round(((newConverted - oldConverted) / oldConverted) * 100);
      if (changePct === 0) continue;

      const dist = getDistributorById(listing.distributorId);
      moves.push({
        productId: product.id,
        productName: product.name,
        distributorId: listing.distributorId,
        distributorName: dist?.name ?? listing.distributorId,
        countryFlag: dist?.countryFlag ?? "",
        oldPrice: oldConverted,
        newPrice: newConverted,
        currency: displayCurrency,
        changePct,
      });
    }
  }

  const byMagnitude = (a: PriceMove, b: PriceMove) =>
    Math.abs(b.changePct) - Math.abs(a.changePct) ||
    a.productName.localeCompare(b.productName);

  return {
    drops: moves.filter((m) => m.changePct < 0).sort(byMagnitude).slice(0, 5),
    gainers: moves.filter((m) => m.changePct > 0).sort(byMagnitude).slice(0, 5),
  };
}

export function computeBasketValue(
  watchlist: Product[],
  displayCurrency: string,
): BasketValueResult {
  let total = 0;
  let productCount = 0;
  let excludedCount = 0;

  for (const product of watchlist) {
    let best: number | null = null;
    for (const listing of product.listings ?? []) {
      if (listing.stockStatus !== "in_stock") continue;
      const converted = convertToDisplay(listing.price, listing.currency, displayCurrency);
      if (converted !== null && (best === null || converted < best)) best = converted;
    }
    if (best !== null) {
      total += best;
      productCount += 1;
    } else {
      excludedCount += 1;
    }
  }

  return { total, productCount, excludedCount };
}

export function computeStockHealth(watchlist: Product[]): StockHealthResult {
  let totalListings = 0;
  let inStock = 0;
  let fullyOutOfStock = 0;
  let backOrderOnly = 0;

  for (const product of watchlist) {
    const listings = product.listings ?? [];
    if (listings.length === 0) continue;
    let inStockCount = 0;
    let outOfStockCount = 0;
    let backOrderCount = 0;
    for (const listing of listings) {
      totalListings += 1;
      if (listing.stockStatus === "in_stock") {
        inStock += 1;
        inStockCount += 1;
      } else if (listing.stockStatus === "out_of_stock") {
        outOfStockCount += 1;
      } else if (listing.stockStatus === "back_order") {
        backOrderCount += 1;
      }
    }
    if (inStockCount === 0 && outOfStockCount === listings.length) {
      fullyOutOfStock += 1;
    } else if (backOrderCount === listings.length) {
      backOrderOnly += 1;
    }
  }

  const inStockPct =
    totalListings > 0 ? Math.round((inStock / totalListings) * 100) : 0;
  return { totalListings, inStockPct, fullyOutOfStock, backOrderOnly };
}

export function computeDataFreshness(
  watchlist: Product[],
  now: number = Date.now(),
): DataFreshnessResult {
  let checkedListingCount = 0;
  let pointCount = 0;
  let staleCount = 0;
  let neverCheckedCount = 0;
  let oldest: number | null = null;

  for (const product of watchlist) {
    for (const listing of product.listings ?? []) {
      const t = listing.lastChecked ? Date.parse(listing.lastChecked) : NaN;
      if (!Number.isFinite(t)) {
        neverCheckedCount += 1;
        continue;
      }
      pointCount += listing.priceHistory?.length ?? 0;
      checkedListingCount += 1;
      if (now - t > STALE_MS) staleCount += 1;
      if (oldest === null || t < oldest) oldest = t;
    }
  }

  return {
    avgHistoryPoints:
      checkedListingCount > 0
        ? Math.round((pointCount / checkedListingCount) * 10) / 10
        : 0,
    staleCount,
    neverCheckedCount,
    oldestCheck: oldest !== null ? new Date(oldest).toISOString() : null,
  };
}

export function computeWatchlistStats(
  watchlist: Product[],
  displayCurrency: string,
  days: MoversWindow,
  now: number = Date.now(),
): WatchlistStats {
  return {
    movers: computeMovers(watchlist, displayCurrency, days, now),
    basket: computeBasketValue(watchlist, displayCurrency),
    stockHealth: computeStockHealth(watchlist),
    freshness: computeDataFreshness(watchlist, now),
  };
}
