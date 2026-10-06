import { describe, expect, it } from "vitest";
import {
  FREE_WATCHLIST_LIMIT,
  canAddToWatchlist,
  isProFeature,
} from "../lib/pro-features";

describe("pro features", () => {
  it("free users can add up to the limit", () => {
    expect(FREE_WATCHLIST_LIMIT).toBe(5);
    expect(canAddToWatchlist(0, false)).toBe(true);
    expect(canAddToWatchlist(4, false)).toBe(true);
    expect(canAddToWatchlist(5, false)).toBe(false);
    expect(canAddToWatchlist(6, false)).toBe(false);
  });

  it("pro users have no limit", () => {
    expect(canAddToWatchlist(5, true)).toBe(true);
    expect(canAddToWatchlist(999, true)).toBe(true);
  });

  it("classifies each feature", () => {
    expect(isProFeature("unlimited_watchlist")).toBe(true);
    expect(isProFeature("background_monitoring")).toBe(true);
    expect(isProFeature("digests")).toBe(true);
    expect(isProFeature("server_sync")).toBe(true);
    expect(isProFeature("bulk_import")).toBe(true);
    expect(isProFeature("landed_cost_sourcing")).toBe(true);
  });
});
