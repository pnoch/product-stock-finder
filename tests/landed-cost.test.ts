import { describe, expect, it } from "vitest";
import { resolveShipping } from "../lib/landed-cost";
import type { Distributor } from "../lib/types";

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
    expect(resolveShipping(dist({ shippingCosts: undefined }), "TH")).toBeNull();
  });
});
