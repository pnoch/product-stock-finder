import { describe, expect, it } from "vitest";
import {
  buildWatchlistShareMessage,
  buildWatchlistShareText,
} from "../lib/watchlist-share";
import type { Product } from "../lib/types";

const NOW = Date.parse("2026-06-15T12:00:00Z");

function product(id: string): Product {
  return {
    id,
    name: id,
    brand: "MikroTik",
    category: "Routers",
    modelNumber: id.toUpperCase(),
    description: "",
    isWatched: true,
    addedAt: new Date(NOW).toISOString(),
    listings: [],
  } as unknown as Product;
}

describe("buildWatchlistShareMessage", () => {
  it("returns the server link with summary when shareUrl is present", () => {
    const watchlist = [product("p1")];
    const message = buildWatchlistShareMessage({
      shareUrl: "http://localhost:8081/w/tok123",
      watchlist,
      displayCurrency: "USD",
      days: 30,
      now: NOW,
    });
    expect(message).toContain("http://localhost:8081/w/tok123");
    expect(message).toContain("My Watchlist — 1 products");
  });

  it("falls back to plain text summary when shareUrl is absent", () => {
    const watchlist = [product("p1")];
    const message = buildWatchlistShareMessage({
      watchlist,
      displayCurrency: "USD",
      days: 30,
      now: NOW,
    });
    expect(message).toBe(
      buildWatchlistShareText({ watchlist, displayCurrency: "USD", days: 30, now: NOW }),
    );
  });
});
