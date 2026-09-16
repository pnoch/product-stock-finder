import { fetchServerPrice, uploadServerHistory } from "../server-prices";
import { isFreshPriceSnapshot } from "../price-freshness";
import { getParserByDistributorId } from "../scrapers/registry";
import { fetchAndParse } from "../scrapers/resilient";
import { appendPricePoint, mergePriceHistory } from "../price-history";
import { MAX_UPLOAD_HISTORY_POINTS } from "@/shared/const";
import { PRICE_HISTORY_DAYS } from "@/shared/const";
import type { DistributorListing, PricePoint, Product } from "../types";
import { breakerStore } from "./instances";
import type { createHealthCollector } from "./health-collector";

export async function refreshListing(
  product: Product,
  listing: DistributorListing,
  healthCollector: ReturnType<typeof createHealthCollector>,
): Promise<DistributorListing> {
  const serverResult = await fetchServerPrice(
    listing.distributorId,
    product.modelNumber,
  );
  const snapshot = serverResult?.snapshot;
  const snapshotFresh = isFreshPriceSnapshot(snapshot);
  if (snapshot && snapshotFresh) {
    healthCollector.record(listing.distributorId, "working");
    const now = new Date().toISOString();
    const newPricePoint: PricePoint = {
      date: now,
      price: snapshot.price,
      currency: snapshot.currency,
      stockStatus: snapshot.stockStatus,
    };
    const mergedHistory = mergePriceHistory(
      listing.priceHistory,
      serverResult.history,
    );
    if (serverResult.history.length < listing.priceHistory.length) {
      // Trim to the server cap (newest first) or the upload is rejected whole.
      const points =
        listing.priceHistory.length > MAX_UPLOAD_HISTORY_POINTS
          ? listing.priceHistory.slice(-MAX_UPLOAD_HISTORY_POINTS)
          : listing.priceHistory;
      void uploadServerHistory(
        listing.distributorId,
        product.modelNumber,
        points,
      ).catch(() => {});
    }
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
        newPricePoint,
        PRICE_HISTORY_DAYS,
      ),
    };
  }

  const parser = getParserByDistributorId(listing.distributorId);
  if (!parser) return listing;

  const { result, outcome } = await fetchAndParse(
    parser,
    product.modelNumber,
    breakerStore,
  );

  if (outcome.status !== "ok" || !outcome.html) {
    if (outcome.status === "blocked") {
      healthCollector.record(parser.id, "blocked", outcome.error ?? "blocked by site");
    } else if (outcome.status === "skipped") {
      healthCollector.record(parser.id, "blocked", "in cooldown");
    } else {
      healthCollector.record(parser.id, "error", outcome.error ?? "no price found");
    }
    return listing;
  }

  try {
    if (!result) {
      healthCollector.record(parser.id, "error", "no price found");
      return listing;
    }
    healthCollector.record(parser.id, "working");
    const now = new Date().toISOString();
    const newPricePoint: PricePoint = {
      date: now,
      price: result.price,
      currency: result.currency,
      stockStatus: result.stockStatus,
    };
    return {
      ...listing,
      price: result.price,
      currency: result.currency,
      stockStatus: result.stockStatus,
      expectedDate: result.expectedDate,
      url: result.url,
      lastChecked: now,
      priceHistory: appendPricePoint(
        listing.priceHistory,
        newPricePoint,
        PRICE_HISTORY_DAYS,
      ),
    };
  } catch (error) {
    healthCollector.record(
      parser.id,
      "error",
      error instanceof Error ? error.message : String(error),
    );
    return listing;
  }
}
