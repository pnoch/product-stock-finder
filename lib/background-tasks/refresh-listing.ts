import { fetchServerPrice, uploadServerHistory } from "../server-prices";
import { getParserByDistributorId } from "../scrapers/registry";
import { resilientFetch } from "../scrapers/resilient";
import { appendPricePoint, mergePriceHistory } from "../price-history";
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
  if (serverResult?.snapshot) {
    healthCollector.record(listing.distributorId, "working");
    const now = new Date().toISOString();
    const newPricePoint: PricePoint = {
      date: now,
      price: serverResult.snapshot.price,
      currency: serverResult.snapshot.currency,
      stockStatus: serverResult.snapshot.stockStatus,
    };
    const mergedHistory = mergePriceHistory(
      listing.priceHistory,
      serverResult.history,
    );
    if (serverResult.history.length < listing.priceHistory.length) {
      void uploadServerHistory(
        listing.distributorId,
        product.modelNumber,
        listing.priceHistory,
      );
    }
    return {
      ...listing,
      price: serverResult.snapshot.price,
      currency: serverResult.snapshot.currency,
      stockStatus: serverResult.snapshot.stockStatus,
      expectedDate: serverResult.snapshot.expectedDate,
      url: serverResult.snapshot.url,
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

  const url = parser.buildSearchUrl(product.modelNumber);
  const outcome = await resilientFetch({ parser, url, state: breakerStore });

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
    const result = parser.parsePrice(outcome.html);
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
