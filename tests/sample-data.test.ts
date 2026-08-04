import { describe, expect, it } from "vitest";
import { SAMPLE_LISTINGS } from "../lib/sample-data";
import { PRODUCT_CATALOG } from "../lib/catalog";

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