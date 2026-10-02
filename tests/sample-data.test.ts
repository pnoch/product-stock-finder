import { describe, expect, it } from "vitest";
import { SAMPLE_LISTINGS, freshenSampleListings } from "../lib/sample-data";
import { PRODUCT_CATALOG } from "@shared/catalog";
import type { DistributorListing } from "../lib/types";

const DAY = 86_400_000;

const SEED_PRODUCT_IDS = ["mikrotik-crs804-4ddq-hrm", "mikrotik-crs326-24s"];

describe("SAMPLE_LISTINGS contract", () => {
  for (const productId of SEED_PRODUCT_IDS) {
    describe(`${productId}`, () => {
      it("has a SAMPLE_LISTINGS entry", () => {
        expect(SAMPLE_LISTINGS[productId]).toBeDefined();
        expect(SAMPLE_LISTINGS[productId]!.length).toBeGreaterThan(0);
      });

      it("every listing has priceHistory with at least 2 points", () => {
        for (const listing of SAMPLE_LISTINGS[productId]!) {
          expect(
            listing.priceHistory,
            `listing for ${listing.distributorId} has no priceHistory`,
          ).toBeDefined();
          expect(listing.priceHistory.length).toBeGreaterThanOrEqual(2);
        }
      });

      it("every listing has a valid stockStatus", () => {
        const valid = ["in_stock", "back_order", "out_of_stock", "unknown"];
        for (const listing of SAMPLE_LISTINGS[productId]!) {
          expect(valid).toContain(listing.stockStatus);
        }
      });

      it("every listing has a positive price", () => {
        for (const listing of SAMPLE_LISTINGS[productId]!) {
          expect(listing.price).toBeGreaterThan(0);
        }
      });

      it("every listing productId matches the key", () => {
        for (const listing of SAMPLE_LISTINGS[productId]!) {
          expect(listing.productId).toBe(productId);
        }
      });
    });
  }

  it("every seed product exists in PRODUCT_CATALOG", () => {
    for (const id of SEED_PRODUCT_IDS) {
      expect(PRODUCT_CATALOG.find((p) => p.id === id)).toBeDefined();
    }
  });
});

describe("freshenSampleListings", () => {
  function listing(lastCheckedDaysAgo: number, historyDaysAgo: number[]): DistributorListing {
    return {
      distributorId: "d1",
      productId: "p1",
      price: 100,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      lastChecked: new Date(Date.now() - lastCheckedDaysAgo * DAY).toISOString(),
      priceHistory: historyDaysAgo.map((days) => ({
        date: new Date(Date.now() - days * DAY).toISOString(),
        price: 100,
        currency: "USD",
        stockStatus: "in_stock",
      })),
    } as DistributorListing;
  }

  it("moves lastChecked to now and shifts history by the same delta", () => {
    const before = Date.now();
    // Checked 5 days ago; history point at the check time (5d ago) and one
    // 15 days ago.
    const [fresh] = freshenSampleListings([listing(5, [15, 5])]);
    const checked = Date.parse(fresh!.lastChecked);
    expect(checked).toBeGreaterThanOrEqual(before);
    expect(checked).toBeLessThanOrEqual(Date.now() + 1000);

    // The shift equals the lastChecked delta (5 days), preserving relative
    // spacing: 15d→10d ago and 5d→now.
    const history = fresh!.priceHistory.map((p) => Date.parse(p.date));
    expect(history[0]!).toBeGreaterThanOrEqual(checked - 10 * DAY - 1000);
    expect(history[0]!).toBeLessThanOrEqual(checked - 10 * DAY + 1000);
    expect(history[1]!).toBeGreaterThanOrEqual(checked - 1000);
    expect(history[1]!).toBeLessThanOrEqual(checked + 1000);
  });

  it("does not mutate the input listings", () => {
    const original = listing(3, [6, 1]);
    const originalDate = original.lastChecked;
    freshenSampleListings([original]);
    expect(original.lastChecked).toBe(originalDate);
  });
});
