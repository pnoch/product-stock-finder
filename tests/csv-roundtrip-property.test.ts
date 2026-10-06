import { describe, expect, it } from "vitest";
import {
  parseWatchlistCsv,
  watchlistToDetailedCsv,
} from "../lib/csv";
import type { Product } from "../lib/types";

// Property test for the CSV round-trip. Three real bugs slipped past the
// example-based tests (empty product column dropped, asymmetric apostrophe
// escaping, whitespace-only model dropped), so this generates a wide range of
// values and asserts the invariant directly. Deterministic (seeded) so a
// failure is reproducible without a property-testing dependency.

const CHARS = [
  "a",
  "Z",
  "0",
  '"',
  ",",
  "\n",
  "\r",
  "=",
  "+",
  "-",
  "@",
  "\t",
  "'",
  " ",
  "#",
  "/",
  "é",
  "😀",
  "\u200b",
];

// mulberry32: tiny deterministic PRNG.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomString(next: () => number, maxLen = 8): string {
  const len = Math.floor(next() * maxLen);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CHARS[Math.floor(next() * CHARS.length)];
  }
  return out;
}

function makeProduct(name: string, model: string, url: string): Product {
  return {
    id: "p1",
    name,
    modelNumber: model,
    brand: "MikroTik",
    category: "Switch",
    description: "",
    isWatched: true,
    addedAt: "2026-01-01T00:00:00.000Z",
    listings: [
      {
        distributorId: "mikrotikstore",
        productId: "p1",
        price: 209,
        currency: "USD",
        stockStatus: "in_stock",
        url,
        lastChecked: "2026-01-01T00:00:00.000Z",
        priceHistory: [],
      },
    ],
  } as unknown as Product;
}

// Documented exclusions: a name starting with "//" is the legacy comment
// marker. An empty/whitespace-only name is NOT excluded — it must round-trip
// with the name falling back to the model (see the dedicated case below).
function isExcluded(name: string): boolean {
  return name.trimStart().startsWith("//");
}

describe("CSV detailed round-trip (property)", () => {
  it("preserves name, model, and url across 20k generated products", () => {
    const next = rng(0x5eed);
    let checked = 0;
    for (let i = 0; i < 20000; i++) {
      const name = randomString(next);
      const model = randomString(next);
      const url = randomString(next);
      if (isExcluded(name)) continue;
      // A row with neither a name nor a model has no identity and is dropped
      // by design.
      if (!name.trim() && !model.trim()) continue;
      checked++;

      const csv = watchlistToDetailedCsv([makeProduct(name, model, url)]);
      const parsed = parseWatchlistCsv(csv);

      expect(parsed, `name=${JSON.stringify(name)}`).toHaveLength(1);
      // The parser keeps the product column verbatim unless it is the empty
      // string, in which case it falls back to the model.
      const expectedName = name !== "" ? name : model;
      if (expectedName) {
        expect(parsed[0]!.name, `name=${JSON.stringify(name)}`).toBe(
          expectedName,
        );
      }
      if (model.trim()) {
        expect(parsed[0]!.modelNumber, `model=${JSON.stringify(model)}`).toBe(
          model,
        );
      }
      expect(parsed[0]!.listings[0]!.url, `url=${JSON.stringify(url)}`).toBe(
        url,
      );
    }
    // Guard against the generator degenerating into all-excluded inputs.
    expect(checked).toBeGreaterThan(10000);
  });

  it("keeps a row whose product column is empty but the model is set", () => {
    // The Phase 1111 bug: an empty first field was treated as a blank/comment
    // line and the whole row was dropped.
    const csv = watchlistToDetailedCsv([makeProduct("", "CRS326", "")]);
    const parsed = parseWatchlistCsv(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.modelNumber).toBe("CRS326");
  });

  it("preserves a formula-injection prefix round-trip", () => {
    const next = rng(0xf00d);
    for (let i = 0; i < 2000; i++) {
      const name = randomString(next, 6);
      if (isExcluded(name) || !name.trim()) continue;
      const csv = watchlistToDetailedCsv([makeProduct(name, "M1", "")]);
      expect(parseWatchlistCsv(csv)[0]!.name, JSON.stringify(name)).toBe(name);
    }
  });
});
