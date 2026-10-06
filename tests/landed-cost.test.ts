import { describe, expect, it } from "vitest";
import {
  computeLandedCost,
  regionForCountry,
  resolveShipping,
} from "../lib/landed-cost";
import type { Distributor, DistributorListing } from "../lib/types";

function dist(overrides: Partial<Distributor> = {}): Distributor {
  return {
    id: "d1",
    name: "D1",
    currency: "USD",
    country: "Malaysia",
    countryCode: "MY",
    region: "Asia-Pacific",
    website: "https://d1.test",
    paymentMethods: [],
    taxMode: "none",
    shippingCosts: { TH: 38, "Asia-Pacific": 15, Europe: 40 },
    ...overrides,
  } as Distributor;
}

describe("resolveShipping", () => {
  it("prefers an explicit country rate", () => {
    expect(resolveShipping(dist(), "TH")).toBe(38);
  });

  it("falls back to the distributor's region for the country", () => {
    // SG has no explicit rate; SG is in Asia-Pacific.
    expect(resolveShipping(dist(), "SG")).toBe(15);
  });

  it("returns null when neither country nor region is known", () => {
    expect(resolveShipping(dist({ shippingCosts: {} }), "TH")).toBeNull();
  });

  it("returns null when the distributor has no shipping table", () => {
    expect(
      resolveShipping(dist({ shippingCosts: undefined }), "TH"),
    ).toBeNull();
  });

  it("returns null for a country absent from the region map", () => {
    expect(regionForCountry("XX")).toBeNull();
    expect(resolveShipping(dist(), "XX")).toBeNull();
  });

  it("is prototype-safe for a country code like toString", () => {
    expect(regionForCountry("toString")).toBeNull();
    expect(resolveShipping(dist(), "toString")).toBeNull();
  });
});

function listing(
  overrides: Partial<DistributorListing> = {},
): DistributorListing {
  return {
    distributorId: "d1",
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    lastChecked: "2026-01-01T00:00:00.000Z",
    priceHistory: [],
    ...overrides,
  } as DistributorListing;
}

const dest = { countryCode: "TH", currency: "USD" };

describe("computeLandedCost", () => {
  it("adds shipping for an export-exempt store and no store tax", () => {
    const d = dist({ taxMode: "export-exempt" });
    const r = computeLandedCost(listing(), d, dest, {});
    expect(r).not.toBeNull();
    expect(r!.shipping).toBe(38);
    expect(r!.storeTax).toBe(0);
    expect(r!.total).toBe(138);
  });

  it("adds the listing taxRate for an origin-tax store", () => {
    const d = dist({ taxMode: "origin" });
    const r = computeLandedCost(listing({ taxRate: 0.24 }), d, dest, {});
    expect(r!.storeTax).toBeCloseTo(24, 5);
    expect(r!.total).toBeCloseTo(162, 5);
  });

  it("adds destination VAT for a destination-tax store", () => {
    const d = dist({ taxMode: "destination" });
    const r = computeLandedCost(listing(), d, dest, {});
    // TH VAT 7% on 100 = 7
    expect(r!.storeTax).toBeCloseTo(7, 5);
  });

  it("adds nothing for a none-tax store", () => {
    const d = dist({ taxMode: "none" });
    const r = computeLandedCost(listing(), d, dest, {});
    expect(r!.storeTax).toBe(0);
  });

  it("zeroes all tax when the buyer is tax-exempt", () => {
    const d = dist({ taxMode: "origin" });
    const r = computeLandedCost(listing({ taxRate: 0.24 }), d, dest, {
      taxExempt: true,
    });
    expect(r!.storeTax).toBe(0);
    expect(r!.importEstimate).toBe(0);
    expect(r!.total).toBe(138);
  });

  it("includes the import estimate only when opted in", () => {
    const d = dist({ taxMode: "export-exempt" });
    const off = computeLandedCost(listing(), d, dest, {});
    expect(off!.importEstimate).toBe(0);
    const on = computeLandedCost(listing(), d, dest, {
      includeImportEstimate: true,
    });
    // TH VAT 7% + default duty 5% on (100 + 38) = 9.66 + 6.9 = 16.56
    expect(on!.importEstimate).toBeCloseTo(16.56, 2);
    expect(on!.total).toBeCloseTo(154.56, 2);
  });

  it("returns null when shipping is unknown", () => {
    const d = dist({ shippingCosts: {} });
    expect(computeLandedCost(listing(), d, dest, {})).toBeNull();
  });

  it("converts a non-USD listing into the destination currency", () => {
    const d = dist({ currency: "EUR", taxMode: "none" });
    const r = computeLandedCost(
      listing({ price: 100, currency: "EUR" }),
      d,
      { countryCode: "TH", currency: "USD" },
      {},
    );
    expect(r).not.toBeNull();
    expect(r!.currency).toBe("USD");
    expect(r!.price).toBeGreaterThan(0);
  });
});
