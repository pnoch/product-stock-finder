import { describe, expect, it } from "vitest";
import { normalizeSharedWatchlistProduct } from "../lib/shared-watchlist";

describe("shared-watchlist normalization", () => {
  it("rejects products without an id and name", () => {
    expect(() =>
      normalizeSharedWatchlistProduct({ id: "", name: " " } as never),
    ).toThrow(/id and name are required/);
  });
});
