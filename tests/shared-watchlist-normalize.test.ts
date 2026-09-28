import { describe, expect, it } from "vitest";
import { normalizeSharedWatchlistProduct } from "../lib/shared-watchlist";

describe("shared-watchlist normalization", () => {
  it("rejects products without an id and name", () => {
    expect(() =>
      normalizeSharedWatchlistProduct({ id: "", name: " " } as never),
    ).toThrow(/id and name are required/);
  });
});

describe("shared-watchlist normalization (untrusted input)", () => {
  const base = { id: "p1", name: "Router", modelNumber: "CRS804" };

  it("coerces an unknown stock status to 'unknown'", () => {
    const p = normalizeSharedWatchlistProduct({
      ...base,
      listings: [
        { distributorId: "d1", price: 10, stockStatus: "totally-made-up" },
      ],
    });
    expect(p.listings[0]!.stockStatus).toBe("unknown");
  });

  it("drops listings without a distributorId or a finite price", () => {
    const p = normalizeSharedWatchlistProduct({
      ...base,
      listings: [
        { distributorId: "", price: 10 },
        { distributorId: "d1", price: Number.NaN },
        { distributorId: "d1", price: Number.POSITIVE_INFINITY },
        { distributorId: "d2", price: 42 },
      ],
    });
    // Only the last is usable; the rest must not enter the local store.
    expect(p.listings).toHaveLength(1);
    expect(p.listings[0]!.distributorId).toBe("d2");
  });

  it("drops malformed price points and defaults the missing fields", () => {
    const p = normalizeSharedWatchlistProduct({
      ...base,
      listings: [
        {
          distributorId: "d1",
          price: 10,
          priceHistory: [
            { price: 5, date: "2026-01-01T00:00:00.000Z" },
            { price: "not-a-number" },
            null,
            { price: Number.NaN },
          ],
        },
      ],
    });
    expect(p.listings[0]!.priceHistory).toHaveLength(1);
    expect(p.listings[0]!.priceHistory[0]!.price).toBe(5);
    // A point without a currency defaults to USD rather than undefined.
    expect(p.listings[0]!.priceHistory[0]!.currency).toBe("USD");
  });

  it("defaults modelNumber to the id and coerces non-string fields", () => {
    const p = normalizeSharedWatchlistProduct({
      id: "p1",
      name: "Router",
      modelNumber: 42,
      brand: null,
      description: 7,
    });
    expect(p.modelNumber).toBe("p1");
    expect(p.brand).toBe("");
    expect(p.description).toBe("");
  });

  it("keeps only string tags", () => {
    const withTags = normalizeSharedWatchlistProduct({
      ...base,
      tags: ["a", 42, null, "b"],
    });
    expect(withTags.tags).toEqual(["a", "b"]);
    // An absent tags field stays absent; an empty array is equivalent (the tag
    // rendering ignores it) so it is not worth normalising away.
    expect(normalizeSharedWatchlistProduct({ ...base }).tags).toBeUndefined();
    expect(normalizeSharedWatchlistProduct({ ...base, tags: [] }).tags).toEqual(
      [],
    );
  });

  it("always marks the product watched with a listings array", () => {
    const p = normalizeSharedWatchlistProduct({ ...base });
    expect(p.isWatched).toBe(true);
    expect(Array.isArray(p.listings)).toBe(true);
  });
});
