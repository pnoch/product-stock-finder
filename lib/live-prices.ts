import { PRICE_HISTORY_DAYS } from "@/shared/const";
import { appendPricePoint, mergePriceHistory } from "@/lib/price-history";
import { resolvePrice } from "@/lib/price-source";
import type {
  DistributorListing,
  PricePoint,
  ServerPriceResult,
} from "@/lib/types";

export { PRICE_HISTORY_DAYS };
export const PRICE_STALE_TIME_MS = 60_000;

export type ConnectionStatus =
  | "connected"
  | "signed-out"
  | "offline"
  | "local";

export function deriveConnectionStatus(args: {
  reachable: boolean;
  isAuthenticated: boolean;
  configured: boolean;
}): ConnectionStatus {
  if (!args.configured) return "local";
  if (!args.reachable) return "offline";
  return args.isAuthenticated ? "connected" : "signed-out";
}

export function applyServerPrice(
  listing: DistributorListing,
  serverResult: ServerPriceResult | null,
): DistributorListing {
  if (!serverResult) return listing;
  const now = new Date().toISOString();
  const mergedHistory = mergePriceHistory(
    listing.priceHistory,
    serverResult.history,
    PRICE_HISTORY_DAYS,
  );
  const snapshot = serverResult.snapshot;
  if (!snapshot) {
    return { ...listing, priceHistory: mergedHistory };
  }
  const snapshotPoint: PricePoint = {
    date: now,
    price: snapshot.price,
    currency: snapshot.currency,
    stockStatus: snapshot.stockStatus,
  };
  return {
    ...listing,
    price: snapshot.price,
    currency: snapshot.currency,
    stockStatus: snapshot.stockStatus,
    expectedDate: snapshot.expectedDate,
    url: snapshot.url,
    lastChecked: now,
    priceHistory: appendPricePoint(
      mergedHistory,
      snapshotPoint,
      PRICE_HISTORY_DAYS,
    ),
  };
}

export function composeLiveListings(
  seeds: DistributorListing[],
  results: (ServerPriceResult | null)[],
): DistributorListing[] {
  const resultMap = new Map(results.map((r, i) => [seeds[i]?.distributorId, r]));
  return seeds.map((seed) => applyServerPrice(seed, resultMap.get(seed.distributorId) ?? null));
}

export function deriveListingQueries(
  modelNumber: string,
  listings: DistributorListing[],
) {
  return listings.map((listing) => ({
    queryKey: ["price", listing.distributorId, modelNumber] as const,
    queryFn: () => resolvePrice(listing.distributorId, modelNumber),
    staleTime: PRICE_STALE_TIME_MS,
    retry: 1,
  }));
}

export function mergeSampleHistory(
  listings: DistributorListing[],
  sampleListings: DistributorListing[],
): DistributorListing[] {
  return listings.map((l) => {
    if (l.priceHistory && l.priceHistory.length >= 2) return l;
    const sample = sampleListings.find(
      (s) => s.distributorId === l.distributorId,
    );
    if (!sample) return l;
    if (l.priceHistory && l.priceHistory.length === 1) {
      return {
        ...l,
        priceHistory: mergePriceHistory(
          l.priceHistory,
          sample.priceHistory ?? [],
          PRICE_HISTORY_DAYS,
        ),
      };
    }
    return { ...l, priceHistory: sample.priceHistory };
  });
}
