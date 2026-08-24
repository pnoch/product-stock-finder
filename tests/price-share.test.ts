import { describe, expect, it } from "vitest";
import { buildShareText } from "../lib/price-share";
import type { DistributorListing } from "../lib/types";

function listing(
  overrides: Partial<DistributorListing> & { distributorId: string },
): DistributorListing {
  return {
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    priceHistory: [],
    ...overrides,
  } as DistributorListing;
}

const BASE = {
  productName: "MikroTik CRS804",
  modelNumber: "CRS804-4DDQ-hRM",
  displayCurrency: "USD",
};

describe("buildShareText", () => {
  it("lists in-stock prices converted to display currency, sorted ascending", () => {
    const text = buildShareText({
      ...BASE,
      listings: [
        listing({ distributorId: "bhphoto-us", price: 1029 }),
        listing({ distributorId: "mikrotikstore-de", price: 899, currency: "EUR" }),
        listing({ distributorId: "linitx-uk", price: 700, currency: "GBP" }),
      ],
    });
    const lines = text.split("\n");
    expect(lines[0]).toBe(
      "MikroTik CRS804 (CRS804-4DDQ-hRM) — price comparison",
    );
    const priceLines = lines.filter((l) => l.includes("— $"));
    expect(priceLines.length).toBe(3);
    const mikrotikIdx = priceLines.findIndex((l) => l.includes("MikroTik"));
    const bhIdx = priceLines.findIndex((l) => l.includes("B&H"));
    expect(mikrotikIdx).toBeGreaterThanOrEqual(0);
    expect(bhIdx).toBeGreaterThan(mikrotikIdx);
    expect(text).toContain("Prices in USD · via Product Stock Finder");
  });

  it("truncates to five rows", () => {
    const listings = Array.from({ length: 8 }, (_, i) =>
      listing({ distributorId: `dist${i}`, price: 100 + i }),
    );
    const text = buildShareText({ ...BASE, listings });
    const rows = text.split("\n").filter((l) => l.includes("dist"));
    expect(rows).toHaveLength(5);
  });

  it("falls back to out-of-stock message when nothing is in stock", () => {
    const text = buildShareText({
      ...BASE,
      listings: [
        listing({ distributorId: "mikrotikstore-de", stockStatus: "out_of_stock", price: 899 }),
        listing({ distributorId: "winncom-us", stockStatus: "back_order", price: 950 }),
      ],
    });
    expect(text).toContain("All out of stock");
    expect(text).toContain("via Product Stock Finder");
  });

  it("skips listings without a convertible currency", () => {
    const text = buildShareText({
      ...BASE,
      listings: [
        listing({ distributorId: "bhphoto-us", price: 999 }),
        listing({ distributorId: "fake", price: 1, currency: "XYZ" }),
      ],
    });
    expect(text).not.toContain("fake");
    expect(text).toContain("B&H");
  });

  it("emits header + footer only for empty listings", () => {
    const text = buildShareText({ ...BASE, listings: [] });
    const lines = text.split("\n");
    expect(lines[0]).toBe(
      "MikroTik CRS804 (CRS804-4DDQ-hRM) — price comparison",
    );
    expect(text).toContain("Prices in USD · via Product Stock Finder");
  });

  it("appends the best listing URL when present", () => {
    const text = buildShareText({
      ...BASE,
      listings: [
        listing({ distributorId: "bhphoto-us", price: 999, url: "https://bh.example/x" }),
        listing({ distributorId: "winncom-us", price: 1099, url: "https://wn.example/y" }),
      ],
    });
    expect(text.trimEnd().endsWith("https://bh.example/x")).toBe(true);
    expect(text).not.toContain("https://wn.example/y");
  });
});
