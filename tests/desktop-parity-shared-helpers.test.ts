import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PRODUCT_CATALOG,
  getAllBrands,
  getAllCategories,
  searchCatalog,
} from "@shared/catalog";
import {
  CURRENCY_SYMBOLS,
  EXCHANGE_RATES,
  convertPrice,
  formatPrice,
  getBestPrice,
} from "@shared/currency";
import { cheapestByRegion, filterByRange } from "@shared/compare-utils";
import { FX_TTL_MS } from "@shared/fx";

describe("desktop parity shared helpers", () => {
  it("uses Fuse 0.4 search behavior", () => {
    const results = searchCatalog("CRS804");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].modelNumber).toContain("CRS804");
  });

  it("exposes category and brand taxonomies", () => {
    expect(getAllCategories()).toContain("Router");
    expect(getAllBrands()).toContain("MikroTik");
    expect(PRODUCT_CATALOG.length).toBeGreaterThan(0);
  });

  it("converts and formats prices safely", () => {
    expect(convertPrice(100, "USD", "EUR")).not.toBeNull();
    expect(convertPrice(100, "USD", "UNKNOWN")).toBeNull();
    expect(formatPrice(1181.67, "EUR")).toContain(CURRENCY_SYMBOLS.EUR);
  });

  it("selects best prices only in supported currencies", () => {
    const best = getBestPrice(
      [
        {
          price: 100,
          currency: "USD",
          stockStatus: "in_stock",
        },
        {
          price: 50,
          currency: "UNKNOWN",
          stockStatus: "in_stock",
        },
      ],
      "USD",
    );
    expect(best?.price).toBe(100);
  });

  it("constrains compare ranges to valid data", () => {
    const filtered = filterByRange(
      [
        { date: "2026-01-01T00:00:00.000Z", price: 100, currency: "USD", stockStatus: "in_stock" },
        { date: "not-a-date", price: 200, currency: "USD", stockStatus: "in_stock" },
      ],
      "1W",
    );
    expect(filtered.every((point) => !Number.isNaN(Date.parse(point.date)))).toBe(true);
  });

  it("uses the hourly FX cache window", () => {
    expect(FX_TTL_MS).toBe(60 * 60 * 1000);
    expect(Object.keys(EXCHANGE_RATES)).toContain("USD");
  });

  it("the desktop Rust static rates cover every shared currency", () => {
    // The Settings picker offers every key of EXCHANGE_RATES; the desktop Rust
    // static table (used by the poller's alert conversion before the live FX
    // overlay warms) must cover them all, or a JPY/INR/PLN alert silently never
    // fires. This guard reads the Rust source so the two tables cannot drift.
    const rust = readFileSync(
      join(__dirname, "..", "desktop", "src-tauri", "src", "lib.rs"),
      "utf8",
    );
    const table = rust.slice(
      rust.indexOf("static EXCHANGE_RATES"),
      rust.indexOf("];", rust.indexOf("static EXCHANGE_RATES")),
    );
    for (const code of Object.keys(EXCHANGE_RATES)) {
      expect(table, `desktop EXCHANGE_RATES missing ${code}`).toContain(
        `("${code}",`,
      );
    }
  });

  it("ignores unrecognized listings when choosing regional best prices", () => {
    const best = cheapestByRegion(
      [
        {
          productId: "p1",
          distributorId: "unknown-distributor",
          price: 1,
          currency: "USD",
          stockStatus: "in_stock",
          url: "https://example.com",
          lastChecked: new Date().toISOString(),
          priceHistory: [],
        },
      ],
      "USD",
    );
    expect(best).toEqual([]);
  });
});
